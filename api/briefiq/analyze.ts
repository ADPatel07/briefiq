import { analyzeBriefPayload } from '../../src/app/briefiq/briefiq-ai.server';
import type {
  BriefiqVercelRequest,
  BriefiqVercelResponse,
} from '../../src/app/briefiq/briefiq-vercel-handler';
import { handleBriefiqPost } from '../../src/app/briefiq/briefiq-vercel-handler';

export default function handler(
  request: BriefiqVercelRequest,
  response: BriefiqVercelResponse,
): Promise<void> {
  return handleBriefiqPost(request, response, analyzeBriefPayload);
}
