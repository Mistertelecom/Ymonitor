'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select-field';
import { UbiquitiTest } from '@/components/devices/ubiquiti-test';
import { useDebouncedSearch } from '@/hooks/use-debounced-value';
import { logger } from '@/lib/logger';
import { 
  Server, 
  Wifi, 
  Router, 
  Shield, 
  Printer, 
  Zap, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  MapPin,
  Activity,
  Network,
  Settings
} from 'lucide-react';

interface Device {
  id: string;
  hostname: string;
  ip: string;
  type: 'ROUTER' | 'SWITCH' | 'FIREWALL' | 'SERVER' | 'WIRELESS' | 'PRINTER' | 'UPS' | 'UNKNOWN';
  status: 'UP' | 'DOWN' | 'WARNING' | 'UNKNOWN';
  displayName?: string;
  sysName?: string;
  sysDescr?: string;
  location?: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  pingTime?: number;
  availability?: number;
  lastPolled?: string;
  vendor?: string;
  model?: string;
  version?: string;
  uptime?: string;
  ports?: Port[];
  _count?: {
    ports: number;
    sensors: number;
    alerts: number;
  };
}

interface Port {
  id: string;
  ifIndex: number;
  ifName: string;
  ifDescr?: string;
  ifOperStatus: string;
  ifAdminStatus: string;
  ifSpeed?: string;
  ifType?: string;
}

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  warning: number;
  availability: number;
}

interface DevicesResponse {
  devices: Device[];
  stats: DeviceStats;
  total: number;
  page: number;
  limit: number;
}

const deviceTypeIcons = {
  ROUTER: Router,
  SWITCH: Network,
  FIREWALL: Shield,
  SERVER: Server,
  WIRELESS: Wifi,
  PRINTER: Printer,
  UPS: Zap,
  UNKNOWN: Server
};

const deviceTypeColors = {
  ROUTER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  SWITCH: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  FIREWALL: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  SERVER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  WIRELESS: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
  PRINTER: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  UPS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  UNKNOWN: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
};

const statusColors = {
  UP: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  DOWN: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  WARNING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  UNKNOWN: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
};

const statusIcons = {
  UP: CheckCircle,
  DOWN: XCircle,
  WARNING: AlertTriangle,
  UNKNOWN: Clock
};

async function fetchDevices(authHeaders: Record<string, string>, filters?: any): Promise<DevicesResponse> {
  const { apiClient, API_ENDPOINTS } = await import('@/lib/api-client');
  const endpoint = apiClient.buildUrl(API_ENDPOINTS.DEVICES, {
    search: filters?.search,
    type: filters?.type,
    status: filters?.status,
    location: filters?.location,
  });
  return apiClient.get<DevicesResponse>(endpoint, authHeaders);
}

async function fetchDeviceStats(authHeaders: Record<string, string>): Promise<DeviceStats> {
  const { apiClient, API_ENDPOINTS } = await import('@/lib/api-client');
  return apiClient.get<DeviceStats>(API_ENDPOINTS.DEVICE_STATS, authHeaders);
}

