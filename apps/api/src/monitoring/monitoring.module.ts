import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { InterfaceMonitoringService } from './services/interface-monitoring.service';
import { SNMPModule } from '../snmp/snmp.module';
import { InfluxDBModule } from '../influxdb/influxdb.module';

@Module({
  imports: [SNMPModule, InfluxDBModule],
  providers: [MonitoringService, InterfaceMonitoringService],
  controllers: [MonitoringController],
  exports: [MonitoringService, InterfaceMonitoringService],
})
export class MonitoringModule {}