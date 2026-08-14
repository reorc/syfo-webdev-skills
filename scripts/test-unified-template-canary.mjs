import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeArtifactTree } from '../syfo-webdev/scripts/check-artifact-budget.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(args) {
  const options = { template: process.env.SYFO_UNIFIED_TEMPLATE_DIR || '', reuseInstall: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--template') options.template = args[++index];
    else if (argument === '--reuse-install') options.reuseInstall = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.template) {
    throw new Error('Pass --template <official-web-unified-checkout> or set SYFO_UNIFIED_TEMPLATE_DIR.');
  }
  return options;
}

function parseMinimumNode(range) {
  const match = String(range || '').match(/^>=(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export async function validateUnifiedTemplateContract(template) {
  const packageJson = JSON.parse(await readFile(join(template, 'package.json'), 'utf8'));
  const gitignore = await readFile(join(template, '.gitignore'), 'utf8');
  const nextConfig = await readFile(join(template, 'next.config.ts'), 'utf8');
  const proxy = await readFile(join(template, 'proxy.ts'), 'utf8');
  const manifest = await readFile(join(template, 'syfo.yaml'), 'utf8');
  const templateJson = JSON.parse(await readFile(join(template, 'template.json'), 'utf8'));
  const nextVersion = String(packageJson.dependencies?.next || '');
  const packageManager = String(packageJson.packageManager || '');
  const minimumNode = parseMinimumNode(packageJson.engines?.node);

  if (!/^16\.\d+\.\d+$/.test(nextVersion)) throw new Error(`Expected Next.js 16.x, found ${nextVersion || 'missing'}.`);
  if (!/^npm@10\.\d+\.\d+$/.test(packageManager)) throw new Error(`Expected exact npm 10 packageManager, found ${packageManager || 'missing'}.`);
  if (!minimumNode || minimumNode[0] < 20 || (minimumNode[0] === 20 && minimumNode[1] < 9)) {
    throw new Error(`Expected engines.node >=20.9.0 or newer, found ${packageJson.engines?.node || 'missing'}.`);
  }
  if (!/^next-env\.d\.ts$/m.test(gitignore)) throw new Error('Official template must ignore generated next-env.d.ts.');
  if (!/output\s*:\s*["']standalone["']/.test(nextConfig)) throw new Error('Official template must use output: standalone.');
  if (/webpack\s*:/.test(nextConfig)) throw new Error('Next.js 16 template must not restore the obsolete edge webpack workaround.');
  if (!/export default async function proxy/.test(proxy)) throw new Error('Next.js 16 template must expose proxy.ts.');
  if (!packageJson.dependencies?.mysql2) throw new Error('Official unified template must keep its optional TiDB-compatible driver.');
  if (!/^\s*id:\s*web-unified\s*$/m.test(manifest)) throw new Error('Official unified template must declare template.id: web-unified.');
  if (!/^\s*required:\s*false\s*$/m.test(manifest)) throw new Error('Official unified template baseline must keep database.required: false.');
  if (templateJson.id !== 'web-unified' || templateJson.kind !== 'unified') {
    throw new Error('Official unified template.json must declare id=web-unified and kind=unified.');
  }
  for (const script of ['lint', 'typecheck', 'test', 'build', 'db:migrate']) {
    if (!packageJson.scripts?.[script]) throw new Error(`Official template is missing npm script: ${script}.`);
  }

  return { nextVersion, packageManager, nodeEngine: packageJson.engines.node };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit status ${result.status}.`);
}

function gitStatus(directory) {
  const result = spawnSync('git', ['-C', directory, 'status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout : null;
}

export async function runUnifiedCanary(options) {
  const source = resolve(options.template);
  const contract = await validateUnifiedTemplateContract(source);
  const originalStatus = gitStatus(source);
  let scratch;
  let workspace = source;

  try {
    if (!options.reuseInstall) {
      scratch = await mkdtemp(join(tmpdir(), 'syfo-unified-template-canary-'));
      workspace = join(scratch, 'template');
      await cp(source, workspace, {
        recursive: true,
        filter: (path) => {
          const name = relative(source, path).split('\\').join('/');
          return !['.git', 'node_modules', '.next', '.fc'].some((entry) => name === entry || name.startsWith(`${entry}/`));
        },
      });
      const npmVersion = contract.packageManager.slice('npm@'.length);
      run('npx', ['--yes', `npm@${npmVersion}`, 'ci'], workspace);
    }

    const npmVersion = contract.packageManager.slice('npm@'.length);
    for (const script of ['lint', 'typecheck', 'test', 'build']) {
      run('npx', ['--yes', `npm@${npmVersion}`, 'run', script], workspace);
    }

    const artifact = join(workspace, '.fc', 'artifact');
    const budget = analyzeArtifactTree(artifact);
    if (!budget.ok) {
      throw new Error(`Unified artifact exceeds Builder budget: ${JSON.stringify(budget.violations)}`);
    }

    const port = 9500 + Math.floor(Math.random() * 400);
    run(
      process.execPath,
      [
        join(repositoryRoot, 'syfo-webdev', 'scripts', 'smoke-server.mjs'),
        '--port', String(port),
        '--cwd', artifact,
        '--path', '/auth/start',
        '--path', '/',
        '--',
        process.execPath,
        'server.js',
      ],
      repositoryRoot,
    );

    const finalStatus = gitStatus(source);
    if (originalStatus !== null && finalStatus !== originalStatus) {
      throw new Error(`Canary changed the template checkout. Before:\n${originalStatus}\nAfter:\n${finalStatus}`);
    }

    return {
      ...contract,
      artifact: { files: budget.fileCount, bytes: budget.totalBytes },
      smokePaths: ['/auth/start', '/'],
    };
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runUnifiedCanary(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
