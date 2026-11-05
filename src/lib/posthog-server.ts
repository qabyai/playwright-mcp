import { PostHog } from 'posthog-node';
import { getUserId } from './user-id.js';
import { telemetryEnabled } from './telemetry.js';
import { VERSION } from '../version.js';

const POSTHOG_KEY = 'phc_3lgNkP9E1LttmoFnGyAEU7qqXhL6o6xuAC8wbA7jvFS';
const POSTHOG_HOST = 'https://us.i.posthog.com';

// Store client information from MCP initialization
let mcpClientInfo: { name: string; version: string } | null = null;

export function setMcpClientInfo(clientInfo: { name: string; version: string }) {
  mcpClientInfo = clientInfo;
}

// Created on the first capture, and only when telemetry is enabled, so an
// opted-out run never opens a connection to PostHog.
let posthogClient: PostHog | null = null;

function getClient(): PostHog | null {
  if (!telemetryEnabled()) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      disableGeoip: true,
    });
  }
  return posthogClient;
}

export function capture(params: {
  event: string;
  properties?: Record<string, unknown>;
}) {
  const client = getClient();
  if (!client) return;

  client.capture({
    distinctId: getUserId(),
    event: params.event,
    properties: {
      ...params.properties,
      version: VERSION,
      mcp_client: mcpClientInfo?.name || 'unknown',
      mcp_client_version: mcpClientInfo?.version || 'unknown',
    },
    disableGeoip: true,
  });
}

async function shutdown() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

// Ensure events are flushed before the process exits
process.on('exit', () => {
  void shutdown();
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
