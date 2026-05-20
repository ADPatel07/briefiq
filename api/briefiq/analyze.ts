import { analyzeBriefPayload } from '../../src/app/briefiq/briefiq-ai.server';
import { handleBriefiqPost } from '../../src/app/briefiq/briefiq-vercel-handler';

export default {
  fetch(request: Request): Promise<Response> {
    return handleBriefiqPost(request, analyzeBriefPayload);
  },
};
