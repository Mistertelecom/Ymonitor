// Discovery Service for Y Monitor
// Implements device discovery similar to LibreNMS

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { 
  IDiscoveryService, 
  DiscoverySession, 
  DiscoveryModule, 
  DeviceInfo, 
  OSTemplate,
  DiscoveryResult 
} from '../interfaces/discovery.interface';
import { SNMPDevice, SNMP_OIDS } from '../../snmp/types/snmp.types';
import { v4 as uuidv4 } from 'uuid';

// Import discovery modules
import { CoreDiscoveryModule } from '../modules/core-discovery.module';
import { PortsDiscoveryModule } from '../modules/ports-discovery.module';
import { SensorsDiscoveryModule } from '../modules/sensors-discovery.module';
import { EntityDiscoveryModule } from '../modules/entity-discovery.module';
import { TopologyDiscoveryModule } from '../modules/topology-discovery.module';

@Injectable()
export class DiscoveryService implements IDiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly sessions = new Map<string, DiscoverySession>();
  private readonly modules: DiscoveryModule[];
  private readonly osTemplates = new Map<string, OSTemplate>();

  constructor(
    private prisma: PrismaService,
    private snmpClient: SNMPClientService,
    private configService: ConfigService,
  ) {
    // Initialize discovery modules
    this.modules = [
      new CoreDiscoveryModule(this.snmpClient, this.prisma),
      new PortsDiscoveryModule(this.snmpClient, this.prisma),
      new SensorsDiscoveryModule(this.snmpClient, this.prisma),
      new EntityDiscoveryModule(this.snmpClient, this.prisma),
      new TopologyDiscoveryModule(this.snmpClient, this.prisma),
    ].sort((a, b) => a.priority - b.priority);

    this.loadOSTemplates();
  }

  async discoverDevice(deviceId: string, modules?: string[]): Promise<DiscoverySession> {
    const session: DiscoverySession = {
      id: uuidv4(),
      deviceId,
      type: 'full',
      modules: modules || this.getEnabledModuleNames(),
      status: 'running',
      startTime: new Date(),
      results: [],
      errors: [],
      progress: 0,
    };

    this.sessions.set(session.id, session);

    try {
      // Get device information
      const device = await this.getDeviceInfo(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // Test SNMP connectivity
      const connectivity = await this.snmpClient.testConnection(device.snmpDevice);
      if (!connectivity) {
        throw new Error('SNMP connectivity test failed');
      }

      // Detect OS if not already known
      if (!device.os) {
        const osDetection = await this.detectOS(device.snmpDevice);
        device.os = osDetection.os;
        
        await this.prisma.device.update({
          where: { id: deviceId },
          data: { os: osDetection.os },
        });
      }

      // Load OS template
      const osTemplate = await this.loadOSTemplate(device.os);
      const templates = osTemplate ? [osTemplate] : [];

      // Execute discovery modules
      const enabledModules = this.modules.filter(
        module => 
          module.enabled && 
          session.modules.includes(module.name) &&
          module.canDiscover(device)
      );

      let completedModules = 0;
      
      for (const module of enabledModules) {
        try {
          session.currentModule = module.name;
          this.logger.log(`Running discovery module: ${module.name} for device ${device.hostname}`);

          const result = await module.discover(device, templates);
          session.results.push(result);

          completedModules++;
          session.progress = Math.round((completedModules / enabledModules.length) * 100);

          this.logger.log(`Completed ${module.name}: discovered ${result.discovered.length} items`);
        } catch (error) {
          this.logger.error(`Discovery module ${module.name} failed: ${error.message}`);
          session.errors.push(`${module.name}: ${error.message}`);
        }
      }

      // Update device last discovered timestamp
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { lastDiscovered: new Date() },
      });

      session.status = 'completed';
      session.progress = 100;
    } catch (error) {
      this.logger.error(`Discovery failed for device ${deviceId}: ${error.message}`);
      session.status = 'failed';
      session.errors.push(error.message);
    } finally {
      session.endTime = new Date();
      session.currentModule = undefined;
    }

    return session;
  }

  async incrementalDiscovery(deviceId: string): Promise<DiscoverySession> {
    // For incremental discovery, only run specific modules that track changes
    const incrementalModules = ['sensors', 'ports', 'topology'];
    
    const session = await this.discoverDevice(deviceId, incrementalModules);
    session.type = 'incremental';
    
    return session;
  }

  async getDiscoverySession(sessionId: string): Promise<DiscoverySession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async cancelDiscovery(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'running') {
      session.status = 'cancelled';
      session.endTime = new Date();
      return true;
    }
    return false;
  }

  getAvailableModules(): DiscoveryModule[] {
    return [...this.modules];
  }

  async loadOSTemplate(os: string): Promise<OSTemplate | null> {
    if (this.osTemplates.has(os)) {
      return this.osTemplates.get(os)!;
    }

    try {
      // In a real implementation, this would load from YAML files
      // For now, return a basic template
      const template: OSTemplate = {
        os,
        text: os.charAt(0).toUpperCase() + os.slice(1),
        type: 'network',
        detection: {
          sysObjectID: [],
          sysDescr: [],
        },
        discovery: {
          sensors: {},
          ports: { enabled: true },
        },
      };

      this.osTemplates.set(os, template);
      return template;
    } catch (error) {
      this.logger.warn(`Failed to load OS template for ${os}: ${error.message}`);
      return null;
    }
  }

  async detectOS(snmpDevice: SNMPDevice): Promise<{ os: string; confidence: number; details: any }> {
    try {
      // Get system information for OS detection
      const systemInfo = await this.snmpClient.getSystemInfo(snmpDevice);
      
      if (!systemInfo.sysDescr && !systemInfo.sysObjectID) {
        return {
          os: 'generic',
          confidence: 0,
          details: { reason: 'No system information available' },
        };
      }

      // Basic OS detection logic (simplified from LibreNMS)
      const sysDescr = systemInfo.sysDescr?.toLowerCase() || '';
      const sysObjectID = systemInfo.sysObjectID || '';

      // Cisco detection
      if (sysObjectID.startsWith('1.3.6.1.4.1.9.') || sysDescr.includes('cisco')) {
        if (sysDescr.includes('ios')) {
          return { os: 'cisco-ios', confidence: 90, details: systemInfo };
        } else if (sysDescr.includes('nx-os')) {
          return { os: 'cisco-nxos', confidence: 90, details: systemInfo };
        } else if (sysDescr.includes('asa')) {
          return { os: 'cisco-asa', confidence: 90, details: systemInfo };
        }
        return { os: 'cisco', confidence: 80, details: systemInfo };
      }

      // Juniper detection
      if (sysObjectID.startsWith('1.3.6.1.4.1.2636.') || sysDescr.includes('juniper')) {
        return { os: 'junos', confidence: 90, details: systemInfo };
      }

      // HP detection
      if (sysObjectID.startsWith('1.3.6.1.4.1.11.') || sysDescr.includes('hp ')) {
        return { os: 'hp-procurve', confidence: 80, details: systemInfo };
      }

      // Arista detection
      if (sysObjectID.startsWith('1.3.6.1.4.1.30065.') || sysDescr.includes('arista')) {
        return { os: 'arista-eos', confidence: 90, details: systemInfo };
      }

      // Linux detection
      if (sysDescr.includes('linux')) {
        return { os: 'linux', confidence: 70, details: systemInfo };
      }

      // Windows detection
      if (sysDescr.includes('windows') || sysDescr.includes('microsoft')) {
        return { os: 'windows', confidence: 70, details: systemInfo };
      }

      // VMware detection
      if (sysDescr.includes('vmware') || sysDescr.includes('esxi')) {
        return { os: 'vmware-esxi', confidence: 80, details: systemInfo };
      }

      // Default to generic
      return {
        os: 'generic',
        confidence: 50,
        details: systemInfo,
      };
    } catch (error) {
      this.logger.error(`OS detection failed: ${error.message}`);
      return {
        os: 'generic',
        confidence: 0,
        details: { error: error.message },
      };
    }
  }

  async scheduleDiscovery(deviceId: string, type: 'full' | 'incremental' = 'incremental'): Promise<string> {
    // This would be called by a job scheduler
    try {
      const session = type === 'full' 
        ? await this.discoverDevice(deviceId)
        : await this.incrementalDiscovery(deviceId);

      this.logger.log(`Scheduled ${type} discovery for device ${deviceId}, session: ${session.id}`);
      return session.id;
    } catch (error) {
      this.logger.error(`Failed to schedule discovery for device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  async getDiscoveryHistory(deviceId: string, limit = 10): Promise<DiscoverySession[]> {
    // In a real implementation, this would come from the database
    const allSessions = Array.from(this.sessions.values())
      .filter(session => session.deviceId === deviceId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);

    return allSessions;
  }

  async getDiscoveryStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedToday: number;
    failureRate: number;
  }> {
    const sessions = Array.from(this.sessions.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'running').length;
    const completedToday = sessions.filter(s => 
      s.startTime >= today && s.status === 'completed'
    ).length;
    const failedSessions = sessions.filter(s => s.status === 'failed').length;
    const failureRate = totalSessions > 0 ? (failedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      activeSessions,
      completedToday,
      failureRate,
    };
  }

  private async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return null;
    }

    const snmpDevice: SNMPDevice = {
      hostname: device.ip,
      port: device.snmpPort || 161,
      timeout: device.snmpTimeout || 5000,
      retries: device.snmpRetries || 3,
      transport: 'udp4',
      version: device.snmpVersion as any,
      community: device.snmpCommunity,
      username: device.snmpUsername,
      authLevel: device.snmpAuthAlgo as any,
      authProtocol: device.snmpAuthAlgo as any,
      authPassword: device.snmpPassword,
      privProtocol: device.snmpCryptoAlgo as any,
      privPassword: device.snmpPassword,
      contextName: '',
    };

    return {
      id: device.id,
      hostname: device.hostname,
      snmpDevice,
      os: device.os,
      sysDescr: device.sysDescr,
      sysName: device.sysName,
      sysLocation: device.sysLocation,
      sysContact: device.sysContact,
      uptime: device.uptime ? Number(device.uptime) : undefined,
      lastDiscovered: device.lastDiscovered,
    };
  }

  private getEnabledModuleNames(): string[] {
    return this.modules
      .filter(module => module.enabled)
      .map(module => module.name);
  }

  private async loadOSTemplates(): Promise<void> {
    // In a real implementation, this would load from YAML files
    // For now, we'll create basic templates
    const basicTemplates = [
      'generic', 'cisco-ios', 'cisco-nxos', 'junos', 'linux', 'windows',
      'hp-procurve', 'arista-eos', 'vmware-esxi', 'panos'
    ];

    for (const os of basicTemplates) {
      this.osTemplates.set(os, {
        os,
        text: os.charAt(0).toUpperCase() + os.slice(1),
        type: 'network',
        detection: { sysObjectID: [], sysDescr: [] },
        discovery: { sensors: {}, ports: { enabled: true } },
      });
    }
  }

  private cleanupOldSessions(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.endTime && (now - session.endTime.getTime()) > maxAge) {
        this.sessions.delete(sessionId);
      }
    }
  }
}