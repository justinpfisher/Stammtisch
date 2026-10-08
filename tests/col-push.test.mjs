import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pushConfigReady, isAppleMobile, inHomeScreen, pushPrerequisite,
  ONESIGNAL_SCRIPT, PILOT_QUERY
} from '../col-push.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('../data/col-push-config.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../celebration.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const worker = readFileSync(new URL('../push/onesignal/OneSignalSDKWorker.js', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/celebration-push.yml', import.meta.url), 'utf8');

const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ready = { schemaVersion: 1, mode: 'public', oneSignalAppId: uuid,
  audience: 'any_visitor_who_opts_in', source: 'celebration_of_life_only' };

test('feature is not activated without confirmed pilot and nonempty OneSignal ID', () => {
  assert.equal(config.mode, 'off');
  assert.equal(config.oneSignalAppId, '');
  assert.equal(pushConfigReady(config), false);
  assert.equal(pushConfigReady({ ...ready, mode: 'off' }), false);
  assert.equal(pushConfigReady({ ...ready, oneSignalAppId: '' }), false);
  assert.equal(pushConfigReady({ ...ready, audience: 'members_only' }), false);
  assert.equal(pushConfigReady(ready), true);
});

test('pilot is visible only with the explicit pilot URL; it is not an access-control secret', () => {
  assert.equal(PILOT_QUERY, 'colPushPilot');
  assert.equal(pushConfigReady({ ...ready, mode: 'pilot' }, ''), false);
  assert.equal(pushConfigReady({ ...ready, mode: 'pilot' }, '?colPushPilot=1'), true);
  assert.equal(pushConfigReady(ready, ''), true);
});

test('iPhone users must add the standalone page; Android browser subscription is supported', () => {
  const iphone = { userAgent: 'Mozilla iPhone OS 18', platform: 'iPhone' };
  const android = { userAgent: 'Android Chrome', platform: 'Linux' };
  assert.equal(isAppleMobile(iphone), true);
  assert.equal(isAppleMobile(android), false);
  assert.equal(inHomeScreen(iphone, () => ({ matches: false })), false);
  assert.equal(pushPrerequisite(iphone, () => ({ matches: false }), false, false), 'ios-install');
  assert.equal(pushPrerequisite({ ...iphone, standalone: true }, () => ({ matches: false }), true, true), 'ready');
  assert.equal(pushPrerequisite(android, () => ({ matches: false }), true, true), 'ready');
  assert.equal(pushPrerequisite(android, () => ({ matches: false }), true, false), 'unsupported');
});

test('manifest and OneSignal worker remain on the real Stammtisch origin and dedicated scope', () => {
  assert.equal(manifest.start_url, '/celebration.html');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/celebration.html');
  assert.ok(manifest.icons.length);
  assert.match(worker, /cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js/);
  assert.match(html, /rel="manifest" href="\/manifest.json"/);
  assert.match(html, /data-col-push hidden/);
  assert.match(html, /data-col-push-ios-help hidden/);
  assert.match(html, /data-col-push-toggle hidden/);
  assert.match(html, /col-push\.mjs/);
  assert.match(ONESIGNAL_SCRIPT, /^https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16/);
});

test('delivery has two public gating variables, avoids failed source publication, and uses retry schedule', () => {
  assert.match(workflow, /COL_PUSH_DELIVERY_MODE == 'pilot'.*workflow_dispatch/);
  assert.match(workflow, /COL_PUSH_DELIVERY_MODE == 'live'/);
  assert.match(workflow, /COL_PUSH_LIVE_APPROVED == 'true'/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /cron: '29 \* \* \* \*'/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /secrets\.COL_PUSH_ONESIGNAL_API_KEY/);
  assert.match(workflow, /secrets\.COL_PUSH_TEST_SUBSCRIPTION_IDS/);
});
