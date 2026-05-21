# BriefIQ Build Log

Honest record of the 24-hour Quest 1 build journey for BriefIQ.

## 1. Starting Point

I spent around 4-5 hours before implementation discussing the idea with Claude and ChatGPT. The first concept was too broad: a generic AI PRD generator. After several rounds, I narrowed it to a more specific and useful problem:

BriefIQ should help builders clarify vague client briefs before generating a PRD.

That direction felt stronger because it targets the real failure point in FDE/APO work: not writing a document, but deciding what should be built, what is missing, and what should stay out of the MVP.

## 2. Key Product Decisions

- Build a scoping assistant, not a one-click PRD generator.
- Ask follow-up questions before creating the final PRD.
- Keep the flow short enough for a demo and a real client intake.
- Track skipped answers as assumptions.
- Show confidence so the final PRD does not look more certain than the input.
- Keep client sign-off items visible before implementation.
- Export the final PRD as PDF or README-style Markdown.

## 3. Prompts and AI Direction

I used many small prompts with Claude, ChatGPT, Codex, and Antigravity instead of one large prompt. The main prompt themes were:

- Help me define a real problem for an AI-native FDE/APO quest.
- Turn vague client briefs into a scoped MVP workflow.
- Suggest what belongs in the MVP and what should be rejected.
- Design an AI workflow that asks clarification questions before generating a PRD.
- Make the AI output structured enough for an Angular UI.
- Improve the UI while keeping it focused and less noisy.
- Fix API response handling and make Gemini output safer to consume.
- Improve confidence scoring so it does not overclaim readiness.

I also used ChatGPT to improve my own prompts and instructions before sending them to coding tools.

## 4. Tools Used

- ChatGPT and Claude for idea shaping, user-flow planning, prompt refinement, and product critique.
- Codex for implementing the Angular app, API logic, data models, sanitizers, tests, and documentation updates.
- Antigravity for UI polish and layout refinement.
- Gemini API for the live AI analysis and PRD generation workflow.
- Angular, Tailwind CSS, TypeScript, Express, Vercel Functions, Vitest, and jsdom.
- `AGENTS.md` to keep the coding agent aligned with Angular structure, Tailwind-first styling, simplicity, and review-before-edit behavior.

I did not manually write most of the code line by line. My main work was product direction, prompts, review, testing, accepting/rejecting outputs, and deciding what the prototype should prove.

## 5. Iteration History

### Version 1

What worked:

- The user could enter a brief.
- The basic concept was visible.

What failed:

- It felt like a normal AI text generator.
- The scoping workflow was weak.
- The output was not strong enough for a portfolio submission.

Decision: reject the generic PRD-generator direction.

### Version 2

What improved:

- The idea moved closer to client intake and product scoping.
- The UI had more structure.

What failed:

- API calls were unreliable.
- Responses took too long.
- The UI had too much noise.
- The final output was still hard to review.

Decision: simplify the flow and make the Q&A step the core product.

### Version 3

What became the final base:

- Adaptive follow-up questions before PRD generation.
- Cleaner brief input, Q&A screen, loading states, and final PRD view.
- Live summary with facts, gaps, and assumptions.
- Confidence scoring.
- Client clarification section before implementation.
- PDF export and README-style Markdown export.
- Vercel deployment with API routes.

Later review found issues where confidence could stay too flat or become too high while clarifications still remained. I fixed this by making follow-up questions dynamic, making confidence depend on unanswered questions, skipped answers, assumptions, open questions, and client sign-off items, and adding regression tests.

## 6. What AI Did Well

- Helped narrow the product from generic PRD generation into AI-native scoping.
- Suggested useful MVP boundaries.
- Helped design the analysis prompt, PRD prompt, and structured response shape.
- Implemented Angular components, server helpers, Vercel routes, and export utilities quickly.
- Helped debug Gemini response handling, timeout behavior, and sanitization.
- Improved the UI through multiple small iterations.
- Helped add regression tests for confidence scoring and PRD sanitization.

## 7. Where AI Failed

- Suggested too many features too early.
- Sometimes made the product feel like a generic generator instead of a scoping assistant.
- Some UI suggestions looked polished but made the workflow noisier.
- Some generated code did not work on the first try.
- API response handling needed careful review because model output can be incomplete or malformed.
- Confidence scoring needed manual product judgment so the app would not overstate readiness.

## 8. What I Rejected or Postponed

- Login/authentication
- Saved project history
- Team collaboration
- DOCX export
- Real PDF/DOCX extraction
- Jira, Linear, and Notion integrations
- Too many dashboard panels
- A one-click PRD generator flow

These could be useful later, but they were not needed to prove the Quest 1 prototype.

## 9. Final Verification

Latest check completed on May 21, 2026.

- Live app: https://briefiq-angular.vercel.app/ returned `200 OK`.
- Loom demo: https://www.loom.com/share/30ac0e5e07314c2ebd4181a6febef861 returned `200 OK`.
- Live health endpoint: `/api/briefiq/health` returned `200 OK`, `ok: true`, Gemini key present, and model `gemini-3.1-flash-lite`.
- Live analyzer endpoint: `POST /api/briefiq/analyze` returned `canStart: true` and adaptive scoping output for the cleaning-booking test brief.
- Tests: `npm.cmd test -- --watch=false` passed with 2 spec files and 10 tests.
- Build: `npm.cmd run build` passed.

## 10. Final Result

The final version is a deployed AI-native prototype that demonstrates the full Quest 1 loop:

- Define a real problem.
- Use AI to plan, build, and iterate.
- Build an AI workflow that does more than one API call.
- Deploy a working product.
- Evaluate the result against a baseline.
- Document the journey honestly.

It is not production-complete, but it is submission-ready for the quest and aligned with the FDE/APO JD focus on ambiguity, prioritization, AI leverage, rapid shipping, and outcome ownership.
