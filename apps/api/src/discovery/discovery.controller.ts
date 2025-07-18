// Discovery Controller for Y Monitor
// REST API for device discovery operations

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DiscoveryService } from './services/discovery.service';
import { DiscoverySession, DiscoveryModule } from './interfaces/discovery.interface';

@ApiTags('Discovery')
@Controller('discovery')
export class DiscoveryController {
  private readonly logger = new Logger(DiscoveryController.name);

  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('device/:deviceId/discover')
  @ApiOperation({ summary: 'Start full discovery for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID to discover' })
  @ApiResponse({ status: 201, description: 'Discovery session started' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async discoverDevice(
    @Param('deviceId') deviceId: string,
    @Body() body: { modules?: string[] } = {},
  ): Promise<{ sessionId: string; status: string }> {
    try {
      const session = await this.discoveryService.discoverDevice(deviceId, body.modules);
      
      this.logger.log(`Started discovery session ${session.id} for device ${deviceId}`);
      
      return {
        sessionId: session.id,
        status: session.status,
      };
    } catch (error) {
      this.logger.error(`Failed to start discovery for device ${deviceId}: ${error.message}`);
      throw new HttpException(
        `Discovery failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('device/:deviceId/discover/incremental')
  @ApiOperation({ summary: 'Start incremental discovery for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID to discover' })
  @ApiResponse({ status: 201, description: 'Incremental discovery session started' })
  async incrementalDiscovery(
    @Param('deviceId') deviceId: string,
  ): Promise<{ sessionId: string; status: string }> {
    try {
      const session = await this.discoveryService.incrementalDiscovery(deviceId);
      
      this.logger.log(`Started incremental discovery session ${session.id} for device ${deviceId}`);
      
      return {
        sessionId: session.id,
        status: session.status,
      };
    } catch (error) {
      this.logger.error(`Failed to start incremental discovery for device ${deviceId}: ${error.message}`);
      throw new HttpException(
        `Incremental discovery failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get discovery session status' })
  @ApiParam({ name: 'sessionId', description: 'Discovery session ID' })
  @ApiResponse({ status: 200, description: 'Discovery session details' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getDiscoverySession(
    @Param('sessionId') sessionId: string,
  ): Promise<DiscoverySession> {
    const session = await this.discoveryService.getDiscoverySession(sessionId);
    
    if (!session) {
      throw new HttpException('Discovery session not found', HttpStatus.NOT_FOUND);
    }
    
    return session;
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Cancel running discovery session' })
  @ApiParam({ name: 'sessionId', description: 'Discovery session ID' })
  @ApiResponse({ status: 200, description: 'Session cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Session not found or not cancellable' })
  async cancelDiscovery(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean; message: string }> {
    const cancelled = await this.discoveryService.cancelDiscovery(sessionId);
    
    if (!cancelled) {
      throw new HttpException(
        'Session not found or cannot be cancelled',
        HttpStatus.NOT_FOUND,
      );
    }
    
    this.logger.log(`Cancelled discovery session ${sessionId}`);
    
    return {
      success: true,
      message: 'Discovery session cancelled successfully',
    };
  }

  @Get('modules')
  @ApiOperation({ summary: 'Get available discovery modules' })
  @ApiResponse({ status: 200, description: 'List of available discovery modules' })
  getAvailableModules(): DiscoveryModule[] {
    return this.discoveryService.getAvailableModules();
  }

  @Post('device/:deviceId/detect-os')
  @ApiOperation({ summary: 'Detect operating system for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'OS detection result' })
  async detectOS(
    @Param('deviceId') deviceId: string,
  ): Promise<{
    os: string;
    confidence: number;
    details: any;
  }> {
    try {
      // First get device info to extract SNMP device configuration
      const deviceInfo = await this.getDeviceInfo(deviceId);
      const result = await this.discoveryService.detectOS(deviceInfo.snmpDevice);
      
      this.logger.log(`OS detection for device ${deviceId}: ${result.os} (${result.confidence}% confidence)`);
      
      return result;
    } catch (error) {
      this.logger.error(`OS detection failed for device ${deviceId}: ${error.message}`);
      throw new HttpException(
        `OS detection failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('device/:deviceId/history')
  @ApiOperation({ summary: 'Get discovery history for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of sessions to return' })
  @ApiResponse({ status: 200, description: 'Discovery history' })
  async getDiscoveryHistory(
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: number,
  ): Promise<DiscoverySession[]> {
    try {
      const history = await this.discoveryService.getDiscoveryHistory(
        deviceId,
        limit ? parseInt(limit.toString()) : undefined,
      );
      
      return history;
    } catch (error) {
      this.logger.error(`Failed to get discovery history for device ${deviceId}: ${error.message}`);
      throw new HttpException(
        `Failed to get discovery history: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('device/:deviceId/schedule')
  @ApiOperation({ summary: 'Schedule discovery for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 201, description: 'Discovery scheduled successfully' })
  async scheduleDiscovery(
    @Param('deviceId') deviceId: string,
    @Body() body: { type?: 'full' | 'incremental' } = {},
  ): Promise<{ sessionId: string; message: string }> {
    try {
      const sessionId = await this.discoveryService.scheduleDiscovery(
        deviceId,
        body.type || 'incremental',
      );
      
      this.logger.log(`Scheduled ${body.type || 'incremental'} discovery for device ${deviceId}`);
      
      return {
        sessionId,
        message: `${body.type || 'incremental'} discovery scheduled successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to schedule discovery for device ${deviceId}: ${error.message}`);
      throw new HttpException(
        `Failed to schedule discovery: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get discovery statistics' })
  @ApiResponse({ status: 200, description: 'Discovery statistics' })
  async getDiscoveryStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedToday: number;
    failureRate: number;
  }> {
    return await this.discoveryService.getDiscoveryStats();
  }

  @Get('templates/:os')
  @ApiOperation({ summary: 'Get OS template configuration' })
  @ApiParam({ name: 'os', description: 'Operating system name' })
  @ApiResponse({ status: 200, description: 'OS template configuration' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getOSTemplate(@Param('os') os: string) {
    const template = await this.discoveryService.loadOSTemplate(os);
    
    if (!template) {
      throw new HttpException('OS template not found', HttpStatus.NOT_FOUND);
    }
    
    return template;
  }

  @Put('modules/:moduleName/enable')
  @ApiOperation({ summary: 'Enable discovery module' })
  @ApiParam({ name: 'moduleName', description: 'Module name to enable' })
  @ApiResponse({ status: 200, description: 'Module enabled successfully' })
  async enableModule(
    @Param('moduleName') moduleName: string,
  ): Promise<{ success: boolean; message: string }> {
    const modules = this.discoveryService.getAvailableModules();
    const module = modules.find(m => m.name === moduleName);
    
    if (!module) {
      throw new HttpException('Module not found', HttpStatus.NOT_FOUND);
    }
    
    module.enabled = true;
    
    this.logger.log(`Enabled discovery module: ${moduleName}`);
    
    return {
      success: true,
      message: `Module ${moduleName} enabled successfully`,
    };
  }

  @Put('modules/:moduleName/disable')
  @ApiOperation({ summary: 'Disable discovery module' })
  @ApiParam({ name: 'moduleName', description: 'Module name to disable' })
  @ApiResponse({ status: 200, description: 'Module disabled successfully' })
  async disableModule(
    @Param('moduleName') moduleName: string,
  ): Promise<{ success: boolean; message: string }> {
    const modules = this.discoveryService.getAvailableModules();
    const module = modules.find(m => m.name === moduleName);
    
    if (!module) {
      throw new HttpException('Module not found', HttpStatus.NOT_FOUND);
    }
    
    module.enabled = false;
    
    this.logger.log(`Disabled discovery module: ${moduleName}`);
    
    return {
      success: true,
      message: `Module ${moduleName} disabled successfully`,
    };
  }

  @Post('device/:deviceId/module/:moduleName')
  @ApiOperation({ summary: 'Run specific discovery module for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'moduleName', description: 'Module name to run' })
  @ApiResponse({ status: 201, description: 'Module discovery started' })
  async runSpecificModule(
    @Param('deviceId') deviceId: string,
    @Param('moduleName') moduleName: string,
  ): Promise<{ sessionId: string; status: string }> {
    try {
      const session = await this.discoveryService.discoverDevice(deviceId, [moduleName]);
      
      this.logger.log(`Started ${moduleName} discovery session ${session.id} for device ${deviceId}`);
      
      return {
        sessionId: session.id,
        status: session.status,
      };
    } catch (error) {
      this.logger.error(`Failed to run ${moduleName} for device ${deviceId}: ${error.message}`);
      throw new HttpException(
        `Module discovery failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getDeviceInfo(deviceId: string): Promise<any> {
    // This would typically call a device service to get device info
    // For now, we'll simulate the call by using the discoveryService's private method pattern
    // In a real implementation, this would be injected from a DeviceService
    try {
      // This is a simplified version - in reality you'd have a separate DeviceService
      return (this.discoveryService as any).getDeviceInfo(deviceId);
    } catch (error) {
      throw new HttpException('Device not found', HttpStatus.NOT_FOUND);
    }
  }
}