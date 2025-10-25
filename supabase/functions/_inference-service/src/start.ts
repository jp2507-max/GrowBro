import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { URL } from 'url';

import { config } from './config';
import type { ModelContext } from './model-loader';
import { getModelContext } from './model-loader';
import {
  cloudInferenceRequestSchema,
  CloudInferenceResponseEnvelope,
} from './schema';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB

type ParsedRequest = ReturnType<typeof cloudInferenceRequestSchema.parse>;

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

function buildSuccessEnvelope(
  model: ModelContext,
  request: ParsedRequest,
  processingTimeMs: number
): CloudInferenceResponseEnvelope {
  const timestamp = Date.now();

  return {
    success: true,
    mode: 'cloud',
    modelVersion: model.version ?? request.modelVersion ?? 'unknown',
    processingTimeMs,
    result: {
      topClass: {
        id: 'unknown',
        name: 'Unknown / Pending model output',
        category: 'unknown',
        description:
          'Cloud inference stub response (model execution not yet implemented).',
        visualCues: [],
        isOod: true,
        actionTemplate: {
          immediateSteps: [],
          shortTermActions: [],
          diagnosticChecks: [],
          warnings: [],
          disclaimers: [],
        },
        createdAt: timestamp,
      },
      rawConfidence: 0.5,
      calibratedConfidence: 0.5,
      perImage: request.images.map((image) => ({
        id: image.id,
        uri: image.url,
        classId: 'unknown',
        conf: 0.5,
        quality: {
          score: 0.5,
          acceptable: true,
          issues: [],
        },
      })),
      aggregationMethod: 'highest-confidence',
      processingTimeMs,
      mode: 'cloud',
      modelVersion: model.version ?? request.modelVersion ?? 'unknown',
      executionProvider: model.status === 'warm' ? 'cpu' : undefined,
    },
  } satisfies CloudInferenceResponseEnvelope;
}

function buildModelNotReadyEnvelope(
  model: ModelContext,
  processingTimeMs: number
): CloudInferenceResponseEnvelope {
  return {
    success: false,
    mode: 'cloud',
    modelVersion: model.version ?? 'unknown',
    processingTimeMs,
    error: {
      code: 'MODEL_NOT_READY',
      message: 'Inference model is not yet loaded. Try again shortly.',
    },
  };
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      throw new HttpError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Request body is too large'
      );
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new HttpError(400, 'INVALID_JSON', 'Request body is required');
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Failed to parse JSON body');
  }
}

async function handleHealth(res: ServerResponse): Promise<void> {
  const model = await getModelContext(config);
  sendJson(res, 200, {
    status: 'ok',
    modelStatus: model.status,
    modelVersion: model.version ?? null,
  });
}

async function handleInference(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const startedAt = Date.now();

  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new HttpError(400, 'MISSING_USER_ID', 'Missing X-User-Id header');
  }

  const rawBody = await readJsonBody(req);
  const parseResult = cloudInferenceRequestSchema.safeParse(rawBody);

  if (!parseResult.success) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request payload', {
      errors: parseResult.error.flatten(),
    });
  }

  const requestPayload = parseResult.data;
  const model = await getModelContext(config);
  const processingTimeMs = Date.now() - startedAt;

  if (model.status === 'cold') {
    sendJson(res, 503, buildModelNotReadyEnvelope(model, processingTimeMs));
    return;
  }

  sendJson(
    res,
    200,
    buildSuccessEnvelope(model, requestPayload, processingTimeMs)
  );
}

async function routeRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!req.url || !req.method) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Missing request URL or method'
    );
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    await handleHealth(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/') {
    await handleInference(req, res);
    return;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
    res.end();
    return;
  }

  throw new HttpError(404, 'NOT_FOUND', 'Route not found');
}

export function createServerInstance(): Server {
  const server = createServer(async (req, res) => {
    try {
      await routeRequest(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, {
          success: false,
          mode: 'cloud',
          modelVersion: 'unknown',
          processingTimeMs: 0,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      console.error('[inference-service] Unhandled error:', error);
      sendJson(res, 500, {
        success: false,
        mode: 'cloud',
        modelVersion: 'unknown',
        processingTimeMs: 0,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected server error',
        },
      });
    }
  });

  return server;
}

export async function start(): Promise<void> {
  const server = createServerInstance();

  await new Promise<void>((resolve) => {
    server.listen(config.PORT, () => {
      console.log(
        `[inference-service] Listening on port ${config.PORT} (model path: ${config.MODEL_PATH ?? 'not configured'})`
      );
      resolve();
    });
  });

  const shutdown = () => {
    server.close(() => {
      console.log('[inference-service] Server stopped');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error: unknown) => {
    console.error('[inference-service] Failed to start server:', error);
    process.exit(1);
  });
}
