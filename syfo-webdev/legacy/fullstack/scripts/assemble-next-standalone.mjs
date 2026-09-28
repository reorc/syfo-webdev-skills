import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

function parseArgs(argv) {
  const options = { project: ".", output: ".fc/artifact" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project" || argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function ensureContained(root, target, label) {
  const path = relative(root, target);
  if (path === "" || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`${label} must be a child of the project directory`);
  }
}

function copyDirectory(source, target) {
  if (!existsSync(source)) return false;
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, dereference: true, force: true });
  return true;
}

function findServerEntries(directory, root = directory, results = []) {
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".next", "public"].includes(entry)) continue;
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) findServerEntries(path, root, results);
    else if (entry === "server.js") results.push(relative(root, path));
  }
  const rootServer = join(directory, "server.js");
  if (existsSync(rootServer) && !results.includes(relative(root, rootServer))) {
    results.push(relative(root, rootServer));
  }
  return results;
}

function collectFiles(directory, root = directory, results = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) collectFiles(path, root, results);
    else results.push({ path, relativePath: relative(root, path) });
  }
  return results;
}

function hashArtifact(directory) {
  const aggregate = createHash("sha256");
  const files = collectFiles(directory)
    .filter((file) => file.relativePath !== ".syfo-artifact.json")
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  for (const file of files) {
    const fileHash = createHash("sha256").update(readFileSync(file.path)).digest("hex");
    aggregate.update(file.relativePath);
    aggregate.update("\0");
    aggregate.update(fileHash);
    aggregate.update("\n");
  }

  return { sha256: aggregate.digest("hex"), fileCount: files.length };
}

const options = parseArgs(process.argv.slice(2));
const project = resolve(options.project);
const output = resolve(project, options.output);
const standalone = join(project, ".next", "standalone");
const staticDirectory = join(project, ".next", "static");
const publicDirectory = join(project, "public");

ensureContained(project, output, "Output directory");
if (!existsSync(standalone)) {
  throw new Error(`Missing ${standalone}. Run the production build with output: standalone first.`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
copyDirectory(standalone, output);

const copiedStatic = copyDirectory(staticDirectory, join(output, ".next", "static"));
const copiedPublic = copyDirectory(publicDirectory, join(output, "public"));
const serverEntries = findServerEntries(output).sort();
const artifact = hashArtifact(output);
const manifest = {
  format: 1,
  source: relative(project, standalone),
  output: relative(project, output),
  copiedStatic,
  copiedPublic,
  serverEntries,
  fileCount: artifact.fileCount,
  sha256: artifact.sha256,
};

writeFileSync(join(output, ".syfo-artifact.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

if (serverEntries.length === 0) {
  process.stderr.write("No standalone server.js entry was found.\n");
  process.exitCode = 2;
} else if (serverEntries.length > 1) {
  process.stderr.write("Multiple server.js entries were found. Set run.command explicitly.\n");
  process.exitCode = 3;
}
