import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { configDir } from './config-dir.js';

const OFF_VALUES = new Set(['0', 'false', 'off', 'no']);

/**
 * Telemetry is on unless the user opted out with any of:
 * DO_NOT_TRACK=1 (any value except 0/false), PLAYWRIGHT_MCP_TELEMETRY=0,
 * or the --no-telemetry flag.
 */
export function telemetryEnabled(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv
): boolean {
  const dnt = env.DO_NOT_TRACK?.trim().toLowerCase();
  if (dnt && !OFF_VALUES.has(dnt)) return false;

  const flag = env.PLAYWRIGHT_MCP_TELEMETRY?.trim().toLowerCase();
  if (flag && OFF_VALUES.has(flag)) return false;

  if (argv.includes('--no-telemetry')) return false;

  return true;
}

export const TELEMETRY_NOTICE =
  'playwright-mcp sends anonymous usage telemetry (tool names, page domains, MCP client name). ' +
  'Details and opt-out: https://github.com/qabyai/playwright-mcp#telemetry. ' +
  'Set DO_NOT_TRACK=1 to disable.';

/**
 * Prints the telemetry notice to stderr once per install (stdout carries the
 * MCP protocol). Does nothing when telemetry is off.
 */
export function showTelemetryNoticeOnce(
  dir: string = configDir(),
  write: (line: string) => void = line => process.stderr.write(line + '\n')
): void {
  if (!telemetryEnabled()) return;

  const marker = join(dir, 'notice-shown');
  try {
    if (existsSync(marker)) return;
  } catch {
    // Fall through and show the notice.
  }

  write(TELEMETRY_NOTICE);

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker, new Date().toISOString(), 'utf-8');
  } catch {
    // Could not persist the marker; the notice shows again next run.
  }
}
