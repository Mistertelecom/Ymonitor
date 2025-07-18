// InfluxDB Service for Y Monitor
// Time-series data storage and retrieval for monitoring metrics

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { InterfaceMetrics } from '../monitoring/services/interface-monitoring.service';

export interface TimeSeriesPoint {
  measurement: string;
  tags: Record<string, string>;
  fields: Record<string, number | string | boolean>;
  timestamp?: Date;
}

export interface QueryOptions {
  start?: string | Date;
  stop?: string | Date;
  window?: string;
  aggregateFunction?: 'mean' | 'sum' | 'max' | 'min' | 'count';
  filters?: Record<string, string>;
}

@Injectable()
export class InfluxDBService implements OnModuleInit {
  private readonly logger = new Logger(InfluxDBService.name);
  private client: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private readonly bucket: string;
  private readonly org: string;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('INFLUXDB_URL', 'http://localhost:8086');
    const token = this.configService.get<string>('INFLUXDB_TOKEN', '');
    this.org = this.configService.get<string>('INFLUXDB_ORG', 'y-monitor');
    this.bucket = this.configService.get<string>('INFLUXDB_BUCKET', 'network-metrics');

    this.client = new InfluxDB({
      url,
      token,
    });

    this.writeApi = this.client.getWriteApi(this.org, this.bucket);
    this.queryApi = this.client.getQueryApi(this.org);

