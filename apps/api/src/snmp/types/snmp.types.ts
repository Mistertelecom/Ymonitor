// SNMP Types and Interfaces for Y Monitor
// Based on LibreNMS implementation

export type SNMPVersion = 'v1' | 'v2c' | 'v3';

export type SNMPv3AuthLevel = 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';

export type SNMPv3AuthProtocol = 'MD5' | 'SHA' | 'SHA224' | 'SHA256' | 'SHA384' | 'SHA512';

export type SNMPv3PrivProtocol = 'DES' | 'AES' | 'AES192' | 'AES256' | '3DES';

export type SNMPTransport = 'udp' | 'tcp';

export interface SNMPCredentials {
  version: SNMPVersion;
  community?: string; // For v1/v2c
  
  // SNMPv3 specific
  username?: string;
  authLevel?: SNMPv3AuthLevel;
  authProtocol?: SNMPv3AuthProtocol;
  authPassword?: string;
  privProtocol?: SNMPv3PrivProtocol;
  privPassword?: string;
  contextName?: string;
  contextEngineId?: string;
}

export interface SNMPConnectionOptions {
  hostname: string;
  port: number;
  timeout: number; // milliseconds
  retries: number;
  transport: SNMPTransport;
  maxRepetitions?: number; // for bulk operations
  nonRepeaters?: number; // for bulk operations
}

export interface SNMPDevice extends SNMPCredentials, SNMPConnectionOptions {
  id?: string;
  displayName?: string;
  sysName?: string;
  sysDescr?: string;
  sysObjectID?: string;
  sysContact?: string;
  sysLocation?: string;
  uptime?: number;
  lastPolled?: Date;
}

export interface SNMPVarbind {
  oid: string;
  type: SNMPDataType;
  value: any;
  raw?: Buffer;
}

export interface SNMPResponse {
  success: boolean;
  error?: string;
  errorCode?: number;
  varbinds: SNMPVarbind[];
  requestId?: number;
  messageId?: number;
}

export enum SNMPDataType {
  // Basic types
  INTEGER = 'INTEGER',
  STRING = 'OCTET STRING',
  OID = 'OBJECT IDENTIFIER',
  NULL = 'NULL',
  
  // Application types
  IP_ADDRESS = 'IpAddress',
  COUNTER = 'Counter32',
  GAUGE = 'Gauge32',
  TIME_TICKS = 'TimeTicks',
  OPAQUE = 'Opaque',
  
  // SNMPv2 types
  COUNTER64 = 'Counter64',
  UNSIGNED32 = 'Unsigned32',
  
  // Error types
  NO_SUCH_OBJECT = 'noSuchObject',
  NO_SUCH_INSTANCE = 'noSuchInstance',
  END_OF_MIB_VIEW = 'endOfMibView',
}

export interface SNMPError {
  code: number;
  message: string;
  index?: number;
}

export enum SNMPErrorCode {
  NO_ERROR = 0,
  TOO_BIG = 1,
  NO_SUCH_NAME = 2,
  BAD_VALUE = 3,
  READ_ONLY = 4,
  GEN_ERR = 5,
  NO_ACCESS = 6,
  WRONG_TYPE = 7,
  WRONG_LENGTH = 8,
  WRONG_ENCODING = 9,
  WRONG_VALUE = 10,
  NO_CREATION = 11,
  INCONSISTENT_VALUE = 12,
  RESOURCE_UNAVAILABLE = 13,
  COMMIT_FAILED = 14,
  UNDO_FAILED = 15,
  AUTHORIZATION_ERROR = 16,
  NOT_WRITABLE = 17,
  INCONSISTENT_NAME = 18,
}

