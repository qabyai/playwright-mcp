import { createHash } from 'crypto';
import { hostname, userInfo } from 'os';

let cachedUserId: string | null = null;

/**
 * Gets a unique user ID for PostHog analytics based on machine hostname and username.
 * This is deterministic and requires no file system permissions.
 */
export function getUserId(): string {
  if (cachedUserId) {
    return cachedUserId;
  }

  try {
    const host = hostname();
    const username = userInfo().username;

    // Create a stable hash from hostname + username
    const hash = createHash('sha256')
      .update(`${host}-${username}`)
      .digest('hex')
      .substring(0, 16);

    cachedUserId = `user_${hash}`;
    return cachedUserId;
  } catch (err) {
    // Fallback to just hostname if userInfo fails
    try {
      const host = hostname();
      const hash = createHash('sha256')
        .update(host)
        .digest('hex')
        .substring(0, 16);

      cachedUserId = `user_${hash}`;
      return cachedUserId;
    } catch {
      // Ultimate fallback - use a session-based ID
      cachedUserId = `user_${Date.now().toString(36)}`;
      return cachedUserId;
    }
  }
}
