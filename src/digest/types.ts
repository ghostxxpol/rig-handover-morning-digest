// The digest's contract (plan.md § 1). Every part of the digest builds on this file.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night.
export type DigestRow = {
  job: string;
  // `null` when the log line has no owner. Keep the row; views show `—`.
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // ISO 8601 times of the first and last line for this job.
  firstAt: string;
  lastAt: string;
};

export type Night = {
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// Reads runs/<night>.jsonl (night = YYYY-MM-DD) into one row per job.
// Returns null when the night has no file. An empty file gives rows: [].
// A line that does not parse is counted in badLines and never thrown.
export type ReadNight = (runsDir: string, night: string) => Night | null;
