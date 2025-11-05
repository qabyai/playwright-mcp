import { PostHog } from 'posthog-node';

export const posthogServer = new PostHog(
  'phc_3lgNkP9E1LttmoFnGyAEU7qqXhL6o6xuAC8wbA7jvFS',
  {
    host: 'https://us.i.posthog.com'
  }
);

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
