FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o plutos-space .

FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /app/plutos-space .
COPY --from=builder /app/static ./static

EXPOSE 8000

ENTRYPOINT ["./plutos-space", "-pg", "postgres://server_user:server_pass@postgres:5432/siemdb?sslmode=disable"] 