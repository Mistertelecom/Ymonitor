'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Network, 
  Router, 
  Server, 
  Wifi, 
  Shield, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  MapPin, 
  Zap,
  Globe,
  Link,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  Layers
} from 'lucide-react';

interface NetworkTopology {
  nodes: TopologyNode[];
  links: TopologyLink[];
  statistics: NetworkStatistics;
}

interface TopologyNode {
  id: string;
  hostname: string;
  ip: string;
  type: 'ROUTER' | 'SWITCH' | 'FIREWALL' | 'SERVER' | 'WIRELESS' | 'PRINTER' | 'UPS' | 'UNKNOWN';
  status: 'UP' | 'DOWN' | 'WARNING' | 'UNKNOWN';
  location?: {
    name: string;
    x?: number;
    y?: number;
    lat?: number;
    lng?: number;
  };
  ports: number;
  uptime: number;
  cpu?: number;
  memory?: number;
  connections: number;
}

interface TopologyLink {
  id: string;
  source: string;
  target: string;
  type: 'ETHERNET' | 'FIBER' | 'WIRELESS' | 'UNKNOWN';
  status: 'UP' | 'DOWN' | 'WARNING';
  bandwidth: number;
  utilization: number;
  latency?: number;
  description?: string;
}

interface NetworkStatistics {
  totalDevices: number;
  totalLinks: number;
  totalBandwidth: number;
  averageUtilization: number;
  packetsPerSecond: number;
  errorsPerSecond: number;
  topTalkers: TopTalker[];
}

interface TopTalker {
  deviceId: string;
  hostname: string;
  ip: string;
  bytesIn: number;
  bytesOut: number;
  utilization: number;
}

interface NetworkMap {
  regions: NetworkRegion[];
  totalSites: number;
  connectedSites: number;
}

interface NetworkRegion {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  devices: number;
  status: 'UP' | 'DOWN' | 'WARNING';
  bandwidth: number;
  utilization: number;
}

const deviceTypeIcons = {
  ROUTER: Router,
  SWITCH: Router,
  FIREWALL: Shield,
  SERVER: Server,
  WIRELESS: Wifi,
  PRINTER: Server,
  UPS: Zap,
  UNKNOWN: Server
};

const statusColors = {
  UP: 'text-green-600 dark:text-green-400',
  DOWN: 'text-red-600 dark:text-red-400',
  WARNING: 'text-yellow-600 dark:text-yellow-400',
  UNKNOWN: 'text-gray-600 dark:text-gray-400'
};

const linkTypeColors = {
  ETHERNET: 'stroke-blue-500',
  FIBER: 'stroke-purple-500',
  WIRELESS: 'stroke-cyan-500',
  UNKNOWN: 'stroke-gray-500'
};

