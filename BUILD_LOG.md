# BriefIQ Build Log

Honest record of my 24-hour build journey for Quest 1.

## 1. Planning The Idea

I spent around 4-5 hours discussing the idea with Claude and ChatGPT before building the final version.

At first, the idea was too broad: an AI PRD generator. After several discussions, I narrowed it down to BriefIQ: an AI scoping assistant that asks clarification questions before generating a PRD.

After the idea became clearer, I created the Angular project manually and prepared `AGENTS.md` before starting implementation with Codex. I added project instructions there so Codex would follow the expected Angular structure, use Tailwind, keep the code simple, and review the existing codebase before making changes.

Key questions I explored with AI:

- What real problem should this solve?
- Who is the target user?
- What should the user flow be?
- What tech stack should I use?
- What should be in the MVP?
- What should I avoid building in the first version?
- How can the AI workflow be more than just one API call?

## 2. Key Decisions

- Build a scoping assistant, not just a PRD generator.
- Ask follow-up questions before creating the final PRD.
- Keep the flow short so it can be completed in a demo.
- Track assumptions when the user skips an answer.
- Show a confidence score so the PRD does not look more certain than it really is.
- Export the final PRD as PDF or README-style Markdown.

## 3. Prompts I Used

I used many prompts with Claude and ChatGPT during planning and building. Some examples of the prompt direction:

- Help me define the PRD for an AI tool that turns vague client briefs into clear MVP scope.
- Suggest the best user flow for a freelancer/FDE scoping assistant.
- What should be the MVP and what should be out of scope?
- Design an AI workflow that asks clarification questions before generating the PRD.
- Improve this Angular UI but keep it clean and less noisy.
- Fix this API/response handling issue and make the output reliable.
- Make the input field, loading state, and final PRD page more readable.

Most prompts were small and iterative. I changed one part, tested it, then asked AI to improve the next part.

I also used ChatGPT to improve my own prompts and instructions before sending them to coding tools. For example, I used it to make my requests clearer for code generation, UI refinement, debugging, and project structure decisions.

## 4. Tools I Used

I have not manually written the code line by line so far. My main work was deciding the product direction, writing/refining prompts, reviewing outputs, testing the app, identifying what was wrong, and asking the AI tools to improve it.

Tools used:

- Claude and ChatGPT for idea discussion, PRD planning, and product decisions.
- ChatGPT for improving prompts and code-writing instructions.
- Manual project setup before using Codex.
- `AGENTS.md` for giving Codex coding rules and implementation context.
- Codex for building the main app logic and code structure.
- Antigravity for improving the UI and visual polish.

## 5. Version 1

The first version was only a rough prototype.

What worked:

- The basic idea was visible.
- The user could enter a brief.

What failed:

- It felt like a normal AI text generator.
- The scoping process was not clear.
- The output was not strong enough for submission.

I decided not to continue with this version because the base was weak.

## 6. Version 2

The second version improved the concept, but it still had many problems.

Main issues:

- API calls were not working reliably.
- Responses were taking too much time.
- The UI looked messy.
- The layout was not user-friendly.
- There was too much noise on the screen.
- The final output was not easy to read.

This version helped me realize that the app needed a simpler and clearer flow.

## 7. Version 3

The third version became the final base.

What improved:

- The flow became clearer.
- The app asked follow-up questions before PRD generation.
- The layout was cleaner.
- The final PRD page became more structured.
- The final page was later tightened so confidence, timeline, complexity, and client sign-off items appear at the top.

But the API still had problems at first. I fixed the Gemini API call, response handling, timeout behavior, and server-side sanitization so the app could work more reliably.

## 8. What AI Did Well

- Helped me shape the idea into a clearer product.
- Helped prepare the PRD and user flow.
- Suggested useful MVP boundaries.
- Helped write and refine prompts for the AI workflow.
- Helped debug API and response-shape issues.
- Helped improve UI step by step.
- Codex helped build the main application logic faster than I could manually write it.
- Antigravity helped improve the UI direction and visual details.

## 9. Where AI Failed

- It suggested too many features too early.
- Some UI suggestions looked good but made the product noisy.
- Some generated code did not work correctly on the first try.
- API response handling needed manual checking and fixes.
- It sometimes made the product feel like a generic PRD generator instead of a scoping assistant.
- Some prompts were not clear enough at first, so I had to improve the instructions before getting better output.

## 10. What I Rejected

I rejected or postponed:

- Login/authentication
- Saved project history
- DOCX export
- Team collaboration
- Too many dashboard panels
- Extra integrations
- A one-click PRD generator flow

These ideas were useful, but not required for the 24-hour MVP.

## 11. What I Improved Through Review And Prompts

After the third version started working, I focused on small improvements through review, testing, and better prompts. I did not manually code these changes line by line; I guided Codex and Antigravity to make the improvements.

- Fixed API flow and response handling.
- Improved the input field.
- Added better loading states.
- Made the Q&A screen cleaner.
- Reduced visual noise.
- Improved final PRD readability.
- Added a clearer "Clarify With Client" section before implementation.
- Removed repeated confidence, complexity, and timeline details from lower sections.
- Added assumptions for skipped answers.
- Added confidence scoring.
- Added PDF export and README-style Markdown export.

Later review found a few scoring issues:

- Confidence sometimes stayed around 61% because assumptions and open questions were not being updated correctly.
- The app always asked 6 follow-up questions, even when fewer were enough.
- Confidence could become too high, including 100% or 95%, while client clarifications still remained.

I fixed this by making follow-up questions dynamic, making confidence depend on unanswered questions, skipped answers, assumptions, open questions, and "Clarify With Client" items, and adding regression tests for these cases.

## 12. Final Result

The final version is a working AI-native prototype deployed on Vercel.

It is not production-complete, but it shows the full journey: defining the problem, using AI to plan and build, rejecting extra scope, fixing failures, improving the UI, and shipping a usable product.
