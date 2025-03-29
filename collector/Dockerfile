FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git gcc musl-dev libpcap-dev

WORKDIR /app

RUN go mod init github.com/h3bzzz/pluto/collector

COPY go.mod go.sum* ./

RUN if [ -f go.sum ]; then go mod download; fi

COPY . .

RUN go get github.com/google/gopacket
RUN go get github.com/segmentio/kafka-go

RUN CGO_ENABLED=1 GOOS=linux go build -o collector .

FROM alpine:latest

RUN apk add --no-cache ca-certificates libpcap

WORKDIR /app

COPY --from=builder /app/collector .

RUN adduser -D -u 10001 appuser
USER appuser

ENTRYPOINT ["./collector"]
