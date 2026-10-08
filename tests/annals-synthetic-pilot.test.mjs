import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = ['PilotCore.js', 'SyntheticPilot.gs'].map(name =>
  readFileSync(new URL('../scripts/annals/' + name, import.meta.url), 'utf8')).join('\n');
const iterator = items => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
const privateMethods = () => ({ getSharingAccess: () => 'PRIVATE', getEditors: () => [], getViewers: () => [] });
function folder() {
  const files = new Map(), folders = new Map();
  return {
    ...privateMethods(), files, folders,
    getFiles: () => iterator([...files.values()]),
    getFilesByName: name => iterator(files.has(name) ? [files.get(name)] : []),
    getFoldersByName: name => iterator(folders.has(name) ? [folders.get(name)] : []),
    createFolder(name) { const f = folder(); folders.set(name, f); return f; },
    createFile(first, content) {
      const name = typeof first === 'string' ? first : first.name;
      const f = { ...privateMethods(), content: typeof first === 'string' ? content : 'SYNTHETIC BYTES' };
      files.set(name, f); return f;
    }
  };
}
function message({ subject = '[ANNALS SYNTHETIC PILOT] Invented cocktail', sender = 'tester@example.test',
  body = 'Synthetic recipe: 1/2 oz syrup. <script>alert(1)</script>', sizes = [20] } = {}) {
  const reads = { body: 0, media: 0 };
  return {
    reads, getId: () => 'synthetic-message-001', getFrom: () => sender, getSubject: () => subject,
    getDate: () => new Date('2026-10-08T20:00:00Z'),
    getPlainBody() { reads.body++; return body; },
    getAttachments() { reads.media++; return sizes.map(size => ({
      getContentType: () => 'image/jpeg', getSize: () => size,
      copyBlob: () => ({ setName(name) { return { name }; } })
    })); }
  };
}
function sandbox(messages = [message()], changes = {}) {
  const root = folder(), logs = [], calls = { gmail: 0, drive: 0 };
  const properties = {
    ANNALS_SYNTHETIC_PILOT_ENABLED: 'true', ANNALS_SYNTHETIC_READ_APPROVED: 'true',
    ANNALS_PRIVATE_FOLDER_ID: 'synthetic-folder', ANNALS_ALLOWED_SENDERS: 'tester@example.test',
    ANNALS_INTAKE_ENABLED: 'false', ANNALS_ALLOW_PRODUCTION_MAIL: 'false', ...changes
  };
  const context = {
    console: { log: text => logs.push(text) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    DriveApp: { Access: { PRIVATE: 'PRIVATE' }, getFolderById: () => { calls.drive++; return root; } },
    GmailApp: { getUserLabelByName(name) {
      calls.gmail++; assert.equal(name, 'Annals-Pilot');
      return { getThreads(start, count) {
        assert.equal(start, 0); assert.equal(count, 10);
        return [{ getMessages: () => messages }];
      } };
    } },
    MimeType: { HTML: 'text/html', PLAIN_TEXT: 'text/plain' },
    Utilities: { DigestAlgorithm: { SHA_256: 'SHA_256' }, computeDigest: (_, value) => [...createHash('sha256').update(value).digest()] }
  };
  vm.createContext(context); vm.runInContext(source, context);
  return { context, root, logs, calls, properties };
}

test('both synthetic gates are required and production gates must be off before account access', () => {
  for (const key of ['ANNALS_SYNTHETIC_PILOT_ENABLED', 'ANNALS_SYNTHETIC_READ_APPROVED']) {
    const x = sandbox([], { [key]: 'false' });
    assert.equal(x.context.runAnnalsSyntheticPilot().enabled, false);
    assert.deepEqual(x.calls, { gmail: 0, drive: 0 });
  }
  for (const key of ['ANNALS_INTAKE_ENABLED', 'ANNALS_ALLOW_PRODUCTION_MAIL']) {
    const x = sandbox([], { [key]: 'true' });
    assert.throws(() => x.context.runAnnalsSyntheticPilot(), /production gates/);
    assert.deepEqual(x.calls, { gmail: 0, drive: 0 });
  }
});

test('unmarked replies in a labelled thread and unknown senders cannot have bodies/media read', () => {
  const ordinary = message({ subject: 'Private ordinary reply' });
  const stranger = message({ sender: 'unknown@example.test' });
  const x = sandbox([ordinary, stranger]);
  assert.equal(x.context.runAnnalsSyntheticPilot().skipped, 2);
  for (const m of [ordinary, stranger]) assert.deepEqual(m.reads, { body: 0, media: 0 });
  assert.equal(x.root.folders.size, 0);
});

test('synthetic message gets one private escaped preview and repeat does not duplicate or reread body', () => {
  const m = message(), x = sandbox([m]);
  assert.equal(x.context.runAnnalsSyntheticPilot().staged, 1);
  const f = [...x.root.folders.values()][0];
  assert.equal(f.files.size, 3);
  const html = f.files.get('preview-private.html').content;
  assert.match(html, /Not approved for publication/);
  assert.match(html, /1\/2 oz syrup/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|tester@example/);
  assert.equal(JSON.parse(f.files.get('manifest-private.json').content).publishable, false);
  assert.equal(x.context.runAnnalsSyntheticPilot().duplicates, 1);
  assert.equal(x.root.folders.size, 1); assert.equal(f.files.size, 3);
  assert.deepEqual(m.reads, { body: 1, media: 1 });
  assert.doesNotMatch(x.logs.join(''), /tester@example|1\/2 oz|synthetic-folder/);
});

test('shared root, shared child or shared completed output stop safely', () => {
  const x = sandbox(); x.root.getViewers = () => ['someone'];
  assert.throws(() => x.context.runAnnalsSyntheticPilot(), /stopped/);
  assert.equal(x.calls.gmail, 0);
  for (const target of ['folder', 'file']) {
    const y = sandbox(); y.context.runAnnalsSyntheticPilot();
    const f = [...y.root.folders.values()][0];
    const item = target === 'folder' ? f : f.files.get('preview-private.html');
    item.getSharingAccess = () => 'ANYONE_WITH_LINK';
    assert.throws(() => y.context.runAnnalsSyntheticPilot(), /stopped/);
  }
});

test('aggregate attachment limit holds without copying individually valid media', () => {
  const x = sandbox([message({ sizes: [8, 8, 8].map(n => n * 1024 * 1024) })]);
  assert.equal(x.context.runAnnalsSyntheticPilot().held, 1);
  const f = [...x.root.folders.values()][0];
  assert.deepEqual([...f.files.keys()].sort(), ['manifest-private.json', 'preview-private.html']);
});

test('interruption before final manifest can be retried without duplicate media or preview', () => {
  const x = sandbox(); const original = x.root.createFolder;
  let failOnce = true;
  x.root.createFolder = name => {
    const f = original.call(x.root, name), create = f.createFile;
    f.createFile = (first, content) => {
      if (first === 'manifest-private.json' && failOnce) { failOnce = false; throw new Error('PRIVATE provider detail'); }
      return create.call(f, first, content);
    };
    return f;
  };
  assert.throws(() => x.context.runAnnalsSyntheticPilot(), error => {
    assert.doesNotMatch(error.message, /PRIVATE provider detail/); return /stopped/.test(error.message);
  });
  assert.equal(x.context.runAnnalsSyntheticPilot().staged, 1);
  assert.equal([...x.root.folders.values()][0].files.size, 3);
});
