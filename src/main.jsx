import './style.css';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DerbyProvider>
      <App />
    </DerbyProvider>
  </React.StrictMode>
)

import { DerbyProvider } from "./DegenerateDerby/DerbyContext";

<DerbyProvider>
  <App />
</DerbyProvider>
