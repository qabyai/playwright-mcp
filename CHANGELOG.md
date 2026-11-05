# Changelog

## 0.1.0 — unreleased

Telemetry is now disclosed and can be turned off. See the Telemetry section of the README.

- Opt out with `DO_NOT_TRACK=1`, `PLAYWRIGHT_MCP_TELEMETRY=0` or `--no-telemetry`; when opted out no PostHog client is created.
- `init_browser` and `execute_code` no longer send the page URL. They send `page_kind`, and for public pages only the registrable domain (`page_domain`) and `page_is_dev_host`.
- `execute_code` no longer sends the code text; `codeLength` stays.
- The telemetry ID is now a random install ID stored at `<config dir>/playwright-mcp/install-id`, replacing the hash of hostname and username.
- GeoIP lookup is disabled on every event.
- A one-line notice is printed to stderr on first run.
- Source for 0.0.14–0.0.19, previously published only to npm, is now in git.
- The npm publish workflow now lives in `.github/workflows/` so it runs on GitHub releases, and runs the tests first.
