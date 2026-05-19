import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Unregister any service workers in dev mode to prevent stale cache issues
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
    }
  })
  
  // Clear all caches
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name)
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)