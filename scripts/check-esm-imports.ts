import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const CLI_SAFE_ARGS = ['--', '--version'];

const requestedDirs = process.argv.slice(2);
const packageDirs =
  requestedDirs.length > 0
    ? requestedDirs.map((dir) => resolve(process.cwd(), dir))
    : readdirSync(PACKAGES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(PACKAGES_DIR, d.name));

interface Failure {
  packageName: string;
  error: string;
}

const failures: Failure[] = [];
let checked = 0;

for (const packageDir of packageDirs) {
  const pkgJsonPath = join(packageDir, 'package.json');
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as {
    name?: string;
    private?: boolean;
  };

  if (pkg.private === true || !pkg.name) continue;

  checked++;
  try {
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `await import('${pkg.name}')`, ...CLI_SAFE_ARGS],
      {
        cwd: packageDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      }
    );
  } catch (err: unknown) {
    const { stderr, stdout, message } = err as Error & {
      stderr?: string;
      stdout?: string;
    };
    const errorOutput = stderr?.trim() || stdout?.trim() || message;

    failures.push({
      packageName: pkg.name,
      error: errorOutput,
    });
  }
}

if (failures.length > 0) {
  console.error(`Failed to load ${failures.length} package(s) with plain Node:\n`);
  for (const failure of failures) {
    console.error(`- ${failure.packageName}:`);
    console.error(failure.error ? failure.error.replace(/^/gm, '    ') : '    Unknown error');
    console.error('');
  }
  process.exit(1);
}

console.log(`Verified ${checked} package(s) load successfully with plain Node`);
