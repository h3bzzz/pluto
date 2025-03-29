import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTheme } from './contexts/ThemeContext'

// Pages
import Dashboard from './pages/Dashboard'
import NetworkTraffic from './pages/NetworkTraffic'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

// Components
import Layout from './components/Layout'

function App() {
  const { darkMode } = useTheme()
  const [connectionStatus, setConnectionStatus] = useState(false)
  const [networkStats, setNetworkStats] = useState(null)
  const [wsRetryCount, setWsRetryCount] = useState(0)
  const MAX_RETRY_COUNT = 5

  useEffect(() => {
    // Apply dark mode class to document
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    // Connect to WebSocket server for real-time network statistics
    let ws = null
    let reconnectTimeout = null

    const connectWebSocket = () => {
      // Clear any existing reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }

      // Check if max retry count is reached
      if (wsRetryCount >= MAX_RETRY_COUNT) {
        console.error('Max WebSocket reconnection attempts reached')
        return
      }

      // Create WebSocket connection
      ws = new WebSocket('ws://localhost:8000/ws')

      // Connection opened
      ws.addEventListener('open', () => {
        console.log('WebSocket connection established')
        setConnectionStatus(true)
        setWsRetryCount(0) // Reset retry count on successful connection
      })

      // Listen for messages
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)
          setNetworkStats(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      })

      // Connection closed
      ws.addEventListener('close', () => {
        console.log('WebSocket connection closed')
        setConnectionStatus(false)
        
        // Try to reconnect after a delay
        reconnectTimeout = setTimeout(() => {
          setWsRetryCount(prev => prev + 1)
          connectWebSocket()
        }, 3000) // Retry after 3 seconds
      })

      // Connection error
      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus(false)
      })
    }

    // Initial connection
    connectWebSocket()

    // Cleanup on component unmount
    return () => {
      if (ws) {
        ws.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [wsRetryCount])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout isConnected={connectionStatus} />}>
          <Route index element={<Dashboard networkStats={networkStats} />} />
          <Route path="network" element={<NetworkTraffic networkStats={networkStats} />} />
          <Route path="alerts" element={<Alerts networkStats={networkStats} />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App 