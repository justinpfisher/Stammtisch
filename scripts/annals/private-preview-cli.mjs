#!/usr/bin/env node
/* Developer-only, offline private preview. No emails are read or sent, no AI
 * requests are made, and no approved content is published.
 *
 * Usage:
 *   node scripts/annals/private-preview-cli.mjs source.json candidate.json /private/path/preview.html
 * The output path must be OUTSIDE the public Stammtisch repository.
 */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPrivatePreview } from './PrivatePreview.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function isUnderRepo(path) {
  const rel = relative(repoRoot, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function writePreview(sourceFile, candidateFile, outputFile) {
  if (![sourceFile, candidateFile, outputFile].every(x => typeof x === 'string' && x.length)) {
    throw new Error('Expected private source, candidate and output paths');
  }
  const sourcePath = realpathSync(sourceFile);
  const candidatePath = realpathSync(candidateFile);
  const outputDir = realpathSync(dirname(outputFile));
  const output = resolve(outputDir, outputFile.split(/[\\/]/).pop());
  if (isUnderRepo(outputDir) || isUnderRepo(output)) {
    throw new Error('Refusing to write PRIVATE preview inside the public repository');
  }
  if (!output.endsWith('.html')) throw new Error('Preview destination must be .html');
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
  const page = renderPrivatePreview(candidate, source);
  // Existing output cannot silently be overwritten after a revised approval.
  writeFileSync(output, page, { mode: 0o600, flag: 'wx' });
  return { written: true }; // Never return paths, names or private content to logs.
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    writePreview(process.argv[2], process.argv[3], process.argv[4]);
    process.stdout.write('Private HTML preview written outside the repository. No publication occurred.\n');
  } catch (error) {
    process.stderr.write('Preview not written; check paths, private source, and candidate format.\n');
    process.exitCode = 1;
  }
}
