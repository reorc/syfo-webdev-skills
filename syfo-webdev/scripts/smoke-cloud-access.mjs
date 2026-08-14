function parseArgs(argv) {
  const options = { mode: "", path: "/" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--url") options.url = value;
    else if (argument === "--mode") options.mode = value;
    else if (argument === "--path") options.path = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!options.url) throw new Error("--url is required");
  if (!["public", "basic_auth"].includes(options.mode)) throw new Error("--mode must be public or basic_auth");
  options.url = new URL(options.url);
  return options;
}

async function probe(url, init) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), ...init });
}

function assertSuccess(response, label) {
  if (response.status < 200 || response.status >= 400) throw new Error(`${label} returned HTTP ${response.status}`);
}

const options = parseArgs(process.argv.slice(2));
const healthUrl = new URL("/healthz", options.url);
const pageUrl = new URL(options.path, options.url);
const results = [];

const health = await probe(healthUrl);
assertSuccess(health, "health");
results.push({ scenario: "health-anonymous", status: health.status });

const anonymous = await probe(pageUrl);
if (options.mode === "public") {
  assertSuccess(anonymous, "public anonymous request");
  results.push({ scenario: "public-anonymous", status: anonymous.status });
} else {
  const challenge = anonymous.headers.get("www-authenticate") || "";
  if (anonymous.status !== 401 || !/^Basic(?:\s|$)/i.test(challenge)) {
    throw new Error(`basic_auth anonymous request returned HTTP ${anonymous.status} without a Basic challenge`);
  }
  results.push({ scenario: "basic-auth-anonymous-challenge", status: anonymous.status });

  const username = process.env.SYFO_BASIC_AUTH_USERNAME || "";
  const password = process.env.SYFO_BASIC_AUTH_PASSWORD || "";
  if (!username || !password) throw new Error("SYFO_BASIC_AUTH_USERNAME and SYFO_BASIC_AUTH_PASSWORD are required for basic_auth smoke");
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const authorized = await probe(pageUrl, { headers: { Authorization: authorization } });
  assertSuccess(authorized, "basic_auth authorized request");
  results.push({ scenario: "basic-auth-authorized", status: authorized.status });
}

process.stdout.write(`${JSON.stringify({ url: options.url.origin, path: options.path, mode: options.mode, results, passed: true }, null, 2)}\n`);
