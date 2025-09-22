'use client'

import { useState } from 'react'

export default function AuthTestPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  // Test Sign Up
  const handleSignUp = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage('Sign up successful! Check your email for verification.')
        setUser(data.user)
      } else {
        setMessage(`Error: ${data.error?.message || 'Sign up failed'}`)
      }
    } catch (error) {
      setMessage(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Test Sign In
  const handleSignIn = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage('Sign in successful!')
        setUser(data.user)
      } else {
        setMessage(`Error: ${data.error?.message || 'Sign in failed'}`)
      }
    } catch (error) {
      setMessage(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Test Session Check
  const checkSession = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (data.authenticated) {
        setMessage('Session is valid!')
        setUser(data.user)
      } else {
        setMessage('No active session')
        setUser(null)
      }
    } catch (error) {
      setMessage(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Test Sign Out
  const handleSignOut = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage('Signed out successfully')
        setUser(null)
      } else {
        setMessage(`Error: ${data.error?.message || 'Sign out failed'}`)
      }
    } catch (error) {
      setMessage(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Test Magic Link Request
  const requestMagicLink = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage('Magic link sent! Check console for the link (email not configured)')
      } else {
        setMessage(`Error: ${data.error?.message || 'Magic link request failed'}`)
      }
    } catch (error) {
      setMessage(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Authentication Test Page
        </h1>
        
        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.includes('Error') 
              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
              : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            {message}
          </div>
        )}
        
        {/* Current User */}
        {user && (
          <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg mb-6">
            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">Current User:</h3>
            <pre className="text-sm text-blue-800 dark:text-blue-400">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Input Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
              placeholder="test@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
              placeholder="Password123!"
            />
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleSignUp}
            disabled={loading || !email || !password}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign Up
          </button>
          
          <button
            onClick={handleSignIn}
            disabled={loading || !email || !password}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign In
          </button>
          
          <button
            onClick={requestMagicLink}
            disabled={loading || !email}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request Magic Link
          </button>
          
          <button
            onClick={checkSession}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check Session
          </button>
          
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed col-span-2"
          >
            Sign Out
          </button>
        </div>
        
        {/* Instructions */}
        <div className="p-4 bg-gray-100 dark:bg-dark-700 rounded-lg">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Enter an email and password (min 8 chars, 1 uppercase, 1 number, 1 special char)</li>
            <li>Click "Sign Up" to create a new account</li>
            <li>Click "Sign In" to log in with existing account</li>
            <li>Click "Check Session" to verify if you're logged in</li>
            <li>Click "Request Magic Link" for passwordless login</li>
            <li>Click "Sign Out" to end your session</li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Note:</strong> Email sending is not configured. Magic links and verification emails will be logged to the console.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}