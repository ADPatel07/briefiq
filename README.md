# BriefIQ

BriefIQ is an AI-native product scoping assistant that turns messy client messages into a structured MVP PRD through an adaptive question-and-answer workflow.

## Quest Submission Links

- Live URL: pending Vercel deployment
- Loom demo: pending recording
- Repository: add public GitHub URL before submitting

## Problem Definition & Target User

Freelancers, FDEs, and small product teams often receive vague client briefs such as "I need an app like Uber for cleaners" or long, scattered messages across chat, notes, and documents. The hardest first step is not coding. It is clarifying what the client really wants, deciding what belongs in the MVP, and turning ambiguous input into a developer-ready scope.

BriefIQ targets:

- Freelancers preparing estimates and project proposals
- Forward deployed engineers turning ambiguous requests into executable specs
- Product owners who need fast MVP scoping before assigning work
- Early-stage founders who have an idea but not a clear requirements document

## Why This Problem Matters

Bad scoping creates expensive rework. A generic AI chat can produce a polished-looking PRD, but it often skips the most important step: asking the right clarification questions first. BriefIQ focuses on the pre-build decision layer, where FDE and APO work is most valuable.

The goal is to help a builder quickly answer:

- What is already known?
- What is still missing?
- What should be assumed?
- What should stay out of the MVP?
- How confident are we in the scope?

## How The Solution Works

1. The user enters a raw project brief, adds notes, uploads lightweight text/spec files, or uses voice input.
2. BriefIQ packages the context into one structured brief.
3. The server calls Gemini with a schema-constrained analysis prompt.
4. The app returns a live project summary and six focused follow-up questions.
5. The user answers, chooses suggested options, or skips unclear questions.
6. BriefIQ tracks facts, gaps, assumptions, and confidence while the conversation progresses.
7. After the final answer, the server generates a structured MVP PRD.
8. The user can export the final handoff as a PDF or README-style Markdown file.

## AI-Native Workflow

BriefIQ uses AI as a workflow layer, not as a single completion call.

- Structured AI analysis: Gemini extracts project type, known facts, likely features, missing details, assumptions, open questions, and follow-up questions.
- JSON schema constraints: prompts request strict JSON so the app can safely render AI output as UI state.
- Adaptive scoping loop: user answers update the summary, assumptions, confidence score, and next decision point.
- AI-assisted PRD synthesis: Gemini generates the final PRD from the original brief, Q&A history, summary, assumptions, and open questions.
- Guardrails and fallback logic: the server sanitizes AI responses and builds a fallback PRD structure when fields are missing.
- Export paths: the final specification can be downloaded as a README-style Markdown file or opened in a print-ready PDF view for client review and developer handoff.

### Tools, Models, And Libraries

- Angular 21 for the web app and SSR server
- Tailwind CSS 4 for styling
- Express through Angular SSR for local API routes
- Vercel Functions for deployed `/api/briefiq/*` endpoints
- Gemini API for analysis and PRD generation
- Default configured model: `gemini-2.5-flash-lite`
- Vitest/Angular test target is configured, but no automated specs are currently included

## Evaluation Method & Results

Evaluation focused on whether BriefIQ improves the quality of an initial project scope compared with directly asking a general AI assistant for a PRD.

### Test Scenario

Input brief:

> I need an app like Uber but simpler for local home cleaning bookings. Customers should be able to book a cleaner for a specific time, pay via credit card, and see their cleaning schedule. Cleaners should have a simple list of bookings they can accept.

### What Was Checked

- The app rejects briefs that are too short to scope usefully.
- The app asks clarification questions before generating the PRD.
- The summary separates known facts, missing details, and assumptions.
- Skipped answers are tracked as assumptions.
- The final PRD puts build confidence, complexity, timeline, and client sign-off items at the top.
- The final PRD includes MVP scope, out-of-scope items, assumptions, scoping factors, and next steps without repeating the same information in multiple sections.
- The generated output is exportable as PDF or README-style Markdown.

### Current Verification Results

- TypeScript compile check: passed with `npx.cmd tsc -p tsconfig.app.json --noEmit`
- Production build: passed with `npm.cmd run build`
- Automated tests: not available yet because no `*.spec.ts` files exist
- Manual live deployment check: pending Vercel deployment
- Loom walkthrough: pending recording

## Baseline Comparison

If someone pastes the same vague brief directly into ChatGPT or Claude and asks for a PRD, the result is usually fast but under-validated. It tends to invent scope, hide assumptions, and skip the client's missing decisions.

BriefIQ improves the baseline by:

- Forcing a clarification loop before PRD generation
- Showing what is known versus missing while scoping
- Tracking assumptions explicitly when the user skips answers
- Producing a confidence score based on skipped answers, assumptions, and open questions
- Keeping the final PRD tied to the original brief and Q&A history

The tradeoff is that BriefIQ takes a few extra minutes compared with a one-shot prompt, but the resulting spec is safer to estimate and hand off.

## Limitations

- No authentication or saved project history yet
- File upload currently handles text-like files directly and stores metadata for unsupported binary files
- Voice input depends on browser Web Speech API support
- The app depends on a server-side Gemini API key
- No automated regression test suite has been added yet
- The current evaluation is manual and scenario-based, not a large benchmark

## Next Iteration Ideas

- Add saved scoping sessions and shareable PRD links
- Add PDF/DOCX extraction for real client documents
- Add side-by-side baseline comparison inside the app
- Add a scoring rubric for PRD quality
- Add automated tests for brief validation, confidence scoring, and PRD fallback logic
- Add export formats for DOCX, Linear, Jira, and Notion

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

Build for production:

```bash
npm run build
```

## Deployment Notes

This project builds as an Angular SSR app with an Express API server locally and Vercel Functions in `api/briefiq` for production API routing. The Vercel functions are configured in `vercel.json` with a 30-second maximum duration for Gemini requests. On Vercel, configure the Gemini key as an environment variable:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` set to `gemini-2.5-flash-lite` unless you intentionally choose another Gemini model

The deployed analyzer uses `POST /api/briefiq/analyze`, and PRD generation uses `POST /api/briefiq/prd`. If Vercel returns `405 Method Not Allowed`, confirm the latest deployment includes the root `api/briefiq` directory.

After deployment, update the live URL and Loom link at the top of this README.
