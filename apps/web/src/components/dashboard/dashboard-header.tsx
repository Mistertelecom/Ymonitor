'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings, User } from 'lucide-react';

export function DashboardHeader() {
  const handleRefresh = () => {
    // Trigger dashboard refresh
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Network monitoring overview and system health
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="text-green-600">
          System Online
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-8 px-3"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-3">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}