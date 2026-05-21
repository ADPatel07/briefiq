# BriefIQ

BriefIQ is an AI-native product scoping assistant that turns messy client briefs, notes, lightweight files, and voice input into a clarified MVP PRD. It is built for the first hard step in FDE/APO work: converting ambiguity into a practical, developer-ready scope before implementation starts.

## Submission Links

- Live app: https://briefiq-angular.vercel.app/
- Loom demo: https://www.loom.com/share/30ac0e5e07314c2ebd4181a6febef861
- Live API health check: https://briefiq-angular.vercel.app/api/briefiq/health
- Repository: this public GitHub repository

## Quest Readiness Check

Checked on May 21, 2026.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Real problem and target user | Done | Focuses on vague client briefs for freelancers, FDEs, APOs, small teams, and founders. |
| Working AI-native prototype | Done | Uses Gemini for structured brief analysis, adaptive questions, and final PRD generation. |
| Meaningful AI workflow | Done | Multi-step scoping loop, JSON schemas, custom prompts, sanitizer guardrails, confidence scoring, assumptions, and open-question tracking. |
| Deployed live URL | Done | Vercel app responds with `200 OK`. |
| Loom walkthrough | Done | Loom share link responds with `200 OK`. |
| README sections requested by quest | Done | Problem, why it matters, solution, AI workflow, evaluation, baseline, limitations, and next iterations are documented below. |
| BUILD_LOG/self-review | Done | `BUILD_LOG.md` records the 24-hour journey, tools, prompts, failures, rejected scope, and latest verification. |
| Evaluation and results | Done | Local tests/build pass, live API health passes, and a live analyzer request returns adaptive scoping output. |

