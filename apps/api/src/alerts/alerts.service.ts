import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.alert.findMany({
      include: {
        rule: true,
        device: {
          select: {
            id: true,
            hostname: true,
            displayName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async findActive() {
    return this.prisma.alert.findMany({
      where: { state: 'ACTIVE' },
      include: {
        rule: true,
        device: {
          select: {
            id: true,
            hostname: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        { severity: 'desc' },
        { timestamp: 'desc' },
      ],
    });
  }

  async getStats() {
    const [total, active, critical, warning] = await Promise.all([
      this.prisma.alert.count(),
      this.prisma.alert.count({ where: { state: 'ACTIVE' } }),
      this.prisma.alert.count({
        where: { state: 'ACTIVE', severity: 'CRITICAL' },
      }),
      this.prisma.alert.count({
        where: { state: 'ACTIVE', severity: 'WARNING' },
      }),
    ]);

    return {
      total,
      active,
      critical,
      warning,
      resolved: total - active,
    };
  }

  async acknowledge(id: string, userId: string, note?: string) {
    return this.prisma.alert.update({
      where: { id },
      data: {
        state: 'ACKNOWLEDGED',
        ackTime: new Date(),
        ackBy: userId,
        note,
      },
    });
  }

  async resolve(id: string) {
    return this.prisma.alert.update({
      where: { id },
      data: {
        state: 'RESOLVED',
      },
    });
  }
}