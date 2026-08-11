import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { Toaster } from 'react-hot-toast';
import SelectionToolbar from './components/SelectionToolbar.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SelectionToolbar />
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#f0f4ff',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px',
            fontSize: '0.88rem',
          },
          success: {
            iconTheme: { primary: '#7c3aed', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#fff' },
          },
        }}
      />
    </AuthProvider>
  </React.StrictMode>
);
