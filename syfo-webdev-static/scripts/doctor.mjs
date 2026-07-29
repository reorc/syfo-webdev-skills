import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const findings = [];

function add(level, code, file, detail) {
  findings.push({ level, code, file, detail });
}

function read(path) {
  return readFileSync(path, "utf8");
}

function findFirst(names) {
  return names.map((name) => join(root, name)).find(existsSync);
}

function walk(directory, files = []) {
  if (!existsSync(directory) || files.length >= 3000) return files;
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".next", "out", ".git", ".fc", "dist", "build", "coverage"].includes(entry)) continue;
    const path = join(directory, entry);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

const packagePath = join(root, "package.json");
let packageJson;
let dependencies = {};
if (!existsSync(packagePath)) {
  add("error", "missing-package", "package.json", "Run this audit from the selected Next.js appDir.");
  if (existsSync(join(root, "index.html"))) add("info", "plain-static-source", "index.html", "A plain static source was detected; migrate it into Next.js before applying the FC artifact contract.");
} else {
  packageJson = JSON.parse(read(packagePath));
  dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (!dependencies.next) add("error", "missing-next", "package.json", "The application does not declare Next.js.");
  for (const script of ["build", "typecheck"]) {
    if (!packageJson.scripts?.[script]) add("warning", `missing-${script}-script`, "package.json", `No ${script} script was found.`);
  }
  for (const dependency of ["mysql2", "better-sqlite3", "sqlite3", "pg", "@prisma/client", "drizzle-orm", "sequelize", "typeorm"]) {
    if (dependencies[dependency]) add("warning", "database-dependency", "package.json", `${dependency} suggests this may require syfo-webdev-fullstack.`);
  }
}

const lockFiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"].filter((name) => existsSync(join(root, name)));
if (lockFiles.length === 0) add("error", "missing-lockfile", ".", "Commit one dependency lock file.");
if (lockFiles.length > 1) add("warning", "multiple-lockfiles", ".", `Multiple lock files found: ${lockFiles.join(", ")}.`);

