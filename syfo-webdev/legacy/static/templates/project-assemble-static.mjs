import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";

const project = process.cwd();
const source = resolve(project, "out");
const output = resolve(project, ".fc/artifact");
const serverSource = resolve(project, "scripts/static-server.mjs");
const publicOutput = resolve(output, "public");

async function collect(directory, root = directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path, root, files);
    else if (entry.isFile()) files.push({ path, name: relative(root, path) });
  }
  return files;
}

await stat(source).catch(() => {
  throw new Error("Missing out/. Run the Next.js static export build first.");
});
await stat(serverSource).catch(() => {
  throw new Error("Missing scripts/static-server.mjs.");
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, publicOutput, { recursive: true, force: true });
await cp(serverSource, resolve(output, "server.mjs"), { force: true });

const files = await collect(output);
const digest = createHash("sha256");
let bytes = 0;
for (const file of files.sort((left, right) => left.name.localeCompare(right.name))) {
  const content = await readFile(file.path);
  bytes += content.byteLength;
  digest.update(file.name);
  digest.update("\0");
  digest.update(content);
}

process.stdout.write(`${JSON.stringify({
  artifact: relative(project, output),
  serverEntry: relative(project, resolve(output, "server.mjs")),
  files: files.length,
  bytes,
  sha256: digest.digest("hex"),
}, null, 2)}\n`);
