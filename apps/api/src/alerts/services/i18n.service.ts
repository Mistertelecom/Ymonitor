// Internationalization Service for Y Monitor
// Serviço de internacionalização com suporte a português e inglês

import { Injectable, Logger } from '@nestjs/common';

export type Language = 'pt' | 'en';

export interface I18nTranslations {
  [key: string]: {
    pt: string;
    en: string;
  };
}

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  
  private readonly translations: I18nTranslations = {
    // Alert Severities / Severidades dos Alertas
    'alert.severity.critical': {
      pt: 'Crítico',
      en: 'Critical'
    },
    'alert.severity.warning': {
      pt: 'Aviso',
      en: 'Warning'
    },
    'alert.severity.info': {
      pt: 'Informação',
      en: 'Info'
    },
    'alert.severity.ok': {
      pt: 'OK',
      en: 'OK'
    },

    // Alert States / Estados dos Alertas
    'alert.state.open': {
      pt: 'Aberto',
      en: 'Open'
    },
    'alert.state.acknowledged': {
      pt: 'Reconhecido',
      en: 'Acknowledged'
    },
    'alert.state.resolved': {
      pt: 'Resolvido',
      en: 'Resolved'
    },
    'alert.state.suppressed': {
      pt: 'Suprimido',
      en: 'Suppressed'
    },

    // Alert Actions / Ações dos Alertas
    'alert.action.acknowledge': {
      pt: 'Reconhecer',
      en: 'Acknowledge'
    },
    'alert.action.resolve': {
      pt: 'Resolver',
      en: 'Resolve'
    },
    'alert.action.suppress': {
      pt: 'Suprimir',
      en: 'Suppress'
    },
    'alert.action.escalate': {
      pt: 'Escalar',
      en: 'Escalate'
    },

    // Alert Messages / Mensagens de Alerta
    'alert.message.device_down': {
      pt: 'Dispositivo {{hostname}} ({{ip}}) está inacessível há {{duration}}',
      en: 'Device {{hostname}} ({{ip}}) has been unreachable for {{duration}}'
    },
    'alert.message.high_cpu': {
      pt: 'CPU do dispositivo {{hostname}} está em {{value}}% (limite: {{threshold}}%)',
      en: 'Device {{hostname}} CPU is at {{value}}% (threshold: {{threshold}}%)'
    },
    'alert.message.high_memory': {
      pt: 'Memória do dispositivo {{hostname}} está em {{value}}% (limite: {{threshold}}%)',
      en: 'Device {{hostname}} memory is at {{value}}% (threshold: {{threshold}}%)'
    },
    'alert.message.interface_down': {
      pt: 'Interface {{interface}} do dispositivo {{hostname}} está inativa',
      en: 'Interface {{interface}} on device {{hostname}} is down'
    },
    'alert.message.high_temperature': {
      pt: 'Temperatura do sensor {{sensor}} em {{hostname}} está em {{value}}°C (limite: {{threshold}}°C)',
      en: 'Temperature sensor {{sensor}} on {{hostname}} is at {{value}}°C (threshold: {{threshold}}°C)'
    },
    'alert.message.low_disk_space': {
      pt: 'Espaço em disco {{disk}} do dispositivo {{hostname}} está em {{value}}% (limite: {{threshold}}%)',
      en: 'Disk space {{disk}} on device {{hostname}} is at {{value}}% (threshold: {{threshold}}%)'
    },
    'alert.message.high_bandwidth': {
      pt: 'Utilização de banda da interface {{interface}} em {{hostname}} está em {{value}}% (limite: {{threshold}}%)',
      en: 'Bandwidth utilization on interface {{interface}} of {{hostname}} is at {{value}}% (threshold: {{threshold}}%)'
    },

    // Transport Types / Tipos de Transporte
    'transport.type.email': {
      pt: 'E-mail',
      en: 'Email'
    },
    'transport.type.webhook': {
      pt: 'Webhook',
      en: 'Webhook'
    },
    'transport.type.slack': {
      pt: 'Slack',
      en: 'Slack'
    },
    'transport.type.telegram': {
      pt: 'Telegram',
      en: 'Telegram'
    },
    'transport.type.sms': {
      pt: 'SMS',
      en: 'SMS'
    },
    'transport.type.teams': {
      pt: 'Microsoft Teams',
      en: 'Microsoft Teams'
    },

    // History Actions / Ações do Histórico
    'history.action.created': {
      pt: 'Alerta criado',
      en: 'Alert created'
    },
    'history.action.acknowledged': {
      pt: 'Alerta reconhecido',
      en: 'Alert acknowledged'
    },
    'history.action.resolved': {
      pt: 'Alerta resolvido',
      en: 'Alert resolved'
    },
    'history.action.suppressed': {
      pt: 'Alerta suprimido',
      en: 'Alert suppressed'
    },
    'history.action.escalated': {
      pt: 'Alerta escalado',
      en: 'Alert escalated'
    },
    'history.action.notification_sent': {
      pt: 'Notificação enviada',
      en: 'Notification sent'
    },
    'history.action.state_changed': {
      pt: 'Estado alterado',
      en: 'State changed'
    },

    // Email Templates / Templates de E-mail
    'email.subject.alert_triggered': {
      pt: '[{{severity}}] {{title}} - {{hostname}}',
      en: '[{{severity}}] {{title}} - {{hostname}}'
    },
    'email.subject.alert_resolved': {
      pt: '[RESOLVIDO] {{title}} - {{hostname}}',
      en: '[RESOLVED] {{title}} - {{hostname}}'
    },
    
    // Common Terms / Termos Comuns
    'common.device': {
      pt: 'Dispositivo',
      en: 'Device'
    },
    'common.hostname': {
      pt: 'Nome do Host',
      en: 'Hostname'
    },
    'common.ip_address': {
      pt: 'Endereço IP',
      en: 'IP Address'
    },
    'common.interface': {
      pt: 'Interface',
      en: 'Interface'
    },
    'common.sensor': {
      pt: 'Sensor',
      en: 'Sensor'
    },
    'common.value': {
      pt: 'Valor',
      en: 'Value'
    },
    'common.threshold': {
      pt: 'Limite',
      en: 'Threshold'
    },
    'common.duration': {
      pt: 'Duração',
      en: 'Duration'
    },
    'common.timestamp': {
      pt: 'Data/Hora',
      en: 'Timestamp'
    },
    'common.user': {
      pt: 'Usuário',
      en: 'User'
    },
    'common.note': {
      pt: 'Nota',
      en: 'Note'
    },
    'common.reason': {
      pt: 'Motivo',
      en: 'Reason'
    },

    // Dashboard Terms / Termos do Dashboard
    'dashboard.total_alerts': {
      pt: 'Total de Alertas',
      en: 'Total Alerts'
    },
    'dashboard.critical_alerts': {
      pt: 'Alertas Críticos',
      en: 'Critical Alerts'
    },
    'dashboard.warning_alerts': {
      pt: 'Alertas de Aviso',
      en: 'Warning Alerts'
    },
    'dashboard.acknowledged_alerts': {
      pt: 'Alertas Reconhecidos',
      en: 'Acknowledged Alerts'
    },
    'dashboard.recent_activity': {
      pt: 'Atividade Recente',
      en: 'Recent Activity'
    },
    'dashboard.top_devices': {
      pt: 'Principais Dispositivos',
      en: 'Top Devices'
    },
    'dashboard.top_rules': {
      pt: 'Principais Regras',
      en: 'Top Rules'
    },

    // Time Units / Unidades de Tempo
    'time.seconds': {
      pt: 'segundos',
      en: 'seconds'
    },
    'time.minutes': {
      pt: 'minutos',
      en: 'minutes'
    },
    'time.hours': {
      pt: 'horas',
      en: 'hours'
    },
    'time.days': {
      pt: 'dias',
      en: 'days'
    },
    'time.weeks': {
      pt: 'semanas',
      en: 'weeks'
    },
    'time.months': {
      pt: 'meses',
      en: 'months'
    },

    // Error Messages / Mensagens de Erro
    'error.alert_not_found': {
      pt: 'Alerta não encontrado',
      en: 'Alert not found'
    },
    'error.rule_not_found': {
      pt: 'Regra não encontrada',
      en: 'Rule not found'
    },
    'error.transport_not_found': {
      pt: 'Transporte não encontrado',
      en: 'Transport not found'
    },
    'error.template_not_found': {
      pt: 'Template não encontrado',
      en: 'Template not found'
    },
    'error.invalid_severity': {
      pt: 'Severidade inválida',
      en: 'Invalid severity'
    },
    'error.invalid_state': {
      pt: 'Estado inválido',
      en: 'Invalid state'
    },
    'error.notification_failed': {
      pt: 'Falha ao enviar notificação',
      en: 'Failed to send notification'
    },
    'error.permission_denied': {
      pt: 'Permissão negada',
      en: 'Permission denied'
    },

    // Success Messages / Mensagens de Sucesso
    'success.alert_acknowledged': {
      pt: 'Alerta reconhecido com sucesso',
      en: 'Alert acknowledged successfully'
    },
    'success.alert_resolved': {
      pt: 'Alerta resolvido com sucesso',
      en: 'Alert resolved successfully'
    },
    'success.alert_suppressed': {
      pt: 'Alerta suprimido com sucesso',
      en: 'Alert suppressed successfully'
    },
    'success.rule_created': {
      pt: 'Regra criada com sucesso',
      en: 'Rule created successfully'
    },
    'success.rule_updated': {
      pt: 'Regra atualizada com sucesso',
      en: 'Rule updated successfully'
    },
    'success.rule_deleted': {
      pt: 'Regra excluída com sucesso',
      en: 'Rule deleted successfully'
    },
    'success.transport_created': {
      pt: 'Transporte criado com sucesso',
      en: 'Transport created successfully'
    },
    'success.transport_tested': {
      pt: 'Transporte testado com sucesso',
      en: 'Transport tested successfully'
    },
    'success.notification_sent': {
      pt: 'Notificação enviada com sucesso',
      en: 'Notification sent successfully'
    }
  };

  /**
   * Traduz uma chave para o idioma especificado
   * Translates a key to the specified language
   */
  t(key: string, language: Language = 'pt', variables?: Record<string, any>): string {
    const translation = this.translations[key];
    
    if (!translation) {
      this.logger.warn(`Translation key not found: ${key}`);
      return key;
    }

    let text = translation[language];
    
    if (!text) {
      this.logger.warn(`Translation not found for language ${language}, key: ${key}`);
      text = translation['en'] || translation['pt'] || key;
    }

    // Replace variables in the text
    if (variables) {
      Object.keys(variables).forEach(variable => {
        const regex = new RegExp(`{{${variable}}}`, 'g');
        text = text.replace(regex, String(variables[variable]));
      });
    }

    return text;
  }

  /**
   * Retorna todas as traduções para uma chave
   * Returns all translations for a key
   */
  getTranslations(key: string): { pt: string; en: string } | null {
    const translation = this.translations[key];
    return translation || null;
  }

  /**
   * Adiciona ou atualiza uma tradução
   * Adds or updates a translation
   */
  addTranslation(key: string, translations: { pt: string; en: string }): void {
    this.translations[key] = translations;
  }

  /**
   * Formata duração em formato legível
   * Formats duration in human readable format
   */
  formatDuration(seconds: number, language: Language = 'pt'): string {
    const units = [
      { key: 'days', value: 86400 },
      { key: 'hours', value: 3600 },
      { key: 'minutes', value: 60 },
      { key: 'seconds', value: 1 }
    ];

    for (const unit of units) {
      const count = Math.floor(seconds / unit.value);
      if (count > 0) {
        const unitName = this.t(`time.${unit.key}`, language);
        return `${count} ${unitName}`;
      }
    }

    return `0 ${this.t('time.seconds', language)}`;
  }

  /**
   * Formata data/hora relativa
   * Formats relative date/time
   */
  formatRelativeTime(date: Date, language: Language = 'pt'): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return language === 'pt' ? 'agora' : 'now';
    }

    return this.formatDuration(diffInSeconds, language) + (language === 'pt' ? ' atrás' : ' ago');
  }

  /**
   * Valida se um idioma é suportado
   * Validates if a language is supported
   */
  isValidLanguage(language: string): language is Language {
    return language === 'pt' || language === 'en';
  }

  /**
   * Retorna o idioma padrão baseado no contexto
   * Returns default language based on context
   */
  getDefaultLanguage(userPreference?: string, acceptLanguage?: string): Language {
    // Check user preference first
    if (userPreference && this.isValidLanguage(userPreference)) {
      return userPreference;
    }

    // Check Accept-Language header
    if (acceptLanguage) {
      const languages = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().toLowerCase().substring(0, 2));
      
      for (const lang of languages) {
        if (this.isValidLanguage(lang)) {
          return lang;
        }
      }
    }

    // Default to Portuguese
    return 'pt';
  }

  /**
   * Obtém lista de idiomas suportados
   * Gets list of supported languages
   */
  getSupportedLanguages(): Array<{ code: Language; name: string; nativeName: string }> {
    return [
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'en', name: 'English', nativeName: 'English' }
    ];
  }
}