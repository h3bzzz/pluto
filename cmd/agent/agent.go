package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/hpcloud/tail"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	maxBatchSize = flag.Int("batchSize", 100, "Maximum # of packets per batch")
	batchTimeout = flag.Duration("batchTimeout", 1*time.Second, "Timeout after flush")
	metricsPort  = flag.Int("metricsPort", 9100, "Prometheus Metrics Port")

	eventsProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pluto_events_processed_total",
		Help: "Total # of events processed by type",
	}, []string{"type"})

	eventsBatchSize = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "pluto_events_batch_size",
		Help:    "Size of event batches sent to kafka",
		Buckets: prometheus.LinearBuckets(0, 50, 20),
	})

	eventProcessingDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "pluto_event_processing_duration_seconds",
		Help:    "Time spent processing events",
		Buckets: prometheus.ExponentialBuckets(0.001, 2, 10),
	}, []string{"type"})

	logger *zap.Logger
)

// Kafka Configs
var (
	kafkaBrokers  = []string{"localhost:9092"}
	networkTopic  = "pluto-network-events"
	logsTopic     = "pluto-log-events"
	kafkaDialer   = &kafka.Dialer{Timeout: 10 * time.Second}
	networkWriter *kafka.Writer
	logsWriter    *kafka.Writer
)

// maxMessageSize is the maximum allowed message size for Kafka (here 5 MB)
const maxMessageSize = 5 * 1024 * 1024

// maxPayloadSize defines the maximum payload size allowed per packet (here 1 KB)
const maxPayloadSize = 1024

// PacketData holds metadata for a captured packet.
type PacketData struct {
	Timestamp  time.Time `json:"timestamp"`
	DeviceName string    `json:"device_name"`

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
	SrcPort    uint16 `json:"src_port,omitempty"`
	DstPort    uint16 `json:"dst_port,omitempty"`
	TCPFlags   string `json:"tcp_flags,omitempty"`
	SeqNum     uint32 `json:"sequence_number,omitempty"`
	AckNum     uint32 `json:"acknowledgement_number,omitempty"`
	WindowSize uint16 `json:"window_size,omitempty"`

	// Application
	DNSID      uint16   `json:"dns_id,omitempty"`
	DNSOpCode  string   `json:"dns_opcode,omitempty"`
	DNSQuery   []string `json:"dns_query,omitempty"`
	HTTPMethod string   `json:"http_method,omitempty"`
	TLSVersion string   `json:"tls_version,omitempty"`
	SNI        string   `json:"sni,omitempty"`

	// Payload
	Payload     []byte `json:"payload,omitempty"`
	PayloadSize int    `json:"payload_size,omitempty"`
}

// BatchBuffer batches PacketData before sending them to Kafka.
type BatchBuffer struct {
	mu        sync.Mutex
	packets   []*PacketData
	timer     *time.Timer
	batchSize int
	timeout   time.Duration
}

func NewBatchBuffer(batchSize int, timeout time.Duration) *BatchBuffer {
	return &BatchBuffer{
		packets:   make([]*PacketData, 0, batchSize),
		batchSize: batchSize,
		timeout:   timeout,
	}
}

func (buffer *BatchBuffer) Add(packet *PacketData) {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()

	// If the packet payload is too large, trim it.
	if len(packet.Payload) > maxPayloadSize {
		packet.Payload = packet.Payload[:maxPayloadSize]
		packet.PayloadSize = maxPayloadSize
	}

	buffer.packets = append(buffer.packets, packet)
	if len(buffer.packets) >= buffer.batchSize {
		buffer.flushLocked()
		eventsBatchSize.Observe(float64(buffer.batchSize))
	} else if buffer.timer == nil {
		buffer.timer = time.AfterFunc(buffer.timeout, func() {
			buffer.mu.Lock()
			defer buffer.mu.Unlock()
			buffer.flushLocked()
			eventsBatchSize.Observe(float64(len(buffer.packets)))
		})
	}
}