Remaining product gaps are listed under [Limitations](#limitations). They are not blockers for Quest 1, but they are the next things to address before calling this production-ready.

## Problem Definition and Target User

Freelancers, FDEs, APOs, and small product teams often receive unclear client messages like "I need an Uber-like app for cleaners" or scattered requirements across chat, notes, and documents. The main risk is not the first line of code. The risk is starting from a weak scope, silently inventing missing decisions, and producing estimates or PRDs that look confident but are not validated.

BriefIQ targets:

- Freelancers preparing estimates and client proposals
- Forward deployed engineers turning ambiguous requests into executable specs
- AI-native product owners deciding what belongs in an MVP
- Early-stage founders who have an idea but no structured requirements document

## Why This Problem Matters

Bad scoping causes rework, missed expectations, and slow delivery. A one-shot ChatGPT or Claude prompt can generate a clean-looking PRD, but it often skips the clarification step that makes the scope reliable.

BriefIQ is designed around the decision layer:

- What is already known?
- What is still missing?
- What assumptions are being made?
- What should stay out of the MVP?
- How ready is this scope for estimation and implementation?

That maps closely to the FDE/APO JD: define the right problem, use AI as leverage, ship quickly, measure whether it works, and own the outcome end to end.

## How The Solution Works

1. The user enters a raw brief, chooses a starter template, adds notes, uploads lightweight text/spec files, or uses voice input.
2. BriefIQ bundles all context into one structured brief.
3. The server calls Gemini with a schema-constrained analysis prompt.
4. The app returns a project summary, known facts, likely features, missing details, open questions, and adaptive follow-up questions.
5. The user answers, chooses quick options, uses voice input, or skips unclear questions.
6. Skipped answers become explicit assumptions instead of hidden guesses.
7. BriefIQ updates confidence, facts, gaps, assumptions, and open questions as the Q&A progresses.
8. The server generates a final MVP PRD from the original brief, Q&A history, live summary, assumptions, and unresolved questions.
9. The user can export the final handoff as print-ready PDF or README-style Markdown.

## AI-Native Workflow

BriefIQ uses AI as a workflow system, not a single text completion.

- Structured analysis: Gemini extracts project type, known facts, likely features, missing details, assumptions, open questions, and follow-up questions.
- Adaptive questioning: the model decides between 2 and 6 follow-up questions based on the actual gaps in the brief.
- Custom prompts: the analysis prompt forbids early PRD generation and prioritizes estimation blockers such as users, workflow, permissions, payments, timeline, budget, integrations, and success criteria.
- JSON schema constraints: Gemini is asked for strict JSON so the Angular UI can render AI output as typed application state.
- Guardrails: server-side sanitizers normalize missing or malformed AI fields and keep the app usable even when the model response is incomplete.
- Evaluation loop: confidence scoring penalizes unanswered questions, skipped answers, assumptions, open questions, and required client sign-off items.
- PRD synthesis: Gemini generates the final PRD, but the confidence score and client clarification rules are enforced by application logic.

### Tools, Models, APIs, and Open Source

- Angular 21.2.x application with SSR
- Tailwind CSS 4.1.x through PostCSS
- Express through Angular SSR for local API routing
- Vercel Functions for deployed `/api/briefiq/*` endpoints
- Google Gemini API for brief analysis and PRD generation
- Configurable model through `GEMINI_MODEL`
- Repo fallback model: `gemini-2.5-flash-lite`
- Current Vercel environment, verified through `/api/briefiq/health`: `gemini-3.1-flash-lite`
- RxJS, Vitest, jsdom, TypeScript, and Angular build tooling
- AI tools used during build: ChatGPT, Claude, Codex, and Antigravity

## Evaluation Method and Results

The evaluation checks whether BriefIQ creates a safer scope than directly asking a general AI assistant for a PRD from a vague brief.

### Test Scenario

Input brief:

> I need an app like Uber but simpler for local home cleaning bookings. Customers should be able to book a cleaner for a specific time, pay via credit card, and see their cleaning schedule. Cleaners should have a simple list of bookings they can accept.

### What Was Checked

- Rejects briefs that are too short to scope usefully.
- Asks clarification questions before generating the PRD.
- Uses a dynamic number of follow-up questions instead of always asking six.
- Separates known facts, gaps, assumptions, and open questions.
- Tracks skipped answers as assumptions.
- Keeps confidence below 100 percent until client sign-off.
- Penalizes confidence when client clarifications remain.
- Keeps final PRD sections focused and avoids repeating timeline, confidence, and complexity everywhere.
- Exports final output as PDF or README-style Markdown.
- Deployed app and API routes respond correctly.

### Latest Verification Results

- Unit/regression tests: passed with `npm.cmd test -- --watch=false` - 2 files, 10 tests.
- Production build: passed with `npm.cmd run build`.
- Live homepage: `200 OK` from `https://briefiq-angular.vercel.app/`.
- Live API health: `200 OK`, service `briefiq-api`, Gemini key present.
- Live analyzer endpoint: `POST /api/briefiq/analyze` returned `canStart: true` and adaptive scoping output for the cleaning-booking scenario.
- Loom page: `200 OK` from the submitted share link.

## Baseline Comparison

Baseline: paste the same vague brief into ChatGPT or Claude and ask for a PRD.

That baseline is fast, but it usually:

- Invents missing details without labeling them as assumptions
- Skips the clarification workflow
- Produces a PRD that looks more certain than the input deserves
- Does not keep client sign-off items visible
- Does not provide a repeatable scoping UI or export path

BriefIQ improves the baseline by:

- Forcing clarification before PRD generation
- Showing known facts, gaps, assumptions, and open questions while scoping
- Tracking skipped answers explicitly
- Calculating build readiness from the actual Q&A state
- Keeping final output tied to the original brief and answer history

The tradeoff is that BriefIQ takes a few extra minutes compared with a one-shot prompt, but the result is safer to estimate, review, and hand off.

## Limitations

- No authentication or saved project history yet.
- File upload directly reads text-like files; PDF/DOCX content is represented as metadata instead of true document extraction.
- Voice input depends on browser Web Speech API support and includes a fallback simulation when unsupported.
- The app depends on a server-side Gemini API key.
- Evaluation is scenario-based and regression-test based, not a large benchmark.
- No side-by-side in-app baseline comparison yet.
- No export to DOCX, Jira, Linear, or Notion yet.

## Next Iteration Ideas

- Add saved scoping sessions and shareable PRD links.
- Add real PDF/DOCX extraction for client documents.
- Add side-by-side baseline comparison inside the app.
- Add a PRD-quality scoring rubric with more evaluation cases.
- Add e2e tests for the full browser flow.
- Add export formats for DOCX, Linear, Jira, and Notion.
- Add project history and optional authentication.

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
```

Run locally:

```bash
npm start
```

Run tests:

```bash
npm test -- --watch=false
```

Build for production:

```bash
npm run build
```

## Deployment Notes

This project builds as an Angular SSR app with an Express API server locally and Vercel Functions in `api/briefiq` for production API routing. The Vercel functions are configured in `vercel.json` with a 30-second maximum duration for Gemini requests.

Required Vercel environment variables:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` if overriding the repo fallback model

Production routes:

- `GET /api/briefiq/health`
- `POST /api/briefiq/analyze`
- `POST /api/briefiq/prd`
