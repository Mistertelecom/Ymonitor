import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SNMPClientService } from './services/snmp-client.service';
import { SNMPCacheService } from './services/snmp-cache.service';
import { SNMPValidatorService } from './services/snmp-validator.service';
import { SNMPController } from './snmp.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    SNMPClientService,
    SNMPCacheService,
    SNMPValidatorService,
  ],
  controllers: [SNMPController],
  exports: [
    SNMPClientService,
    SNMPCacheService,
    SNMPValidatorService,
  ],
})
export class SNMPModule {}