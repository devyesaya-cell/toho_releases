import { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../db/index.js';
import { config } from '../../config.js';

export interface AuthContext {
  isAuthenticated: boolean;
  role: 'admin' | 'read' | 'anonymous';
  keyName?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Extracts and validates API key from header, query, or Bearer token.
 */
export function resolveApiKey(req: FastifyRequest): AuthContext {
  const headerKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers['authorization'];
  let bearerKey: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }
  const query = req.query as Record<string, string | undefined> | undefined;
  const queryKey = query?.api_key || query?.key;

  const providedKey = headerKey || bearerKey || queryKey;

  if (!providedKey) {
    return { isAuthenticated: false, role: 'anonymous' };
  }

  // 1. Direct match with Master Key from env
  if (providedKey === config.masterKey) {
    return {
      isAuthenticated: true,
      role: 'admin',
      keyName: 'Master Key (Environment)',
    };
  }

  // 2. Query in api_keys table
  const db = getDb();
  const row = db.prepare('SELECT id, name, role FROM api_keys WHERE key = ?').get(providedKey) as { id: string; name: string; role: 'admin' | 'read' } | undefined;

  if (row) {
    // Update last_used_at asynchronously
    const now = Math.floor(Date.now() / 1000);
    try {
      db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now, row.id);
    } catch {
      // ignore
    }

    return {
      isAuthenticated: true,
      role: row.role,
      keyName: row.name,
    };
  }

  return { isAuthenticated: false, role: 'anonymous' };
}

/**
 * Middleware hook that enforces Admin role for mutating endpoints
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const auth = resolveApiKey(req);
  req.auth = auth;

  if (!auth.isAuthenticated || auth.role !== 'admin') {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized: Admin API key required (x-api-key header or ?api_key= query parameter)',
    });
  }
}

/**
 * Middleware hook that requires at least read or admin authentication
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = resolveApiKey(req);
  req.auth = auth;

  if (!auth.isAuthenticated) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized: Valid API key required (x-api-key header or ?api_key= query parameter)',
    });
  }
}

/**
 * Optional auth hook that attaches auth context without blocking
 */
export async function optionalAuth(req: FastifyRequest) {
  req.auth = resolveApiKey(req);
}
