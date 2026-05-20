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
    const { generatePrdPayload } = await import('../../src/app/briefiq/briefiq-ai.server.js');
    response.status(200).json(await generatePrdPayload(readJsonBody(request.body)));
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
  const errorInfo = describeError(error);
  response
    .status(errorInfo.status)
    .json(
      errorInfo.details
        ? { message: errorInfo.message, details: errorInfo.details }
        : { message: errorInfo.message },
    );
}

function describeError(error: unknown): { status: number; message: string; details?: string } {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const status = typeof record['status'] === 'number' ? record['status'] : 500;
    const message =
      typeof record['message'] === 'string'
        ? record['message']
        : 'BriefIQ API failed before PRD generation completed.';
    const details = typeof record['details'] === 'string' ? record['details'] : undefined;
    return { status, message, details };
  }

  return {
    status: 500,
    message: 'BriefIQ API failed before PRD generation completed.',
    details: String(error),
  };
}
