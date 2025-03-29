package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/segmentio/kafka-go"
)

var (
	kafkaAddr    = flag.String("kafka", "kafka:29092", "Kafka broker address")
	networkTopic = flag.String("network-topic", "network-monitoring", "Kafka topic for network data")
	logTopic     = flag.String("log-topic", "log-data", "Kafka topic for log data")
	pgConnStr    = flag.String("pg", "postgres://processor_user:processor_pass@postgres:5432/siemdb", "PostgreSQL connection string")
	concurrency  = flag.Int("concurrency", 5, "Number of concurrent workers per topic")
)

type PacketData struct {
	Timestamp  time.Time `json:"timestamp"`
	DeviceName string    `json:"device_name"`
	IfaceIndex int       `json:"interface_index,omitempty"`
	Direction  string    `json:"direction,omitempty"`

	// Ethernet
	SrcMAC      string `json:"src_mac,omitempty"`
	DstMAC      string `json:"dst_mac,omitempty"`
	EtherType   string `json:"ether_type,omitempty"`
	VLANID      uint16 `json:"vlan_id,omitempty"`
	IsMultiCast bool   `json:"is_multicast,omitempty"`

	// Network
	SrcIP      string `json:"src_ip,omitempty"`
	DstIP      string `json:"dst_ip,omitempty"`
	IPVrs      string `json:"ip_version,omitempty"`
	TTL        uint8  `json:"ttl,omitempty"`
	Protocol   string `json:"protocol,omitempty"`
	FragID     uint32 `json:"fragment_id,omitempty"`
	FragOffset uint16 `json:"fragment_offset,omitempty"`
	DSCP       uint8  `json:"dscp,omitempty"`
	ICMPType   uint8  `json:"icmp_type,omitempty"`
	ICMPCode   uint8  `json:"icmp_code,omitempty"`

	// Transport
	SrcPort       uint16 `json:"src_port,omitempty"`
	DstPort       uint16 `json:"dst_port,omitempty"`
	TCPFlags      string `json:"tcp_flags,omitempty"`
	SeqNum        uint32 `json:"sequence_number,omitempty"`
	AckNum        uint32 `json:"acknowledgement_number,omitempty"`
	WindowSize    uint16 `json:"window_size,omitempty"`
	ChecksumValid bool   `json:"checksum_valid,omitempty"`

	// Application
	DNSID      uint16   `json:"dns_id,omitempty"`
	DNSOpCode  string   `json:"dns_opcode,omitempty"`
	DNSQuery   []string `json:"dns_query,omitempty"`
	HTTPMethod string   `json:"http_method,omitempty"`
	TLSVrs     string   `json:"tls_version,omitempty"`
	SNI        string   `json:"sni,omitempty"`

	// Payload
	PayloadSize int    `json:"payload_size,omitempty"`
	PayloadHash string `json:"payload_hash,omitempty"`

	// Security & Behavioral
	IsMalicious bool     `json:"is_malicious,omitempty"`
	ThreatType  string   `json:"threat_type,omitempty"`
	CVEIDs      []string `json:"cve_ids,omitempty"`
	GeoIP       struct {
		SrcCountry string `json:"src_country,omitempty"`
		DstCountry string `json:"dst_country,omitempty"`
	} `json:"geoip,omitempty"`
}

