import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from '../monitoring/monitoring.service';

export interface DashboardData {
  overview: OverviewStats;
  recentAlerts: RecentAlert[];
  topDevices: TopDevice[];
  systemStatus: SystemStatus;
  networkMetrics: NetworkMetrics;
  performanceData: PerformanceData;
  alertTrends: AlertTrend[];
  deviceHealth: DeviceHealth[];
}

export interface OverviewStats {
  devices: {
    total: number;
    online: number;
    offline: number;
    warning: number;
    availability: number;
  };
  alerts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    acknowledged: number;
  };
  network: {
    totalBandwidth: number;
    utilizationPercent: number;
    interfacesMonitored: number;
    errors: number;
  };
  users: {
    active: number;
    total: number;
    onlineNow: number;
  };
}

export interface RecentAlert {
  id: string;
  severity: string;
  title: string;
  message: string;
  deviceName: string;
  timestamp: Date;
  state: string;
}

export interface TopDevice {
  id: string;
  hostname: string;
  displayName: string;
  ip: string;
  status: string;
  alertCount: number;
  utilization: number;
  responseTime: number;
  uptime: number;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: number;
  diskUsage: number;
  servicesStatus: {
    database: boolean;
    redis: boolean;
    snmp: boolean;
    monitoring: boolean;
  };
}

export interface NetworkMetrics {
  totalBandwidth: number;
  inboundTraffic: number;
  outboundTraffic: number;
  packetsPerSecond: number;
  errorRate: number;
  topInterfaces: Array<{
    deviceName: string;
    interfaceName: string;
    utilization: number;
    speed: number;
    status: string;
  }>;
}

export interface PerformanceData {
  timestamp: Date;
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

export interface AlertTrend {
  timestamp: Date;
  critical: number;
  warning: number;
  info: number;
  resolved: number;
}

export interface DeviceHealth {
  deviceId: string;
  hostname: string;
  healthScore: number;
  status: string;
  lastSeen: Date;
  issues: string[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private monitoringService: MonitoringService,
  ) {}

