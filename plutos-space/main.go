package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/h3bzzz/pluto/plutos-space/models"
	_ "github.com/lib/pq"
	"github.com/rs/cors"
)

var (
	pgConnStr    = flag.String("pg", "postgres://server_user:server_pass@postgres:5432/siemdb?sslmode=disable", "PostgreSQL connection string")
	port         = flag.Int("port", 8000, "Server port")
	kafkaAddr    = flag.String("kafka", "kafka:29092", "Kafka-Broker Address")
	networkTopic = flag.String("network-topic", "network-pluto", "Kafka topic for network data")
)

var db *sql.DB

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var (
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
)

func main() {
	flag.Parse()

	var err error
	db, err = sql.Open("postgres", *pgConnStr)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping PostgreSQL: %v", err)
	}
	log.Println("Connected to PostgreSQL database")

	dbWrapper := models.NewDB(db)

	consumer := models.NewKafkaConsumer(*kafkaAddr, *networkTopic, "plutos-space-server")
	consumer.Start()
	defer consumer.Stop()

	go models.ProcessMessages(dbWrapper, consumer.MessageChan)
	log.Printf("Started Kafka consumer for topic: %s", *networkTopic)

	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", healthHandler).Methods("GET")
	api.HandleFunc("/stats", statsHandler).Methods("GET")
	api.HandleFunc("/packets", packetsHandler).Methods("GET")
	api.HandleFunc("/logs", logsHandler).Methods("GET")
	api.HandleFunc("/top-sources", topSourcesHandler).Methods("GET")
	api.HandleFunc("/top-destinations", topDestinationsHandler).Methods("GET")
	api.HandleFunc("/protocols", protocolsHandler).Methods("GET")
	api.HandleFunc("/packet-timeline", packetTimelineHandler).Methods("GET")
	api.HandleFunc("/alerts", alertsHandler).Methods("GET")

	r.HandleFunc("/ws", wsHandler)

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}).Handler(r)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", *port),
		Handler: handler,
	}

	ctx, cancel := context.WithCancel(context.Background())
	go broadcastNetworkStats(ctx)

	go func() {
		log.Printf("Starting server on port %d", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Error starting server: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
	log.Println("Shutting down server...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	log.Println("Server shut down successfully")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "24h"
	}

	var since time.Time
	switch period {
	case "1h":
		since = time.Now().Add(-1 * time.Hour)
	case "6h":
		since = time.Now().Add(-6 * time.Hour)
	case "24h":
		since = time.Now().Add(-24 * time.Hour)
	case "7d":
		since = time.Now().Add(-7 * 24 * time.Hour)
	case "30d":
		since = time.Now().Add(-30 * 24 * time.Hour)
	default:
		since = time.Now().Add(-24 * time.Hour)
	}

	rows, err := db.Query(`
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
	if err != nil {
		log.Printf("Error querying statistics: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	if !rows.Next() {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"packet_count":      0,
			"unique_src_ips":    0,
			"unique_dst_ips":    0,
			"total_bytes":       0,
			"malicious_packets": 0,
			"period":            period,
			"period_start":      since.Format(time.RFC3339),
			"period_end":        time.Now().Format(time.RFC3339),
		})
		return
	}

	var packetCount, uniqueSrcIPs, uniqueDstIPs, maliciousPackets int
	var totalBytes int64
	if err := rows.Scan(&packetCount, &uniqueSrcIPs, &uniqueDstIPs, &totalBytes, &maliciousPackets); err != nil {
		log.Printf("Error scanning statistics: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"packet_count":      packetCount,
		"unique_src_ips":    uniqueSrcIPs,
		"unique_dst_ips":    uniqueDstIPs,
		"total_bytes":       totalBytes,
		"malicious_packets": maliciousPackets,
		"period":            period,
		"period_start":      since.Format(time.RFC3339),
		"period_end":        time.Now().Format(time.RFC3339),
	})
}

func packetsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	offset := 0
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	filterClauses := []string{"1=1"}
	filterParams := []interface{}{}
	paramIndex := 1

	if srcIP := r.URL.Query().Get("src_ip"); srcIP != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("src_ip = $%d", paramIndex))
		filterParams = append(filterParams, srcIP)
		paramIndex++
	}

	if dstIP := r.URL.Query().Get("dst_ip"); dstIP != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("dst_ip = $%d", paramIndex))
		filterParams = append(filterParams, dstIP)
		paramIndex++
	}

	if protocol := r.URL.Query().Get("protocol"); protocol != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("protocol = $%d", paramIndex))
		filterParams = append(filterParams, protocol)
		paramIndex++
	}

	whereClause := ""
	for i, clause := range filterClauses {
		if i == 0 {
			whereClause = "WHERE " + clause
		} else {
			whereClause += " AND " + clause
		}
	}

	filterParams = append(filterParams, limit, offset)
	limitOffsetParams := []interface{}{paramIndex, paramIndex + 1}
	paramIndex += 2

	query := fmt.Sprintf(`
		SELECT
			id, timestamp, device_name, src_mac, dst_mac,
			src_ip, dst_ip, protocol, src_port, dst_port,
			ip_version, ttl, tcp_flags, payload_size,
			is_malicious, threat_type
		FROM
			siem.packet_data
		%s
		ORDER BY
			timestamp DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, limitOffsetParams[0], limitOffsetParams[1])

	rows, err := db.Query(query, filterParams...)
	if err != nil {
		log.Printf("Error querying packets: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) FROM siem.packet_data %s
	`, whereClause)

	var totalCount int
	if err := db.QueryRow(countQuery, filterParams[:len(filterParams)-2]...).Scan(&totalCount); err != nil {
		log.Printf("Error counting packets: %v", err)
		totalCount = 0
	}

	packets := []map[string]interface{}{}
	for rows.Next() {
		var (
			id, srcPort, dstPort, ttl, payloadSize                       sql.NullInt64
			deviceName, srcMAC, dstMAC, srcIP, dstIP, protocol, tcpFlags sql.NullString
			ipVersion, threatType                                        sql.NullString
			timestamp                                                    time.Time
			isMalicious                                                  sql.NullBool
		)

		if err := rows.Scan(
			&id, &timestamp, &deviceName, &srcMAC, &dstMAC,
			&srcIP, &dstIP, &protocol, &srcPort, &dstPort,
			&ipVersion, &ttl, &tcpFlags, &payloadSize,
			&isMalicious, &threatType,
		); err != nil {
			log.Printf("Error scanning packet row: %v", err)
			continue
		}

		packet := map[string]interface{}{
			"id":           nullInt64ToInt(id),
			"timestamp":    timestamp,
			"device_name":  nullStringToString(deviceName),
			"src_mac":      nullStringToString(srcMAC),
			"dst_mac":      nullStringToString(dstMAC),
			"src_ip":       nullStringToString(srcIP),
			"dst_ip":       nullStringToString(dstIP),
			"protocol":     nullStringToString(protocol),
			"src_port":     nullInt64ToInt(srcPort),
			"dst_port":     nullInt64ToInt(dstPort),
			"ip_version":   nullStringToString(ipVersion),
			"ttl":          nullInt64ToInt(ttl),
			"tcp_flags":    nullStringToString(tcpFlags),
			"payload_size": nullInt64ToInt(payloadSize),
			"is_malicious": nullBoolToBool(isMalicious),
			"threat_type":  nullStringToString(threatType),
		}

		packets = append(packets, packet)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"packets":     packets,
		"total_count": totalCount,
		"limit":       limit,
		"offset":      offset,
	})
}

func logsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	offset := 0
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	filterClauses := []string{"1=1"}
	filterParams := []interface{}{}
	paramIndex := 1

	if source := r.URL.Query().Get("source"); source != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("source = $%d", paramIndex))
		filterParams = append(filterParams, source)
		paramIndex++
	}

	if logLevel := r.URL.Query().Get("log_level"); logLevel != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("log_level = $%d", paramIndex))
		filterParams = append(filterParams, logLevel)
		paramIndex++
	}

	whereClause := ""
	for i, clause := range filterClauses {
		if i == 0 {
			whereClause = "WHERE " + clause
		} else {
			whereClause += " AND " + clause
		}
	}

	filterParams = append(filterParams, limit, offset)
	limitOffsetParams := []interface{}{paramIndex, paramIndex + 1}
	paramIndex += 2

	query := fmt.Sprintf(`
		SELECT
			id, timestamp, source, log_level, message, metadata
		FROM
			siem.log_data
		%s
		ORDER BY
			timestamp DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, limitOffsetParams[0], limitOffsetParams[1])

	rows, err := db.Query(query, filterParams...)
	if err != nil {
		log.Printf("Error querying logs: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) FROM siem.log_data %s
	`, whereClause)

	var totalCount int
	if err := db.QueryRow(countQuery, filterParams[:len(filterParams)-2]...).Scan(&totalCount); err != nil {
		log.Printf("Error counting logs: %v", err)
		totalCount = 0
	}

	logs := []map[string]interface{}{}
	for rows.Next() {
		var (
			id                        sql.NullInt64
			source, logLevel, message sql.NullString
			timestamp                 time.Time
			metadata                  []byte
		)

		if err := rows.Scan(
			&id, &timestamp, &source, &logLevel, &message, &metadata,
		); err != nil {
			log.Printf("Error scanning log row: %v", err)
			continue
		}

		var metadataMap map[string]interface{}
		if len(metadata) > 0 {
			if err := json.Unmarshal(metadata, &metadataMap); err != nil {
				log.Printf("Error unmarshaling metadata: %v", err)
				metadataMap = map[string]interface{}{}
			}
		} else {
			metadataMap = map[string]interface{}{}
		}

		logEntry := map[string]interface{}{
			"id":        nullInt64ToInt(id),
			"timestamp": timestamp,
			"source":    nullStringToString(source),
			"log_level": nullStringToString(logLevel),
			"message":   nullStringToString(message),
			"metadata":  metadataMap,
		}

		logs = append(logs, logEntry)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"logs":        logs,
		"total_count": totalCount,
		"limit":       limit,
		"offset":      offset,
	})
}

func topSourcesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`
		SELECT
			src_ip, COUNT(*) AS packet_count
		FROM
			siem.packet_data
		GROUP BY
			src_ip
		ORDER BY
			packet_count DESC
		LIMIT 10
	`)
	if err != nil {
		log.Printf("Error querying top sources: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	topSources := []map[string]interface{}{}
	for rows.Next() {
		var (
			srcIP       string
			packetCount int
		)

		if err := rows.Scan(&srcIP, &packetCount); err != nil {
			log.Printf("Error scanning top source row: %v", err)
			continue
		}

		topSources = append(topSources, map[string]interface{}{
			"src_ip":       srcIP,
			"packet_count": packetCount,
		})
	}

	json.NewEncoder(w).Encode(topSources)
}

func topDestinationsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`
		SELECT
			dst_ip, COUNT(*) AS packet_count
		FROM
			siem.packet_data
		GROUP BY
			dst_ip
		ORDER BY
			packet_count DESC
		LIMIT 10
	`)
	if err != nil {
		log.Printf("Error querying top destinations: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	topDestinations := []map[string]interface{}{}
	for rows.Next() {
		var (
			dstIP       string
			packetCount int
		)

		if err := rows.Scan(&dstIP, &packetCount); err != nil {
			log.Printf("Error scanning top destination row: %v", err)
			continue
		}

		topDestinations = append(topDestinations, map[string]interface{}{
			"dst_ip":       dstIP,
			"packet_count": packetCount,
		})
	}

	json.NewEncoder(w).Encode(topDestinations)
}

func protocolsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`
		SELECT
			protocol, COUNT(*) AS packet_count
		FROM
			siem.packet_data
		GROUP BY
			protocol
		ORDER BY
			packet_count DESC
		LIMIT 10
	`)
	if err != nil {
		log.Printf("Error querying top protocols: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	topProtocols := []map[string]interface{}{}
	for rows.Next() {
		var (
			protocol    string
			packetCount int
		)

		if err := rows.Scan(&protocol, &packetCount); err != nil {
			log.Printf("Error scanning top protocol row: %v", err)
			continue
		}

		topProtocols = append(topProtocols, map[string]interface{}{
			"protocol":     protocol,
			"packet_count": packetCount,
		})
	}

	json.NewEncoder(w).Encode(topProtocols)
}

func packetTimelineHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`
		SELECT
			timestamp, COUNT(*) AS packet_count
		FROM
			siem.packet_data
		GROUP BY
			timestamp
		ORDER BY
			timestamp
	`)
	if err != nil {
		log.Printf("Error querying packet timeline: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	packetTimeline := []map[string]interface{}{}
	for rows.Next() {
		var (
			timestamp   time.Time
			packetCount int
		)

		if err := rows.Scan(&timestamp, &packetCount); err != nil {
			log.Printf("Error scanning packet timeline row: %v", err)
			continue
		}

		packetTimeline = append(packetTimeline, map[string]interface{}{
			"timestamp":    timestamp.Format(time.RFC3339),
			"packet_count": packetCount,
		})
	}

	json.NewEncoder(w).Encode(packetTimeline)
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	offset := 0
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	filterClauses := []string{"1=1"}
	filterParams := []interface{}{}
	paramIndex := 1

	if srcIP := r.URL.Query().Get("src_ip"); srcIP != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("src_ip = $%d", paramIndex))
		filterParams = append(filterParams, srcIP)
		paramIndex++
	}

	if dstIP := r.URL.Query().Get("dst_ip"); dstIP != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("dst_ip = $%d", paramIndex))
		filterParams = append(filterParams, dstIP)
		paramIndex++
	}

	if protocol := r.URL.Query().Get("protocol"); protocol != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("protocol = $%d", paramIndex))
		filterParams = append(filterParams, protocol)
		paramIndex++
	}

	whereClause := ""
	for i, clause := range filterClauses {
		if i == 0 {
			whereClause = "WHERE " + clause
		} else {
			whereClause += " AND " + clause
		}
	}

	// Add limit and offset parameters
	filterParams = append(filterParams, limit, offset)
	limitOffsetParams := []interface{}{paramIndex, paramIndex + 1}
	paramIndex += 2

	// Query alerts
	query := fmt.Sprintf(`
		SELECT
			id, timestamp, device_name, src_mac, dst_mac,
			src_ip, dst_ip, protocol, src_port, dst_port,
			ip_version, ttl, tcp_flags, payload_size,
			is_malicious, threat_type
		FROM
			siem.packet_data
		%s
		ORDER BY
			timestamp DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, limitOffsetParams[0], limitOffsetParams[1])

	rows, err := db.Query(query, filterParams...)
	if err != nil {
		log.Printf("Error querying alerts: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) FROM siem.packet_data %s
	`, whereClause)

	var totalCount int
	if err := db.QueryRow(countQuery, filterParams[:len(filterParams)-2]...).Scan(&totalCount); err != nil {
		log.Printf("Error counting alerts: %v", err)
		totalCount = 0
	}

	alerts := []map[string]interface{}{}
	for rows.Next() {
		var (
			id, srcPort, dstPort, ttl, payloadSize                       sql.NullInt64
			deviceName, srcMAC, dstMAC, srcIP, dstIP, protocol, tcpFlags sql.NullString
			ipVersion, threatType                                        sql.NullString
			timestamp                                                    time.Time
			isMalicious                                                  sql.NullBool
		)

		if err := rows.Scan(
			&id, &timestamp, &deviceName, &srcMAC, &dstMAC,
			&srcIP, &dstIP, &protocol, &srcPort, &dstPort,
			&ipVersion, &ttl, &tcpFlags, &payloadSize,
			&isMalicious, &threatType,
		); err != nil {
			log.Printf("Error scanning alert row: %v", err)
			continue
		}

		alert := map[string]interface{}{
			"id":           nullInt64ToInt(id),
			"timestamp":    timestamp,
			"device_name":  nullStringToString(deviceName),
			"src_mac":      nullStringToString(srcMAC),
			"dst_mac":      nullStringToString(dstMAC),
			"src_ip":       nullStringToString(srcIP),
			"dst_ip":       nullStringToString(dstIP),
			"protocol":     nullStringToString(protocol),
			"src_port":     nullInt64ToInt(srcPort),
			"dst_port":     nullInt64ToInt(dstPort),
			"ip_version":   nullStringToString(ipVersion),
			"ttl":          nullInt64ToInt(ttl),
			"tcp_flags":    nullStringToString(tcpFlags),
			"payload_size": nullInt64ToInt(payloadSize),
			"is_malicious": nullBoolToBool(isMalicious),
			"threat_type":  nullStringToString(threatType),
		}

		alerts = append(alerts, alert)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"alerts":      alerts,
		"total_count": totalCount,
		"limit":       limit,
		"offset":      offset,
	})
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading WebSocket connection: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading WebSocket message: %v", err)
			break
		}

		if messageType == websocket.TextMessage {
			handleTextMessage(conn, message)
		} else if messageType == websocket.BinaryMessage {
			handleBinaryMessage(conn, message)
		}
	}

	clientsMu.Lock()
	delete(clients, conn)
	clientsMu.Unlock()
}

func handleTextMessage(conn *websocket.Conn, message []byte) {
	log.Printf("Received text message: %s", string(message))
	conn.WriteMessage(websocket.TextMessage, []byte("Message received"))
}

func handleBinaryMessage(conn *websocket.Conn, message []byte) {
	log.Printf("Received binary message: %v", message)
	conn.WriteMessage(websocket.BinaryMessage, []byte("Message received"))
}

func broadcastNetworkStats(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Get latest network stats for the last hour
			dbWrapper := models.NewDB(db)
			stats, err := dbWrapper.GetNetworkStats(time.Now().Add(-1 * time.Hour))
			if err != nil {
				log.Printf("Error getting network stats: %v", err)
				continue
			}

			// add packet counts by protocol
			protocolStats, err := dbWrapper.GetProtocolStats(time.Now().Add(-1 * time.Hour))
			if err != nil {
				log.Printf("Error getting protocol stats: %v", err)
			} else {
				stats["protocols"] = protocolStats
			}

			// Add top sources
			topSources, err := dbWrapper.GetTopSources(10, time.Now().Add(-1*time.Hour))
			if err != nil {
				log.Printf("Error getting top sources: %v", err)
			} else {
				stats["top_sources"] = topSources
			}

			// Add top destinations
			topDestinations, err := dbWrapper.GetTopDestinations(10, time.Now().Add(-1*time.Hour))
			if err != nil {
				log.Printf("Error getting top destinations: %v", err)
			} else {
				stats["top_destinations"] = topDestinations
			}

			message := map[string]interface{}{
				"type":      "network_stats",
				"data":      stats,
				"timestamp": time.Now().Format(time.RFC3339),
			}

			jsonData, err := json.Marshal(message)
			if err != nil {
				log.Printf("Error marshaling stats to JSON: %v", err)
				continue
			}

			// Broadcast to all clients
			clientsMu.Lock()
			for client := range clients {
				err := client.WriteMessage(websocket.TextMessage, jsonData)
				if err != nil {
					log.Printf("Error sending message to client: %v", err)
					client.Close()
					delete(clients, client)
				}
			}
			clientsMu.Unlock()
		}
	}
}

func nullInt64ToInt(nullInt sql.NullInt64) int {
	if nullInt.Valid {
		return int(nullInt.Int64)
	}
	return 0
}

func nullStringToString(nullStr sql.NullString) string {
	if nullStr.Valid {
		return nullStr.String
	}
	return ""
}

func nullBoolToBool(nullBool sql.NullBool) bool {
	if nullBool.Valid {
		return bool(nullBool.Bool)
	}
	return false
}
