// Ports Discovery Module for Y Monitor
// Discovers and updates network interfaces/ports

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { 
  DiscoveryModule, 
  DiscoveryResult, 
  DeviceInfo, 
  OSTemplate 
} from '../interfaces/discovery.interface';
import { SNMP_OIDS } from '../../snmp/types/snmp.types';

export class PortsDiscoveryModule implements DiscoveryModule {
  name = 'ports';
  description = 'Network interfaces discovery';
  enabled = true;
  dependencies = ['core'];
  priority = 2;

  private readonly logger = new Logger(PortsDiscoveryModule.name);

  constructor(
    private snmpClient: SNMPClientService,
    private prisma: PrismaService,
  ) {}

  canDiscover(device: DeviceInfo): boolean {
    // Can discover ports on any network device
    return device.os !== 'windows' && device.os !== 'linux';
  }

  async discover(device: DeviceInfo, templates: OSTemplate[]): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const result: DiscoveryResult = {
      success: false,
      module: this.name,
      deviceId: device.id,
      discovered: [],
      errors: [],
      timestamp: new Date(),
      duration: 0,
    };

    try {
      this.logger.debug(`Starting ports discovery for device ${device.hostname}`);

      // Get interface information from SNMP client
      const interfaces = await this.snmpClient.getInterfaceInfo(device.snmpDevice);
      
      if (!interfaces || interfaces.length === 0) {
        this.logger.warn(`No interfaces found for device ${device.hostname}`);
        result.success = true;
        return result;
      }

      const discoveredPorts = [];

      for (const iface of interfaces) {
        try {
          // Skip interfaces that should be ignored
          if (this.shouldIgnoreInterface(iface, templates)) {
            continue;
          }

          // Create or update port
          const portData = await this.createOrUpdatePort(device.id, iface);
          discoveredPorts.push(portData);

        } catch (error) {
          this.logger.error(`Failed to process interface ${iface.ifDescr}: ${error.message}`);
          result.errors.push(`Interface ${iface.ifDescr}: ${error.message}`);
        }
      }

      // Mark interfaces as deleted if they weren't discovered
      await this.markMissingInterfacesAsDeleted(device.id, discoveredPorts);

      result.discovered = discoveredPorts;
      result.success = true;

      this.logger.log(`Ports discovery completed for ${device.hostname}: ${discoveredPorts.length} interfaces`);
    } catch (error) {
      this.logger.error(`Ports discovery failed for ${device.hostname}: ${error.message}`);
      result.errors.push(error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  validate(data: any[]): boolean {
    return data.every(port => 
      port && 
      typeof port === 'object' &&
      typeof port.ifIndex === 'number' &&
      typeof port.ifDescr === 'string'
    );
  }

  private shouldIgnoreInterface(iface: any, templates: OSTemplate[]): boolean {
    // Get ignore rules from templates
    const portTemplate = templates.find(t => t.discovery?.ports)?.discovery?.ports;
    
    if (portTemplate?.ignore_if) {
      const ignorePatterns = portTemplate.ignore_if;
      for (const pattern of ignorePatterns) {
        if (iface.ifDescr.match(new RegExp(pattern, 'i'))) {
          return true;
        }
      }
    }

    if (portTemplate?.ignore_type) {
      const ignoreTypes = portTemplate.ignore_type;
      if (ignoreTypes.includes(iface.ifType)) {
        return true;
      }
    }

    // Default ignore rules
    const defaultIgnorePatterns = [
      /^lo/i,        // Loopback
      /^null/i,      // Null interfaces
      /^tunnel/i,    // Tunnel interfaces
      /^vlan1$/i,    // Default VLAN
    ];

    for (const pattern of defaultIgnorePatterns) {
      if (iface.ifDescr.match(pattern)) {
        return true;
      }
    }

    // Ignore interfaces with type 24 (loopback) or 131 (tunnel)
    if (iface.ifType === 24 || iface.ifType === 131) {
      return true;
    }

    return false;
  }

  private async createOrUpdatePort(deviceId: string, iface: any): Promise<any> {
    const portData = {
      deviceId,
      ifIndex: iface.ifIndex,
      ifName: iface.ifName || iface.ifDescr,
      ifAlias: iface.ifAlias || null,
      ifDescr: iface.ifDescr,
      ifType: this.mapInterfaceType(iface.ifType),
      ifMtu: iface.ifMtu || null,
      ifSpeed: iface.ifSpeed ? BigInt(iface.ifSpeed) : null,
      ifDuplex: null, // Would need additional SNMP queries
      ifVlan: null,   // Would need additional SNMP queries
      ifAdminStatus: this.mapInterfaceStatus(iface.ifAdminStatus),
      ifOperStatus: this.mapInterfaceStatus(iface.ifOperStatus),
      ifInOctets: iface.ifInOctets ? BigInt(iface.ifInOctets) : null,
      ifOutOctets: iface.ifOutOctets ? BigInt(iface.ifOutOctets) : null,
      ifInUcastPkts: iface.ifInUcastPkts ? BigInt(iface.ifInUcastPkts) : null,
      ifOutUcastPkts: iface.ifOutUcastPkts ? BigInt(iface.ifOutUcastPkts) : null,
      ifInErrors: iface.ifInErrors ? BigInt(iface.ifInErrors) : null,
      ifOutErrors: iface.ifOutErrors ? BigInt(iface.ifOutErrors) : null,
      ifInDiscards: iface.ifInDiscards ? BigInt(iface.ifInDiscards) : null,
      ifOutDiscards: iface.ifOutDiscards ? BigInt(iface.ifOutDiscards) : null,
      lastPolled: new Date(),
    };

    try {
      const existingPort = await this.prisma.port.findUnique({
        where: {
          deviceId_ifIndex: {
            deviceId,
            ifIndex: iface.ifIndex,
          },
        },
      });

      if (existingPort) {
        // Update existing port
        const updatedPort = await this.prisma.port.update({
          where: { id: existingPort.id },
          data: portData,
        });

        this.logger.debug(`Updated port ${iface.ifDescr} (${iface.ifIndex}) for device ${deviceId}`);
        return updatedPort;
      } else {
        // Create new port
        const newPort = await this.prisma.port.create({
          data: portData,
        });

        this.logger.debug(`Created port ${iface.ifDescr} (${iface.ifIndex}) for device ${deviceId}`);
        return newPort;
      }
    } catch (error) {
      this.logger.error(`Failed to save port ${iface.ifDescr}: ${error.message}`);
      throw error;
    }
  }

  private async markMissingInterfacesAsDeleted(deviceId: string, discoveredPorts: any[]): Promise<void> {
    try {
      const discoveredIndexes = discoveredPorts.map(port => port.ifIndex);
      
      if (discoveredIndexes.length === 0) {
        return; // Don't delete all ports if discovery failed
      }

      const result = await this.prisma.port.updateMany({
        where: {
          deviceId,
          ifIndex: {
            notIn: discoveredIndexes,
          },
        },
        data: {
          disabled: true,
          lastPolled: new Date(),
        },
      });

      if (result.count > 0) {
        this.logger.log(`Marked ${result.count} missing interfaces as disabled for device ${deviceId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to mark missing interfaces: ${error.message}`);
    }
  }

  private mapInterfaceType(ifType: number): string {
    // Map RFC 1213 interface types to human-readable strings
    const typeMap: { [key: number]: string } = {
      1: 'other',
      6: 'ethernetCsmacd',
      24: 'softwareLoopback',
      37: 'atm',
      53: 'propVirtual',
      117: 'gigabitEthernet',
      131: 'tunnel',
      135: 'l2vlan',
      161: 'ieee8023adLag',
      169: 'ieee8023adLag',
    };

    return typeMap[ifType] || `type${ifType}`;
  }

  private mapInterfaceStatus(status: number): string {
    // Map interface status to string
    const statusMap: { [key: number]: string } = {
      1: 'up',
      2: 'down',
      3: 'testing',
    };

    return statusMap[status] || 'unknown';
  }

  private async getInterfaceVLAN(device: DeviceInfo, ifIndex: number): Promise<string | null> {
    try {
      // Try to get VLAN information (this would need vendor-specific OIDs)
      // For now, return null as this requires more complex SNMP queries
      return null;
    } catch (error) {
      return null;
    }
  }

  private async getInterfaceDuplex(device: DeviceInfo, ifIndex: number): Promise<string | null> {
    try {
      // Try to get duplex information (vendor-specific OIDs)
      // For now, return null as this requires vendor-specific implementation
      return null;
    } catch (error) {
      return null;
    }
  }

  private formatMacAddress(mac: string): string | null {
    if (!mac || mac.length === 0) {
      return null;
    }

    // Convert hex string to MAC address format
    if (mac.length === 12) {
      return mac.match(/.{2}/g)?.join(':') || null;
    }

    return mac;
  }

  private calculateUtilization(inOctets: bigint, outOctets: bigint, speed: bigint, interval: number): number {
    if (!speed || speed === BigInt(0) || interval === 0) {
      return 0;
    }

    const totalOctets = inOctets + outOctets;
    const bitsPerSecond = (totalOctets * BigInt(8)) / BigInt(interval);
    const utilization = Number(bitsPerSecond * BigInt(100) / speed);

    return Math.min(Math.max(utilization, 0), 100);
  }
}