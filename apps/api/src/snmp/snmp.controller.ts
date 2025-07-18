// SNMP Controller for Y Monitor API
// Provides HTTP endpoints for SNMP operations

import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SNMPClientService } from './services/snmp-client.service';
import { SNMPValidatorService } from './services/snmp-validator.service';
import { SNMPCacheService } from './services/snmp-cache.service';
import {
  SNMPGetRequestDto,
  SNMPWalkRequestDto,
  SNMPBulkWalkRequestDto,
  SNMPTestConnectionDto,
  SNMPDiscoveryDto,
  SNMPSetRequestDto,
} from './dto/snmp-request.dto';
import { SNMPDevice } from './types/snmp.types';

@ApiTags('snmp')
@Controller('snmp')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class SNMPController {
  constructor(
    private readonly snmpClient: SNMPClientService,
    private readonly validator: SNMPValidatorService,
    private readonly cache: SNMPCacheService,
  ) {}

  @Post('get')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform SNMP GET operation',
    description: 'Retrieves specific OID values from a device using SNMP GET',
  })
  @ApiResponse({
    status: 200,
    description: 'SNMP GET operation completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        varbinds: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oid: { type: 'string' },
              type: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiBody({ type: SNMPGetRequestDto })
  async get(@Body() request: SNMPGetRequestDto) {
    // Validate request
    const deviceValidation = this.validator.validateDevice(this.mapToSNMPDevice(request.device));
    if (!deviceValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid device configuration',
        errors: deviceValidation.errors,
      });
    }

    const oidsValidation = this.validator.validateOIDList(request.oids);
    if (!oidsValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid OIDs',
        errors: oidsValidation.errors,
      });
    }

    // Perform SNMP GET
    const device = this.mapToSNMPDevice(request.device);
    return await this.snmpClient.get(device, request.oids);
  }

  @Post('walk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform SNMP WALK operation',
    description: 'Walks through an OID tree to retrieve all values under a base OID',
  })
  @ApiResponse({
    status: 200,
    description: 'SNMP WALK operation completed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiBody({ type: SNMPWalkRequestDto })
  async walk(@Body() request: SNMPWalkRequestDto) {
    // Validate request
    const deviceValidation = this.validator.validateDevice(this.mapToSNMPDevice(request.device));
    if (!deviceValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid device configuration',
        errors: deviceValidation.errors,
      });
    }

    if (!this.validator.validateOID(request.oid)) {
      throw new BadRequestException('Invalid OID format');
    }

    // Perform SNMP WALK
    const device = this.mapToSNMPDevice(request.device);
    return await this.snmpClient.walk(device, request.oid, request.maxRepetitions);
  }

  @Post('bulk-walk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform SNMP BULK WALK operation',
    description: 'Performs efficient bulk walk for SNMPv2c/v3 devices',
  })
  @ApiResponse({
    status: 200,
    description: 'SNMP BULK WALK operation completed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiBody({ type: SNMPBulkWalkRequestDto })
  async bulkWalk(@Body() request: SNMPBulkWalkRequestDto) {
    // Validate request
    const deviceValidation = this.validator.validateDevice(this.mapToSNMPDevice(request.device));
    if (!deviceValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid device configuration',
        errors: deviceValidation.errors,
      });
    }

    if (!this.validator.validateOID(request.oid)) {
      throw new BadRequestException('Invalid OID format');
    }

    const bulkValidation = this.validator.validateBulkParameters(
      request.nonRepeaters,
      request.maxRepetitions,
    );
    if (!bulkValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid bulk parameters',
        errors: bulkValidation.errors,
      });
    }

    // Perform SNMP BULK WALK
    const device = this.mapToSNMPDevice(request.device);
    return await this.snmpClient.bulkWalk(
      device,
      request.oid,
      request.nonRepeaters,
      request.maxRepetitions,
    );
  }

  @Post('set')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform SNMP SET operation',
    description: 'Sets values on a device using SNMP SET (requires write community/credentials)',
  })
  @ApiResponse({
    status: 200,
    description: 'SNMP SET operation completed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiBody({ type: SNMPSetRequestDto })
  async set(@Body() request: SNMPSetRequestDto) {
    // Validate request
    const deviceValidation = this.validator.validateDevice(this.mapToSNMPDevice(request.device));
    if (!deviceValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid device configuration',
        errors: deviceValidation.errors,
      });
    }

    // Validate varbinds
    for (const varbind of request.varbinds) {
      if (!this.validator.validateOID(varbind.oid)) {
        throw new BadRequestException(`Invalid OID: ${varbind.oid}`);
      }
    }

    // Perform SNMP SET
    const device = this.mapToSNMPDevice(request.device);
    const varbinds = request.varbinds.map(vb => ({
      oid: vb.oid,
      type: vb.type as any,
      value: vb.value,
    }));

    return await this.snmpClient.set(device, varbinds);
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test SNMP connectivity',
    description: 'Tests SNMP connectivity to a device by retrieving sysDescr',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection test completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        responseTime: { type: 'number' },
      },
    },
  })
  @ApiBody({ type: SNMPTestConnectionDto })
  async testConnection(@Body() request: SNMPTestConnectionDto) {
    const startTime = Date.now();

    // Validate device configuration
    const deviceValidation = this.validator.validateDevice(this.mapToSNMPDevice(request.device));
    if (!deviceValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid device configuration',
        errors: deviceValidation.errors,
      });
    }

    try {
      const device = this.mapToSNMPDevice(request.device);
      const success = await this.snmpClient.testConnection(device);
      const responseTime = Date.now() - startTime;

      return {
        success,
        message: success ? 'Connection successful' : 'Connection failed',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        responseTime,
      };
    }
  }

  @Post('discover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Discover device information',
    description: 'Performs comprehensive device discovery including system info, interfaces, and sensors',
  })
  @ApiResponse({
    status: 200,
    description: 'Device discovery completed successfully',
  })
  @ApiBody({ type: SNMPDiscoveryDto })
  async discover(@Body() request: SNMPDiscoveryDto) {
    // Validate device configuration
    const deviceValidation = this.validator.validateDevice(this.mapToSNMPDevice(request.device));
    if (!deviceValidation.isValid) {
      throw new BadRequestException({
        message: 'Invalid device configuration',
        errors: deviceValidation.errors,
      });
    }

    const device = this.mapToSNMPDevice(request.device);
    const discovery: any = {
      hostname: device.hostname,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get system information
      if (request.includeSystemInfo !== false) {
        discovery.systemInfo = await this.snmpClient.getSystemInfo(device);
      }

      // Get interface information
      if (request.includeInterfaces !== false) {
        discovery.interfaces = await this.snmpClient.getInterfaceInfo(device);
      }

      // Get sensor information (placeholder - would be implemented later)
      if (request.includeSensors === true) {
        discovery.sensors = []; // TODO: Implement sensor discovery
      }

      discovery.success = true;
    } catch (error) {
      discovery.success = false;
      discovery.error = error.message;
    }

    return discovery;
  }

  @Get('cache/stats')
  @ApiOperation({
    summary: 'Get SNMP cache statistics',
    description: 'Returns statistics about the SNMP response cache',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  async getCacheStats() {
    return await this.cache.getCacheStats();
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear SNMP cache',
    description: 'Clears all cached SNMP responses',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  async clearCache() {
    await this.cache.clear();
    return { message: 'Cache cleared successfully' };
  }

  @Get('oids/common')
  @ApiOperation({
    summary: 'Get common SNMP OIDs',
    description: 'Returns a list of commonly used SNMP OIDs for reference',
  })
  @ApiResponse({
    status: 200,
    description: 'Common OIDs retrieved successfully',
  })
  getCommonOIDs() {
    return {
      system: {
        sysDescr: '1.3.6.1.2.1.1.1.0',
        sysObjectID: '1.3.6.1.2.1.1.2.0',
        sysUpTime: '1.3.6.1.2.1.1.3.0',
        sysContact: '1.3.6.1.2.1.1.4.0',
        sysName: '1.3.6.1.2.1.1.5.0',
        sysLocation: '1.3.6.1.2.1.1.6.0',
      },
      interfaces: {
        ifNumber: '1.3.6.1.2.1.2.1.0',
        ifTable: '1.3.6.1.2.1.2.2',
        ifIndex: '1.3.6.1.2.1.2.2.1.1',
        ifDescr: '1.3.6.1.2.1.2.2.1.2',
        ifType: '1.3.6.1.2.1.2.2.1.3',
        ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
        ifInOctets: '1.3.6.1.2.1.2.2.1.10',
        ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
      },
    };
  }

  private mapToSNMPDevice(deviceDto: any): SNMPDevice {
    return {
      hostname: deviceDto.hostname,
      port: deviceDto.port || 161,
      timeout: deviceDto.timeout || 5000,
      retries: deviceDto.retries || 3,
      transport: deviceDto.transport || 'udp',
      version: deviceDto.credentials.version,
      community: deviceDto.credentials.community,
      username: deviceDto.credentials.username,
      authLevel: deviceDto.credentials.authLevel,
      authProtocol: deviceDto.credentials.authProtocol,
      authPassword: deviceDto.credentials.authPassword,
      privProtocol: deviceDto.credentials.privProtocol,
      privPassword: deviceDto.credentials.privPassword,
      contextName: deviceDto.credentials.contextName,
    };
  }
}