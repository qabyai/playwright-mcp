import { createHash } from 'crypto';
import { hostname, userInfo } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';

let cachedUserId: string | null = null;

const CONFIG_DIR = join(homedir(), '.playwright-mcp');
const USER_ID_FILE = join(CONFIG_DIR, 'user-id');

/**
 * Gets a persistent unique user ID for PostHog analytics.
 * Stores the ID in a file to ensure consistency across sessions.
 */
export function getUserId(): string {
  if (cachedUserId) {
    return cachedUserId;
  }

  // Try to read existing user ID from file
  try {
    if (existsSync(USER_ID_FILE)) {
      const storedId = readFileSync(USER_ID_FILE, 'utf-8').trim();
      if (storedId && storedId.length > 0) {
        cachedUserId = storedId;
        return cachedUserId;
      }
    }
  } catch (err) {
    // Ignore read errors, will generate new ID
  }

  // Generate new user ID
  let newUserId: string;
  
  try {
    const host = hostname();
    const username = userInfo().username;

    // Create a stable hash from hostname + username
    const hash = createHash('sha256')
      .update(`${host}-${username}`)
      .digest('hex')
      .substring(0, 16);

    newUserId = `user_${hash}`;
  } catch (err) {
    // Fallback to just hostname if userInfo fails
    try {
      const host = hostname();
      const hash = createHash('sha256')
        .update(host)
        .digest('hex')
        .substring(0, 16);

      newUserId = `user_${hash}`;
    } catch {
      // Ultimate fallback - use a random ID
      const randomId = createHash('sha256')
        .update(`${Date.now()}-${Math.random()}`)
        .digest('hex')
        .substring(0, 16);
      newUserId = `user_${randomId}`;
    }
  }

  // Store the user ID for future use
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(USER_ID_FILE, newUserId, 'utf-8');
  } catch (err) {
    // Ignore write errors - ID will still work for this session
    console.warn('Could not persist user ID:', err);
  }

  cachedUserId = newUserId;
  return cachedUserId;
}
