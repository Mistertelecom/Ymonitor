// Alerts Controller for Y Monitor
// API REST para sistema de alertas com suporte a múltiplos idiomas

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Logger,
  HttpStatus,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User, UserFromJwt } from '../../auth/user.decorator';
import { AlertRuleService } from '../services/alert-rule.service';
import { AlertEngineService } from '../services/alert-engine.service';
import { AlertNotificationService } from '../services/alert-notification.service';
import { I18nService, Language } from '../services/i18n.service';
import { 
  Alert, 
  AlertRule, 
  AlertRuleFilters, 
  AlertFilters,
  AlertTransport,
  AlertTemplate,
  AlertStats,
  AlertDashboard,
  AlertSeverity,
  AlertState 
} from '../interfaces/alert.interface';

@ApiTags('Alerts / Alertas')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(
    private readonly alertRuleService: AlertRuleService,
    private readonly alertEngineService: AlertEngineService,
    private readonly notificationService: AlertNotificationService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Obtém idioma preferido do usuário
   * Gets user preferred language
   */
  private getLanguage(
    userLanguage?: string,
    acceptLanguage?: string
  ): Language {
    return this.i18n.getDefaultLanguage(userLanguage, acceptLanguage);
  }

  // ================== ALERT RULES / REGRAS DE ALERTAS ==================

  @Post('rules')
  @ApiOperation({ 
    summary: 'Create alert rule / Criar regra de alerta',
    description: 'Creates a new alert rule with multilingual support / Cria uma nova regra de alerta com suporte multilíngue'
  })
  @ApiHeader({ name: 'Accept-Language', required: false, description: 'Language preference (pt/en)' })
  @ApiResponse({ status: 201, description: 'Rule created successfully / Regra criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Invalid rule data / Dados da regra inválidos' })
  async createRule(
    @Body() createRuleDto: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
    @User() user: UserFromJwt,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{ 
    success: boolean; 
    message: string; 
    data: AlertRule 
  }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      
      const rule = await this.alertRuleService.createRule({
        ...createRuleDto,
        createdBy: user.id,
      }, language);

      return {
        success: true,
        message: this.i18n.t('success.rule_created', language),
        data: rule,
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      this.logger.error(`Failed to create alert rule: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.rule_creation_failed', language),
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('rules')
  @ApiOperation({ 
    summary: 'Get alert rules / Obter regras de alertas',
    description: 'Retrieves alert rules with filtering / Recupera regras de alertas com filtros'
  })
  @ApiQuery({ name: 'enabled', required: false, description: 'Filter by enabled status' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by severity' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  @ApiHeader({ name: 'Accept-Language', required: false })
  async getRules(
    @Query() query: AlertRuleFilters,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{
    success: boolean;
    data: AlertRule[];
    total: number;
    language: Language;
  }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      const rules = await this.alertRuleService.getRules(query);

      return {
        success: true,
        data: rules,
        total: rules.length,
        language,
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      this.logger.error(`Failed to get alert rules: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.rules_fetch_failed', language),
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get alert rule by ID / Obter regra por ID' })
  @ApiParam({ name: 'id', description: 'Rule ID / ID da regra' })
  async getRule(
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{ success: boolean; data: AlertRule | null; language: Language }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      const rule = await this.alertRuleService.getRule(id, language);

      if (!rule) {
        throw new HttpException(
          {
            success: false,
            message: this.i18n.t('error.rule_not_found', language),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: rule,
        language,
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      if (error instanceof HttpException) throw error;
      
      this.logger.error(`Failed to get alert rule ${id}: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.rule_fetch_failed', language),
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('rules/:id')
  @ApiOperation({ summary: 'Update alert rule / Atualizar regra de alerta' })
  @ApiParam({ name: 'id', description: 'Rule ID / ID da regra' })
  async updateRule(
    @Param('id') id: string,
    @Body() updateData: Partial<AlertRule>,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{ success: boolean; message: string; data: AlertRule }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      const rule = await this.alertRuleService.updateRule(id, updateData, language);

      return {
        success: true,
        message: this.i18n.t('success.rule_updated', language),
        data: rule,
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      this.logger.error(`Failed to update alert rule ${id}: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.rule_update_failed', language),
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete alert rule / Excluir regra de alerta' })
  @ApiParam({ name: 'id', description: 'Rule ID / ID da regra' })
  async deleteRule(
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      await this.alertRuleService.deleteRule(id, language);

      return {
        success: true,
        message: this.i18n.t('success.rule_deleted', language),
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      this.logger.error(`Failed to delete alert rule ${id}: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.rule_deletion_failed', language),
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('rules/:id/test')
  @ApiOperation({ summary: 'Test alert rule / Testar regra de alerta' })
  @ApiParam({ name: 'id', description: 'Rule ID / ID da regra' })
  async testRule(
    @Param('id') id: string,
    @Body() testData: { deviceId?: string } = {},
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{ 
    success: boolean; 
    data: { triggered: boolean; conditions: any[]; message: string };
    language: Language;
  }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      const result = await this.alertRuleService.testRule(id, testData.deviceId, language);

      return {
        success: true,
        data: result,
        language,
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      this.logger.error(`Failed to test alert rule ${id}: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.rule_test_failed', language),
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id/resolve')
  @ApiOperation({ summary: 'Resolve alert / Resolver alerta' })
  @ApiParam({ name: 'id', description: 'Alert ID / ID do alerta' })
  async resolveAlert(
    @Param('id') id: string,
    @Body() resolveData: { note?: string },
    @User() user: UserFromJwt,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-language') userLanguage?: string,
  ): Promise<{ success: boolean; message: string; data: Alert }> {
    try {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      const alert = await this.alertEngineService.resolveAlert(id, user.id, resolveData.note, language);

      return {
        success: true,
        message: this.i18n.t('success.alert_resolved', language),
        data: alert,
      };
    } catch (error) {
      const language = this.getLanguage(userLanguage, acceptLanguage);
      this.logger.error(`Failed to resolve alert ${id}: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: this.i18n.t('error.alert_resolve_failed', language),
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('languages')
  @ApiOperation({ 
    summary: 'Get supported languages / Obter idiomas suportados',
    description: 'Returns list of supported languages / Retorna lista de idiomas suportados'
  })
  getSupportedLanguages(): {
    success: boolean;
    data: Array<{ code: Language; name: string; nativeName: string }>;
  } {
    return {
      success: true,
      data: this.i18n.getSupportedLanguages(),
    };
  }
}