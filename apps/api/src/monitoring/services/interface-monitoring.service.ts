// Interface Monitoring Service for Y Monitor
// Implements continuous monitoring of network interfaces

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { InfluxDBService } from '../../influxdb/influxdb.service';
import { SNMPDevice, SNMP_OIDS } from '../../snmp/types/snmp.types';

export interface InterfaceMetrics {
  deviceId: string;
  portId: string;
  ifIndex: number;
  timestamp: Date;
  
  // Traffic counters
  ifInOctets: bigint;
  ifOutOctets: bigint;
  ifInUcastPkts: bigint;
  ifOutUcastPkts: bigint;
  ifInNUcastPkts: bigint;
  ifOutNUcastPkts: bigint;
  ifInDiscards: bigint;
  ifOutDiscards: bigint;
  ifInErrors: bigint;
  ifOutErrors: bigint;
  
  // High-capacity counters (64-bit)
  ifHCInOctets?: bigint;
  ifHCOutOctets?: bigint;
  ifHCInUcastPkts?: bigint;
  ifHCOutUcastPkts?: bigint;
  
  // Status
  ifAdminStatus: number;
  ifOperStatus: number;
  
  // Calculated metrics
  utilization?: number;
  inUtilization?: number;
  outUtilization?: number;
  errorRate?: number;
  discardRate?: number;
}

export interface InterfaceStats {
  current: InterfaceMetrics;
  previous?: InterfaceMetrics;
  
  // Rate calculations (per second)
  inRate?: number;
  outRate?: number;
  inPacketRate?: number;
  outPacketRate?: number;
  
  // Utilization percentages
  inUtilization?: number;
  outUtilization?: number;
  totalUtilization?: number;
  
  // Error rates
  inErrorRate?: number;
  outErrorRate?: number;
  inDiscardRate?: number;
  outDiscardRate?: number;
}

@Injectable()
export class InterfaceMonitoringService {
  private readonly logger = new Logger(InterfaceMonitoringService.name);
  private readonly metricsHistory = new Map<string, InterfaceMetrics[]>();
  private readonly lastMetrics = new Map<string, InterfaceMetrics>();
  private isPolling = false;

