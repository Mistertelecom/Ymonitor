'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, CheckCircle, XCircle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  title: string;
  message: string;
  deviceName: string;
  timestamp: string;
  state: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

async function fetchRecentAlerts(): Promise<Alert[]> {
  const response = await fetch('/api/alerts/recent');
  if (!response.ok) {
    throw new Error('Failed to fetch alerts');
  }
  return response.json();
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL':
    case 'EMERGENCY':
      return 'destructive';
    case 'WARNING':
      return 'default';
    case 'INFO':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'CRITICAL':
    case 'EMERGENCY':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'INFO':
      return <Bell className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
}

function getStateIcon(state: string) {
  switch (state) {
    case 'ACTIVE':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'ACKNOWLEDGED':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'RESOLVED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
}

export function DashboardAlerts() {
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['recent-alerts'],
    queryFn: fetchRecentAlerts,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Failed to load alerts</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Alerts
            </CardTitle>
            <CardDescription>
              Latest system alerts and notifications
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 animate-pulse">
                <div className="h-4 w-4 bg-gray-200 rounded" />
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
              {alerts && alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start space-x-4 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="mt-1">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {alert.title}
                        </p>
                        <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{alert.deviceName}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        {getStateIcon(alert.state)}
                        <span className="text-xs text-muted-foreground">
                          {alert.state}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Recent Alerts</h3>
                  <p className="text-muted-foreground">
                    Your system is running smoothly with no active alerts.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}