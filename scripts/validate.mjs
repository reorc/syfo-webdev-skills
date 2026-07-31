import { access, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const skills = ['syfo-webdev-static', 'syfo-webdev-fullstack'];

for (const skill of skills) {
  const root = join(process.cwd(), skill);
  await access(join(root, 'SKILL.md'), constants.R_OK);
  await access(join(root, 'scripts'), constants.R_OK);
  await access(join(root, 'references'), constants.R_OK);

  const source = await readFile(join(root, 'SKILL.md'), 'utf8');
  if (!source.startsWith('---\n') || !source.includes(`\nname: ${skill}\n`)) {
    throw new Error(`${skill}/SKILL.md has an invalid frontmatter name`);
  }

  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u)?.[1];
  const rawDescription = frontmatter
    ?.split('\n')
    .find((line) => line.startsWith('description:'))
    ?.slice('description:'.length)
    .trim();
  if (!rawDescription) {
    throw new Error(`${skill}/SKILL.md is missing a single-line description`);
  }
  const description = rawDescription.startsWith('"')
    ? JSON.parse(rawDescription)
    : rawDescription;
  if (description.length > 1024) {
    throw new Error(`${skill}/SKILL.md description exceeds 1024 characters`);
  }

  const taskEvals = JSON.parse(await readFile(join(root, 'evals', 'evals.json'), 'utf8'));
  if (taskEvals.skill_name !== skill || !Array.isArray(taskEvals.evals) || taskEvals.evals.length === 0) {
    throw new Error(`${skill}/evals/evals.json has an invalid task eval set`);
  }

  const triggerEvals = JSON.parse(await readFile(join(root, 'evals', 'trigger-evals.json'), 'utf8'));
  if (
    !Array.isArray(triggerEvals)
    || !triggerEvals.some((entry) => entry.should_trigger === true)
    || !triggerEvals.some((entry) => entry.should_trigger === false)
  ) {
    throw new Error(`${skill}/evals/trigger-evals.json must include positive and negative cases`);
  }
}

async function collectMjs(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectMjs(path)));
    else if (entry.name.endsWith('.mjs')) files.push(path);
  }
  return files;
}

for (const file of await collectMjs(process.cwd())) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${file} failed syntax validation:\n${result.stderr}`);
  }
}

console.log(`validated ${skills.length} skills`);
