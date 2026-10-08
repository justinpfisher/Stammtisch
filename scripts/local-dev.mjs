#!/usr/bin/env node
// Local-only development helper: never contacts Google Sheets, OneSignal, or GitHub APIs.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const task = process.argv[2] ?? 'check';
const extra = process.argv.slice(3);

function usage() {
  console.log('Stammtisch local development (GMKtec preferred)');
  console.log('  node scripts/local-dev.mjs doctor       Check local prerequisites and repository origin');
  console.log('  node scripts/local-dev.mjs check        Run Python and Node regression tests');
  console.log('  node scripts/local-dev.mjs preview [port] Serve website on 127.0.0.1 (default 8765)');
  console.log('No command publishes the website or sends notifications.');
}

function pythonCommand() {
  const candidates = process.platform === 'win32'
    ? [['py', ['-3.12']], ['py', ['-3']], ['python', []]]
    : [['python3.12', []], ['python3', []], ['python', []]];
  for (const [executable, prefix] of candidates) {
    const probe = spawnSync(executable, [...prefix, '--version'], {
      cwd: root, encoding: 'utf8', windowsHide: true,
    });
    if (probe.status !== 0) continue;
    const match = /Python (\d+)\.(\d+)/.exec((probe.stdout ?? '') + (probe.stderr ?? ''));
    if (match && Number(match[1]) === 3 && Number(match[2]) >= 12) {
      return { executable, prefix, version: match[0] };
    }
  }
  return null;
}

function expectedGitOrigin() {
  // Check without printing the origin, which could contain an embedded credential.
  const probe = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
  return probe.status === 0 &&
    /(?:^|[/:])justinpfisher\/Stammtisch(?:\.git)?$/i.test((probe.stdout ?? '').trim());
}

function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('Command stopped; no publication or notification was attempted.');
    process.exit(result.status || 1);
  }
}

if (task === 'help' || task === '--help' || task === '-h') {
  if (extra.length) process.exit(2);
  usage();
} else if (task !== 'doctor' && task !== 'check' && task !== 'preview') {
  usage();
  console.error('Unknown task: ' + task);
  process.exit(2);
} else {
  if (extra.length > (task === 'preview' ? 1 : 0)) {
    usage();
    process.exit(2);
  }
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeReady = nodeMajor >= 22;
  const python = pythonCommand();
  if (task === 'doctor') {
    const originReady = expectedGitOrigin();
    console.log('Local repository: ' + root);
    console.log('Node: ' + process.version + (nodeReady ? ' (OK)' : ' (requires 22+)'));
    console.log('Python: ' + (python?.version ?? 'missing Python 3.12+'));
    console.log('Git origin matches justinpfisher/Stammtisch: ' + (originReady ? 'yes' : 'no'));
    console.log('Live workflows: GitHub-hosted; GMKtec is for interactive local work only.');
    if (!nodeReady || !python || !originReady) process.exitCode = 1;
  } else {
    if (!nodeReady) {
      console.error('Node.js 22 or later is required; GitHub CI currently uses Node 22.');
      process.exit(1);
    }
    if (!python) {
      console.error('Python 3.12 or later is required for local checks and previews.');
      process.exit(1);
    }
    if (task === 'check') {
      if (extra.length) process.exit(2);
      console.log('Running offline regression tests from ' + root);
      run(python.executable, [...python.prefix, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']);
      const testFiles = readdirSync(join(root, 'tests'))
        .filter((name) => name.endsWith('.test.mjs'))
        .sort()
        .map((name) => join(root, 'tests', name));
      if (!testFiles.length) {
        console.error('No Node tests found; refusing to report success.');
        process.exit(1);
      }
      run(process.execPath, ['--test', ...testFiles]);
      console.log('All local regression checks passed. No website changes were published.');
    } else {
      const port = extra.length ? Number(extra[0]) : 8765;
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        console.error('Preview port must be an integer from 1024 to 65535.');
        process.exit(2);
      }
      console.log('Preview: http://127.0.0.1:' + port + '/celebration.html');
      console.log('This serves only this computer. Stop with Ctrl+C.');
      run(python.executable, [...python.prefix, '-m', 'http.server', String(port), '--bind', '127.0.0.1']);
    }
  }
}
