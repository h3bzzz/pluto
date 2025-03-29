[banner](https://github.com/user-attachments/assets/957b02c4-3360-40ec-b2b6-c5c2da6708ef)

# Pluto - Network Monitoring System!

Microservices are fun - Microservices are easy... well this one is ! 

Pluto is a  network monitoring system built using Go and React. It captures, processes, and visualizes network traffic data in real-time.

Each Service is dockerized allowing for easy scalability and deployment.

## System Architecture

The system consists of multiple microservices:

1. **Collector**: Captures network packets using libpcap and sends them to Kafka.
2. **Processor**: Processes the network data from Kafka and stores it in PostgreSQL.
3. **Plutos-Space (Server)**: Provides REST API endpoints and WebSocket connections for the dashboard.
4. **Dashboard**: React-based UI to visualize network traffic data.

## Prerequisites

- Docker and Docker Compose
- Go 1.24+
- Node.js 18+
- PostgreSQL
- Kafka

## Getting Started

### Running with Docker Compose

The easiest way to run the entire system is using Docker Compose:

```bash
# Start all services
docker-compose up -d

# To view logs
docker-compose logs -f

# To stop all services
docker-compose down
```

The services will be available at:
- Dashboard: http://localhost:3000
- Server API: http://localhost:8000
- Kafka UI: http://localhost:8080
- pgAdmin: http://localhost:5050

### Development Setup

#### Collector

```bash
cd collector
go mod tidy
go run main.go
```

#### Processor

```bash
cd processor
go mod tidy
go run main.go
```

#### Plutos-Space (Server)

```bash
cd plutos-space
go mod tidy
go run main.go
```

#### Dashboard

```bash
cd dashboard
npm install
npm run dev
```
If you have everything up and running you should be able to visit your localhost:3000
and see your local network traffic.
## API Endpoints

The server provides the following REST API endpoints:

- `GET /api/health`: Health check endpoint
- `GET /api/stats`: Get network statistics
- `GET /api/packets`: Get network packets
- `GET /api/protocols`: Get protocol statistics
- `GET /api/top-sources`: Get top source IPs
- `GET /api/top-destinations`: Get top destination IPs
- `GET /api/packet-timeline`: Get packet timeline data
- `GET /api/alerts`: Get security alerts

## WebSocket

The server also provides a WebSocket endpoint at `/ws` for real-time updates.

Thanks for reading h3bzzz
## License

MIT 
