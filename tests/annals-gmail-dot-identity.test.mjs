import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const production = readFileSync(new URL('../scripts/annals/Production.gs', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(production, context);
const resolve = (sender, allowed) => context.annalsResolveAllowedSender_(sender, allowed);

test('personal Gmail dot variants resolve to the existing configured identity', () => {
  const allowed = ['fictional.member.one@gmail.com'];
  assert.equal(resolve('fictional.memberone@gmail.com', allowed), allowed[0]);
  assert.equal(resolve(' FICTIONAL.MEMBER.ONE@GMAIL.COM ', allowed), allowed[0]);
});

test('dot matching leaves other domains and plus-address tags unchanged', () => {
  assert.equal(resolve('fictional.memberone@example.test', ['fictional.member.one@example.test']), null);
  assert.equal(resolve('fictional.member.one+club@gmail.com', ['fictional.memberone@gmail.com']), null);
  assert.equal(resolve('fictional.member.one+club@gmail.com', ['fictional.memberone+club@gmail.com']),
    'fictional.memberone+club@gmail.com');
});

test('ambiguous Gmail dot identities fail closed while exact allowlist matches remain exact', () => {
  const allowed = ['fictional.a.b.c@gmail.com', 'fictional.ab.c@gmail.com'];
  assert.equal(resolve('fictional.a.b.c@gmail.com', allowed), allowed[0]);
  assert.equal(resolve('fictional.ab.c@gmail.com', allowed), allowed[1]);
  assert.equal(resolve('fictional.abc@gmail.com', allowed), null);
  assert.equal(resolve('outsider@gmail.com', allowed), null);
});
