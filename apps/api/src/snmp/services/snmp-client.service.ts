// SNMP Client Service Implementation for Y Monitor
// Based on LibreNMS SNMP patterns

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as snmp from 'net-snmp';
import { 
  ISNMPClient, 
  ISNMPCache,
  SNMPOperation 
} from '../interfaces/snmp-client.interface';
import {
  SNMPDevice,
  SNMPResponse,
  SNMPVarbind,
  SNMPDataType,
  SNMPErrorCode,
  SNMP_OIDS,
} from '../types/snmp.types';

@Injectable()
export class SNMPClientService implements ISNMPClient {
  private readonly logger = new Logger(SNMPClientService.name);
  private readonly sessions = new Map<string, snmp.Session>();

  constructor(
    private configService: ConfigService,
    @Inject('ISNMPCache') private cache: ISNMPCache,
  ) {}

  async get(device: SNMPDevice, oids: string[]): Promise<SNMPResponse> {
    return this.executeOperation(device, {
      type: 'get',
      oids,
    });
  }

  async getNext(device: SNMPDevice, oids: string[]): Promise<SNMPResponse> {
    return this.executeOperation(device, {
      type: 'getnext',
      oids,
    });
  }

  async walk(device: SNMPDevice, oid: string, maxRepetitions = 20): Promise<SNMPResponse> {
    return this.executeOperation(device, {
      type: 'walk',
      oids: [oid],
      maxRepetitions,
    });
  }

  async getBulk(
    device: SNMPDevice,
    oid: string,
    nonRepeaters = 0,
    maxRepetitions = 20,
  ): Promise<SNMPResponse> {
    if (device.version === 'v1') {
      // Fallback to regular get for SNMPv1
      return this.get(device, [oid]);
    }

    return this.executeOperation(device, {
      type: 'getbulk',
      oids: [oid],
      nonRepeaters,
      maxRepetitions,
    });
  }

  async bulkWalk(
    device: SNMPDevice,
    oid: string,
    nonRepeaters = 0,
    maxRepetitions = 20,
  ): Promise<SNMPResponse> {
    if (device.version === 'v1') {
      // Fallback to regular walk for SNMPv1
      return this.walk(device, oid, maxRepetitions);
    }

    return this.executeOperation(device, {
      type: 'bulkwalk',
      oids: [oid],
      nonRepeaters,
      maxRepetitions,
    });
  }

  async set(device: SNMPDevice, varbinds: SNMPVarbind[]): Promise<SNMPResponse> {
    return this.executeOperation(device, {
      type: 'set',
      oids: varbinds.map(vb => vb.oid),
      varbinds,
    });
  }

  async testConnection(device: SNMPDevice): Promise<boolean> {
    try {
      const response = await this.get(device, [SNMP_OIDS.SYSTEM.SYS_DESCR]);
      return response.success && response.varbinds.length > 0;
    } catch (error) {
      this.logger.warn(`SNMP connection test failed for ${device.hostname}: ${error.message}`);
      return false;
    }
  }

