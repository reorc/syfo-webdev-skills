import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function description(source) {
  const raw = source.match(/^---\n[\s\S]*?^description:\s*(.+)$/mu)?.[1]?.trim();
  assert.ok(raw, 'missing skill description');
  return raw.startsWith('"') ? JSON.parse(raw) : raw;
}

const staticSkill = await readFile('syfo-webdev-static/SKILL.md', 'utf8');
const fullstackSkill = await readFile('syfo-webdev-fullstack/SKILL.md', 'utf8');
const staticDescription = description(staticSkill);
const fullstackDescription = description(fullstackSkill);

assert.match(staticDescription, /standalone or self-contained \.html/i);
assert.match(staticDescription, /Prefer this skill for ambiguous/i);
assert.match(fullstackDescription, /Do not trigger merely/i);
assert.match(fullstackDescription, /Standalone HTML/i);
assert.match(fullstackDescription, /prefer static/i);
assert.match(staticSkill, /single_html_preserve/);
assert.match(staticSkill, /single-html-fast-path\.md/);
assert.match(staticSkill, /fast validation lane/i);

const staticTriggers = JSON.parse(await readFile('syfo-webdev-static/evals/trigger-evals.json', 'utf8'));
const fullstackTriggers = JSON.parse(await readFile('syfo-webdev-fullstack/evals/trigger-evals.json', 'utf8'));
const staticCases = new Map(staticTriggers.map((entry) => [entry.query, entry.should_trigger]));
const fullstackCases = new Map(fullstackTriggers.map((entry) => [entry.query, entry.should_trigger]));
const sharedCases = [...staticCases.keys()].filter((query) => fullstackCases.has(query));

assert.ok(sharedCases.length >= 2, 'expected shared cross-skill routing cases');
for (const query of sharedCases) {
  if (/HTML|html/.test(query)) {
    assert.equal(staticCases.get(query), true, `static should trigger for: ${query}`);
    assert.equal(fullstackCases.get(query), false, `fullstack should not trigger for: ${query}`);
  }
}

console.log(`validated ${sharedCases.length} cross-skill routing cases`);
