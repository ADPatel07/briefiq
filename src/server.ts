import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import type { Response as ExpressResponse } from 'express';
import { join } from 'node:path';
import {
  analyzeBriefPayload,
  generatePrdPayload,
  getBriefiqEnvironmentStatus,
  toBriefiqApiErrorResponse,
} from './app/briefiq/briefiq-ai.server.js';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

console.info('[BriefIQ][Server] environment loaded', getBriefiqEnvironmentStatus());

app.use('/api/briefiq', express.json({ limit: '1mb' }));

app.post('/api/briefiq/analyze', async (req, res) => {
  try {
    res.json(await analyzeBriefPayload(req.body));
  } catch (error) {
    sendApiError(res, error);
  }
});

app.post('/api/briefiq/prd', async (req, res) => {
  try {
    res.json(await generatePrdPayload(req.body));
  } catch (error) {
    sendApiError(res, error);
  }
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);

function sendApiError(res: ExpressResponse, error: unknown): void {
  const apiError = toBriefiqApiErrorResponse(error);
  res.status(apiError.status).json(apiError.payload);
}