// Common OIDs based on LibreNMS
export const SNMP_OIDS = {
  // System group (1.3.6.1.2.1.1)
  SYSTEM: {
    SYS_DESCR: '1.3.6.1.2.1.1.1.0',
    SYS_OBJECT_ID: '1.3.6.1.2.1.1.2.0',
    SYS_UPTIME: '1.3.6.1.2.1.1.3.0',
    SYS_CONTACT: '1.3.6.1.2.1.1.4.0',
    SYS_NAME: '1.3.6.1.2.1.1.5.0',
    SYS_LOCATION: '1.3.6.1.2.1.1.6.0',
    SYS_SERVICES: '1.3.6.1.2.1.1.7.0',
  },
  
  // Interface group (1.3.6.1.2.1.2)
  INTERFACE: {
    IF_NUMBER: '1.3.6.1.2.1.2.1.0',
    IF_TABLE: '1.3.6.1.2.1.2.2',
    IF_INDEX: '1.3.6.1.2.1.2.2.1.1',
    IF_DESCR: '1.3.6.1.2.1.2.2.1.2',
    IF_TYPE: '1.3.6.1.2.1.2.2.1.3',
    IF_MTU: '1.3.6.1.2.1.2.2.1.4',
    IF_SPEED: '1.3.6.1.2.1.2.2.1.5',
    IF_PHYS_ADDRESS: '1.3.6.1.2.1.2.2.1.6',
    IF_ADMIN_STATUS: '1.3.6.1.2.1.2.2.1.7',
    IF_OPER_STATUS: '1.3.6.1.2.1.2.2.1.8',
    IF_LAST_CHANGE: '1.3.6.1.2.1.2.2.1.9',
    IF_IN_OCTETS: '1.3.6.1.2.1.2.2.1.10',
    IF_IN_UCAST_PKTS: '1.3.6.1.2.1.2.2.1.11',
    IF_IN_NUCAST_PKTS: '1.3.6.1.2.1.2.2.1.12',
    IF_IN_DISCARDS: '1.3.6.1.2.1.2.2.1.13',
    IF_IN_ERRORS: '1.3.6.1.2.1.2.2.1.14',
    IF_IN_UNKNOWN_PROTOS: '1.3.6.1.2.1.2.2.1.15',
    IF_OUT_OCTETS: '1.3.6.1.2.1.2.2.1.16',
    IF_OUT_UCAST_PKTS: '1.3.6.1.2.1.2.2.1.17',
    IF_OUT_NUCAST_PKTS: '1.3.6.1.2.1.2.2.1.18',
    IF_OUT_DISCARDS: '1.3.6.1.2.1.2.2.1.19',
    IF_OUT_ERRORS: '1.3.6.1.2.1.2.2.1.20',
    IF_OUT_QLEN: '1.3.6.1.2.1.2.2.1.21',
    IF_SPECIFIC: '1.3.6.1.2.1.2.2.1.22',
  },
  
  // High Capacity Interface Counters (1.3.6.1.2.1.31.1.1.1)
  IF_HC: {
    IF_NAME: '1.3.6.1.2.1.31.1.1.1.1',
    IF_IN_MULTICAST_PKTS: '1.3.6.1.2.1.31.1.1.1.2',
    IF_IN_BROADCAST_PKTS: '1.3.6.1.2.1.31.1.1.1.3',
    IF_OUT_MULTICAST_PKTS: '1.3.6.1.2.1.31.1.1.1.4',
    IF_OUT_BROADCAST_PKTS: '1.3.6.1.2.1.31.1.1.1.5',
    IF_HC_IN_OCTETS: '1.3.6.1.2.1.31.1.1.1.6',
    IF_HC_IN_UCAST_PKTS: '1.3.6.1.2.1.31.1.1.1.7',
    IF_HC_IN_MULTICAST_PKTS: '1.3.6.1.2.1.31.1.1.1.8',
    IF_HC_IN_BROADCAST_PKTS: '1.3.6.1.2.1.31.1.1.1.9',
    IF_HC_OUT_OCTETS: '1.3.6.1.2.1.31.1.1.1.10',
    IF_HC_OUT_UCAST_PKTS: '1.3.6.1.2.1.31.1.1.1.11',
    IF_HC_OUT_MULTICAST_PKTS: '1.3.6.1.2.1.31.1.1.1.12',
    IF_HC_OUT_BROADCAST_PKTS: '1.3.6.1.2.1.31.1.1.1.13',
    IF_ALIAS: '1.3.6.1.2.1.31.1.1.1.18',
    IF_COUNTER_DISCONTINUITY_TIME: '1.3.6.1.2.1.31.1.1.1.19',
  },
  
  // Entity MIB (1.3.6.1.2.1.47)
  ENTITY: {
    ENT_PHYSICAL_TABLE: '1.3.6.1.2.1.47.1.1.1',
    ENT_PHYSICAL_INDEX: '1.3.6.1.2.1.47.1.1.1.1.1',
    ENT_PHYSICAL_DESCR: '1.3.6.1.2.1.47.1.1.1.1.2',
    ENT_PHYSICAL_VENDOR_TYPE: '1.3.6.1.2.1.47.1.1.1.1.3',
    ENT_PHYSICAL_CONTAINED_IN: '1.3.6.1.2.1.47.1.1.1.1.4',
    ENT_PHYSICAL_CLASS: '1.3.6.1.2.1.47.1.1.1.1.5',
    ENT_PHYSICAL_PARENT_REL_POS: '1.3.6.1.2.1.47.1.1.1.1.6',
    ENT_PHYSICAL_NAME: '1.3.6.1.2.1.47.1.1.1.1.7',
    ENT_PHYSICAL_HARDWARE_REV: '1.3.6.1.2.1.47.1.1.1.1.8',
    ENT_PHYSICAL_FIRMWARE_REV: '1.3.6.1.2.1.47.1.1.1.1.9',
    ENT_PHYSICAL_SOFTWARE_REV: '1.3.6.1.2.1.47.1.1.1.1.10',
    ENT_PHYSICAL_SERIAL_NUM: '1.3.6.1.2.1.47.1.1.1.1.11',
    ENT_PHYSICAL_MFG_NAME: '1.3.6.1.2.1.47.1.1.1.1.12',
    ENT_PHYSICAL_MODEL_NAME: '1.3.6.1.2.1.47.1.1.1.1.13',
  },
  
  // Sensor MIB (1.3.6.1.2.1.99)
  SENSOR: {
    ENT_SENSOR_TABLE: '1.3.6.1.2.1.99.1.1',
    ENT_SENSOR_TYPE: '1.3.6.1.2.1.99.1.1.1.1',
    ENT_SENSOR_SCALE: '1.3.6.1.2.1.99.1.1.1.2',
    ENT_SENSOR_PRECISION: '1.3.6.1.2.1.99.1.1.1.3',
    ENT_SENSOR_VALUE: '1.3.6.1.2.1.99.1.1.1.4',
    ENT_SENSOR_OPER_STATUS: '1.3.6.1.2.1.99.1.1.1.5',
    ENT_SENSOR_UNITS_DISPLAY: '1.3.6.1.2.1.99.1.1.1.6',
    ENT_SENSOR_VALUE_TIMESTAMP: '1.3.6.1.2.1.99.1.1.1.7',
    ENT_SENSOR_VALUE_UPDATE_RATE: '1.3.6.1.2.1.99.1.1.1.8',
  },
  
  // Host Resources MIB (1.3.6.1.2.1.25)
  HOST: {
    HR_SYSTEM_UPTIME: '1.3.6.1.2.1.25.1.1.0',
    HR_SYSTEM_DATE: '1.3.6.1.2.1.25.1.2.0',
    HR_SYSTEM_INITIAL_LOAD_DEVICE: '1.3.6.1.2.1.25.1.3.0',
    HR_SYSTEM_INITIAL_LOAD_PARAMETERS: '1.3.6.1.2.1.25.1.4.0',
    HR_SYSTEM_NUM_USERS: '1.3.6.1.2.1.25.1.5.0',
    HR_SYSTEM_PROCESSES: '1.3.6.1.2.1.25.1.6.0',
    HR_SYSTEM_MAX_PROCESSES: '1.3.6.1.2.1.25.1.7.0',
    HR_MEMORY_SIZE: '1.3.6.1.2.1.25.2.2.0',
    HR_STORAGE_TABLE: '1.3.6.1.2.1.25.2.3',
    HR_DEVICE_TABLE: '1.3.6.1.2.1.25.3.2',
    HR_PROCESSOR_TABLE: '1.3.6.1.2.1.25.3.3',
  },
  
  // LLDP MIB (1.0.8802.1.1.2.1)
  LLDP: {
    LLDP_LOC_CHASSIS_ID: '1.0.8802.1.1.2.1.3.2.0',
    LLDP_LOC_PORT_ID: '1.0.8802.1.1.2.1.3.7.1.3',
    LLDP_LOC_PORT_DESC: '1.0.8802.1.1.2.1.3.7.1.4',
    LLDP_LOC_SYS_NAME: '1.0.8802.1.1.2.1.3.3.0',
    LLDP_LOC_SYS_DESC: '1.0.8802.1.1.2.1.3.4.0',
    LLDP_REM_TABLE: '1.0.8802.1.1.2.1.4.1.1',
    LLDP_REM_CHASSIS_ID: '1.0.8802.1.1.2.1.4.1.1.5',
    LLDP_REM_PORT_ID: '1.0.8802.1.1.2.1.4.1.1.7',
    LLDP_REM_PORT_DESC: '1.0.8802.1.1.2.1.4.1.1.8',
    LLDP_REM_SYS_NAME: '1.0.8802.1.1.2.1.4.1.1.9',
    LLDP_REM_SYS_DESC: '1.0.8802.1.1.2.1.4.1.1.10',
    LLDP_REM_SYS_CAP: '1.0.8802.1.1.2.1.4.1.1.11',
  },
  
  // CDP MIB (1.3.6.1.4.1.9.9.23)
  CDP: {
    CDP_GLOBAL_RUN: '1.3.6.1.4.1.9.9.23.1.3.1.0',
    CDP_CACHE_TABLE: '1.3.6.1.4.1.9.9.23.1.2.1.1',
    CDP_CACHE_DEVICE_ID: '1.3.6.1.4.1.9.9.23.1.2.1.1.6',
    CDP_CACHE_DEVICE_PORT: '1.3.6.1.4.1.9.9.23.1.2.1.1.7',
    CDP_CACHE_PLATFORM: '1.3.6.1.4.1.9.9.23.1.2.1.1.8',
    CDP_CACHE_CAPABILITIES: '1.3.6.1.4.1.9.9.23.1.2.1.1.9',
    CDP_CACHE_VERSION: '1.3.6.1.4.1.9.9.23.1.2.1.1.5',
    CDP_CACHE_ADDRESS: '1.3.6.1.4.1.9.9.23.1.2.1.1.4',
  },
} as const;

