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
  if (!existsSync(directory) || files.length >= 2500) return files;
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".next", ".git", ".fc", "dist", "build", "coverage"].includes(entry)) continue;
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (/\.(?:[cm]?[jt]sx?|json|ya?ml|sql|prisma)$/.test(entry)) files.push(path);
  }
  return files;
}

const packagePath = join(root, "package.json");
let packageJson;
let dependencies = {};
if (!existsSync(packagePath)) {
  add("error", "missing-package", "package.json", "Run this audit from the selected Next.js appDir.");
} else {
  packageJson = JSON.parse(read(packagePath));
  dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (!dependencies.next) add("error", "missing-next", "package.json", "The application does not declare Next.js.");
  for (const script of ["build", "typecheck", "test", "db:migrate"]) {
    if (!packageJson.scripts?.[script]) add("warning", `missing-${script}-script`, "package.json", `No ${script} script was found.`);
  }
  const nativePackages = ["sharp", "bcrypt", "better-sqlite3", "canvas", "playwright", "puppeteer"];
  for (const dependency of nativePackages) {
    if (dependencies[dependency]) {
      add("warning", "native-dependency", "package.json", `${dependency} requires Linux target-architecture validation.`);
    }
  }
  if (!dependencies.mysql2 && !dependencies["@tidbcloud/serverless"] && !dependencies.prisma && !dependencies["@prisma/client"] && !dependencies["drizzle-orm"] && !dependencies.sequelize && !dependencies.typeorm) {
    add("warning", "missing-tidb-driver", "package.json", "No obvious MySQL/TiDB-compatible database dependency was found.");
  }
}

const lockFiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"].filter((name) => existsSync(join(root, name)));
if (lockFiles.length === 0) add("error", "missing-lockfile", ".", "Commit one dependency lock file.");
if (lockFiles.length > 1) add("warning", "multiple-lockfiles", ".", `Multiple lock files found: ${lockFiles.join(", ")}.`);

const nextConfig = findFirst(["next.config.ts", "next.config.mjs", "next.config.js", "next.config.cjs"]);
if (!nextConfig) {
  add("error", "missing-next-config", "next.config.*", "No Next.js configuration was found.");
} else {
  const source = read(nextConfig);
  if (!/output\s*:\s*["']standalone["']/.test(source)) {
    add("error", "missing-standalone", relative(root, nextConfig), "Configure output: standalone.");
  }
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
    ["manifest-runtime", /^\s*family:\s*nodejs\s*$/m, "Declare the Node.js runtime family."],
    ["manifest-output", /^\s*output:\s*\.next\/standalone\s*$/m, "Declare .next/standalone as build output."],
    ["manifest-port", /^\s*port:\s*9000\s*$/m, "Use the Syfo FC port contract."],
    ["manifest-health", /^\s*path:\s*\/healthz\s*$/m, "Declare the /healthz check."],
    ["manifest-database", /^\s*engine:\s*tidb\s*$/m, "Declare TiDB when the application requires a database."],
  ];
  for (const [code, pattern, detail] of checks) {
    if (!pattern.test(manifest)) add("error", code, "syfo.yaml", detail);
  }
  if (/^\s*(?:accessKey|password|secret|token|privateKey|connectionString)\s*:\s*\S+/im.test(manifest)) {
    add("error", "manifest-secret", "syfo.yaml", "The manifest appears to contain a secret value.");
  }
  if (/^\s*-\s*(?:PORT|HOSTNAME|NODE_ENV|TIDB_HOST|TIDB_PORT|TIDB_USER|TIDB_PASSWORD|TIDB_DATABASE)\s*$/m.test(manifest)) {
    add("warning", "platform-env-declared", "syfo.yaml", "Platform-injected variables should not be listed as application-owned env requirements.");
  }
}

