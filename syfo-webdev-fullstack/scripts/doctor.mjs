import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { inflateSync } from "node:zlib";

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

function findTagEnd(source, start) {
  let quote = "";
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function parseXmlAttributes(source) {
  const attributes = new Map();
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] || "")) index += 1;
    if (index >= source.length) break;
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(source.slice(index));
    if (!nameMatch) throw new Error("invalid attribute name");
    const name = nameMatch[0];
    index += name.length;
    while (/\s/.test(source[index] || "")) index += 1;
    if (source[index] !== "=") throw new Error("attribute without value");
    index += 1;
    while (/\s/.test(source[index] || "")) index += 1;
    const quote = source[index];
    if (quote !== '"' && quote !== "'") throw new Error("unquoted attribute");
    index += 1;
    const end = source.indexOf(quote, index);
    if (end < 0) throw new Error("unterminated attribute");
    if (attributes.has(name)) throw new Error("duplicate attribute");
    attributes.set(name, source.slice(index, end));
    index = end + 1;
  }
  return attributes;
}

function hasUnsafeCssReference(source) {
  if (/@import\b/i.test(source)) return true;
  for (const match of source.matchAll(/url\s*\(([^)]*)\)/gi)) {
    const value = (match[1] || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (!/^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value)) return true;
  }
  return false;
}

function parseSafeSvg(source) {
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(source)) throw new Error("DTD and entities are forbidden");
  const stack = [];
  let rootAttributes = null;
  let rootCount = 0;
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (index < source.length) {
    const open = source.indexOf("<", index);
    const text = source.slice(index, open < 0 ? source.length : open);
    if (stack.length === 0 && text.trim()) throw new Error("text outside root element");
    if (text.includes("&") || text.includes("\\")) throw new Error("entities and escapes are forbidden");
    if (open < 0) break;
    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      if (end < 0) throw new Error("unterminated comment");
      index = end + 3;
      continue;
    }
    if (source.startsWith("<?", open) || source.startsWith("<!", open)) {
      throw new Error("processing instructions and declarations are forbidden");
    }
    const end = findTagEnd(source, open + 1);
    if (end < 0) throw new Error("unterminated tag");
    let body = source.slice(open + 1, end).trim();
    if (body.startsWith("/")) {
      const name = body.slice(1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(name) || stack.pop() !== name) {
        throw new Error("mismatched closing tag");
      }
      index = end + 1;
      continue;
    }
    const selfClosing = body.endsWith("/");
    if (selfClosing) body = body.slice(0, -1).trimEnd();
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(body);
    if (!nameMatch) throw new Error("invalid element name");
    const name = nameMatch[0];
    const localName = name.split(":").at(-1)?.toLowerCase() || "";
    const attributes = parseXmlAttributes(body.slice(name.length));
    if (stack.length === 0) {
      rootCount += 1;
      if (rootCount !== 1 || name !== "svg") throw new Error("root element must be unprefixed svg");
      if (attributes.get("xmlns") !== "http://www.w3.org/2000/svg") throw new Error("SVG namespace is required");
      rootAttributes = attributes;
    }
    if (["script", "foreignobject", "style", "set", "discard"].includes(localName) || localName.startsWith("animate")) throw new Error("unsafe element");
    for (const [attributeName, value] of attributes) {
      const normalizedName = attributeName.toLowerCase();
      const localAttributeName = normalizedName.split(":").at(-1) || "";
      if (localAttributeName.startsWith("on") || localAttributeName === "style" || normalizedName === "xml:base") {
        throw new Error("unsafe attribute");
      }
      if (["href", "src"].includes(localAttributeName) && !/^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value)) {
        throw new Error("external reference");
      }
      if (value.includes("&") || value.includes("\\") || hasUnsafeCssReference(value)) throw new Error("unsafe attribute value");
    }
    if (!selfClosing) stack.push(name);
    index = end + 1;
  }
  if (stack.length !== 0 || rootCount !== 1 || !rootAttributes) throw new Error("invalid SVG document");
  return rootAttributes;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(bytes, size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.byteLength > 1024 * 1024 || !bytes.subarray(0, 8).equals(signature)) throw new Error("invalid PNG signature or size");
  let offset = 8;
  let chunkIndex = 0;
  let colorType = null;
  let seenImageData = false;
  let hasImageData = false;
  let imageDataEnded = false;
  let ended = false;
  const imageDataChunks = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > bytes.length) throw new Error("truncated PNG chunk");
    const type = bytes.subarray(typeStart, dataStart).toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("invalid PNG chunk type");
    if (bytes.readUInt32BE(crcOffset) !== crc32(bytes.subarray(typeStart, dataEnd))) throw new Error("PNG CRC mismatch");
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) throw new Error("PNG must start with IHDR");
      if (bytes.readUInt32BE(dataStart) !== size || bytes.readUInt32BE(dataStart + 4) !== size) throw new Error(`PNG dimensions must be ${size}x${size}`);
      if (bytes[dataStart + 8] !== 8 || ![2, 6].includes(bytes[dataStart + 9])) throw new Error("PNG must use 8-bit RGB or RGBA pixels");
      if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || bytes[dataStart + 12] !== 0) {
        throw new Error("PNG compression, filter, and interlace methods must be 0");
      }
      colorType = bytes[dataStart + 9];
    } else if (type === "IHDR") {
      throw new Error("PNG must contain exactly one IHDR");
    }
    if (type === "PLTE") {
      throw new Error("PNG palettes are not allowed for RGB or RGBA App icons");
    }
    if (type === "IDAT") {
      if (imageDataEnded) throw new Error("PNG IDAT chunks must be contiguous");
      seenImageData = true;
      hasImageData ||= length > 0;
      imageDataChunks.push(bytes.subarray(dataStart, dataEnd));
    } else if (seenImageData) {
      imageDataEnded = true;
    }
    if (!["IHDR", "IDAT", "IEND"].includes(type) && (bytes[typeStart] & 0x20) === 0) {
      throw new Error(`unknown critical PNG chunk ${type}`);
    }
    offset = crcOffset + 4;
    chunkIndex += 1;
    if (type === "IEND") {
      if (length !== 0 || offset !== bytes.length) throw new Error("invalid PNG ending");
      ended = true;
      break;
    }
  }
  if (!hasImageData || !ended) throw new Error("PNG requires non-empty IDAT and IEND chunks");
  const channels = colorType === 2 ? 3 : 4;
  const rowLength = 1 + size * channels;
  const expectedLength = size * rowLength;
  let pixels;
  try {
    pixels = inflateSync(Buffer.concat(imageDataChunks), { maxOutputLength: expectedLength + 1 });
  } catch {
    throw new Error("PNG IDAT must contain valid bounded zlib pixel data");
  }
  if (pixels.length !== expectedLength) throw new Error("PNG decoded pixel length does not match IHDR");
  for (let row = 0; row < size; row += 1) {
    if (pixels[row * rowLength] > 4) throw new Error("PNG scanline uses an invalid filter type");
  }
}

