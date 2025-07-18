'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Server, 
  Wifi, 
  Router, 
  Shield, 
  MonitorSpeaker, 
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Device {
  id: string;
  hostname: string;
  displayName: string;
  ip: string;
  status: 'UP' | 'DOWN' | 'WARNING' | 'UNKNOWN';
  type: 'ROUTER' | 'SWITCH' | 'FIREWALL' | 'SERVER' | 'WIRELESS' | 'PRINTER' | 'UPS' | 'UNKNOWN';
  alertCount: number;
  utilization: number;
  responseTime: number;
  uptime: number;
  lastSeen: string;
}

interface DeviceHealth {
  deviceId: string;
  hostname: string;
  healthScore: number;
  status: string;
  lastSeen: string;
  issues: string[];
}

async function fetchTopDevices(): Promise<Device[]> {
  const response = await fetch('/api/devices/top');
  if (!response.ok) {
    throw new Error('Failed to fetch devices');
  }
  return response.json();
}

async function fetchDeviceHealth(): Promise<DeviceHealth[]> {
  const response = await fetch('/api/dashboard/device-health');
  if (!response.ok) {
    throw new Error('Failed to fetch device health');
  }
  return response.json();
}

function getDeviceIcon(type: string) {
  switch (type) {
    case 'ROUTER':
      return <Router className="h-4 w-4" />;
    case 'SWITCH':
      return <Server className="h-4 w-4" />;
    case 'FIREWALL':
      return <Shield className="h-4 w-4" />;
    case 'WIRELESS':
      return <Wifi className="h-4 w-4" />;
    case 'SERVER':
      return <Server className="h-4 w-4" />;
    case 'PRINTER':
      return <MonitorSpeaker className="h-4 w-4" />;
    default:
      return <Server className="h-4 w-4" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'UP':
      return 'text-green-600';
    case 'DOWN':
      return 'text-red-600';
    case 'WARNING':
      return 'text-yellow-600';
    default:
      return 'text-gray-600';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'UP':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'DOWN':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function getHealthColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${Math.floor(seconds / 60)}m`;
  }
}

export function DashboardDevices() {
  const { data: devices, isLoading: loadingDevices } = useQuery({
    queryKey: ['top-devices'],
    queryFn: fetchTopDevices,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: deviceHealth, isLoading: loadingHealth } = useQuery({
    queryKey: ['device-health'],
    queryFn: fetchDeviceHealth,
    refetchInterval: 60000,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Top Devices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Top Devices
              </CardTitle>
              <CardDescription>
                Devices with most activity
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 animate-pulse">
                  <div className="h-8 w-8 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {devices && devices.length > 0 ? (
                  devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center space-x-4 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        {getDeviceIcon(device.type)}
                        {getStatusIcon(device.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {device.displayName}
                          </p>
                          {device.alertCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {device.alertCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {device.ip}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>{device.responseTime}ms</span>
                          <span>•</span>
                          <span>{formatUptime(device.uptime)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${getStatusColor(device.status)}`}>
                          {device.status}
                        </div>
                        {device.utilization > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {device.utilization.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Server className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Devices Found</h3>
                    <p className="text-muted-foreground">
                      Add devices to start monitoring your network.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Device Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Device Health
              </CardTitle>
              <CardDescription>
                Overall device health scores
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Health Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHealth ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 animate-pulse">
                  <div className="h-8 w-8 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 rounded w-full" />
                  </div>
                  <div className="h-6 w-12 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {deviceHealth && deviceHealth.length > 0 ? (
                  deviceHealth.map((device) => (
                    <div
                      key={device.deviceId}
                      className="flex items-center space-x-4 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className={`text-2xl font-bold ${getHealthColor(device.healthScore)}`}>
                        {device.healthScore}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {device.hostname}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {device.status}
                          </Badge>
                        </div>
                        <Progress value={device.healthScore} className="h-2 mb-2" />
                        {device.issues.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {device.issues.slice(0, 2).map((issue, index) => (
                              <Badge key={index} variant="destructive" className="text-xs">
                                {issue}
                              </Badge>
                            ))}
                            {device.issues.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{device.issues.length - 2} more
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Last seen: {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Activity className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Health Data</h3>
                    <p className="text-muted-foreground">
                      Device health monitoring is starting up.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}