async function fetchNetworkTopology(authHeaders: Record<string, string>): Promise<NetworkTopology> {
  const response = await fetch('/api/network/topology', {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch network topology');
  }
  
  return response.json();
}

async function fetchNetworkMap(authHeaders: Record<string, string>): Promise<NetworkMap> {
  const response = await fetch('/api/network/map', {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch network map');
  }
  
  return response.json();
}

function NetworkTopologyView({ topology }: { topology: NetworkTopology }) {
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<TopologyLink | null>(null);
  
  const handleNodeClick = (node: TopologyNode) => {
    setSelectedNode(node);
    setSelectedLink(null);
  };
  
  const handleLinkClick = (link: TopologyLink) => {
    setSelectedLink(link);
    setSelectedNode(null);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="modern-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Network className="h-5 w-5" />
              <span>Network Topology</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-6 min-h-[400px]">
              <svg width="100%" height="400" viewBox="0 0 800 400" className="border rounded">
                {/* Render Links */}
                {topology?.links?.map((link) => {
                  const source = topology?.nodes?.find(n => n?.id === link?.source);
                  const target = topology?.nodes?.find(n => n?.id === link?.target);
                  if (!source || !target) return null;
                  
                  const sourceX = (source.location?.x || Math.random() * 700) + 50;
                  const sourceY = (source.location?.y || Math.random() * 300) + 50;
                  const targetX = (target.location?.x || Math.random() * 700) + 50;
                  const targetY = (target.location?.y || Math.random() * 300) + 50;
                  
                  return (
                    <g key={link.id}>
                      <line
                        x1={sourceX}
                        y1={sourceY}
                        x2={targetX}
                        y2={targetY}
                        className={`${linkTypeColors[link.type]} cursor-pointer hover:stroke-width-3 transition-all`}
                        strokeWidth={link.status === 'UP' ? 2 : 1}
                        strokeDasharray={link.status === 'DOWN' ? '5,5' : 'none'}
                        onClick={() => handleLinkClick(link)}
                      />
                      {/* Utilization indicator */}
                      {link.utilization > 80 && (
                        <circle
                          cx={(sourceX + targetX) / 2}
                          cy={(sourceY + targetY) / 2}
                          r="3"
                          fill="red"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  );
                })}
                
                {/* Render Nodes */}
                {topology?.nodes?.map((node) => {
                  const IconComponent = deviceTypeIcons[node.type];
                  const x = (node.location?.x || Math.random() * 700) + 50;
                  const y = (node.location?.y || Math.random() * 300) + 50;
                  
                  return (
                    <g key={node.id}>
                      <circle
                        cx={x}
                        cy={y}
                        r="20"
                        fill={node.status === 'UP' ? '#10b981' : node.status === 'DOWN' ? '#ef4444' : '#f59e0b'}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleNodeClick(node)}
                      />
                      <text
                        x={x}
                        y={y + 35}
                        textAnchor="middle"
                        className="text-xs font-medium fill-gray-700 dark:fill-gray-300"
                      >
                        {node.hostname}
                      </text>
                      <text
                        x={x}
                        y={y + 48}
                        textAnchor="middle"
                        className="text-xs fill-gray-500 dark:fill-gray-400"
                      >
                        {node.ip}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Sidebar */}
      <div className="space-y-6">
        {/* Network Statistics */}
        <Card className="modern-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Network Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Devices</p>
                <p className="text-2xl font-bold">{topology?.statistics?.totalDevices || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Links</p>
                <p className="text-2xl font-bold">{topology?.statistics?.totalLinks || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Bandwidth</p>
                <p className="text-lg font-semibold">{((topology?.statistics?.totalBandwidth || 0) / 1000).toFixed(1)}Gb</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Utilization</p>
                <p className="text-lg font-semibold">{(topology?.statistics?.averageUtilization || 0).toFixed(1)}%</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Traffic</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Packets/sec</span>
                  <span className="text-sm font-medium">{(topology?.statistics?.packetsPerSecond || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Errors/sec</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">{topology?.statistics?.errorsPerSecond || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Selected Node/Link Info */}
        {selectedNode && (
          <Card className="modern-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>Device Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hostname</p>
                <p className="font-medium">{selectedNode.hostname}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">IP Address</p>
                <p className="font-medium">{selectedNode.ip}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
                <Badge>{selectedNode.type}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <Badge className={selectedNode.status === 'UP' ? 'bg-green-100 text-green-800' : selectedNode.status === 'DOWN' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                  {selectedNode.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Connections</p>
                <p className="font-medium">{selectedNode.connections}</p>
              </div>
              {selectedNode.location && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Location</p>
                  <p className="font-medium">{selectedNode.location.name}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {selectedLink && (
          <Card className="modern-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Link className="h-5 w-5" />
                <span>Link Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
                <Badge>{selectedLink.type}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <Badge className={selectedLink.status === 'UP' ? 'bg-green-100 text-green-800' : selectedLink.status === 'DOWN' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                  {selectedLink.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Bandwidth</p>
                <p className="font-medium">{selectedLink.bandwidth}Mbps</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Utilization</p>
                <p className="font-medium">{selectedLink.utilization}%</p>
              </div>
              {selectedLink.latency && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Latency</p>
                  <p className="font-medium">{selectedLink.latency}ms</p>
                </div>
              )}
              {selectedLink.description && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Description</p>
                  <p className="font-medium">{selectedLink.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function NetworkMapView({ networkMap }: { networkMap: NetworkMap }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="modern-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Global Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Sites</span>
                <span className="font-medium">{networkMap.totalSites}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
                <span className="font-medium text-green-600 dark:text-green-400">{networkMap.connectedSites}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Regions</span>
                <span className="font-medium">{networkMap.regions.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="modern-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Network Regions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {networkMap.regions.map((region) => {
              const StatusIcon = region.status === 'UP' ? CheckCircle : region.status === 'DOWN' ? XCircle : AlertTriangle;
              return (
                <div key={region.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <StatusIcon className={`h-5 w-5 ${statusColors[region.status]}`} />
                    <div>
                      <p className="font-medium">{region.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{region.country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{region.devices} devices</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{region.utilization}% utilization</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TopTalkersView({ topTalkers }: { topTalkers: TopTalker[] }) {
  return (
    <Card className="modern-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Top Talkers</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topTalkers.map((talker) => (
            <div key={talker.deviceId} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{talker.hostname}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{talker.ip}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{talker.utilization}%</p>
                <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex items-center space-x-1">
                    <TrendingDown className="h-3 w-3" />
                    <span>{(talker.bytesIn / 1024 / 1024).toFixed(1)}MB</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>{(talker.bytesOut / 1024 / 1024).toFixed(1)}MB</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetworkPage() {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState('topology');
  
  const { data: topology, isLoading: topologyLoading, error: topologyError, refetch: refetchTopology } = useQuery({
    queryKey: ['network-topology'],
    queryFn: () => fetchNetworkTopology(getAuthHeaders()),
    refetchInterval: 30000,
  });
  
  const { data: networkMap, isLoading: mapLoading, error: mapError, refetch: refetchMap } = useQuery({
    queryKey: ['network-map'],
    queryFn: () => fetchNetworkMap(getAuthHeaders()),
    refetchInterval: 60000,
  });
  
  const handleRefresh = () => {
    refetchTopology();
    refetchMap();
  };
  
  if (topologyError || mapError) {
    return (
      <div className="p-6">
        <Card className="modern-card border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load network data</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Please check your connection and try again
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor your network topology and performance
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="topology" className="flex items-center space-x-2">
            <Layers className="h-4 w-4" />
            <span>Topology</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Geographic</span>
          </TabsTrigger>
          <TabsTrigger value="traffic" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Traffic</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="topology" className="space-y-6">
          {topologyLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="modern-card">
                  <CardHeader>
                    <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : topology ? (
            <NetworkTopologyView topology={topology} />
          ) : (
            <Card className="modern-card">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                    No network topology data available
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Network discovery may be in progress
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="map" className="space-y-6">
          {mapLoading ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="modern-card">
                    <CardHeader>
                      <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : networkMap ? (
            <NetworkMapView networkMap={networkMap} />
          ) : (
            <Card className="modern-card">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                    No network map data available
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Geographic data may not be configured
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="traffic" className="space-y-6">
          {topologyLoading ? (
            <Card className="modern-card">
              <CardHeader>
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : topology && topology.statistics && topology.statistics.topTalkers ? (
            <TopTalkersView topTalkers={topology.statistics.topTalkers} />
          ) : (
            <Card className="modern-card">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                    No traffic data available
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Traffic monitoring may be starting up
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}