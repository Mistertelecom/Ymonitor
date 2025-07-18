// Sensors Discovery Module for Y Monitor
// Discovers temperature, voltage, current, and other sensors

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { 
  DiscoveryModule, 
  DiscoveryResult, 
  DeviceInfo, 
  OSTemplate,
  SensorInfo 
} from '../interfaces/discovery.interface';
import { SNMP_OIDS } from '../../snmp/types/snmp.types';

export class SensorsDiscoveryModule implements DiscoveryModule {
  name = 'sensors';
  description = 'Environmental sensors discovery';
  enabled = true;
  dependencies = ['core'];
  priority = 3;

  private readonly logger = new Logger(SensorsDiscoveryModule.name);

  constructor(
    private snmpClient: SNMPClientService,
    private prisma: PrismaService,
  ) {}

  canDiscover(device: DeviceInfo): boolean {
    // Sensors are typically found on network equipment, not servers
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
      this.logger.debug(`Starting sensors discovery for device ${device.hostname}`);

      const discoveredSensors: SensorInfo[] = [];

      // Discover standard Entity Sensor MIB sensors
      const entitySensors = await this.discoverEntitySensors(device);
      discoveredSensors.push(...entitySensors);

      // Discover vendor-specific sensors based on OS templates
      for (const template of templates) {
        if (template.discovery?.sensors) {
          const templateSensors = await this.discoverTemplateSensors(device, template);
          discoveredSensors.push(...templateSensors);
        }
      }

      // Discover Cisco-specific sensors if applicable
      if (device.os?.includes('cisco')) {
        const ciscoSensors = await this.discoverCiscoSensors(device);
        discoveredSensors.push(...ciscoSensors);
      }

      // Create or update sensors in database
      const savedSensors = [];
      for (const sensor of discoveredSensors) {
        try {
          const savedSensor = await this.createOrUpdateSensor(device.id, sensor);
          savedSensors.push(savedSensor);
        } catch (error) {
          this.logger.error(`Failed to save sensor ${sensor.descr}: ${error.message}`);
          result.errors.push(`Sensor ${sensor.descr}: ${error.message}`);
        }
      }

      result.discovered = savedSensors;
      result.success = true;

      this.logger.log(`Sensors discovery completed for ${device.hostname}: ${savedSensors.length} sensors`);
    } catch (error) {
      this.logger.error(`Sensors discovery failed for ${device.hostname}: ${error.message}`);
      result.errors.push(error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  validate(data: any[]): boolean {
    return data.every(sensor => 
      sensor && 
      typeof sensor === 'object' &&
      typeof sensor.index === 'string' &&
      typeof sensor.type === 'string' &&
      typeof sensor.descr === 'string'
    );
  }

  private async discoverEntitySensors(device: DeviceInfo): Promise<SensorInfo[]> {
    const sensors: SensorInfo[] = [];

    try {
      // Get Entity Sensor table
      const sensorTypes = await this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.SENSOR.ENT_SENSOR_TYPE);
      const sensorValues = await this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.SENSOR.ENT_SENSOR_VALUE);
      const sensorUnits = await this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.SENSOR.ENT_SENSOR_UNITS_DISPLAY);
      const sensorStatus = await this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.SENSOR.ENT_SENSOR_OPER_STATUS);

      if (!sensorTypes.success || sensorTypes.varbinds.length === 0) {
        return sensors;
      }

      // Get physical descriptions for sensor names
      const physicalDescr = await this.snmpClient.walk(device.snmpDevice, SNMP_OIDS.ENTITY.ENT_PHYSICAL_DESCR);

