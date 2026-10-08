/* Stammtisch CoL push subscription UI.
 * Deliberately inert until data/col-push-config.json is activated.
 * The visitor controls data consent and the native permission prompt.
 */
export const ONESIGNAL_SCRIPT = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
export const PILOT_QUERY = 'colPushPilot';

export function pushConfigReady(config, search = '', standalone = false) {
  if (!config || config.schemaVersion !== 1) return false;
  if (!['pilot', 'public'].includes(config.mode)) return false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.oneSignalAppId || '')) return false;
  if (config.audience !== 'any_visitor_who_opts_in' || config.source !== 'celebration_of_life_only') return false;
  if (config.mode === 'pilot' && !standalone && new URLSearchParams(search).get(PILOT_QUERY) !== '1') return false;
  return true;
}

export function isAppleMobile(navigatorLike) {
  const agent = navigatorLike.userAgent || '';
  return /iPhone|iPad|iPod/i.test(agent) ||
    (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1);
}

export function inHomeScreen(navigatorLike, matchMediaLike) {
  return navigatorLike.standalone === true ||
    Boolean(matchMediaLike && matchMediaLike('(display-mode: standalone)').matches);
}

export function pushPrerequisite(navigatorLike, matchMediaLike, hasNotifications, hasWorker) {
  if (isAppleMobile(navigatorLike) && !inHomeScreen(navigatorLike, matchMediaLike)) return 'ios-install';
  if (!hasNotifications || !hasWorker) return 'unsupported';
  return 'ready';
}

function localConsent() {
  try { return localStorage.getItem('stammtisch-col-push-consent') === 'yes'; }
  catch { return false; }
}

function recordConsent() {
  try { localStorage.setItem('stammtisch-col-push-consent', 'yes'); }
  catch { /* Browser storage disabled; consent still applies to this visit. */ }
}

function loadSdk() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ONESIGNAL_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Push SDK unavailable'));
    document.head.appendChild(script);
  });
}

export async function mountColPush() {
  const panel = document.querySelector('[data-col-push]');
  if (!panel) return;
  const disclosure = panel.querySelector('.col-push-disclosure');
  if (disclosure) {
    document.querySelector('.notification-jump')?.addEventListener('click', () => {
      disclosure.open = true;
    });
    if (window.location.hash === '#notifications') disclosure.open = true;
  }
  let config;
  try {
    const response = await fetch('/data/col-push-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Configuration unavailable');
    config = await response.json();
  } catch {
    panel.querySelector('[data-col-push-status]').textContent = 'Notification preferences are temporarily unavailable. Please try again later.';
    return;
  }
  const allowed = pushConfigReady(config, window.location.search, inHomeScreen(navigator, window.matchMedia?.bind(window)));
  const valid = pushConfigReady(config, '?colPushPilot=1', true);

  const status = panel.querySelector('[data-col-push-status]');
  const prepare = panel.querySelector('[data-col-push-prepare]');
  const toggle = panel.querySelector('[data-col-push-toggle]');
  const help = panel.querySelector('[data-col-push-ios-help]');
  const rollout = panel.querySelector('[data-col-push-rollout]');
  const prerequisites = pushPrerequisite(
    navigator, window.matchMedia?.bind(window), 'Notification' in window, 'serviceWorker' in navigator
  );

  panel.hidden = false;
  rollout.hidden = config.mode === 'public';
  if (!valid) {
    status.textContent = 'Notifications are not open for subscription yet.';
    return;
  }
  if (!allowed) {
    status.textContent = 'The notification pilot is in progress. Public subscription will open after approval.';
    return;
  }
  prepare.disabled = false;
  if (prerequisites === 'ios-install') {
    status.textContent = 'On iPhone or iPad, save this page to your Home Screen first.';
    prepare.hidden = true;
    return;
  }
  if (prerequisites === 'unsupported') {
    status.textContent = 'Web notifications are not available in this browser or device mode.';
    prepare.hidden = true;
    return;
  }

  let sdk = null;
  let preparing = false;
  const render = () => {
    if (!sdk) return;
    const optedIn = sdk.User.PushSubscription.optedIn;
    const permission = sdk.Notifications.permission;
    prepare.hidden = true;
    toggle.hidden = false;
    toggle.disabled = false;
    toggle.textContent = optedIn ? 'Disable notifications' : 'Enable notifications';
    if (optedIn) {
      status.textContent = 'Notifications are enabled on this device. Choose Disable notifications to unsubscribe.';
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      status.textContent = 'Notifications are blocked. Enable them in this device’s browser or website settings.';
      toggle.hidden = true;
    } else if (permission) {
      status.textContent = 'Notifications are off for this browser. You can enable them again.';
    } else {
      status.textContent = 'Setup is ready. Choose Enable notifications once more, then allow notifications when your device asks.';
    }
  };

  const prepareSdk = async () => {
    if (sdk || preparing) return;
    preparing = true;
    prepare.disabled = true;
    status.textContent = 'Preparing notification preferences…';
    // Consent is explicit. The SDK is not loaded or given any visitor data
    // merely because someone opened the CoL page.
    recordConsent();
    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      const ready = new Promise((resolve, reject) => {
        window.OneSignalDeferred.push(async OneSignal => {
          try {
            OneSignal.setConsentRequired(true);
            OneSignal.setConsentGiven(true);
            await OneSignal.init({
              appId: config.oneSignalAppId,
              serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
              serviceWorkerParam: { scope: '/push/onesignal/' },
              promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
              notifyButton: { enable: false },
              welcomeNotification: { disable: true },
            });
            resolve(OneSignal);
          } catch (error) { reject(error); }
        });
      });
      await loadSdk();
      sdk = await ready;
      sdk.User.PushSubscription.addEventListener('change', render);
      sdk.Notifications.addEventListener('permissionChange', render);
      render();
    } catch {
      status.textContent = 'Notification setup is temporarily unavailable. Please try again later.';
      prepare.disabled = false;
    } finally {
      preparing = false;
    }
  };

  prepare.addEventListener('click', prepareSdk);
  toggle.addEventListener('click', () => {
    if (!sdk || toggle.disabled) return;
    toggle.disabled = true;
    const optedIn = sdk.User.PushSubscription.optedIn;
    // Call optIn() from the actual click handler: iOS/Android browsers require
    // a user gesture to display the native permission prompt.
    const operation = optedIn ? sdk.User.PushSubscription.optOut()
                              : sdk.User.PushSubscription.optIn();
    Promise.resolve(operation).then(render).catch(() => {
      toggle.disabled = false;
      status.textContent = 'Unable to change notifications on this device. Check browser settings.';
    });
  });

  if (localConsent()) {
    // Reopen existing notification preferences without re-prompting permission.
    await prepareSdk();
  } else {
    status.textContent = 'Notifications are off on this device. Choose Enable notifications to get started.';
    prepare.hidden = false;
  }
}

if (typeof document !== 'undefined') mountColPush();

