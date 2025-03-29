import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

export default function Settings() {
  const { darkMode, toggleTheme } = useTheme()
  
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      desktop: true,
      slack: false,
      highSeverityOnly: false
    },
    network: {
      capturePackets: true,
      storeDuration: 7, // days
      maxPacketSize: 1500, // bytes
      interfaceMode: 'auto' // auto, specific
    },
    alerts: {
      portScans: true,
      bruteForce: true,
      dataExfiltration: true,
      suspiciousIPs: true,
      unusualTraffic: true,
      threshold: 'medium' // low, medium, high
    },
    system: {
      autoUpdate: true,
      startWithSystem: true,
      analyticsEnabled: false
    }
  })

  // Handle toggle change
  const handleToggleChange = (category, setting) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: !prev[category][setting]
      }
    }))
  }

  // Handle select change
  const handleSelectChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }))
  }

  // Save settings
  const saveSettings = () => {
    // In a real app, this would send settings to the backend
    alert('Settings saved successfully!')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <button
          onClick={saveSettings}
          className="btn bg-primary-600 hover:bg-primary-700 text-white"
        >
          Save Settings
        </button>
      </div>

      {/* Appearance */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Appearance</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="theme-toggle" className="font-medium">Dark Mode</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enable dark mode for the dashboard</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="theme-toggle"
                checked={darkMode}
                onChange={toggleTheme}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="theme-toggle"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  darkMode ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="email-notifications" className="font-medium">Email Notifications</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receive alerts via email</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="email-notifications"
                checked={settings.notifications.email}
                onChange={() => handleToggleChange('notifications', 'email')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="email-notifications"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.notifications.email ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="desktop-notifications" className="font-medium">Desktop Notifications</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Show alerts as desktop notifications</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="desktop-notifications"
                checked={settings.notifications.desktop}
                onChange={() => handleToggleChange('notifications', 'desktop')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="desktop-notifications"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.notifications.desktop ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="slack-notifications" className="font-medium">Slack Notifications</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Send alerts to a Slack channel</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="slack-notifications"
                checked={settings.notifications.slack}
                onChange={() => handleToggleChange('notifications', 'slack')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="slack-notifications"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.notifications.slack ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="high-severity-only" className="font-medium">High Severity Only</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Only notify for high severity alerts</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="high-severity-only"
                checked={settings.notifications.highSeverityOnly}
                onChange={() => handleToggleChange('notifications', 'highSeverityOnly')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="high-severity-only"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.notifications.highSeverityOnly ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>
        </div>
      </div>

      {/* Network Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Network Monitoring</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="capture-packets" className="font-medium">Capture Packets</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Store packet data for analysis</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="capture-packets"
                checked={settings.network.capturePackets}
                onChange={() => handleToggleChange('network', 'capturePackets')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="capture-packets"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.network.capturePackets ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div>
            <label htmlFor="store-duration" className="font-medium">Storage Duration</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">How long to keep packet data</p>
            <select
              id="store-duration"
              className="input w-full"
              value={settings.network.storeDuration}
              onChange={(e) => handleSelectChange('network', 'storeDuration', parseInt(e.target.value))}
            >
              <option value={1}>1 Day</option>
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>

          <div>
            <label htmlFor="max-packet-size" className="font-medium">Max Packet Size</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Maximum size of packets to capture</p>
            <select
              id="max-packet-size"
              className="input w-full"
              value={settings.network.maxPacketSize}
              onChange={(e) => handleSelectChange('network', 'maxPacketSize', parseInt(e.target.value))}
            >
              <option value={512}>512 bytes</option>
              <option value={1024}>1024 bytes</option>
              <option value={1500}>1500 bytes (Ethernet MTU)</option>
              <option value={9000}>9000 bytes (Jumbo Frames)</option>
            </select>
          </div>

          <div>
            <label htmlFor="interface-mode" className="font-medium">Network Interface</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Which network interfaces to monitor</p>
            <select
              id="interface-mode"
              className="input w-full"
              value={settings.network.interfaceMode}
              onChange={(e) => handleSelectChange('network', 'interfaceMode', e.target.value)}
            >
              <option value="auto">Auto-detect (Recommended)</option>
              <option value="specific">Specific Interfaces</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Alert Detection</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="port-scans" className="font-medium">Port Scan Detection</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alert on potential port scanning activity</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="port-scans"
                checked={settings.alerts.portScans}
                onChange={() => handleToggleChange('alerts', 'portScans')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="port-scans"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.alerts.portScans ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="brute-force" className="font-medium">Brute Force Detection</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alert on multiple failed login attempts</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="brute-force"
                checked={settings.alerts.bruteForce}
                onChange={() => handleToggleChange('alerts', 'bruteForce')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="brute-force"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.alerts.bruteForce ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="data-exfiltration" className="font-medium">Data Exfiltration</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alert on large outbound data transfers</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="data-exfiltration"
                checked={settings.alerts.dataExfiltration}
                onChange={() => handleToggleChange('alerts', 'dataExfiltration')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="data-exfiltration"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.alerts.dataExfiltration ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="suspicious-ips" className="font-medium">Suspicious IPs</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alert on connections to known malicious IPs</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="suspicious-ips"
                checked={settings.alerts.suspiciousIPs}
                onChange={() => handleToggleChange('alerts', 'suspiciousIPs')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="suspicious-ips"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.alerts.suspiciousIPs ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="unusual-traffic" className="font-medium">Unusual Traffic</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alert on unusual network traffic patterns</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="unusual-traffic"
                checked={settings.alerts.unusualTraffic}
                onChange={() => handleToggleChange('alerts', 'unusualTraffic')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="unusual-traffic"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.alerts.unusualTraffic ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div>
            <label htmlFor="alert-threshold" className="font-medium">Alert Threshold</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Sensitivity level for alert detection</p>
            <select
              id="alert-threshold"
              className="input w-full"
              value={settings.alerts.threshold}
              onChange={(e) => handleSelectChange('alerts', 'threshold', e.target.value)}
            >
              <option value="low">Low (More Alerts)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Fewer Alerts)</option>
            </select>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">System</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="auto-update" className="font-medium">Auto Update</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatically update the application</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="auto-update"
                checked={settings.system.autoUpdate}
                onChange={() => handleToggleChange('system', 'autoUpdate')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="auto-update"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.system.autoUpdate ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="start-with-system" className="font-medium">Start with System</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Launch application on system startup</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="start-with-system"
                checked={settings.system.startWithSystem}
                onChange={() => handleToggleChange('system', 'startWithSystem')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="start-with-system"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.system.startWithSystem ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="analytics-enabled" className="font-medium">Usage Analytics</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Send anonymous usage data to help improve the app</p>
            </div>
            <div className="relative inline-block w-12 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="analytics-enabled"
                checked={settings.system.analyticsEnabled}
                onChange={() => handleToggleChange('system', 'analyticsEnabled')}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label
                htmlFor="analytics-enabled"
                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                  settings.system.analyticsEnabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          className="btn bg-primary-600 hover:bg-primary-700 text-white"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
} 