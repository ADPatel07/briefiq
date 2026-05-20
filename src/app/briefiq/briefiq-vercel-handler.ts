import { BriefiqApiError, toBriefiqApiErrorResponse } from './briefiq-ai.server';

export interface BriefiqVercelRequest {
  method?: string;
  body?: unknown;
}

export interface BriefiqVercelResponse {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): BriefiqVercelResponse;
  json(payload: unknown): void;
  end(): void;
}

export async function handleBriefiqPost<T>(
  request: BriefiqVercelRequest,
  response: BriefiqVercelResponse,
  action: (payload: unknown) => Promise<T>,
): Promise<void> {
  response.setHeader('Allow', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  try {
    const payload = readJsonBody(request.body);
    const result = await action(payload);
    response.status(200).json(result);
  } catch (error) {
    const apiError = toBriefiqApiErrorResponse(error);
    response.status(apiError.status).json(apiError.payload);
  }
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
    throw new BriefiqApiError(400, 'Send a valid JSON request body.');
  }
}
