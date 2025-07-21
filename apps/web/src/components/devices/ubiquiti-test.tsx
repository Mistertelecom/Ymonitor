'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Wifi, 
  Network,
  Activity,
  Server,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface TestResult {
  connected: boolean;
  systemInfo?: any;
  interfaces?: any[];
  totalInterfaces?: number;
  error?: string;
}

export function UbiquitiTest() {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const testConnection = useMutation({
    mutationFn: async () => {
      const { apiClient, API_ENDPOINTS } = await import('@/lib/api-client');
      return apiClient.post<TestResult>(API_ENDPOINTS.DEVICE_TEST_UBIQUITI, {}, getAuthHeaders());
    },
    onSuccess: (data) => {
      setTestResult(data);
      logger.info('Ubiquiti test completed', { connected: data.connected });
    },
    onError: (error) => {
      logger.error('Failed to test Ubiquiti device', error as Error);
      setTestResult({ connected: false, error: (error as Error).message });
    },
  });

  const addDevice = useMutation({
    mutationFn: async () => {
      const { apiClient, API_ENDPOINTS } = await import('@/lib/api-client');
      return apiClient.post(API_ENDPOINTS.DEVICE_ADD_UBIQUITI, {}, getAuthHeaders());
    },
    onSuccess: () => {
      logger.info('Ubiquiti device added successfully');
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
    },
    onError: (error) => {
      logger.error('Failed to add Ubiquiti device', error as Error);
    },
  });

  return (
    <div className="space-y-6">
      <Card className="modern-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <Wifi className="h-6 w-6 text-blue-600" />
            <span>Teste Equipamento Ubiquiti</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <Network className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                Configurações de Teste
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">IP:</span>
                <span className="ml-2 font-mono">10.248.8.26</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Porta:</span>
                <span className="ml-2 font-mono">161</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Versão SNMP:</span>
                <span className="ml-2 font-mono">v1</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Comunidade:</span>
                <span className="ml-2 font-mono">Facil_SNMP_V1</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
              variant="outline"
              className="flex items-center space-x-2"
            >
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              <span>Testar Conexão SNMP</span>
            </Button>

            <Button
              onClick={() => addDevice.mutate()}
              disabled={addDevice.isPending || !testResult?.connected}
              className="flex items-center space-x-2"
            >
              {addDevice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              <span>Adicionar ao Sistema</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResult && (
        <Card className="modern-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              {testResult.connected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span>Resultado do Teste</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Badge className={testResult.connected ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'}>
                {testResult.connected ? 'Conectado' : 'Falha na Conexão'}
              </Badge>
            </div>

            {testResult.error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 text-red-800 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold">Erro:</span>
                </div>
                <p className="text-red-700 dark:text-red-300 mt-1 text-sm">
                  {testResult.error}
                </p>
              </div>
            )}

            {testResult.systemInfo && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                  Informações do Sistema
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  {testResult.systemInfo.sysDescr && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Descrição:</span>
                      <p className="font-mono text-xs mt-1 break-all">
                        {testResult.systemInfo.sysDescr}
                      </p>
                    </div>
                  )}
                  {testResult.systemInfo.sysName && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Nome:</span>
                      <p className="font-mono">{testResult.systemInfo.sysName}</p>
                    </div>
                  )}
                  {testResult.systemInfo.sysLocation && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Localização:</span>
                      <p className="font-mono">{testResult.systemInfo.sysLocation}</p>
                    </div>
                  )}
                  {testResult.systemInfo.sysContact && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Contato:</span>
                      <p className="font-mono">{testResult.systemInfo.sysContact}</p>
                    </div>
                  )}
                  {testResult.systemInfo.sysUptime && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
                      <p className="font-mono">{Math.floor(testResult.systemInfo.sysUptime / 8640000)} dias</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {testResult.interfaces && testResult.interfaces.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  Interfaces ({testResult.totalInterfaces} total, mostrando primeiras 5)
                </h4>
                <div className="space-y-3">
                  {testResult.interfaces.map((iface, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-800 p-3 rounded border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          {iface.ifDescr || `Interface ${iface.ifIndex}`}
                        </span>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={
                              iface.ifOperStatus === 1
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }
                          >
                            {iface.ifOperStatus === 1 ? 'UP' : 'DOWN'}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Índice:</span>
                          <span className="ml-1 font-mono">{iface.ifIndex}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Tipo:</span>
                          <span className="ml-1 font-mono">{iface.ifType}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">MTU:</span>
                          <span className="ml-1 font-mono">{iface.ifMtu || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Speed:</span>
                          <span className="ml-1 font-mono">
                            {iface.ifSpeed ? `${(iface.ifSpeed / 1000000).toFixed(0)}Mbps` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}