import {
  analyzeBriefPayload,
  toBriefiqApiErrorResponse,
} from '../../src/app/briefiq/briefiq-ai.server';

interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): VercelResponse;
  json(payload: unknown): void;
  end(): void;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  setPostHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  try {
    response.status(200).json(await analyzeBriefPayload(readJsonBody(request.body)));
  } catch (error) {
    sendApiError(response, error);
  }
}

function setPostHeaders(response: VercelResponse): void {
  response.setHeader('Allow', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function readJsonBody(body: unknown): unknown {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'string') {
    return body;
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw { status: 400, message: 'Send a valid JSON request body.' };
  }
}

function sendApiError(response: VercelResponse, error: unknown): void {
  const apiError = toBriefiqApiErrorResponse(error);
  response.status(apiError.status).json(apiError.payload);
}
