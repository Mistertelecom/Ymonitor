import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SNMPClientService } from './services/snmp-client.service';
import { SNMPCacheService } from './services/snmp-cache.service';
import { SNMPValidatorService } from './services/snmp-validator.service';
import { DeviceSNMPService } from './services/device-snmp.service';
import { SNMPController } from './snmp.controller';
import { ISNMPCache } from './interfaces/snmp-client.interface';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    SNMPClientService,
    SNMPCacheService,
    SNMPValidatorService,
    DeviceSNMPService,
    {
      provide: 'ISNMPCache',
      useClass: SNMPCacheService,
    },
  ],
  controllers: [SNMPController],
  exports: [
    SNMPClientService,
    SNMPCacheService,
    SNMPValidatorService,
    DeviceSNMPService,
  ],
})
export class SNMPModule {}