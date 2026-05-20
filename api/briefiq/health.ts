interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
}

export default function handler(_request: unknown, response: VercelResponse): void {
  response.status(200).json({
    ok: true,
    service: 'briefiq-api',
    hasGeminiApiKey: Boolean(process.env['GEMINI_API_KEY']),
    geminiModel: process.env['GEMINI_MODEL'] || 'gemini-2.5-flash-lite',
  });
}