      for (const typeVb of sensorTypes.varbinds) {
        const index = this.extractIndexFromOid(typeVb.oid);
        const sensorType = this.mapEntitySensorType(parseInt(typeVb.value));

        if (!sensorType) continue;

        // Find corresponding values
        const valueVb = sensorValues.varbinds.find(vb => this.extractIndexFromOid(vb.oid) === index);
        const unitVb = sensorUnits.varbinds.find(vb => this.extractIndexFromOid(vb.oid) === index);
        const statusVb = sensorStatus.varbinds.find(vb => this.extractIndexFromOid(vb.oid) === index);
        const descrVb = physicalDescr.varbinds.find(vb => this.extractIndexFromOid(vb.oid) === index);

        const sensor: SensorInfo = {
          index,
          type: sensorType,
          class: 'entity-sensor',
          descr: descrVb?.value || `${sensorType} ${index}`,
          oid: SNMP_OIDS.SENSOR.ENT_SENSOR_VALUE + '.' + index,
          currentValue: valueVb ? parseFloat(valueVb.value) : undefined,
          unit: unitVb?.value || this.getDefaultUnit(sensorType),
          divisor: 1,
          multiplier: 1,
        };

        sensors.push(sensor);
      }
    } catch (error) {
      this.logger.debug(`Entity sensors not available for ${device.hostname}: ${error.message}`);
    }

    return sensors;
  }

  private async discoverTemplateSensors(device: DeviceInfo, template: OSTemplate): Promise<SensorInfo[]> {
    const sensors: SensorInfo[] = [];

    if (!template.discovery?.sensors) {
      return sensors;
    }

    try {
      for (const [sensorType, sensorTemplates] of Object.entries(template.discovery.sensors)) {
        for (const sensorTemplate of sensorTemplates) {
          const templateSensors = await this.processTemplateSensor(device, sensorType, sensorTemplate);
          sensors.push(...templateSensors);
        }
      }
    } catch (error) {
      this.logger.error(`Template sensor discovery failed: ${error.message}`);
    }

    return sensors;
  }

  private async discoverCiscoSensors(device: DeviceInfo): Promise<SensorInfo[]> {
    const sensors: SensorInfo[] = [];

    try {
      // Cisco Environmental Monitor MIB
      const tempStatus = await this.snmpClient.walk(device.snmpDevice, '1.3.6.1.4.1.9.9.13.1.3.1.3'); // ciscoEnvMonTemperatureStatusValue
      const tempDescr = await this.snmpClient.walk(device.snmpDevice, '1.3.6.1.4.1.9.9.13.1.3.1.2'); // ciscoEnvMonTemperatureStatusDescr

      if (tempStatus.success && tempStatus.varbinds.length > 0) {
        for (const tempVb of tempStatus.varbinds) {
          const index = this.extractIndexFromOid(tempVb.oid);
          const descrVb = tempDescr.varbinds.find(vb => this.extractIndexFromOid(vb.oid) === index);

          const sensor: SensorInfo = {
            index,
            type: 'temperature',
            class: 'cisco-envmon',
            descr: descrVb?.value || `Temperature ${index}`,
            oid: tempVb.oid,
            currentValue: parseFloat(tempVb.value),
            unit: '°C',
            divisor: 1,
            multiplier: 1,
          };

          sensors.push(sensor);
        }
      }

      // Add voltage, fan, and power supply sensors similarly
      // (Implementation would continue for other Cisco sensor types)

    } catch (error) {
      this.logger.debug(`Cisco sensors not available for ${device.hostname}: ${error.message}`);
    }

    return sensors;
  }

  private async processTemplateSensor(device: DeviceInfo, sensorType: string, template: any): Promise<SensorInfo[]> {
    const sensors: SensorInfo[] = [];

    try {
      const response = await this.snmpClient.walk(device.snmpDevice, template.oid);
      
      if (!response.success || response.varbinds.length === 0) {
        return sensors;
      }

      for (const vb of response.varbinds) {
        const index = this.extractIndexFromOid(vb.oid);
        
        // Apply template variables and conditions
        let descr = template.descr;
        if (typeof descr === 'string') {
          descr = descr.replace('{{ $index }}', index);
        }

        // Skip if conditions are met
        if (template.skip_if_zero && (parseFloat(vb.value) === 0)) {
          continue;
        }

        const sensor: SensorInfo = {
          index,
          type: sensorType,
          class: 'template',
          descr,
          oid: vb.oid,
          currentValue: parseFloat(vb.value),
          divisor: template.divisor || 1,
          multiplier: template.multiplier || 1,
          lowLimit: template.low_limit,
          lowWarnLimit: template.low_warn_limit,
          warnLimit: template.warn_limit,
          highLimit: template.high_limit,
          unit: this.getDefaultUnit(sensorType),
        };

        sensors.push(sensor);
      }
    } catch (error) {
      this.logger.debug(`Template sensor ${sensorType} discovery failed: ${error.message}`);
    }

    return sensors;
  }

  private async createOrUpdateSensor(deviceId: string, sensor: SensorInfo): Promise<any> {
    const sensorData = {
      deviceId,
      sensorIndex: sensor.index,
      sensorType: sensor.type as any,
      sensorDescr: sensor.descr,
      sensorClass: sensor.class,
      sensorOid: sensor.oid,
      sensorValue: sensor.currentValue,
      sensorLimit: sensor.highLimit,
      sensorLimitLow: sensor.lowLimit,
      sensorPrev: null,
      sensorCustom: false,
      disabled: false,
      lastPolled: new Date(),
    };

    try {
      const existingSensor = await this.prisma.sensor.findUnique({
        where: {
          deviceId_sensorIndex_sensorType: {
            deviceId,
            sensorIndex: sensor.index,
            sensorType: sensor.type as any,
          },
        },
      });

      if (existingSensor) {
        const updatedSensor = await this.prisma.sensor.update({
          where: { id: existingSensor.id },
          data: {
            ...sensorData,
            sensorPrev: existingSensor.sensorValue,
          },
        });

        this.logger.debug(`Updated sensor ${sensor.descr} for device ${deviceId}`);
        return updatedSensor;
      } else {
        const newSensor = await this.prisma.sensor.create({
          data: sensorData,
        });

        this.logger.debug(`Created sensor ${sensor.descr} for device ${deviceId}`);
        return newSensor;
      }
    } catch (error) {
      this.logger.error(`Failed to save sensor ${sensor.descr}: ${error.message}`);
      throw error;
    }
  }

  private extractIndexFromOid(oid: string): string {
    const parts = oid.split('.');
    return parts[parts.length - 1];
  }

  private mapEntitySensorType(type: number): string | null {
    const typeMap: { [key: number]: string } = {
      1: 'other',
      2: 'unknown',
      3: 'voltage', // voltsDC
      4: 'voltage', // voltsAC
      5: 'current', // amperes
      6: 'power',   // watts
      7: 'frequency', // hertz
      8: 'temperature', // celsius
      9: 'humidity', // percentRH
      10: 'fanspeed', // rpm
      11: 'current', // cmm (cubic meters per minute)
      12: 'dbm', // truthvalue
    };

    return typeMap[type] || null;
  }

  private getDefaultUnit(sensorType: string): string {
    const unitMap: { [key: string]: string } = {
      temperature: '°C',
      voltage: 'V',
      current: 'A',
      power: 'W',
      frequency: 'Hz',
      humidity: '%',
      fanspeed: 'RPM',
      dbm: 'dBm',
    };

    return unitMap[sensorType] || '';
  }
}