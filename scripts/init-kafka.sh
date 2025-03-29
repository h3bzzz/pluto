#!/bin/bash

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
sleep 10

# Create required topics
echo "Creating Kafka topics..."
kafka-topics --create --bootstrap-server kafka:29092 --replication-factor 1 --partitions 3 --topic pluto-network-monitoring
kafka-topics --create --bootstrap-server kafka:29092 --replication-factor 1 --partitions 3 --topic pluto-log-data

echo "Kafka topics created successfully!"
echo "Topics created:"
kafka-topics --list --bootstrap-server kafka:29092
