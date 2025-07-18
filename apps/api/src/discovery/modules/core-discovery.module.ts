// Core Discovery Module for Y Monitor
// Handles basic device identification and system information

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

export class CoreDiscoveryModule implements DiscoveryModule {
  name = 'core';
  description = 'Core device information discovery';
  enabled = true;
  dependencies: string[] = [];
  priority = 1; // Highest priority - runs first

  private readonly logger = new Logger(CoreDiscoveryModule.name);

  constructor(
    private snmpClient: SNMPClientService,
    private prisma: PrismaService,
  ) {}

  canDiscover(device: DeviceInfo): boolean {
    // Core discovery can run on any device with SNMP connectivity
    return true;
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
      this.logger.debug(`Starting core discovery for device ${device.hostname}`);

      // Get comprehensive system information
      const systemInfo = await this.snmpClient.getSystemInfo(device.snmpDevice);
      
      if (!systemInfo) {
        throw new Error('Failed to retrieve system information');
      }

      // Collect additional system details
      const additionalOids = [
        SNMP_OIDS.SYSTEM.SYS_SERVICES,
        SNMP_OIDS.HOST.HR_SYSTEM_UPTIME,
        SNMP_OIDS.HOST.HR_SYSTEM_DATE,
        SNMP_OIDS.HOST.HR_SYSTEM_NUM_USERS,
        SNMP_OIDS.HOST.HR_SYSTEM_PROCESSES,
        SNMP_OIDS.HOST.HR_MEMORY_SIZE,
      ];

      const additionalData = await this.snmpClient.get(device.snmpDevice, additionalOids);
      
      // Parse additional system information
      const parsedData = this.parseSystemData(additionalData.varbinds);

      // Detect hardware information from Entity MIB if available
      let hardwareInfo = {};
      try {
        hardwareInfo = await this.discoverHardwareInfo(device);
      } catch (error) {
        this.logger.warn(`Hardware discovery failed for ${device.hostname}: ${error.message}`);
      }

      // Compile all discovered information
      const discoveredInfo = {
        ...systemInfo,
        ...parsedData,
        ...hardwareInfo,
        lastPolled: new Date(),
      };

      // Update device in database
      await this.updateDeviceInfo(device.id, discoveredInfo);

      result.discovered = [discoveredInfo];
      result.success = true;

      this.logger.log(`Core discovery completed for ${device.hostname}`);
    } catch (error) {
      this.logger.error(`Core discovery failed for ${device.hostname}: ${error.message}`);
      result.errors.push(error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  validate(data: any[]): boolean {
    // Basic validation for core discovery data
    return data.every(item => 
      item && 
      typeof item === 'object' &&
      (item.sysDescr || item.sysName || item.sysObjectID)
    );
  }

  private parseSystemData(varbinds: any[]): any {
    const data: any = {};

    varbinds.forEach((vb, index) => {
      if (!vb || !vb.value) return;

      const value = this.parseVarbindValue(vb);
      
      // Map based on OID order
      switch (index) {
        case 0: // sysServices
          data.sysServices = parseInt(value) || 0;
          break;
        case 1: // hrSystemUptime
          data.hrSystemUptime = parseInt(value) || 0;
          break;
        case 2: // hrSystemDate
          data.hrSystemDate = value;
          break;
        case 3: // hrSystemNumUsers
          data.currentUsers = parseInt(value) || 0;
          break;
        case 4: // hrSystemProcesses
          data.currentProcesses = parseInt(value) || 0;
          break;
        case 5: // hrMemorySize
          data.memorySize = parseInt(value) || 0;
          break;
      }
    });

    return data;
  }

  private async discoverHardwareInfo(device: DeviceInfo): Promise<any> {
    const hardwareInfo: any = {};

    try {
      // Try to get hardware information from Entity MIB
      const entityResponse = await this.snmpClient.walk(
        device.snmpDevice,
        SNMP_OIDS.ENTITY.ENT_PHYSICAL_DESCR
      );

      if (entityResponse.success && entityResponse.varbinds.length > 0) {
        // Find chassis/system entity (usually index 1)
        const systemEntity = entityResponse.varbinds.find(vb => 
          vb.oid.endsWith('.1') || vb.value.toLowerCase().includes('chassis')
        );

        if (systemEntity) {
          hardwareInfo.hardware = systemEntity.value;
        }

        // Get additional entity information
        const entityOids = [
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_VENDOR_TYPE,
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_SERIAL_NUM,
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_MFG_NAME,
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_MODEL_NAME,
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_HARDWARE_REV,
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_FIRMWARE_REV,
          SNMP_OIDS.ENTITY.ENT_PHYSICAL_SOFTWARE_REV,
        ];

        const entityDetails = await Promise.all(
          entityOids.map(oid => this.snmpClient.get(device.snmpDevice, [oid + '.1']))
        );

        entityDetails.forEach((response, index) => {
          if (response.success && response.varbinds.length > 0) {
            const value = this.parseVarbindValue(response.varbinds[0]);
            
            switch (index) {
              case 0: hardwareInfo.vendorType = value; break;
              case 1: hardwareInfo.serial = value; break;
              case 2: hardwareInfo.vendor = value; break;
              case 3: hardwareInfo.model = value; break;
              case 4: hardwareInfo.hardwareRev = value; break;
              case 5: hardwareInfo.firmwareRev = value; break;
              case 6: hardwareInfo.version = value; break;
            }
          }
        });
      }
    } catch (error) {
      this.logger.debug(`Entity MIB not available for ${device.hostname}: ${error.message}`);
    }

    return hardwareInfo;
  }

  private async updateDeviceInfo(deviceId: string, info: any): Promise<void> {
    try {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          sysDescr: info.sysDescr,
          sysName: info.sysName,
          sysContact: info.sysContact,
          sysLocation: info.sysLocation,
          uptime: info.sysUptime ? BigInt(info.sysUptime) : null,
          vendor: info.vendor,
          model: info.model,
          version: info.version,
          serial: info.serial,
          hardware: info.hardware,
          features: info.features ? JSON.stringify(info.features) : null,
          lastPolled: new Date(),
        },
      });

      this.logger.debug(`Updated device ${deviceId} with core information`);
    } catch (error) {
      this.logger.error(`Failed to update device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  private parseVarbindValue(varbind: any): any {
    if (!varbind || varbind.value === null || varbind.value === undefined) {
      return null;
    }

    // Handle different SNMP data types
    switch (varbind.type) {
      case 'INTEGER':
      case 'Counter32':
      case 'Gauge32':
      case 'TimeTicks':
      case 'Unsigned32':
        return parseInt(varbind.value) || 0;
      
      case 'Counter64':
        return BigInt(varbind.value || '0');
      
      case 'OCTET STRING':
      case 'OBJECT IDENTIFIER':
      case 'IpAddress':
        return varbind.value.toString();
      
      default:
        return varbind.value;
    }
  }

  private detectDeviceFeatures(systemInfo: any): string[] {
    const features: string[] = [];

    if (systemInfo.sysServices) {
      const services = parseInt(systemInfo.sysServices);
      
      // Decode sysServices bits (RFC 1213)
      if (services & 1) features.push('physical');      // Layer 1
      if (services & 2) features.push('datalink');      // Layer 2
      if (services & 4) features.push('internet');      // Layer 3
      if (services & 8) features.push('end-to-end');    // Layer 4
      if (services & 64) features.push('applications'); // Layer 7
    }

    // Add other feature detection based on sysDescr, sysObjectID, etc.
    const sysDescr = (systemInfo.sysDescr || '').toLowerCase();
    
    if (sysDescr.includes('router')) features.push('routing');
    if (sysDescr.includes('switch')) features.push('switching');
    if (sysDescr.includes('wireless') || sysDescr.includes('wifi')) features.push('wireless');
    if (sysDescr.includes('firewall') || sysDescr.includes('asa')) features.push('firewall');
    if (sysDescr.includes('load') && sysDescr.includes('balance')) features.push('loadbalancer');

    return [...new Set(features)]; // Remove duplicates
  }
}