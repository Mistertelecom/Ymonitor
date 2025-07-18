// Alert Interfaces for Y Monitor
// Sistema de alertas avançado com suporte a múltiplos idiomas

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'ok';
export type AlertState = 'open' | 'acknowledged' | 'resolved' | 'suppressed';
export type AlertTransportType = 'email' | 'webhook' | 'slack' | 'telegram' | 'sms' | 'teams';
export type AlertRuleOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'not_like' | 'in' | 'not_in';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  query: string;
  severity: AlertSeverity;
  enabled: boolean;
  deviceGroup?: string;
  deviceFilter?: AlertDeviceFilter;
  conditions: AlertCondition[];
  delay?: number; // seconds
  interval?: number; // seconds
  recovery?: boolean;
  acknowledgeable: boolean;
  suppressable: boolean;
  template?: string;
  translations: AlertTranslations;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface AlertCondition {
  field: string;
  operator: AlertRuleOperator;
  value: any;
  logical?: 'AND' | 'OR';
}

export interface AlertDeviceFilter {
  hostname?: string[];
  ip?: string[];
  os?: string[];
  type?: string[];
  groups?: string[];
  location?: string[];
  exclude?: boolean;
}

export interface AlertTranslations {
  pt: AlertTranslation;
  en: AlertTranslation;
}

export interface AlertTranslation {
  title: string;
  description: string;
  message: string;
  resolution?: string;
  variables?: Record<string, string>;
}

export interface Alert {
  id: string;
  ruleId: string;
  rule: AlertRule;
  deviceId: string;
  device?: any;
  severity: AlertSeverity;
  state: AlertState;
  title: string;
  message: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
  firstOccurred: Date;
  lastOccurred: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedNote?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolvedNote?: string;
  suppressedUntil?: Date;
  suppressedBy?: string;
  suppressedReason?: string;
  occurrences: number;
  notificationsSent: number;
  lastNotificationSent?: Date;
  escalationLevel: number;
  correlationKey?: string;
  translations: AlertTranslations;
}

export interface AlertTransport {
  id: string;
  name: string;
  type: AlertTransportType;
  enabled: boolean;
  config: AlertTransportConfig;
  conditions?: AlertTransportCondition[];
  translations: {
    pt: { name: string; description?: string };
    en: { name: string; description?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertTransportConfig {
  // Email config
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  template?: string;
  
  // Webhook config
  url?: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: string;
  
  // Slack config
  webhook_url?: string;
  channel?: string;
  username?: string;
  icon?: string;
  
  // Telegram config
  token?: string;
  chat_id?: string;
  
  // SMS config
  provider?: string;
  api_key?: string;
  phone_numbers?: string[];
  
  // Teams config
  webhook_url_teams?: string;
}

export interface AlertTransportCondition {
  field: string;
  operator: AlertRuleOperator;
  value: any;
  logical?: 'AND' | 'OR';
}

export interface AlertEscalation {
  id: string;
  ruleId: string;
  level: number;
  delay: number; // minutes
  transports: string[];
  enabled: boolean;
  translations: {
    pt: { name: string; description?: string };
    en: { name: string; description?: string };
  };
}

export interface AlertTemplate {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'sms';
  subject?: string;
  body: string;
  variables: string[];
  translations: {
    pt: {
      name: string;
      subject?: string;
      body: string;
      description?: string;
    };
    en: {
      name: string;
      subject?: string;
      body: string;
      description?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertGroup {
  id: string;
  name: string;
  description?: string;
  rules: string[];
  correlationKey: string;
  timeWindow: number; // minutes
  maxAlerts: number;
  enabled: boolean;
  translations: {
    pt: { name: string; description?: string };
    en: { name: string; description?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  transportId: string;
  transport: AlertTransport;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: Date;
  sentAt?: Date;
  error?: string;
  response?: string;
  language: 'pt' | 'en';
  escalationLevel: number;
  metadata?: Record<string, any>;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  action: 'created' | 'acknowledged' | 'resolved' | 'suppressed' | 'escalated' | 'notification_sent' | 'state_changed';
  previousState?: AlertState;
  newState?: AlertState;
  userId?: string;
  userName?: string;
  note?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  language: 'pt' | 'en';
}

export interface AlertStats {
  total: number;
  byState: Record<AlertState, number>;
  bySeverity: Record<AlertSeverity, number>;
  byDevice: Record<string, number>;
  byRule: Record<string, number>;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  mttr: number; // Mean Time To Resolution (minutes)
  mtbf: number; // Mean Time Between Failures (minutes)
}

export interface AlertDashboard {
  activeAlerts: Alert[];
  criticalCount: number;
  warningCount: number;
  acknowledgedCount: number;
  topDevices: Array<{ deviceId: string; deviceName: string; count: number }>;
  topRules: Array<{ ruleId: string; ruleName: string; count: number }>;
  recentActivity: AlertHistory[];
  trends: {
    hourly: Array<{ hour: string; count: number }>;
    daily: Array<{ date: string; count: number }>;
  };
}

export interface AlertService {
  // Rules management
  createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule>;
  updateRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<AlertRule | null>;
  getRules(filters?: AlertRuleFilters): Promise<AlertRule[]>;
  
  // Alerts management
  createAlert(alert: Omit<Alert, 'id' | 'firstOccurred' | 'lastOccurred'>): Promise<Alert>;
  getAlert(id: string, language?: 'pt' | 'en'): Promise<Alert | null>;
  getAlerts(filters?: AlertFilters, language?: 'pt' | 'en'): Promise<Alert[]>;
  acknowledgeAlert(id: string, userId: string, note?: string, language?: 'pt' | 'en'): Promise<Alert>;
  resolveAlert(id: string, userId: string, note?: string, language?: 'pt' | 'en'): Promise<Alert>;
  suppressAlert(id: string, until: Date, userId: string, reason?: string, language?: 'pt' | 'en'): Promise<Alert>;
  
  // Transports management
  createTransport(transport: Omit<AlertTransport, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertTransport>;
  updateTransport(id: string, updates: Partial<AlertTransport>): Promise<AlertTransport>;
  deleteTransport(id: string): Promise<void>;
  getTransports(): Promise<AlertTransport[]>;
  testTransport(id: string, language?: 'pt' | 'en'): Promise<boolean>;
  
  // Templates management
  createTemplate(template: Omit<AlertTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertTemplate>;
  getTemplates(type?: string): Promise<AlertTemplate[]>;
  renderTemplate(templateId: string, variables: Record<string, any>, language?: 'pt' | 'en'): Promise<string>;
  
  // Notifications
  sendNotification(alertId: string, transportIds?: string[], language?: 'pt' | 'en'): Promise<void>;
  
  // Statistics
  getStats(filters?: AlertStatsFilters): Promise<AlertStats>;
  getDashboard(language?: 'pt' | 'en'): Promise<AlertDashboard>;
}

export interface AlertRuleFilters {
  enabled?: boolean;
  severity?: AlertSeverity[];
  deviceGroup?: string;
  createdBy?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AlertFilters {
  state?: AlertState[];
  severity?: AlertSeverity[];
  deviceId?: string;
  ruleId?: string;
  startDate?: Date;
  endDate?: Date;
  acknowledged?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AlertStatsFilters {
  startDate?: Date;
  endDate?: Date;
  deviceIds?: string[];
  ruleIds?: string[];
  severity?: AlertSeverity[];
}