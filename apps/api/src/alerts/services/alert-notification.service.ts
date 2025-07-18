// Alert Notification Service for Y Monitor
// Serviço de notificações com múltiplos transportes

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService, Language } from './i18n.service';
import { 
  Alert, 
  AlertTransport, 
  AlertNotification, 
  AlertTemplate,
  AlertTransportType,
  AlertTransportConfig 
} from '../interfaces/alert.interface';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AlertNotificationService {
  private readonly logger = new Logger(AlertNotificationService.name);
  private readonly emailTransporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpService: HttpService,
    private i18n: I18nService,
  ) {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: this.configService.get('SMTP_SECURE', false),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  /**
   * Envia notificações para um alerta
   * Sends notifications for an alert
   */
  async sendAlertNotifications(
    alert: Alert, 
    transportIds?: string[], 
    language: Language = 'pt'
  ): Promise<void> {
    try {
      // Get applicable transports
      const transports = await this.getApplicableTransports(alert, transportIds);

      // Send notification to each transport
      for (const transport of transports) {
        try {
          await this.sendNotification(alert, transport, language);
        } catch (error) {
          this.logger.error(
            `Failed to send notification via ${transport.type} for alert ${alert.id}: ${error.message}`
          );
        }
      }

      // Update alert notification count
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: {
          notificationsSent: { increment: transports.length },
          lastNotificationSent: new Date(),
        },
      });

    } catch (error) {
      this.logger.error(`Failed to send alert notifications for ${alert.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia notificação individual
   * Sends individual notification
   */
  private async sendNotification(
    alert: Alert, 
    transport: AlertTransport, 
    language: Language
  ): Promise<void> {
    // Create notification record
    const notification: AlertNotification = {
      id: uuidv4(),
      alertId: alert.id,
      transportId: transport.id,
      transport,
      status: 'pending',
      attempts: 0,
      language,
      escalationLevel: alert.escalationLevel,
    };

    try {
      await this.prisma.alertNotification.create({
        data: {
          id: notification.id,
          alertId: notification.alertId,
          transportId: notification.transportId,
          status: notification.status,
          attempts: notification.attempts,
          language: notification.language,
          escalationLevel: notification.escalationLevel,
        },
      });

      // Send notification based on transport type
      switch (transport.type) {
        case 'email':
          await this.sendEmailNotification(alert, transport, notification, language);
          break;
        case 'webhook':
          await this.sendWebhookNotification(alert, transport, notification, language);
          break;
        case 'slack':
          await this.sendSlackNotification(alert, transport, notification, language);
          break;
        case 'telegram':
          await this.sendTelegramNotification(alert, transport, notification, language);
          break;
        case 'sms':
          await this.sendSMSNotification(alert, transport, notification, language);
          break;
        case 'teams':
          await this.sendTeamsNotification(alert, transport, notification, language);
          break;
        default:
          throw new Error(`Unsupported transport type: ${transport.type}`);
      }

      // Mark as sent
      await this.updateNotificationStatus(notification.id, 'sent');

    } catch (error) {
      // Mark as failed
      await this.updateNotificationStatus(notification.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Envia notificação por email
   * Sends email notification
   */
  private async sendEmailNotification(
    alert: Alert,
    transport: AlertTransport,
    notification: AlertNotification,
    language: Language
  ): Promise<void> {
    try {
      const config = transport.config;
      const translation = alert.translations[language];

      // Generate email content
      const subject = this.interpolateTemplate(
        config.subject || this.i18n.t('email.subject.alert_triggered', language),
        this.getAlertVariables(alert, language)
      );

      let body: string;
      if (config.template) {
        // Use custom template
        const template = await this.getTemplate(config.template);
        body = await this.renderTemplate(template, alert, language);
      } else {
        // Use default template
        body = this.generateDefaultEmailBody(alert, language);
      }

      // Send email
      await this.emailTransporter.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: config.to,
        cc: config.cc,
        bcc: config.bcc,
        subject,
        html: body,
        headers: {
          'X-Y-Monitor-Alert-ID': alert.id,
          'X-Y-Monitor-Severity': alert.severity,
          'X-Y-Monitor-Device': alert.deviceId,
        },
      });

      this.logger.log(`Email notification sent for alert ${alert.id} to ${config.to?.join(', ')}`);

    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia notificação via webhook
   * Sends webhook notification
   */
  private async sendWebhookNotification(
    alert: Alert,
    transport: AlertTransport,
    notification: AlertNotification,
    language: Language
  ): Promise<void> {
    try {
      const config = transport.config;
      const translation = alert.translations[language];

      const payload = {
        alert: {
          id: alert.id,
          title: translation.title,
          message: translation.message,
          severity: alert.severity,
          state: alert.state,
          deviceId: alert.deviceId,
          timestamp: alert.firstOccurred,
          details: alert.details,
        },
        device: {
          id: alert.deviceId,
          // Would include device details
        },
        metadata: {
          language,
          notificationId: notification.id,
          transportId: transport.id,
        },
      };

      // Prepare request
      const requestConfig: any = {
        method: config.method || 'POST',
        url: config.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Y-Monitor/1.0',
          ...config.headers,
        },
      };

      if (config.method === 'POST' || config.method === 'PUT') {
        requestConfig.data = config.body ? 
          this.interpolateTemplate(config.body, payload) : 
          JSON.stringify(payload);
      }

      // Send webhook
      const response = await this.httpService.axiosRef.request(requestConfig);

      await this.updateNotificationResponse(notification.id, JSON.stringify(response.data));

      this.logger.log(`Webhook notification sent for alert ${alert.id} to ${config.url}`);

    } catch (error) {
      this.logger.error(`Failed to send webhook notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia notificação para Slack
   * Sends Slack notification
   */
  private async sendSlackNotification(
    alert: Alert,
    transport: AlertTransport,
    notification: AlertNotification,
    language: Language
  ): Promise<void> {
    try {
      const config = transport.config;
      const translation = alert.translations[language];

      const severityColors = {
        critical: '#FF0000',
        warning: '#FFA500',
        info: '#0080FF',
        ok: '#00FF00',
      };

      const payload = {
        channel: config.channel,
        username: config.username || 'Y Monitor',
        icon_emoji: config.icon || ':warning:',
        attachments: [
          {
            color: severityColors[alert.severity],
            title: translation.title,
            text: translation.message,
            fields: [
              {
                title: this.i18n.t('common.severity', language),
                value: this.i18n.t(`alert.severity.${alert.severity}`, language),
                short: true,
              },
              {
                title: this.i18n.t('common.device', language),
                value: alert.deviceId,
                short: true,
              },
              {
                title: this.i18n.t('common.timestamp', language),
                value: alert.firstOccurred.toISOString(),
                short: true,
              },
            ],
            footer: 'Y Monitor',
            ts: Math.floor(alert.firstOccurred.getTime() / 1000),
          },
        ],
      };

      // Send to Slack
      await this.httpService.axiosRef.post(config.webhook_url!, payload);

      this.logger.log(`Slack notification sent for alert ${alert.id} to ${config.channel}`);

    } catch (error) {
      this.logger.error(`Failed to send Slack notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia notificação para Telegram
   * Sends Telegram notification
   */
  private async sendTelegramNotification(
    alert: Alert,
    transport: AlertTransport,
    notification: AlertNotification,
    language: Language
  ): Promise<void> {
    try {
      const config = transport.config;
      const translation = alert.translations[language];

      const severityEmojis = {
        critical: '🔴',
        warning: '🟡',
        info: '🔵',
        ok: '🟢',
      };

      const message = `${severityEmojis[alert.severity]} *${translation.title}*\n\n` +
        `${translation.message}\n\n` +
        `*${this.i18n.t('common.severity', language)}:* ${this.i18n.t(`alert.severity.${alert.severity}`, language)}\n` +
        `*${this.i18n.t('common.device', language)}:* ${alert.deviceId}\n` +
        `*${this.i18n.t('common.timestamp', language)}:* ${alert.firstOccurred.toLocaleString()}`;

      const payload = {
        chat_id: config.chat_id,
        text: message,
        parse_mode: 'Markdown',
      };

      // Send to Telegram
      const telegramUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
      await this.httpService.axiosRef.post(telegramUrl, payload);

      this.logger.log(`Telegram notification sent for alert ${alert.id} to ${config.chat_id}`);

    } catch (error) {
      this.logger.error(`Failed to send Telegram notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia notificação por SMS
   * Sends SMS notification
   */
  private async sendSMSNotification(
    alert: Alert,
    transport: AlertTransport,
    notification: AlertNotification,
    language: Language
  ): Promise<void> {
    try {
      const config = transport.config;
      const translation = alert.translations[language];

      // Simplified SMS message
      const message = `${this.i18n.t(`alert.severity.${alert.severity}`, language)}: ${translation.title} - ${alert.deviceId}`;

      // This would integrate with an SMS provider (Twilio, AWS SNS, etc.)
      // For now, just log the message
      this.logger.log(`SMS notification would be sent: ${message} to ${config.phone_numbers?.join(', ')}`);

      // Placeholder for actual SMS sending
      // await this.smsProvider.send(config.phone_numbers, message);

    } catch (error) {
      this.logger.error(`Failed to send SMS notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia notificação para Microsoft Teams
   * Sends Microsoft Teams notification
   */
  private async sendTeamsNotification(
    alert: Alert,
    transport: AlertTransport,
    notification: AlertNotification,
    language: Language
  ): Promise<void> {
    try {
      const config = transport.config;
      const translation = alert.translations[language];

      const severityColors = {
        critical: 'attention',
        warning: 'warning',
        info: 'accent',
        ok: 'good',
      };

      const payload = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: translation.title,
        themeColor: severityColors[alert.severity],
        sections: [
          {
            activityTitle: translation.title,
            activitySubtitle: translation.message,
            facts: [
              {
                name: this.i18n.t('common.severity', language),
                value: this.i18n.t(`alert.severity.${alert.severity}`, language),
              },
              {
                name: this.i18n.t('common.device', language),
                value: alert.deviceId,
              },
              {
                name: this.i18n.t('common.timestamp', language),
                value: alert.firstOccurred.toISOString(),
              },
            ],
          },
        ],
      };

      // Send to Teams
      await this.httpService.axiosRef.post(config.webhook_url_teams!, payload);

      this.logger.log(`Teams notification sent for alert ${alert.id}`);

    } catch (error) {
      this.logger.error(`Failed to send Teams notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém transportes aplicáveis para um alerta
   * Gets applicable transports for an alert
   */
  private async getApplicableTransports(alert: Alert, transportIds?: string[]): Promise<AlertTransport[]> {
    try {
      const where: any = { enabled: true };

      if (transportIds && transportIds.length > 0) {
        where.id = { in: transportIds };
      }

      const transports = await this.prisma.alertTransport.findMany({
        where,
      });

      return transports
        .map(this.mapToAlertTransport)
        .filter(transport => this.doesTransportApplyToAlert(transport, alert));

    } catch (error) {
      this.logger.error(`Failed to get applicable transports: ${error.message}`);
      return [];
    }
  }

  /**
   * Verifica se transporte se aplica ao alerta
   * Checks if transport applies to alert
   */
  private doesTransportApplyToAlert(transport: AlertTransport, alert: Alert): boolean {
    if (!transport.conditions || transport.conditions.length === 0) {
      return true; // No conditions = applies to all alerts
    }

    // Evaluate transport conditions
    for (const condition of transport.conditions) {
      const value = this.getAlertValue(condition.field, alert);
      if (!this.evaluateCondition(condition.operator, value, condition.value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtém valor do alerta para condição
   * Gets alert value for condition
   */
  private getAlertValue(field: string, alert: Alert): any {
    switch (field) {
      case 'severity': return alert.severity;
      case 'state': return alert.state;
      case 'deviceId': return alert.deviceId;
      case 'ruleId': return alert.ruleId;
      default: return null;
    }
  }

  /**
   * Avalia condição
   * Evaluates condition
   */
  private evaluateCondition(operator: string, actual: any, expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  /**
   * Obtém template de notificação
   * Gets notification template
   */
  private async getTemplate(templateId: string): Promise<AlertTemplate | null> {
    try {
      const template = await this.prisma.alertTemplate.findUnique({
        where: { id: templateId },
      });

      return template ? this.mapToAlertTemplate(template) : null;
    } catch (error) {
      this.logger.error(`Failed to get template ${templateId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Renderiza template com dados do alerta
   * Renders template with alert data
   */
  private async renderTemplate(
    template: AlertTemplate, 
    alert: Alert, 
    language: Language
  ): Promise<string> {
    const translation = template.translations[language];
    const variables = this.getAlertVariables(alert, language);
    
    return this.interpolateTemplate(translation.body, variables);
  }

  /**
   * Gera corpo de email padrão
   * Generates default email body
   */
  private generateDefaultEmailBody(alert: Alert, language: Language): string {
    const translation = alert.translations[language];
    
    return `
      <h2>${translation.title}</h2>
      <p>${translation.message}</p>
      
      <h3>${this.i18n.t('common.details', language)}</h3>
      <ul>
        <li><strong>${this.i18n.t('common.severity', language)}:</strong> ${this.i18n.t(`alert.severity.${alert.severity}`, language)}</li>
        <li><strong>${this.i18n.t('common.device', language)}:</strong> ${alert.deviceId}</li>
        <li><strong>${this.i18n.t('common.timestamp', language)}:</strong> ${alert.firstOccurred.toLocaleString()}</li>
        <li><strong>${this.i18n.t('alert.occurrences', language)}:</strong> ${alert.occurrences}</li>
      </ul>
      
      <p><em>Y Monitor - Sistema de Monitoramento de Rede</em></p>
    `;
  }

  /**
   * Obtém variáveis do alerta para interpolação
   * Gets alert variables for interpolation
   */
  private getAlertVariables(alert: Alert, language: Language): Record<string, any> {
    return {
      id: alert.id,
      title: alert.translations[language].title,
      message: alert.translations[language].message,
      severity: this.i18n.t(`alert.severity.${alert.severity}`, language),
      state: this.i18n.t(`alert.state.${alert.state}`, language),
      deviceId: alert.deviceId,
      timestamp: alert.firstOccurred.toLocaleString(),
      occurrences: alert.occurrences,
      ...alert.details,
    };
  }

  /**
   * Interpola template com variáveis
   * Interpolates template with variables
   */
  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(variables[key] || ''));
    });

    return result;
  }

  /**
   * Atualiza status da notificação
   * Updates notification status
   */
  private async updateNotificationStatus(
    notificationId: string, 
    status: 'pending' | 'sent' | 'failed', 
    error?: string
  ): Promise<void> {
    try {
      await this.prisma.alertNotification.update({
        where: { id: notificationId },
        data: {
          status,
          error,
          lastAttempt: new Date(),
          sentAt: status === 'sent' ? new Date() : undefined,
          attempts: { increment: 1 },
        },
      });
    } catch (updateError) {
      this.logger.error(`Failed to update notification status: ${updateError.message}`);
    }
  }

  /**
   * Atualiza resposta da notificação
   * Updates notification response
   */
  private async updateNotificationResponse(notificationId: string, response: string): Promise<void> {
    try {
      await this.prisma.alertNotification.update({
        where: { id: notificationId },
        data: { response },
      });
    } catch (error) {
      this.logger.error(`Failed to update notification response: ${error.message}`);
    }
  }

  /**
   * Mapeia dados do banco para AlertTransport
   * Maps database data to AlertTransport
   */
  private mapToAlertTransport(data: any): AlertTransport {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      enabled: data.enabled,
      config: JSON.parse(data.config),
      conditions: data.conditions ? JSON.parse(data.conditions) : undefined,
      translations: JSON.parse(data.translations),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Mapeia dados do banco para AlertTemplate
   * Maps database data to AlertTemplate
   */
  private mapToAlertTemplate(data: any): AlertTemplate {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      subject: data.subject,
      body: data.body,
      variables: JSON.parse(data.variables),
      translations: JSON.parse(data.translations),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}