// Topology Discovery Module for Y Monitor
// Discovers network topology using LLDP and CDP protocols

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { 
  DiscoveryModule, 
  DiscoveryResult, 
  DeviceInfo, 
  OSTemplate,
  TopologyInfo 
} from '../interfaces/discovery.interface';
import { SNMP_OIDS } from '../../snmp/types/snmp.types';

export class TopologyDiscoveryModule implements DiscoveryModule {
  name = 'topology';
  description = 'Network topology discovery via LLDP and CDP';
  enabled = true;
  dependencies = ['core', 'ports'];
  priority = 5;

  private readonly logger = new Logger(TopologyDiscoveryModule.name);

  constructor(
    private snmpClient: SNMPClientService,
    private prisma: PrismaService,
  ) {}

  canDiscover(device: DeviceInfo): boolean {
    // Topology discovery is useful for network equipment
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
      this.logger.debug(`Starting topology discovery for device ${device.hostname}`);

      const discoveredTopology: TopologyInfo[] = [];

      // Discover LLDP neighbors
      const lldpNeighbors = await this.discoverLLDPNeighbors(device);
      discoveredTopology.push(...lldpNeighbors);

      // Discover CDP neighbors (Cisco-specific)
      if (device.os?.includes('cisco')) {
        const cdpNeighbors = await this.discoverCDPNeighbors(device);
        discoveredTopology.push(...cdpNeighbors);
      }

      // Process and save topology information
      const savedTopology = [];
      for (const topology of discoveredTopology) {
        try {
          const savedEntry = await this.createOrUpdateTopology(device.id, topology);
          savedTopology.push(savedEntry);
        } catch (error) {
          this.logger.error(`Failed to save topology entry: ${error.message}`);
          result.errors.push(`Topology entry: ${error.message}`);
        }
      }

      // Clean up old topology entries that weren't rediscovered
      await this.cleanupOldTopologyEntries(device.id, savedTopology);

      result.discovered = savedTopology;
      result.success = true;

      this.logger.log(`Topology discovery completed for ${device.hostname}: ${savedTopology.length} neighbors`);
    } catch (error) {
      this.logger.error(`Topology discovery failed for ${device.hostname}: ${error.message}`);
      result.errors.push(error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  validate(data: any[]): boolean {
    return data.every(topology => 
      topology && 
      typeof topology === 'object' &&
      typeof topology.protocol === 'string' &&
      (topology.remoteHostname || topology.remoteChassisId)
    );
  }

  private async discoverLLDPNeighbors(device: DeviceInfo): Promise<TopologyInfo[]> {
    const neighbors: TopologyInfo[] = [];

    try {
      // Get LLDP remote table
      const responses = await Promise.allSettled([
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_REM_CHASSIS_ID),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_REM_PORT_ID),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_REM_PORT_DESC),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_REM_SYS_NAME),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_REM_SYS_DESC),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_REM_SYS_CAP),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.LLDP.LLDP_LOC_PORT_ID),
      ]);

      // Check if LLDP is available
      const chassisResponse = responses[0];
      if (chassisResponse.status === 'rejected' || 
          (chassisResponse.status === 'fulfilled' && !chassisResponse.value.success)) {
        return neighbors;
      }

      const chassisVarbinds = chassisResponse.value.varbinds;
      if (chassisVarbinds.length === 0) {
        return neighbors;
      }

      // Extract data from other responses
      const getVarbinds = (responseIndex: number) => {
        const response = responses[responseIndex];
        return response.status === 'fulfilled' && response.value.success 
          ? response.value.varbinds 
          : [];
      };

      const portIdVarbinds = getVarbinds(1);
      const portDescVarbinds = getVarbinds(2);
      const sysNameVarbinds = getVarbinds(3);
      const sysDescVarbinds = getVarbinds(4);
      const sysCapVarbinds = getVarbinds(5);
      const locPortIdVarbinds = getVarbinds(6);

      // Process each LLDP neighbor
      for (const chassisVb of chassisVarbinds) {
        const indexParts = this.extractLLDPIndex(chassisVb.oid);
        if (!indexParts) continue;

        const { localPort, remoteIndex } = indexParts;

        // Find corresponding data for this neighbor
        const portIdVb = this.findLLDPVarbind(portIdVarbinds, localPort, remoteIndex);
        const portDescVb = this.findLLDPVarbind(portDescVarbinds, localPort, remoteIndex);
        const sysNameVb = this.findLLDPVarbind(sysNameVarbinds, localPort, remoteIndex);
        const sysDescVb = this.findLLDPVarbind(sysDescVarbinds, localPort, remoteIndex);
        const sysCapVb = this.findLLDPVarbind(sysCapVarbinds, localPort, remoteIndex);

        // Find local port information
        const localPortVb = locPortIdVarbinds.find(vb => 
          vb.oid.includes(`.${localPort}.`)
        );

        const neighbor: TopologyInfo = {
          protocol: 'lldp',
          localPort: localPort,
          localPortName: localPortVb?.value || localPort.toString(),
          remoteChassisId: this.formatMacAddress(chassisVb.value),
          remotePortId: portIdVb?.value || '',
          remotePortDesc: portDescVb?.value || '',
          remoteHostname: sysNameVb?.value || '',
          remoteDevice: sysDescVb?.value || '',
          remoteCapabilities: sysCapVb?.value || '',
          remotePlatform: this.parseLLDPCapabilities(sysCapVb?.value || ''),
          lastUpdated: new Date(),
        };

        neighbors.push(neighbor);
      }

    } catch (error) {
      this.logger.debug(`LLDP not available for ${device.hostname}: ${error.message}`);
    }

    return neighbors;
  }

  private async discoverCDPNeighbors(device: DeviceInfo): Promise<TopologyInfo[]> {
    const neighbors: TopologyInfo[] = [];

    try {
      // Get CDP cache table
      const responses = await Promise.allSettled([
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.CDP.CDP_CACHE_DEVICE_ID),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.CDP.CDP_CACHE_DEVICE_PORT),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.CDP.CDP_CACHE_PLATFORM),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.CDP.CDP_CACHE_CAPABILITIES),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.CDP.CDP_CACHE_VERSION),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.CDP.CDP_CACHE_ADDRESS),
      ]);

      // Check if CDP is available
      const deviceIdResponse = responses[0];
      if (deviceIdResponse.status === 'rejected' || 
          (deviceIdResponse.status === 'fulfilled' && !deviceIdResponse.value.success)) {
        return neighbors;
      }

      const deviceIdVarbinds = deviceIdResponse.value.varbinds;
      if (deviceIdVarbinds.length === 0) {
        return neighbors;
      }

      // Extract data from other responses
      const getVarbinds = (responseIndex: number) => {
        const response = responses[responseIndex];
        return response.status === 'fulfilled' && response.value.success 
          ? response.value.varbinds 
          : [];
      };

      const devicePortVarbinds = getVarbinds(1);
      const platformVarbinds = getVarbinds(2);
      const capabilitiesVarbinds = getVarbinds(3);
      const versionVarbinds = getVarbinds(4);
      const addressVarbinds = getVarbinds(5);

      // Process each CDP neighbor
      for (const deviceIdVb of deviceIdVarbinds) {
        const indexParts = this.extractCDPIndex(deviceIdVb.oid);
        if (!indexParts) continue;

        const { ifIndex, entryIndex } = indexParts;

        // Find corresponding data for this neighbor
        const devicePortVb = this.findCDPVarbind(devicePortVarbinds, ifIndex, entryIndex);
        const platformVb = this.findCDPVarbind(platformVarbinds, ifIndex, entryIndex);
        const capabilitiesVb = this.findCDPVarbind(capabilitiesVarbinds, ifIndex, entryIndex);
        const versionVb = this.findCDPVarbind(versionVarbinds, ifIndex, entryIndex);
        const addressVb = this.findCDPVarbind(addressVarbinds, ifIndex, entryIndex);

        const neighbor: TopologyInfo = {
          protocol: 'cdp',
          localPort: ifIndex,
          localPortName: `${ifIndex}`,
          remoteChassisId: '',
          remotePortId: devicePortVb?.value || '',
          remotePortDesc: devicePortVb?.value || '',
          remoteHostname: deviceIdVb.value || '',
          remoteDevice: deviceIdVb.value || '',
          remoteCapabilities: capabilitiesVb?.value || '',
          remotePlatform: platformVb?.value || '',
          remoteVersion: versionVb?.value || '',
          remoteAddress: addressVb?.value || '',
          lastUpdated: new Date(),
        };

        neighbors.push(neighbor);
      }

    } catch (error) {
      this.logger.debug(`CDP not available for ${device.hostname}: ${error.message}`);
    }

    return neighbors;
  }

  private async createOrUpdateTopology(deviceId: string, topology: TopologyInfo): Promise<any> {
    const topologyData = {
      deviceId,
      protocol: topology.protocol,
      localPort: topology.localPort.toString(),
      localPortName: topology.localPortName,
      remoteChassisId: topology.remoteChassisId,
      remotePortId: topology.remotePortId,
      remotePortDesc: topology.remotePortDesc,
      remoteHostname: topology.remoteHostname,
      remoteDevice: topology.remoteDevice,
      remoteCapabilities: topology.remoteCapabilities,
      remotePlatform: topology.remotePlatform,
      remoteVersion: topology.remoteVersion,
      remoteAddress: topology.remoteAddress,
      lastUpdated: new Date(),
    };

    try {
      // Check if topology entry already exists
      const existingTopology = await this.prisma.topology.findFirst({
        where: {
          deviceId,
          protocol: topology.protocol,
          localPort: topology.localPort.toString(),
          remoteHostname: topology.remoteHostname,
        },
      });

      if (existingTopology) {
        const updatedTopology = await this.prisma.topology.update({
          where: { id: existingTopology.id },
          data: topologyData,
        });

        this.logger.debug(`Updated topology entry for ${topology.remoteHostname} on port ${topology.localPort}`);
        return updatedTopology;
      } else {
        const newTopology = await this.prisma.topology.create({
          data: topologyData,
        });

        this.logger.debug(`Created topology entry for ${topology.remoteHostname} on port ${topology.localPort}`);
        return newTopology;
      }
    } catch (error) {
      this.logger.error(`Failed to save topology entry: ${error.message}`);
      throw error;
    }
  }

  private async cleanupOldTopologyEntries(deviceId: string, currentTopology: any[]): Promise<void> {
    try {
      const currentIds = currentTopology.map(t => t.id).filter(id => id);
      
      if (currentIds.length === 0) {
        return; // Don't delete all entries if discovery failed
      }

      const result = await this.prisma.topology.deleteMany({
        where: {
          deviceId,
          id: {
            notIn: currentIds,
          },
          lastUpdated: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Removed ${result.count} outdated topology entries for device ${deviceId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old topology entries: ${error.message}`);
    }
  }

  private extractLLDPIndex(oid: string): { localPort: number; remoteIndex: number } | null {
    // LLDP OID format: ...localPortNum.remoteIndex
    const parts = oid.split('.');
    if (parts.length < 3) return null;

    const localPort = parseInt(parts[parts.length - 2]);
    const remoteIndex = parseInt(parts[parts.length - 1]);

    if (isNaN(localPort) || isNaN(remoteIndex)) return null;

    return { localPort, remoteIndex };
  }

  private extractCDPIndex(oid: string): { ifIndex: number; entryIndex: number } | null {
    // CDP OID format: ...ifIndex.entryIndex
    const parts = oid.split('.');
    if (parts.length < 3) return null;

    const ifIndex = parseInt(parts[parts.length - 2]);
    const entryIndex = parseInt(parts[parts.length - 1]);

    if (isNaN(ifIndex) || isNaN(entryIndex)) return null;

    return { ifIndex, entryIndex };
  }

  private findLLDPVarbind(varbinds: any[], localPort: number, remoteIndex: number): any {
    return varbinds.find(vb => {
      const indexParts = this.extractLLDPIndex(vb.oid);
      return indexParts && 
             indexParts.localPort === localPort && 
             indexParts.remoteIndex === remoteIndex;
    });
  }

  private findCDPVarbind(varbinds: any[], ifIndex: number, entryIndex: number): any {
    return varbinds.find(vb => {
      const indexParts = this.extractCDPIndex(vb.oid);
      return indexParts && 
             indexParts.ifIndex === ifIndex && 
             indexParts.entryIndex === entryIndex;
    });
  }

  private formatMacAddress(mac: string): string {
    if (!mac || mac.length === 0) {
      return '';
    }

    // Convert hex string to MAC address format
    if (mac.length === 12) {
      return mac.match(/.{2}/g)?.join(':')?.toLowerCase() || mac;
    }

    // Handle different formats and convert to standard format
    return mac.replace(/[^a-fA-F0-9]/g, '')
             .match(/.{2}/g)
             ?.join(':')
             ?.toLowerCase() || mac;
  }

  private parseLLDPCapabilities(capabilities: string): string {
    if (!capabilities) return '';

    // LLDP capabilities are bit flags
    const capMap: { [key: string]: string } = {
      '0x01': 'Repeater',
      '0x02': 'Bridge',
      '0x04': 'WLAN AP',
      '0x08': 'Router',
      '0x10': 'Telephone',
      '0x20': 'DOCSIS',
      '0x40': 'Station',
      '0x80': 'CVLAN',
      '0x100': 'SVLAN',
      '0x200': 'TPMR',
    };

    const caps = parseInt(capabilities);
    const enabledCaps: string[] = [];

    for (const [bit, capability] of Object.entries(capMap)) {
      if (caps & parseInt(bit)) {
        enabledCaps.push(capability);
      }
    }

    return enabledCaps.join(', ');
  }

  private async getInterfaceName(device: DeviceInfo, ifIndex: number): Promise<string> {
    try {
      const response = await this.snmpClient.get(
        device.snmpDevice, 
        [SNMP_OIDS.INTERFACE.IF_DESCR + '.' + ifIndex]
      );

      if (response.success && response.varbinds.length > 0) {
        return response.varbinds[0].value || ifIndex.toString();
      }
    } catch (error) {
      this.logger.debug(`Failed to get interface name for ${ifIndex}: ${error.message}`);
    }

    return ifIndex.toString();
  }
}