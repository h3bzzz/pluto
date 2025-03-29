package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/h3bzzz/pluto/plutos-space/models"
)

func BroadcastNetworkStats(db *models.DB, clients map[*websocket.Conn]bool, clientsMu *sync.Mutex) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		stats, err := db.GetNetworkStats(time.Now().Add(-1 * time.Hour))
		if err != nil {
			log.Printf("Error getting network stats: %v", err)
			continue
		}

		statsWithType := map[string]interface{}{
			"type":  "network_stats",
			"stats": stats,
		}

		jsonData, err := json.Marshal(statsWithType)
		if err != nil {
			log.Printf("Error marshaling stats to JSON: %v", err)
			continue
		}

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

func WSHandler(w http.ResponseWriter, r *http.Request, upgrader websocket.Upgrader, clients map[*websocket.Conn]bool, clientsMu *sync.Mutex) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading connection to WebSocket: %v", err)
		return
	}

	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	go func() {
		defer func() {
			conn.Close()
			clientsMu.Lock()
			delete(clients, conn)
			clientsMu.Unlock()
		}()

		for {
			messageType, p, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Error reading message: %v", err)
				return
			}

			if err := conn.WriteMessage(messageType, p); err != nil {
				log.Printf("Error writing message: %v", err)
				return
			}
		}
	}()
}