const nextConfig = findFirst(["next.config.ts", "next.config.mjs", "next.config.js", "next.config.cjs"]);
let nextSource = "";
if (!nextConfig) {
  add("error", "missing-next-config", "next.config.*", "Static export requires output: export.");
} else {
  nextSource = read(nextConfig);
  if (!/output\s*:\s*["']export["']/.test(nextSource)) add("error", "missing-static-output", relative(root, nextConfig), "Configure output: export.");
}

for (const path of ["scripts/assemble-static.mjs", "scripts/static-server.mjs"]) {
  if (!existsSync(join(root, path))) add("error", "missing-static-adapter", path, `Create ${path} from the skill template.`);
}

const manifestPath = join(root, "syfo.yaml");
let manifest = "";
if (!existsSync(manifestPath)) {
  add("error", "missing-manifest", "syfo.yaml", "Create the Syfo application manifest at appDir root.");
} else {
  manifest = read(manifestPath);
  const checks = [
    ["manifest-version", /^version:\s*1\s*$/m, "Set syfo.yaml version to integer 1."],
    ["manifest-app-type", /^\s*type:\s*nextjs\s*$/m, "Declare app.type as nextjs."],
    ["manifest-output", /^\s*output:\s*\.fc\/artifact\s*$/m, "Declare .fc/artifact as build output."],
    ["manifest-run", /^\s*command:\s*node server\.mjs\s*$/m, "Run the assembled static adapter."],
    ["manifest-port", /^\s*port:\s*9000\s*$/m, "Use the Syfo FC port contract."],
    ["manifest-health", /^\s*path:\s*\/healthz\s*$/m, "Declare the /healthz check."],
    ["manifest-no-database", /^\s*required:\s*false\s*$/m, "Declare database.required as false."],
  ];
  for (const [code, pattern, detail] of checks) if (!pattern.test(manifest)) add("error", code, "syfo.yaml", detail);
  if (/\b(?:TIDB_HOST|TIDB_PORT|TIDB_USER|TIDB_PASSWORD|TIDB_DATABASE)\b/.test(manifest)) add("error", "tidb-env", "syfo.yaml", "Static applications must not declare TiDB variables.");
  if (/^\s*(?:region|functionName|domainName|access|accessKey|certificate|privateKey|runtimeName)\s*:/im.test(manifest)) add("error", "provider-detail", "syfo.yaml", "Provider resources belong to the Syfo backend, not syfo.yaml.");
  if (/^\s*(?:password|secret|token|privateKey|connectionString)\s*:\s*\S+/im.test(manifest)) add("error", "manifest-secret", "syfo.yaml", "The manifest appears to contain a secret value.");
}

const sourceFiles = [join(root, "app"), join(root, "src"), join(root, "pages")]
  .flatMap((directory) => walk(directory))
  .filter((path) => /\.[cm]?[jt]sx?$/.test(path));
const patterns = [
  ["error", "request-api", /from\s*["']next\/headers["']|\b(?:cookies|headers|draftMode)\s*\(/, "Request-time Next.js APIs require syfo-webdev-fullstack."],
  ["error", "server-action", /["']use server["']/, "Server Actions require syfo-webdev-fullstack."],
  ["warning", "revalidate", /export\s+const\s+revalidate\b/, "Confirm ISR is not expected from a static deployment."],
  ["warning", "runtime-declaration", /export\s+const\s+runtime\b/, "Review explicit runtime declarations for static-export necessity."],
  ["warning", "public-secret", /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE|PASSWORD|KEY)/, "Browser-exposed environment variables are public."],
];

for (const file of sourceFiles) {
  const source = read(file);
  const path = relative(root, file);
  if (/(?:^|\/)route\.[cm]?[jt]sx?$/.test(path)) add("warning", "route-handler", path, "Confirm this Route Handler is build-time only; request-time APIs require fullstack.");
  for (const [level, code, pattern, detail] of patterns) if (pattern.test(source)) add(level, code, path, detail);
}

for (const path of ["middleware.ts", "middleware.js", "src/middleware.ts", "src/middleware.js", "proxy.ts", "proxy.js", "src/proxy.ts", "src/proxy.js"]) {
  if (existsSync(join(root, path))) add("error", "request-middleware", path, "Request middleware or proxy behavior requires syfo-webdev-fullstack.");
}

const combinedSource = sourceFiles.map((file) => read(file)).join("\n");
if (/from\s*["']next\/image["']/.test(combinedSource) && !/(unoptimized\s*:\s*true|loader\s*:)/.test(nextSource)) {
  add("warning", "image-export", relative(root, nextConfig || root), "next/image in a static export needs an approved loader or images.unoptimized: true.");
}

let assetBytes = 0;
let assetFiles = 0;
const assetRoots = ["public", "audio", "images", "assets"]
  .map((name) => join(root, name))
  .filter(existsSync);
for (const assetRoot of assetRoots) {
  for (const file of walk(assetRoot)) {
    const info = statSync(file);
    assetBytes += info.size;
    assetFiles += 1;
    if (info.size > 10 * 1024 * 1024) add("warning", "large-asset", relative(root, file), `Asset is ${(info.size / 1024 / 1024).toFixed(1)} MiB; verify the artifact budget.`);
  }
}
if (assetBytes > 50 * 1024 * 1024) add("warning", "large-asset-set", "assets", `Static assets total ${(assetBytes / 1024 / 1024).toFixed(1)} MiB across ${assetFiles} files.`);

for (const config of ["wrangler.json", "wrangler.jsonc", "wrangler.toml", "open-next.config.ts", "open-next.config.mjs"]) {
  if (existsSync(join(root, config))) add("warning", "cloudflare-config", config, "Confirm this Cloudflare deployment path is obsolete or explicitly isolated from Syfo FC.");
}
if (existsSync(join(root, "s.yaml"))) add("warning", "provider-manifest", "s.yaml", "Syfo backend services generate provider-specific s.yaml; do not maintain it in the application project.");

if (existsSync(join(root, ".fc", "artifact", "server.mjs"))) add("info", "artifact-present", ".fc/artifact", "Run the static smoke harness against the assembled artifact.");
else add("info", "build-not-run", ".fc/artifact", "Run the build and project-local assembly before runtime validation.");

const order = { error: 0, warning: 1, info: 2 };
findings.sort((left, right) => order[left.level] - order[right.level] || left.file.localeCompare(right.file) || left.code.localeCompare(right.code));
const result = { root, assets: { files: assetFiles, bytes: assetBytes }, findings };
if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else if (findings.length === 0) process.stdout.write("Static FC audit found no obvious blockers. Run build, assembly, smoke, browser, and Syfo validation next.\n");
else {
  for (const finding of findings) process.stdout.write(`${finding.level.toUpperCase()} ${finding.code} ${finding.file}: ${finding.detail}\n`);
  process.stdout.write(`\n${findings.filter((item) => item.level === "error").length} error(s), ${findings.filter((item) => item.level === "warning").length} warning(s), ${findings.filter((item) => item.level === "info").length} info item(s).\n`);
}
process.exitCode = findings.some((finding) => finding.level === "error") ? 2 : 0;
