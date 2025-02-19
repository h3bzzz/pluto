-- +goose Up
CREATE TABLE network_packets (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    src_mac MACADDR,
    dst_mac MACADDR,
    ether_type VARCHAR(50),
    vlan_id INTEGER,
    is_multicast BOOLEAN,
    src_ip INET,
    dst_ip INET,
    ip_version VARCHAR(4),
    ttl INTEGER,
    protocol VARCHAR(50),
    fragment_id INTEGER,
    fragment_offset INTEGER,
    dscp INTEGER,
    icmp_type INTEGER,
    icmp_code INTEGER,
    src_port INTEGER,
    dst_port INTEGER,
    tcp_flags VARCHAR(10),
    sequence_number BIGINT,
    acknowledgement_number BIGINT,
    window_size INTEGER,
    dns_id INTEGER,
    dns_opcode VARCHAR(50),
    dns_query TEXT[],
    http_method VARCHAR(10),
    tls_version VARCHAR(50),
    sni VARCHAR(255),
    payload_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_network_packets_timestamp ON network_packets (timestamp);
CREATE INDEX idx_network_packets_src_ip ON network_packets (src_ip);
CREATE INDEX idx_network_packets_dst_ip ON network_packets (dst_ip);

CREATE TABLE log_entries (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(50),
    source VARCHAR(255),
    category VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_entries_timestamp ON log_entries (timestamp);
CREATE INDEX idx_log_entries_severity ON log_entries (severity);

-- +goose Down
DROP INDEX IF EXISTS idx_network_packets_timestamp;
DROP INDEX IF EXISTS idx_network_packets_src_ip;
DROP INDEX IF EXISTS idx_network_packets_dst_ip;
DROP TABLE IF EXISTS network_packets;

DROP INDEX IF EXISTS idx_log_entries_timestamp;
DROP INDEX IF EXISTS idx_log_entries_severity;
DROP TABLE IF EXISTS log_entries;

