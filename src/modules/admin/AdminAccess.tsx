import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
const AccessContext = createContext(false);
export function useAdministrator() { return useContext(AccessContext); }
// Visitors always see the public command center. Operators can opt in to sign-in.
export default function AdminAccess({ children, signInButtonLabel = 'Sign in to publishing desk', signInDescription = 'Sign in to publish and manage MAX. Public browsing stays open.' }: { children: React.ReactNode; signInButtonLabel?: string; signInDescription?: string }) {
  const [authenticated, setAuthenticated] = useState(false); const [checking, setChecking] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const revision = useRef(0); const interacting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const check = async () => {
      if (interacting.current) return;
      const request = ++revision.current;
      try { const response = await fetch('/api/admin/session', { signal: controller.signal }); if (request !== revision.current || controller.signal.aborted) return; if (response.ok) setAuthenticated(true); else if (response.status === 401 || response.status === 403) setAuthenticated(false); }
      catch { /* Public viewing remains available during a connection error. */ }
      finally { if (!controller.signal.aborted) setChecking(false); }
    };
    void check(); const interval = window.setInterval(() => void check(), 60_000); const focus = () => void check(); window.addEventListener('focus', focus);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener('focus', focus); };
  }, []);
  if (checking) return <div className="admin-access" role="status">Opening command center…</div>;
  return <AccessContext.Provider value={authenticated}><div className="operator-access">{authenticated ? <button disabled={busy} onClick={async () => {
    interacting.current = true; ++revision.current; setBusy(true); setError('');
    try { const response = await fetch('/api/admin/logout', { method: 'POST' }); if (!response.ok) throw new Error('Sign-out failed. Please try again.'); setAuthenticated(false); setShowSignIn(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign-out failed.'); }
    finally { interacting.current = false; setBusy(false); }
  }}>Sign out</button> : <button aria-expanded={showSignIn} onClick={() => { setShowSignIn(value => !value); setError(''); setPassword(''); }}>{showSignIn ? 'Close operator sign-in' : 'Operator sign-in'}</button>}{!authenticated && showSignIn && <form onSubmit={async e => {
    e.preventDefault(); interacting.current = true; ++revision.current; setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Incorrect administrator password. Please try again.' : response.status === 429 ? 'Too many sign-in attempts. Try again in a minute.' : 'Sign-in is temporarily unavailable. Please try again later.');
      const session = await fetch('/api/admin/session'); if (!session.ok) throw new Error('The login cookie could not establish a session. Enable site cookies and retry.');
      setAuthenticated(true); setShowSignIn(false); setPassword('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); }
    finally { interacting.current = false; setBusy(false); }
  }}><h2>Operator sign-in</h2><p>{signInDescription}</p><label>Administrator password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)}/></label><button disabled={busy}>{busy ? 'Signing in…' : signInButtonLabel}</button></form>}{error && <p role="alert">{error}</p>}</div>{children}</AccessContext.Provider>;
}
