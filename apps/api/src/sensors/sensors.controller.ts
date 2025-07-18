import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SensorsService } from './sensors.service';

@ApiTags('sensors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sensors')
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get('device/:deviceId')
  @ApiOperation({ summary: 'Get sensors for a specific device' })
  @ApiResponse({ status: 200, description: 'List of device sensors' })
  async getDeviceSensors(@Param('deviceId') deviceId: string) {
    return this.sensorsService.getDeviceSensors(deviceId);
  }

  @Get('history/:deviceId/:sensorId')
  @ApiOperation({ summary: 'Get sensor reading history' })
  @ApiResponse({ status: 200, description: 'Sensor reading history' })
  async getSensorHistory(
    @Param('deviceId') deviceId: string,
    @Param('sensorId') sensorId: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNumber = hours ? parseInt(hours, 10) : 24;
    return this.sensorsService.getSensorHistory(deviceId, sensorId, hoursNumber);
  }

  @Post('discover/:deviceId')
  @ApiOperation({ summary: 'Discover sensors on a device' })
  @ApiResponse({ status: 200, description: 'Sensor discovery initiated' })
  async discoverSensors(@Param('deviceId') deviceId: string) {
    await this.sensorsService.discoverSensors(deviceId);
    return { message: 'Sensor discovery initiated' };
  }
}