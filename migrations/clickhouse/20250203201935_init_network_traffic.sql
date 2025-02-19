-- +goose Up
CREATE TABLE IF NOT EXISTS network_packets (
    timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    device_name String CODEC(ZSTD(1)),
    src_mac String CODEC(ZSTD(1)),
    dst_mac String CODEC(ZSTD(1)),
    ether_type String CODEC(ZSTD(1)),
    vlan_id UInt16 CODEC(ZSTD(1)),
    is_multicast UInt8 CODEC(ZSTD(1)),
    src_ip String CODEC(ZSTD(1)),
    dst_ip String CODEC(ZSTD(1)),
    ip_version String CODEC(ZSTD(1)),
    ttl UInt8 CODEC(ZSTD(1)),
    protocol String CODEC(ZSTD(1)),
    fragment_id UInt32 CODEC(ZSTD(1)),
    fragment_offset UInt16 CODEC(ZSTD(1)),
    dscp UInt8 CODEC(ZSTD(1)),
    icmp_type UInt8 CODEC(ZSTD(1)),
    icmp_code UInt8 CODEC(ZSTD(1)),
    src_port UInt16 CODEC(ZSTD(1)),
    dst_port UInt16 CODEC(ZSTD(1)),
    tcp_flags String CODEC(ZSTD(1)),
    sequence_number UInt32 CODEC(ZSTD(1)),
    acknowledgement_number UInt32 CODEC(ZSTD(1)),
    window_size UInt16 CODEC(ZSTD(1)),
    dns_id UInt16 CODEC(ZSTD(1)),
    dns_opcode String CODEC(ZSTD(1)),
    dns_query Array(String) CODEC(ZSTD(1)),
    http_method String CODEC(ZSTD(1)),
    tls_version String CODEC(ZSTD(1)),
    sni String CODEC(ZSTD(1)),
    payload_size UInt32 CODEC(ZSTD(1))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, device_name)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS log_entries (
    timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    file_path String CODEC(ZSTD(1)),
    message String CODEC(ZSTD(1)),
    severity String CODEC(ZSTD(1)),
    source String CODEC(ZSTD(1)),
    category String CODEC(ZSTD(1))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, severity)
SETTINGS index_granularity = 8192;

-- +goose Down
DROP TABLE IF EXISTS log_entries;
DROP TABLE IF EXISTS network_packets;

