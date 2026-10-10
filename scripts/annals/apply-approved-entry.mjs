import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublishedAnnals, validatePublicTextEntry, verifyPublicApproval } from './ApprovedRenderer.mjs';

export async function applyApprovedEntry({ event, data, secret }) {
  if (!event || event.event_type !== 'annals-approved-entry' || !event.client_payload ||
      Object.keys(event.client_payload).sort().join(',') !== 'approval,entry') throw new Error('Invalid dispatch event');
  const entry = validatePublicTextEntry(event.client_payload.entry);
  const approval = event.client_payload.approval;
  if (!verifyPublicApproval(entry, approval, secret)) throw new Error('Missing exact public approval');
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.approvals) ||
      Object.keys(data).some(k => !['schemaVersion', 'entries', 'approvals'].includes(k))) throw new Error('Invalid public archive');
  const entries = data.entries.map(validatePublicTextEntry);
  if (entries.some(item => item.id === entry.id) || data.approvals.some(item => item.entryId === entry.id)) {
    throw new Error('Entry already exists; no duplicate publication');
  }
  const nextEntries = [...entries, entry], nextApprovals = [...data.approvals, approval];
  const rendered = buildPublishedAnnals(nextEntries, nextApprovals, secret);
  return { data: { schemaVersion: 1, entries: nextEntries, approvals: nextApprovals }, html: rendered.html };
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const dataPath = 'data/annals-approved.json';
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const result = await applyApprovedEntry({ event, data, secret: process.env.ANNALS_PUBLISH_SIGNING_KEY });
  await writeFile(dataPath, JSON.stringify(result.data, null, 2) + '\n');
  await writeFile('annals.html', result.html + '\n');
  console.log('Approved Annals entry rendered.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Approved Annals publish rejected; no private details logged.'); process.exitCode = 1; });
}
