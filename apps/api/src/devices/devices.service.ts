import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.device.findMany({
      include: {
        location: true,
        _count: {
          select: {
            ports: true,
            sensors: true,
            alerts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.device.findUnique({
      where: { id },
      include: {
        location: true,
        ports: true,
        sensors: true,
        services: true,
        alerts: {
          where: { state: 'ACTIVE' },
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });
  }

  async getStats() {
    const [total, up, down, warning] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 'UP' } }),
      this.prisma.device.count({ where: { status: 'DOWN' } }),
      this.prisma.device.count({ where: { status: 'WARNING' } }),
    ]);

    return {
      total,
      up,
      down,
      warning,
      unknown: total - up - down - warning,
    };
  }

  // TODO: Implement device discovery, SNMP polling, etc.
}