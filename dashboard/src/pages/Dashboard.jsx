import { useState, useEffect } from 'react'

export default function Dashboard({ networkStats }) {
  const [timeRange, setTimeRange] = useState('1h') // 1h, 24h, 7d, 30d
  
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Inbound Traffic (KB/s)',
        data: [],
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Outbound Traffic (KB/s)',
        data: [],
        borderColor: 'rgba(16, 185, 129, 0.8)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  })

  useEffect(() => {
    const generateMockData = () => {
      const now = new Date()
      const labels = []
      const inboundData = []
      const outboundData = []
      
      let dataPoints = 24
      let interval = 60 * 60 * 1000 // 1 hour in milliseconds
      
      if (timeRange === '1h') {
        dataPoints = 60
        interval = 60 * 1000 // 1 minute
      } else if (timeRange === '24h') {
        dataPoints = 24
        interval = 60 * 60 * 1000 // 1 hour
      } else if (timeRange === '7d') {
        dataPoints = 7
        interval = 24 * 60 * 60 * 1000 // 1 day
      } else if (timeRange === '30d') {
        dataPoints = 30
        interval = 24 * 60 * 60 * 1000 // 1 day
      }
      
      for (let i = dataPoints - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * interval))
        
        let label
        if (timeRange === '1h') {
          label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (timeRange === '24h') {
          label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else {
          label = time.toLocaleDateString([], { month: 'short', day: 'numeric' })
        }
        
        labels.push(label)
        
        const baseInbound = 80 + Math.sin(i / (dataPoints / 4)) * 40
        const baseOutbound = 60 + Math.cos(i / (dataPoints / 3)) * 30
        
        inboundData.push(baseInbound + Math.random() * 20)
        outboundData.push(baseOutbound + Math.random() * 15)
      }
      
      setChartData({
        labels,
        datasets: [
          {
            ...chartData.datasets[0],
            data: inboundData,
          },
          {
            ...chartData.datasets[1],
            data: outboundData,
          },
        ],
      })
    }
    
    generateMockData()
  }, [timeRange])

  const calculateStats = () => {
    if (!networkStats) {
      return {
        packetsIn: 0,
        packetsOut: 0,
        bytesIn: 0,
        bytesOut: 0,
        activeConnections: 0,
        anomalies: 0
      }
    }
    
    return {
      packetsIn: networkStats.packetsIn || 0,
      packetsOut: networkStats.packetsOut || 0,
      bytesIn: networkStats.bytesIn || 0,
      bytesOut: networkStats.bytesOut || 0,
      activeConnections: networkStats.connections?.length || 0,
      anomalies: networkStats.anomalies?.length || 0
    }
  }
  
  const stats = calculateStats()
  
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Network Dashboard</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setTimeRange('1h')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === '1h' 
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
          >
            1h
          </button>
          <button 
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === '24h' 
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
          >
            24h
          </button>
          <button 
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === '7d' 
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
          >
            7d
          </button>
          <button 
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === '30d' 
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
          >
            30d
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Inbound Traffic</p>
              <p className="text-2xl font-semibold mt-1">{formatBytes(stats.bytesIn)}</p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{stats.packetsIn.toLocaleString()} packets</p>
            </div>
            <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center dark:bg-primary-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600 dark:text-primary-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Outbound Traffic</p>
              <p className="text-2xl font-semibold mt-1">{formatBytes(stats.bytesOut)}</p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{stats.packetsOut.toLocaleString()} packets</p>
            </div>
            <div className="h-12 w-12 bg-secondary-100 rounded-full flex items-center justify-center dark:bg-secondary-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary-600 dark:text-secondary-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Connections</p>
              <p className="text-2xl font-semibold mt-1">{stats.activeConnections}</p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                {stats.anomalies > 0 && (
                  <span className="text-danger-600 dark:text-danger-400">{stats.anomalies} anomalies detected</span>
                )}
                {stats.anomalies === 0 && (
                  <span className="text-secondary-600 dark:text-secondary-400">No anomalies detected</span>
                )}
              </p>
            </div>
            <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center dark:bg-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Network Traffic</h2>
        <div className="h-80 w-full">
          {/* Chart will be rendered here using a chart library */}
          <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>Network traffic chart will be displayed here using a chart library like Chart.js</p>
          </div>
        </div>
      </div>

      {/* Recent Connections Table */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Recent Connections</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
            <thead className="bg-gray-50 dark:bg-dark-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Destination
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Protocol
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Bytes
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-700">
              {networkStats?.connections?.slice(0, 5).map((conn, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {conn.source_ip}:{conn.source_port}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {conn.dest_ip}:{conn.dest_port}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {conn.protocol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {formatBytes(conn.bytes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${conn.status === 'active' 
                        ? 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {conn.status}
                    </span>
                  </td>
                </tr>
              ))}
              
              {/* Placeholder rows if no data */}
              {(!networkStats?.connections || networkStats.connections.length === 0) && (
                Array(5).fill(0).map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      192.168.1.{10 + index}:5{index}432
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      10.0.0.{20 + index}:8{index}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS'][index]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatBytes(Math.floor(Math.random() * 10485760))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${index % 2 === 0 
                          ? 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {index % 2 === 0 ? 'active' : 'closed'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 