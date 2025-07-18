// SNMP Validator Service for Y Monitor
// Validates SNMP configurations and OIDs

import { Injectable } from '@nestjs/common';
import { ISNMPValidator } from '../interfaces/snmp-client.interface';
import { SNMPDevice, SNMPVersion, SNMPv3AuthLevel } from '../types/snmp.types';

@Injectable()
export class SNMPValidatorService implements ISNMPValidator {
  
  validateDevice(device: SNMPDevice): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate basic device properties
    if (!device.hostname) {
      errors.push('Hostname is required');
    } else if (!this.isValidHostname(device.hostname)) {
      errors.push('Invalid hostname format');
    }

    if (!device.version) {
      errors.push('SNMP version is required');
    } else if (!this.isValidSNMPVersion(device.version)) {
      errors.push('Invalid SNMP version. Must be v1, v2c, or v3');
    }

    if (device.port && (device.port < 1 || device.port > 65535)) {
      errors.push('Port must be between 1 and 65535');
    }

    if (device.timeout && device.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    if (device.retries && (device.retries < 0 || device.retries > 10)) {
      errors.push('Retries must be between 0 and 10');
    }

    // Validate version-specific configurations
    if (device.version === 'v1' || device.version === 'v2c') {
      if (!device.community) {
        errors.push('Community string is required for SNMPv1/v2c');
      } else if (device.community.length > 255) {
        errors.push('Community string must not exceed 255 characters');
      }
    }

    if (device.version === 'v3') {
      const v3Errors = this.validateSNMPv3Config(device);
      errors.push(...v3Errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateOID(oid: string): boolean {
    if (!oid || typeof oid !== 'string') {
      return false;
    }

    // Remove leading/trailing whitespace
    oid = oid.trim();

    // OID must start with a digit
    if (!/^\d/.test(oid)) {
      return false;
    }

    // OID format: numbers separated by dots
    const oidPattern = /^(\d+)(\.\d+)*$/;
    if (!oidPattern.test(oid)) {
      return false;
    }

    // Validate individual arc values
    const arcs = oid.split('.');
    
    // First arc must be 0, 1, or 2
    const firstArc = parseInt(arcs[0]);
    if (firstArc < 0 || firstArc > 2) {
      return false;
    }

    // Second arc validation depends on first arc
    if (arcs.length > 1) {
      const secondArc = parseInt(arcs[1]);
      if (firstArc < 2 && secondArc > 39) {
        return false;
      }
    }

    // All arcs must be valid numbers
    for (const arc of arcs) {
      const num = parseInt(arc);
      if (isNaN(num) || num < 0) {
        return false;
      }
      
      // Check for leading zeros (except for "0" itself)
      if (arc.length > 1 && arc.startsWith('0')) {
        return false;
      }
    }

    return true;
  }

  validateCredentials(credentials: {
    version: string;
    community?: string;
    username?: string;
    authProtocol?: string;
    privProtocol?: string;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.version) {
      errors.push('SNMP version is required');
      return { isValid: false, errors };
    }

    if (!this.isValidSNMPVersion(credentials.version as SNMPVersion)) {
      errors.push('Invalid SNMP version');
      return { isValid: false, errors };
    }

    if (credentials.version === 'v1' || credentials.version === 'v2c') {
      if (!credentials.community) {
        errors.push('Community string is required for SNMPv1/v2c');
      } else {
        if (credentials.community.length === 0) {
          errors.push('Community string cannot be empty');
        }
        if (credentials.community.length > 255) {
          errors.push('Community string must not exceed 255 characters');
        }
        if (!/^[\x20-\x7E]*$/.test(credentials.community)) {
          errors.push('Community string must contain only printable ASCII characters');
        }
      }
    }

    if (credentials.version === 'v3') {
      if (!credentials.username) {
        errors.push('Username is required for SNMPv3');
      } else {
        if (credentials.username.length === 0) {
          errors.push('Username cannot be empty');
        }
        if (credentials.username.length > 32) {
          errors.push('Username must not exceed 32 characters');
        }
      }

      if (credentials.authProtocol) {
        if (!this.isValidAuthProtocol(credentials.authProtocol)) {
          errors.push('Invalid authentication protocol');
        }
      }

      if (credentials.privProtocol) {
        if (!this.isValidPrivProtocol(credentials.privProtocol)) {
          errors.push('Invalid privacy protocol');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateOIDList(oids: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(oids)) {
      errors.push('OIDs must be provided as an array');
      return { isValid: false, errors };
    }

    if (oids.length === 0) {
      errors.push('At least one OID is required');
      return { isValid: false, errors };
    }

    if (oids.length > 100) {
      errors.push('Maximum of 100 OIDs allowed per request');
    }

    oids.forEach((oid, index) => {
      if (!this.validateOID(oid)) {
        errors.push(`Invalid OID at index ${index}: ${oid}`);
      }
    });

    // Check for duplicates
    const uniqueOids = new Set(oids);
    if (uniqueOids.size !== oids.length) {
      errors.push('Duplicate OIDs are not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateBulkParameters(nonRepeaters?: number, maxRepetitions?: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (nonRepeaters !== undefined) {
      if (!Number.isInteger(nonRepeaters) || nonRepeaters < 0) {
        errors.push('Non-repeaters must be a non-negative integer');
      }
      if (nonRepeaters > 100) {
        errors.push('Non-repeaters must not exceed 100');
      }
    }

    if (maxRepetitions !== undefined) {
      if (!Number.isInteger(maxRepetitions) || maxRepetitions < 1) {
        errors.push('Max repetitions must be a positive integer');
      }
      if (maxRepetitions > 100) {
        errors.push('Max repetitions must not exceed 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateSNMPv3Config(device: SNMPDevice): string[] {
    const errors: string[] = [];

    if (!device.username) {
      errors.push('Username is required for SNMPv3');
    } else {
      if (device.username.length === 0) {
        errors.push('Username cannot be empty');
      }
      if (device.username.length > 32) {
        errors.push('Username must not exceed 32 characters');
      }
    }

    if (!device.authLevel) {
      errors.push('Authentication level is required for SNMPv3');
    } else if (!this.isValidAuthLevel(device.authLevel)) {
      errors.push('Invalid authentication level. Must be noAuthNoPriv, authNoPriv, or authPriv');
    }

    // Validate authentication configuration
    if (device.authLevel === 'authNoPriv' || device.authLevel === 'authPriv') {
      if (!device.authProtocol) {
        errors.push('Authentication protocol is required');
      } else if (!this.isValidAuthProtocol(device.authProtocol)) {
        errors.push('Invalid authentication protocol');
      }

      if (!device.authPassword) {
        errors.push('Authentication password is required');
      } else if (device.authPassword.length < 8) {
        errors.push('Authentication password must be at least 8 characters');
      }
    }

    // Validate privacy configuration
    if (device.authLevel === 'authPriv') {
      if (!device.privProtocol) {
        errors.push('Privacy protocol is required for authPriv');
      } else if (!this.isValidPrivProtocol(device.privProtocol)) {
        errors.push('Invalid privacy protocol');
      }

      if (!device.privPassword) {
        errors.push('Privacy password is required for authPriv');
      } else if (device.privPassword.length < 8) {
        errors.push('Privacy password must be at least 8 characters');
      }
    }

    if (device.contextName && device.contextName.length > 32) {
      errors.push('Context name must not exceed 32 characters');
    }

    return errors;
  }

  private isValidHostname(hostname: string): boolean {
    if (!hostname || hostname.length > 253) {
      return false;
    }

    // Check for IP address format
    if (this.isValidIPAddress(hostname)) {
      return true;
    }

    // Check for hostname format
    const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return hostnamePattern.test(hostname);
  }

  private isValidIPAddress(ip: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = ip.match(ipv4Pattern);
    
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number);
      return octets.every(octet => octet >= 0 && octet <= 255);
    }

    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv6Pattern.test(ip);
  }

  private isValidSNMPVersion(version: string): version is SNMPVersion {
    return ['v1', 'v2c', 'v3'].includes(version);
  }

  private isValidAuthLevel(level: string): level is SNMPv3AuthLevel {
    return ['noAuthNoPriv', 'authNoPriv', 'authPriv'].includes(level);
  }

  private isValidAuthProtocol(protocol: string): boolean {
    return ['MD5', 'SHA', 'SHA224', 'SHA256', 'SHA384', 'SHA512'].includes(protocol);
  }

  private isValidPrivProtocol(protocol: string): boolean {
    return ['DES', 'AES', 'AES192', 'AES256', '3DES'].includes(protocol);
  }
}