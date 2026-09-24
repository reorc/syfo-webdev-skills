#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MAX_ARTIFACT_BYTES = 70 * 1024 * 1024;
export const DEFAULT_MAX_ARTIFACT_FILES = 100_000;
const DEFAULT_TOP_N = 10;

function archivePath(path) {
  return path.split(sep).join("/");
}

function addAggregate(map, path, bytes, files = 1) {
  const current = map.get(path) ?? { path, bytes: 0, files: 0 };
  current.bytes += bytes;
  current.files += files;
  map.set(path, current);
}

function runtimeDependencyPath(path) {
  const parts = path.split("/");
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] !== "node_modules") continue;
    const end = parts[index + 1].startsWith("@") ? index + 3 : index + 2;
    if (end <= parts.length) return parts.slice(0, end).join("/");
  }
  return "";
}

function dependencyName(path) {
  const marker = "/node_modules/";
  const normalized = `/${path}`;
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return "";
  const parts = normalized.slice(index + marker.length).split("/");
  if (parts[0]?.startsWith("@")) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "";
  return parts[0] ?? "";
}

function topUsage(values, topN, byFiles = false) {
  return [...values]
    .sort((left, right) => {
      if (byFiles && left.files !== right.files) return right.files - left.files;
      if (left.bytes !== right.bytes) return right.bytes - left.bytes;
      if (!byFiles && left.files !== right.files) return right.files - left.files;
      return left.path.localeCompare(right.path);
    })
    .slice(0, topN);
}

function nativeVariantHints(dependencyNames) {
  const groups = new Map();
  for (const name of dependencyNames) {
    const match = /^(.*)-(linux|linuxmusl)-(x64|arm64)$/.exec(name);
    if (!match) continue;
    const group = `${match[1]}:${match[3]}`;
    const variants = groups.get(group) ?? [];
    variants.push(name);
    groups.set(group, variants);
  }
  return [...groups.values()]
    .filter((variants) => variants.length > 1)
    .map((variants) => ({
      code: "artifact-native-platform-variants",
      dependencies: variants.sort(),
      detail: `Runtime artifact contains multiple Linux libc variants: ${variants.sort().join(", ")}. Keep only the FC target variant during the Linux build.`,
    }));
}

export function analyzeArtifactTree(rootPath, options = {}) {
  const root = resolve(rootPath);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_ARTIFACT_FILES;
  const topN = options.topN ?? DEFAULT_TOP_N;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("artifact_budget_invalid_max_bytes");
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) throw new Error("artifact_budget_invalid_max_files");
  if (!Number.isSafeInteger(topN) || topN < 1 || topN > 100) throw new Error("artifact_budget_invalid_top_n");
  if (!existsSync(root)) throw new Error("artifact_budget_root_missing");
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("artifact_budget_root_invalid");

  const directories = new Map();
  const dependencies = new Map();
  const dependencyNames = new Set();
  const files = [];
  let fileCount = 0;
  let totalBytes = 0;

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const stat = lstatSync(path);
      const relativePath = archivePath(relative(root, path));
      if (!relativePath || relativePath === ".." || relativePath.startsWith("../")) {
        throw new Error("artifact_budget_path_invalid");
      }
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
        throw new Error(`artifact_budget_special_file:${relativePath}`);
      }
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }

      fileCount += 1;
      totalBytes += stat.size;
      files.push({ path: relativePath, bytes: stat.size, files: 1 });
      for (let current = archivePath(dirname(relative(root, path))); current !== "."; ) {
        addAggregate(directories, current, stat.size);
        const parent = archivePath(dirname(current));
        if (parent === "." || parent === current) break;
        current = parent;
      }
      const dependency = runtimeDependencyPath(relativePath);
      if (dependency) {
        addAggregate(dependencies, dependency, stat.size);
        const name = dependencyName(dependency);
        if (name) dependencyNames.add(name);
      }
    }
  }

  visit(root);
  if (fileCount === 0) throw new Error("artifact_budget_empty");

  const largestFile = topUsage(files, 1)[0];
  const limits = {
    maxFileCount: maxFiles,
    maxSingleFileBytes: maxBytes,
    maxTotalBytes: maxBytes,
  };
  const violations = [];
  if (largestFile && largestFile.bytes > maxBytes) {
    violations.push({
      code: "builder_artifact_file_too_large",
      metric: "single_file_bytes",
      actual: largestFile.bytes,
      limit: maxBytes,
      path: largestFile.path,
    });
  }
  if (fileCount > maxFiles) {
    violations.push({
      code: "builder_artifact_too_many_files",
      metric: "file_count",
      actual: fileCount,
      limit: maxFiles,
    });
  }
  if (totalBytes > maxBytes) {
    violations.push({
      code: "builder_artifact_tree_too_large",
      metric: "total_bytes",
      actual: totalBytes,
      limit: maxBytes,
    });
  }

  const hints = [];
  const buildOnlyDependencies = ["typescript", "eslint", "prettier"].filter((name) => dependencyNames.has(name));
  if (buildOnlyDependencies.length > 0) {
    hints.push({
      code: "artifact-build-only-dependencies",
      dependencies: buildOnlyDependencies,
      detail: `Runtime artifact contains commonly build-time-only dependencies: ${buildOnlyDependencies.join(", ")}. Remove them from the assembled runtime tree unless request-time code truly imports them.`,
    });
  }
  hints.push(...nativeVariantHints(dependencyNames));

  return {
    ok: violations.length === 0,
    artifact: root,
    fileCount,
    totalBytes,
    limits,
    violations,
    hints,
    topN: {
      directoriesByBytes: topUsage(directories.values(), topN),
      directoriesByFiles: topUsage(directories.values(), topN, true),
      filesByBytes: topUsage(files, topN),
      runtimeDependenciesByBytes: topUsage(dependencies.values(), topN),
      runtimeDependenciesByFiles: topUsage(dependencies.values(), topN, true),
    },
  };
}

