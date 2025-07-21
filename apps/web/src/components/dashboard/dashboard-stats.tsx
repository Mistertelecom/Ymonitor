'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { 
  Activity, 
  AlertTriangle, 
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

async function fetchDashboardStats(authHeaders: Record<string, string>): Promise<DashboardStats> {
  const { apiClient, API_ENDPOINTS } = await import('@/lib/api-client');
  return apiClient.get<DashboardStats>(API_ENDPOINTS.DASHBOARD_STATS, authHeaders);
}

export function DashboardStats() {
  const { getAuthHeaders } = useAuth();
  
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => fetchDashboardStats(getAuthHeaders()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="contents">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="h-4 w-20 bg-muted rounded-lg loading-shimmer" />
              <div className="h-10 w-10 gradient-secondary rounded-xl animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 w-20 bg-muted rounded-lg loading-shimmer" />
                <div className="h-4 w-32 bg-muted rounded-lg loading-shimmer" />
                <div className="h-2 w-full bg-muted rounded-full loading-shimmer" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="card-elevated border-red-200/50 dark:border-red-800/50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4 text-destructive">
            <div className="p-3 bg-destructive/10 rounded-xl">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Failed to load dashboard statistics</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please check your connection and try again
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overview } = stats || { 
    overview: { 
      devices: { total: 0, online: 0, offline: 0, warning: 0, availability: 0 }, 
      alerts: { total: 0, critical: 0, warning: 0, info: 0, acknowledged: 0 }, 
      network: { totalBandwidth: 0, utilizationPercent: 0, interfacesMonitored: 0, errors: 0 }, 
      users: { active: 0, total: 0, onlineNow: 0 } 
    } 
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Devices"
        value={overview.devices?.total || 0}
        icon={Server}
        iconColor="gradient-primary"
        hoverColor="primary"
        progress={{
          value: overview.devices?.availability || 0,
          label: `${(overview.devices?.availability || 0).toFixed(1)}% availability`
        }}
        badges={[
          {
            label: `${overview.devices?.online || 0} online`,
            className: 'status-up'
          },
          {
            label: `${overview.devices?.offline || 0} offline`, 
            className: 'status-down'
          }
        ]}
      />

      <StatCard
        title="Active Alerts"
        value={overview.alerts?.total || 0}
        icon={AlertTriangle}
        iconColor="bg-gradient-to-r from-amber-500 to-orange-500"
        hoverColor="amber"
        badges={[
          {
            label: `${overview.alerts?.critical || 0} Critical`,
            className: 'status-down'
          },
          {
            label: `${overview.alerts?.warning || 0} Warning`,
            className: 'status-warning'
          }
        ]}
        footer={`${overview.alerts?.acknowledged || 0} acknowledged`}
      />

      <StatCard
        title="Network"
        value={overview.network?.interfacesMonitored || 0}
        description="Interfaces monitored"
        icon={Network}
        iconColor="bg-gradient-to-r from-emerald-500 to-teal-500"
        hoverColor="emerald"
        badges={[
          {
            label: `${(overview.network?.utilizationPercent || 0).toFixed(1)}% utilization`,
            className: 'status-up'
          }
        ]}
        footer={`${overview.network?.errors || 0} errors detected`}
        footerClassName="text-destructive"
      />

      <StatCard
        title="Users"
        value={overview.users?.active || 0}
        description="Active users"
        icon={Users}
        iconColor="bg-gradient-to-r from-purple-500 to-pink-500"
        hoverColor="purple"
        badges={[
          {
            label: `${overview.users?.onlineNow || 0} online now`,
            className: 'status-up'
          }
        ]}
        footer={`${overview.users?.total || 0} total users`}
      />
    </div>
  );
}