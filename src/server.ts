import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { getDb } from './db/index.js';
import { releasesRoutes } from './modules/releases/releases.routes.js';
import { storageRoutes } from './modules/storage/storage.routes.js';
import { keysRoutes } from './modules/keys/keys.routes.js';
import { statsRoutes } from './modules/stats/stats.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    bodyLimit: config.maxFileSizeMb * 1024 * 1024,
  });

  // Database initialization
  getDb();

  // CORS
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Multipart upload handler
  await fastify.register(multipart, {
    limits: {
      fileSize: config.maxFileSizeMb * 1024 * 1024,
    },
  });

  // Swagger OpenAPI Documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'VPS Storage & Release API',
        description: 'Self-hosted GitHub Releases alternative and universal file storage service for apps (Toho EGS, mobile apps, desktop apps, and microservices)',
        version: '1.0.0',
      },
      servers: [
        {
          url: config.baseUrl,
          description: 'Current Server',
        },
      ],
      components: {
        securitySchemes: {
          apiKeyHeader: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
            description: 'API key or Master Key',
          },
          apiKeyQuery: {
            type: 'apiKey',
            name: 'api_key',
            in: 'query',
            description: 'API key via query parameter',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  // Serve Public WebApp Dashboard
  const publicDir = path.resolve(rootDir, 'public');
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    decorateReply: true,
  });

  // Serve Uploaded Files statically under /files/
  await fastify.register(fastifyStatic, {
    root: config.filesDir,
    prefix: '/files/',
    decorateReply: false,
    index: false,
  });

  // Healthcheck endpoint
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  });

  // API v1 Routes
  await fastify.register(
    async (apiV1) => {
      await apiV1.register(releasesRoutes);
      await apiV1.register(storageRoutes);
      await apiV1.register(keysRoutes);
      await apiV1.register(statsRoutes);
    },
    { prefix: '/api/v1' }
  );

  return fastify;
}

async function start() {
  try {
    const app = await buildServer();
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n======================================================`);
    console.log(`🚀 VPS Storage & Release API is running!`);
    console.log(`🌐 Web App Dashboard : ${config.baseUrl}/`);
    console.log(`📖 Swagger API Docs  : ${config.baseUrl}/docs`);
    console.log(`📦 Latest Release API: ${config.baseUrl}/api/v1/releases/latest?app=toho_egs`);
    console.log(`🗄️  Storage Directory : ${config.storageDir}`);
    console.log(`🔑 Master Key        : ${config.masterKey}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
