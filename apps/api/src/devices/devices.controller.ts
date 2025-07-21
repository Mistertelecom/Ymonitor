import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { DeviceSNMPService } from '../snmp/services/device-snmp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceSnmpService: DeviceSNMPService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all devices with SNMP data' })
  @ApiResponse({ status: 200, description: 'Devices retrieved successfully' })
  findAll() {
    return this.deviceSnmpService.getAllDevicesWithPorts();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get device statistics' })
  @ApiResponse({ status: 200, description: 'Device statistics retrieved' })
  getStats() {
    return this.deviceSnmpService.getDeviceStats();
  }

  @Post('test-ubiquiti')
  @ApiOperation({ summary: 'Test connection to Ubiquiti device' })
  @ApiResponse({ status: 200, description: 'Device test completed' })
  testUbiquiti() {
    return this.deviceSnmpService.testUbiquitiDevice();
  }

  @Post('add-ubiquiti')
  @ApiOperation({ summary: 'Add Ubiquiti test device' })
  @ApiResponse({ status: 201, description: 'Device added successfully' })
  addUbiquiti() {
    return this.deviceSnmpService.addUbiquitiDevice();
  }

  @Post(':id/poll')
  @ApiOperation({ summary: 'Poll device via SNMP' })
  @ApiResponse({ status: 200, description: 'Device polled successfully' })
  pollDevice(@Param('id') id: string) {
    return this.deviceSnmpService.pollDevice(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({ status: 200, description: 'Device retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id);
  }
}