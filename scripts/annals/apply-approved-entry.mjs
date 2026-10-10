import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublishedAnnals, contentDigest, validatePublicTextEntry, verifyPublicApproval, verifyPublicRemoval } from './ApprovedRenderer.mjs';

export async function applyApprovedEntry({ event, data, secret }) {
  const actions = ['annals-approved-entry', 'annals-correct-entry', 'annals-remove-entry'];
  if (!event || !actions.includes(event.action) || !event.client_payload) throw new Error('Invalid dispatch event');
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.approvals) ||
      Object.keys(data).some(k => !['schemaVersion', 'entries', 'approvals'].includes(k))) throw new Error('Invalid public archive');
  const entries = data.entries.map(validatePublicTextEntry);
  const approvals = [...data.approvals];
  // Refuse to mutate an archive that already contains invalid public approvals.
  buildPublishedAnnals(entries, approvals, secret);
  if (event.action === 'annals-remove-entry') {
    if (Object.keys(event.client_payload).sort().join(',') !== 'approval,entryId') throw new Error('Invalid removal payload');
    const index = entries.findIndex(item => item.id === event.client_payload.entryId);
    const approvalIndex = approvals.findIndex(item => item?.entryId === event.client_payload.entryId);
    if (index < 0 || approvalIndex < 0 || !verifyPublicRemoval(entries[index], event.client_payload.approval, secret)) throw new Error('Missing exact removal approval');
    entries.splice(index, 1); approvals.splice(approvalIndex, 1);
  } else {
    if (Object.keys(event.client_payload).sort().join(',') !== 'approval,entry') throw new Error('Invalid entry payload');
    const entry = validatePublicTextEntry(event.client_payload.entry), approval = event.client_payload.approval;
    if (!verifyPublicApproval(entry, approval, secret)) throw new Error('Missing exact public approval');
    const index = entries.findIndex(item => item.id === entry.id);
    if (event.action === 'annals-approved-entry') {
      if (index >= 0 || approvals.some(item => item.entryId === entry.id)) throw new Error('Entry already exists; no duplicate publication');
      entries.push(entry); approvals.push(approval);
    } else {
      const approvalIndex = approvals.findIndex(item => item?.entryId === entry.id);
      if (index < 0 || approvalIndex < 0 || contentDigest(entries[index]) === contentDigest(entry)) {
        throw new Error('Correction must replace an existing entry with changed exact text');
      }
      entries[index] = entry; approvals[approvalIndex] = approval;
    }
  }
  const rendered = buildPublishedAnnals(entries, approvals, secret);
  return { data: { schemaVersion: 1, entries, approvals }, html: rendered.html };
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

