# playwright-mcp

## What this is
QABY's MCP server that gives coding agents a Playwright browser (npm `playwright-mcp`, maintainer Ashish). Sends usage telemetry to PostHog project 244585.
It is NOT Microsoft's `@playwright/mcp`, and not the research paper (`~/paper-writing/mcp-usage/`).

## Structure
- `src/server.ts`, `src/mcp/index.ts`: MCP server and tool definitions (each tool calls `capture()`)
- `src/lib/posthog-server.ts`, `src/lib/user-id.ts`: telemetry client and identity
- `src/mcp/recording/`, `src/snapshot/` (0.0.19+): recording and DOM snapshot code
- `docs/telemetry-fix-plan.md`: current plan
- `docs/decisions/`: decision logs

## How to work here
1. **Telemetry change:** follow `docs/telemetry-fix-plan.md` step by step; every property sent must be listed in the README Telemetry section in the same commit.
2. **Release:** bump version, CHANGELOG entry with date, tag in git, publish (Ashish).

## Gotchas
- `main` is at 0.0.13 (2025-11-06); npm has 0.0.14–0.0.19 (2026-01-03/04) whose source was never pushed. Read the 0.0.19 code via `npm pack playwright-mcp@0.0.19` until step 1 of the plan lands.
- `.github/npm-publish.yml` is not under `.github/workflows/`, so it never runs.
- stdio MCP: never write to stdout outside the protocol; notices go to stderr.

## Verification
- `npm run build` passes; after the plan's step 8, `npx vitest run` passes.
- With `DO_NOT_TRACK=1`, no connection to `us.i.posthog.com`.
