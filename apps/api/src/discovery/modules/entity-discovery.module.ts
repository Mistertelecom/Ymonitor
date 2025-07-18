// Entity Discovery Module for Y Monitor
// Discovers physical entities using Entity MIB

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { 
  DiscoveryModule, 
  DiscoveryResult, 
  DeviceInfo, 
  OSTemplate,
  EntityInfo 
} from '../interfaces/discovery.interface';
import { SNMP_OIDS } from '../../snmp/types/snmp.types';

export class EntityDiscoveryModule implements DiscoveryModule {
  name = 'entity-physical';
  description = 'Physical entities discovery via Entity MIB';
  enabled = true;
  dependencies = ['core'];
  priority = 4;

  private readonly logger = new Logger(EntityDiscoveryModule.name);

  constructor(
    private snmpClient: SNMPClientService,
    private prisma: PrismaService,
  ) {}

  canDiscover(device: DeviceInfo): boolean {
    // Entity MIB is typically supported by enterprise network equipment
    return device.os !== 'windows' && device.os !== 'linux' && device.os !== 'generic';
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
      this.logger.debug(`Starting entity discovery for device ${device.hostname}`);

      const entities = await this.discoverPhysicalEntities(device);
      
      if (entities.length === 0) {
        this.logger.debug(`No physical entities found for device ${device.hostname}`);
        result.success = true;
        return result;
      }

      // Process and save entities
      const savedEntities = [];
      for (const entity of entities) {
        try {
          // For now, we'll just collect the data
          // In a full implementation, this would be saved to a separate entities table
          savedEntities.push(entity);
        } catch (error) {
          this.logger.error(`Failed to process entity ${entity.descr}: ${error.message}`);
          result.errors.push(`Entity ${entity.descr}: ${error.message}`);
        }
      }

      result.discovered = savedEntities;
      result.success = true;

      this.logger.log(`Entity discovery completed for ${device.hostname}: ${savedEntities.length} entities`);
    } catch (error) {
      this.logger.error(`Entity discovery failed for ${device.hostname}: ${error.message}`);
      result.errors.push(error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  validate(data: any[]): boolean {
    return data.every(entity => 
      entity && 
      typeof entity === 'object' &&
      typeof entity.index === 'number' &&
      typeof entity.descr === 'string'
    );
  }

  private async discoverPhysicalEntities(device: DeviceInfo): Promise<EntityInfo[]> {
    const entities: EntityInfo[] = [];

    try {
      // Get all Entity MIB tables
      const responses = await Promise.allSettled([
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_DESCR),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_CLASS),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_NAME),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_CONTAINED_IN),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_PARENT_REL_POS),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_VENDOR_TYPE),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_HARDWARE_REV),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_FIRMWARE_REV),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_SOFTWARE_REV),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_SERIAL_NUM),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_MFG_NAME),
        this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_MODEL_NAME),
      ]);

      // Check if primary table (descriptions) is available
      const descrResponse = responses[0];
      if (descrResponse.status === 'rejected' || 
          (descrResponse.status === 'fulfilled' && !descrResponse.value.success)) {
        return entities;
      }

      const descrVarbinds = descrResponse.value.varbinds;
      if (descrVarbinds.length === 0) {
        return entities;
      }

      // Extract data from other responses
      const getVarbinds = (responseIndex: number) => {
        const response = responses[responseIndex];
        return response.status === 'fulfilled' && response.value.success 
          ? response.value.varbinds 
          : [];
      };

      const classVarbinds = getVarbinds(1);
      const nameVarbinds = getVarbinds(2);
      const containedInVarbinds = getVarbinds(3);
      const parentRelPosVarbinds = getVarbinds(4);
      const vendorTypeVarbinds = getVarbinds(5);
      const hardwareRevVarbinds = getVarbinds(6);
      const firmwareRevVarbinds = getVarbinds(7);
      const softwareRevVarbinds = getVarbinds(8);
      const serialNumVarbinds = getVarbinds(9);
      const mfgNameVarbinds = getVarbinds(10);
      const modelNameVarbinds = getVarbinds(11);

      // Process each entity
      for (const descrVb of descrVarbinds) {
        const index = parseInt(this.extractIndexFromOid(descrVb.oid));
        
        const entity: EntityInfo = {
          index,
          descr: descrVb.value || '',
          class: this.findVarbindValue(classVarbinds, index) || 'unknown',
          name: this.findVarbindValue(nameVarbinds, index),
          containedIn: this.parseIntValue(this.findVarbindValue(containedInVarbinds, index)),
          parentRelPos: this.parseIntValue(this.findVarbindValue(parentRelPosVarbinds, index)),
          vendorType: this.findVarbindValue(vendorTypeVarbinds, index),
          hardwareRev: this.findVarbindValue(hardwareRevVarbinds, index),
          firmwareRev: this.findVarbindValue(firmwareRevVarbinds, index),
          softwareRev: this.findVarbindValue(softwareRevVarbinds, index),
          serialNum: this.findVarbindValue(serialNumVarbinds, index),
          mfgName: this.findVarbindValue(mfgNameVarbinds, index),
          modelName: this.findVarbindValue(modelNameVarbinds, index),
        };

        // Map entity class to readable format
        entity.class = this.mapEntityClass(entity.class);

        entities.push(entity);
      }

      // Sort entities by index for better organization
      entities.sort((a, b) => a.index - b.index);

    } catch (error) {
      this.logger.error(`Failed to discover physical entities: ${error.message}`);
      throw error;
    }

    return entities;
  }

  private extractIndexFromOid(oid: string): string {
    const parts = oid.split('.');
    return parts[parts.length - 1];
  }

  private findVarbindValue(varbinds: any[], index: number): string | undefined {
    const vb = varbinds.find(vb => {
      const vbIndex = parseInt(this.extractIndexFromOid(vb.oid));
      return vbIndex === index;
    });
    
    return vb?.value || undefined;
  }

  private parseIntValue(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseInt(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  private mapEntityClass(classValue: string): string {
    const classMap: { [key: string]: string } = {
      '1': 'other',
      '2': 'unknown',
      '3': 'chassis',
      '4': 'backplane',
      '5': 'container',
      '6': 'powerSupply',
      '7': 'fan',
      '8': 'sensor',
      '9': 'module',
      '10': 'port',
      '11': 'stack',
      '12': 'cpu',
    };

    return classMap[classValue] || classValue;
  }

  private buildEntityHierarchy(entities: EntityInfo[]): EntityInfo[] {
    // Build a hierarchical structure based on containedIn relationships
    const entitiesMap = new Map<number, EntityInfo>();
    
    // Create map for easy lookup
    entities.forEach(entity => {
      entitiesMap.set(entity.index, entity);
    });

    // Add children to each entity
    entities.forEach(entity => {
      if (entity.containedIn && entitiesMap.has(entity.containedIn)) {
        const parent = entitiesMap.get(entity.containedIn)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(entity);
      }
    });

    // Return only top-level entities (those not contained in others)
    return entities.filter(entity => !entity.containedIn || entity.containedIn === 0);
  }
}

// Extend EntityInfo interface to include children
declare module '../interfaces/discovery.interface' {
  interface EntityInfo {
    children?: EntityInfo[];
  }
}