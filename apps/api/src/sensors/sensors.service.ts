// Sensors Service for Y Monitor
// Environmental and hardware sensors monitoring

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SNMPClientService } from '../snmp/services/snmp-client.service';
import { InfluxDBService } from '../influxdb/influxdb.service';
import { SNMPDevice, SNMP_OIDS } from '../snmp/types/snmp.types';

// Sensor OIDs commonly used in network devices
const SENSOR_OIDS = {
  // Temperature sensors
  TEMPERATURE: {
    CISCO_ENV_MON: '1.3.6.1.4.1.9.9.13.1.3.1.3', // Cisco Environmental Monitor
    ENTITY_SENSOR: '1.3.6.1.2.1.99.1.1.1.4',     // RFC 3433 Entity Sensor
    LM_SENSORS: '1.3.6.1.4.1.2021.13.16.2.1.3',  // Linux LM-Sensors
  },
  // Humidity sensors
  HUMIDITY: {
    CISCO_ENV_MON: '1.3.6.1.4.1.9.9.13.1.4.1.3',
    ENTITY_SENSOR: '1.3.6.1.2.1.99.1.1.1.4',
  },
  // Voltage sensors
  VOLTAGE: {
    CISCO_ENV_MON: '1.3.6.1.4.1.9.9.13.1.2.1.3',
    ENTITY_SENSOR: '1.3.6.1.2.1.99.1.1.1.4',
    UPS_BATTERY: '1.3.6.1.2.1.33.1.2.5.0',
  },
  // Current sensors
  CURRENT: {
    CISCO_ENV_MON: '1.3.6.1.4.1.9.9.13.1.5.1.3',
    UPS_CURRENT: '1.3.6.1.2.1.33.1.3.3.1.3',
  },
  // Power sensors
  POWER: {
    CISCO_POWER: '1.3.6.1.4.1.9.9.108.1.1.1.1.5',
    ENTITY_SENSOR: '1.3.6.1.2.1.99.1.1.1.4',
    UPS_POWER: '1.3.6.1.2.1.33.1.4.4.1.4',
  },
  // Fan sensors
  FAN_SPEED: {
    CISCO_ENV_MON: '1.3.6.1.4.1.9.9.13.1.4.1.3',
    ENTITY_SENSOR: '1.3.6.1.2.1.99.1.1.1.4',
  },
  // Frequency sensors
  FREQUENCY: {
    UPS_FREQUENCY: '1.3.6.1.2.1.33.1.4.2.0',
  },
  // Signal strength (wireless)
  SIGNAL: {
    WIRELESS_RSSI: '1.3.6.1.4.1.14179.2.1.1.1.1',
    WIRELESS_SNR: '1.3.6.1.4.1.14179.2.1.1.1.2',
  },
};

export interface SensorReading {
  deviceId: string;
  sensorId: string;
  sensorType: string;
  sensorDescr: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: {
    min?: number;
    max?: number;
    warning?: number;
    critical?: number;
  };
}

export interface SensorConfig {
  enabled: boolean;
  pollingInterval: number; // in seconds
  thresholds: {
    warning: number;
    critical: number;
  };
  unit: string;
}

@Injectable()
export class SensorsService {
  private readonly logger = new Logger(SensorsService.name);
  private readonly sensorHistory = new Map<string, SensorReading[]>();
  private isPolling = false;

  constructor(
    private prisma: PrismaService,
    private snmpClient: SNMPClientService,
    private influxdb: InfluxDBService,
    private configService: ConfigService,
  ) {}