  async getDashboardData(): Promise<DashboardData> {
    try {
      const [
        overview,
        recentAlerts,
        topDevices,
        systemStatus,
        networkMetrics,
        performanceData,
        alertTrends,
        deviceHealth,
      ] = await Promise.all([
        this.getOverviewStats(),
        this.getRecentAlerts(),
        this.getTopDevices(),
        this.getSystemStatus(),
        this.getNetworkMetrics(),
        this.getPerformanceData(),
        this.getAlertTrends(),
        this.getDeviceHealth(),
      ]);

      return {
        overview,
        recentAlerts,
        topDevices,
        systemStatus,
        networkMetrics,
        performanceData,
        alertTrends,
        deviceHealth,
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard data: ${error.message}`);
      throw error;
    }
  }

  private async getOverviewStats(): Promise<OverviewStats> {
    const [
      totalDevices,
      onlineDevices,
      offlineDevices,
      warningDevices,
      totalAlerts,
      criticalAlerts,
      warningAlerts,
      infoAlerts,
      acknowledgedAlerts,
      totalUsers,
      activeUsers,
    ] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 'UP' } }),
      this.prisma.device.count({ where: { status: 'DOWN' } }),
      this.prisma.device.count({ where: { status: 'WARNING' } }),
      this.prisma.alert.count({ where: { state: 'ACTIVE' } }),
      this.prisma.alert.count({ where: { state: 'ACTIVE', severity: 'CRITICAL' } }),
      this.prisma.alert.count({ where: { state: 'ACTIVE', severity: 'WARNING' } }),
      this.prisma.alert.count({ where: { state: 'ACTIVE', severity: 'INFO' } }),
      this.prisma.alert.count({ where: { state: 'ACKNOWLEDGED' } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    // Get network metrics
    const networkMetrics = await this.monitoringService.getSystemMetrics();
    const interfaceStats = await this.monitoringService.getTopInterfacesByUtilization(100);

    const interfacesMonitored = interfaceStats.length;
    const interfaceErrors = await this.monitoringService.getInterfaceErrorStats();

    return {
      devices: {
        total: totalDevices,
        online: onlineDevices,
        offline: offlineDevices,
        warning: warningDevices,
        availability: totalDevices > 0 ? (onlineDevices / totalDevices) * 100 : 0,
      },
      alerts: {
        total: totalAlerts,
        critical: criticalAlerts,
        warning: warningAlerts,
        info: infoAlerts,
        acknowledged: acknowledgedAlerts,
      },
      network: {
        totalBandwidth: networkMetrics.metrics.network.bandwidth?.capacity || 0,
        utilizationPercent: 0, // Would be calculated from interface utilization
        interfacesMonitored,
        errors: interfaceErrors.length,
      },
      users: {
        active: activeUsers,
        total: totalUsers,
        onlineNow: 0, // Would need session tracking
      },
    };
  }

  private async getRecentAlerts(): Promise<RecentAlert[]> {
    const alerts = await this.prisma.alert.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        device: {
          select: {
            hostname: true,
            displayName: true,
          },
        },
      },
    });

    return alerts.map(alert => ({
      id: alert.id,
      severity: alert.severity,
      title: alert.message, // Assuming message contains title
      message: alert.message,
      deviceName: alert.device?.displayName || alert.device?.hostname || 'Unknown',
      timestamp: alert.timestamp,
      state: alert.state,
    }));
  }

  private async getTopDevices(): Promise<TopDevice[]> {
    const devices = await this.prisma.device.findMany({
      take: 10,
      include: {
        _count: {
          select: { alerts: true },
        },
      },
      orderBy: {
        alerts: {
          _count: 'desc',
        },
      },
    });

    return devices.map(device => ({
      id: device.id,
      hostname: device.hostname,
      displayName: device.displayName || device.hostname,
      ip: device.ip,
      status: device.status,
      alertCount: device._count.alerts,
      utilization: 0, // Would be calculated from interface monitoring
      responseTime: device.pingTime || 0,
      uptime: device.uptime ? Number(device.uptime) : 0,
    }));
  }

  private async getSystemStatus(): Promise<SystemStatus> {
    // Check system health
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    // Simple health checks
    const criticalAlerts = await this.prisma.alert.count({
      where: { state: 'ACTIVE', severity: 'CRITICAL' },
    });
    
    const offlineDevices = await this.prisma.device.count({
      where: { status: 'DOWN' },
    });

    if (criticalAlerts > 10 || offlineDevices > 5) {
      status = 'critical';
    } else if (criticalAlerts > 5 || offlineDevices > 2) {
      status = 'degraded';
    }

    return {
      status,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: 0, // Would need system monitoring
      diskUsage: 0, // Would need disk monitoring
      servicesStatus: {
        database: true, // Would check database connection
        redis: true,    // Would check Redis connection
        snmp: true,     // Would check SNMP service
        monitoring: true, // Would check monitoring service
      },
    };
  }

  private async getNetworkMetrics(): Promise<NetworkMetrics> {
    const systemMetrics = await this.monitoringService.getSystemMetrics();
    const topInterfaces = await this.monitoringService.getTopInterfacesByUtilization(5);

    return {
      totalBandwidth: systemMetrics.metrics.network.bandwidth?.capacity || 0,
      inboundTraffic: systemMetrics.metrics.network.bandwidth?.inbound || 0,
      outboundTraffic: systemMetrics.metrics.network.bandwidth?.outbound || 0,
      packetsPerSecond: 0, // Would be calculated from interface data
      errorRate: 0, // Would be calculated from interface errors
      topInterfaces: topInterfaces.map(iface => ({
        deviceName: iface.deviceName,
        interfaceName: iface.portName,
        utilization: iface.utilization,
        speed: iface.speed ? Number(iface.speed) : 0,
        status: iface.status,
      })),
    };
  }

  private async getPerformanceData(): Promise<PerformanceData> {
    // This would typically come from time-series data
    // For now, return current snapshot
    return {
      timestamp: new Date(),
      responseTime: 0, // Average response time
      throughput: 0,   // Requests per second
      errorRate: 0,    // Error percentage
      availability: 0, // Availability percentage
    };
  }

  private async getAlertTrends(): Promise<AlertTrend[]> {
    // Get alert trends for the last 24 hours
    const trends: AlertTrend[] = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      const startTime = new Date(timestamp.getTime() - 30 * 60 * 1000);
      const endTime = new Date(timestamp.getTime() + 30 * 60 * 1000);

      const [critical, warning, info, resolved] = await Promise.all([
        this.prisma.alert.count({
          where: {
            timestamp: { gte: startTime, lte: endTime },
            severity: 'CRITICAL',
          },
        }),
        this.prisma.alert.count({
          where: {
            timestamp: { gte: startTime, lte: endTime },
            severity: 'WARNING',
          },
        }),
        this.prisma.alert.count({
          where: {
            timestamp: { gte: startTime, lte: endTime },
            severity: 'INFO',
          },
        }),
        this.prisma.alert.count({
          where: {
            timestamp: { gte: startTime, lte: endTime },
            state: 'RESOLVED',
          },
        }),
      ]);

      trends.push({
        timestamp,
        critical,
        warning,
        info,
        resolved,
      });
    }

    return trends;
  }

  private async getDeviceHealth(): Promise<DeviceHealth[]> {
    const devices = await this.prisma.device.findMany({
      take: 20,
      include: {
        _count: {
          select: { alerts: true },
        },
      },
      orderBy: { lastPolled: 'desc' },
    });

    return devices.map(device => {
      // Calculate health score based on status and alerts
      let healthScore = 100;
      
      if (device.status === 'DOWN') {
        healthScore = 0;
      } else if (device.status === 'WARNING') {
        healthScore = 50;
      } else if (device._count.alerts > 0) {
        healthScore = Math.max(20, 100 - (device._count.alerts * 10));
      }

      const issues: string[] = [];
      if (device.status === 'DOWN') {
        issues.push('Device is offline');
      }
      if (device._count.alerts > 0) {
        issues.push(`${device._count.alerts} active alerts`);
      }
      if (device.lastPolled && new Date().getTime() - device.lastPolled.getTime() > 30 * 60 * 1000) {
        issues.push('Not polled recently');
      }

      return {
        deviceId: device.id,
        hostname: device.hostname,
        healthScore,
        status: device.status,
        lastSeen: device.lastPolled || device.createdAt,
        issues,
      };
    });
  }

  async getChartData(type: string, period: string = '24h') {
    switch (type) {
      case 'device-status':
        return this.getDeviceStatusChart(period);
      case 'alert-trends':
        return this.getAlertTrends();
      case 'network-utilization':
        return this.getNetworkUtilizationChart(period);
      case 'top-interfaces':
        return this.getTopInterfacesChart();
      default:
        throw new Error(`Unknown chart type: ${type}`);
    }
  }

  private async getDeviceStatusChart(period: string) {
    const [up, down, warning] = await Promise.all([
      this.prisma.device.count({ where: { status: 'UP' } }),
      this.prisma.device.count({ where: { status: 'DOWN' } }),
      this.prisma.device.count({ where: { status: 'WARNING' } }),
    ]);

    return {
      labels: ['Up', 'Down', 'Warning'],
      datasets: [{
        data: [up, down, warning],
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
      }],
    };
  }

  private async getNetworkUtilizationChart(period: string) {
    // This would fetch historical data from time-series database
    // For now, return mock data
    const hours = period === '24h' ? 24 : 7 * 24;
    const data = [];
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
      data.push({
        timestamp,
        utilization: Math.random() * 100,
      });
    }

    return {
      labels: data.map(d => d.timestamp),
      datasets: [{
        label: 'Network Utilization %',
        data: data.map(d => d.utilization),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      }],
    };
  }

  private async getTopInterfacesChart() {
    const interfaces = await this.monitoringService.getTopInterfacesByUtilization(10);
    
    return {
      labels: interfaces.map(iface => `${iface.deviceName} - ${iface.portName}`),
      datasets: [{
        label: 'Utilization %',
        data: interfaces.map(iface => iface.utilization),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
      }],
    };
  }
}