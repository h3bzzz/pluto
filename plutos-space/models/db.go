package models

import (
	"database/sql"
	"time"
)

type DB struct {
	*sql.DB
}

func NewDB(db *sql.DB) *DB {
	return &DB{db}
}

func (db *DB) StorePacket(packet NetworkPacket) error {
	_, err := db.Exec(`
		INSERT INTO siem.packet_data (
			timestamp, device_name, src_ip, dst_ip, 
			src_port, dst_port, protocol, payload_size, 
			is_malicious
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`,
		packet.Timestamp,
		packet.DeviceName,
		packet.SrcIP,
		packet.DstIP,
		packet.SrcPort,
		packet.DstPort,
		packet.Protocol,
		packet.PayloadSize,
		packet.IsMalicious)

	return err
}

func (db *DB) GetRecentPackets(limit int) ([]NetworkPacket, error) {
	rows, err := db.Query(`
		SELECT 
			timestamp, device_name, src_ip, dst_ip, 
			src_port, dst_port, protocol, payload_size, 
			is_malicious
		FROM siem.packet_data
		ORDER BY timestamp DESC
		LIMIT $1
	`, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var packets []NetworkPacket
	for rows.Next() {
		var p NetworkPacket
		err := rows.Scan(
			&p.Timestamp,
			&p.DeviceName,
			&p.SrcIP,
			&p.DstIP,
			&p.SrcPort,
			&p.DstPort,
			&p.Protocol,
			&p.PayloadSize,
			&p.IsMalicious,
		)
		if err != nil {
			return nil, err
		}
		packets = append(packets, p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return packets, nil
}

func (db *DB) GetNetworkStats(since time.Time) (map[string]interface{}, error) {
	row := db.QueryRow(`
		SELECT
			COUNT(*) AS packet_count,
			COUNT(DISTINCT src_ip) AS unique_src_ips,
			COUNT(DISTINCT dst_ip) AS unique_dst_ips,
			SUM(payload_size) AS total_bytes,
			COUNT(CASE WHEN is_malicious THEN 1 END) AS malicious_packets
		FROM
			siem.packet_data
		WHERE
			timestamp > $1
	`, since)

	stats := make(map[string]interface{})
	var packetCount, uniqueSrcIPs, uniqueDstIPs, maliciousPackets int
	var totalBytes sql.NullInt64

	err := row.Scan(&packetCount, &uniqueSrcIPs, &uniqueDstIPs, &totalBytes, &maliciousPackets)
	if err != nil {
		return nil, err
	}

	stats["packet_count"] = packetCount
	stats["unique_src_ips"] = uniqueSrcIPs
	stats["unique_dst_ips"] = uniqueDstIPs
	stats["total_bytes"] = totalBytes.Int64
	stats["malicious_packets"] = maliciousPackets
	stats["period_start"] = since.Format(time.RFC3339)
	stats["period_end"] = time.Now().Format(time.RFC3339)

	return stats, nil
}

func (db *DB) GetTopSources(limit int, since time.Time) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT 
			src_ip, 
			COUNT(*) as packet_count,
			SUM(payload_size) as total_bytes
		FROM siem.packet_data
		WHERE timestamp > $1
		GROUP BY src_ip
		ORDER BY packet_count DESC
		LIMIT $2
	`, since, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var srcIP string
		var packetCount int
		var totalBytes sql.NullInt64

		if err := rows.Scan(&srcIP, &packetCount, &totalBytes); err != nil {
			return nil, err
		}

		result := map[string]interface{}{
			"src_ip":       srcIP,
			"packet_count": packetCount,
			"total_bytes":  totalBytes.Int64,
		}

		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return results, nil
}

func (db *DB) GetTopDestinations(limit int, since time.Time) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT 
			dst_ip, 
			COUNT(*) as packet_count,
			SUM(payload_size) as total_bytes
		FROM siem.packet_data
		WHERE timestamp > $1
		GROUP BY dst_ip
		ORDER BY packet_count DESC
		LIMIT $2
	`, since, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var dstIP string
		var packetCount int
		var totalBytes sql.NullInt64

		if err := rows.Scan(&dstIP, &packetCount, &totalBytes); err != nil {
			return nil, err
		}

		result := map[string]interface{}{
			"dst_ip":       dstIP,
			"packet_count": packetCount,
			"total_bytes":  totalBytes.Int64,
		}

		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return results, nil
}

func (db *DB) GetProtocolStats(since time.Time) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT 
			protocol, 
			COUNT(*) as packet_count
		FROM siem.packet_data
		WHERE timestamp > $1
		GROUP BY protocol
		ORDER BY packet_count DESC
	`, since)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var protocol string
		var packetCount int

		if err := rows.Scan(&protocol, &packetCount); err != nil {
			return nil, err
		}

		result := map[string]interface{}{
			"protocol":     protocol,
			"packet_count": packetCount,
		}

		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return results, nil
}