func (buffer *BatchBuffer) flushLocked() {
	if len(buffer.packets) == 0 {
		return
	}

	// Copy and clear the current batch.
	batch := make([]*PacketData, len(buffer.packets))
	copy(batch, buffer.packets)
	buffer.packets = buffer.packets[:0]
	if buffer.timer != nil {
		buffer.timer.Stop()
		buffer.timer = nil
	}

	data, err := json.Marshal(batch)
	if err != nil {
		logger.Error("Failed to marshal packet batch", zap.Error(err))
		return
	}

	// If the JSON is too large, split the batch.
	if len(data) > maxMessageSize {
		groups, err := splitBatch(batch, maxMessageSize)
		if err != nil {
			logger.Error("Failed to split packet batch", zap.Error(err))
			return
		}
		for _, grp := range groups {
			d, err := json.Marshal(grp)
			if err != nil {
				logger.Error("Failed to marshal packet group", zap.Error(err))
				continue
			}
			writeWithRetries(d)
		}
	} else {
		writeWithRetries(data)
	}
}

func (buffer *BatchBuffer) Flush() {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	buffer.flushLocked()
}

func writeWithRetries(data []byte) {
	for i := 0; i < 3; i++ {
		err := networkWriter.WriteMessages(context.Background(),
			kafka.Message{Value: data},
		)
		if err == nil {
			return
		}
		logger.Error("Failed to send packet batch to Kafka", zap.Int("attempt", i+1), zap.Error(err))
		time.Sleep(time.Second)
	}
}

func splitBatch(batch []*PacketData, maxSize int) ([][]*PacketData, error) {
	var groups [][]*PacketData
	var current []*PacketData

	for _, pkt := range batch {
		current = append(current, pkt)
		data, err := json.Marshal(current)
		if err != nil {
			return nil, err
		}
		if len(data) > maxSize {
			if len(current) == 1 {
				// Even a single packet is too large; add it anyway.
				groups = append(groups, current)
				current = nil
			} else {
				last := current[len(current)-1]
				current = current[:len(current)-1]
				groups = append(groups, current)
				current = []*PacketData{last}
			}
		}
	}
	if len(current) > 0 {
		groups = append(groups, current)
	}
	return groups, nil
}

// Log types and batch.

type LogConfig struct {
	Directories  []string `json:"directories"`
	FilePatterns []string `json:"file_patterns"`
	ExPatterns   []string `json:"exclude_patterns"`
	BatchSize    int      `json:"batch_size"`
	BatchTimeout string   `json:"batch_timeout"`
}

var defaultLogConfig = LogConfig{
	Directories: []string{
		"/var/log",
		"/var/log/audit",
		"/var/www/logs",
		"/var/log/auth.log",
		"/var/log/syslog",
		"/var/log/kern.log",
		"/var/log/dmesg",
		"/var/log/journal",
		"/var/log/boot.log",
		"/var/log/messages",
		"/var/log/audit/audit.log",
		"/var/log/wtmp",
		"/var/log/faillog",
		"/var/log/btmp",
		"/var/log/cron.log",
		"/var/log/mail.log",
		"/var/log/apache2/access.log",
		"/var/log/httpd/access_log",
		"/var/log/httpd/error_log",
		"/var/log/ftp.log",
		"/var/log/samba/log.smbd",
		"/var/log/dpkg.log",
		"/var/log/yum.log",
		"/var/log/pacman.log",
	},
	FilePatterns: []string{"*.log", "*.syslog", "messages", "secure"},
	ExPatterns:   []string{"*.gz", "*.zip"},
	BatchSize:    100,
	BatchTimeout: "5s",
}

type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	File      string    `json:"file"`
	Message   string    `json:"message"`
}

