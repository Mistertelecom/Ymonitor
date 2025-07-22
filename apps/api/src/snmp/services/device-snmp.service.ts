import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from './snmp-client.service';
import { SNMPDevice } from '../types/snmp.types';

@Injectable()
export class DeviceSNMPService {
  private readonly logger = new Logger(DeviceSNMPService.name);

  constructor(
    private prisma: PrismaService,
    private snmpClient: SNMPClientService,
  ) {}

  async testUbiquitiDevice() {
    const testDevice: SNMPDevice = {
      hostname: '10.248.8.26',
      port: 161,
      version: 'v1',
      community: 'Facil_SNMP_V1',
      timeout: 5000,
      retries: 3,
      transport: 'udp4',
    };

    this.logger.log('Testing connection to Ubiquiti device 10.248.8.26...');

    try {
      // Test basic connection
      const connected = await this.snmpClient.testConnection(testDevice);
      if (!connected) {
        throw new Error('Failed to connect to device');
      }
      this.logger.log('Connection successful!');

      // Get system information
      const systemInfo = await this.snmpClient.getSystemInfo(testDevice);
      this.logger.log('System Info:', JSON.stringify(systemInfo, null, 2));

      // Get interface information
      const interfaces = await this.snmpClient.getInterfaceInfo(testDevice);
      this.logger.log(`Found ${interfaces.length} interfaces`);

      return {
        connected: true,
        systemInfo,
        interfaces: interfaces.slice(0, 5), // Only show first 5 interfaces
        totalInterfaces: interfaces.length,
      };
    } catch (error) {
      this.logger.error(`Failed to test device: ${error.message}`);
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  async addUbiquitiDevice() {
    const deviceData = {
      hostname: '10.248.8.26',
      ip: '10.248.8.26',
      type: 'WIRELESS' as const,
      status: 'DOWN' as const,
      snmpVersion: 'v1',
      snmpCommunity: 'Facil_SNMP_V1',
      snmpPort: 161,
      snmpTimeout: 5000,
      snmpRetries: 3,
      displayName: 'Ubiquiti Test Device',
      vendor: 'Ubiquiti',
    };

    try {
      // Check if device already exists
      const existingDevice = await this.prisma.device.findFirst({
        where: {
          OR: [
            { hostname: deviceData.hostname },
            { ip: deviceData.ip },
          ],
        },
      });

      if (existingDevice) {
        this.logger.log('Device already exists, updating...');
        return this.prisma.device.update({
          where: { id: existingDevice.id },
          data: deviceData,
        });
      }

      // Create new device
      this.logger.log('Creating new device...');
      const device = await this.prisma.device.create({
        data: deviceData,
      });

      this.logger.log(`Device created with ID: ${device.id}`);
      return device;
    } catch (error) {
      this.logger.error(`Failed to add device: ${error.message}`);
      throw error;
    }
  }

  async pollDevice(deviceId: string) {
    this.logger.log(`Starting SNMP poll for device ${deviceId}`);

    try {
      // Get device from database
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        include: { ports: true },
      });

      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      const snmpDevice: SNMPDevice = {
        hostname: device.ip,
        port: device.snmpPort,
        version: device.snmpVersion as any,
        community: device.snmpCommunity,
        timeout: device.snmpTimeout,
        retries: device.snmpRetries,
        transport: 'udp4',
      };

      // Test connection
      const connected = await this.snmpClient.testConnection(snmpDevice);
      const newStatus = connected ? 'UP' : 'DOWN';

      // Get system information
      let systemInfo: any = {};
      let interfaces: any[] = [];
      let uptime: bigint | null = null;

      if (connected) {
        try {
          systemInfo = await this.snmpClient.getSystemInfo(snmpDevice);
          interfaces = await this.snmpClient.getInterfaceInfo(snmpDevice);
          
          // Convert uptime to BigInt if available
          if (systemInfo.sysUptime) {
            uptime = BigInt(systemInfo.sysUptime);
          }
        } catch (error) {
          this.logger.warn(`Failed to get extended info: ${error.message}`);
        }
      }

      // Update device in database
      const updatedDevice = await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          status: newStatus,
          sysName: systemInfo.sysName || device.sysName,
          sysDescr: systemInfo.sysDescr || device.sysDescr,
          sysContact: systemInfo.sysContact || device.sysContact,
          sysLocation: systemInfo.sysLocation || device.sysLocation,
          uptime,
          lastPolled: new Date(),
          availability: connected ? 100 : 0,
        },
      });

      // Update interfaces
      if (interfaces.length > 0) {
        await this.updateDeviceInterfaces(deviceId, interfaces);
      }

      this.logger.log(`Poll completed for device ${deviceId}. Status: ${newStatus}`);

      return {
        device: updatedDevice,
        systemInfo,
        interfaceCount: interfaces.length,
        connected,
      };
    } catch (error) {
      this.logger.error(`Poll failed for device ${deviceId}: ${error.message}`);
      
      // Update device status to DOWN on error
      await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          status: 'DOWN',
          lastPolled: new Date(),
          availability: 0,
        },
      });

      throw error;
    }
  }

  private async updateDeviceInterfaces(deviceId: string, interfaces: any[]) {
    this.logger.log(`Updating ${interfaces.length} interfaces for device ${deviceId}`);

    for (const iface of interfaces) {
      try {
        const portData = {
          deviceId,
          ifIndex: iface.ifIndex || 0,
          ifName: iface.ifName || iface.ifDescr || `Interface ${iface.ifIndex}`,
          ifDescr: iface.ifDescr || '',
          ifAlias: iface.ifAlias || '',
          ifType: iface.ifType?.toString() || 'unknown',
          ifMtu: iface.ifMtu || null,
          ifSpeed: iface.ifSpeed ? BigInt(iface.ifSpeed) : null,
          ifAdminStatus: this.mapInterfaceStatus(iface.ifAdminStatus),
          ifOperStatus: this.mapInterfaceStatus(iface.ifOperStatus),
          ifInOctets: iface.ifHCInOctets || BigInt(iface.ifInOctets || 0),
          ifOutOctets: iface.ifHCOutOctets || BigInt(iface.ifOutOctets || 0),
          ifInErrors: BigInt(iface.ifInErrors || 0),
          ifOutErrors: BigInt(iface.ifOutErrors || 0),
          ifInDiscards: BigInt(iface.ifInDiscards || 0),
          ifOutDiscards: BigInt(iface.ifOutDiscards || 0),
          lastPolled: new Date(),
        };

        await this.prisma.port.upsert({
          where: {
            deviceId_ifIndex: {
              deviceId,
              ifIndex: portData.ifIndex,
            },
          },
          update: {
            ...portData,
            updatedAt: new Date(),
          },
          create: portData,
        });
      } catch (error) {
        this.logger.error(`Failed to update interface ${iface.ifIndex}: ${error.message}`);
      }
    }

    this.logger.log('Interface update completed');
  }

  private mapInterfaceStatus(status: any): string {
    const statusNum = parseInt(status);
    switch (statusNum) {
      case 1: return 'up';
      case 2: return 'down';
      case 3: return 'testing';
      case 4: return 'unknown';
      case 5: return 'dormant';
      case 6: return 'notPresent';
      case 7: return 'lowerLayerDown';
      default: return 'unknown';
    }
  }

  async getDeviceStats() {
    const [total, up, down, warning, unknown] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 'UP' } }),
      this.prisma.device.count({ where: { status: 'DOWN' } }),
      this.prisma.device.count({ where: { status: 'WARNING' } }),
      this.prisma.device.count({ where: { status: 'UNKNOWN' } }),
    ]);

    const availability = total > 0 ? (up / total) * 100 : 0;

    return {
      total,
      online: up,
      offline: down,
      warning,
      unknown,
      availability: parseFloat(availability.toFixed(1)),
    };
  }

  async getAllDevicesWithPorts() {
    return this.prisma.device.findMany({
      include: {
        location: true,
        ports: {
          take: 5, // Limit to first 5 ports for performance
          orderBy: { ifIndex: 'asc' },
        },
        _count: {
          select: {
            ports: true,
            sensors: true,
            alerts: {
              where: { state: 'open' },
            },
          },
        },
      },
      orderBy: { lastPolled: 'desc' },
    });
  }
}