  constructor(
    private prisma: PrismaService,
    private snmpClient: SNMPClientService,
    private influxdb: InfluxDBService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollAllInterfaces() {
    if (this.isPolling) {
      this.logger.warn('Interface polling already in progress, skipping...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      // Get all active devices
      const devices = await this.prisma.device.findMany({
        where: {
          disabled: false,
          status: 'UP',
        },
        include: {
          ports: {
            where: {
              disabled: false,
            },
          },
        },
      });

      this.logger.log(`Starting interface poll for ${devices.length} devices`);

      // Process devices in batches to avoid overwhelming the system
      const batchSize = this.configService.get<number>('SNMP_BATCH_SIZE', 10);
      const batches = this.chunkArray(devices, batchSize);

      for (const batch of batches) {
        await Promise.all(
          batch.map(device => this.pollDeviceInterfaces(device))
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Interface polling completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Interface polling failed: ${error.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  async pollDeviceInterfaces(device: any): Promise<void> {
    try {
      const snmpDevice = this.buildSNMPDevice(device);
      
      // Test connectivity first
      const isConnected = await this.snmpClient.testConnection(snmpDevice);
      if (!isConnected) {
        this.logger.warn(`Device ${device.hostname} is not reachable via SNMP`);
        await this.updateDeviceStatus(device.id, 'DOWN');
        return;
      }

      // Get interface metrics
      const metrics = await this.getInterfaceMetrics(snmpDevice, device.ports);
      
      // Process and store metrics
      for (const metric of metrics) {
        await this.processInterfaceMetric(metric);
      }

      // Update device status
      await this.updateDeviceStatus(device.id, 'UP');
      
    } catch (error) {
      this.logger.error(`Failed to poll interfaces for device ${device.hostname}: ${error.message}`);
      await this.updateDeviceStatus(device.id, 'DOWN');
    }
  }

  async getInterfaceMetrics(snmpDevice: SNMPDevice, ports: any[]): Promise<InterfaceMetrics[]> {
    const metrics: InterfaceMetrics[] = [];
    
    if (ports.length === 0) {
      return metrics;
    }

    try {
      // Build OIDs for each port and poll using get method
      for (const port of ports) {
        const ifIndex = port.ifIndex;
        const oids = this.buildOIDList(ifIndex);
        
        const response = await this.snmpClient.get(snmpDevice, oids);
        if (response.success) {
          const timestamp = new Date();
          const metric = this.parseInterfaceMetrics(
            response.varbinds,
            port.deviceId,
            port.id,
            ifIndex,
            timestamp
          );

          // Calculate utilization if we have interface speed and previous metrics
          if (port.ifSpeed && port.ifSpeed > 0) {
            const previous = this.lastMetrics.get(`${port.deviceId}:${port.ifIndex}`);
            if (previous) {
              const utilization = this.calculateUtilization(metric, previous, port.ifSpeed);
              metric.utilization = utilization.utilization;
              metric.inUtilization = utilization.inUtilization;
              metric.outUtilization = utilization.outUtilization;
            }
          }

          // Calculate error and discard rates
          const previous = this.lastMetrics.get(`${port.deviceId}:${port.ifIndex}`);
          if (previous) {
            metric.errorRate = this.calculateErrorRate(metric, previous);
            metric.discardRate = this.calculateDiscardRate(metric, previous);
          }

          metrics.push(metric);
        }
      }

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get interface metrics: ${error.message}`);
      return [];
    }
  }

  async processInterfaceMetric(metric: InterfaceMetrics): Promise<void> {
    const key = `${metric.deviceId}:${metric.ifIndex}`;
    
    // Store in history
    if (!this.metricsHistory.has(key)) {
      this.metricsHistory.set(key, []);
    }
    
    const history = this.metricsHistory.get(key)!;
    history.push(metric);
    
    // Keep only last 100 data points
    if (history.length > 100) {
      history.shift();
    }
    
    // Store in InfluxDB for time-series data
    try {
      await this.influxdb.writeInterfaceMetrics(metric);
    } catch (error) {
      this.logger.error(`Failed to write interface metrics to InfluxDB: ${error.message}`);
    }
    
    // Update port statistics in database
    await this.updatePortStatistics(metric);
    
    // Store as last metric for rate calculations
    this.lastMetrics.set(key, metric);
    
    // Check for alerts
    await this.checkInterfaceAlerts(metric);
  }

  async updatePortStatistics(metric: InterfaceMetrics): Promise<void> {
    try {
      const updateData: any = {
        ifInOctets: metric.ifInOctets,
        ifOutOctets: metric.ifOutOctets,
        ifInUcastPkts: metric.ifInUcastPkts,
        ifOutUcastPkts: metric.ifOutUcastPkts,
        ifInErrors: metric.ifInErrors,
        ifOutErrors: metric.ifOutErrors,
        ifInDiscards: metric.ifInDiscards,
        ifOutDiscards: metric.ifOutDiscards,
        ifAdminStatus: metric.ifAdminStatus === 1 ? 'up' : 'down',
        ifOperStatus: metric.ifOperStatus === 1 ? 'up' : 'down',
        lastPolled: metric.timestamp,
      };

      await this.prisma.port.update({
        where: { id: metric.portId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(`Failed to update port statistics: ${error.message}`);
    }
  }

  async checkInterfaceAlerts(metric: InterfaceMetrics): Promise<void> {
    await this.checkInterfaceThresholds(metric);
  }

  private async checkInterfaceThresholds(metric: InterfaceMetrics): Promise<void> {
    const alerts: string[] = [];

    // Check utilization alerts
    if (metric.utilization !== undefined) {
      if (metric.utilization > 95) {
        alerts.push(`Interface critical utilization: ${metric.utilization.toFixed(2)}%`);
      } else if (metric.utilization > 90) {
        alerts.push(`Interface high utilization: ${metric.utilization.toFixed(2)}%`);
      }
    }

    // Check error rate alerts
    if (metric.errorRate !== undefined) {
      const errorThreshold = this.configService.get<number>('INTERFACE_ERROR_THRESHOLD', 1);
      if (metric.errorRate > errorThreshold) {
        alerts.push(`Interface high error rate: ${metric.errorRate.toFixed(2)}%`);
      }
    }

    // Check interface status
    if (metric.ifAdminStatus === 1 && metric.ifOperStatus === 2) {
      alerts.push('Interface is administratively up but operationally down');
    }

    // Create alerts if any
    for (const alertMessage of alerts) {
      const severity = alertMessage.includes('critical') ? 'CRITICAL' : 'WARNING';
      
      // Check if similar alert already exists
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          deviceId: metric.deviceId,
          message: { contains: alertMessage.split(':')[0] },
          state: 'ACTIVE',
        },
      });

      if (!existingAlert) {
        await this.prisma.alert.create({
          data: {
            deviceId: metric.deviceId,
            ruleId: 'interface-monitoring',
            severity,
            state: 'ACTIVE',
            message: alertMessage,
            details: {
              portId: metric.portId,
              ifIndex: metric.ifIndex,
              timestamp: metric.timestamp,
              metrics: {
                utilization: metric.utilization,
                errorRate: metric.errorRate,
                ifAdminStatus: metric.ifAdminStatus,
                ifOperStatus: metric.ifOperStatus,
              },
            },
          },
        });
      }
    }
  }

  async createInterfaceAlert(metric: InterfaceMetrics, message: string): Promise<void> {
    try {
      // Check if similar alert already exists
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          deviceId: metric.deviceId,
          message: { contains: message },
          state: 'ACTIVE',
        },
      });

      if (existingAlert) {
        return; // Don't create duplicate alerts
      }

      // Create new alert
      await this.prisma.alert.create({
        data: {
          deviceId: metric.deviceId,
          ruleId: 'interface-monitoring', // This would be a proper rule ID
          severity: 'WARNING',
          state: 'ACTIVE',
          message: message,
          details: {
            portId: metric.portId,
            ifIndex: metric.ifIndex,
            timestamp: metric.timestamp,
            metrics: {
              utilization: metric.utilization,
              errorRate: metric.errorRate,
              ifAdminStatus: metric.ifAdminStatus,
              ifOperStatus: metric.ifOperStatus,
            },
          },
        },
      });

      this.logger.log(`Created interface alert: ${message}`);
    } catch (error) {
      this.logger.error(`Failed to create interface alert: ${error.message}`);
    }
  }

  async getInterfaceHistory(deviceId: string, ifIndex: number, hours = 24): Promise<InterfaceMetrics[]> {
    const key = `${deviceId}:${ifIndex}`;
    const history = this.metricsHistory.get(key) || [];
    
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return history.filter(metric => metric.timestamp >= cutoff);
  }

  async getInterfaceStats(deviceId: string, ifIndex: number): Promise<InterfaceStats | null> {
    const key = `${deviceId}:${ifIndex}`;
    const history = this.metricsHistory.get(key) || [];
    
    if (history.length === 0) {
      return null;
    }

    const current = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : undefined;

    if (!previous) {
      return { current };
    }

    const timeDiff = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    if (timeDiff <= 0) {
      return { current, previous };
    }

    // Calculate rates
    const inRate = Number(current.ifInOctets - previous.ifInOctets) / timeDiff;
    const outRate = Number(current.ifOutOctets - previous.ifOutOctets) / timeDiff;
    const inPacketRate = Number(current.ifInUcastPkts - previous.ifInUcastPkts) / timeDiff;
    const outPacketRate = Number(current.ifOutUcastPkts - previous.ifOutUcastPkts) / timeDiff;

    return {
      current,
      previous,
      inRate,
      outRate,
      inPacketRate,
      outPacketRate,
      inUtilization: current.inUtilization,
      outUtilization: current.outUtilization,
      totalUtilization: current.utilization,
      inErrorRate: current.errorRate,
      outErrorRate: current.errorRate,
    };
  }

  private extractMetricValue(response: any, ifIndex: number, type: 'number' | 'bigint'): any {
    if (!response || !response.success || !response.varbinds) {
      return type === 'bigint' ? BigInt(0) : 0;
    }

    const varbind = response.varbinds.find((vb: any) => {
      const oid = vb.oid;
      return oid.endsWith(`.${ifIndex}`);
    });

    if (!varbind || varbind.value === null || varbind.value === undefined) {
      return type === 'bigint' ? BigInt(0) : 0;
    }

    try {
      if (type === 'bigint') {
        return BigInt(varbind.value.toString());
      } else {
        return parseInt(varbind.value.toString()) || 0;
      }
    } catch (error) {
      return type === 'bigint' ? BigInt(0) : 0;
    }
  }

  private buildSNMPDevice(device: any): SNMPDevice {
    return {
      hostname: device.ip,
      port: device.snmpPort || 161,
      timeout: device.snmpTimeout || 5000,
      retries: device.snmpRetries || 3,
      transport: 'udp',
      version: device.snmpVersion || 'v2c',
      community: device.snmpCommunity || 'public',
      username: device.snmpUsername,
      authLevel: device.snmpAuthAlgo,
      authProtocol: device.snmpAuthAlgo,
      authPassword: device.snmpPassword,
      privProtocol: device.snmpCryptoAlgo,
      privPassword: device.snmpPassword,
      contextName: '',
    };
  }

  private async updateDeviceStatus(deviceId: string, status: string): Promise<void> {
    try {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { 
          status: status as any,
          lastPolled: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update device status: ${error.message}`);
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private buildOIDList(ifIndex: number): string[] {
    const baseOIDs = [
      '1.3.6.1.2.1.2.2.1.10', // ifInOctets
      '1.3.6.1.2.1.2.2.1.16', // ifOutOctets
      '1.3.6.1.2.1.2.2.1.11', // ifInUcastPkts
      '1.3.6.1.2.1.2.2.1.17', // ifOutUcastPkts
      '1.3.6.1.2.1.2.2.1.12', // ifInNUcastPkts
      '1.3.6.1.2.1.2.2.1.18', // ifOutNUcastPkts
      '1.3.6.1.2.1.2.2.1.13', // ifInDiscards
      '1.3.6.1.2.1.2.2.1.19', // ifOutDiscards
      '1.3.6.1.2.1.2.2.1.14', // ifInErrors
      '1.3.6.1.2.1.2.2.1.20', // ifOutErrors
      '1.3.6.1.2.1.2.2.1.7',  // ifAdminStatus
      '1.3.6.1.2.1.2.2.1.8',  // ifOperStatus
    ];

    return baseOIDs.map(baseOID => `${baseOID}.${ifIndex}`);
  }

  private parseInterfaceMetrics(
    varbinds: any[],
    deviceId: string,
    portId: string,
    ifIndex: number,
    timestamp: Date
  ): InterfaceMetrics {
    return {
      deviceId,
      portId,
      ifIndex,
      timestamp,
      ifInOctets: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.10.${ifIndex}`)),
      ifOutOctets: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.16.${ifIndex}`)),
      ifInUcastPkts: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.11.${ifIndex}`)),
      ifOutUcastPkts: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.17.${ifIndex}`)),
      ifInNUcastPkts: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.12.${ifIndex}`)),
      ifOutNUcastPkts: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.18.${ifIndex}`)),
      ifInDiscards: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.13.${ifIndex}`)),
      ifOutDiscards: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.19.${ifIndex}`)),
      ifInErrors: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.14.${ifIndex}`)),
      ifOutErrors: this.parseValue(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.20.${ifIndex}`)),
      ifAdminStatus: parseInt(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.7.${ifIndex}`)) || 0,
      ifOperStatus: parseInt(this.getValueFromVarbinds(varbinds, `1.3.6.1.2.1.2.2.1.8.${ifIndex}`)) || 0,
    };
  }

  private getValueFromVarbinds(varbinds: any[], oid: string): string {
    const varbind = varbinds.find(vb => vb.oid === oid);
    return varbind?.value?.toString() || '0';
  }

  private parseValue(value: string): bigint {
    try {
      return BigInt(value);
    } catch {
      return BigInt(0);
    }
  }

  private calculateUtilization(
    current: InterfaceMetrics,
    previous: InterfaceMetrics,
    ifSpeed: number
  ): { utilization: number; inUtilization: number; outUtilization: number } {
    const timeDiff = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    
    if (timeDiff <= 0) {
      return { utilization: 0, inUtilization: 0, outUtilization: 0 };
    }

    // Handle counter rollover for 32-bit counters
    let inOctetsDiff = Number(current.ifInOctets - previous.ifInOctets);
    let outOctetsDiff = Number(current.ifOutOctets - previous.ifOutOctets);

    // Check for counter rollover (negative difference indicates rollover)
    if (inOctetsDiff < 0) {
      inOctetsDiff = Number(current.ifInOctets) + (Math.pow(2, 32) - Number(previous.ifInOctets));
    }
    if (outOctetsDiff < 0) {
      outOctetsDiff = Number(current.ifOutOctets) + (Math.pow(2, 32) - Number(previous.ifOutOctets));
    }

    const inRate = (inOctetsDiff * 8) / timeDiff; // bits per second
    const outRate = (outOctetsDiff * 8) / timeDiff; // bits per second

    const inUtilization = (inRate / ifSpeed) * 100;
    const outUtilization = (outRate / ifSpeed) * 100;
    const utilization = Math.max(inUtilization, outUtilization);

    return {
      utilization: Math.max(0, Math.min(100, utilization)),
      inUtilization: Math.max(0, Math.min(100, inUtilization)),
      outUtilization: Math.max(0, Math.min(100, outUtilization)),
    };
  }

  private calculateErrorRate(current: InterfaceMetrics, previous: InterfaceMetrics): number {
    const inErrorsDiff = Number(current.ifInErrors - previous.ifInErrors);
    const outErrorsDiff = Number(current.ifOutErrors - previous.ifOutErrors);
    const inPacketsDiff = Number(current.ifInUcastPkts - previous.ifInUcastPkts);
    const outPacketsDiff = Number(current.ifOutUcastPkts - previous.ifOutUcastPkts);

    const totalErrors = inErrorsDiff + outErrorsDiff;
    const totalPackets = inPacketsDiff + outPacketsDiff;

    if (totalPackets === 0) {
      return 0;
    }

    return (totalErrors / totalPackets) * 100;
  }

  private calculateDiscardRate(current: InterfaceMetrics, previous: InterfaceMetrics): number {
    const inDiscardsDiff = Number(current.ifInDiscards - previous.ifInDiscards);
    const outDiscardsDiff = Number(current.ifOutDiscards - previous.ifOutDiscards);
    const inPacketsDiff = Number(current.ifInUcastPkts - previous.ifInUcastPkts);
    const outPacketsDiff = Number(current.ifOutUcastPkts - previous.ifOutUcastPkts);

    const totalDiscards = inDiscardsDiff + outDiscardsDiff;
    const totalPackets = inPacketsDiff + outPacketsDiff;

    if (totalPackets === 0) {
      return 0;
    }

    return (totalDiscards / totalPackets) * 100;
  }

  onModuleDestroy() {
    // Cleanup resources
    this.metricsHistory.clear();
    this.lastMetrics.clear();
  }
}