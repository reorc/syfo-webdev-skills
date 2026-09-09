import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { syfoAuthConfig, syfoAuthCookies } from './config';
import { openCookie } from './protocol';
import type { StoredSyfoAuthSession, SyfoAuthSession } from './types';

export async function readSyfoSession(request: NextRequest): Promise<StoredSyfoAuthSession | null> {
  const session = await openCookie<StoredSyfoAuthSession>(
    request.cookies.get(syfoAuthCookies.session)?.value,
    syfoAuthConfig().sessionSecret,
  );
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}

type ProtectedHandler<Context> = (
  request: NextRequest,
  context: Context & { syfoAuth: SyfoAuthSession },
) => Response | Promise<Response>;

export function protectedRoute<Context extends object = Record<string, never>>(
  handler: ProtectedHandler<Context>,
) {
  return async (request: NextRequest, context: Context) => {
    const stored = await readSyfoSession(request);
    if (!stored) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
    return handler(request, {
      ...context,
      syfoAuth: {
        user: stored.user,
        appUser: stored.appUser,
        expiresAt: stored.expiresAt,
        hostedApp: stored.hostedApp,
      },
    });
  };
}

export function orgProtectedRoute<Context extends object = Record<string, never>>(
  handler: ProtectedHandler<Context>,
) {
  return protectedRoute<Context>((request, context) => {
    if (!context.syfoAuth.hostedApp.orgMember) {
      return NextResponse.json({ error: 'organization_membership_required' }, { status: 403 });
    }
    return handler(request, context);
  });
}
