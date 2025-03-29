-- Create schemas
CREATE SCHEMA IF NOT EXISTS siem;

-- Network monitoring tables
CREATE TABLE IF NOT EXISTS siem.packet_data (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    device_name TEXT NOT NULL,
    interface_index INTEGER,
    direction TEXT,
    
    -- Ethernet
    src_mac TEXT,
    dst_mac TEXT,
    ether_type TEXT,
    vlan_id INTEGER,
    is_multicast BOOLEAN,
    
    -- Network
    src_ip TEXT,
    dst_ip TEXT,
    ip_version TEXT,
    ttl INTEGER,
    protocol TEXT,
    fragment_id INTEGER,
    fragment_offset INTEGER,
    dscp INTEGER,
    icmp_type INTEGER,
    icmp_code INTEGER,
    
    -- Transport
    src_port INTEGER,
    dst_port INTEGER,
    tcp_flags TEXT,
    sequence_number BIGINT,
    acknowledgement_number BIGINT,
    window_size INTEGER,
    checksum_valid BOOLEAN,
    
    -- Application
    dns_id INTEGER,
    dns_opcode TEXT,
    dns_query JSONB,
    http_method TEXT,
    tls_version TEXT,
    sni TEXT,
    
    -- Payload
    payload_size INTEGER,
    payload_hash TEXT,
    
    -- Security & Behavioral
    is_malicious BOOLEAN DEFAULT FALSE,
    threat_type TEXT,
    cve_ids JSONB,
    src_country TEXT,
    dst_country TEXT,
    
    inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_packet_data_timestamp ON siem.packet_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_packet_data_src_ip ON siem.packet_data(src_ip);
CREATE INDEX IF NOT EXISTS idx_packet_data_dst_ip ON siem.packet_data(dst_ip);
CREATE INDEX IF NOT EXISTS idx_packet_data_protocol ON siem.packet_data(protocol);

-- Create log data table
CREATE TABLE IF NOT EXISTS siem.log_data (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    source TEXT NOT NULL,
    log_level TEXT,
    message TEXT NOT NULL,
    metadata JSONB,
    inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_log_data_timestamp ON siem.log_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_data_source ON siem.log_data(source);
CREATE INDEX IF NOT EXISTS idx_log_data_log_level ON siem.log_data(log_level);

-- Create materialized view for network statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS siem.network_stats AS
SELECT
    date_trunc('hour', timestamp) AS hour,
    COUNT(*) AS packet_count,
    COUNT(DISTINCT src_ip) AS unique_src_ips,
    COUNT(DISTINCT dst_ip) AS unique_dst_ips,
    SUM(payload_size) AS total_bytes,
    COUNT(CASE WHEN is_malicious THEN 1 END) AS malicious_packets
FROM
    siem.packet_data
GROUP BY
    date_trunc('hour', timestamp)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_network_stats_hour ON siem.network_stats(hour);

-- Create refresh function for materialized view
CREATE OR REPLACE FUNCTION siem.refresh_network_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY siem.network_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh materialized view
CREATE TRIGGER refresh_network_stats_trigger
AFTER INSERT ON siem.packet_data
FOR EACH STATEMENT
EXECUTE FUNCTION siem.refresh_network_stats();

-- Create users for the application
CREATE USER collector_user WITH PASSWORD 'collector_pass';
CREATE USER processor_user WITH PASSWORD 'processor_pass';
CREATE USER server_user WITH PASSWORD 'server_pass';

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA siem TO collector_user, processor_user, server_user;
GRANT SELECT, INSERT ON siem.packet_data TO processor_user;
GRANT SELECT ON siem.packet_data TO server_user;
GRANT SELECT ON siem.network_stats TO server_user;
GRANT SELECT, INSERT ON siem.log_data TO processor_user;
GRANT SELECT ON siem.log_data TO server_user;
