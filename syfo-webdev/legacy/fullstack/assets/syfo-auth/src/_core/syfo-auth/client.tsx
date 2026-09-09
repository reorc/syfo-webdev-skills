'use client';

import { useCallback, useEffect, useState } from 'react';
import { syfoAuthPaths } from './paths';
import type { SyfoAuthSession } from './types';

export function startLogin(returnTo = window.location.pathname + window.location.search): void {
  const url = new URL(syfoAuthPaths.login, window.location.origin);
  url.searchParams.set('returnTo', returnTo);
  // The browser's address-bar origin is the only reliable public origin: behind the
  // runtime edge the server sees an internal bind host (e.g. 0.0.0.0:9000), so the
  // login route must derive the OAuth redirect_uri from this value, never from req.host.
  url.searchParams.set('origin', window.location.origin);
  window.location.assign(url);
}

export function useSyfoAuth() {
  const [session, setSession] = useState<SyfoAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(syfoAuthPaths.session, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      setSession(response.ok ? ((await response.json()) as SyfoAuthSession) : null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(syfoAuthPaths.logout, { method: 'POST', credentials: 'same-origin' });
    setSession(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    session,
    user: session?.user ?? null,
    loading,
    authenticated: Boolean(session),
    refresh,
    logout,
  };
}
