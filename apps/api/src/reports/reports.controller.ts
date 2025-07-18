import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Get availability report' })
  @ApiResponse({ status: 200, description: 'Availability report generated' })
  getAvailabilityReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getAvailabilityReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance report' })
  @ApiResponse({ status: 200, description: 'Performance report generated' })
  getPerformanceReport(@Query('deviceId') deviceId?: string) {
    return this.reportsService.getPerformanceReport(deviceId);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get alerts report' })
  @ApiResponse({ status: 200, description: 'Alerts report generated' })
  getAlertReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getAlertReport(
      new Date(startDate),
      new Date(endDate),
    );
  }
}