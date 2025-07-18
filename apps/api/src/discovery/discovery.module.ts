// Discovery Module for Y Monitor
// NestJS module that provides device discovery functionality

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SNMPModule } from '../snmp/snmp.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './services/discovery.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SNMPModule,
  ],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}