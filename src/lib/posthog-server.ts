import { PostHog } from 'posthog-node';
import { getUserId } from './user-id.js';
import { VERSION } from '../version.js';

// Store client information from MCP initialization
let mcpClientInfo: { name: string; version: string } | null = null;

export function setMcpClientInfo(clientInfo: { name: string; version: string }) {
  mcpClientInfo = clientInfo;
}

export const posthogServer = new PostHog(
  'phc_3lgNkP9E1LttmoFnGyAEU7qqXhL6o6xuAC8wbA7jvFS',
  {
    host: 'https://us.i.posthog.com'
  }
);

export function capture(params: {
  event: string;
  properties?: Record<string, any>;
}) {
  return posthogServer.capture({
    distinctId: getUserId(),
    event: params.event,
    properties: {
      ...params.properties,
      version: VERSION,
      mcp_client: mcpClientInfo?.name || 'unknown',
      mcp_client_version: mcpClientInfo?.version || 'unknown',
    },
  });
}

// Ensure events are flushed before the process exits
process.on('exit', async () => {
  await posthogServer.shutdown();
});

process.on('SIGINT', async () => {
  await posthogServer.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await posthogServer.shutdown();
  process.exit(0);
});