function DeviceCard({ device }: { device: Device }) {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const IconComponent = deviceTypeIcons[device.type];
  const StatusIcon = statusIcons[device.status];
  
  const pollDevice = useMutation({
    mutationFn: async () => {
      const { apiClient, API_ENDPOINTS } = await import('@/lib/api-client');
      return apiClient.post(API_ENDPOINTS.DEVICE_POLL(device.id), {}, getAuthHeaders());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      logger.info('Device polled successfully', { deviceId: device.id });
    },
    onError: (error) => {
      logger.error('Failed to poll device', error as Error, { deviceId: device.id });
    },
  });
  
  return (
    <Card className="modern-card group hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${deviceTypeColors[device.type]}`}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              {device.displayName || device.sysName || device.hostname}
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">{device.ip}</p>
            {device.vendor && (
              <p className="text-xs text-gray-500 dark:text-gray-500">{device.vendor}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={statusColors[device.status]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {device.sysDescr && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <p className="truncate" title={device.sysDescr}>
              {device.sysDescr}
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Type</p>
            <p className="font-medium">{device.type}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Uptime</p>
            <p className="font-medium">
              {device.uptime ? `${Math.floor(parseInt(device.uptime) / 8640000)} dias` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Availability</p>
            <p className="font-medium">{device.availability ? `${device.availability.toFixed(1)}%` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Last Polled</p>
            <p className="font-medium text-xs">
              {device.lastPolled 
                ? new Date(device.lastPolled).toLocaleTimeString('pt-BR')
                : 'Never'
              }
            </p>
          </div>
        </div>
        
        {device.ports && device.ports.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Interfaces ({device._count?.ports || 0} total)
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {device.ports.slice(0, 3).map((port) => (
                <div key={port.id} className="text-xs flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span className="font-mono">{port.ifName || port.ifDescr}</span>
                  <Badge 
                    variant="outline" 
                    className={
                      port.ifOperStatus === 'up' 
                        ? 'border-green-500 text-green-700 dark:text-green-400' 
                        : 'border-red-500 text-red-700 dark:text-red-400'
                    }
                  >
                    {port.ifOperStatus.toUpperCase()}
                  </Badge>
                </div>
              ))}
              {device._count && device._count.ports > 3 && (
                <p className="text-xs text-gray-500 text-center">
                  +{device._count.ports - 3} mais interfaces
                </p>
              )}
            </div>
          </div>
        )}
        
        {device.location && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-4 w-4" />
            <span>{device.location.name}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Network className="h-4 w-4" />
              <span>{device._count?.ports || 0} ports</span>
            </div>
            <div className="flex items-center space-x-1">
              <Activity className="h-4 w-4" />
              <span>{device._count?.sensors || 0} sensors</span>
            </div>
            {device._count?.alerts && device._count.alerts > 0 && (
              <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span>{device._count.alerts} alerts</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => pollDevice.mutate()}
              disabled={pollDevice.isPending}
              className="group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20"
            >
              {pollDevice.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Poll
            </Button>
            <Button variant="outline" size="sm" className="group-hover:bg-gray-100 dark:group-hover:bg-gray-800">
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceStatsCards({ stats }: { stats: DeviceStats }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
          <Server className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Online</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.online}</div>
        </CardContent>
      </Card>
      
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Offline</CardTitle>
          <XCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.offline}</div>
        </CardContent>
      </Card>
      
      <Card className="modern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Availability</CardTitle>
          <Activity className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{(stats.availability || 0).toFixed(1)}%</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DevicesPage() {
  const { getAuthHeaders } = useAuth();
  const { searchValue, debouncedSearchValue, setSearchValue } = useDebouncedSearch('', 300);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const { data: devicesData, isLoading: devicesLoading, error: devicesError, refetch } = useQuery({
    queryKey: ['devices', debouncedSearchValue, selectedType, selectedStatus],
    queryFn: () => fetchDevices(getAuthHeaders(), {
      search: debouncedSearchValue,
      type: selectedType,
      status: selectedStatus
    }),
    refetchInterval: 30000,
  });
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['device-stats'],
    queryFn: () => fetchDeviceStats(getAuthHeaders()),
    refetchInterval: 30000,
  });
  
  const handleRefresh = () => {
    refetch();
  };
  
  if (devicesError) {
    return (
      <div className="p-6">
        <Card className="modern-card border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load devices</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage your network devices
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>
      
      {stats && !statsLoading && <DeviceStatsCards stats={stats} />}
      
      {/* Componente de teste do Ubiquiti */}
      <UbiquitiTest />
      
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-1 items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search devices..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <SelectField
            value={selectedType}
            onChange={setSelectedType}
            placeholder="All Types"
            options={[
              { value: '', label: 'All Types' },
              { value: 'ROUTER', label: 'Router' },
              { value: 'SWITCH', label: 'Switch' },
              { value: 'FIREWALL', label: 'Firewall' },
              { value: 'SERVER', label: 'Server' },
              { value: 'WIRELESS', label: 'Wireless' },
              { value: 'PRINTER', label: 'Printer' },
              { value: 'UPS', label: 'UPS' },
            ]}
            aria-label="Filter by device type"
          />
          
          <SelectField
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="All Status"
            options={[
              { value: '', label: 'All Status' },
              { value: 'UP', label: 'Online' },
              { value: 'DOWN', label: 'Offline' },
              { value: 'WARNING', label: 'Warning' },
              { value: 'UNKNOWN', label: 'Unknown' },
            ]}
            aria-label="Filter by device status"
          />
        </div>
      </div>
      
      {devicesLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="modern-card">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {devicesData?.devices?.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
      
      {devicesData?.devices?.length === 0 && !devicesLoading && (
        <Card className="modern-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                No devices found
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Try adjusting your search criteria or add new devices to start monitoring
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}