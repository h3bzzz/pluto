FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

RUN go mod init github.com/h3bzzz/pluto/processor

COPY go.mod go.sum* ./

RUN if [ -f go.sum ]; then go mod download; fi

COPY . .

RUN go get github.com/lib/pq
RUN go get github.com/segmentio/kafka-go
RUN go get github.com/jackc/pgx/v5

RUN go build -o processor .

FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/processor /usr/local/bin/

ENTRYPOINT ["/usr/local/bin/processor"]
