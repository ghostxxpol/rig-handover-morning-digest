import type { DigestRow, Night } from '../digest/types.js';

// Retries at or above this count are marked as a warning.
const RETRY_WARN = 3;

function DigestTableRow({ row }: { row: DigestRow }) {
  const retryWarn = row.retries >= RETRY_WARN;
  const failWarn = row.lastStatus === 'fail';
  const rowWarn = retryWarn || failWarn;
  return (
    <tr class={rowWarn ? 'warn' : undefined}>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <td>{retryWarn ? <span class="warn">{row.retries} ⚠ retries</span> : row.retries}</td>
      <td>{failWarn ? <span class="warn">fail</span> : row.lastStatus}</td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ night, digest }: { night: string; digest: Night }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.badLines > 0 ? <p class="mute">{digest.badLines} unreadable lines skipped</p> : null}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <DigestTableRow row={row} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
