/* Offline approved-only preparation. Does not commit, publish, or send mail. */
import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApprovedAnnals, validatePublicTextEntry } from './ApprovedRenderer.mjs';

export function prepareApprovedBundle(bundle, previous, secret) {
  if (!bundle || Object.keys(bundle).some(k => !['entries', 'receipts'].includes(k)) ||
      !previous || !Array.isArray(previous.entries)) throw new Error('Invalid publication input');
  const rendered = buildApprovedAnnals(bundle.entries, bundle.receipts, secret);
  const entries = bundle.entries.map(validatePublicTextEntry);
  const previousIds = previous.entries.map(validatePublicTextEntry).map(e => e.id);
  if (new Set(previousIds).size !== previousIds.length || previousIds.some(id => !entries.some(e => e.id === id))) {
    throw new Error('Existing entries must be preserved; merge private approved bundles before rebuilding');
  }
  return { html: rendered.html, data: { schemaVersion: 1, entries }, count: rendered.entryCount };
}

async function outsideRepository(target, existing) {
  const repository = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const resolved = existing ? await realpath(target) : path.join(await realpath(path.dirname(target)), path.basename(target));
  if (resolved === repository || resolved.startsWith(repository + path.sep)) throw new Error('Private inputs and output directory must be outside the repository');
  return resolved;
}

async function main() {
  const [bundleArg, previousArg, outputArg] = process.argv.slice(2);
  if (!bundleArg || !previousArg || !outputArg || process.argv.length !== 5 || !path.isAbsolute(outputArg)) {
    throw new Error('Usage: node prepare-publication.mjs PRIVATE_BUNDLE EXISTING_PUBLIC_JSON_OR_NEW ABSOLUTE_NEW_OUTPUT_DIRECTORY');
  }
  const bundlePath = await outsideRepository(bundleArg, true);
  const output = await outsideRepository(outputArg, false);
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  const previous = previousArg === 'NEW' ? { entries: [] } : JSON.parse(await readFile(previousArg, 'utf8'));
  const result = prepareApprovedBundle(bundle, previous, process.env.ANNALS_APPROVAL_KEY);
  await mkdir(output); // Never overwrite an existing directory or artifact.
  await writeFile(path.join(output, 'annals.html'), result.html, { flag: 'wx' });
  await writeFile(path.join(output, 'annals-approved.json'), JSON.stringify(result.data, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ preparedEntries: result.count, published: false }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Approved publication preparation stopped. Check private inputs and configuration locally.'); process.exitCode = 1; });
}
