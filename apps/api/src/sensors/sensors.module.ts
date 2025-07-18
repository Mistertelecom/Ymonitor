import { Module } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';
import { SNMPModule } from '../snmp/snmp.module';
import { InfluxDBModule } from '../influxdb/influxdb.module';

@Module({
  imports: [SNMPModule, InfluxDBModule],
  providers: [SensorsService],
  controllers: [SensorsController],
  exports: [SensorsService],
})
export class SensorsModule {}