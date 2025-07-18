import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getAvailabilityReport(startDate: Date, endDate: Date) {
    // TODO: Implement availability reporting
    return {
      period: { startDate, endDate },
      devices: [],
      summary: {
        averageUptime: 99.5,
        totalDowntime: 0,
        incidents: 0,
      },
    };
  }

  async getPerformanceReport(deviceId?: string) {
    // TODO: Implement performance reporting
    return {
      bandwidth: {
        inbound: [],
        outbound: [],
      },
      latency: [],
      packetLoss: [],
    };
  }

  async getAlertReport(startDate: Date, endDate: Date) {
    const alerts = await this.prisma.alert.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        device: {
          select: {
            hostname: true,
            displayName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    const summary = await this.prisma.alert.groupBy({
      by: ['severity'],
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
    });

    return {
      period: { startDate, endDate },
      alerts,
      summary,
      total: alerts.length,
    };
  }
}