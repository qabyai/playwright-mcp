import { homedir } from 'os';
import { join } from 'path';

/**
 * Per-user config directory for playwright-mcp:
 * $XDG_CONFIG_HOME, else %APPDATA% on Windows, else ~/.config.
 */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const base =
    env.XDG_CONFIG_HOME ||
    (process.platform === 'win32' && env.APPDATA) ||
    join(homedir(), '.config');
  return join(base, 'playwright-mcp');
}
