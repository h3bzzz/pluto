import { useState, useEffect } from 'react'

export default function NetworkTraffic({ networkStats }) {
  const [connections, setConnections] = useState([])
  const [filters, setFilters] = useState({
    protocol: '',
    status: '',
    searchTerm: ''
  })
  const [sortConfig, setSortConfig] = useState({
    key: 'bytes',
    direction: 'desc'
  })

  useEffect(() => {
    if (networkStats?.connections?.length > 0) {
      setConnections(networkStats.connections)
    } else {
      const mockConnections = Array(20).fill(0).map((_, i) => ({
        id: `conn-${i}`,
        source_ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        source_port: Math.floor(Math.random() * 60000) + 1024,
        dest_ip: `10.0.0.${Math.floor(Math.random() * 254) + 1}`,
        dest_port: [80, 443, 8080, 3000, 3306, 5432][Math.floor(Math.random() * 6)],
        protocol: ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'SMTP'][Math.floor(Math.random() * 6)],
        bytes: Math.floor(Math.random() * 10485760),
        packets: Math.floor(Math.random() * 1000),
        start_time: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
        status: Math.random() > 0.3 ? 'active' : 'closed',
        country: ['US', 'CN', 'RU', 'UK', 'DE', 'FR'][Math.floor(Math.random() * 6)],
        application: ['Chrome', 'Firefox', 'Edge', 'VS Code', 'Spotify', 'Zoom'][Math.floor(Math.random() * 6)]
      }))
      
      setConnections(mockConnections)
    }
  }, [networkStats])

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const formatDate = (date) => {
    if (!date) return '';
    
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    return date.toLocaleString();
  }

  // Handle sort request
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Apply filters and sorting to connections data
  const filteredConnections = connections
    .filter(conn => {
      // Apply protocol filter
      if (filters.protocol && conn.protocol !== filters.protocol) {
        return false
      }
      
      // Apply status filter
      if (filters.status && conn.status !== filters.status) {
        return false
      }
      
      // Apply search term filter
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase()
        return (
          conn.source_ip.toLowerCase().includes(term) ||
          conn.dest_ip.toLowerCase().includes(term) ||
          String(conn.source_port).includes(term) ||
          String(conn.dest_port).includes(term) ||
          conn.protocol.toLowerCase().includes(term) ||
          conn.application?.toLowerCase().includes(term) ||
          conn.country?.toLowerCase().includes(term)
        )
      }
      
      return true
    })
    .sort((a, b) => {
      // Apply sorting
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      
      return 0
    })

  const protocols = [...new Set(connections.map(conn => conn.protocol))]
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Network Traffic</h1>
      </div>

      {/* Filters */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-medium">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="protocol-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Protocol
            </label>
            <select
              id="protocol-filter"
              className="input w-full"
              value={filters.protocol}
              onChange={(e) => handleFilterChange('protocol', e.target.value)}
            >
              <option value="">All Protocols</option>
              {protocols.map(protocol => (
                <option key={protocol} value={protocol}>{protocol}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              className="input w-full"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              id="search-filter"
              type="text"
              placeholder="Search IP, port, application..."
              className="input w-full"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Connection Table */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Connections</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
            <thead className="bg-gray-50 dark:bg-dark-700">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('source_ip')}
                >
                  Source
                  {sortConfig.key === 'source_ip' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('dest_ip')}
                >
                  Destination
                  {sortConfig.key === 'dest_ip' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('protocol')}
                >
                  Protocol
                  {sortConfig.key === 'protocol' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('bytes')}
                >
                  Data
                  {sortConfig.key === 'bytes' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('start_time')}
                >
                  Start Time
                  {sortConfig.key === 'start_time' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('status')}
                >
                  Status
                  {sortConfig.key === 'status' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('application')}
                >
                  Application
                  {sortConfig.key === 'application' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-700">
              {filteredConnections.map((conn, index) => (
                <tr key={conn.id || index} className="hover:bg-gray-50 dark:hover:bg-dark-750">
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
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      ({conn.packets} packets)
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {formatDate(conn.start_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${conn.status === 'active' 
                        ? 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {conn.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {conn.application || 'Unknown'}
                  </td>
                </tr>
              ))}
              
              {filteredConnections.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No connections found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-medium mb-4">Protocol Distribution</h2>
          <div className="h-64 w-full">
            {/* A placeholder for a pie chart showing protocol distribution */}
            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <p>Protocol distribution chart will be displayed here</p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <h2 className="text-lg font-medium mb-4">Destination Ports</h2>
          <div className="h-64 w-full">
            {/* A placeholder for a bar chart showing top destination ports */}
            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <p>Top destination ports chart will be displayed here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 