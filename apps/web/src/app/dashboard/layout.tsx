'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Home, 
  LogOut, 
  Network, 
  Settings, 
  Users, 
  Server 
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Navigation */}
        <nav className="glass-nav sticky top-0 z-50 backdrop-blur-nav">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-10 w-10 bg-gradient-to-r from-ymonitor-500 to-ymonitor-600 rounded-xl flex items-center justify-center shadow-lg glow-on-hover">
                    <span className="text-white font-bold text-lg">Y</span>
                  </div>
                  <span className="ml-3 text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
                    Y Monitor
                  </span>
                </div>
                
                <div className="hidden md:ml-8 md:flex md:space-x-1">
                  <a href="/dashboard" className="text-gray-900 dark:text-white bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200 backdrop-blur-sm">
                    <Home className="w-4 h-4 mr-2" />
                    Dashboard
                  </a>
                  <a href="/devices" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200">
                    <Server className="w-4 h-4 mr-2" />
                    Devices
                  </a>
                  <a href="/network" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200">
                    <Network className="w-4 h-4 mr-2" />
                    Network
                  </a>
                  <a href="/alerts" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Alerts
                  </a>
                  <a href="/reports" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Reports
                  </a>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">System Online</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Welcome, <span className="font-medium">{user?.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logout()}
                    className="flex items-center space-x-2 bg-white/20 dark:bg-white/10 border-white/20 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/20 backdrop-blur-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}