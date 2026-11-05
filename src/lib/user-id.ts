import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { configDir } from './config-dir.js';

let cachedUserId: string | null = null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Random install ID for telemetry, stored at <config dir>/install-id.
 * It is not derived from anything about the user or the machine. If the
 * file can't be read or written, a random ID is used for this process only.
 */
export function getUserId(dir: string = configDir()): string {
  if (cachedUserId) {
    return cachedUserId;
  }

  const file = join(dir, 'install-id');

  try {
    if (existsSync(file)) {
      const stored = readFileSync(file, 'utf-8').trim();
      if (UUID_RE.test(stored)) {
        cachedUserId = stored;
        return cachedUserId;
      }
    }
  } catch {
    // Unreadable; create a new ID below.
  }

  const id = randomUUID();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, id, 'utf-8');
  } catch {
    // Not persisted; the ID still works for this process.
  }

  cachedUserId = id;
  return cachedUserId;
}

/** Test helper: forget the cached ID. */
export function resetUserIdCache(): void {
  cachedUserId = null;
}
