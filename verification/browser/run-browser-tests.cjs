const { spawnSync } = require('node:child_process');
const { existsSync, cpSync } = require('node:fs');
const result = spawnSync('npm', ['--prefix', '../..', 'run', 'test:e2e'], { stdio: 'inherit' });
for (const directory of ['playwright-report', 'test-results']) {
  if (existsSync('../../' + directory)) cpSync('../../' + directory, directory, { recursive: true });
}
process.exitCode = result.status ?? 1;
