package models

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

type KafkaConsumer struct {
	reader      *kafka.Reader
	ctx         context.Context
	cancel      context.CancelFunc
	MessageChan chan []byte
}

type NetworkPacket struct {
	Timestamp   time.Time `json:"timestamp"`
	DeviceName  string    `json:"device_name"`
	SrcIP       string    `json:"src_ip,omitempty"`
	DstIP       string    `json:"dst_ip,omitempty"`
	SrcPort     uint16    `json:"src_port,omitempty"`
	DstPort     uint16    `json:"dst_port,omitempty"`
	Protocol    string    `json:"protocol,omitempty"`
	PayloadSize int       `json:"payload_size,omitempty"`
	IsMalicious bool      `json:"is_malicious,omitempty"`
}

func NewKafkaConsumer(brokerAddr, topic string, groupID string) *KafkaConsumer {
	ctx, cancel := context.WithCancel(context.Background())

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{brokerAddr},
		Topic:       topic,
		GroupID:     groupID,
		MinBytes:    10e3,
		MaxBytes:    10e6,
		StartOffset: kafka.LastOffset,
		MaxWait:     time.Second,
	})

	return &KafkaConsumer{
		reader:      reader,
		ctx:         ctx,
		cancel:      cancel,
		MessageChan: make(chan []byte, 100),
	}
}

func (c *KafkaConsumer) Start() {
	go func() {
		defer close(c.MessageChan)

		for {
			select {
			case <-c.ctx.Done():
				log.Println("Kafka consumer stopping...")
				return
			default:
				m, err := c.reader.ReadMessage(c.ctx)
				if err != nil {
					if err == c.ctx.Err() {
						return
					}
					log.Printf("Error reading message from Kafka: %v", err)
					time.Sleep(time.Second)
					continue
				}

				c.MessageChan <- m.Value
			}
		}
	}()

	log.Printf("Kafka consumer started for topic: %s", c.reader.Config().Topic)
}

func (c *KafkaConsumer) Stop() {
	c.cancel()
	if err := c.reader.Close(); err != nil {
		log.Printf("Error closing Kafka reader: %v", err)
	}
	log.Println("Kafka consumer stopped")
}

func ProcessMessages(db *DB, messageChan <-chan []byte) {
	for message := range messageChan {
		var packet NetworkPacket
		if err := json.Unmarshal(message, &packet); err != nil {
			log.Printf("Error unmarshaling packet data: %v", err)
			continue
		}

		if err := db.StorePacket(packet); err != nil {
			log.Printf("Error storing packet: %v", err)
		}
	}
}
