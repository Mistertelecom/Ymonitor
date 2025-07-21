'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings, Activity, Shield, TrendingUp } from 'lucide-react';

export function DashboardHeader() {
  const handleRefresh = () => {
    // Trigger dashboard refresh
    window.location.reload();
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-foreground tracking-tight">
            Network Monitor
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Real-time network infrastructure monitoring and performance analytics
          </p>
        </div>
        
        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm">
            <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-foreground">Live Monitoring</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm">
            <Shield className="w-4 h-4 text-status-success" />
            <span className="text-sm font-medium text-foreground">Security Active</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Performance Optimal</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={handleRefresh}
          className="h-11 px-6 bg-background/50 hover:bg-background border-border hover:border-border/80 backdrop-blur-sm transition-all duration-200"
        >
          <RefreshCw className="h-4 w-4 mr-3" />
          Refresh Data
        </Button>
        <Button 
          variant="default"
          size="lg"
          className="h-11 px-6 gradient-primary text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Settings className="h-4 w-4 mr-3" />
          System Settings
        </Button>
      </div>
    </div>
  );
}