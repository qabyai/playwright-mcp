import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthogCtor = vi.fn();
const posthogCapture = vi.fn();

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation((...args: unknown[]) => {
    posthogCtor(...args);
    return { capture: posthogCapture, shutdown: vi.fn() };
  }),
}));
vi.mock('../src/version.js', () => ({ VERSION: '0.0.0-test' }));

const OPT_OUT_KEYS = ['DO_NOT_TRACK', 'PLAYWRIGHT_MCP_TELEMETRY', 'XDG_CONFIG_HOME'] as const;
let saved: Record<string, string | undefined>;
let dir: string;

beforeEach(() => {
  saved = Object.fromEntries(OPT_OUT_KEYS.map(k => [k, process.env[k]]));
  for (const k of OPT_OUT_KEYS) delete process.env[k];
  dir = mkdtempSync(join(tmpdir(), 'pmcp-'));
  process.env.XDG_CONFIG_HOME = dir;
  posthogCtor.mockClear();
  posthogCapture.mockClear();
  vi.resetModules();
});

afterEach(() => {
  for (const k of OPT_OUT_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('telemetryEnabled', () => {
  it('reads the opt-out switches', async () => {
    const { telemetryEnabled } = await import('../src/lib/telemetry');
    expect(telemetryEnabled({}, [])).toBe(true);
    expect(telemetryEnabled({ DO_NOT_TRACK: '1' }, [])).toBe(false);
    expect(telemetryEnabled({ DO_NOT_TRACK: 'true' }, [])).toBe(false);
    expect(telemetryEnabled({ DO_NOT_TRACK: '0' }, [])).toBe(true);
    expect(telemetryEnabled({ PLAYWRIGHT_MCP_TELEMETRY: '0' }, [])).toBe(false);
    expect(telemetryEnabled({ PLAYWRIGHT_MCP_TELEMETRY: 'false' }, [])).toBe(false);
    expect(telemetryEnabled({ PLAYWRIGHT_MCP_TELEMETRY: '1' }, [])).toBe(true);
    expect(telemetryEnabled({}, ['node', 'server.js', '--no-telemetry'])).toBe(false);
  });
});

describe('capture', () => {
  it.each([
    ['DO_NOT_TRACK', '1'],
    ['PLAYWRIGHT_MCP_TELEMETRY', '0'],
  ])('makes no PostHog call when %s=%s', async (key, value) => {
    process.env[key] = value;
    const { capture } = await import('../src/lib/posthog-server');
    capture({ event: 'get_screenshot' });
    expect(posthogCtor).not.toHaveBeenCalled();
    expect(posthogCapture).not.toHaveBeenCalled();
  });

  it('makes no PostHog call with --no-telemetry', async () => {
    process.argv.push('--no-telemetry');
    try {
      const { capture } = await import('../src/lib/posthog-server');
      capture({ event: 'get_screenshot' });
      expect(posthogCtor).not.toHaveBeenCalled();
    } finally {
      process.argv.pop();
    }
  });

  it('sends with GeoIP disabled and a random install ID when enabled', async () => {
    const { capture } = await import('../src/lib/posthog-server');
    capture({ event: 'get_screenshot' });
    expect(posthogCtor).toHaveBeenCalledOnce();
    expect(posthogCtor.mock.calls[0][1]).toMatchObject({ disableGeoip: true });
    const msg = posthogCapture.mock.calls[0][0];
    expect(msg.disableGeoip).toBe(true);
    expect(msg.distinctId).toMatch(/^[0-9a-f-]{36}$/);
    expect(msg.properties).toMatchObject({ version: '0.0.0-test' });
  });
});

describe('install ID', () => {
  it('is stable across runs and changes after the file is deleted', async () => {
    const mod = await import('../src/lib/user-id');
    const idDir = join(dir, 'playwright-mcp');
    const first = mod.getUserId(idDir);
    mod.resetUserIdCache();
    expect(mod.getUserId(idDir)).toBe(first);
    rmSync(join(idDir, 'install-id'));
    mod.resetUserIdCache();
    expect(mod.getUserId(idDir)).not.toBe(first);
  });
});

describe('first-run notice', () => {
  it('is shown once', async () => {
    const { showTelemetryNoticeOnce } = await import('../src/lib/telemetry');
    const lines: string[] = [];
    showTelemetryNoticeOnce(dir, l => lines.push(l));
    showTelemetryNoticeOnce(dir, l => lines.push(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/DO_NOT_TRACK=1/);
  });

  it('is not shown when opted out', async () => {
    process.env.DO_NOT_TRACK = '1';
    const { showTelemetryNoticeOnce } = await import('../src/lib/telemetry');
    const lines: string[] = [];
    showTelemetryNoticeOnce(dir, l => lines.push(l));
    expect(lines).toHaveLength(0);
  });
});
