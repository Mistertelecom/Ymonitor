import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NetworkService } from './network.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('network')
@Controller('network')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('topology')
  @ApiOperation({ summary: 'Get network topology' })
  @ApiResponse({ status: 200, description: 'Network topology retrieved' })
  getTopology() {
    return this.networkService.getTopology();
  }

  @Get('map')
  @ApiOperation({ summary: 'Get network geographic map' })
  @ApiResponse({ status: 200, description: 'Network map retrieved' })
  getNetworkMap() {
    return this.networkService.getNetworkMap();
  }

  @Post('discover')
  @ApiOperation({ summary: 'Discover network devices' })
  @ApiResponse({ status: 200, description: 'Network discovery started' })
  discoverNetwork(@Body('subnet') subnet: string) {
    return this.networkService.discoverNetwork(subnet);
  }
}