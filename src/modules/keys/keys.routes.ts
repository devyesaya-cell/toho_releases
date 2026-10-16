import { FastifyInstance, FastifyRequest } from 'fastify';
import { KeysService } from './keys.service.js';
import { requireAdmin } from '../auth/auth.js';

export async function keysRoutes(fastify: FastifyInstance) {
  fastify.get('/keys', { preHandler: requireAdmin }, async (req, reply) => {
    const keys = KeysService.listKeys();
    // Mask key string for non-master keys partially if needed, or return full for admin
    return { success: true, data: keys };
  });

  fastify.post('/keys', { preHandler: requireAdmin }, async (req: FastifyRequest<{
    Body: { name: string; role?: 'admin' | 'read' };
  }>, reply) => {
    const { name, role } = req.body || {};
    if (!name) {
      return reply.status(400).send({ success: false, error: 'Key name is required' });
    }
    const created = KeysService.createKey(name, role || 'read');
    return reply.status(201).send({ success: true, data: created });
  });

  fastify.delete('/keys/:id', { preHandler: requireAdmin }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const success = KeysService.deleteKey(req.params.id);
    if (!success) {
      return reply.status(404).send({ success: false, error: 'Key not found' });
    }
    return { success: true, message: 'API key revoked' };
  });
}
