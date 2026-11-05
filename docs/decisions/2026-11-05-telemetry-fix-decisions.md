# Decisions: telemetry disclosure and opt-out

Format: what → choice → why → cost if wrong.

1. **What leaves the machine** → Registrable domain of public pages + `page_kind` + `page_is_dev_host`; no `code`, no full URL, no IP → Himanshu chose "domain only, disclosed" (2026-11-05, paper decision 19); keeps company attribution and every paper bucket → Users who object to domains opt out; deep-subdomain attributions collapse to the company domain.
2. **Source of truth for 0.0.19** → Ashish's local commits if they exist, else import `src/` from the npm tarball → Neither GitHub remote has anything after 0.0.13; the tarball ships `src/` → An import loses commit history for 0.0.14–0.0.19; acceptable.
3. **Opt-out names** → `DO_NOT_TRACK=1`, `PLAYWRIGHT_MCP_TELEMETRY=0`, `--no-telemetry` → `DO_NOT_TRACK` is the cross-tool convention; a package-named variable is what users search for → Renaming later means honouring both names.
4. **Domain parsing** → `tldts` (Public Suffix List) → Keeps `acme.vercel.app` distinct from `vercel.app`; small, no network → Adds a dependency; the list ages, so bump it with releases.
5. **Install ID** → Random UUID under the config dir (XDG / `~/.config` / `%APPDATA%`), per-process random fallback → Not reversible to a person; survives `npx` and upgrades → Reinstalls or wiped configs split identities, slightly inflating identity counts.
6. **Test runner** → Vitest → Vite is already in the toolchain; repo has no tests today → None significant.
7. **Release version** → 0.1.0, not 0.0.20 → Makes the disclosure boundary obvious in the `version` field for the paper and the sales report → None.
8. **Publishing** → Move the workflow into `.github/workflows/` and publish from GitHub releases → The current file location never runs, which is how npm drifted from git → If Ashish prefers manual publishes, at least tag each release in git.