    // Configure write options
    this.writeApi.useDefaultTags({
      application: 'y-monitor',
      version: '1.0.0',
    });
  }

  async onModuleInit() {
    try {
      // Test connection
      await this.testConnection();
      this.logger.log('Connected to InfluxDB successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to InfluxDB: ${error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple ping query
      const query = `
        from(bucket: "${this.bucket}")
        |> range(start: -1m)
        |> limit(n: 1)
      `;
      
      await this.queryApi.queryRows(query, {
        next: () => {}, // We just want to test the connection
        error: (error) => {
          throw error;
        },
        complete: () => {},
      });
      
      return true;
    } catch (error) {
      this.logger.warn(`InfluxDB connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Write interface metrics to InfluxDB
   */
  async writeInterfaceMetrics(metrics: InterfaceMetrics): Promise<void> {
    try {
      const point = new Point('interface_metrics')
        .tag('device_id', metrics.deviceId)
        .tag('port_id', metrics.portId)
        .tag('if_index', metrics.ifIndex.toString())
        .tag('admin_status', metrics.ifAdminStatus === 1 ? 'up' : 'down')
        .tag('oper_status', metrics.ifOperStatus === 1 ? 'up' : 'down')
        .intField('if_in_octets', Number(metrics.ifInOctets))
        .intField('if_out_octets', Number(metrics.ifOutOctets))
        .intField('if_in_ucast_pkts', Number(metrics.ifInUcastPkts))
        .intField('if_out_ucast_pkts', Number(metrics.ifOutUcastPkts))
        .intField('if_in_discards', Number(metrics.ifInDiscards))
        .intField('if_out_discards', Number(metrics.ifOutDiscards))
        .intField('if_in_errors', Number(metrics.ifInErrors))
        .intField('if_out_errors', Number(metrics.ifOutErrors))
        .timestamp(metrics.timestamp);

      // Add high-capacity counters if available
      if (metrics.ifHCInOctets) {
        point.intField('if_hc_in_octets', Number(metrics.ifHCInOctets));
      }
      if (metrics.ifHCOutOctets) {
        point.intField('if_hc_out_octets', Number(metrics.ifHCOutOctets));
      }

      // Add calculated metrics
      if (metrics.utilization !== undefined) {
        point.floatField('utilization', metrics.utilization);
      }
      if (metrics.inUtilization !== undefined) {
        point.floatField('in_utilization', metrics.inUtilization);
      }
      if (metrics.outUtilization !== undefined) {
        point.floatField('out_utilization', metrics.outUtilization);
      }
      if (metrics.errorRate !== undefined) {
        point.floatField('error_rate', metrics.errorRate);
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      this.logger.error(`Failed to write interface metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write device metrics to InfluxDB
   */
  async writeDeviceMetrics(
    deviceId: string,
    hostname: string,
    metrics: {
      status: string;
      responseTime: number;
      availability: number;
      uptime?: number;
      cpu?: number;
      memory?: number;
      diskUsage?: number;
    },
    timestamp?: Date
  ): Promise<void> {
    try {
      const point = new Point('device_metrics')
        .tag('device_id', deviceId)
        .tag('hostname', hostname)
        .tag('status', metrics.status)
        .floatField('response_time', metrics.responseTime)
        .floatField('availability', metrics.availability)
        .timestamp(timestamp || new Date());

      if (metrics.uptime !== undefined) {
        point.intField('uptime', metrics.uptime);
      }
      if (metrics.cpu !== undefined) {
        point.floatField('cpu_usage', metrics.cpu);
      }
      if (metrics.memory !== undefined) {
        point.floatField('memory_usage', metrics.memory);
      }
      if (metrics.diskUsage !== undefined) {
        point.floatField('disk_usage', metrics.diskUsage);
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      this.logger.error(`Failed to write device metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write sensor metrics to InfluxDB
   */
  async writeSensorMetrics(
    deviceId: string,
    sensorId: string,
    sensorType: string,
    value: number,
    unit?: string,
    timestamp?: Date
  ): Promise<void> {
    try {
      const point = new Point('sensor_metrics')
        .tag('device_id', deviceId)
        .tag('sensor_id', sensorId)
        .tag('sensor_type', sensorType)
        .floatField('value', value)
        .timestamp(timestamp || new Date());

      if (unit) {
        point.tag('unit', unit);
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      this.logger.error(`Failed to write sensor metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write alert metrics to InfluxDB
   */
  async writeAlertMetrics(
    deviceId: string,
    alertType: string,
    severity: string,
    count: number,
    timestamp?: Date
  ): Promise<void> {
    try {
      const point = new Point('alert_metrics')
        .tag('device_id', deviceId)
        .tag('alert_type', alertType)
        .tag('severity', severity)
        .intField('count', count)
        .timestamp(timestamp || new Date());

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      this.logger.error(`Failed to write alert metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Query interface utilization data
   */
  async queryInterfaceUtilization(
    deviceId: string,
    portId: string,
    options: QueryOptions = {}
  ): Promise<Array<{ timestamp: Date; utilization: number }>> {
    const start = options.start || '-24h';
    const stop = options.stop || 'now()';
    const window = options.window || '5m';

    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: ${typeof start === 'string' ? start : start.toISOString()}, stop: ${typeof stop === 'string' ? stop : stop.toISOString()})
      |> filter(fn: (r) => r._measurement == "interface_metrics")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r.port_id == "${portId}")
      |> filter(fn: (r) => r._field == "utilization")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "mean")
    `;

    return this.executeQuery(query);
  }

  /**
   * Query device availability data
   */
  async queryDeviceAvailability(
    deviceId: string,
    options: QueryOptions = {}
  ): Promise<Array<{ timestamp: Date; availability: number }>> {
    const start = options.start || '-24h';
    const stop = options.stop || 'now()';
    const window = options.window || '5m';

    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: ${typeof start === 'string' ? start : start.toISOString()}, stop: ${typeof stop === 'string' ? stop : stop.toISOString()})
      |> filter(fn: (r) => r._measurement == "device_metrics")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r._field == "availability")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "mean")
    `;

    return this.executeQuery(query);
  }

  /**
   * Query network bandwidth data
   */
  async queryNetworkBandwidth(
    deviceIds: string[],
    options: QueryOptions = {}
  ): Promise<Array<{ timestamp: Date; inbound: number; outbound: number }>> {
    const start = options.start || '-24h';
    const stop = options.stop || 'now()';
    const window = options.window || '5m';

    const deviceFilter = deviceIds.map(id => `r.device_id == "${id}"`).join(' or ');

    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: ${typeof start === 'string' ? start : start.toISOString()}, stop: ${typeof stop === 'string' ? stop : stop.toISOString()})
      |> filter(fn: (r) => r._measurement == "interface_metrics")
      |> filter(fn: (r) => ${deviceFilter})
      |> filter(fn: (r) => r._field == "if_in_octets" or r._field == "if_out_octets")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ r with inbound: r.if_in_octets, outbound: r.if_out_octets }))
      |> yield(name: "sum")
    `;

    return this.executeQuery(query);
  }

  /**
   * Query top interfaces by utilization
   */
  async queryTopInterfacesByUtilization(
    limit: number = 10,
    options: QueryOptions = {}
  ): Promise<Array<{ deviceId: string; portId: string; utilization: number }>> {
    const start = options.start || '-1h';
    const stop = options.stop || 'now()';

    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: ${typeof start === 'string' ? start : start.toISOString()}, stop: ${typeof stop === 'string' ? stop : stop.toISOString()})
      |> filter(fn: (r) => r._measurement == "interface_metrics")
      |> filter(fn: (r) => r._field == "utilization")
      |> group(columns: ["device_id", "port_id"])
      |> mean()
      |> sort(columns: ["_value"], desc: true)
      |> limit(n: ${limit})
      |> yield(name: "mean")
    `;

    return this.executeQuery(query);
  }

  /**
   * Query alert trends
   */
  async queryAlertTrends(
    hours: number = 24,
    options: QueryOptions = {}
  ): Promise<Array<{ timestamp: Date; critical: number; warning: number; info: number }>> {
    const start = options.start || `-${hours}h`;
    const stop = options.stop || 'now()';
    const window = options.window || '1h';

    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: ${typeof start === 'string' ? start : start.toISOString()}, stop: ${typeof stop === 'string' ? stop : stop.toISOString()})
      |> filter(fn: (r) => r._measurement == "alert_metrics")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["severity"], valueColumn: "_value")
      |> map(fn: (r) => ({ 
        r with 
        critical: if exists r.CRITICAL then r.CRITICAL else 0,
        warning: if exists r.WARNING then r.WARNING else 0,
        info: if exists r.INFO then r.INFO else 0
      }))
      |> yield(name: "sum")
    `;

    return this.executeQuery(query);
  }

  /**
   * Execute a Flux query and return results
   */
  private async executeQuery(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const result = tableMeta.toObject(row);
          results.push({
            timestamp: new Date(result._time),
            ...result,
          });
        },
        error: (error) => {
          this.logger.error(`Query execution failed: ${error.message}`);
          reject(error);
        },
        complete: () => {
          resolve(results);
        },
      });
    });
  }

  /**
   * Write multiple points at once
   */
  async writePoints(points: TimeSeriesPoint[]): Promise<void> {
    try {
      const influxPoints = points.map(point => {
        const p = new Point(point.measurement);
        
        // Add tags
        Object.entries(point.tags).forEach(([key, value]) => {
          p.tag(key, value);
        });

        // Add fields
        Object.entries(point.fields).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (Number.isInteger(value)) {
              p.intField(key, value);
            } else {
              p.floatField(key, value);
            }
          } else if (typeof value === 'boolean') {
            p.booleanField(key, value);
          } else {
            p.stringField(key, String(value));
          }
        });

        if (point.timestamp) {
          p.timestamp(point.timestamp);
        }

        return p;
      });

      this.writeApi.writePoints(influxPoints);
      await this.writeApi.flush();
    } catch (error) {
      this.logger.error(`Failed to write points: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    try {
      await this.writeApi.close();
      this.logger.log('InfluxDB connection closed');
    } catch (error) {
      this.logger.error(`Failed to close InfluxDB connection: ${error.message}`);
    }
  }

  /**
   * Query sensor metrics
   */
  async querySensorMetrics(
    deviceId: string,
    sensorId?: string,
    timeRange: string = '1h'
  ): Promise<Array<{ timestamp: Date; value: number; sensorType: string }>> {
    if (!sensorId) {
      throw new Error('Sensor ID is required');
    }

    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: -${timeRange})
      |> filter(fn: (r) => r._measurement == "sensor_metrics")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r.sensor_id == "${sensorId}")
      |> filter(fn: (r) => r._field == "value")
      |> yield(name: "sensor_data")
    `;

    return this.executeQuery(query);
  }

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(
    measurement: string,
    deviceId: string,
    timeRange: string,
    window: string
  ): Promise<Array<{ timestamp: Date; mean: number; max: number; min: number }>> {
    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: -${timeRange})
      |> filter(fn: (r) => r._measurement == "${measurement}")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "aggregated")
    `;

    return this.executeQuery(query);
  }

  /**
   * Updated writeInterfaceMetrics with correct signature for tests
   */
  async writeInterfaceMetricsLegacy(
    deviceId: string,
    portId: string,
    ifIndex: number,
    inOctets: number,
    outOctets: number,
    inPackets: number,
    outPackets: number,
    timestamp: Date
  ): Promise<void> {
    const metrics: InterfaceMetrics = {
      deviceId,
      portId,
      ifIndex,
      timestamp,
      ifInOctets: BigInt(inOctets),
      ifOutOctets: BigInt(outOctets),
      ifInUcastPkts: BigInt(inPackets),
      ifOutUcastPkts: BigInt(outPackets),
      ifInNUcastPkts: BigInt(0),
      ifOutNUcastPkts: BigInt(0),
      ifInDiscards: BigInt(0),
      ifOutDiscards: BigInt(0),
      ifInErrors: BigInt(0),
      ifOutErrors: BigInt(0),
      ifAdminStatus: 1,
      ifOperStatus: 1,
    };

    return this.writeInterfaceMetrics(metrics);
  }

  /**
   * Query interface metrics
   */
  async queryInterfaceMetrics(
    deviceId: string,
    portId: string,
    timeRange: string = '1h'
  ): Promise<Array<{ timestamp: Date; inOctets: number; outOctets: number; utilization: number }>> {
    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: -${timeRange})
      |> filter(fn: (r) => r._measurement == "interface_metrics")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r.port_id == "${portId}")
      |> filter(fn: (r) => r._field == "if_in_octets" or r._field == "if_out_octets" or r._field == "utilization")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> yield(name: "interface_data")
    `;

    return this.executeQuery(query);
  }

  /**
   * Query device metrics
   */
  async queryDeviceMetrics(
    deviceId: string,
    timeRange: string = '1h'
  ): Promise<Array<{ timestamp: Date; availability: number; responseTime: number; status: string }>> {
    const query = `
      from(bucket: "${this.bucket}")
      |> range(start: -${timeRange})
      |> filter(fn: (r) => r._measurement == "device_metrics")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r._field == "availability" or r._field == "response_time")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> yield(name: "device_data")
    `;

    return this.executeQuery(query);
  }

  /**
   * Module destroy handler
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  onApplicationShutdown() {
    this.close();
  }
}