function validateAppIconMetadata(variants) {
  const appDirectory = findFirst(["app", "src/app"]);
  if (!appDirectory || !lstatSync(appDirectory).isDirectory()) {
    add("error", "app-icon-metadata-missing", "app", "Create Next file-convention icons in the root app or src/app directory.");
    return;
  }
  variants.forEach((variant, index) => {
    const metadataPath = join(appDirectory, `icon${index + 1}.png`);
    if (!existsSync(metadataPath) || !lstatSync(metadataPath).isFile()) {
      add("error", "app-icon-metadata-missing", relative(root, metadataPath), `Render ${variant.file} to the Next file-convention icon${index + 1}.png path.`);
    } else {
      try {
        validatePng(readFileSync(metadataPath), variant.size);
      } catch (error) {
        add("error", "app-icon-metadata-invalid", relative(root, metadataPath), `Provide a valid ${variant.size}×${variant.size} PNG rendered from ${variant.file}: ${error.message}`);
      }
    }
  });
  const expected = new Set(variants.map((_, index) => `icon${index + 1}.png`));
  const conflicts = readdirSync(appDirectory).filter((file) => /^(?:favicon\.ico|icon\d*\.(?:ico|jpe?g|png|svg)|apple-icon\d*\.(?:jpe?g|png))$/i.test(file) && !expected.has(file));
  if (conflicts.length > 0) add("error", "app-icon-file-convention-conflict", relative(root, appDirectory), `Remove extra file-convention icons that compete with icon1.png…icon4.png: ${conflicts.join(", ")}.`);
}

function validateAppIcons() {
  const variants = [
    { file: "public/favicon-16.svg", size: 16 },
    { file: "public/favicon-32.svg", size: 32 },
    { file: "public/app-icon-180.svg", size: 180 },
    { file: "public/syfo-app-icon.svg", size: 512 },
  ];
  for (const variant of variants) {
    const path = join(root, variant.file);
    if (!existsSync(path)) {
      add("error", "missing-app-icon", variant.file, `Create the ${variant.size}×${variant.size} SVG App icon before the first deployment.`);
      continue;
    }
    if (!lstatSync(path).isFile()) {
      add("error", "app-icon-not-regular", variant.file, "App icons must be regular source-controlled files, not symlinks or special files.");
      continue;
    }
    const bytes = readFileSync(path);
    if (bytes.byteLength > 64 * 1024) {
      add("error", "app-icon-too-large", variant.file, "Keep each SVG App icon at or below 64 KiB.");
      continue;
    }
    try {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const attributes = parseSafeSvg(source);
      if (attributes.get("width") !== String(variant.size) || attributes.get("height") !== String(variant.size)) {
        add("error", "app-icon-size-invalid", variant.file, `Declare root width and height as ${variant.size}.`);
      }
      if (attributes.get("viewBox") !== "0 0 512 512") {
        add("error", "app-icon-viewbox-invalid", variant.file, "Use root viewBox=\"0 0 512 512\" so every size shares one visual coordinate system.");
      }
    } catch (error) {
      add("error", "app-icon-unsafe-svg", variant.file, `Use a single-root, self-contained SVG without external references or executable markup: ${error.message}`);
    }
  }
  validateAppIconMetadata(variants);
}