// Device OS/Vendor specific OIDs
export const VENDOR_OIDS = {
  CISCO: {
    CISCO_PRODUCTS: '1.3.6.1.4.1.9.1',
    CISCO_ENV_MON: '1.3.6.1.4.1.9.9.13',
    CISCO_TEMP_STATUS: '1.3.6.1.4.1.9.9.13.1.3.1.6',
    CISCO_CPU_5MIN: '1.3.6.1.4.1.9.9.109.1.1.1.1.8',
    CISCO_MEMORY_POOL: '1.3.6.1.4.1.9.9.48.1.1.1',
  },
  
  JUNIPER: {
    JUNIPER_MIB: '1.3.6.1.4.1.2636',
    JUNIPER_OPERATING: '1.3.6.1.4.1.2636.3.1.13.1.8',
    JUNIPER_TEMP: '1.3.6.1.4.1.2636.3.1.13.1.7',
  },
  
  HP: {
    HP_ICF_OID: '1.3.6.1.4.1.11.2.14.11',
    HP_SWITCH_CPU_STAT: '1.3.6.1.4.1.11.2.14.11.5.1.9.6.1',
  },
  
  DELL: {
    DELL_OID: '1.3.6.1.4.1.674',
    DELL_TEMP: '1.3.6.1.4.1.674.10892.1.700.20.1.6',
  },
} as const;