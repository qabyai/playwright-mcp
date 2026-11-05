import { isIP } from 'net';
import { parse } from 'tldts';

export type PageKind =
  | 'public'
  | 'local'
  | 'private_ip'
  | 'ip_literal'
  | 'file'
  | 'browser_internal'
  | 'unparsed';

export interface PageInfo {
  page_kind: PageKind;
  /** Registrable domain (Public Suffix List), only for public pages. */
  page_domain?: string;
  page_is_dev_host: boolean;
}

// Mirrors url_bucket() in the paper repo's analysis/01_clean.py.
const BROWSER_INTERNAL = ['about:', 'chrome:', 'edge:', 'data:', 'blob:', 'chrome-extension:'];
const LOCAL_HOSTS = new Set(['localhost', '0.0.0.0', '::1']);
const DEV_MARKERS = new Set([
  'dev', 'staging', 'stage', 'stg', 'test', 'testing', 'qa', 'uat', 'internal',
  'sandbox', 'preprod', 'demo', 'local', 'intranet', 'preview', 'nonprod',
]);

function ipKind(ip: string): 'local' | 'private_ip' | 'ip_literal' {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127 || a === 0) return 'local';
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return 'private_ip';
    }
    return 'ip_literal';
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return 'local';
  if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return 'private_ip';
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipKind(mapped[1]);
  return 'ip_literal';
}

/**
 * Describes a page URL without sending it: its kind, and for public pages
 * only the registrable domain. Paths, queries, ports and local hosts never
 * leave the machine.
 */
export function pageInfo(url: string | undefined | null): PageInfo {
  const none = (page_kind: PageKind): PageInfo => ({ page_kind, page_is_dev_host: false });

  if (!url || !url.trim()) return none('unparsed');
  const s = url.trim();
  const low = s.toLowerCase();

  if (BROWSER_INTERNAL.some(p => low.startsWith(p))) return none('browser_internal');
  if (low.startsWith('file:')) return none('file');

  let host: string;
  try {
    host = new URL(s.includes('://') ? s : `http://${s}`).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return none('unparsed');
  }
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (!host) return none('unparsed');

  if (LOCAL_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.localhost')) {
    return none('local');
  }
  if (isIP(host)) return none(ipKind(host));

  // Private suffixes keep hosted apps distinct (acme.vercel.app); a bare
  // private suffix such as vercel.app falls back to its ICANN domain.
  let parsed = parse(host, { allowPrivateDomains: true });
  if (!parsed.domain) parsed = parse(host);
  // Single-label hosts and unknown TLDs (intranet names such as "jenkins" or
  // "app.corp") are treated as local so their names are never sent.
  if (!parsed.domain || !(parsed.isIcann || parsed.isPrivate)) return none('local');

  const labels = host.split(/[.-]/);
  return {
    page_kind: 'public',
    page_domain: parsed.domain,
    page_is_dev_host: labels.some(l => DEV_MARKERS.has(l)),
  };
}
