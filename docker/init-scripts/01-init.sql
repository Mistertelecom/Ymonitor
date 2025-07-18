-- Y Monitor Database Initialization Script
-- This script sets up the initial database structure and configuration

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant permissions
GRANT USAGE ON SCHEMA monitoring TO ymonitor;
GRANT USAGE ON SCHEMA analytics TO ymonitor;
GRANT USAGE ON SCHEMA audit TO ymonitor;

GRANT CREATE ON SCHEMA monitoring TO ymonitor;
GRANT CREATE ON SCHEMA analytics TO ymonitor;
GRANT CREATE ON SCHEMA audit TO ymonitor;

-- Create audit function for tracking changes
CREATE OR REPLACE FUNCTION audit.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            old_values,
            performed_at,
            performed_by
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            NOW(),
            current_user
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            old_values,
            new_values,
            performed_at,
            performed_by
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            row_to_json(NEW),
            NOW(),
            current_user
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            new_values,
            performed_at,
            performed_by
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(NEW),
            NOW(),
            current_user
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performed_by TEXT DEFAULT current_user
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON audit.audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit.audit_log(operation);

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES 
('system.version', '"1.0.0"'),
('system.installation_date', to_jsonb(NOW())),
('monitoring.default_snmp_community', '"public"'),
('monitoring.default_snmp_version', '"2c"'),
('monitoring.discovery_interval', '300'),
('monitoring.polling_interval', '60'),
('alerts.retention_days', '30'),
('ui.theme', '"system"'),
('ui.items_per_page', '25')
ON CONFLICT (key) DO NOTHING;

-- Create performance optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_ip ON public.devices(ip);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_hostname ON public.devices(hostname);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_type ON public.devices(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_location ON public.devices(location_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ports_device_id ON public.ports(device_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ports_if_index ON public.ports(device_id, if_index);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ports_status ON public.ports(if_admin_status, if_oper_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_device_id ON public.sensors(device_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_type ON public.sensors(sensor_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_timestamp ON public.alerts(timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_state ON public.alerts(state);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_device_id ON public.alerts(device_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON public.users(is_active);

-- Full text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_search 
ON public.devices USING gin(to_tsvector('english', hostname || ' ' || COALESCE(display_name, '') || ' ' || COALESCE(sys_descr, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_search 
ON public.alerts USING gin(to_tsvector('english', message));

ANALYZE;