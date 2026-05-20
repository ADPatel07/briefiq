import { BriefiqApiError, toBriefiqApiErrorResponse } from './briefiq-ai.server';

const postHeaders = {
  Allow: 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handleBriefiqPost<T>(
  request: Request,
  action: (payload: unknown) => Promise<T>,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: postHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ message: 'Method not allowed.' }, { status: 405, headers: postHeaders });
  }

  try {
    const payload = await readJsonBody(request);
    const response = await action(payload);
    return Response.json(response, { status: 200, headers: postHeaders });
  } catch (error) {
    const apiError = toBriefiqApiErrorResponse(error);
    return Response.json(apiError.payload, {
      status: apiError.status,
      headers: postHeaders,
    });
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const body = await request.text();

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new BriefiqApiError(400, 'Send a valid JSON request body.');
  }
}
