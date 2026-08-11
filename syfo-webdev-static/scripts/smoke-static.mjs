import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const args = process.argv.slice(2);
let artifact = ".fc/artifact";
const paths = [];
let rangePath;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--artifact") artifact = args[++index];
  else if (args[index] === "--path") paths.push(args[++index]);
  else if (args[index] === "--range-path") rangePath = args[++index];
  else throw new Error(`Unknown argument: ${args[index]}`);
}

const root = resolve(artifact);
const entry = resolve(root, "server.mjs");
if (!existsSync(entry)) throw new Error(`Missing static server entry: ${entry}`);

const verifierToken = `local-smoke-${process.pid}-${Date.now()}`;
const verifier = createServer((request, response) => {
  if (
    request.url !== "/api/v1/hosted-app-auth/basic/verify" ||
    request.method !== "POST" ||
    request.headers["x-syfo-hosted-app-token"] !== verifierToken
  ) {
    response.writeHead(403).end();
    return;
  }
  response.writeHead(204).end();
});
await new Promise((resolveListen, reject) => {
  verifier.once("error", reject);
  verifier.listen(0, "127.0.0.1", resolveListen);
});
const verifierAddress = verifier.address();
if (!verifierAddress || typeof verifierAddress === "string") {
  verifier.close();
  throw new Error("Local verifier did not expose a TCP port.");
}

const port = 9000 + Math.floor(Math.random() * 500);
const child = spawn(process.execPath, [entry], {
  cwd: root,
  env: {
    ...process.env,
    HOSTNAME: "0.0.0.0",
    PORT: String(port),
    NODE_ENV: "production",
    BUILT_IN_FORGE_API_URL: `http://127.0.0.1:${verifierAddress.port}`,
    BUILT_IN_FORGE_API_KEY: verifierToken,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

async function request(path, init) {
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await request("/healthz");
      if (response.ok) return response;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Static server did not become healthy.\n${output}`);
}

const results = [];
try {
  const health = await waitForHealth();
  results.push({ path: "/healthz", status: health.status });
  for (const path of paths.length ? paths : ["/"]) {
    const response = await request(path);
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    results.push({ path, status: response.status, contentType: response.headers.get("content-type") });
  }
  const missing = await request(`/__syfo_missing_${Date.now()}`);
  if (missing.status !== 404) throw new Error(`Missing path returned ${missing.status}, expected 404.`);
  results.push({ path: "missing-route", status: missing.status });
  if (rangePath) {
    const range = await request(rangePath, { headers: { Range: "bytes=0-9" } });
    if (range.status !== 206) throw new Error(`${rangePath} returned ${range.status}, expected 206 for a byte range.`);
    results.push({ path: rangePath, status: range.status, contentRange: range.headers.get("content-range") });
  }
  process.stdout.write(`${JSON.stringify({ artifact: root, accessMode: "local-public-verifier", results }, null, 2)}\n`);
} finally {
  child.kill("SIGTERM");
  await new Promise((resolveExit) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolveExit(); }, 5000);
    child.once("exit", () => { clearTimeout(timer); resolveExit(); });
  });
  await new Promise((resolveClose) => verifier.close(resolveClose));
}
