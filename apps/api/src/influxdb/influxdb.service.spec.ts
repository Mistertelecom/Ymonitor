import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { InfluxDBService } from './influxdb.service';

// Mock the @influxdata/influxdb-client module
jest.mock('@influxdata/influxdb-client', () => ({
  InfluxDB: jest.fn(),
  Point: jest.fn(),
  HttpError: class HttpError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'HttpError';
    }
  },
}));

describe('InfluxDBService', () => {
  let service: InfluxDBService;
  let configService: ConfigService;
  let mockInfluxDB: any;
  let mockWriteApi: any;
  let mockQueryApi: any;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockWriteApi = {
      writePoint: jest.fn(),
      writePoints: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
    };

    mockQueryApi = {
      queryRows: jest.fn(),
      query: jest.fn(),
    };

    mockInfluxDB = {
      getWriteApi: jest.fn().mockReturnValue(mockWriteApi),
      getQueryApi: jest.fn().mockReturnValue(mockQueryApi),
      close: jest.fn(),
    };

    const { InfluxDB } = require('@influxdata/influxdb-client');
    InfluxDB.mockReturnValue(mockInfluxDB);

    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        INFLUXDB_URL: 'http://localhost:8086',
        INFLUXDB_TOKEN: 'test-token',
        INFLUXDB_ORG: 'test-org',
        INFLUXDB_BUCKET: 'test-bucket',
      };
      return config[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfluxDBService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InfluxDBService>(InfluxDBService);
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

  describe('initialization', () => {
    it('should initialize InfluxDB client with correct configuration', () => {
      const { InfluxDB } = require('@influxdata/influxdb-client');
      
      expect(InfluxDB).toHaveBeenCalledWith({
        url: 'http://localhost:8086',
        token: 'test-token',
      });
    });

    it('should get write API with correct parameters', async () => {
      await service.writeInterfaceMetricsLegacy(
        'device-1',
        'port-1',
        1,
        1000000,
        500000,
        1,
        1,
        new Date()
      );

      expect(mockInfluxDB.getWriteApi).toHaveBeenCalledWith(
        'test-org',
        'test-bucket',
        'ns'
      );
    });
  });

  describe('writeInterfaceMetrics', () => {
    it('should write interface metrics successfully', async () => {
      const { Point } = require('@influxdata/influxdb-client');
      const mockPoint = {
        tag: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
      };
      Point.mockReturnValue(mockPoint);

      const timestamp = new Date();
      await service.writeInterfaceMetricsLegacy(
        'device-1',
        'port-1',
        1,
        1000000,
        500000,
        1,
        1,
        timestamp
      );

      expect(Point).toHaveBeenCalledWith('interface_metrics');
      expect(mockPoint.tag).toHaveBeenCalledWith('device_id', 'device-1');
      expect(mockPoint.tag).toHaveBeenCalledWith('port_id', 'port-1');
      expect(mockPoint.intField).toHaveBeenCalledWith('if_index', 1);
      expect(mockPoint.timestamp).toHaveBeenCalledWith(timestamp);
      expect(mockWriteApi.writePoint).toHaveBeenCalledWith(mockPoint);
    });

    it('should handle write errors gracefully', async () => {
      const { Point } = require('@influxdata/influxdb-client');
      Point.mockImplementation(() => {
        throw new Error('Point creation failed');
      });

      await expect(
        service.writeInterfaceMetricsLegacy(
          'device-1',
          'port-1',
          1,
          1000000,
          500000,
          1,
          1,
          new Date()
        )
      ).resolves.not.toThrow();
    });

    it('should handle BigInt values correctly', async () => {
      const { Point } = require('@influxdata/influxdb-client');
      const mockPoint = {
        tag: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
      };
      Point.mockReturnValue(mockPoint);

      const largeValue = 9223372036854775807; // Max int64
      await service.writeInterfaceMetricsLegacy(
        'device-1',
        'port-1',
        1,
        largeValue,
        0,
        1,
        1,
        new Date()
      );

      expect(mockPoint.intField).toHaveBeenCalledWith('if_in_octets', Number(largeValue));
    });
  });

  describe('writeDeviceMetrics', () => {
    it('should write device metrics successfully', async () => {
      const { Point } = require('@influxdata/influxdb-client');
      const mockPoint = {
        tag: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
      };
      Point.mockReturnValue(mockPoint);

      const timestamp = new Date();
      await service.writeDeviceMetrics(
        'device-1',
        'test-device',
        {
          status: 'UP',
          responseTime: 50.5,
          availability: 99.9,
          uptime: 10,
          cpu: 5,
          memory: 1,
        },
        timestamp
      );

      expect(Point).toHaveBeenCalledWith('device_metrics');
      expect(mockPoint.tag).toHaveBeenCalledWith('device_id', 'device-1');
      expect(mockPoint.floatField).toHaveBeenCalledWith('cpu_usage', 50.5);
      expect(mockPoint.intField).toHaveBeenCalledWith('memory_usage', 10);
      expect(mockWriteApi.writePoint).toHaveBeenCalledWith(mockPoint);
    });

    it('should handle optional metrics correctly', async () => {
      const { Point } = require('@influxdata/influxdb-client');
      const mockPoint = {
        tag: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
      };
      Point.mockReturnValue(mockPoint);

      await service.writeDeviceMetrics('device-1', 'test-device', {
        status: 'UP',
        responseTime: 10.5,
        availability: 99.9,
        cpu: 50.5,
      });

      expect(mockPoint.floatField).toHaveBeenCalledWith('cpu_usage', 50.5);
      expect(mockPoint.intField).not.toHaveBeenCalledWith('memory_usage', expect.any(Number));
    });
  });

  describe('writeSensorMetrics', () => {
    it('should write sensor metrics successfully', async () => {
      const { Point } = require('@influxdata/influxdb-client');
      const mockPoint = {
        tag: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
      };
      Point.mockReturnValue(mockPoint);

      const timestamp = new Date();
      await service.writeSensorMetrics(
        'device-1',
        'sensor-1',
        'TEMPERATURE',
        65.5,
        '°C',
        timestamp
      );

      expect(Point).toHaveBeenCalledWith('sensor_metrics');
      expect(mockPoint.tag).toHaveBeenCalledWith('device_id', 'device-1');
      expect(mockPoint.tag).toHaveBeenCalledWith('sensor_id', 'sensor-1');
      expect(mockPoint.tag).toHaveBeenCalledWith('sensor_type', 'TEMPERATURE');
      expect(mockPoint.floatField).toHaveBeenCalledWith('value', 65.5);
      expect(mockPoint.tag).toHaveBeenCalledWith('unit', '°C');
      expect(mockWriteApi.writePoint).toHaveBeenCalledWith(mockPoint);
    });
  });

  describe('queryInterfaceMetrics', () => {
    it('should query interface metrics successfully', async () => {
      const mockData = [
        {
          _time: '2023-01-01T00:00:00Z',
          device_id: 'device-1',
          port_id: 'port-1',
          if_in_octets: 1000000,
          if_out_octets: 500000,
        },
      ];

      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        mockData.forEach(row => observer.next(row));
        observer.complete();
      });

      const result = await service.queryInterfaceMetrics('device-1', 'port-1', '1h');

      expect(result).toEqual(mockData);
      expect(mockQueryApi.queryRows).toHaveBeenCalledWith(
        expect.stringContaining('interface_metrics'),
        expect.any(Object)
      );
    });

    it('should handle query errors', async () => {
      const { HttpError } = require('@influxdata/influxdb-client');
      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        observer.error(new HttpError('Query failed'));
      });

      const result = await service.queryInterfaceMetrics('device-1', 'port-1', '1h');

      expect(result).toEqual([]);
    });

    it('should build correct Flux query', async () => {
      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        observer.complete();
      });

      await service.queryInterfaceMetrics('device-1', 'port-1', '24h');

      const expectedQuery = expect.stringContaining('range(start: -24h)');
      expect(mockQueryApi.queryRows).toHaveBeenCalledWith(
        expectedQuery,
        expect.any(Object)
      );
    });
  });

  describe('queryDeviceMetrics', () => {
    it('should query device metrics successfully', async () => {
      const mockData = [
        {
          _time: '2023-01-01T00:00:00Z',
          device_id: 'device-1',
          cpu_usage: 50.5,
          memory_usage: 10,
        },
      ];

      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        mockData.forEach(row => observer.next(row));
        observer.complete();
      });

      const result = await service.queryDeviceMetrics('device-1', '1h');

      expect(result).toEqual(mockData);
      expect(mockQueryApi.queryRows).toHaveBeenCalledWith(
        expect.stringContaining('device_metrics'),
        expect.any(Object)
      );
    });
  });

  describe('querySensorMetrics', () => {
    it('should query sensor metrics successfully', async () => {
      const mockData = [
        {
          _time: '2023-01-01T00:00:00Z',
          device_id: 'device-1',
          sensor_id: 'sensor-1',
          sensor_type: 'TEMPERATURE',
          value: 65.5,
          unit: '°C',
        },
      ];

      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        mockData.forEach(row => observer.next(row));
        observer.complete();
      });

      const result = await service.querySensorMetrics('device-1', 'sensor-1', '1h');

      expect(result).toEqual(mockData);
      expect(mockQueryApi.queryRows).toHaveBeenCalledWith(
        expect.stringContaining('sensor_metrics'),
        expect.any(Object)
      );
    });

    it('should query all sensors for device when sensorId not provided', async () => {
      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        observer.complete();
      });

      await service.querySensorMetrics('device-1', undefined, '1h');

      const query = mockQueryApi.queryRows.mock.calls[0][0];
      expect(query).toContain('device_id == "device-1"');
      expect(query).not.toContain('sensor_id ==');
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should get aggregated metrics successfully', async () => {
      const mockData = [
        {
          _time: '2023-01-01T00:00:00Z',
          mean_cpu: 50.5,
          max_memory: 80,
          min_cpu: 20.0,
        },
      ];

      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        mockData.forEach(row => observer.next(row));
        observer.complete();
      });

      const result = await service.getAggregatedMetrics('device_metrics', 'device-1', '1h', '5m');

      expect(result).toEqual(mockData);
      expect(mockQueryApi.queryRows).toHaveBeenCalledWith(
        expect.stringContaining('aggregateWindow'),
        expect.any(Object)
      );
    });

    it('should include correct aggregation functions in query', async () => {
      mockQueryApi.queryRows.mockImplementation((query, observer) => {
        observer.complete();
      });

      await service.getAggregatedMetrics('interface_metrics', 'device-1', '1h', '5m');

      const query = mockQueryApi.queryRows.mock.calls[0][0];
      expect(query).toContain('aggregateWindow(every: 5m');
      expect(query).toContain('fn: mean');
    });
  });

  describe('cleanup and error handling', () => {
    it('should handle InfluxDB connection errors', async () => {
      mockWriteApi.writePoint.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(
        service.writeInterfaceMetricsLegacy(
          'device-1',
          'port-1',
          1,
          1000,
          500,
          1,
          1,
          new Date()
        )
      ).resolves.not.toThrow();
    });

    it('should close connections properly on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockWriteApi.close).toHaveBeenCalled();
      expect(mockInfluxDB.close).toHaveBeenCalled();
    });

    it('should handle flush errors gracefully', async () => {
      mockWriteApi.flush.mockRejectedValue(new Error('Flush failed'));

      await service.onModuleDestroy();

      expect(mockWriteApi.flush).toHaveBeenCalled();
      expect(mockWriteApi.close).toHaveBeenCalled();
    });
  });

  describe('BigInt handling', () => {
    it('should convert BigInt to Number for InfluxDB', () => {
      const convertBigIntToNumber = service['convertBigIntToNumber'];
      
      expect(convertBigIntToNumber(BigInt('1000'))).toBe(1000);
      expect(convertBigIntToNumber(BigInt('9223372036854775807'))).toBe(9223372036854775807);
      expect(convertBigIntToNumber(BigInt('0'))).toBe(0);
    });

    it('should handle very large BigInt values', () => {
      const convertBigIntToNumber = service['convertBigIntToNumber'];
      const largeValue = BigInt('18446744073709551615'); // Max uint64
      
      const result = convertBigIntToNumber(largeValue);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('query building', () => {
    it('should build correct time range filters', () => {
      const buildTimeRangeFilter = service['buildTimeRangeFilter'];
      
      expect(buildTimeRangeFilter('1h')).toBe('range(start: -1h)');
      expect(buildTimeRangeFilter('24h')).toBe('range(start: -24h)');
      expect(buildTimeRangeFilter('7d')).toBe('range(start: -7d)');
    });

    it('should build correct device filters', () => {
      const buildDeviceFilter = service['buildDeviceFilter'];
      
      expect(buildDeviceFilter('device-1')).toBe('filter(fn: (r) => r.device_id == "device-1")');
    });
  });
});