  @Cron('0 */2 * * * *')
  async pollAllSensors() {
    if (this.isPolling) {
      this.logger.warn('Sensor polling already in progress, skipping...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      // Get all devices with sensors enabled
      const devices = await this.prisma.device.findMany({
        where: {
          disabled: false,
          sensors: {
            some: {
              disabled: false,
            },
          },
        },
        include: {
          sensors: {
            where: {
              disabled: false,
            },
          },
        },
      });

      this.logger.log(`Starting sensor polling for ${devices.length} devices`);

      // Process devices in batches
      const batchSize = this.configService.get<number>('SENSOR_BATCH_SIZE', 5);
      const batches = this.chunkArray(devices, batchSize);

      for (const batch of batches) {
        await Promise.all(
          batch.map(device => this.pollDeviceSensors(device))
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Sensor polling completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Sensor polling failed: ${error.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  async pollDeviceSensors(device: any): Promise<void> {
    try {
      const snmpDevice = this.buildSNMPDevice(device);
      
      // Test connectivity first
      const isConnected = await this.snmpClient.testConnection(snmpDevice);
      if (!isConnected) {
        this.logger.warn(`Device ${device.hostname} is not reachable via SNMP`);
        return;
      }

      // Poll each sensor
      for (const sensor of device.sensors) {
        try {
          const reading = await this.getSensorReading(snmpDevice, sensor);
          if (reading) {
            await this.processSensorReading(reading);
          }
        } catch (error) {
          this.logger.error(`Failed to poll sensor ${sensor.sensorDescr} on device ${device.hostname}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to poll sensors for device ${device.hostname}: ${error.message}`);
    }
  }

  async getSensorReading(snmpDevice: SNMPDevice, sensor: any): Promise<SensorReading | null> {
    try {
      const response = await this.snmpClient.get(snmpDevice, [sensor.sensorOid]);
      
      if (!response.success || response.varbinds.length === 0) {
        return null;
      }

      const varbind = response.varbinds[0];
      let value = this.parseVarbindValue(varbind);

      // Apply sensor-specific transformations
      value = this.transformSensorValue(value, sensor.sensorType, sensor.sensorClass);

      return {
        deviceId: sensor.deviceId,
        sensorId: sensor.id,
        sensorType: sensor.sensorType,
        sensorDescr: sensor.sensorDescr,
        value: value,
        unit: this.getSensorUnit(sensor.sensorType),
        timestamp: new Date(),
        threshold: {
          warning: sensor.sensorLimit,
          critical: sensor.sensorLimitLow,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get sensor reading: ${error.message}`);
      return null;
    }
  }

  async processSensorReading(reading: SensorReading): Promise<void> {
    const key = `${reading.deviceId}:${reading.sensorId}`;
    
    // Store in history
    if (!this.sensorHistory.has(key)) {
      this.sensorHistory.set(key, []);
    }
    
    const history = this.sensorHistory.get(key)!;
    history.push(reading);
    
    // Keep only last 200 readings
    if (history.length > 200) {
      history.shift();
    }

    // Store in InfluxDB
    try {
      await this.influxdb.writeSensorMetrics(
        reading.deviceId,
        reading.sensorId,
        reading.sensorType,
        reading.value,
        reading.unit,
        reading.timestamp
      );
    } catch (error) {
      this.logger.error(`Failed to write sensor data to InfluxDB: ${error.message}`);
    }

    // Update sensor in database
    await this.updateSensorValue(reading);

    // Check thresholds and create alerts
    await this.checkSensorThresholds(reading);
  }

  async updateSensorValue(reading: SensorReading): Promise<void> {
    try {
      await this.prisma.sensor.update({
        where: { id: reading.sensorId },
        data: {
          sensorValue: reading.value,
          sensorPrev: reading.value, // Store previous value for comparison
          lastPolled: reading.timestamp,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update sensor value: ${error.message}`);
    }
  }

  async checkSensorThresholds(reading: SensorReading): Promise<void> {
    const alerts: string[] = [];

    if (reading.threshold?.critical !== undefined) {
      if (reading.value > reading.threshold.critical) {
        alerts.push(`${reading.sensorDescr} is critically high: ${reading.value}${reading.unit}`);
      }
    }

    if (reading.threshold?.warning !== undefined) {
      if (reading.value > reading.threshold.warning) {
        alerts.push(`${reading.sensorDescr} is above warning threshold: ${reading.value}${reading.unit}`);
      }
    }

    // Temperature-specific checks
    if (reading.sensorType === 'TEMPERATURE') {
      if (reading.value > 70) {
        alerts.push(`High temperature detected: ${reading.value}°C`);
      } else if (reading.value < 0) {
        alerts.push(`Low temperature detected: ${reading.value}°C`);
      }
    }

    // Humidity-specific checks
    if (reading.sensorType === 'HUMIDITY') {
      if (reading.value > 80) {
        alerts.push(`High humidity detected: ${reading.value}%`);
      } else if (reading.value < 10) {
        alerts.push(`Low humidity detected: ${reading.value}%`);
      }
    }

    // Voltage-specific checks
    if (reading.sensorType === 'VOLTAGE') {
      if (reading.value < 10) {
        alerts.push(`Low voltage detected: ${reading.value}V`);
      }
    }

    // Create alerts if any
    for (const alertMessage of alerts) {
      await this.createSensorAlert(reading, alertMessage);
    }
  }

  async createSensorAlert(reading: SensorReading, message: string): Promise<void> {
    try {
      // Check if similar alert already exists
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          deviceId: reading.deviceId,
          message: { contains: message },
          state: 'open',
        },
      });

      if (existingAlert) {
        return; // Don't create duplicate alerts
      }

      // Determine severity based on sensor type and value
      let severity = 'warning';
      if (reading.sensorType === 'TEMPERATURE' && reading.value > 80) {
        severity = 'critical';
      } else if (reading.sensorType === 'VOLTAGE' && reading.value < 5) {
        severity = 'critical';
      }

      // Create new alert
      await this.prisma.alert.create({
        data: {
          deviceId: reading.deviceId,
          ruleId: 'sensor-monitoring', // This would be a proper rule ID
          severity: severity as any,
          state: 'open',
          message: message,
          details: {
            sensorId: reading.sensorId,
            sensorType: reading.sensorType,
            sensorDescr: reading.sensorDescr,
            value: reading.value,
            unit: reading.unit,
            timestamp: reading.timestamp,
          },
        },
      });

      this.logger.log(`Created sensor alert: ${message}`);
    } catch (error) {
      this.logger.error(`Failed to create sensor alert: ${error.message}`);
    }
  }

  async discoverSensors(deviceId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    try {
      const snmpDevice = this.buildSNMPDevice(device);

      // Discover different types of sensors
      await this.discoverTemperatureSensors(snmpDevice, deviceId);
      await this.discoverHumiditySensors(snmpDevice, deviceId);
      await this.discoverVoltageSensors(snmpDevice, deviceId);
      await this.discoverPowerSensors(snmpDevice, deviceId);
      await this.discoverFanSensors(snmpDevice, deviceId);

      this.logger.log(`Sensor discovery completed for device ${device.hostname}`);
    } catch (error) {
      this.logger.error(`Sensor discovery failed for device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  private async discoverTemperatureSensors(snmpDevice: SNMPDevice, deviceId: string): Promise<void> {
    const temperatureOIDs = [
      SENSOR_OIDS.TEMPERATURE.CISCO_ENV_MON,
      SENSOR_OIDS.TEMPERATURE.ENTITY_SENSOR,
      SENSOR_OIDS.TEMPERATURE.LM_SENSORS,
    ];

    for (const oid of temperatureOIDs) {
      try {
        const response = await this.snmpClient.walk(snmpDevice, oid);
        if (response.success && response.varbinds.length > 0) {
          await this.processSensorDiscovery(deviceId, response.varbinds, 'TEMPERATURE', oid);
        }
      } catch (error) {
        this.logger.debug(`Temperature sensor discovery failed for OID ${oid}: ${error.message}`);
      }
    }
  }

  private async discoverHumiditySensors(snmpDevice: SNMPDevice, deviceId: string): Promise<void> {
    const humidityOIDs = [
      SENSOR_OIDS.HUMIDITY.CISCO_ENV_MON,
      SENSOR_OIDS.HUMIDITY.ENTITY_SENSOR,
    ];

    for (const oid of humidityOIDs) {
      try {
        const response = await this.snmpClient.walk(snmpDevice, oid);
        if (response.success && response.varbinds.length > 0) {
          await this.processSensorDiscovery(deviceId, response.varbinds, 'HUMIDITY', oid);
        }
      } catch (error) {
        this.logger.debug(`Humidity sensor discovery failed for OID ${oid}: ${error.message}`);
      }
    }
  }

  private async discoverVoltageSensors(snmpDevice: SNMPDevice, deviceId: string): Promise<void> {
    const voltageOIDs = [
      SENSOR_OIDS.VOLTAGE.CISCO_ENV_MON,
      SENSOR_OIDS.VOLTAGE.ENTITY_SENSOR,
      SENSOR_OIDS.VOLTAGE.UPS_BATTERY,
    ];

    for (const oid of voltageOIDs) {
      try {
        const response = await this.snmpClient.walk(snmpDevice, oid);
        if (response.success && response.varbinds.length > 0) {
          await this.processSensorDiscovery(deviceId, response.varbinds, 'VOLTAGE', oid);
        }
      } catch (error) {
        this.logger.debug(`Voltage sensor discovery failed for OID ${oid}: ${error.message}`);
      }
    }
  }

  private async discoverPowerSensors(snmpDevice: SNMPDevice, deviceId: string): Promise<void> {
    const powerOIDs = [
      SENSOR_OIDS.POWER.CISCO_POWER,
      SENSOR_OIDS.POWER.ENTITY_SENSOR,
      SENSOR_OIDS.POWER.UPS_POWER,
    ];

    for (const oid of powerOIDs) {
      try {
        const response = await this.snmpClient.walk(snmpDevice, oid);
        if (response.success && response.varbinds.length > 0) {
          await this.processSensorDiscovery(deviceId, response.varbinds, 'POWER', oid);
        }
      } catch (error) {
        this.logger.debug(`Power sensor discovery failed for OID ${oid}: ${error.message}`);
      }
    }
  }

  private async discoverFanSensors(snmpDevice: SNMPDevice, deviceId: string): Promise<void> {
    const fanOIDs = [
      SENSOR_OIDS.FAN_SPEED.CISCO_ENV_MON,
      SENSOR_OIDS.FAN_SPEED.ENTITY_SENSOR,
    ];

    for (const oid of fanOIDs) {
      try {
        const response = await this.snmpClient.walk(snmpDevice, oid);
        if (response.success && response.varbinds.length > 0) {
          await this.processSensorDiscovery(deviceId, response.varbinds, 'FAN_SPEED', oid);
        }
      } catch (error) {
        this.logger.debug(`Fan sensor discovery failed for OID ${oid}: ${error.message}`);
      }
    }
  }

  private async processSensorDiscovery(
    deviceId: string,
    varbinds: any[],
    sensorType: string,
    baseOid: string
  ): Promise<void> {
    for (const varbind of varbinds) {
      try {
        const sensorIndex = varbind.oid.replace(baseOid + '.', '');
        const sensorDescr = `${sensorType} Sensor ${sensorIndex}`;

        // Check if sensor already exists
        const existingSensor = await this.prisma.sensor.findFirst({
          where: {
            deviceId,
            sensorIndex,
            sensorType: sensorType as any,
          },
        });

        if (!existingSensor) {
          await this.prisma.sensor.create({
            data: {
              deviceId,
              sensorIndex,
              sensorType: sensorType as any,
              sensorDescr,
              sensorOid: varbind.oid,
              sensorClass: 'hardware',
              sensorCustom: false,
              disabled: false,
            },
          });

          this.logger.log(`Discovered new sensor: ${sensorDescr} on device ${deviceId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to process sensor discovery: ${error.message}`);
      }
    }
  }

  private transformSensorValue(value: any, sensorType: string, sensorClass?: string): number {
    let numValue = parseFloat(value) || 0;

    // Apply transformations based on sensor type
    switch (sensorType) {
      case 'TEMPERATURE':
        // Some devices report in tenths of degrees
        if (numValue > 100) {
          numValue = numValue / 10;
        }
        break;
      case 'VOLTAGE':
        // Some devices report in millivolts
        if (numValue > 1000) {
          numValue = numValue / 1000;
        }
        break;
      case 'POWER':
        // Some devices report in watts, others in milliwatts
        if (numValue > 100000) {
          numValue = numValue / 1000;
        }
        break;
      case 'FAN_SPEED':
        // Usually in RPM, no transformation needed
        break;
    }

    return numValue;
  }

  private getSensorUnit(sensorType: string): string {
    switch (sensorType) {
      case 'TEMPERATURE':
        return '°C';
      case 'HUMIDITY':
        return '%';
      case 'VOLTAGE':
        return 'V';
      case 'CURRENT':
        return 'A';
      case 'POWER':
        return 'W';
      case 'FAN_SPEED':
        return 'RPM';
      case 'FREQUENCY':
        return 'Hz';
      case 'SIGNAL':
        return 'dBm';
      default:
        return '';
    }
  }

  private parseVarbindValue(varbind: any): number {
    if (!varbind || varbind.value === null || varbind.value === undefined) {
      return 0;
    }

    const value = parseFloat(varbind.value);
    return isNaN(value) ? 0 : value;
  }

  private buildSNMPDevice(device: any): SNMPDevice {
    return {
      hostname: device.ip,
      port: device.snmpPort || 161,
      timeout: device.snmpTimeout || 5000,
      retries: device.snmpRetries || 3,
      transport: 'udp4',
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

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async getSensorHistory(deviceId: string, sensorId: string, hours = 24): Promise<SensorReading[]> {
    const key = `${deviceId}:${sensorId}`;
    const history = this.sensorHistory.get(key) || [];
    
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return history.filter(reading => reading.timestamp >= cutoff);
  }

  async getDeviceSensors(deviceId: string): Promise<any[]> {
    return this.prisma.sensor.findMany({
      where: {
        deviceId,
        disabled: false,
      },
      orderBy: {
        sensorDescr: 'asc',
      },
    });
  }


  onModuleDestroy() {
    // Cleanup resources
    this.sensorHistory.clear();
  }
}