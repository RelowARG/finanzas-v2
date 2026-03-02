// src/components/Layout/AppShell.jsx
import React, { useState } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-content">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            display: 'none', position: 'fixed', top: 16, left: 16, zIndex: 98,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text)'
          }}
          className="mobile-menu-btn"
        >
          ☰
        </button>
        {children}
      </main>
    </div>
  );
}
