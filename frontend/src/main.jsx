import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <Toaster
            position="top-center"
            gutter={10}
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--s)',
                color: 'var(--t)',
                border: '1.5px solid var(--b)',
                borderRadius: '14px',
                padding: '12px 16px',
                fontSize: '13.5px',
                fontWeight: 500,
                fontFamily: 'var(--sans)',
                boxShadow: '0 10px 30px -8px rgba(0,0,0,0.35), 0 2px 8px -2px rgba(0,0,0,0.2)',
                maxWidth: '440px',
              },
              success: {
                iconTheme: { primary: 'var(--ok)', secondary: 'var(--s)' },
                style: { borderColor: 'color-mix(in srgb, var(--ok) 45%, var(--b))' },
              },
              error: {
                iconTheme: { primary: 'var(--err)', secondary: 'var(--s)' },
                style: { borderColor: 'color-mix(in srgb, var(--err) 45%, var(--b))' },
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