  async getSystemInfo(device: SNMPDevice) {
    try {
      const systemOids = [
        SNMP_OIDS.SYSTEM.SYS_DESCR,
        SNMP_OIDS.SYSTEM.SYS_NAME,
        SNMP_OIDS.SYSTEM.SYS_OBJECT_ID,
        SNMP_OIDS.SYSTEM.SYS_CONTACT,
        SNMP_OIDS.SYSTEM.SYS_LOCATION,
        SNMP_OIDS.SYSTEM.SYS_SERVICES,
        SNMP_OIDS.SYSTEM.SYS_UPTIME,
      ];

      const response = await this.get(device, systemOids);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get system info');
      }

      const result: any = {};
      response.varbinds.forEach((vb, index) => {
        const value = this.parseVarbindValue(vb);
        switch (systemOids[index]) {
          case SNMP_OIDS.SYSTEM.SYS_DESCR:
            result.sysDescr = value;
            break;
          case SNMP_OIDS.SYSTEM.SYS_NAME:
            result.sysName = value;
            break;
          case SNMP_OIDS.SYSTEM.SYS_OBJECT_ID:
            result.sysObjectID = value;
            break;
          case SNMP_OIDS.SYSTEM.SYS_CONTACT:
            result.sysContact = value;
            break;
          case SNMP_OIDS.SYSTEM.SYS_LOCATION:
            result.sysLocation = value;
            break;
          case SNMP_OIDS.SYSTEM.SYS_SERVICES:
            result.sysServices = parseInt(value) || 0;
            break;
          case SNMP_OIDS.SYSTEM.SYS_UPTIME:
            result.sysUptime = parseInt(value) || 0;
            break;
        }
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to get system info for ${device.hostname}: ${error.message}`);
      throw error;
    }
  }

  async getInterfaceInfo(device: SNMPDevice): Promise<Array<any>> {
    const result = await this.getInterfaceInfoWithStatus(device);
    if (result.success) {
      return result.interfaces.map(iface => ({
        ifIndex: parseInt(iface.index) || 0,
        ifDescr: iface.name || '',
        ifName: iface.name,
        ifAlias: '',
        ifType: parseInt(iface.type) || 0,
        ifMtu: parseInt(iface.mtu) || 0,
        ifSpeed: parseInt(iface.speed) || 0,
        ifAdminStatus: parseInt(iface.adminStatus) || 0,
        ifOperStatus: parseInt(iface.operStatus) || 0,
        ifPhysAddress: iface.macAddress,
        ifInOctets: iface.ifInOctets,
        ifOutOctets: iface.ifOutOctets,
        ifInErrors: iface.ifInErrors,
        ifOutErrors: iface.ifOutErrors,
        ifInDiscards: iface.ifInDiscards,
        ifOutDiscards: iface.ifOutDiscards,
      }));
    }
    throw new Error(result.error || 'Failed to get interface info');
  }

  async getInterfaceInfoWithStatus(device: SNMPDevice) {
    try {
      // Get interface count first
      const ifNumberResponse = await this.get(device, [SNMP_OIDS.INTERFACE.IF_NUMBER]);
      if (!ifNumberResponse.success) {
        throw new Error('Failed to get interface count');
      }

      const ifNumber = parseInt(this.parseVarbindValue(ifNumberResponse.varbinds[0])) || 0;
      
      if (ifNumber === 0) {
        return {
          success: true,
          interfaces: [],
        };
      }

      // Walk interface table for basic info
      const basicInfoOids = [
        SNMP_OIDS.INTERFACE.IF_INDEX,
        SNMP_OIDS.INTERFACE.IF_DESCR,
        SNMP_OIDS.INTERFACE.IF_TYPE,
        SNMP_OIDS.INTERFACE.IF_MTU,
        SNMP_OIDS.INTERFACE.IF_SPEED,
        SNMP_OIDS.INTERFACE.IF_PHYS_ADDRESS,
        SNMP_OIDS.INTERFACE.IF_ADMIN_STATUS,
        SNMP_OIDS.INTERFACE.IF_OPER_STATUS,
        SNMP_OIDS.INTERFACE.IF_IN_OCTETS,
        SNMP_OIDS.INTERFACE.IF_OUT_OCTETS,
        SNMP_OIDS.INTERFACE.IF_IN_ERRORS,
        SNMP_OIDS.INTERFACE.IF_OUT_ERRORS,
        SNMP_OIDS.INTERFACE.IF_IN_DISCARDS,
        SNMP_OIDS.INTERFACE.IF_OUT_DISCARDS,
      ];

      // Use bulk operations for better performance
      const responses = await Promise.all(
        basicInfoOids.map(oid => this.bulkWalk(device, oid))
      );

      // Parse interface data
      const interfaces: any[] = [];
      const ifIndexResponse = responses[0];
      
      if (!ifIndexResponse.success || ifIndexResponse.varbinds.length === 0) {
        return {
          success: true,
          interfaces: [],
        };
      }

      // Process each interface
      ifIndexResponse.varbinds.forEach((indexVb, idx) => {
        const ifIndex = this.parseVarbindValue(indexVb);
        const ifData: any = { 
          index: ifIndex?.toString(),
          adminStatus: undefined,
          mtu: undefined,
          macAddress: undefined,
        };

        // Map data from other responses
        responses.forEach((response, responseIdx) => {
          if (response.success && response.varbinds[idx]) {
            const value = this.parseVarbindValue(response.varbinds[idx]);
            
            switch (responseIdx) {
              case 1: ifData.name = value; break;
              case 2: ifData.type = value?.toString(); break;
              case 3: ifData.mtu = value?.toString(); break;
              case 4: ifData.speed = value?.toString(); break;
              case 5: ifData.macAddress = value; break;
              case 6: ifData.adminStatus = value?.toString(); break;
              case 7: ifData.operStatus = value?.toString(); break;
              case 8: ifData.ifInOctets = parseInt(value) || 0; break;
              case 9: ifData.ifOutOctets = parseInt(value) || 0; break;
              case 10: ifData.ifInErrors = parseInt(value) || 0; break;
              case 11: ifData.ifOutErrors = parseInt(value) || 0; break;
              case 12: ifData.ifInDiscards = parseInt(value) || 0; break;
              case 13: ifData.ifOutDiscards = parseInt(value) || 0; break;
            }
          }
        });

        interfaces.push(ifData);
      });

      // Try to get high-capacity counters for supported devices
      if (device.version !== 'v1') {
        try {
          const hcOids = [
            SNMP_OIDS.IF_HC.IF_NAME,
            SNMP_OIDS.IF_HC.IF_ALIAS,
            SNMP_OIDS.IF_HC.IF_HC_IN_OCTETS,
            SNMP_OIDS.IF_HC.IF_HC_OUT_OCTETS,
          ];

          const hcResponses = await Promise.all(
            hcOids.map(oid => this.bulkWalk(device, oid))
          );

          // Merge HC data with interface data
          interfaces.forEach((iface, idx) => {
            hcResponses.forEach((response, responseIdx) => {
              if (response.success && response.varbinds[idx]) {
                const value = this.parseVarbindValue(response.varbinds[idx]);
                
                switch (responseIdx) {
                  case 0: iface.ifName = value; break;
                  case 1: iface.ifAlias = value; break;
                  case 2: iface.ifHCInOctets = BigInt(value || '0'); break;
                  case 3: iface.ifHCOutOctets = BigInt(value || '0'); break;
                }
              }
            });
          });
        } catch (error) {
          this.logger.warn(`Failed to get HC counters for ${device.hostname}: ${error.message}`);
        }
      }

      return {
        success: true,
        interfaces,
      };
    } catch (error) {
      this.logger.error(`Failed to get interface info for ${device.hostname}: ${error.message}`);
      return {
        success: false,
        interfaces: [],
        error: error.message,
      };
    }
  }

  close(): void {
    this.sessions.forEach(session => {
      try {
        session.close();
      } catch (error) {
        this.logger.warn(`Failed to close SNMP session: ${error.message}`);
      }
    });
    this.sessions.clear();
  }

  private async executeOperation(device: SNMPDevice, operation: SNMPOperation): Promise<SNMPResponse> {
    const cacheKey = this.cache?.generateKey(device, operation);
    
    // Check cache first
    if (this.cache && cacheKey && ['get', 'walk', 'bulkwalk'].includes(operation.type)) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${device.hostname} ${operation.type}`);
        return cached;
      }
    }

