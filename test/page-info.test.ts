import { describe, expect, it } from 'vitest';
import { pageInfo } from '../src/lib/page-info';

describe('pageInfo', () => {
  it.each([
    ['http://localhost:3000/login?next=/a', { page_kind: 'local', page_is_dev_host: false }],
    ['http://127.0.0.1:8080', { page_kind: 'local', page_is_dev_host: false }],
    ['http://[::1]:5173/', { page_kind: 'local', page_is_dev_host: false }],
    ['http://myapp.local/', { page_kind: 'local', page_is_dev_host: false }],
    ['http://jenkins:8080/job/x', { page_kind: 'local', page_is_dev_host: false }],
    ['http://10.0.0.5/admin', { page_kind: 'private_ip', page_is_dev_host: false }],
    ['http://192.168.1.10', { page_kind: 'private_ip', page_is_dev_host: false }],
    ['http://8.8.8.8/', { page_kind: 'ip_literal', page_is_dev_host: false }],
    ['file:///Users/me/report.html', { page_kind: 'file', page_is_dev_host: false }],
    ['about:blank', { page_kind: 'browser_internal', page_is_dev_host: false }],
    ['chrome://settings', { page_kind: 'browser_internal', page_is_dev_host: false }],
    ['https://staging.acme.com/a', { page_kind: 'public', page_domain: 'acme.com', page_is_dev_host: true }],
    ['https://acme.vercel.app/dashboard', { page_kind: 'public', page_domain: 'acme.vercel.app', page_is_dev_host: false }],
    ['https://vercel.app/', { page_kind: 'public', page_domain: 'vercel.app', page_is_dev_host: false }],
    ['https://shop.example.co.uk/', { page_kind: 'public', page_domain: 'example.co.uk', page_is_dev_host: false }],
    ['https://app-qa.acme.io/', { page_kind: 'public', page_domain: 'acme.io', page_is_dev_host: true }],
    ['https://www.example.com/a?token=secret&email=x@y.com#f', { page_kind: 'public', page_domain: 'example.com', page_is_dev_host: false }],
    ['http://', { page_kind: 'unparsed', page_is_dev_host: false }],
    ['', { page_kind: 'unparsed', page_is_dev_host: false }],
    [undefined, { page_kind: 'unparsed', page_is_dev_host: false }],
  ])('%s', (url, expected) => {
    expect(pageInfo(url)).toEqual(expected);
  });

  it('never returns the path, query or full host', () => {
    const out = JSON.stringify(pageInfo('https://staging.acme.com/users/42?token=abc'));
    expect(out).not.toMatch(/token|users|abc|staging/);
  });
});
