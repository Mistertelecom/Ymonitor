'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Activity, BarChart3, PieChart as PieChartIcon } from 'lucide-react';

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    tension?: number;
  }>;
}

async function fetchChartData(type: string, period: string = '24h'): Promise<ChartData> {
  const response = await fetch(`/api/dashboard/charts/${type}?period=${period}`);
  if (!response.ok) {
    throw new Error('Failed to fetch chart data');
  }
  return response.json();
}

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

export function DashboardCharts() {
  const [selectedPeriod, setSelectedPeriod] = useState('24h');

  const { data: alertTrends, isLoading: loadingAlerts } = useQuery({
    queryKey: ['chart-alert-trends', selectedPeriod],
    queryFn: () => fetchChartData('alert-trends', selectedPeriod),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: deviceStatus, isLoading: loadingDevices } = useQuery({
    queryKey: ['chart-device-status'],
    queryFn: () => fetchChartData('device-status'),
    refetchInterval: 30000,
  });

  const { data: networkUtilization, isLoading: loadingNetwork } = useQuery({
    queryKey: ['chart-network-utilization', selectedPeriod],
    queryFn: () => fetchChartData('network-utilization', selectedPeriod),
    refetchInterval: 30000,
  });

  const { data: topInterfaces, isLoading: loadingInterfaces } = useQuery({
    queryKey: ['chart-top-interfaces'],
    queryFn: () => fetchChartData('top-interfaces'),
    refetchInterval: 60000,
  });

  // Transform data for recharts
  const alertTrendData = alertTrends?.labels.map((label, index) => ({
    time: label,
    critical: alertTrends.datasets[0]?.data[index] || 0,
    warning: alertTrends.datasets[1]?.data[index] || 0,
    info: alertTrends.datasets[2]?.data[index] || 0,
  })) || [];

  const deviceStatusData = deviceStatus?.labels.map((label, index) => ({
    name: label,
    value: deviceStatus.datasets[0]?.data[index] || 0,
  })) || [];

  const networkUtilizationData = networkUtilization?.labels.map((label, index) => ({
    time: label,
    utilization: networkUtilization.datasets[0]?.data[index] || 0,
  })) || [];

  const topInterfacesData = topInterfaces?.labels.map((label, index) => ({
    name: label.length > 20 ? label.substring(0, 20) + '...' : label,
    utilization: topInterfaces.datasets[0]?.data[index] || 0,
  })) || [];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      {/* Alert Trends Chart */}
      <Card className="col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Alert Trends
              </CardTitle>
              <CardDescription>
                Alert activity over time
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={selectedPeriod === '24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('24h')}
              >
                24h
              </Button>
              <Button
                variant={selectedPeriod === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('7d')}
              >
                7d
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAlerts ? (
            <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={alertTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="critical" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Critical"
                />
                <Line 
                  type="monotone" 
                  dataKey="warning" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Warning"
                />
                <Line 
                  type="monotone" 
                  dataKey="info" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Info"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Device Status Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Device Status
          </CardTitle>
          <CardDescription>
            Current device status distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <div className="h-[250px] bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={deviceStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {deviceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Network Utilization Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Network Utilization
          </CardTitle>
          <CardDescription>
            Network bandwidth usage over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingNetwork ? (
            <div className="h-[250px] bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={networkUtilizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="utilization" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fill="rgba(59, 130, 246, 0.1)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Interfaces Chart */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Top Interfaces by Utilization
          </CardTitle>
          <CardDescription>
            Most utilized network interfaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInterfaces ? (
            <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topInterfacesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="utilization" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}