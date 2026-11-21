import React, { Suspense, useEffect, useState } from 'react';
import { CollectorVault } from './modules/art/CollectorCheckout';
import BeemaxPortalCommandHud from './components/BeemaxPortalCommandHud';
import MaxSportsUserHud from './modules/sports/MaxSportsUserHud';
import PortalOS1Layout from './core/PortalOS1Layout';

const AdminConsole = React.lazy(() => import('./modules/admin/PortalOS1Console'));

const readRouteHash = (): string => {
  if (typeof window === 'undefined') return '';
  return window.location.hash.replace(/^#/, '').trim().toLowerCase();
};

const readAuthorizedCommandSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal_auth') === '1') {
      window.sessionStorage.setItem('portal_os1_command_auth', '1');
      return true;
    }
    return window.sessionStorage.getItem('portal_os1_command_auth') === '1';
  } catch {
    return false;
  }
};

export default function App() {
  const [route, setRoute] = useState<string>(readRouteHash);
  const [isAuthorizedCommandSession, setIsAuthorizedCommandSession] = useState<boolean>(
    readAuthorizedCommandSession,
  );

  useEffect(() => {
    const updateRoute = () => {
      setRoute(readRouteHash());
      setIsAuthorizedCommandSession(readAuthorizedCommandSession());
    };
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/vault/')) {
    return <CollectorVault />;
  }
  if (route === '/sports-outputs') return <MaxSportsUserHud />;

  if (route === '/hud' || route === '/portal-os1') {
    if (!isAuthorizedCommandSession) {
      return (
        <PortalOS1Layout>
          <div
            style={{
              background: '#070b14',
              color: '#e2e8f0',
              minHeight: '100vh',
              padding: 24,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <section
              aria-label="Private Command HUD Restricted"
              style={{
                maxWidth: 720,
                margin: '0 auto',
                background: '#0e1525',
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <h1 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                Private Portal-OS1 Command HUD Locked
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8' }}>
                Direct access to #/hud and #/portal-os1 is restricted. Public and opted-in users remain on
                BEEMAX output-only access (MAX Compute: 0.000000; Base 8453 USDC opt-in).
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '';
                  setRoute('');
                }}
                style={{
                  marginTop: 14,
                  background: '#132238',
                  color: '#f8fafc',
                  border: '1px solid #38bdf8',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Return to Public Hub
              </button>
            </section>
          </div>
        </PortalOS1Layout>
      );
    }
    return <BeemaxPortalCommandHud />;
  }

  if (
    route === '/admin' ||
    (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin')
  ) {
    return (
      <Suspense fallback={<div className="loading-screen">INITIALIZING PORTAL...</div>}>
        <AdminConsole />
      </Suspense>
    );
  }

  return <PortalOS1Layout />;
}
