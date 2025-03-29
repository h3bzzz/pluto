import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="block text-7xl font-extrabold text-primary-600 dark:text-primary-400">404</h1>
          <h1 className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">Page not found</h1>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">Sorry, we couldn't find the page you're looking for.</p>
          <div className="mt-6">
            <Link 
              to="/" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Go back home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 