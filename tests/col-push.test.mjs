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

test('feature is gated by explicit rollout mode, UUID and correct public audience', () => {
  assert.ok(['off', 'pilot', 'public'].includes(config.mode));
  if (config.mode === 'off') {
    assert.equal(pushConfigReady(config), false);
  } else {
    assert.match(config.oneSignalAppId, /^[0-9a-f]{8}-/i);
  }
  assert.equal(pushConfigReady({ ...ready, mode: 'off' }), false);
  assert.equal(pushConfigReady({ ...ready, oneSignalAppId: '' }), false);
  assert.equal(pushConfigReady({ ...ready, audience: 'members_only' }), false);
  assert.equal(pushConfigReady(ready), true);
});

test('pilot is visible only with the explicit pilot URL; it is not an access-control secret', () => {
  assert.equal(PILOT_QUERY, 'colPushPilot');
  assert.equal(pushConfigReady({ ...ready, mode: 'pilot' }, ''), false);
  assert.equal(pushConfigReady({ ...ready, mode: 'pilot' }, '?colPushPilot=1'), true);
  assert.equal(pushConfigReady({ ...ready, mode: 'pilot' }, '', true), true); // iOS standalone launch
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
  assert.match(html, /id="notifications" data-col-push/);
  assert.match(html, /data-col-push-ios-help/);
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


test('subscription accordion sits below the content with an introductory jump link', () => {
  assert.ok(html.indexOf('id="standings"') < html.indexOf('id="notifications"'));
  assert.ok(html.indexOf('class="shell register-source"') < html.indexOf('id="notifications"'));
  assert.ok(html.indexOf('id="notifications"') < html.indexOf('</main>'));
  assert.match(html, /href="#notifications">Get notifications/);
  assert.match(html, /Stay in the loop/);
  assert.match(html, /Find out who passed, who receives the points, and how many/);
  assert.match(html, /data-col-push-prepare disabled>Enable notifications/);
});

for (const device of ['iPhone', 'Android']) test(`public ${device} UI keeps consent explicit and updates enabled / unsubscribed status`, async () => {
  const { mountColPush } = await import('../col-push.mjs');
  const saved = new Map(['document', 'window', 'navigator', 'localStorage', 'Notification', 'fetch']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const node = () => ({ hidden: false, disabled: false, textContent: '', handlers: {},
    addEventListener(event, handler) { this.handlers[event] = handler; } });
  const names = ['status', 'prepare', 'toggle', 'ios-help', 'rollout'];
  const elements = Object.fromEntries(names.map(name => [`[data-col-push-${name}]`, node()]));
  const panel = { hidden: false, querySelector: selector => elements[selector] };
  const status = elements['[data-col-push-status]'];
  const prepare = elements['[data-col-push-prepare]'];
  const toggle = elements['[data-col-push-toggle]'];
  let loads = 0, consent = false, prompts = 0;
  const subscription = { optedIn: false, addEventListener() {},
    async optIn() { prompts++; this.optedIn = true; },
    async optOut() { this.optedIn = false; } };
  const sdk = { User: { PushSubscription: subscription },
    Notifications: { permission: true, addEventListener() {} },
    setConsentRequired(value) { assert.equal(value, true); },
    setConsentGiven(value) { consent = value; },
    async init(options) {
      assert.equal(consent, true);
      assert.equal(options.welcomeNotification.disable, true);
      assert.equal(options.promptOptions.slidedown.prompts[0].autoPrompt, false);
      assert.equal(options.serviceWorkerParam.scope, '/push/onesignal/');
    } };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      userAgent: device, standalone: device === 'iPhone', serviceWorker: {} } });
    globalThis.Notification = { permission: 'granted' };
    globalThis.window = { Notification: {}, location: { search: '' }, matchMedia: () => ({ matches: true }) };
    globalThis.localStorage = { getItem: () => null, setItem() {} };
    globalThis.fetch = async () => ({ ok: true, json: async () => ready });
    globalThis.document = { querySelector: () => panel, createElement: () => ({}),
      head: { appendChild(script) { loads++; script.onload();
        for (const callback of window.OneSignalDeferred) callback(sdk); } } };
    await mountColPush();
    assert.equal(loads, 0);
    assert.equal(prompts, 0);
    assert.match(status.textContent, /off on this device/);
    await prepare.handlers.click();
    assert.equal(loads, 1);
    assert.equal(prompts, 0); // permission still requires the next actual tap
    toggle.handlers.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(prompts, 1);
    assert.equal(toggle.textContent, 'Disable notifications');
    assert.match(status.textContent, /enabled on this device/);
    toggle.handlers.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(toggle.textContent, 'Enable notifications');
    assert.match(status.textContent, /off for this browser/);
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('public subscription includes Android instructions and requires no pilot URL', () => {
  assert.equal(config.mode, 'public');
  assert.equal(pushConfigReady(config, ''), true);
  assert.match(html, /On Android:/);
  assert.match(html, /Home Screen is optional/);
  assert.match(html, /Each device has its own subscription/);
});
