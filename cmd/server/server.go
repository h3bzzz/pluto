package server

import (
  "context"
  "database/sql"
  "encoding/json"
  "flag"
  "fmt"
  "net/http"
  "os"
  "sync"
  "time"

  "github.com/Clickhouse/clickhouse-go/v2"
  _ "github.com/Clickhouse/clickhouse-go"
  "github.com/prometheus/client_golang/prometheus/promhttp"
  "github.com/prometheus/clickhouse-go/prometheus"
  "github.com/jackc/pgx/v5"
  "github.com/jackc/pgx/v5/pgxpool"
  "github.com/segmentio/kafka-go"
)



var (
  kafkaNetworkWriter *kafka.Writer 
  kafkaLogWriter *kafka.Writer 
)


func kafkaWriters() {
  kafkaNetworkWriter = kafka.NewWriter(kafka.WriteConfig{
    Brokers: []string{"localhost:9092"},
    Topic: "pluto-network-events",
    Balancer: &kafka.LeastByte{},
  })

  kafkaLogWriter = kafka.NewWriter(kafka.WriterConfig{
    Brokers: []string{"localhost:9092"}
    Topic: "pluto-log-events",
    Balancer: &kafka.LeastBytes{},
  })
}


func sendNetworkEvent(data []byte) error {
  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()

  msg := kafka.Message{
    Value: data,
    Time: time.Now(),
  }

  return kafkaNetworkWriter.WriteMessages(ctx, msg)
}
