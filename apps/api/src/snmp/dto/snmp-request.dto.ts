// SNMP Request DTOs for Y Monitor API

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsNumber, IsEnum, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SNMPVersion, SNMPv3AuthLevel, SNMPv3AuthProtocol, SNMPv3PrivProtocol } from '../types/snmp.types';

export class SNMPCredentialsDto {
  @ApiProperty({
    description: 'SNMP version',
    enum: ['v1', 'v2c', 'v3'],
    example: 'v2c',
  })
  @IsEnum(['v1', 'v2c', 'v3'])
  version: SNMPVersion;

  @ApiProperty({
    description: 'Community string for SNMPv1/v2c',
    example: 'public',
    required: false,
  })
  @IsString()
  @IsOptional()
  community?: string;

  @ApiProperty({
    description: 'Username for SNMPv3',
    example: 'snmpuser',
    required: false,
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: 'Authentication level for SNMPv3',
    enum: ['noAuthNoPriv', 'authNoPriv', 'authPriv'],
    required: false,
  })
  @IsEnum(['noAuthNoPriv', 'authNoPriv', 'authPriv'])
  @IsOptional()
  authLevel?: SNMPv3AuthLevel;

  @ApiProperty({
    description: 'Authentication protocol for SNMPv3',
    enum: ['MD5', 'SHA', 'SHA224', 'SHA256', 'SHA384', 'SHA512'],
    required: false,
  })
  @IsEnum(['MD5', 'SHA', 'SHA224', 'SHA256', 'SHA384', 'SHA512'])
  @IsOptional()
  authProtocol?: SNMPv3AuthProtocol;

  @ApiProperty({
    description: 'Authentication password for SNMPv3',
    example: 'authpassword',
    required: false,
  })
  @IsString()
  @IsOptional()
  authPassword?: string;

  @ApiProperty({
    description: 'Privacy protocol for SNMPv3',
    enum: ['DES', 'AES', 'AES192', 'AES256', '3DES'],
    required: false,
  })
  @IsEnum(['DES', 'AES', 'AES192', 'AES256', '3DES'])
  @IsOptional()
  privProtocol?: SNMPv3PrivProtocol;

  @ApiProperty({
    description: 'Privacy password for SNMPv3',
    example: 'privpassword',
    required: false,
  })
  @IsString()
  @IsOptional()
  privPassword?: string;

  @ApiProperty({
    description: 'Context name for SNMPv3',
    example: 'contextName',
    required: false,
  })
  @IsString()
  @IsOptional()
  contextName?: string;
}

export class SNMPConnectionDto {
  @ApiProperty({
    description: 'Target hostname or IP address',
    example: '192.168.1.1',
  })
  @IsString()
  hostname: string;

  @ApiProperty({
    description: 'SNMP port',
    example: 161,
    default: 161,
  })
  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port: number = 161;

  @ApiProperty({
    description: 'Timeout in milliseconds',
    example: 5000,
    default: 5000,
  })
  @IsNumber()
  @Min(1000)
  @Max(30000)
  @IsOptional()
  timeout: number = 5000;

  @ApiProperty({
    description: 'Number of retries',
    example: 3,
    default: 3,
  })
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  retries: number = 3;

  @ApiProperty({
    description: 'Transport protocol',
    enum: ['udp4', 'udp6', 'tcp'],
    default: 'udp4',
  })
  @IsEnum(['udp4', 'udp6', 'tcp'])
  @IsOptional()
  transport: 'udp4' | 'udp6' | 'tcp' = 'udp4';
}

export class SNMPDeviceDto extends SNMPConnectionDto {
  @ApiProperty({
    description: 'SNMP credentials',
    type: SNMPCredentialsDto,
  })
  @ValidateNested()
  @Type(() => SNMPCredentialsDto)
  credentials: SNMPCredentialsDto;
}

export class SNMPGetRequestDto {
  @ApiProperty({
    description: 'Device configuration',
    type: SNMPDeviceDto,
  })
  @ValidateNested()
  @Type(() => SNMPDeviceDto)
  device: SNMPDeviceDto;

  @ApiProperty({
    description: 'Array of OIDs to retrieve',
    example: ['1.3.6.1.2.1.1.1.0', '1.3.6.1.2.1.1.5.0'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  oids: string[];
}

export class SNMPWalkRequestDto {
  @ApiProperty({
    description: 'Device configuration',
    type: SNMPDeviceDto,
  })
  @ValidateNested()
  @Type(() => SNMPDeviceDto)
  device: SNMPDeviceDto;

  @ApiProperty({
    description: 'Starting OID for walk operation',
    example: '1.3.6.1.2.1.2.2.1.2',
  })
  @IsString()
  oid: string;

  @ApiProperty({
    description: 'Maximum repetitions for bulk operations',
    example: 20,
    default: 20,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxRepetitions?: number = 20;
}

export class SNMPBulkWalkRequestDto extends SNMPWalkRequestDto {
  @ApiProperty({
    description: 'Number of non-repeating variables',
    example: 0,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  nonRepeaters?: number = 0;
}

export class SNMPTestConnectionDto {
  @ApiProperty({
    description: 'Device configuration',
    type: SNMPDeviceDto,
  })
  @ValidateNested()
  @Type(() => SNMPDeviceDto)
  device: SNMPDeviceDto;
}

export class SNMPDiscoveryDto {
  @ApiProperty({
    description: 'Device configuration',
    type: SNMPDeviceDto,
  })
  @ValidateNested()
  @Type(() => SNMPDeviceDto)
  device: SNMPDeviceDto;

  @ApiProperty({
    description: 'Include system information',
    default: true,
  })
  @IsOptional()
  includeSystemInfo?: boolean = true;

  @ApiProperty({
    description: 'Include interface information',
    default: true,
  })
  @IsOptional()
  includeInterfaces?: boolean = true;

  @ApiProperty({
    description: 'Include sensor information',
    default: false,
  })
  @IsOptional()
  includeSensors?: boolean = false;
}

export class SNMPVarbindDto {
  @ApiProperty({
    description: 'Object identifier',
    example: '1.3.6.1.2.1.1.4.0',
  })
  @IsString()
  oid: string;

  @ApiProperty({
    description: 'Data type',
    example: 'OCTET STRING',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Value to set',
    example: 'Administrator',
  })
  value: any;
}

export class SNMPSetRequestDto {
  @ApiProperty({
    description: 'Device configuration',
    type: SNMPDeviceDto,
  })
  @ValidateNested()
  @Type(() => SNMPDeviceDto)
  device: SNMPDeviceDto;

  @ApiProperty({
    description: 'Array of varbinds to set',
    type: [SNMPVarbindDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SNMPVarbindDto)
  varbinds: SNMPVarbindDto[];
}