    try {
      const session = this.getSession(device);
      const response = await this.performSNMPOperation(session, operation);

      // Cache successful responses
      if (this.cache && cacheKey && response.success) {
        const ttl = this.configService.get<number>('SNMP_CACHE_TTL', 300); // 5 minutes default
        await this.cache.set(cacheKey, response, ttl);
      }

      return response;
    } catch (error) {
      this.logger.error(`SNMP operation failed for ${device.hostname}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        varbinds: [],
      };
    }
  }

  private getSession(device: SNMPDevice): snmp.Session {
    const sessionKey = `${device.hostname}:${device.port}:${device.version}`;
    
    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey)!;
    }

    const options = this.buildSessionOptions(device);
    const session = snmp.createSession(device.hostname, device.community || 'public', options);
    
    this.sessions.set(sessionKey, session);
    return session;
  }

  private buildSessionOptions(device: SNMPDevice): any {
    const options: any = {
      port: device.port || 161,
      retries: device.retries || 3,
      timeout: device.timeout || 5000,
      transport: device.transport || 'udp',
      version: this.mapSNMPVersion(device.version),
    };

    if (device.version === 'v3') {
      options.user = {
        name: device.username || '',
        level: this.mapAuthLevel(device.authLevel || 'noAuthNoPriv'),
      };

      if (device.authLevel === 'authNoPriv' || device.authLevel === 'authPriv') {
        options.user.authProtocol = this.mapAuthProtocol(device.authProtocol || 'MD5');
        options.user.authKey = device.authPassword || '';
      }

      if (device.authLevel === 'authPriv') {
        options.user.privProtocol = this.mapPrivProtocol(device.privProtocol || 'DES');
        options.user.privKey = device.privPassword || '';
      }

      if (device.contextName) {
        options.context = device.contextName;
      }
    }

    return options;
  }

  private async performSNMPOperation(session: snmp.Session, operation: SNMPOperation): Promise<SNMPResponse> {
    return new Promise((resolve) => {
      const callback = (error: Error | null, varbinds: any[]) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            varbinds: [],
          });
          return;
        }

        const mappedVarbinds = this.mapVarbinds(varbinds);
        resolve({
          success: true,
          varbinds: mappedVarbinds,
        });
      };

      switch (operation.type) {
        case 'get':
          session.get(operation.oids, callback);
          break;
        case 'getnext':
          session.getNext(operation.oids, callback);
          break;
        case 'walk':
          session.walk(operation.oids[0], operation.maxRepetitions || 20, callback);
          break;
        case 'getbulk':
        case 'bulkwalk':
          session.getBulk(
            operation.oids,
            operation.nonRepeaters || 0,
            operation.maxRepetitions || 20,
            callback
          );
          break;
        case 'set':
          if (operation.varbinds) {
            const nativeVarbinds = operation.varbinds.map(vb => ({
              oid: vb.oid,
              type: this.mapDataType(vb.type),
              value: vb.value,
            }));
            session.set(nativeVarbinds, callback);
          } else {
            resolve({
              success: false,
              error: 'No varbinds provided for SET operation',
              varbinds: [],
            });
          }
          break;
        default:
          resolve({
            success: false,
            error: `Unsupported operation type: ${operation.type}`,
            varbinds: [],
          });
      }
    });
  }

  private mapVarbinds(nativeVarbinds: any[]): SNMPVarbind[] {
    return nativeVarbinds.map(vb => ({
      oid: vb.oid,
      type: this.mapNativeDataType(vb.type),
      value: vb.value,
      raw: vb.raw,
    }));
  }

  private parseVarbindValue(varbind: SNMPVarbind): any {
    if (!varbind || varbind.value === null || varbind.value === undefined) {
      return null;
    }

    switch (varbind.type) {
      case SNMPDataType.INTEGER:
      case SNMPDataType.COUNTER:
      case SNMPDataType.GAUGE:
      case SNMPDataType.TIME_TICKS:
      case SNMPDataType.UNSIGNED32:
        return parseInt(varbind.value) || 0;
      
      case SNMPDataType.COUNTER64:
        return BigInt(varbind.value || '0');
      
      case SNMPDataType.STRING:
      case SNMPDataType.OID:
        return varbind.value.toString();
      
      case SNMPDataType.IP_ADDRESS:
        return varbind.value.toString();
      
      default:
        return varbind.value;
    }
  }

  private mapSNMPVersion(version: string): number {
    switch (version) {
      case 'v1': return snmp.Version1;
      case 'v2c': return snmp.Version2c;
      case 'v3': return snmp.Version3;
      default: return snmp.Version2c;
    }
  }

  private mapAuthLevel(level: string): number {
    switch (level) {
      case 'noAuthNoPriv': return snmp.SecurityLevel.noAuthNoPriv;
      case 'authNoPriv': return snmp.SecurityLevel.authNoPriv;
      case 'authPriv': return snmp.SecurityLevel.authPriv;
      default: return snmp.SecurityLevel.noAuthNoPriv;
    }
  }

  private mapAuthProtocol(protocol: string): number {
    switch (protocol) {
      case 'MD5': return snmp.AuthProtocols.md5;
      case 'SHA': return snmp.AuthProtocols.sha;
      default: return snmp.AuthProtocols.md5;
    }
  }

  private mapPrivProtocol(protocol: string): number {
    switch (protocol) {
      case 'DES': return snmp.PrivProtocols.des;
      case 'AES': return snmp.PrivProtocols.aes;
      default: return snmp.PrivProtocols.des;
    }
  }

  private mapDataType(type: SNMPDataType): number {
    switch (type) {
      case SNMPDataType.INTEGER: return snmp.ObjectType.Integer;
      case SNMPDataType.STRING: return snmp.ObjectType.OctetString;
      case SNMPDataType.OID: return snmp.ObjectType.OID;
      case SNMPDataType.IP_ADDRESS: return snmp.ObjectType.IpAddress;
      case SNMPDataType.COUNTER: return snmp.ObjectType.Counter;
      case SNMPDataType.GAUGE: return snmp.ObjectType.Gauge;
      case SNMPDataType.TIME_TICKS: return snmp.ObjectType.TimeTicks;
      case SNMPDataType.OPAQUE: return snmp.ObjectType.Opaque;
      case SNMPDataType.COUNTER64: return snmp.ObjectType.Counter64;
      default: return snmp.ObjectType.OctetString;
    }
  }

  private mapNativeDataType(nativeType: number): SNMPDataType {
    switch (nativeType) {
      case snmp.ObjectType.Integer: return SNMPDataType.INTEGER;
      case snmp.ObjectType.OctetString: return SNMPDataType.STRING;
      case snmp.ObjectType.OID: return SNMPDataType.OID;
      case snmp.ObjectType.IpAddress: return SNMPDataType.IP_ADDRESS;
      case snmp.ObjectType.Counter: return SNMPDataType.COUNTER;
      case snmp.ObjectType.Gauge: return SNMPDataType.GAUGE;
      case snmp.ObjectType.TimeTicks: return SNMPDataType.TIME_TICKS;
      case snmp.ObjectType.Opaque: return SNMPDataType.OPAQUE;
      case snmp.ObjectType.Counter64: return SNMPDataType.COUNTER64;
      default: return SNMPDataType.STRING;
    }
  }
}