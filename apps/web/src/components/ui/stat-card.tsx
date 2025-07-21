'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconColor: string;
  progress?: {
    value: number;
    label: string;
  };
  badges?: Array<{
    label: string;
    className: string;
  }>;
  footer?: string;
  footerClassName?: string;
  hoverColor?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor,
  progress,
  badges,
  footer,
  footerClassName,
  hoverColor = 'primary'
}: StatCardProps) {
  return (
    <Card className={`card-elevated group hover:shadow-${hoverColor}-500/5`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={`p-3 ${iconColor} rounded-xl group-hover:scale-105 transition-all duration-300 shadow-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-foreground mb-4 tabular-nums">
          {value}
        </div>
        
        {description && (
          <div className="text-sm text-muted-foreground mb-4">
            {description}
          </div>
        )}
        
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {badges.map((badge, index) => (
              <div key={index} className={`status-badge ${badge.className} text-xs`}>
                {badge.label}
              </div>
            ))}
          </div>
        )}
        
        {progress && (
          <div className="space-y-3">
            <Progress 
              value={progress.value} 
              className="h-2.5 bg-muted"
            />
            <p className="text-xs text-muted-foreground font-medium">
              {progress.label}
            </p>
          </div>
        )}
        
        {footer && (
          <p className={`text-xs font-medium ${footerClassName || 'text-muted-foreground'}`}>
            {footer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}