import { spawn } from "node:child_process";

function parseArgs(argv) {
  const options = { port: 9000, timeout: 30_000, cwd: process.cwd(), paths: [] };
  const separator = argv.indexOf("--");
  if (separator === -1 || separator === argv.length - 1) {
    throw new Error("Usage: smoke-server.mjs [options] -- <command> [args...]");
  }

  for (let index = 0; index < separator; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--port") options.port = Number(value);
    else if (argument === "--timeout-ms") options.timeout = Number(value);
    else if (argument === "--cwd") options.cwd = value;
    else if (argument === "--path") options.paths.push(value);
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("--port must be a valid TCP port");
  }
  if (!Number.isFinite(options.timeout) || options.timeout < 1_000) {
    throw new Error("--timeout-ms must be at least 1000");
  }
  if (options.paths.length === 0) options.paths.push("/healthz");
  options.command = argv.slice(separator + 1);
  return options;
}

function secretValues(environment) {
  return Object.entries(environment)
    .filter(([name, value]) => value && /(SECRET|TOKEN|PASSWORD|PRIVATE|COOKIE|AUTH|ACCESS_KEY)/i.test(name))
    .map(([, value]) => String(value))
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);
}

function redact(text, secrets) {
  let output = text;
  for (const secret of secrets) output = output.split(secret).join("[REDACTED]");
  return output
    .replace(/(mysql(?:s)?:\/\/)[^\s@]+@/gi, "$1[REDACTED]@")
    .replace(/(authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]+/gi, "$1: [REDACTED]");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function probe(url) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
  return { status: response.status, ok: response.status >= 200 && response.status < 400 };
}

async function terminate(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    wait(5_000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  ]);
}

const options = parseArgs(process.argv.slice(2));
const [command, ...commandArgs] = options.command;
const environment = {
  ...process.env,
  HOSTNAME: "0.0.0.0",
  PORT: String(options.port),
  NODE_ENV: process.env.NODE_ENV || "production",
};
const secrets = secretValues(environment);
let stdout = "";
let stderr = "";
const child = spawn(command, commandArgs, {
  cwd: options.cwd,
  env: environment,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  stdout = `${stdout}${chunk}`.slice(-100_000);
});
child.stderr.on("data", (chunk) => {
  stderr = `${stderr}${chunk}`.slice(-100_000);
});

const deadline = Date.now() + options.timeout;
const results = [];
let failure;

try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      const healthUrl = `http://127.0.0.1:${options.port}${options.paths[0]}`;
      const health = await probe(healthUrl);
      if (health.ok) break;
    } catch {
      await wait(250);
      continue;
    }
    await wait(250);
  }

  if (Date.now() >= deadline) throw new Error("Server did not become healthy before the timeout");

  for (const path of options.paths) {
    const url = `http://127.0.0.1:${options.port}${path}`;
    const result = await probe(url);
    results.push({ path, status: result.status, passed: result.ok });
    if (!result.ok) throw new Error(`${path} returned HTTP ${result.status}`);
  }
} catch (error) {
  failure = error;
} finally {
  await terminate(child);
}

const report = {
  command: [command, ...commandArgs],
  cwd: options.cwd,
  port: options.port,
  results,
  passed: !failure,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (failure) {
  process.stderr.write(`${failure.message}\n`);
  if (stdout) process.stderr.write(`stdout:\n${redact(stdout, secrets)}\n`);
  if (stderr) process.stderr.write(`stderr:\n${redact(stderr, secrets)}\n`);
  process.exitCode = 2;
}
