import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SensorsService, SensorReading } from './sensors.service';
import { PrismaService } from '../prisma/prisma.service';
import { SNMPClientService } from '../snmp/services/snmp-client.service';
import { InfluxDBService } from '../influxdb/influxdb.service';

describe('SensorsService', () => {
  let service: SensorsService;
  let prismaService: PrismaService;
  let snmpClientService: SNMPClientService;
  let influxdbService: InfluxDBService;
  let configService: ConfigService;

  const mockDevice = {
    id: 'device-1',
    hostname: 'test-device',
    ip: '192.168.1.100',
    snmpPort: 161,
    snmpVersion: 'v2c',
    snmpCommunity: 'public',
    snmpTimeout: 5000,
    snmpRetries: 3,
    disabled: false,
    sensors: [
      {
        id: 'sensor-1',
        deviceId: 'device-1',
        sensorIndex: '1',
        sensorType: 'TEMPERATURE',
        sensorDescr: 'CPU Temperature',
        sensorOid: '1.3.6.1.4.1.9.9.13.1.3.1.3.1',
        sensorClass: 'hardware',
        sensorLimit: 70,
        sensorLimitLow: 80,
        disabled: false,
      },
    ],
  };

  const mockSensorReading: SensorReading = {
    deviceId: 'device-1',
    sensorId: 'sensor-1',
    sensorType: 'TEMPERATURE',
    sensorDescr: 'CPU Temperature',
    value: 65,
    unit: '°C',
    timestamp: new Date(),
    threshold: {
      warning: 70,
      critical: 80,
    },
  };

  const mockPrismaService = {
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    sensor: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    alert: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockSNMPClientService = {
    testConnection: jest.fn(),
    get: jest.fn(),
    walk: jest.fn(),
  };

  const mockInfluxDBService = {
    writeSensorMetrics: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SensorsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SNMPClientService,
          useValue: mockSNMPClientService,
        },
        {
          provide: InfluxDBService,
          useValue: mockInfluxDBService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SensorsService>(SensorsService);
    prismaService = module.get<PrismaService>(PrismaService);
    snmpClientService = module.get<SNMPClientService>(SNMPClientService);
    influxdbService = module.get<InfluxDBService>(InfluxDBService);
    configService = module.get<ConfigService>(ConfigService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceSensors', () => {
    it('should return sensors for a specific device', async () => {
      const expectedSensors = [mockDevice.sensors[0]];
      mockPrismaService.sensor.findMany.mockResolvedValue(expectedSensors);

      const result = await service.getDeviceSensors('device-1');

      expect(result).toEqual(expectedSensors);
      expect(mockPrismaService.sensor.findMany).toHaveBeenCalledWith({
        where: {
          deviceId: 'device-1',
          disabled: false,
        },
        orderBy: {
          sensorDescr: 'asc',
        },
      });
    });

    it('should return empty array when no sensors found', async () => {
      mockPrismaService.sensor.findMany.mockResolvedValue([]);

      const result = await service.getDeviceSensors('device-1');

      expect(result).toEqual([]);
    });
  });

  describe('getSensorHistory', () => {
    it('should return sensor history within specified time range', async () => {
      const now = new Date();
      const readings = [
        { ...mockSensorReading, timestamp: new Date(now.getTime() - 30 * 60 * 1000) }, // 30 min ago
        { ...mockSensorReading, timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000) }, // 2 hours ago
        { ...mockSensorReading, timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000) }, // 25 hours ago
      ];

      // Simulate internal history storage
      const key = `${mockSensorReading.deviceId}:${mockSensorReading.sensorId}`;
      service['sensorHistory'].set(key, readings);

      const result = await service.getSensorHistory('device-1', 'sensor-1', 24);

      // Should return only readings within last 24 hours
      expect(result).toHaveLength(2);
      expect(result.every(reading => reading.timestamp.getTime() >= now.getTime() - 24 * 60 * 60 * 1000)).toBe(true);
    });

    it('should return empty array when no history exists', async () => {
      const result = await service.getSensorHistory('device-1', 'sensor-1', 24);

      expect(result).toEqual([]);
    });
  });

  describe('getSensorReading', () => {
    it('should successfully get sensor reading from SNMP', async () => {
      const snmpDevice = {
        hostname: '192.168.1.100',
        port: 161,
        version: 'v2c',
        community: 'public',
        timeout: 5000,
        retries: 3,
        transport: 'udp',
      };

      const snmpResponse = {
        success: true,
        varbinds: [
          {
            oid: '1.3.6.1.4.1.9.9.13.1.3.1.3.1',
            value: '650', // 65.0°C in tenths
          },
        ],
      };

      mockSNMPClientService.get.mockResolvedValue(snmpResponse);

      const result = await service.getSensorReading(snmpDevice as any, mockDevice.sensors[0]);

      expect(result).toEqual({
        deviceId: 'device-1',
        sensorId: 'sensor-1',
        sensorType: 'TEMPERATURE',
        sensorDescr: 'CPU Temperature',
        value: 65, // Transformed from 650 to 65
        unit: '°C',
        timestamp: expect.any(Date),
        threshold: {
          warning: 70,
          critical: 80,
        },
      });
    });

    it('should return null when SNMP request fails', async () => {
      const snmpDevice = { hostname: '192.168.1.100' };
      const snmpResponse = { success: false, varbinds: [] };

      mockSNMPClientService.get.mockResolvedValue(snmpResponse);

      const result = await service.getSensorReading(snmpDevice as any, mockDevice.sensors[0]);

      expect(result).toBeNull();
    });

    it('should handle SNMP exceptions', async () => {
      const snmpDevice = { hostname: '192.168.1.100' };

      mockSNMPClientService.get.mockRejectedValue(new Error('SNMP timeout'));

      const result = await service.getSensorReading(snmpDevice as any, mockDevice.sensors[0]);

      expect(result).toBeNull();
    });
  });

  describe('processSensorReading', () => {
    it('should process sensor reading successfully', async () => {
      mockInfluxDBService.writeSensorMetrics.mockResolvedValue(undefined);
      mockPrismaService.sensor.update.mockResolvedValue({});
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      await service.processSensorReading(mockSensorReading);

      expect(mockInfluxDBService.writeSensorMetrics).toHaveBeenCalledWith(
        'device-1',
        'sensor-1',
        'TEMPERATURE',
        65,
        '°C',
        expect.any(Date)
      );

      expect(mockPrismaService.sensor.update).toHaveBeenCalledWith({
        where: { id: 'sensor-1' },
        data: {
          sensorValue: 65,
          sensorPrev: 65,
          lastPolled: expect.any(Date),
        },
      });
    });

    it('should handle InfluxDB write errors gracefully', async () => {
      mockInfluxDBService.writeSensorMetrics.mockRejectedValue(new Error('InfluxDB error'));
      mockPrismaService.sensor.update.mockResolvedValue({});
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      await expect(service.processSensorReading(mockSensorReading)).resolves.not.toThrow();
    });
  });

  describe('checkSensorThresholds', () => {
    it('should create alert when temperature exceeds critical threshold', async () => {
      const criticalReading = {
        ...mockSensorReading,
        value: 85,
        threshold: { warning: 70, critical: 80 },
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create.mockResolvedValue({});

      await service.checkSensorThresholds(criticalReading);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: {
          deviceId: 'device-1',
          ruleId: 'sensor-monitoring',
          severity: 'critical',
          state: 'open',
          message: expect.stringContaining('critically high'),
          details: expect.objectContaining({
            sensorId: 'sensor-1',
            value: 85,
          }),
        },
      });
    });

    it('should create warning alert when temperature exceeds warning threshold', async () => {
      const warningReading = {
        ...mockSensorReading,
        value: 75,
        threshold: { warning: 70, critical: 80 },
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create.mockResolvedValue({});

      await service.checkSensorThresholds(warningReading);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('above warning threshold'),
        }),
      });
    });

    it('should not create duplicate alerts', async () => {
      const criticalReading = {
        ...mockSensorReading,
        value: 85,
        threshold: { warning: 70, critical: 80 },
      };

      mockPrismaService.alert.findFirst.mockResolvedValue({ id: 'existing-alert' });

      await service.checkSensorThresholds(criticalReading);

      expect(mockPrismaService.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('discoverSensors', () => {
    it('should discover sensors for a device', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(mockDevice);
      mockSNMPClientService.walk.mockResolvedValue({
        success: true,
        varbinds: [
          { oid: '1.3.6.1.4.1.9.9.13.1.3.1.3.1', value: '650' },
          { oid: '1.3.6.1.4.1.9.9.13.1.3.1.3.2', value: '720' },
        ],
      });
      mockPrismaService.sensor.findFirst.mockResolvedValue(null);
      mockPrismaService.sensor.create.mockResolvedValue({});

      await service.discoverSensors('device-1');

      expect(mockSNMPClientService.walk).toHaveBeenCalled();
      expect(mockPrismaService.sensor.create).toHaveBeenCalled();
    });

    it('should handle device not found', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(null);

      await expect(service.discoverSensors('non-existent')).rejects.toThrow(
        'Device not found: non-existent'
      );
    });
  });

  describe('pollDeviceSensors', () => {
    it('should poll sensors when device is reachable', async () => {
      mockSNMPClientService.testConnection.mockResolvedValue(true);
      mockSNMPClientService.get.mockResolvedValue({
        success: true,
        varbinds: [{ oid: '1.3.6.1.4.1.9.9.13.1.3.1.3.1', value: '650' }],
      });
      mockInfluxDBService.writeSensorMetrics.mockResolvedValue(undefined);
      mockPrismaService.sensor.update.mockResolvedValue({});
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      await service.pollDeviceSensors(mockDevice);

      expect(mockSNMPClientService.testConnection).toHaveBeenCalled();
      expect(mockSNMPClientService.get).toHaveBeenCalled();
    });

    it('should skip polling when device is not reachable', async () => {
      mockSNMPClientService.testConnection.mockResolvedValue(false);

      await service.pollDeviceSensors(mockDevice);

      expect(mockSNMPClientService.get).not.toHaveBeenCalled();
    });
  });

  describe('value transformations', () => {
    it('should transform temperature values correctly', () => {
      // Test private method through reflection
      expect((service as any).transformSensorValue(650, 'TEMPERATURE')).toBe(65);
      expect((service as any).transformSensorValue(25, 'TEMPERATURE')).toBe(25);
    });

    it('should transform voltage values correctly', () => {
      expect((service as any).transformSensorValue(12000, 'VOLTAGE')).toBe(12);
      expect((service as any).transformSensorValue(12, 'VOLTAGE')).toBe(12);
    });

    it('should return correct sensor units', () => {
      const getSensorUnit = (service as any).getSensorUnit.bind(service);
      
      expect(getSensorUnit('TEMPERATURE')).toBe('°C');
      expect(getSensorUnit('HUMIDITY')).toBe('%');
      expect(getSensorUnit('VOLTAGE')).toBe('V');
      expect(getSensorUnit('POWER')).toBe('W');
      expect(getSensorUnit('FAN_SPEED')).toBe('RPM');
    });
  });

  describe('utility methods', () => {
    it('should chunk array correctly', () => {
      const chunkArray = service['chunkArray'];
      const array = [1, 2, 3, 4, 5, 6, 7];
      
      const result = chunkArray(array, 3);
      
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should build SNMP device correctly', () => {
      const buildSNMPDevice = service['buildSNMPDevice'];
      
      const result = buildSNMPDevice(mockDevice);
      
      expect(result).toEqual({
        hostname: '192.168.1.100',
        port: 161,
        timeout: 5000,
        retries: 3,
        transport: 'udp',
        version: 'v2c',
        community: 'public',
        username: undefined,
        authLevel: undefined,
        authProtocol: undefined,
        authPassword: undefined,
        privProtocol: undefined,
        privPassword: undefined,
        contextName: '',
      });
    });
  });
});