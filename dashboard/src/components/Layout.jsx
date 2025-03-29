import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

// Icons
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm7-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z" />
  </svg>
)

const NetworkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a1 1 0 011-1h5.586a.997.997 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
)

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
)

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
)

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
  </svg>
)

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
)

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export default function Layout({ isConnected }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { darkMode, toggleTheme } = useTheme()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for mobile */}
      <div 
        className={`fixed inset-0 z-40 lg:hidden ${
          sidebarOpen ? 'block' : 'hidden'
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75"></div>
        <div className="fixed inset-y-0 left-0 flex max-w-xs w-full">
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-dark-800 shadow-xl">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center">
                <img src="/favicon.svg" alt="Pluto Logo" className="h-8 w-8 mr-2" />
                <h1 className="text-xl font-semibold">Pluto</h1>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 overflow-y-auto">
              <NavItems />
            </nav>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
            <div className="flex justify-between items-center h-16 flex-shrink-0 px-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center">
                <img src="/favicon.svg" alt="Pluto Logo" className="h-8 w-8 mr-2" />
                <h1 className="text-xl font-semibold">Pluto</h1>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto">
              <nav className="flex-1 px-4 py-4">
                <NavItems />
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white dark:bg-dark-800 shadow">
          <button
            className="lg:hidden px-4 border-r border-gray-200 dark:border-dark-700 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <MenuIcon />
          </button>

          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex items-center">
              <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-secondary-500' : 'bg-danger-500'} mr-2`}></span>
                <span className="text-sm font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none"
                onClick={toggleTheme}
              >
                {darkMode ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 relative overflow-y-auto focus:outline-none p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItems() {
  return (
    <div className="space-y-2">
      <NavLink 
        to="/" 
        className={({ isActive }) => `flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
          isActive 
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-dark-700'
        }`}
        end
      >
        <DashboardIcon />
        <span className="ml-3">Dashboard</span>
      </NavLink>
      
      <NavLink 
        to="/network" 
        className={({ isActive }) => `flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
          isActive 
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-dark-700'
        }`}
      >
        <NetworkIcon />
        <span className="ml-3">Network Traffic</span>
      </NavLink>
      
      <NavLink 
        to="/alerts" 
        className={({ isActive }) => `flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
          isActive 
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-dark-700'
        }`}
      >
        <AlertIcon />
        <span className="ml-3">Alerts</span>
      </NavLink>
      
      <NavLink 
        to="/settings" 
        className={({ isActive }) => `flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
          isActive 
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100' 
            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-dark-700'
        }`}
      >
        <SettingsIcon />
        <span className="ml-3">Settings</span>
      </NavLink>
    </div>
  )
} 