type LogData struct {
	Timestamp time.Time         `json:"timestamp"`
	Source    string            `json:"source"`
	LogLevel  string            `json:"log_level"`
	Message   string            `json:"message"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

func main() {
	flag.Parse()

	ctx := context.Background()

	poolConfig, err := pgxpool.ParseConfig(*pgConnStr)
	if err != nil {
		log.Fatalf("Failed to parse PostgreSQL connection string: %v", err)
	}

	poolConfig.MaxConns = 20
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer dbPool.Close()

	if err := dbPool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping PostgreSQL: %v", err)
	}
	log.Println("Connected to PostgreSQL database")

	ctxWithCancel, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup

	for i := 0; i < *concurrency; i++ {
		wg.Add(1)
		go consumeNetworkData(ctxWithCancel, dbPool, i, &wg)
	}

	for i := 0; i < *concurrency; i++ {
		wg.Add(1)
		go consumeLogData(ctxWithCancel, dbPool, i, &wg)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
	log.Println("Shutting down processor...")

	cancel()

	wg.Wait()
	log.Println("Processor shut down successfully")
}

func consumeNetworkData(ctx context.Context, dbPool *pgxpool.Pool, workerID int, wg *sync.WaitGroup) {
	defer wg.Done()

	groupID := fmt.Sprintf("network-processor-%d", workerID)

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{*kafkaAddr},
		Topic:       *networkTopic,
		GroupID:     groupID,
		MinBytes:    10e3,
		MaxBytes:    10e6,
		StartOffset: kafka.FirstOffset,
		MaxWait:     500 * time.Millisecond,
	})
	defer reader.Close()

	log.Printf("[Worker %d] Started consuming network data from Kafka", workerID)

	const insertQuery = `
		INSERT INTO siem.packet_data (
			timestamp, device_name, interface_index, direction,
			src_mac, dst_mac, ether_type, vlan_id, is_multicast,
			src_ip, dst_ip, ip_version, ttl, protocol, fragment_id, fragment_offset, dscp, icmp_type, icmp_code,
			src_port, dst_port, tcp_flags, sequence_number, acknowledgement_number, window_size, checksum_valid,
			dns_id, dns_opcode, dns_query, http_method, tls_version, sni,
			payload_size, payload_hash,
			is_malicious, threat_type, cve_ids, src_country, dst_country
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8, $9,
			$10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
			$20, $21, $22, $23, $24, $25, $26,
			$27, $28, $29, $30, $31, $32,
			$33, $34,
			$35, $36, $37, $38, $39
		)
	`

	for {
		select {
		case <-ctx.Done():
			return
		default:
			readCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			m, err := reader.ReadMessage(readCtx)
			cancel()

			if err != nil {
				if err == context.Canceled || err == context.DeadlineExceeded {
					continue
				}
				log.Printf("[Worker %d] Error reading message: %v", workerID, err)
				time.Sleep(1 * time.Second)
				continue
			}

			var packet PacketData
			if err := json.Unmarshal(m.Value, &packet); err != nil {
				log.Printf("[Worker %d] Error unmarshaling packet data: %v", workerID, err)
				continue
			}

			dnsQueryJSON, err := json.Marshal(packet.DNSQuery)
			if err != nil {
				dnsQueryJSON = []byte("[]")
			}

			cveJSON, err := json.Marshal(packet.CVEIDs)
			if err != nil {
				cveJSON = []byte("[]")
			}

			_, err = dbPool.Exec(ctx, insertQuery,
				packet.Timestamp, packet.DeviceName, packet.IfaceIndex, packet.Direction,
				packet.SrcMAC, packet.DstMAC, packet.EtherType, packet.VLANID, packet.IsMultiCast,
				packet.SrcIP, packet.DstIP, packet.IPVrs, packet.TTL, packet.Protocol, packet.FragID, packet.FragOffset, packet.DSCP, packet.ICMPType, packet.ICMPCode,
				packet.SrcPort, packet.DstPort, packet.TCPFlags, packet.SeqNum, packet.AckNum, packet.WindowSize, packet.ChecksumValid,
				packet.DNSID, packet.DNSOpCode, dnsQueryJSON, packet.HTTPMethod, packet.TLSVrs, packet.SNI,
				packet.PayloadSize, packet.PayloadHash,
				packet.IsMalicious, packet.ThreatType, cveJSON, packet.GeoIP.SrcCountry, packet.GeoIP.DstCountry,
			)
			if err != nil {
				log.Printf("[Worker %d] Error inserting packet data: %v", workerID, err)
				continue
			}
		}
	}
}

func consumeLogData(ctx context.Context, dbPool *pgxpool.Pool, workerID int, wg *sync.WaitGroup) {
	defer wg.Done()

	groupID := fmt.Sprintf("log-processor-%d", workerID)

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{*kafkaAddr},
		Topic:       *logTopic,
		GroupID:     groupID,
		MinBytes:    10e3,
		MaxBytes:    10e6,
		StartOffset: kafka.FirstOffset,
		MaxWait:     500 * time.Millisecond,
	})
	defer reader.Close()

	log.Printf("[Worker %d] Started consuming log data from Kafka", workerID)

	const insertQuery = `
		INSERT INTO siem.log_data (
			timestamp, source, log_level, message, metadata
		) VALUES (
			$1, $2, $3, $4, $5
		)
	`

	for {
		select {
		case <-ctx.Done():
			return
		default:
			readCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			m, err := reader.ReadMessage(readCtx)
			cancel()

			if err != nil {
				if err == context.Canceled || err == context.DeadlineExceeded {
					continue
				}
				log.Printf("[Worker %d] Error reading message: %v", workerID, err)
				time.Sleep(1 * time.Second)
				continue
			}

			var logData LogData
			if err := json.Unmarshal(m.Value, &logData); err != nil {
				log.Printf("[Worker %d] Error unmarshaling log data: %v", workerID, err)
				continue
			}

			metadataJSON, err := json.Marshal(logData.Metadata)
			if err != nil {
				metadataJSON = []byte("{}")
			}

			_, err = dbPool.Exec(ctx, insertQuery,
				logData.Timestamp, logData.Source, logData.LogLevel, logData.Message, metadataJSON,
			)
			if err != nil {
				log.Printf("[Worker %d] Error inserting log data: %v", workerID, err)
				continue
			}
		}
	}
}
