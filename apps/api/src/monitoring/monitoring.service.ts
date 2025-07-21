import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterfaceMonitoringService } from './services/interface-monitoring.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private prisma: PrismaService,
    private interfaceMonitoring: InterfaceMonitoringService,
  ) {}

  async getSystemMetrics() {
    // TODO: Implement real-time metrics collection
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        devices: await this.getDeviceMetrics(),
        network: await this.getNetworkMetrics(),
        alerts: await this.getAlertMetrics(),
      },
    };
  }

  private async getDeviceMetrics() {
    const [total, online, offline] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 'UP' } }),
      this.prisma.device.count({ where: { status: 'DOWN' } }),
    ]);

    return {
      total,
      online,
      offline,
      availability: total > 0 ? (online / total) * 100 : 0,
    };
  }

  private async getNetworkMetrics() {
    // Get real network metrics from interface monitoring
    const interfaces = await this.prisma.port.findMany({
      where: {
        disabled: false,
        device: {
          disabled: false,
          status: 'UP',
        },
      },
      select: {
        ifInOctets: true,
        ifOutOctets: true,
        ifSpeed: true,
        lastPolled: true,
      },
    });

    const totalInbound = interfaces.reduce((sum, iface) => 
      sum + (iface.ifInOctets ? Number(iface.ifInOctets) : 0), 0
    );
    
    const totalOutbound = interfaces.reduce((sum, iface) => 
      sum + (iface.ifOutOctets ? Number(iface.ifOutOctets) : 0), 0
    );

    const totalCapacity = interfaces.reduce((sum, iface) => 
      sum + (iface.ifSpeed ? Number(iface.ifSpeed) : 0), 0
    );

    return {
      bandwidth: {
        inbound: totalInbound,
        outbound: totalOutbound,
        capacity: totalCapacity,
      },
      interfaces: {
        total: interfaces.length,
        monitored: interfaces.filter(i => i.lastPolled).length,
      },
    };
  }

  private async getAlertMetrics() {
    const [total, critical, warning] = await Promise.all([
      this.prisma.alert.count({ where: { state: 'open' } }),
      this.prisma.alert.count({
        where: { state: 'open', severity: 'critical' },
      }),
      this.prisma.alert.count({
        where: { state: 'open', severity: 'warning' },
      }),
    ]);

    return {
      total,
      critical,
      warning,
      info: total - critical - warning,
    };
  }

  async getInterfaceStats(deviceId: string, ifIndex: number) {
    return this.interfaceMonitoring.getInterfaceStats(deviceId, ifIndex);
  }

  async getInterfaceHistory(deviceId: string, ifIndex: number, hours = 24) {
    return this.interfaceMonitoring.getInterfaceHistory(deviceId, ifIndex, hours);
  }

  async pollDeviceInterfaces(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        ports: {
          where: { disabled: false },
        },
      },
    });

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return this.interfaceMonitoring.pollDeviceInterfaces(device);
  }

  async getTopInterfacesByUtilization(limit = 10) {
    // Get interfaces with highest utilization
    const interfaces = await this.prisma.port.findMany({
      where: {
        disabled: false,
        device: {
          disabled: false,
          status: 'UP',
        },
        lastPolled: {
          gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
        },
      },
      include: {
        device: {
          select: {
            id: true,
            hostname: true,
            ip: true,
          },
        },
      },
      orderBy: {
        lastPolled: 'desc',
      },
      take: limit,
    });

    return interfaces.map(iface => ({
      deviceId: iface.device.id,
      deviceName: iface.device.hostname,
      deviceIp: iface.device.ip,
      portId: iface.id,
      portName: iface.ifName || iface.ifDescr,
      ifIndex: iface.ifIndex,
      utilization: 0, // This would be calculated from monitoring service
      inOctets: iface.ifInOctets,
      outOctets: iface.ifOutOctets,
      speed: iface.ifSpeed,
      status: iface.ifOperStatus,
      lastPolled: iface.lastPolled,
    }));
  }

  async getInterfaceErrorStats(deviceId?: string) {
    const whereClause: any = {
      disabled: false,
      device: {
        disabled: false,
      },
    };

    if (deviceId) {
      whereClause.deviceId = deviceId;
    }

    const interfaces = await this.prisma.port.findMany({
      where: whereClause,
      select: {
        id: true,
        ifIndex: true,
        ifName: true,
        ifDescr: true,
        ifInErrors: true,
        ifOutErrors: true,
        ifInDiscards: true,
        ifOutDiscards: true,
        ifInUcastPkts: true,
        ifOutUcastPkts: true,
        device: {
          select: {
            id: true,
            hostname: true,
          },
        },
      },
    });

    return interfaces.map(iface => {
      const totalErrors = (iface.ifInErrors || BigInt(0)) + (iface.ifOutErrors || BigInt(0));
      const totalDiscards = (iface.ifInDiscards || BigInt(0)) + (iface.ifOutDiscards || BigInt(0));
      const totalPackets = (iface.ifInUcastPkts || BigInt(0)) + (iface.ifOutUcastPkts || BigInt(0));

      const errorRate = totalPackets > 0 ? 
        (Number(totalErrors) / Number(totalPackets)) * 100 : 0;
      
      const discardRate = totalPackets > 0 ? 
        (Number(totalDiscards) / Number(totalPackets)) * 100 : 0;

      return {
        deviceId: iface.device.id,
        deviceName: iface.device.hostname,
        portId: iface.id,
        portName: iface.ifName || iface.ifDescr,
        ifIndex: iface.ifIndex,
        totalErrors: Number(totalErrors),
        totalDiscards: Number(totalDiscards),
        totalPackets: Number(totalPackets),
        errorRate,
        discardRate,
      };
    }).filter(stats => stats.errorRate > 0 || stats.discardRate > 0);
  }

  async getInterfaceAvailability(deviceId?: string, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const whereClause: any = {
      disabled: false,
      device: {
        disabled: false,
      },
      lastPolled: {
        gte: cutoff,
      },
    };

    if (deviceId) {
      whereClause.deviceId = deviceId;
    }

    const interfaces = await this.prisma.port.findMany({
      where: whereClause,
      select: {
        id: true,
        ifIndex: true,
        ifName: true,
        ifDescr: true,
        ifOperStatus: true,
        ifAdminStatus: true,
        lastPolled: true,
        device: {
          select: {
            id: true,
            hostname: true,
          },
        },
      },
    });

    return interfaces.map(iface => ({
      deviceId: iface.device.id,
      deviceName: iface.device.hostname,
      portId: iface.id,
      portName: iface.ifName || iface.ifDescr,
      ifIndex: iface.ifIndex,
      adminStatus: iface.ifAdminStatus,
      operStatus: iface.ifOperStatus,
      isUp: iface.ifOperStatus === 'up',
      lastPolled: iface.lastPolled,
    }));
  }
}