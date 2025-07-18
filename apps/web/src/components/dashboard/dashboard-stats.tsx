'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Network, 
  Server, 
  TrendingUp, 
  Users, 
  XCircle 
} from 'lucide-react';

interface DashboardStats {
  overview: {
    devices: {
      total: number;
      online: number;
      offline: number;
      warning: number;
      availability: number;
    };
    alerts: {
      total: number;
      critical: number;
      warning: number;
      info: number;
      acknowledged: number;
    };
    network: {
      totalBandwidth: number;
      utilizationPercent: number;
      interfacesMonitored: number;
      errors: number;
    };
    users: {
      active: number;
      total: number;
      onlineNow: number;
    };
  };
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard');
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }
  return response.json();
}

export function DashboardStats() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gray-200 h-8 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Failed to load dashboard statistics</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overview } = stats || { overview: { devices: {}, alerts: {}, network: {}, users: {} } };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Devices Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Devices</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.devices?.total || 0}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>{overview.devices?.online || 0} online</span>
            </div>
            <div className="flex items-center space-x-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>{overview.devices?.offline || 0} offline</span>
            </div>
          </div>
          <Progress 
            value={overview.devices?.availability || 0} 
            className="mt-2 h-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {(overview.devices?.availability || 0).toFixed(1)}% availability
          </p>
        </CardContent>
      </Card>

      {/* Alerts Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.alerts?.total || 0}</div>
          <div className="flex items-center space-x-2 text-xs mt-2">
            <Badge variant="destructive" className="text-xs px-1">
              {overview.alerts?.critical || 0} Critical
            </Badge>
            <Badge variant="secondary" className="text-xs px-1">
              {overview.alerts?.warning || 0} Warning
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {overview.alerts?.acknowledged || 0} acknowledged
          </p>
        </CardContent>
      </Card>

      {/* Network Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Network</CardTitle>
          <Network className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.network?.interfacesMonitored || 0}</div>
          <div className="text-xs text-muted-foreground">Interfaces monitored</div>
          <div className="flex items-center space-x-2 text-xs mt-2">
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              <span>{(overview.network?.utilizationPercent || 0).toFixed(1)}% utilization</span>
            </div>
          </div>
          <p className="text-xs text-red-600 mt-1">
            {overview.network?.errors || 0} errors detected
          </p>
        </CardContent>
      </Card>

      {/* Users Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.users?.active || 0}</div>
          <div className="text-xs text-muted-foreground">Active users</div>
          <div className="flex items-center space-x-2 text-xs mt-2">
            <div className="flex items-center space-x-1">
              <Activity className="h-3 w-3 text-green-500" />
              <span>{overview.users?.onlineNow || 0} online now</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {overview.users?.total || 0} total users
          </p>
        </CardContent>
      </Card>
    </div>
  );
}