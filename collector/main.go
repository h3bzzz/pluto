package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"os/user"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/segmentio/kafka-go"
)

var (
	kafkaAddr    = flag.String("kafka", "kafka:29092", "Kafka-Broker Address")
	networkTopic = flag.String("network-topic", "network-pluto", "Kafka topic for network data")
	promiscuous  = flag.Bool("promisc", true, "Set promiscuous mode on interface")
	snapLen      = flag.Int("snaplen", 65535, "Snapshot length for packet capture")
	maxBatchSize = 100
	batchTimeout = 1 * time.Second
)

func main() {
	currentU, err := user.Current()
	if err != nil {
		fmt.Println("Error getting user info", err)
		return
	}

	userID, err := strconv.Atoi(currentU.Uid)
	if err != nil {
		fmt.Println("Error converting UID to integer:", err)
		return
	}

	_ = userID == 0

	flag.Parse()

	networkWriter := kafka.NewWriter(kafka.WriterConfig{
		Brokers:      []string{*kafkaAddr},
		Topic:        *networkTopic,
		BatchSize:    maxBatchSize,
		BatchTimeout: batchTimeout,
		Async:        true,
	})
	defer networkWriter.Close()

	devices, err := pcap.FindAllDevs()
	if err != nil {
		log.Fatalf("Failed to acquire devices: %v", err)
	}

	log.Printf("Found %d network interfaces", len(devices))
	for _, device := range devices {
		log.Printf("- Interfaces: %s", device.Name)
		for _, addr := range device.Addresses {
			log.Printf(" - IP: %s, Netmask: %s", addr.IP, addr.Netmask)
		}
	}

	var wg sync.WaitGroup
	for _, device := range devices {
		wg.Add(1)
		go captureDevice(device, networkWriter, &wg)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
	log.Println("Shuttting down collector")

	if err := networkWriter.Close(); err != nil {
		log.Printf("Error closing Kafka writer: %v", err)
	}

	wg.Wait()
}

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

func captureDevice(device pcap.Interface, writer *kafka.Writer, wg *sync.WaitGroup) {
	defer wg.Done()

	if device.Name == "lo" || device.Name == "log" {
		log.Printf("Skipping loopback interface %s", device.Name)
		return
	}

	handle, err := pcap.OpenLive(device.Name, int32(*snapLen), *promiscuous, pcap.BlockForever)
	if err != nil {
		log.Printf("Error opening device %s: %v", device.Name, err)
		return
	}
	defer handle.Close()

	log.Printf("Started packet capture on %s", device.Name)

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range packetSource.Packets() {
		processPacket(device.Name, packet, writer)
	}
}

func processPacket(deviceName string, packet gopacket.Packet, writer *kafka.Writer) {
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

		// IPv6 Fragment handling
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
	}

	if udpLayer := packet.Layer(layers.LayerTypeUDP); udpLayer != nil {
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

	if app := packet.ApplicationLayer(); app != nil {
		meta.PayloadSize = len(app.Payload())
	}

	jsonBytes, err := json.Marshal(meta)
	if err != nil {
		log.Printf("JSON marshaling failed: %v", err)
		return
	}

	err = writer.WriteMessages(context.Background(),
		kafka.Message{
			Key:   []byte(meta.DeviceName),
			Value: jsonBytes,
		},
	)
	if err != nil {
		log.Printf("Failed to send message to Kafka: %v", err)
	}
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
