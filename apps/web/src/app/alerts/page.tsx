'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/logger';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  X,
  MoreHorizontal,
  Calendar,
  User,
  Server,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  Archive,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'ok';
  state: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  message: string;
  timestamp: string;
  deviceId?: string;
  deviceName?: string;
  deviceIp?: string;
  ruleId?: string;
  ruleName?: string;
  userId?: string;
  userName?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  count?: number;
  lastOccurrence?: string;
  category?: string;
  tags?: string[];
}

interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  resolved: number;
  suppressed: number;
}

interface AlertsResponse {
  alerts: Alert[];
  stats: AlertStats;
  total: number;
  page: number;
  limit: number;
}

const severityColors = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
};

const stateColors = {
  open: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  acknowledged: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  suppressed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
};

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
  ok: CheckCircle
};

const stateIcons = {
  open: AlertTriangle,
  acknowledged: Eye,
  resolved: CheckCircle,
  suppressed: EyeOff
};

async function fetchAlerts(authHeaders: Record<string, string>, filters?: any): Promise<AlertsResponse> {
  const queryParams = new URLSearchParams();
  if (filters?.search) queryParams.append('search', filters.search);
  if (filters?.severity) queryParams.append('severity', filters.severity);
  if (filters?.state) queryParams.append('state', filters.state);
  if (filters?.device) queryParams.append('device', filters.device);
  if (filters?.category) queryParams.append('category', filters.category);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());
  
  const url = `/api/alerts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch alerts');
  }
  
  return response.json();
}

async function fetchAlertStats(authHeaders: Record<string, string>): Promise<AlertStats> {
  const response = await fetch('/api/alerts/stats', {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch alert stats');
  }
  
  return response.json();
}

async function acknowledgeAlert(authHeaders: Record<string, string>, alertId: string): Promise<void> {
  const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to acknowledge alert');
  }
}

async function resolveAlert(authHeaders: Record<string, string>, alertId: string): Promise<void> {
  const response = await fetch(`/api/alerts/${alertId}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to resolve alert');
  }
}

function AlertCard({ alert, onAcknowledge, onResolve }: { 
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const SeverityIcon = severityIcons[alert.severity];
  const StateIcon = stateIcons[alert.state];
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };
  
  return (
    <Card className={`modern-card group hover:shadow-lg transition-all duration-300 ${
      alert.severity === 'critical' ? 'border-l-4 border-l-red-500' : 
      alert.severity === 'warning' ? 'border-l-4 border-l-yellow-500' : 
      alert.severity === 'info' ? 'border-l-4 border-l-blue-500' : 
      'border-l-4 border-l-green-500'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${severityColors[alert.severity]} flex-shrink-0`}>
              <SeverityIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <Badge className={severityColors[alert.severity]} variant="outline">
                  {alert.severity.toUpperCase()}
                </Badge>
                <Badge className={stateColors[alert.state]} variant="outline">
                  <StateIcon className="h-3 w-3 mr-1" />
                  {alert.state.toUpperCase()}
                </Badge>
                {alert.count && alert.count > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {alert.count}x
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                {alert.message}
              </p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{getTimeAgo(alert.timestamp)}</span>
                </div>
                {alert.deviceName && (
                  <div className="flex items-center space-x-1">
                    <Server className="h-3 w-3" />
                    <span>{alert.deviceName}</span>
                  </div>
                )}
                {alert.category && (
                  <Badge variant="outline" className="text-xs">
                    {alert.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">Alert ID</p>
                <p className="font-mono text-xs">{alert.id}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">Timestamp</p>
                <p className="font-mono text-xs">{formatTime(alert.timestamp)}</p>
              </div>
              {alert.deviceIp && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Device IP</p>
                  <p className="font-mono text-xs">{alert.deviceIp}</p>
                </div>
              )}
              {alert.ruleName && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Rule</p>
                  <p className="text-xs">{alert.ruleName}</p>
                </div>
              )}
              {alert.acknowledgedAt && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Acknowledged</p>
                  <p className="font-mono text-xs">{formatTime(alert.acknowledgedAt)}</p>
                </div>
              )}
              {alert.resolvedAt && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Resolved</p>
                  <p className="font-mono text-xs">{formatTime(alert.resolvedAt)}</p>
                </div>
              )}
            </div>
            
            {alert.tags && alert.tags.length > 0 && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {alert.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2 pt-2">
              {alert.state === 'open' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAcknowledge(alert.id)}
                  className="flex items-center space-x-1"
                >
                  <Eye className="h-3 w-3" />
                  <span>Acknowledge</span>
                </Button>
              )}
              {(alert.state === 'open' || alert.state === 'acknowledged') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResolve(alert.id)}
                  className="flex items-center space-x-1"
                >
                  <Check className="h-3 w-3" />
                  <span>Resolve</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function AlertStatsCards({ stats }: { stats: AlertStats }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
          <Bell className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
        </CardContent>
      </Card>
      
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Warning</CardTitle>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
        </CardContent>
      </Card>
      
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
          <Eye className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats.acknowledged}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AlertsPage() {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: alertsData, isLoading: alertsLoading, error: alertsError, refetch } = useQuery({
    queryKey: ['alerts', searchTerm, selectedSeverity, selectedState, selectedDevice, activeTab],
    queryFn: () => fetchAlerts(getAuthHeaders(), {
      search: searchTerm,
      severity: selectedSeverity,
      state: activeTab === 'all' ? selectedState : activeTab,
      device: selectedDevice,
      limit: 50
    }),
    refetchInterval: 15000,
  });
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['alert-stats'],
    queryFn: () => fetchAlertStats(getAuthHeaders()),
    refetchInterval: 30000,
  });
  
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert(getAuthHeaders(), alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      toast.success('Alert acknowledged successfully');
    },
    onError: (error, variables) => {
      toast.error('Failed to acknowledge alert');
      logger.error('Failed to acknowledge alert', error as Error, {
        alertId: variables,
        operation: 'acknowledge',
      });
    },
  });
  
  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => resolveAlert(getAuthHeaders(), alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      toast.success('Alert resolved successfully');
    },
    onError: (error, variables) => {
      toast.error('Failed to resolve alert');
      logger.error('Failed to resolve alert', error as Error, {
        alertId: variables,
        operation: 'resolve',
      });
    },
  });
  
  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
  };
  
  const handleResolve = (alertId: string) => {
    resolveMutation.mutate(alertId);
  };
  
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };
  
  const handleRefresh = () => {
    refetch();
  };
  
  if (alertsError) {
    return (
      <div className="p-6">
        <Card className="modern-card border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load alerts</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Please check your connection and try again
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage system alerts
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>
      
      {stats && !statsLoading && <AlertStatsCards stats={stats} />}
      
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-1 items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="ok">OK</option>
          </select>
          
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="">All Devices</option>
          </select>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open" className="text-red-600 dark:text-red-400">
            Open ({stats?.critical || 0})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="text-yellow-600 dark:text-yellow-400">
            Acknowledged ({stats?.acknowledged || 0})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="text-green-600 dark:text-green-400">
            Resolved ({stats?.resolved || 0})
          </TabsTrigger>
          <TabsTrigger value="suppressed" className="text-gray-600 dark:text-gray-400">
            Suppressed ({stats?.suppressed || 0})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-6">
          {alertsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="modern-card">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {alertsData?.alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          )}
          
          {alertsData?.alerts.length === 0 && !alertsLoading && (
            <Card className="modern-card">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                    No alerts found
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {activeTab === 'all' ? 
                      'Your system is running smoothly with no alerts' : 
                      `No ${activeTab} alerts at this time`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}