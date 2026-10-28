// Prints the /c funnel from the app_clicks Analytics Engine dataset: how many
// people opened a page and how many of them went on to ask us something.
// Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node scripts/interest.mjs [--days 30]
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

const query = `SELECT blob1 AS kind, blob2 AS event, blob3 AS src, SUM(_sample_interval) AS n
FROM app_clicks
WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND blob1 IN ('view', 'click')
GROUP BY kind, event, src
ORDER BY n DESC
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

const rows = (Array.isArray(body.data) ? body.data : []).map((row) => ({
  kind: String(row.kind),
  event: String(row.event),
  src: String(row.src),
  n: Number(row.n) || 0,
}));

const total = (event) => rows.filter((row) => row.event === event).reduce((sum, row) => sum + row.n, 0);
const share = (part, whole) => (whole ? ` (${Math.round((part / whole) * 100)}%)` : '');

const opened = total('open-newhere');
const clickedAsk = total('ask');
const clickedSite = total('site');
const openedForm = total('open-ask');

console.log(`Interest, last ${days} days\n`);
console.log(`Opened the page            ${opened}`);
console.log(`  went on to ask           ${clickedAsk}${share(clickedAsk, opened)}`);
console.log(`  went to the main site    ${clickedSite}${share(clickedSite, opened)}`);
console.log(`Opened the form            ${openedForm}   (includes people who came straight to it)`);
console.log('\nSubmitted questions are in Tally, not here.');

const bySrc = new Map();
for (const row of rows) {
  const current = bySrc.get(row.src) || { opened: 0, asked: 0 };
  if (row.event === 'open-newhere') current.opened += row.n;
  if (row.event === 'ask') current.asked += row.n;
  bySrc.set(row.src, current);
}

const sources = [...bySrc.entries()]
  .filter(([, value]) => value.opened || value.asked)
  .sort((a, b) => b[1].opened - a[1].opened);

console.log('\nWhere they came from');
if (!sources.length) {
  console.log('(nothing yet)');
} else {
  const header = ['src', 'opened', 'asked'];
  const table = sources.map(([src, value]) => [src, String(value.opened), String(value.asked)]);
  const widths = header.map((name, i) => Math.max(name.length, ...table.map((row) => row[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  console.log(line(header));
  console.log(line(widths.map((width) => '-'.repeat(width))));
  for (const row of table) console.log(line(row));
}
