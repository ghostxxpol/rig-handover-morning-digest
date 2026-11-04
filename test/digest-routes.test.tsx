import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };
// runs/ is read-only: every case that needs its own file uses a temp dir.
function tempRuns(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return createApp({ ...base, runsDir: dir });
}
const real = createApp({ ...base, runsDir: 'runs' });
const GOOD = '{"at":"2026-01-03T01:00:00Z","job":"a/job","status":"ok","owner":"rook"}\n';

describe('GET /digest/:night', () => {
  it('renders 2026-10-28: 200, the five jobs, retries and fail marked', async () => {
    const res = await real.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']) {
      expect(html).toContain(job);
    }
    expect(html).toContain('3 ⚠ retries');
    expect(html).toContain('>fail<');
    expect(html).toContain('—'); // the null owner
  });

  it('404 for a night with no file and for a malformed night', async () => {
    expect((await real.request('/digest/2020-01-01')).status).toBe(404);
    expect((await real.request('/digest/nope')).status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    const res = await tempRuns({ '2026-01-02.jsonl': '' }).request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and says how many were skipped', async () => {
    const res = await tempRuns({ '2026-01-03.jsonl': `${GOOD}not json\n` }).request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain('1 unreadable lines skipped');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows as JSON, the same jobs in the same order as the page', async () => {
    const res = await real.request('/api/digest/2026-10-28');
    const body = (await res.json()) as { night: string; badLines: number; rows: { job: string }[] };
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    const page = await (await real.request('/digest/2026-10-28')).text();
    const positions = body.rows.map((r) => page.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('404 with JSON for a night with no file', async () => {
    const res = await real.request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns rows: [] for an empty file', async () => {
    const res = await tempRuns({ '2026-01-02.jsonl': '' }).request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', badLines: 0, rows: [] });
  });

  it('counts the bad line and keeps the good row', async () => {
    const res = await tempRuns({ '2026-01-03.jsonl': `${GOOD}not json\n` }).request('/api/digest/2026-01-03');
    const body = (await res.json()) as { badLines: number; rows: { job: string }[] };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job']);
  });
});

describe('status board links', () => {
  it('links each night to its digest with its counts', async () => {
    const html = await (await real.request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('ok 10 · retry 4 · fail 1');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 7 · retry 0 · fail 0');
  });
});
