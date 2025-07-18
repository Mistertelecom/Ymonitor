// Alert Engine Service for Y Monitor
// Motor de alertas com processamento automático e correlação

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SNMPClientService } from '../../snmp/services/snmp-client.service';
import { I18nService, Language } from './i18n.service';
import { AlertRuleService } from './alert-rule.service';
import { AlertNotificationService } from './alert-notification.service';
import { 
  Alert, 
  AlertRule, 
  AlertSeverity, 
  AlertState,
  AlertCondition,
  AlertTranslations 
} from '../interfaces/alert.interface';
import { v4 as uuidv4 } from 'uuid';

interface DeviceMetrics {
  deviceId: string;
  hostname: string;
  ip: string;
  status: 'up' | 'down';
  responseTime: number;
  uptime?: number;
  cpu?: number;
  memory?: number;
  interfaces: Array<{
    ifIndex: number;
    ifName: string;
    ifOperStatus: string;
    ifAdminStatus: string;
    ifSpeed?: number;
    ifInOctets?: number;
    ifOutOctets?: number;
    utilization?: number;
  }>;
  sensors: Array<{
    type: string;
    descr: string;
    value: number;
    unit: string;
    threshold?: number;
  }>;
  timestamp: Date;
}

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);
  private readonly correlationKeys = new Map<string, Alert[]>();
  private readonly suppressions = new Map<string, Date>();

  constructor(
    private prisma: PrismaService,
    private snmpClient: SNMPClientService,
    private i18n: I18nService,
    private alertRuleService: AlertRuleService,
    private notificationService: AlertNotificationService,
  ) {}

  /**
   * Executa verificação de alertas a cada minuto
   * Runs alert checking every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processAlerts(): Promise<void> {
    try {
      this.logger.debug('Starting alert processing cycle');

      // Get all enabled devices
      const devices = await this.prisma.device.findMany({
        where: { disabled: false },
        select: {
          id: true,
          hostname: true,
          ip: true,
          snmpCommunity: true,
          snmpVersion: true,
          snmpPort: true,
          snmpTimeout: true,
          snmpRetries: true,
          lastPolled: true,
          disabled: true,
        },
      });

      // Process each device
      for (const device of devices) {
        try {
          await this.processDeviceAlerts(device);
        } catch (error) {
          this.logger.error(`Failed to process alerts for device ${device.hostname}: ${error.message}`);
        }
      }

      // Clean up old correlations and suppressions
      await this.cleanupOldData();

      this.logger.debug('Alert processing cycle completed');
    } catch (error) {
      this.logger.error(`Alert processing cycle failed: ${error.message}`);
    }
  }

  /**
   * Processa alertas para um dispositivo específico
   * Processes alerts for a specific device
   */
  async processDeviceAlerts(device: any): Promise<void> {
    try {
      // Get device metrics
      const metrics = await this.collectDeviceMetrics(device);

      // Get applicable rules for this device
      const rules = await this.alertRuleService.getRulesByDevice(device.id);

      // Evaluate each rule
      for (const rule of rules) {
        try {
          await this.evaluateRule(rule, metrics);
        } catch (error) {
          this.logger.error(`Failed to evaluate rule ${rule.name} for device ${device.hostname}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process device alerts for ${device.hostname}: ${error.message}`);
    }
  }

  /**
   * Avalia uma regra contra métricas do dispositivo
   * Evaluates a rule against device metrics
   */
  private async evaluateRule(rule: AlertRule, metrics: DeviceMetrics): Promise<void> {
    try {
      const evaluation = await this.evaluateRuleConditions(rule, metrics);

      if (evaluation.triggered) {
        await this.handleTriggeredRule(rule, metrics, evaluation);
      } else {
        await this.handleRecoveredRule(rule, metrics);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate rule ${rule.name}: ${error.message}`);
    }
  }

  /**
   * Avalia condições da regra
   * Evaluates rule conditions
   */
  private async evaluateRuleConditions(
    rule: AlertRule, 
    metrics: DeviceMetrics
  ): Promise<{ triggered: boolean; context: Record<string, any> }> {
    let triggered = false;
    const context: Record<string, any> = {
      device: {
        hostname: metrics.hostname,
        ip: metrics.ip,
        status: metrics.status,
        uptime: metrics.uptime,
        cpu: metrics.cpu,
        memory: metrics.memory,
      },
    };

    // Evaluate each condition
    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      const conditionResult = this.evaluateCondition(condition, metrics);
      
      if (i === 0) {
        triggered = conditionResult;
      } else {
        const logical = condition.logical || 'AND';
        if (logical === 'AND') {
          triggered = triggered && conditionResult;
        } else {
          triggered = triggered || conditionResult;
        }
      }

      // Add condition context
      context[`condition_${i}`] = {
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
        result: conditionResult,
      };
    }

    return { triggered, context };
  }

  /**
   * Avalia uma condição específica
   * Evaluates a specific condition
   */
  private evaluateCondition(condition: AlertCondition, metrics: DeviceMetrics): boolean {
    const value = this.getMetricValue(condition.field, metrics);
    
    if (value === null || value === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return Number(value) > Number(condition.value);
      case 'gte': return Number(value) >= Number(condition.value);
      case 'lt': return Number(value) < Number(condition.value);
      case 'lte': return Number(value) <= Number(condition.value);
      case 'like': return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_like': return !String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(value);
      default: return false;
    }
  }

  /**
   * Obtém valor da métrica baseado no campo
   * Gets metric value based on field
   */
  private getMetricValue(field: string, metrics: DeviceMetrics): any {
    const parts = field.split('.');
    let current: any = metrics;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Manipula regra acionada
   * Handles triggered rule
   */
  private async handleTriggeredRule(
    rule: AlertRule, 
    metrics: DeviceMetrics, 
    evaluation: { triggered: boolean; context: Record<string, any> }
  ): Promise<void> {
    try {
      // Check if alert already exists
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          ruleId: rule.id,
          deviceId: metrics.deviceId,
          state: { in: ['open', 'acknowledged'] },
        },
      });

      if (existingAlert) {
        // Update existing alert
        await this.updateExistingAlert(existingAlert, evaluation.context);
      } else {
        // Create new alert with delay check
        if (rule.delay && rule.delay > 0) {
          const delayKey = `${rule.id}_${metrics.deviceId}`;
          const delayTime = new Date(Date.now() + rule.delay * 1000);
          
          // Check if delay period has passed
          const existingDelay = this.suppressions.get(delayKey);
          if (!existingDelay || new Date() >= existingDelay) {
            await this.createNewAlert(rule, metrics, evaluation.context);
            this.suppressions.delete(delayKey);
          } else {
            this.suppressions.set(delayKey, delayTime);
          }
        } else {
          await this.createNewAlert(rule, metrics, evaluation.context);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle triggered rule ${rule.name}: ${error.message}`);
    }
  }

  /**
   * Manipula regra recuperada
   * Handles recovered rule
   */
  private async handleRecoveredRule(rule: AlertRule, metrics: DeviceMetrics): Promise<void> {
    if (!rule.recovery) {
      return; // Rule doesn't support automatic recovery
    }

    try {
      const activeAlert = await this.prisma.alert.findFirst({
        where: {
          ruleId: rule.id,
          deviceId: metrics.deviceId,
          state: { in: ['open', 'acknowledged'] },
        },
      });

      if (activeAlert) {
        await this.resolveAlert(activeAlert.id, 'system', 'Auto-resolved by recovery rule');
      }
    } catch (error) {
      this.logger.error(`Failed to handle recovered rule ${rule.name}: ${error.message}`);
    }
  }

  /**
   * Cria novo alerta
   * Creates new alert
   */
  private async createNewAlert(
    rule: AlertRule, 
    metrics: DeviceMetrics, 
    context: Record<string, any>
  ): Promise<Alert> {
    try {
      // Generate alert content with variables
      const variables = {
        hostname: metrics.hostname,
        ip: metrics.ip,
        status: metrics.status,
        ...context,
      };

      const title = this.interpolateTemplate(rule.translations.pt.title, variables);
      const message = this.interpolateTemplate(rule.translations.pt.message, variables);

      const alertData = {
        id: uuidv4(),
        ruleId: rule.id,
        deviceId: metrics.deviceId,
        severity: rule.severity,
        state: 'open' as AlertState,
        title,
        message,
        details: JSON.stringify(context),
        metadata: rule.metadata ? JSON.stringify(rule.metadata) : null,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        occurrences: 1,
        notificationsSent: 0,
        escalationLevel: 0,
        correlationKey: this.generateCorrelationKey(rule, metrics),
        translations: JSON.stringify(rule.translations),
      };

      const alert = await this.prisma.alert.create({
        data: alertData,
      });

      // Add to correlation tracking
      const correlationKey = alertData.correlationKey;
      if (correlationKey) {
        const correlatedAlerts = this.correlationKeys.get(correlationKey) || [];
        correlatedAlerts.push(this.mapToAlert(alert));
        this.correlationKeys.set(correlationKey, correlatedAlerts);
      }

      // Create history entry
      await this.createAlertHistory(alert.id, 'created', undefined, 'open', 'system');

      // Send notifications
      await this.notificationService.sendAlertNotifications(this.mapToAlert(alert));

      this.logger.log(`Created alert: ${title} for device ${metrics.hostname}`);

      return this.mapToAlert(alert);
    } catch (error) {
      this.logger.error(`Failed to create alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Atualiza alerta existente
   * Updates existing alert
   */
  private async updateExistingAlert(alert: any, context: Record<string, any>): Promise<void> {
    try {
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastOccurred: new Date(),
          occurrences: { increment: 1 },
          details: JSON.stringify(context),
        },
      });

      this.logger.debug(`Updated existing alert ${alert.id}`);
    } catch (error) {
      this.logger.error(`Failed to update existing alert ${alert.id}: ${error.message}`);
    }
  }

  /**
   * Resolve um alerta
   * Resolves an alert
   */
  async resolveAlert(alertId: string, userId: string, note?: string, language: Language = 'pt'): Promise<Alert> {
    try {
      const alert = await this.prisma.alert.findUnique({
        where: { id: alertId },
      });

      if (!alert) {
        throw new Error(this.i18n.t('error.alert_not_found', language));
      }

      const updatedAlert = await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          state: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: userId,
          resolvedNote: note,
        },
      });

      // Create history entry
      await this.createAlertHistory(alertId, 'resolved', alert.state, 'resolved', userId, note);

      this.logger.log(`Resolved alert ${alertId} by ${userId}`);

      return this.mapToAlert(updatedAlert);
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Coleta métricas do dispositivo
   * Collects device metrics
   */
  private async collectDeviceMetrics(device: any): Promise<DeviceMetrics> {
    try {
      const snmpDevice = {
        hostname: device.ip,
        port: device.snmpPort || 161,
        timeout: device.snmpTimeout || 5000,
        retries: device.snmpRetries || 3,
        transport: 'udp' as const,
        version: device.snmpVersion,
        community: device.snmpCommunity,
      };

      // Test connectivity
      const connectivity = await this.snmpClient.testConnection(snmpDevice);
      const status = connectivity ? 'up' : 'down';

      // Get basic system info
      const systemInfo = connectivity ? await this.snmpClient.getSystemInfo(snmpDevice) : null;

      // Get interface info
      const interfaces = connectivity ? await this.snmpClient.getInterfaceInfo(snmpDevice) : [];

      const metrics: DeviceMetrics = {
        deviceId: device.id,
        hostname: device.hostname,
        ip: device.ip,
        status,
        responseTime: connectivity ? 100 : 0, // Simplified
        uptime: systemInfo?.sysUptime || 0,
        interfaces: interfaces || [],
        sensors: [], // Would be populated from sensors table
        timestamp: new Date(),
      };

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to collect metrics for device ${device.hostname}: ${error.message}`);
      
      // Return basic metrics with down status
      return {
        deviceId: device.id,
        hostname: device.hostname,
        ip: device.ip,
        status: 'down',
        responseTime: 0,
        interfaces: [],
        sensors: [],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Gera chave de correlação
   * Generates correlation key
   */
  private generateCorrelationKey(rule: AlertRule, metrics: DeviceMetrics): string {
    return `${rule.id}_${metrics.deviceId}`;
  }

  /**
   * Interpola template com variáveis
   * Interpolates template with variables
   */
  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(variables[key]));
    });

    return result;
  }

  /**
   * Cria entrada no histórico
   * Creates history entry
   */
  private async createAlertHistory(
    alertId: string,
    action: string,
    previousState?: string,
    newState?: string,
    userId?: string,
    note?: string
  ): Promise<void> {
    try {
      await this.prisma.alertHistory.create({
        data: {
          id: uuidv4(),
          alertId,
          action,
          previousState,
          newState,
          userId,
          userName: userId === 'system' ? 'System' : undefined,
          note,
          timestamp: new Date(),
          language: 'pt',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create alert history: ${error.message}`);
    }
  }

  /**
   * Limpa dados antigos
   * Cleans up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Clean up correlation keys
      for (const [key, alerts] of this.correlationKeys.entries()) {
        const recentAlerts = alerts.filter(alert => alert.lastOccurred > oneDayAgo);
        if (recentAlerts.length === 0) {
          this.correlationKeys.delete(key);
        } else {
          this.correlationKeys.set(key, recentAlerts);
        }
      }

      // Clean up suppressions
      const now = new Date();
      for (const [key, expiry] of this.suppressions.entries()) {
        if (now >= expiry) {
          this.suppressions.delete(key);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old data: ${error.message}`);
    }
  }

  /**
   * Mapeia dados do banco para interface Alert
   * Maps database data to Alert interface
   */
  private mapToAlert(alertData: any): Alert {
    return {
      id: alertData.id,
      ruleId: alertData.ruleId,
      rule: undefined as any, // Would be populated as needed
      deviceId: alertData.deviceId,
      severity: alertData.severity,
      state: alertData.state,
      title: alertData.title,
      message: alertData.message,
      details: alertData.details ? JSON.parse(alertData.details) : {},
      metadata: alertData.metadata ? JSON.parse(alertData.metadata) : undefined,
      firstOccurred: alertData.firstOccurred,
      lastOccurred: alertData.lastOccurred,
      acknowledgedAt: alertData.acknowledgedAt,
      acknowledgedBy: alertData.acknowledgedBy,
      acknowledgedNote: alertData.acknowledgedNote,
      resolvedAt: alertData.resolvedAt,
      resolvedBy: alertData.resolvedBy,
      resolvedNote: alertData.resolvedNote,
      suppressedUntil: alertData.suppressedUntil,
      suppressedBy: alertData.suppressedBy,
      suppressedReason: alertData.suppressedReason,
      occurrences: alertData.occurrences,
      notificationsSent: alertData.notificationsSent,
      lastNotificationSent: alertData.lastNotificationSent,
      escalationLevel: alertData.escalationLevel,
      correlationKey: alertData.correlationKey,
      translations: alertData.translations ? JSON.parse(alertData.translations) : {
        pt: { title: alertData.title, description: '', message: alertData.message },
        en: { title: alertData.title, description: '', message: alertData.message },
      },
    };
  }
}