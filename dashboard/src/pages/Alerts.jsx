import { useState, useEffect } from 'react'

export default function Alerts({ networkStats }) {
  const [alerts, setAlerts] = useState([])
  const [alertFilter, setAlertFilter] = useState('all') // all, high, medium, low
  
  useEffect(() => {
    if (networkStats?.anomalies?.length > 0) {
      setAlerts(networkStats.anomalies)
    } else {
      const mockAlerts = [
        {
          id: 'alert-1',
          timestamp: new Date(Date.now() - 15 * 60 * 1000), 
          type: 'port_scan',
          severity: 'high',
          source_ip: '45.33.102.156',
          details: 'Multiple connection attempts to various ports detected from single source',
          status: 'new'
        },
        {
          id: 'alert-2',
          timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
          type: 'data_exfiltration',
          severity: 'high',
          source_ip: '192.168.1.42',
          dest_ip: '203.0.113.25',
          details: 'Unusual large data transfer to external host',
          status: 'investigating'
        },
        {
          id: 'alert-3',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          type: 'suspicious_connection',
          severity: 'medium',
          source_ip: '192.168.1.35',
          dest_ip: '198.51.100.78',
          details: 'Connection to known malicious host',
          status: 'resolved'
        },
        {
          id: 'alert-4',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          type: 'brute_force',
          severity: 'medium',
          source_ip: '203.0.113.42',
          details: 'Multiple failed login attempts detected',
          status: 'investigating'
        },
        {
          id: 'alert-5',
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
          type: 'unusual_traffic',
          severity: 'low',
          source_ip: '192.168.1.22',
          dest_ip: '192.168.1.1',
          details: 'Unusual protocol usage detected',
          status: 'resolved'
        },
        {
          id: 'alert-6',
          timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago
          type: 'unusual_hours',
          severity: 'low',
          source_ip: '192.168.1.53',
          details: 'Network activity during unusual hours',
          status: 'dismissed'
        },
      ]
      
      setAlerts(mockAlerts)
    }
  }, [networkStats])

  // Filter alerts based on severity
  const filteredAlerts = alerts.filter(alert => {
    if (alertFilter === 'all') return true
    return alert.severity === alertFilter
  })

  // Format date for display
  const formatDate = (date) => {
    if (!date) return ''
    
    if (typeof date === 'string') {
      date = new Date(date)
    }
    
    return date.toLocaleString()
  }

  // Calculate time ago for display
  const timeAgo = (date) => {
    if (!date) return ''
    
    if (typeof date === 'string') {
      date = new Date(date)
    }
    
    const seconds = Math.floor((new Date() - date) / 1000)
    
    let interval = Math.floor(seconds / 31536000)
    if (interval > 1) return `${interval} years ago`
    if (interval === 1) return 'a year ago'
    
    interval = Math.floor(seconds / 2592000)
    if (interval > 1) return `${interval} months ago`
    if (interval === 1) return 'a month ago'
    
    interval = Math.floor(seconds / 86400)
    if (interval > 1) return `${interval} days ago`
    if (interval === 1) return 'a day ago'
    
    interval = Math.floor(seconds / 3600)
    if (interval > 1) return `${interval} hours ago`
    if (interval === 1) return 'an hour ago'
    
    interval = Math.floor(seconds / 60)
    if (interval > 1) return `${interval} minutes ago`
    if (interval === 1) return 'a minute ago'
    
    if (seconds < 10) return 'just now'
    
    return `${Math.floor(seconds)} seconds ago`
  }

  // Get severity badge
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'high':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200">
            High
          </span>
        )
      case 'medium':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200">
            Medium
          </span>
        )
      case 'low':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-info-100 text-info-800 dark:bg-info-900 dark:text-info-200">
            Low
          </span>
        )
      default:
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Unknown
          </span>
        )
    }
  }

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
            New
          </span>
        )
      case 'investigating':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200">
            Investigating
          </span>
        )
      case 'resolved':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200">
            Resolved
          </span>
        )
      case 'dismissed':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Dismissed
          </span>
        )
      default:
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Unknown
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Security Alerts</h1>
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              alertFilter === 'all'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100'
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
            onClick={() => setAlertFilter('all')}
          >
            All
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              alertFilter === 'high'
                ? 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-100'
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
            onClick={() => setAlertFilter('high')}
          >
            High
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              alertFilter === 'medium'
                ? 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-100'
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
            onClick={() => setAlertFilter('medium')}
          >
            Medium
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md ${
              alertFilter === 'low'
                ? 'bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-100'
                : 'bg-white text-gray-700 dark:bg-dark-700 dark:text-gray-200'
            } border border-gray-200 dark:border-dark-600`}
            onClick={() => setAlertFilter('low')}
          >
            Low
          </button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Alerts</p>
            <p className="text-3xl font-semibold mt-1">{alerts.length}</p>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">High Severity</p>
            <p className="text-3xl font-semibold mt-1 text-danger-600 dark:text-danger-400">
              {alerts.filter(alert => alert.severity === 'high').length}
            </p>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Medium Severity</p>
            <p className="text-3xl font-semibold mt-1 text-warning-600 dark:text-warning-400">
              {alerts.filter(alert => alert.severity === 'medium').length}
            </p>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Low Severity</p>
            <p className="text-3xl font-semibold mt-1 text-info-600 dark:text-info-400">
              {alerts.filter(alert => alert.severity === 'low').length}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="card">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-dark-700">
              <svg className="h-6 w-6 text-gray-600 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No alerts found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No security alerts matching the current filter.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-dark-700">
            {filteredAlerts.map((alert) => (
              <li key={alert.id}>
                <div className="px-6 py-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-750">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      {getSeverityBadge(alert.severity)}
                      {getStatusBadge(alert.status)}
                      <p className="text-sm text-gray-500 dark:text-gray-400">{timeAgo(alert.timestamp)}</p>
                    </div>
                    <p className="mt-2 text-md font-medium">
                      {alert.type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {alert.details}
                    </p>
                    <div className="mt-2 flex space-x-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Source:</span> {alert.source_ip}
                      </p>
                      {alert.dest_ip && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Destination:</span> {alert.dest_ip}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Time:</span> {formatDate(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="ml-6 flex items-center space-x-2">
                    <button className="btn btn-sm bg-primary-100 hover:bg-primary-200 text-primary-700 dark:bg-primary-900 dark:hover:bg-primary-800 dark:text-primary-200">
                      Details
                    </button>
                    <button className="btn btn-sm bg-secondary-100 hover:bg-secondary-200 text-secondary-700 dark:bg-secondary-900 dark:hover:bg-secondary-800 dark:text-secondary-200">
                      {alert.status === 'resolved' || alert.status === 'dismissed' ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
} 