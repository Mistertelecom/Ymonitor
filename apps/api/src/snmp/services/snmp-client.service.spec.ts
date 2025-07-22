import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SNMPClientService } from './snmp-client.service';
import { SNMPDevice, SNMPResponse } from '../types/snmp.types';

// Mock the snmp-native module
jest.mock('snmp-native', () => ({
  createSession: jest.fn(),
}));

describe('SNMPClientService', () => {
  let service: SNMPClientService;
  let mockSession: any;

  const mockSNMPDevice: SNMPDevice = {
    hostname: '192.168.1.100',
    port: 161,
    timeout: 5000,
    retries: 3,
    transport: 'udp4',
    version: 'v2c',
    community: 'public',
    contextName: '',
  };

  const mockSNMPv3Device: SNMPDevice = {
    hostname: '192.168.1.100',
    port: 161,
    timeout: 5000,
    retries: 3,
    transport: 'udp4',
    version: 'v3',
    username: 'testuser',
    authLevel: 'authPriv',
    authProtocol: 'MD5',
    authPassword: 'authpass',
    privProtocol: 'DES',
    privPassword: 'privpass',
    contextName: '',
  };

  beforeEach(async () => {
    mockSession = {
      get: jest.fn(),
      getBulk: jest.fn(),
      getNext: jest.fn(),
      walk: jest.fn(),
      close: jest.fn(),
    };

    const { createSession } = require('snmp-native');
    createSession.mockReturnValue(mockSession);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SNMPClientService],
    }).compile();

    service = module.get<SNMPClientService>(SNMPClientService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should successfully perform SNMP GET request', async () => {
      const oids = ['1.3.6.1.2.1.1.1.0'];
      const mockResponse = [
        {
          oid: '1.3.6.1.2.1.1.1.0',
          type: 4,
          value: 'Test Device Description',
        },
      ];

      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, mockResponse);
      });

      const result = await service.get(mockSNMPDevice, oids);

      expect(result.success).toBe(true);
      expect(result.varbinds).toEqual(mockResponse);
      expect(result.error).toBeUndefined();
      expect(mockSession.get).toHaveBeenCalledWith(oids, expect.any(Function));
    });

    it('should handle SNMP GET errors', async () => {
      const oids = ['1.3.6.1.2.1.1.1.0'];
      const error = new Error('SNMP timeout');

      mockSession.get.mockImplementation((oids, callback) => {
        callback(error);
      });

      const result = await service.get(mockSNMPDevice, oids);

      expect(result.success).toBe(false);
      expect(result.varbinds).toEqual([]);
      expect(result.error).toBe('SNMP timeout');
    });

    it('should create session with correct v2c parameters', async () => {
      const { createSession } = require('snmp-native');
      const oids = ['1.3.6.1.2.1.1.1.0'];

      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, []);
      });

      await service.get(mockSNMPDevice, oids);

      expect(createSession).toHaveBeenCalledWith({
        host: '192.168.1.100',
        port: 161,
        community: 'public',
        version: 1, // v2c maps to version 1 in snmp-native
        timeouts: [5000],
        retries: 3,
      });
    });

    it('should create session with correct v3 parameters', async () => {
      const { createSession } = require('snmp-native');
      const oids = ['1.3.6.1.2.1.1.1.0'];

      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, []);
      });

      await service.get(mockSNMPv3Device, oids);

      expect(createSession).toHaveBeenCalledWith({
        host: '192.168.1.100',
        port: 161,
        version: 3,
        user: 'testuser',
        authentication: {
          protocol: 'md5',
          secret: 'authpass',
        },
        privacy: {
          protocol: 'des',
          secret: 'privpass',
        },
        timeouts: [5000],
        retries: 3,
      });
    });
  });

  describe('walk', () => {
    it('should successfully perform SNMP WALK request', async () => {
      const oid = '1.3.6.1.2.1.2.2.1.2';
      const mockResponse = [
        {
          oid: '1.3.6.1.2.1.2.2.1.2.1',
          type: 4,
          value: 'eth0',
        },
        {
          oid: '1.3.6.1.2.1.2.2.1.2.2',
          type: 4,
          value: 'eth1',
        },
      ];

      mockSession.walk.mockImplementation((oid, callback) => {
        callback(null, mockResponse);
      });

      const result = await service.walk(mockSNMPDevice, oid);

      expect(result.success).toBe(true);
      expect(result.varbinds).toEqual(mockResponse);
      expect(mockSession.walk).toHaveBeenCalledWith(oid, expect.any(Function));
    });

    it('should handle SNMP WALK errors', async () => {
      const oid = '1.3.6.1.2.1.2.2.1.2';
      const error = new Error('No such instance');

      mockSession.walk.mockImplementation((oid, callback) => {
        callback(error);
      });

      const result = await service.walk(mockSNMPDevice, oid);

      expect(result.success).toBe(false);
      expect(result.varbinds).toEqual([]);
      expect(result.error).toBe('No such instance');
    });
  });

  describe('getBulk', () => {
    it('should successfully perform SNMP GETBULK request', async () => {
      const oid = '1.3.6.1.2.1.2.2.1.2';
      const mockResponse = [
        {
          oid: '1.3.6.1.2.1.2.2.1.2.1',
          type: 4,
          value: 'eth0',
        },
        {
          oid: '1.3.6.1.2.1.2.2.1.2.2',
          type: 4,
          value: 'eth1',
        },
      ];

      mockSession.getBulk.mockImplementation((options, callback) => {
        callback(null, mockResponse);
      });

      const result = await service.getBulk(mockSNMPDevice, oid, 0, 10);

      expect(result.success).toBe(true);
      expect(result.varbinds).toEqual(mockResponse);
      expect(mockSession.getBulk).toHaveBeenCalledWith(
        { oid, nonRepeaters: 0, maxRepetitions: 10 },
        expect.any(Function)
      );
    });

    it('should handle SNMP GETBULK errors', async () => {
      const oid = '1.3.6.1.2.1.2.2.1.2';
      const error = new Error('Request timeout');

      mockSession.getBulk.mockImplementation((options, callback) => {
        callback(error);
      });

      const result = await service.getBulk(mockSNMPDevice, oid, 0, 10);

      expect(result.success).toBe(false);
      expect(result.varbinds).toEqual([]);
      expect(result.error).toBe('Request timeout');
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, [{ oid: '1.3.6.1.2.1.1.1.0', value: 'test' }]);
      });

      const result = await service.testConnection(mockSNMPDevice);

      expect(result).toBe(true);
      expect(mockSession.get).toHaveBeenCalledWith(
        ['1.3.6.1.2.1.1.1.0'],
        expect.any(Function)
      );
    });

    it('should return false for failed connection test', async () => {
      mockSession.get.mockImplementation((oids, callback) => {
        callback(new Error('Timeout'));
      });

      const result = await service.testConnection(mockSNMPDevice);

      expect(result).toBe(false);
    });
  });

  describe('getSystemInfo', () => {
    it('should successfully get system information', async () => {
      const mockSystemInfo = [
        { oid: '1.3.6.1.2.1.1.1.0', value: 'Test Device Description' },
        { oid: '1.3.6.1.2.1.1.2.0', value: '1.3.6.1.4.1.1234' },
        { oid: '1.3.6.1.2.1.1.3.0', value: '12345678' },
        { oid: '1.3.6.1.2.1.1.4.0', value: 'admin@example.com' },
        { oid: '1.3.6.1.2.1.1.5.0', value: 'test-device' },
        { oid: '1.3.6.1.2.1.1.6.0', value: 'Data Center' },
      ];

      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, mockSystemInfo);
      });

      const result = await service.getSystemInfo(mockSNMPDevice);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        sysDescr: 'Test Device Description',
        sysObjectID: '1.3.6.1.4.1.1234',
        sysUpTime: '12345678',
        sysContact: 'admin@example.com',
        sysName: 'test-device',
        sysLocation: 'Data Center',
      });
    });

    it('should handle missing system information gracefully', async () => {
      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, []);
      });

      const result = await service.getSystemInfo(mockSNMPDevice);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        sysDescr: '',
        sysObjectID: '',
        sysUpTime: '',
        sysContact: '',
        sysName: '',
        sysLocation: '',
      });
    });
  });

  describe('getInterfaceInfo', () => {
    it('should successfully get interface information', async () => {
      const mockInterfaceInfo = [
        { oid: '1.3.6.1.2.1.2.2.1.2.1', value: 'eth0' },
        { oid: '1.3.6.1.2.1.2.2.1.2.2', value: 'eth1' },
        { oid: '1.3.6.1.2.1.2.2.1.3.1', value: '6' },
        { oid: '1.3.6.1.2.1.2.2.1.3.2', value: '6' },
        { oid: '1.3.6.1.2.1.2.2.1.5.1', value: '1000000000' },
        { oid: '1.3.6.1.2.1.2.2.1.5.2', value: '1000000000' },
        { oid: '1.3.6.1.2.1.2.2.1.8.1', value: '1' },
        { oid: '1.3.6.1.2.1.2.2.1.8.2', value: '1' },
      ];

      mockSession.walk.mockImplementation((oid, callback) => {
        const baseOid = oid;
        const filteredData = mockInterfaceInfo.filter(item => 
          item.oid.startsWith(baseOid)
        );
        callback(null, filteredData);
      });

      const result = await service.getInterfaceInfoWithStatus(mockSNMPDevice);

      expect(result.success).toBe(true);
      expect(result.interfaces).toHaveLength(2);
      expect(result.interfaces[0]).toEqual({
        index: '1',
        name: 'eth0',
        type: '6',
        speed: '1000000000',
        operStatus: '1',
        adminStatus: undefined,
        mtu: undefined,
        macAddress: undefined,
      });
    });

    it('should handle interface query errors', async () => {
      mockSession.walk.mockImplementation((oid, callback) => {
        callback(new Error('No interfaces found'));
      });

      const result = await service.getInterfaceInfoWithStatus(mockSNMPDevice);

      expect(result.success).toBe(false);
      expect(result.interfaces).toEqual([]);
      expect(result.error).toBe('No interfaces found');
    });
  });

  describe('session management', () => {
    it('should properly close session after request', async () => {
      const oids = ['1.3.6.1.2.1.1.1.0'];

      mockSession.get.mockImplementation((oids, callback) => {
        callback(null, []);
      });

      await service.get(mockSNMPDevice, oids);

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session even when request fails', async () => {
      const oids = ['1.3.6.1.2.1.1.1.0'];

      mockSession.get.mockImplementation((oids, callback) => {
        callback(new Error('Test error'));
      });

      await service.get(mockSNMPDevice, oids);

      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('version mapping', () => {
    it('should map version strings to numeric values correctly', () => {
      const getVersionNumber = service['getVersionNumber'];

      expect(getVersionNumber('v1')).toBe(0);
      expect(getVersionNumber('v2c')).toBe(1);
      expect(getVersionNumber('v3')).toBe(3);
      expect(getVersionNumber('invalid')).toBe(1); // defaults to v2c
    });
  });

  describe('value extraction', () => {
    it('should extract values from varbinds correctly', () => {
      const extractValue = service['extractValue'];
      const varbinds = [
        { oid: '1.3.6.1.2.1.1.1.0', value: 'test' },
        { oid: '1.3.6.1.2.1.1.2.0', value: 'another' },
      ];

      expect(extractValue(varbinds, '1.3.6.1.2.1.1.1.0')).toBe('test');
      expect(extractValue(varbinds, '1.3.6.1.2.1.1.2.0')).toBe('another');
      expect(extractValue(varbinds, '1.3.6.1.2.1.1.3.0')).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle session creation failures', async () => {
      const { createSession } = require('snmp-native');
      createSession.mockImplementation(() => {
        throw new Error('Failed to create session');
      });

      const oids = ['1.3.6.1.2.1.1.1.0'];
      const result = await service.get(mockSNMPDevice, oids);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create session');
    });

    it('should handle null session gracefully', async () => {
      const { createSession } = require('snmp-native');
      createSession.mockReturnValue(null);

      const oids = ['1.3.6.1.2.1.1.1.0'];
      const result = await service.get(mockSNMPDevice, oids);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create SNMP session');
    });
  });
});