type Envelope struct {
	SensorID  string      `json:"sensor_id"`
	DataType  string      `json:"data_type"`
	Timestamp time.Time   `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

type LogBatch struct {
	entries   []LogEntry
	timer     *time.Timer
	mu        sync.Mutex
	batchSize int
	timeout   time.Duration
}

func NewLogBatch(batchSize int, timeout string) *LogBatch {
	duration, _ := time.ParseDuration(timeout)
	return &LogBatch{
		entries:   make([]LogEntry, 0, batchSize),
		batchSize: batchSize,
		timeout:   duration,
	}
}

func (buffer *LogBatch) Add(entry LogEntry) {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()

	buffer.entries = append(buffer.entries, entry)
	if len(buffer.entries) >= buffer.batchSize {
		buffer.flush()
		eventsBatchSize.Observe(float64(buffer.batchSize))
	} else if buffer.timer == nil {
		buffer.timer = time.AfterFunc(buffer.timeout, buffer.Flush)
	}
}

func (buffer *LogBatch) Flush() {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	buffer.flush()
}

func (buffer *LogBatch) flush() {
	if len(buffer.entries) == 0 {
		return
	}

	entries := make([]LogEntry, len(buffer.entries))
	copy(entries, buffer.entries)
	buffer.entries = buffer.entries[:0]
	if buffer.timer != nil {
		buffer.timer.Stop()
		buffer.timer = nil
	}

	envelope := Envelope{
		SensorID:  getHostID(),
		DataType:  "log",
		Timestamp: time.Now().UTC(),
		Payload:   entries,
	}
	data, err := json.Marshal(envelope)
	if err != nil {
		logger.Error("Failed to marshal log envelope", zap.Error(err))
		return
	}
	err = logsWriter.WriteMessages(context.Background(),
		kafka.Message{Value: data},
	)
	if err != nil {
		logger.Error("Failed to send log batch to Kafka", zap.Error(err))
	}
}

// isAdmin returns true if the program is run as root.
func isAdmin() bool {
	return os.Geteuid() == 0
}

// kafkaWriters initializes the Kafka writers with compression enabled.
func kafkaWriters() {
	networkWriter = kafka.NewWriter(kafka.WriterConfig{
		Brokers:          kafkaBrokers,
		Topic:            networkTopic,
		Dialer:           kafkaDialer,
		Balancer:         &kafka.LeastBytes{},
		CompressionCodec: kafka.Gzip.Codec(),
	})
	logsWriter = kafka.NewWriter(kafka.WriterConfig{
		Brokers:          kafkaBrokers,
		Topic:            logsTopic,
		Dialer:           kafkaDialer,
		Balancer:         &kafka.LeastBytes{},
		CompressionCodec: kafka.Gzip.Codec(),
	})
}

func getHostID() string {
	host, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return host
}

func captureDevice(device pcap.Interface, wg *sync.WaitGroup) {
	defer wg.Done()

	handle, err := pcap.OpenLive(device.Name, 65355, true, pcap.BlockForever)
	if err != nil {
		logger.Error("failed to open device", zap.String("device", device.Name), zap.Error(err))
		return
	}
	defer handle.Close()

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range packetSource.Packets() {
		start := time.Now()
		dissectPacket(device.Name, packet)
		eventProcessingDuration.WithLabelValues("network").Observe(time.Since(start).Seconds())
		eventsProcessed.WithLabelValues("network").Inc()
	}
}

func dissectPacket(deviceName string, packet gopacket.Packet) {
	meta := PacketData{
		Timestamp:  packet.Metadata().Timestamp,
		DeviceName: deviceName,
	}

	// Ethernet layer
	if ethLayer := packet.Layer(layers.LayerTypeEthernet); ethLayer != nil {
		eth, _ := ethLayer.(*layers.Ethernet)
		meta.SrcMAC = eth.SrcMAC.String()
		meta.DstMAC = eth.DstMAC.String()
		meta.EtherType = eth.EthernetType.String()
		meta.IsMultiCast = eth.DstMAC[0]&1 == 1
	}

	// VLAN (802.1Q)
	if dot1qLayer := packet.Layer(layers.LayerTypeDot1Q); dot1qLayer != nil {
		dot1q, _ := dot1qLayer.(*layers.Dot1Q)
		meta.VLANID = dot1q.VLANIdentifier
	}

	// Network layer
	if ip4Layer := packet.Layer(layers.LayerTypeIPv4); ip4Layer != nil {
		ip4, _ := ip4Layer.(*layers.IPv4)
		meta.SrcIP = ip4.SrcIP.String()
		meta.DstIP = ip4.DstIP.String()
		meta.IPVrs = "IPv4"
		meta.TTL = ip4.TTL
		meta.Protocol = ip4.Protocol.String()
		meta.FragID = uint32(ip4.Id)
		meta.FragOffset = ip4.FragOffset
		meta.DSCP = ip4.TOS >> 2
	} else if ip6Layer := packet.Layer(layers.LayerTypeIPv6); ip6Layer != nil {
		ip6, _ := ip6Layer.(*layers.IPv6)
		meta.SrcIP = ip6.SrcIP.String()
		meta.DstIP = ip6.DstIP.String()
		meta.IPVrs = "IPv6"
		meta.TTL = ip6.HopLimit
		meta.Protocol = ip6.NextHeader.String()

		if fragLayer := packet.Layer(layers.LayerTypeIPv6Fragment); fragLayer != nil {
			frag, _ := fragLayer.(*layers.IPv6Fragment)
			meta.FragID = frag.Identification
			meta.FragOffset = frag.FragmentOffset
		}
	}

	// Transport layer
	if tcpLayer := packet.Layer(layers.LayerTypeTCP); tcpLayer != nil {
		tcp, _ := tcpLayer.(*layers.TCP)
		meta.SrcPort = uint16(tcp.SrcPort)
		meta.DstPort = uint16(tcp.DstPort)
		meta.TCPFlags = tcpFlags(tcp)
		meta.SeqNum = tcp.Seq
		meta.AckNum = tcp.Ack
		meta.WindowSize = tcp.Window
	} else if udpLayer := packet.Layer(layers.LayerTypeUDP); udpLayer != nil {
		udp, _ := udpLayer.(*layers.UDP)
		meta.SrcPort = uint16(udp.SrcPort)
		meta.DstPort = uint16(udp.DstPort)
	}

	// ICMP
	if icmpLayer := packet.Layer(layers.LayerTypeICMPv4); icmpLayer != nil {
		icmp, _ := icmpLayer.(*layers.ICMPv4)
		meta.ICMPType = uint8(icmp.TypeCode.Type())
		meta.ICMPCode = uint8(icmp.TypeCode.Code())
	}

	// DNS
	if dnsLayer := packet.Layer(layers.LayerTypeDNS); dnsLayer != nil {
		dns, _ := dnsLayer.(*layers.DNS)
		meta.DNSID = dns.ID
		meta.DNSOpCode = dns.OpCode.String()
		for _, question := range dns.Questions {
			meta.DNSQuery = append(meta.DNSQuery, string(question.Name))
		}
	}

	// Payload handling; trim payload if it exceeds maxPayloadSize.
	if app := packet.ApplicationLayer(); app != nil {
		payload := app.Payload()
		if len(payload) > maxPayloadSize {
			payload = payload[:maxPayloadSize]
		}
		meta.Payload = payload
		meta.PayloadSize = len(payload)
	}

	batchBuffer.Add(&meta)
}

func tcpFlags(tcp *layers.TCP) string {
	var flags string
	if tcp.FIN {
		flags += "F"
	}
	if tcp.SYN {
		flags += "S"
	}
	if tcp.RST {
		flags += "R"
	}
	if tcp.PSH {
		flags += "P"
	}
	if tcp.ACK {
		flags += "A"
	}
	if tcp.URG {
		flags += "U"
	}
	return flags
}

func tailLogFile(ctx context.Context, path string, batch *LogBatch, wg *sync.WaitGroup) {
	defer wg.Done()

	tailConfig := tail.Config{
		Follow:    true,
		ReOpen:    true,
		MustExist: false,
		Poll:      true,
		Location:  &tail.SeekInfo{Offset: 0, Whence: io.SeekEnd},
		Logger:    tail.DiscardingLogger,
	}

	t, err := tail.TailFile(path, tailConfig)
	if err != nil {
		logger.Info("Failed to tail file", zap.String("path", path), zap.Error(err))
		return
	}
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case line := <-t.Lines:
			if line.Err != nil {
				logger.Error("Tail error", zap.String("path", path), zap.Error(line.Err))
				continue
			}
			entry := LogEntry{
				Timestamp: time.Now().UTC(),
				File:      path,
				Message:   strings.TrimSpace(line.Text),
			}
			batch.Add(entry)
			eventsProcessed.WithLabelValues("log").Inc()
		}
	}
}

func serveMetrics() {
	http.Handle("/metrics", promhttp.Handler())
	addr := fmt.Sprintf(":%d", *metricsPort)
	logger.Info("Starting Prometheus metrics server", zap.String("addr", addr))
	if err := http.ListenAndServe(addr, nil); err != nil {
		logger.Error("Metrics server failed", zap.Error(err))
	}
}

func discoverLogs(config LogConfig) []string {
	var logFiles []string
	for _, dir := range config.Directories {
		entries, err := os.ReadDir(dir)
		if err != nil {
			logger.Warn("Failed to read log directories", zap.String("dir", dir), zap.Error(err))
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			var matched bool
			for _, pattern := range config.FilePatterns {
				if match, _ := filepath.Match(pattern, entry.Name()); match {
					matched = true
					break
				}
			}
			for _, pattern := range config.ExPatterns {
				if match, _ := filepath.Match(pattern, entry.Name()); match {
					matched = false
					break
				}
			}
			if matched {
				logFiles = append(logFiles, filepath.Join(dir, entry.Name()))
			}
		}
	}
	return logFiles
}

var batchBuffer *BatchBuffer

func main() {
	flag.Parse()

	if !isAdmin() {
		fmt.Println("Run as root.")
		os.Exit(1)
	}

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	logger, err = zap.NewProduction(zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel), zap.Fields(
		zap.String("hostname", hostname),
		zap.Int("pid", os.Getpid()),
	))
	if err != nil {
		fmt.Printf("Error initializing logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	go serveMetrics()

	// Initialize Kafka writers with compression enabled.
	kafkaWriters()
	defer networkWriter.Close()
	defer logsWriter.Close()

	batchBuffer = NewBatchBuffer(*maxBatchSize, *batchTimeout)

	devices, err := pcap.FindAllDevs()
	if err != nil {
		logger.Fatal("Failed to find network devices", zap.Error(err))
	}
	logger.Info("Found network devices", zap.Int("count", len(devices)))

	var wg sync.WaitGroup
	for _, device := range devices {
		wg.Add(1)
		go captureDevice(device, &wg)
	}

	logBatch := NewLogBatch(defaultLogConfig.BatchSize, defaultLogConfig.BatchTimeout)
	logFiles := discoverLogs(defaultLogConfig)
	logger.Info("Discovered log files", zap.Any("files", logFiles))
	ctx, cancel := context.WithCancel(context.Background())
	var logWg sync.WaitGroup
	for _, file := range logFiles {
		logWg.Add(1)
		go tailLogFile(ctx, file, logBatch, &logWg)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
	logger.Info("Shutdown signal received; stopping...")

	cancel()
	wg.Wait()
	logWg.Wait()
	batchBuffer.Flush()
	logBatch.Flush()
	logger.Info("Agent shut down gracefully")
}
