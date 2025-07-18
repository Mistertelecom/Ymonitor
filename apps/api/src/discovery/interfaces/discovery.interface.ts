// Discovery Interfaces for Y Monitor
// Based on LibreNMS discovery patterns

import { SNMPDevice } from '../../snmp/types/snmp.types';

export interface DiscoveryResult {
  success: boolean;
  module: string;
  deviceId: string;
  discovered: any[];
  errors: string[];
  timestamp: Date;
  duration: number;
}

export interface DiscoveryModule {
  name: string;
  description: string;
  enabled: boolean;
  dependencies: string[];
  priority: number;

  /**
   * Checks if this module can run for the given device
   */
  canDiscover(device: DeviceInfo): boolean;

  /**
   * Performs discovery for the device
   */
  discover(device: DeviceInfo, templates: OSTemplate[]): Promise<DiscoveryResult>;

  /**
   * Validates discovered data before saving
   */
  validate(data: any[]): boolean;
}

export interface DeviceInfo {
  id: string;
  hostname: string;
  snmpDevice: SNMPDevice;
  os?: string;
  osGroup?: string;
  type?: string;
  vendor?: string;
  model?: string;
  version?: string;
  serial?: string;
  sysDescr?: string;
  sysObjectID?: string;
  sysName?: string;
  sysLocation?: string;
  sysContact?: string;
  uptime?: number;
  lastDiscovered?: Date;
  features?: string[];
}

export interface OSTemplate {
  os: string;
  text: string;
  type: string;
  icon?: string;
  vendor?: string;
  detection: OSDetectionCriteria;
  discovery?: DiscoveryTemplates;
  features?: string[];
}

export interface OSDetectionCriteria {
  sysObjectID?: string[];
  sysDescr?: string[];
  sysDescr_regex?: string[];
  snmpget?: SNMPDetectionRule[];
  snmpwalk?: SNMPDetectionRule[];
}

export interface SNMPDetectionRule {
  oid: string;
  op: '=' | '!=' | '>' | '<' | 'regex' | 'exists' | 'not_exists';
  value: any;
}

export interface DiscoveryTemplates {
  sensors?: SensorDiscoveryTemplate;
  ports?: PortDiscoveryTemplate;
  processors?: ProcessorDiscoveryTemplate;
  mempools?: MempoolDiscoveryTemplate;
  storage?: StorageDiscoveryTemplate;
  [key: string]: any;
}

export interface SensorDiscoveryTemplate {
  [sensorType: string]: SensorTypeTemplate[];
}

export interface SensorTypeTemplate {
  oid: string;
  value?: string;
  num_oid?: string;
  descr: string;
  index?: string;
  divisor?: number;
  multiplier?: number;
  low_limit?: number;
  low_warn_limit?: number;
  warn_limit?: number;
  high_limit?: number;
  skip_if?: string;
  skip_if_zero?: boolean;
  user_func?: string;
  group?: string;
  entPhysicalIndex?: boolean;
  pre_cached?: boolean;
}

export interface PortDiscoveryTemplate {
  enabled: boolean;
  ignore_if?: string[];
  ignore_type?: number[];
  custom_oids?: {
    [key: string]: string;
  };
}

export interface ProcessorDiscoveryTemplate {
  [processorType: string]: ProcessorTypeTemplate;
}

export interface ProcessorTypeTemplate {
  oid: string;
  descr: string;
  precision?: number;
  hrProcessorEntry?: boolean;
}

export interface MempoolDiscoveryTemplate {
  [mempoolType: string]: MempoolTypeTemplate;
}

export interface MempoolTypeTemplate {
  used_oid: string;
  total_oid: string;
  descr: string;
  precision?: number;
  warn_percent?: number;
}

export interface StorageDiscoveryTemplate {
  [storageType: string]: StorageTypeTemplate;
}

export interface StorageTypeTemplate {
  used_oid: string;
  size_oid: string;
  units_oid: string;
  descr: string;
  ignore_mount?: string[];
  ignore_type?: string[];
}

export interface DiscoverySession {
  id: string;
  deviceId: string;
  type: 'full' | 'incremental' | 'module';
  modules: string[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  results: DiscoveryResult[];
  errors: string[];
  progress: number;
  currentModule?: string;
}

export interface TopologyLink {
  localDeviceId: string;
  localPortId: string;
  remoteDeviceId?: string;
  remotePortId?: string;
  remoteHostname?: string;
  remotePortName?: string;
  protocol: 'lldp' | 'cdp' | 'fdp' | 'edp' | 'manual';
  discovered: Date;
  lastSeen: Date;
  active: boolean;
}

export interface EntityInfo {
  index: number;
  descr: string;
  class: string;
  name?: string;
  containedIn?: number;
  parentRelPos?: number;
  vendorType?: string;
  hardwareRev?: string;
  firmwareRev?: string;
  softwareRev?: string;
  serialNum?: string;
  mfgName?: string;
  modelName?: string;
  alias?: string;
  assetID?: string;
  isFRU?: boolean;
}

export interface SensorInfo {
  index: string;
  type: string;
  descr: string;
  class: string;
  oid: string;
  currentValue?: number;
  unit?: string;
  divisor?: number;
  multiplier?: number;
  lowLimit?: number;
  lowWarnLimit?: number;
  warnLimit?: number;
  highLimit?: number;
  entPhysicalIndex?: number;
  group?: string;
  userFunc?: string;
  rrdType?: string;
}

export interface ProcessorInfo {
  index: string;
  descr: string;
  oid: string;
  currentUsage?: number;
  precision?: number;
  entPhysicalIndex?: number;
}

export interface MempoolInfo {
  index: string;
  descr: string;
  type: string;
  usedOid: string;
  totalOid: string;
  currentUsed?: number;
  currentTotal?: number;
  warnPercent?: number;
  entPhysicalIndex?: number;
}

export interface StorageInfo {
  index: string;
  descr: string;
  type: string;
  size: number;
  used: number;
  units: number;
  mountPoint?: string;
  fsType?: string;
  warnPercent?: number;
}

export interface TopologyInfo {
  protocol: 'lldp' | 'cdp' | 'fdp' | 'edp';
  localPort: number | string;
  localPortName: string;
  remoteChassisId?: string;
  remotePortId: string;
  remotePortDesc?: string;
  remoteHostname: string;
  remoteDevice: string;
  remoteCapabilities?: string;
  remotePlatform?: string;
  remoteVersion?: string;
  remoteAddress?: string;
  lastUpdated: Date;
}

export interface IDiscoveryService {
  /**
   * Performs full discovery on a device
   */
  discoverDevice(deviceId: string, modules?: string[]): Promise<DiscoverySession>;

  /**
   * Performs incremental discovery (only changed items)
   */
  incrementalDiscovery(deviceId: string): Promise<DiscoverySession>;

  /**
   * Gets discovery session status
   */
  getDiscoverySession(sessionId: string): Promise<DiscoverySession | null>;

  /**
   * Cancels running discovery session
   */
  cancelDiscovery(sessionId: string): Promise<boolean>;

  /**
   * Gets available discovery modules
   */
  getAvailableModules(): DiscoveryModule[];

  /**
   * Loads OS template for device
   */
  loadOSTemplate(os: string): Promise<OSTemplate | null>;

  /**
   * Detects OS for device
   */
  detectOS(device: SNMPDevice): Promise<{
    os: string;
    confidence: number;
    details: any;
  }>;
}