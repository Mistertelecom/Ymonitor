import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { InterfaceMonitoringService, InterfaceMetrics } from './interface-monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { InfluxDBService } from '../../influxdb/influxdb.service';

describe('InterfaceMonitoringService', () => {
  let service: InterfaceMonitoringService;
  let prismaService: PrismaService;
  let snmpClientService: SNMPClientService;
  let influxdbService: InfluxDBService;
  let configService: ConfigService;

  const mockDevice = {
    id: 'device-1',
    hostname: 'test-switch',
    ip: '192.168.1.100',
    snmpPort: 161,
    snmpVersion: 'v2c',
    snmpCommunity: 'public',
    snmpTimeout: 5000,
    snmpRetries: 3,
    disabled: false,
    ports: [
      {
        id: 'port-1',
        deviceId: 'device-1',
        ifIndex: 1,
        ifName: 'GigabitEthernet0/1',
        ifAlias: 'Uplink',
        ifSpeed: 1000000000,
        ifType: 6,
        ifMtu: 1500,
        disabled: false,
      },
    ],
  };

  const mockInterfaceMetrics: InterfaceMetrics = {
    deviceId: 'device-1',
    portId: 'port-1',
    ifIndex: 1,
    timestamp: new Date(),
    ifInOctets: BigInt('1000000000'),
    ifOutOctets: BigInt('500000000'),
    ifInUcastPkts: BigInt('1000000'),
    ifOutUcastPkts: BigInt('500000'),
    ifInNUcastPkts: BigInt('10000'),
    ifOutNUcastPkts: BigInt('5000'),
    ifInDiscards: BigInt('100'),
    ifOutDiscards: BigInt('50'),
    ifInErrors: BigInt('10'),
    ifOutErrors: BigInt('5'),
    ifAdminStatus: 1,
    ifOperStatus: 1,
    utilization: 12.5,
    inUtilization: 10.0,
    outUtilization: 15.0,
    errorRate: 0.001,
    discardRate: 0.01,
  };

  const mockPrismaService = {
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    port: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
    getInterfaceInfo: jest.fn(),
  };

  const mockInfluxDBService = {
    writeInterfaceMetrics: jest.fn(),
    writeDeviceMetrics: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterfaceMonitoringService,
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

    service = module.get<InterfaceMonitoringService>(InterfaceMonitoringService);
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

  describe('pollDeviceInterfaces', () => {
    it('should successfully poll device interfaces', async () => {
      const snmpResponse = [
        { oid: '1.3.6.1.2.1.2.2.1.10.1', value: '1000000000' }, // ifInOctets
        { oid: '1.3.6.1.2.1.2.2.1.16.1', value: '500000000' },  // ifOutOctets
        { oid: '1.3.6.1.2.1.2.2.1.11.1', value: '1000000' },    // ifInUcastPkts
        { oid: '1.3.6.1.2.1.2.2.1.17.1', value: '500000' },     // ifOutUcastPkts
        { oid: '1.3.6.1.2.1.2.2.1.7.1', value: '1' },           // ifAdminStatus
        { oid: '1.3.6.1.2.1.2.2.1.8.1', value: '1' },           // ifOperStatus
      ];

      mockSNMPClientService.testConnection.mockResolvedValue(true);
      mockSNMPClientService.get.mockResolvedValue({
        success: true,
        varbinds: snmpResponse,
      });
      mockInfluxDBService.writeInterfaceMetrics.mockResolvedValue(undefined);
      mockPrismaService.port.update.mockResolvedValue({});

      await service.pollDeviceInterfaces(mockDevice);

      expect(mockSNMPClientService.testConnection).toHaveBeenCalled();
      expect(mockSNMPClientService.get).toHaveBeenCalled();
      expect(mockInfluxDBService.writeInterfaceMetrics).toHaveBeenCalled();
    });

    it('should skip polling when device is not reachable', async () => {
      mockSNMPClientService.testConnection.mockResolvedValue(false);

      await service.pollDeviceInterfaces(mockDevice);

      expect(mockSNMPClientService.get).not.toHaveBeenCalled();
      expect(mockInfluxDBService.writeInterfaceMetrics).not.toHaveBeenCalled();
    });

    it('should handle SNMP polling errors gracefully', async () => {
      mockSNMPClientService.testConnection.mockResolvedValue(true);
      mockSNMPClientService.get.mockRejectedValue(new Error('SNMP timeout'));

      await expect(service.pollDeviceInterfaces(mockDevice)).resolves.not.toThrow();
    });
  });

  describe('calculateUtilization', () => {
    it('should calculate interface utilization correctly', () => {
      const previous: InterfaceMetrics = {
        ...mockInterfaceMetrics,
        ifInOctets: BigInt('900000000'),
        ifOutOctets: BigInt('400000000'),
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      };

      const current: InterfaceMetrics = {
        ...mockInterfaceMetrics,
        ifInOctets: BigInt('1000000000'),
        ifOutOctets: BigInt('500000000'),
        timestamp: new Date(),
      };

      const result = service['calculateUtilization'](current, previous, 1000000000);

      expect(result.inUtilization).toBeGreaterThan(0);
      expect(result.outUtilization).toBeGreaterThan(0);
      expect(result.utilization).toBeGreaterThan(0);
      expect(result.utilization).toBe(Math.max(result.inUtilization, result.outUtilization));
    });

    it('should handle counter rollover correctly', () => {
      const previous: InterfaceMetrics = {
        ...mockInterfaceMetrics,
        ifInOctets: BigInt('4294967295'), // Near 32-bit max
        timestamp: new Date(Date.now() - 300000),
      };

      const current: InterfaceMetrics = {
        ...mockInterfaceMetrics,
        ifInOctets: BigInt('1000000'), // Rolled over
        timestamp: new Date(),
      };

      const result = service['calculateUtilization'](current, previous, 1000000000);

      expect(result.inUtilization).toBeGreaterThan(0);
    });

    it('should return zero utilization when no time difference', () => {
      const timestamp = new Date();
      const previous: InterfaceMetrics = {
        ...mockInterfaceMetrics,
        timestamp,
      };

      const current: InterfaceMetrics = {
        ...mockInterfaceMetrics,
        timestamp,
      };

      const result = service['calculateUtilization'](current, previous, 1000000000);

      expect(result.inUtilization).toBe(0);
      expect(result.outUtilization).toBe(0);
      expect(result.utilization).toBe(0);
    });
  });

  describe('checkInterfaceThresholds', () => {
    it('should create alert when utilization exceeds threshold', async () => {
      const highUtilizationMetrics = {
        ...mockInterfaceMetrics,
        utilization: 95, // Above 90% threshold
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create.mockResolvedValue({});

      await service['checkInterfaceThresholds'](highUtilizationMetrics);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'WARNING',
          message: expect.stringContaining('high utilization'),
          state: 'ACTIVE',
        }),
      });
    });

    it('should create critical alert for very high utilization', async () => {
      const criticalUtilizationMetrics = {
        ...mockInterfaceMetrics,
        utilization: 98, // Above 95% threshold
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create.mockResolvedValue({});

      await service['checkInterfaceThresholds'](criticalUtilizationMetrics);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'CRITICAL',
          message: expect.stringContaining('critical utilization'),
        }),
      });
    });

    it('should create alert for high error rate', async () => {
      const highErrorMetrics = {
        ...mockInterfaceMetrics,
        errorRate: 0.02, // Above 1% threshold
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create.mockResolvedValue({});

      await service['checkInterfaceThresholds'](highErrorMetrics);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('high error rate'),
        }),
      });
    });

    it('should not create duplicate alerts', async () => {
      const highUtilizationMetrics = {
        ...mockInterfaceMetrics,
        utilization: 95,
      };

      mockPrismaService.alert.findFirst.mockResolvedValue({ id: 'existing-alert' });

      await service['checkInterfaceThresholds'](highUtilizationMetrics);

      expect(mockPrismaService.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('buildOIDList', () => {
    it('should build correct OID list for interface', () => {
      const buildOIDList = service['buildOIDList'];
      const result = buildOIDList(1); // ifIndex 1

      expect(result).toContain('1.3.6.1.2.1.2.2.1.10.1'); // ifInOctets
      expect(result).toContain('1.3.6.1.2.1.2.2.1.16.1'); // ifOutOctets
      expect(result).toContain('1.3.6.1.2.1.2.2.1.7.1');  // ifAdminStatus
      expect(result).toContain('1.3.6.1.2.1.2.2.1.8.1');  // ifOperStatus
    });
  });

  describe('parseInterfaceMetrics', () => {
    it('should parse SNMP varbinds into interface metrics', () => {
      const varbinds = [
        { oid: '1.3.6.1.2.1.2.2.1.10.1', value: '1000000000' },
        { oid: '1.3.6.1.2.1.2.2.1.16.1', value: '500000000' },
        { oid: '1.3.6.1.2.1.2.2.1.7.1', value: '1' },
        { oid: '1.3.6.1.2.1.2.2.1.8.1', value: '1' },
      ];

      const parseInterfaceMetrics = service['parseInterfaceMetrics'];
      const result = parseInterfaceMetrics(
        varbinds,
        'device-1',
        'port-1',
        1,
        new Date()
      );

      expect(result.ifInOctets).toBe(BigInt('1000000000'));
      expect(result.ifOutOctets).toBe(BigInt('500000000'));
      expect(result.ifAdminStatus).toBe(1);
      expect(result.ifOperStatus).toBe(1);
    });

    it('should handle missing or invalid values gracefully', () => {
      const varbinds = [
        { oid: '1.3.6.1.2.1.2.2.1.10.1', value: null },
        { oid: '1.3.6.1.2.1.2.2.1.16.1', value: 'invalid' },
      ];

      const parseInterfaceMetrics = service['parseInterfaceMetrics'];
      const result = parseInterfaceMetrics(
        varbinds,
        'device-1',
        'port-1',
        1,
        new Date()
      );

      expect(result.ifInOctets).toBe(BigInt(0));
      expect(result.ifOutOctets).toBe(BigInt(0));
    });
  });

  describe('getValueFromVarbinds', () => {
    it('should extract correct value from varbinds', () => {
      const varbinds = [
        { oid: '1.3.6.1.2.1.2.2.1.10.1', value: '1000' },
        { oid: '1.3.6.1.2.1.2.2.1.10.2', value: '2000' },
      ];

      const getValueFromVarbinds = service['getValueFromVarbinds'];
      
      expect(getValueFromVarbinds(varbinds, '1.3.6.1.2.1.2.2.1.10.1')).toBe('1000');
      expect(getValueFromVarbinds(varbinds, '1.3.6.1.2.1.2.2.1.10.2')).toBe('2000');
      expect(getValueFromVarbinds(varbinds, '1.3.6.1.2.1.2.2.1.10.3')).toBe('0');
    });
  });

  describe('buildSNMPDevice', () => {
    it('should build SNMP device configuration correctly', () => {
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

  describe('chunkArray', () => {
    it('should chunk array correctly', () => {
      const chunkArray = service['chunkArray'];
      const array = [1, 2, 3, 4, 5, 6, 7];
      
      const result = chunkArray(array, 3);
      
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty array', () => {
      const chunkArray = service['chunkArray'];
      const result = chunkArray([], 3);
      
      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle InfluxDB write errors gracefully', async () => {
      mockSNMPClientService.testConnection.mockResolvedValue(true);
      mockSNMPClientService.get.mockResolvedValue({
        success: true,
        varbinds: [{ oid: '1.3.6.1.2.1.2.2.1.10.1', value: '1000' }],
      });
      mockInfluxDBService.writeInterfaceMetrics.mockRejectedValue(new Error('InfluxDB error'));
      mockPrismaService.port.update.mockResolvedValue({});

      await expect(service.pollDeviceInterfaces(mockDevice)).resolves.not.toThrow();
    });

    it('should handle database update errors gracefully', async () => {
      mockSNMPClientService.testConnection.mockResolvedValue(true);
      mockSNMPClientService.get.mockResolvedValue({
        success: true,
        varbinds: [{ oid: '1.3.6.1.2.1.2.2.1.10.1', value: '1000' }],
      });
      mockInfluxDBService.writeInterfaceMetrics.mockResolvedValue(undefined);
      mockPrismaService.port.update.mockRejectedValue(new Error('Database error'));

      await expect(service.pollDeviceInterfaces(mockDevice)).resolves.not.toThrow();
    });
  });

  describe('statistics calculation', () => {
    it('should calculate error rates correctly', () => {
      const metrics = {
        ...mockInterfaceMetrics,
        ifInErrors: BigInt('100'),
        ifInUcastPkts: BigInt('10000'),
      };

      const previous = {
        ...mockInterfaceMetrics,
        ifInErrors: BigInt('50'),
        ifInUcastPkts: BigInt('5000'),
        timestamp: new Date(Date.now() - 300000),
      };

      const calculateErrorRate = service['calculateErrorRate'];
      const result = calculateErrorRate(metrics, previous);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should calculate discard rates correctly', () => {
      const metrics = {
        ...mockInterfaceMetrics,
        ifInDiscards: BigInt('100'),
        ifInUcastPkts: BigInt('10000'),
      };

      const previous = {
        ...mockInterfaceMetrics,
        ifInDiscards: BigInt('50'),
        ifInUcastPkts: BigInt('5000'),
        timestamp: new Date(Date.now() - 300000),
      };

      const calculateDiscardRate = service['calculateDiscardRate'];
      const result = calculateDiscardRate(metrics, previous);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });
  });
});