const healthCandidates = [
  "app/healthz/route.ts",
  "app/healthz/route.js",
  "src/app/healthz/route.ts",
  "src/app/healthz/route.js",
  "pages/api/healthz.ts",
  "pages/api/healthz.js",
  "src/pages/api/healthz.ts",
  "src/pages/api/healthz.js",
];
if (!healthCandidates.some((path) => existsSync(join(root, path)))) {
  add("error", "missing-health-route", "app/healthz/route.*", "Add an unauthenticated GET /healthz endpoint.");
}

const sourceFiles = [join(root, "app"), join(root, "src"), join(root, "pages"), join(root, "server"), join(root, "drizzle"), join(root, "prisma")]
  .flatMap((directory) => walk(directory));
const patterns = [
  ["error", "edge-runtime", /export\s+const\s+runtime\s*=\s*["']edge["']/, "Remove explicit Edge Runtime declarations from the FC Node.js path."],
  ["error", "cloudflare-binding", /\bD1Database\b|@cloudflare\/workers-types|cloudflare:workers|env\.[A-Z0-9_]*D1\b/, "Replace Cloudflare runtime database bindings in the FC path."],
  ["error", "sqlite-runtime", /better-sqlite3|from\s*["']sqlite3["']|from\s*["']bun:sqlite["']/, "Replace SQLite runtime access with TiDB-compatible access."],
  ["warning", "filesystem-write", /\b(?:writeFile|appendFile|createWriteStream|mkdir|rename)\s*\(/, "Review filesystem writes; FC local disk is temporary."],
  ["warning", "hard-coded-port", /\blisten\s*\(\s*\d{2,5}\b|\bPORT\s*=\s*["']\d{2,5}["']/, "Read the production port from process.env.PORT."],
  ["warning", "connection-url-log", /console\.(?:log|info|debug)\([^\n]*(?:DATABASE_URL|TIDB_PASSWORD|process\.env)/, "Do not log connection values or full environment objects."],
];

const combinedSource = sourceFiles.map((file) => read(file)).join("\n");
for (const file of sourceFiles) {
  const source = read(file);
  for (const [level, code, pattern, detail] of patterns) {
    if (pattern.test(source)) add(level, code, relative(root, file), detail);
  }
}

if (/required:\s*true/.test(manifest)) {
  for (const variable of ["TIDB_HOST", "TIDB_PORT", "TIDB_USER", "TIDB_PASSWORD", "TIDB_DATABASE"]) {
    if (!combinedSource.includes(variable)) {
      add("warning", "missing-tidb-env-use", ".", `No application reference to ${variable} was found.`);
    }
  }
}

if (existsSync(join(root, ".next", "standalone"))) {
  if (!existsSync(join(root, ".next", "static"))) add("warning", "missing-next-static", ".next/static", "The production build has no static directory to assemble.");
} else {
  add("info", "build-not-run", ".next/standalone", "Run the production build before artifact validation.");
}

for (const config of ["wrangler.json", "wrangler.jsonc", "wrangler.toml", "open-next.config.ts", "open-next.config.mjs"]) {
  if (existsSync(join(root, config))) add("warning", "cloudflare-config", config, "Confirm this Cloudflare configuration is no longer part of the FC deployment path.");
}

const order = { error: 0, warning: 1, info: 2 };
findings.sort((left, right) => order[left.level] - order[right.level] || left.file.localeCompare(right.file) || left.code.localeCompare(right.code));

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ root, findings }, null, 2)}\n`);
} else if (findings.length === 0) {
  process.stdout.write("FC and TiDB audit found no obvious blockers. Run build, artifact assembly, smoke, and database validation next.\n");
} else {
  for (const finding of findings) {
    process.stdout.write(`${finding.level.toUpperCase()} ${finding.code} ${finding.file}: ${finding.detail}\n`);
  }
  const errors = findings.filter((finding) => finding.level === "error").length;
  const warnings = findings.filter((finding) => finding.level === "warning").length;
  const information = findings.filter((finding) => finding.level === "info").length;
  process.stdout.write(`\n${errors} error(s), ${warnings} warning(s), ${information} info item(s).\n`);
}

process.exitCode = findings.some((finding) => finding.level === "error") ? 2 : 0;