function section(source, name) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${name}:`);
  if (start < 0) return "";
  const result = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    result.push(line);
  }
  return result.join("\n");
}

function scalar(block, name, indent = 2) {
  const match = block.match(new RegExp(`^\\s{${indent}}${name}:\\s*(.+?)\\s*$`, "m"));
  return match?.[1]?.trim() || "";
}

const packageManagers = {
  "package-lock.json": { install: "npm ci", build: "npm run build", migration: "npm run db:migrate" },
  "pnpm-lock.yaml": { install: "pnpm install --frozen-lockfile", build: "pnpm build", migration: "pnpm db:migrate" },
  "yarn.lock": { install: "yarn install --immutable", build: "yarn build", migration: "yarn db:migrate" },
};

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
validateAppIcons();
if (lockFiles.length === 0) add("error", "missing-lockfile", ".", "Commit one dependency lock file.");
if (lockFiles.length > 1) add("error", "multiple-lockfiles", ".", `Multiple lock files found: ${lockFiles.join(", ")}. Keep exactly one.`);
if (lockFiles.length === 1 && lockFiles[0] === "package-lock.json" && packageJson) {
  const packageManager = String(packageJson.packageManager || "").trim();
  if (!packageManager) {
    add("error", "npm-builder-version-required", "package.json", "Pin packageManager to the exact npm 10 version used to generate and validate package-lock.json.");
  } else if (!/^npm@10\.\d+\.\d+(?:\+sha\d+\.[a-f0-9]+)?$/.test(packageManager)) {
    add("error", "npm-builder-version-mismatch", "package.json", `Syfo's Node 20 builder uses npm 10; found ${packageManager}. Regenerate package-lock.json with an exact npm 10 version.`);
  }
}

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
  const build = section(manifest, "build");
  const run = section(manifest, "run");
  const database = section(manifest, "database");
  const checks = [
    ["manifest-version", /^version:\s*1\s*$/m, "Set syfo.yaml version to integer 1."],
    ["manifest-app-type", /^\s*type:\s*nextjs\s*$/m, "Declare app.type as nextjs."],
    ["manifest-runtime", /^\s*family:\s*nodejs\s*$/m, "Declare the Node.js runtime family."],
    ["manifest-output", /^\s*output:\s*\.fc\/artifact\s*$/m, "Declare .fc/artifact as build output."],
    ["manifest-run", /^\s*command:\s*node server\.js\s*$/m, "Run node server.js inside the assembled artifact."],
    ["manifest-port", /^\s*port:\s*9000\s*$/m, "Use the Syfo FC port contract."],
    ["manifest-health", /^\s*path:\s*\/healthz\s*$/m, "Declare the /healthz check."],
    ["manifest-database", /^\s*engine:\s*tidb\s*$/m, "Declare TiDB when the application requires a database."],
  ];
  for (const [code, pattern, detail] of checks) {
    if (!pattern.test(manifest)) add("error", code, "syfo.yaml", detail);
  }
  if (lockFiles.length === 1) {
    const expected = packageManagers[lockFiles[0]];
    if (!expected) {
      add("error", "unsupported-lockfile", lockFiles[0], "The Syfo build service supports package-lock.json, pnpm-lock.yaml, or yarn.lock.");
    } else {
      const actualInstall = scalar(build, "install");
      const actualBuild = scalar(build, "command");
      const actualMigration = scalar(database, "command", 4);
      if (actualInstall !== expected.install) add("error", "manifest-install-lock-mismatch", "syfo.yaml", `${lockFiles[0]} requires build.install: ${expected.install}.`);
      if (actualBuild !== expected.build) add("error", "manifest-build-lock-mismatch", "syfo.yaml", `${lockFiles[0]} requires build.command: ${expected.build}. Put assembly in the package build script.`);
      if (actualMigration !== expected.migration) add("error", "manifest-migration-lock-mismatch", "syfo.yaml", `${lockFiles[0]} requires database.migrations.command: ${expected.migration}.`);
    }
  }
  if (scalar(build, "output") !== ".fc/artifact") add("error", "manifest-output-contract", "syfo.yaml", "build.output must be .fc/artifact.");
  if (scalar(run, "command") !== "node server.js") add("error", "manifest-run-contract", "syfo.yaml", "run.command must be node server.js inside .fc/artifact.");
  if (!packageJson?.scripts?.build?.includes("assemble-next-standalone.mjs")) add("error", "build-missing-assembly", "package.json", "The build script must assemble .fc/artifact with assemble-next-standalone.mjs.");
  if (!packageJson?.scripts?.["db:migrate"]) add("error", "migration-script-missing", "package.json", "The manifest migration command requires a db:migrate package script.");
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

if (existsSync(join(root, ".fc", "artifact", "server.js"))) {
  add("info", "artifact-present", ".fc/artifact", "Run the server smoke harness against the assembled artifact.");
} else {
  add("info", "build-not-run", ".fc/artifact", "Run the production build and artifact assembly before runtime validation.");
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
