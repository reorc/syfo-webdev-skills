'use client';

import { useCallback, useEffect, useState } from 'react';
import { syfoAuthPaths } from './paths';
import type { SyfoAuthSession } from './types';

export function startLogin(returnTo = window.location.pathname + window.location.search): void {
  const url = new URL(syfoAuthPaths.login, window.location.origin);
  url.searchParams.set('returnTo', returnTo);
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
