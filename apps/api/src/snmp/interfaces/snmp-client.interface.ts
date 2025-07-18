// SNMP Client Interface for Y Monitor
// Based on LibreNMS SNMP implementation patterns

import { SNMPDevice, SNMPResponse, SNMPVarbind } from '../types/snmp.types';

export interface ISNMPClient {
  /**
   * Performs SNMP GET operation for specific OIDs
   * @param device Device configuration
   * @param oids Array of OIDs to retrieve
   * @returns Promise with SNMP response
   */
  get(device: SNMPDevice, oids: string[]): Promise<SNMPResponse>;

  /**
   * Performs SNMP GETNEXT operation
   * @param device Device configuration
   * @param oids Array of starting OIDs
   * @returns Promise with SNMP response
   */
  getNext(device: SNMPDevice, oids: string[]): Promise<SNMPResponse>;

  /**
   * Performs SNMP WALK operation
   * @param device Device configuration
   * @param oid Starting OID for walk
   * @param maxRepetitions Maximum number of repetitions (for bulk operations)
   * @returns Promise with SNMP response
   */
  walk(device: SNMPDevice, oid: string, maxRepetitions?: number): Promise<SNMPResponse>;

  /**
   * Performs SNMP BULK WALK operation (SNMPv2c/v3 only)
   * @param device Device configuration
   * @param oid Starting OID for bulk walk
   * @param nonRepeaters Number of non-repeating variables
   * @param maxRepetitions Maximum number of repetitions
   * @returns Promise with SNMP response
   */
  bulkWalk(
    device: SNMPDevice,
    oid: string,
    nonRepeaters?: number,
    maxRepetitions?: number,
  ): Promise<SNMPResponse>;

  /**
   * Performs SNMP SET operation
   * @param device Device configuration
   * @param varbinds Array of OID-value pairs to set
   * @returns Promise with SNMP response
   */
  set(device: SNMPDevice, varbinds: SNMPVarbind[]): Promise<SNMPResponse>;

  /**
   * Tests SNMP connectivity to a device
   * @param device Device configuration
   * @returns Promise with boolean indicating success
   */
  testConnection(device: SNMPDevice): Promise<boolean>;

  /**
   * Gets system information from device (sysDescr, sysName, etc.)
   * @param device Device configuration
   * @returns Promise with system information
   */
  getSystemInfo(device: SNMPDevice): Promise<{
    sysDescr?: string;
    sysName?: string;
    sysObjectID?: string;
    sysContact?: string;
    sysLocation?: string;
    sysServices?: number;
    sysUptime?: number;
  }>;

  /**
   * Gets interface information from device
   * @param device Device configuration
   * @returns Promise with interface data
   */
  getInterfaceInfo(device: SNMPDevice): Promise<Array<{
    ifIndex: number;
    ifDescr: string;
    ifName?: string;
    ifAlias?: string;
    ifType: number;
    ifMtu: number;
    ifSpeed: number;
    ifAdminStatus: number;
    ifOperStatus: number;
    ifPhysAddress?: string;
    ifInOctets?: number;
    ifOutOctets?: number;
    ifInErrors?: number;
    ifOutErrors?: number;
    ifInDiscards?: number;
    ifOutDiscards?: number;
    ifHCInOctets?: bigint;
    ifHCOutOctets?: bigint;
  }>>;

  /**
   * Closes SNMP session and cleans up resources
   */
  close(): void;
}

export interface ISNMPSessionManager {
  /**
   * Gets or creates an SNMP session for a device
   * @param device Device configuration
   * @returns Promise with SNMP session
   */
  getSession(device: SNMPDevice): Promise<ISNMPSession>;

  /**
   * Closes and removes a session for a device
   * @param deviceId Device identifier
   */
  closeSession(deviceId: string): void;

  /**
   * Closes all active sessions
   */
  closeAllSessions(): void;

  /**
   * Gets statistics about active sessions
   */
  getSessionStats(): {
    activeSessions: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  };
}

export interface ISNMPSession {
  /**
   * Session identifier
   */
  readonly id: string;

  /**
   * Device associated with this session
   */
  readonly device: SNMPDevice;

  /**
   * Session creation timestamp
   */
  readonly createdAt: Date;

  /**
   * Last used timestamp
   */
  lastUsed: Date;

  /**
   * Number of requests made with this session
   */
  requestCount: number;

  /**
   * Number of successful requests
   */
  successCount: number;

  /**
   * Number of failed requests
   */
  errorCount: number;

  /**
   * Whether the session is currently active
   */
  isActive: boolean;

  /**
   * Performs SNMP request using this session
   */
  request(operation: SNMPOperation): Promise<SNMPResponse>;

  /**
   * Closes the session
   */
  close(): void;
}

export interface SNMPOperation {
  type: 'get' | 'getnext' | 'walk' | 'bulkwalk' | 'getbulk' | 'set';
  oids: string[];
  varbinds?: SNMPVarbind[];
  nonRepeaters?: number;
  maxRepetitions?: number;
}

export interface ISNMPValidator {
  /**
   * Validates SNMP device configuration
   * @param device Device configuration to validate
   * @returns Validation result with errors if any
   */
  validateDevice(device: SNMPDevice): {
    isValid: boolean;
    errors: string[];
  };

  /**
   * Validates OID format
   * @param oid OID string to validate
   * @returns Whether OID is valid
   */
  validateOID(oid: string): boolean;

  /**
   * Validates SNMP credentials
   * @param credentials SNMP credentials to validate
   * @returns Validation result
   */
  validateCredentials(credentials: {
    version: string;
    community?: string;
    username?: string;
    authProtocol?: string;
    privProtocol?: string;
  }): {
    isValid: boolean;
    errors: string[];
  };
}

export interface ISNMPCache {
  /**
   * Gets cached SNMP response
   * @param key Cache key
   * @returns Cached response or null
   */
  get(key: string): Promise<SNMPResponse | null>;

  /**
   * Sets cached SNMP response
   * @param key Cache key
   * @param response SNMP response to cache
   * @param ttl Time to live in seconds
   */
  set(key: string, response: SNMPResponse, ttl: number): Promise<void>;

  /**
   * Deletes cached response
   * @param key Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clears all cached responses
   */
  clear(): Promise<void>;

  /**
   * Generates cache key for device and OIDs
   * @param device Device configuration
   * @param operation SNMP operation
   * @returns Cache key
   */
  generateKey(device: SNMPDevice, operation: SNMPOperation): string;
}