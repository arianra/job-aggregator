import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { bootstrapTelemetry } from './telemetry/bootstrap'

// E9.3: start the client telemetry SDK (session id, buffered clicks/errors, flush).
bootstrapTelemetry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
