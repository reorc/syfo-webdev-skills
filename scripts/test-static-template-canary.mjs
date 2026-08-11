import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(args) {
  const options = {
    template: process.env.SYFO_STATIC_TEMPLATE_DIR || '',
    reuseInstall: false,
    maxFiles: 500,
    maxBytes: 20 * 1024 * 1024,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--template') options.template = args[++index];
    else if (argument === '--reuse-install') options.reuseInstall = true;
    else if (argument === '--max-files') options.maxFiles = Number(args[++index]);
    else if (argument === '--max-bytes') options.maxBytes = Number(args[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.template) {
    throw new Error('Pass --template <official-web-static-checkout> or set SYFO_STATIC_TEMPLATE_DIR.');
  }
  if (!Number.isSafeInteger(options.maxFiles) || options.maxFiles <= 0) throw new Error('Invalid --max-files.');
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) throw new Error('Invalid --max-bytes.');
  return options;
}

function parseMinimumNode(range) {
  const match = String(range || '').match(/^>=(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export async function validateTemplateContract(template) {
  const packageJson = JSON.parse(await readFile(join(template, 'package.json'), 'utf8'));
  const gitignore = await readFile(join(template, '.gitignore'), 'utf8');
  const nextVersion = String(packageJson.dependencies?.next || '');
  const packageManager = String(packageJson.packageManager || '');
  const minimumNode = parseMinimumNode(packageJson.engines?.node);

  if (!/^16\.\d+\.\d+$/.test(nextVersion)) throw new Error(`Expected Next.js 16.x, found ${nextVersion || 'missing'}.`);
  if (!/^npm@10\.\d+\.\d+$/.test(packageManager)) throw new Error(`Expected exact npm 10 packageManager, found ${packageManager || 'missing'}.`);
  if (!minimumNode || minimumNode[0] < 20 || (minimumNode[0] === 20 && minimumNode[1] < 9)) {
    throw new Error(`Expected engines.node >=20.9.0 or newer, found ${packageJson.engines?.node || 'missing'}.`);
  }
  if (!/^next-env\.d\.ts$/m.test(gitignore)) throw new Error('Official template must ignore generated next-env.d.ts.');
  for (const script of ['lint', 'typecheck', 'test', 'build']) {
    if (!packageJson.scripts?.[script]) throw new Error(`Official template is missing npm script: ${script}.`);
  }

  return { nextVersion, packageManager, nodeEngine: packageJson.engines.node };
}

async function collectArtifact(directory, root = directory, summary = { files: 0, bytes: 0, textPaths: [] }) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Artifact contains symbolic link: ${relative(root, path)}`);
    if (info.isDirectory()) await collectArtifact(path, root, summary);
    else if (info.isFile()) {
      summary.files += 1;
      summary.bytes += info.size;
      const name = relative(root, path);
      if (name.startsWith(`public${process.platform === 'win32' ? '\\' : '/'}`) && name.endsWith('.txt')) {
        summary.textPaths.push(`/${relative(join(root, 'public'), path).split('\\').join('/')}`);
      }
    } else throw new Error(`Artifact contains unsupported entry: ${relative(root, path)}`);
  }
  return summary;
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

export async function runCanary(options) {
  const source = resolve(options.template);
  const contract = await validateTemplateContract(source);
  const originalStatus = gitStatus(source);
  let scratch;
  let workspace = source;

  try {
    if (!options.reuseInstall) {
      scratch = await mkdtemp(join(tmpdir(), 'syfo-static-template-canary-'));
      workspace = join(scratch, 'template');
      await cp(source, workspace, {
        recursive: true,
        filter: (path) => {
          const name = relative(source, path).split('\\').join('/');
          return !['.git', 'node_modules', '.next', 'out', '.fc'].some((entry) => name === entry || name.startsWith(`${entry}/`));
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
    const summary = await collectArtifact(artifact);
    if (summary.files > options.maxFiles) throw new Error(`Artifact has ${summary.files} files; canary limit is ${options.maxFiles}.`);
    if (summary.bytes > options.maxBytes) throw new Error(`Artifact has ${summary.bytes} bytes; canary limit is ${options.maxBytes}.`);
    if (summary.textPaths.length === 0) throw new Error('Next.js 16 static export produced no RSC text assets.');

    const smokePaths = ['/', '/about', summary.textPaths[0]];
    const smokeArgs = [join(repositoryRoot, 'syfo-webdev-static', 'scripts', 'smoke-static.mjs'), '--artifact', artifact];
    for (const path of smokePaths) smokeArgs.push('--path', path);
    run(process.execPath, smokeArgs, repositoryRoot);

    const finalStatus = gitStatus(source);
    if (originalStatus !== null && finalStatus !== originalStatus) {
      throw new Error(`Canary changed the template checkout. Before:\n${originalStatus}\nAfter:\n${finalStatus}`);
    }

    return { ...contract, artifact: { files: summary.files, bytes: summary.bytes }, smokePaths };
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const result = await runCanary(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