export function formatBytes(bytes) {
  return `${bytes} B (${(bytes / (1024 * 1024)).toFixed(2)} MiB)`;
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`invalid ${option}`);
  return parsed;
}

function parseArgs(argv) {
  const options = {
    artifact: ".fc/artifact",
    maxBytes: DEFAULT_MAX_ARTIFACT_BYTES,
    maxFiles: DEFAULT_MAX_ARTIFACT_FILES,
    topN: DEFAULT_TOP_N,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--json") options.json = true;
    else if (["--artifact", "--max-bytes", "--max-files", "--top"].includes(option)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing ${option}`);
      index += 1;
      if (option === "--artifact") options.artifact = value;
      else if (option === "--max-bytes") options.maxBytes = parsePositiveInteger(value, option);
      else if (option === "--max-files") options.maxFiles = parsePositiveInteger(value, option);
      else options.topN = parsePositiveInteger(value, option);
    } else if (option === "--help" || option === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown option ${option}`);
    }
  }
  return options;
}

function printText(report) {
  const status = report.ok ? "PASS" : "FAIL";
  process.stdout.write(
    `ARTIFACT_BUDGET ${status} files=${report.fileCount}/${report.limits.maxFileCount} total=${formatBytes(report.totalBytes)}/${formatBytes(report.limits.maxTotalBytes)}\n`,
  );
  for (const violation of report.violations) {
    const path = violation.path ? ` path=${violation.path}` : "";
    process.stdout.write(`VIOLATION ${violation.code} ${violation.metric}=${violation.actual} limit=${violation.limit}${path}\n`);
  }
  for (const hint of report.hints) process.stdout.write(`HINT ${hint.code}: ${hint.detail}\n`);
  for (const entry of report.topN.runtimeDependenciesByBytes) {
    process.stdout.write(`TOP_DEPENDENCY bytes=${entry.bytes} files=${entry.files} path=${entry.path}\n`);
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write("Usage: node check-artifact-budget.mjs [--artifact .fc/artifact] [--max-bytes 73400320] [--max-files 100000] [--top 10] [--json]\n");
      return;
    }
    const report = analyzeArtifactTree(options.artifact, options);
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else printText(report);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`ARTIFACT_BUDGET ERROR ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
