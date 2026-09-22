import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../supabase/freeze-functions.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const allowedArgs = new Set(['--execute', '--dry-run']);
const selected = args.filter(arg => !allowedArgs.has(arg));
const functions = selected.length ? selected : manifest.functions;
// Every invocation is named. Never invoke `supabase functions deploy` bare.
for (const name of functions) {
  if (!manifest.functions.includes(name)) throw new Error(`Not in the freeze manifest: ${name}`);
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
console.log(`Freeze backend: project=${manifest.projectRef}, commit=${commit}`);
if (execute) {
  if (process.env.PREPIO_DEPLOY_COMMIT !== commit) {
    throw new Error('Set PREPIO_DEPLOY_COMMIT to the full reviewed HEAD SHA before deployment.');
  }
  if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
    throw new Error('Refusing deployment from a dirty checkout.');
  }
}
for (const name of functions) {
  const command = ['functions', 'deploy', name, '--project-ref', manifest.projectRef];
  console.log(`supabase ${command.join(' ')}`);
  if (execute) {
    const result = spawnSync('supabase', command, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Deployment failed for ${name}; stop and record partial deployment before recovery.`);
  }
}
if (!execute) console.log('Dry run only. Complete docs/FREEZE_RELEASE.md before using --execute.');
