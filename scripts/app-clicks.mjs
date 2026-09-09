// Prints /get click counts from the app_clicks Analytics Engine dataset.
// Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node scripts/app-clicks.mjs [--days 30]
// The token needs "Account Analytics: Read". It is never printed.
const accountId = process.env.CF_ACCOUNT_ID;
const token = process.env.CF_API_TOKEN;
if (!accountId || !token) {
  console.error('Set CF_ACCOUNT_ID and CF_API_TOKEN in the environment.');
  process.exit(2);
}

const daysFlag = process.argv.indexOf('--days');
const days = daysFlag === -1 ? 30 : Number.parseInt(process.argv[daysFlag + 1], 10);
if (!Number.isInteger(days) || days < 1) {
  console.error('--days must be a positive integer.');
  process.exit(2);
}

const query = `SELECT blob1 AS platform, blob2 AS src, blob3 AS via, SUM(_sample_interval) AS clicks
FROM app_clicks
WHERE timestamp > NOW() - INTERVAL '${days}' DAY
GROUP BY platform, src, via
ORDER BY clicks DESC
FORMAT JSON`;

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
  { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: query },
);
const text = await response.text();
if (!response.ok) {
  console.error(`Analytics Engine SQL API returned ${response.status}:\n${text}`);
  process.exit(1);
}

let body;
try {
  body = JSON.parse(text);
} catch {
  console.error(`Analytics Engine SQL API returned a non-JSON body:\n${text}`);
  process.exit(1);
}
const header = ['platform', 'src', 'via', 'clicks'];
const rows = (Array.isArray(body.data) ? body.data : []).map((row) => header.map((key) => String(row[key])));
const widths = header.map((name, i) => Math.max(name.length, ...rows.map((row) => row[i].length)));
const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
console.log(`Clicks on /get, last ${days} days`);
console.log(line(header));
console.log(line(widths.map((width) => '-'.repeat(width))));
for (const row of rows) console.log(line(row));
if (!rows.length) console.log('(none)');
