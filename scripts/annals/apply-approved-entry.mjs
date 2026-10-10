import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublishedAnnals, contentDigest, validatePublicTextEntry, verifyPublicApproval, verifyPublicRemoval } from './ApprovedRenderer.mjs';

function approvedPhoto(entry, base64) {
  if (!entry.photo) {
    if (base64 !== undefined) throw new Error('Unexpected image payload');
    return null;
  }
  if (typeof base64 !== 'string' || base64.length > 44000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Invalid image payload');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 32768 || bytes.toString('base64') !== base64 || createHash('sha256').update(bytes).digest('hex') !== entry.photo.sha256) throw new Error('Image digest mismatch');
  if (bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error('Unsupported image');
  let offset = 2, width = 0, height = 0;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) throw new Error('Malformed JPEG');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) break;
    if (marker === 0xd9 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 1 >= bytes.length) throw new Error('Malformed JPEG');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length || (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) throw new Error('JPEG metadata or malformed segment');
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5);
    }
    offset += length;
  }
  if (!width || !height || width > 1200 || height > 1200) throw new Error('Photo derivative dimensions are invalid');
  return bytes;
}

export async function applyApprovedEntry({ event, data, secret }) {
  const actions = ['annals-approved-entry', 'annals-auto-entry', 'annals-correct-entry', 'annals-remove-entry'];
  if (!event || !actions.includes(event.action) || !event.client_payload) throw new Error('Invalid dispatch event');
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.approvals) ||
      Object.keys(data).some(k => !['schemaVersion', 'entries', 'approvals'].includes(k))) throw new Error('Invalid public archive');
  const entries = data.entries.map(validatePublicTextEntry);
  const approvals = [...data.approvals];
  const assetsToWrite = [], assetsToDelete = [];
  // Refuse to mutate an archive that already contains invalid public approvals.
  buildPublishedAnnals(entries, approvals, secret);
  if (event.action === 'annals-remove-entry') {
    if (Object.keys(event.client_payload).sort().join(',') !== 'approval,entryId') throw new Error('Invalid removal payload');
    const index = entries.findIndex(item => item.id === event.client_payload.entryId);
    const approvalIndex = approvals.findIndex(item => item?.entryId === event.client_payload.entryId);
    if (index < 0 || approvalIndex < 0 || !verifyPublicRemoval(entries[index], event.client_payload.approval, secret)) throw new Error('Missing exact removal approval');
    entries.splice(index, 1); approvals.splice(approvalIndex, 1);
    const result = buildPublishedAnnals(entries, approvals, secret);
    return { data: { schemaVersion: 1, entries, approvals }, html: result.html,
      assetsToDelete: [{ path: `assets/annals/${event.client_payload.entryId}.jpg` }], assetsToWrite: [] };
  } else {
    const keys = Object.keys(event.client_payload).sort().join(',');
    if (keys !== 'approval,entry' && keys !== 'approval,entry,imageBase64') throw new Error('Invalid entry payload');
    const entry = validatePublicTextEntry(event.client_payload.entry), approval = event.client_payload.approval;
    if (!verifyPublicApproval(entry, approval, secret)) throw new Error('Missing exact public approval');
    if (event.action === 'annals-auto-entry') {
      if ((approval.mode === 'standing-consent-text-v1' && (entry.photo || event.client_payload.imageBase64 !== undefined)) ||
          (approval.mode === 'standing-consent-image-v1' && (!entry.photo || event.client_payload.imageBase64 === undefined)) ||
          !['standing-consent-text-v1','standing-consent-image-v1'].includes(approval.mode))
        throw new Error('Automated publication requires signed standing-consent proof and bounded media');
    } else if (approval.mode !== undefined) {
      throw new Error('Standing-consent proof cannot be reused for manual publication or correction');
    }
    const imageBytes = approvedPhoto(entry, event.client_payload.imageBase64);
    const index = entries.findIndex(item => item.id === entry.id);
    if (event.action === 'annals-approved-entry' || event.action === 'annals-auto-entry') {
      if (index >= 0 || approvals.some(item => item.entryId === entry.id)) throw new Error('Entry already exists; no duplicate publication');
      entries.push(entry); approvals.push(approval);
    } else {
      const approvalIndex = approvals.findIndex(item => item?.entryId === entry.id);
      if (index < 0 || approvalIndex < 0 || contentDigest(entries[index]) === contentDigest(entry)) {
        throw new Error('Correction must replace an existing entry with changed exact text');
      }
      if (entries[index].photo && !entry.photo) assetsToDelete.push({ path: `assets/annals/${entry.id}.jpg` });
      entries[index] = entry; approvals[approvalIndex] = approval;
    }
    if (imageBytes) assetsToWrite.push({ path: `assets/annals/${entry.id}.jpg`, bytes: imageBytes });
  }
  const rendered = buildPublishedAnnals(entries, approvals, secret);
  return { data: { schemaVersion: 1, entries, approvals }, html: rendered.html, assetsToWrite, assetsToDelete };
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const dataPath = 'data/annals-approved.json';
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const result = await applyApprovedEntry({ event, data, secret: process.env.ANNALS_PUBLISH_SIGNING_KEY });
  for (const item of result.assetsToDelete) await rm(item.path, { force: true });
  for (const item of result.assetsToWrite) { await mkdir(path.dirname(item.path), { recursive: true }); await writeFile(item.path, item.bytes); }
  await writeFile(dataPath, JSON.stringify(result.data, null, 2) + '\n');
  await writeFile('annals.html', result.html + '\n');
  console.log('Approved Annals entry rendered.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Approved Annals publish rejected; no private details logged.'); process.exitCode = 1; });
}
