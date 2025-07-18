import { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { DashboardAlerts } from '@/components/dashboard/dashboard-alerts';
import { DashboardDevices } from '@/components/dashboard/dashboard-devices';
import { LoadingCard } from '@/components/ui/loading-card';

export const metadata: Metadata = {
  title: 'Dashboard - Y Monitor',
  description: 'Network monitoring dashboard with real-time metrics and alerts',
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col space-y-6">
      <DashboardHeader />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<LoadingCard />}>
          <DashboardStats />
        </Suspense>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <Suspense fallback={<LoadingCard />}>
            <DashboardCharts />
          </Suspense>
        </div>
        
        <div className="lg:col-span-3">
          <Suspense fallback={<LoadingCard />}>
            <DashboardAlerts />
          </Suspense>
        </div>
      </div>

      <div className="grid gap-6">
        <Suspense fallback={<LoadingCard />}>
          <DashboardDevices />
        </Suspense>
      </div>
    </div>
  );
}