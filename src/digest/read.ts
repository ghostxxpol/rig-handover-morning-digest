import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// A line counts only when it is a JSON object with a string `at` and `job` and a known `status`.
export function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (!STATUSES.includes(o.status as RunStatus)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

export const readNight: ReadNight = (runsDir: string, night: string): Night | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  let badLines = 0;
  const lines: Line[] = [];
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (line) lines.push(line);
    else badLines++;
  }

  // Oldest first, so "last" means the latest by time. Ties keep file order (sort is stable).
  lines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const byJob = new Map<string, DigestRow>();
  for (const l of lines) {
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    row.runs++;
    if (l.status === 'retry') row.retries++;
    row.lastStatus = l.status;
    row.lastAt = l.at;
    if (l.error) row.lastError = l.error;
    if (l.owner) row.owner = l.owner;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};
