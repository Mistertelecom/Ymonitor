// Alert Rule Service for Y Monitor
// Serviço de regras de alerta com suporte a múltiplos idiomas

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { I18nService, Language } from './i18n.service';
import { 
  AlertRule, 
  AlertCondition, 
  AlertSeverity, 
  AlertRuleFilters,
  AlertTranslations 
} from '../interfaces/alert.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AlertRuleService {
  private readonly logger = new Logger(AlertRuleService.name);

  constructor(
    private prisma: PrismaService,
    private snmpClient: SNMPClientService,
    private i18n: I18nService,
  ) {}

  async createRule(
    data: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
    language: Language = 'pt'
  ): Promise<AlertRule> {
    try {
      // Validate rule conditions
      this.validateRuleConditions(data.conditions);

      // Ensure translations are provided
      if (!data.translations?.pt || !data.translations?.en) {
        throw new BadRequestException(
          this.i18n.t('error.missing_translations', language)
        );
      }

      const rule = await this.prisma.alertRule.create({
        data: {
          id: uuidv4(),
          name: data.name,
          description: data.description,
          query: data.query,
          severity: data.severity,
          enabled: data.enabled,
          deviceGroup: data.deviceGroup,
          deviceFilter: data.deviceFilter ? JSON.stringify(data.deviceFilter) : null,
          conditions: JSON.stringify(data.conditions),
          delay: data.delay || 0,
          interval: data.interval || 300, // 5 minutes default
          recovery: data.recovery ?? true,
          acknowledgeable: data.acknowledgeable ?? true,
          suppressable: data.suppressable ?? true,
          template: data.template,
          translations: JSON.stringify(data.translations),
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          createdBy: data.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `${this.i18n.t('success.rule_created', language)}: ${rule.name} (${rule.id})`
      );

      return this.mapToAlertRule(rule);
    } catch (error) {
      this.logger.error(`Failed to create alert rule: ${error.message}`);
      throw error;
    }
  }

  async updateRule(
    id: string,
    updates: Partial<AlertRule>,
    language: Language = 'pt'
  ): Promise<AlertRule> {
    try {
      const existingRule = await this.prisma.alertRule.findUnique({
        where: { id },
      });

      if (!existingRule) {
        throw new NotFoundException(
          this.i18n.t('error.rule_not_found', language)
        );
      }

      // Validate conditions if provided
      if (updates.conditions) {
        this.validateRuleConditions(updates.conditions);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Map fields
      const fieldsToUpdate = [
        'name', 'description', 'query', 'severity', 'enabled',
        'deviceGroup', 'delay', 'interval', 'recovery',
        'acknowledgeable', 'suppressable', 'template'
      ];

      fieldsToUpdate.forEach(field => {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      });

      // Handle JSON fields
      if (updates.deviceFilter !== undefined) {
        updateData.deviceFilter = updates.deviceFilter ? JSON.stringify(updates.deviceFilter) : null;
      }

      if (updates.conditions !== undefined) {
        updateData.conditions = JSON.stringify(updates.conditions);
      }

      if (updates.translations !== undefined) {
        updateData.translations = JSON.stringify(updates.translations);
      }

      if (updates.metadata !== undefined) {
        updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
      }

      const updatedRule = await this.prisma.alertRule.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(
        `${this.i18n.t('success.rule_updated', language)}: ${updatedRule.name} (${id})`
      );

      return this.mapToAlertRule(updatedRule);
    } catch (error) {
      this.logger.error(`Failed to update alert rule ${id}: ${error.message}`);
      throw error;
    }
  }

  async deleteRule(id: string, language: Language = 'pt'): Promise<void> {
    try {
      const rule = await this.prisma.alertRule.findUnique({
        where: { id },
      });

      if (!rule) {
        throw new NotFoundException(
          this.i18n.t('error.rule_not_found', language)
        );
      }

      // Check if rule has active alerts
      const activeAlerts = await this.prisma.alert.count({
        where: {
          ruleId: id,
          state: {
            in: ['open', 'acknowledged'],
          },
        },
      });

      if (activeAlerts > 0) {
        throw new BadRequestException(
          this.i18n.t('error.rule_has_active_alerts', language, { count: activeAlerts })
        );
      }

      await this.prisma.alertRule.delete({
        where: { id },
      });

      this.logger.log(
        `${this.i18n.t('success.rule_deleted', language)}: ${rule.name} (${id})`
      );
    } catch (error) {
      this.logger.error(`Failed to delete alert rule ${id}: ${error.message}`);
      throw error;
    }
  }

  async getRule(id: string, language: Language = 'pt'): Promise<AlertRule | null> {
    try {
      const rule = await this.prisma.alertRule.findUnique({
        where: { id },
      });

      if (!rule) {
        return null;
      }

      return this.mapToAlertRule(rule);
    } catch (error) {
      this.logger.error(`Failed to get alert rule ${id}: ${error.message}`);
      throw error;
    }
  }

  async getRules(filters: AlertRuleFilters = {}): Promise<AlertRule[]> {
    try {
      const where: any = {};

      if (filters.enabled !== undefined) {
        where.enabled = filters.enabled;
      }

      if (filters.severity && filters.severity.length > 0) {
        where.severity = { in: filters.severity };
      }

      if (filters.deviceGroup) {
        where.deviceGroup = filters.deviceGroup;
      }

      if (filters.createdBy) {
        where.createdBy = filters.createdBy;
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const rules = await this.prisma.alertRule.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: filters.offset || 0,
        take: filters.limit || 100,
      });

      return rules.map(rule => this.mapToAlertRule(rule));
    } catch (error) {
      this.logger.error(`Failed to get alert rules: ${error.message}`);
      throw error;
    }
  }

  async testRule(
    id: string,
    deviceId?: string,
    language: Language = 'pt'
  ): Promise<{ 
    triggered: boolean; 
    conditions: Array<{ condition: AlertCondition; result: boolean; value: any }>;
    message: string;
  }> {
    try {
      const rule = await this.getRule(id, language);
      if (!rule) {
        throw new NotFoundException(
          this.i18n.t('error.rule_not_found', language)
        );
      }

      // If deviceId provided, test against specific device
      if (deviceId) {
        return await this.testRuleAgainstDevice(rule, deviceId, language);
      }

      // Otherwise, test against rule query
      return await this.testRuleQuery(rule, language);
    } catch (error) {
      this.logger.error(`Failed to test alert rule ${id}: ${error.message}`);
      throw error;
    }
  }

  async duplicateRule(
    id: string,
    newName: string,
    language: Language = 'pt'
  ): Promise<AlertRule> {
    try {
      const originalRule = await this.getRule(id, language);
      if (!originalRule) {
        throw new NotFoundException(
          this.i18n.t('error.rule_not_found', language)
        );
      }

      const duplicatedRule = {
        ...originalRule,
        name: newName,
        enabled: false, // Start disabled
        translations: {
          pt: {
            ...originalRule.translations.pt,
            title: newName,
          },
          en: {
            ...originalRule.translations.en,
            title: newName,
          },
        },
      };

      delete (duplicatedRule as any).id;
      delete (duplicatedRule as any).createdAt;
      delete (duplicatedRule as any).updatedAt;

      return await this.createRule(duplicatedRule, language);
    } catch (error) {
      this.logger.error(`Failed to duplicate alert rule ${id}: ${error.message}`);
      throw error;
    }
  }

  async getRulesByDevice(deviceId: string): Promise<AlertRule[]> {
    try {
      // Get device information
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
      });

      if (!device) {
        return [];
      }

      // Get all enabled rules
      const rules = await this.getRules({ enabled: true });

      // Filter rules that apply to this device
      return rules.filter(rule => this.doesRuleApplyToDevice(rule, device));
    } catch (error) {
      this.logger.error(`Failed to get rules for device ${deviceId}: ${error.message}`);
      return [];
    }
  }

  private validateRuleConditions(conditions: AlertCondition[]): void {
    if (!conditions || conditions.length === 0) {
      throw new BadRequestException('At least one condition is required');
    }

    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'not_like', 'in', 'not_in'];
    const validLogical = ['AND', 'OR'];

    for (const condition of conditions) {
      if (!condition.field || !condition.operator) {
        throw new BadRequestException('Condition field and operator are required');
      }

      if (!validOperators.includes(condition.operator)) {
        throw new BadRequestException(`Invalid operator: ${condition.operator}`);
      }

      if (condition.logical && !validLogical.includes(condition.logical)) {
        throw new BadRequestException(`Invalid logical operator: ${condition.logical}`);
      }
    }
  }

  private async testRuleAgainstDevice(
    rule: AlertRule,
    deviceId: string,
    language: Language
  ): Promise<any> {
    // Implementation would test rule conditions against specific device
    // This is a simplified version - real implementation would evaluate SNMP data
    
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(
        this.i18n.t('error.device_not_found', language)
      );
    }

    const results = [];
    let triggered = false;

    // Test each condition
    for (const condition of rule.conditions) {
      const result = await this.evaluateCondition(condition, device);
      results.push({
        condition,
        result: result.triggered,
        value: result.value,
      });

      if (result.triggered) {
        triggered = true;
      }
    }

    return {
      triggered,
      conditions: results,
      message: triggered 
        ? this.i18n.t('alert.rule.test_triggered', language)
        : this.i18n.t('alert.rule.test_not_triggered', language),
    };
  }

  private async testRuleQuery(rule: AlertRule, language: Language): Promise<any> {
    // Implementation would execute the rule query against the database
    // This is a placeholder
    return {
      triggered: false,
      conditions: [],
      message: this.i18n.t('alert.rule.test_completed', language),
    };
  }

  private async evaluateCondition(condition: AlertCondition, device: any): Promise<{ triggered: boolean; value: any }> {
    // This is a simplified implementation
    // Real implementation would evaluate condition against device data
    
    let value: any = null;
    let triggered = false;

    switch (condition.field) {
      case 'device.status':
        value = device.disabled ? 'down' : 'up';
        triggered = this.compareValues(value, condition.operator, condition.value);
        break;
      case 'device.uptime':
        value = device.uptime ? Number(device.uptime) : 0;
        triggered = this.compareValues(value, condition.operator, condition.value);
        break;
      // Add more field evaluations as needed
      default:
        value = null;
        triggered = false;
    }

    return { triggered, value };
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'gt': return Number(actual) > Number(expected);
      case 'gte': return Number(actual) >= Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      case 'lte': return Number(actual) <= Number(expected);
      case 'like': return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'not_like': return !String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  private doesRuleApplyToDevice(rule: AlertRule, device: any): boolean {
    if (!rule.deviceFilter) {
      return true; // Rule applies to all devices
    }

    const filter = rule.deviceFilter;
    
    // Check hostname filter
    if (filter.hostname && filter.hostname.length > 0) {
      const matches = filter.hostname.some(pattern => 
        device.hostname.match(new RegExp(pattern, 'i'))
      );
      if (filter.exclude ? matches : !matches) {
        return false;
      }
    }

    // Check IP filter
    if (filter.ip && filter.ip.length > 0) {
      const matches = filter.ip.includes(device.ip);
      if (filter.exclude ? matches : !matches) {
        return false;
      }
    }

    // Check OS filter
    if (filter.os && filter.os.length > 0) {
      const matches = filter.os.includes(device.os);
      if (filter.exclude ? matches : !matches) {
        return false;
      }
    }

    // Check location filter
    if (filter.location && filter.location.length > 0) {
      const matches = filter.location.includes(device.sysLocation);
      if (filter.exclude ? matches : !matches) {
        return false;
      }
    }

    return true;
  }

  private mapToAlertRule(rule: any): AlertRule {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      query: rule.query,
      severity: rule.severity,
      enabled: rule.enabled,
      deviceGroup: rule.deviceGroup,
      deviceFilter: rule.deviceFilter ? JSON.parse(rule.deviceFilter) : undefined,
      conditions: JSON.parse(rule.conditions),
      delay: rule.delay,
      interval: rule.interval,
      recovery: rule.recovery,
      acknowledgeable: rule.acknowledgeable,
      suppressable: rule.suppressable,
      template: rule.template,
      translations: JSON.parse(rule.translations),
      metadata: rule.metadata ? JSON.parse(rule.metadata) : undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      createdBy: rule.createdBy,
    };
  }
}