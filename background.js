const DEFAULT_SPEED = 1;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const TAB_SPEED_PREFIX = "tabSpeed:";
const GLOBAL_DEFAULT_KEY = "globalDefaultSpeed";
const LAST_MODE_KEY = "lastMode";

function tabSpeedKey(tabId) {
  return `${TAB_SPEED_PREFIX}${tabId}`;
}

function clampSpeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(number * 100) / 100));
}

function isRealTabId(tabId) {
  return typeof tabId === "number" && tabId >= 0;
}

async function getGlobalDefaultSpeed() {
  const result = await chrome.storage.session.get(GLOBAL_DEFAULT_KEY);
  return clampSpeed(result[GLOBAL_DEFAULT_KEY] ?? DEFAULT_SPEED);
}

async function getTabSpeed(tabId) {
  if (!isRealTabId(tabId)) return getGlobalDefaultSpeed();

  const result = await chrome.storage.session.get([
    tabSpeedKey(tabId),
    GLOBAL_DEFAULT_KEY
  ]);

  return clampSpeed(
    result[tabSpeedKey(tabId)] ??
      result[GLOBAL_DEFAULT_KEY] ??
      DEFAULT_SPEED
  );
}

async function getLastMode() {
  const result = await chrome.storage.session.get(LAST_MODE_KEY);
  return result[LAST_MODE_KEY] === "all" ? "all" : "tab";
}

async function setTabSpeed(tabId, speed) {
  const cleanSpeed = clampSpeed(speed);
  if (!isRealTabId(tabId)) return { ok: false, speed: cleanSpeed };

  await chrome.storage.session.set({
    [tabSpeedKey(tabId)]: cleanSpeed,
    [LAST_MODE_KEY]: "tab"
  });

  await applySpeedToTab(tabId, cleanSpeed);

  return { ok: true, speed: cleanSpeed };
}

async function resetTabSpeed(tabId) {
  if (!isRealTabId(tabId)) return { ok: false, speed: DEFAULT_SPEED };

  // Reset should always mean 1x for the active tab, not "whatever global was".
  await chrome.storage.session.set({
    [tabSpeedKey(tabId)]: DEFAULT_SPEED,
    [LAST_MODE_KEY]: "tab"
  });

  await applySpeedToTab(tabId, DEFAULT_SPEED);

  return { ok: true, speed: DEFAULT_SPEED };
}

async function setAllTabsSpeed(speed) {
  const cleanSpeed = clampSpeed(speed);
  const tabs = await chrome.tabs.query({});
  const values = {
    [GLOBAL_DEFAULT_KEY]: cleanSpeed,
    [LAST_MODE_KEY]: "all"
  };

  for (const tab of tabs) {
    if (isRealTabId(tab.id)) {
      values[tabSpeedKey(tab.id)] = cleanSpeed;
    }
  }

  await chrome.storage.session.set(values);

  await Promise.allSettled(
    tabs
      .filter((tab) => isRealTabId(tab.id))
      .map((tab) => applySpeedToTab(tab.id, cleanSpeed))
  );

  return { ok: true, speed: cleanSpeed, tabCount: tabs.length };
}

async function resetAllTabs() {
  const all = await chrome.storage.session.get(null);
  const keysToRemove = Object.keys(all).filter((key) => key.startsWith(TAB_SPEED_PREFIX));

  if (keysToRemove.length) {
    await chrome.storage.session.remove(keysToRemove);
  }

  await chrome.storage.session.set({
    [GLOBAL_DEFAULT_KEY]: DEFAULT_SPEED,
    [LAST_MODE_KEY]: "all"
  });

  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((tab) => isRealTabId(tab.id))
      .map((tab) => applySpeedToTab(tab.id, DEFAULT_SPEED))
  );

  return { ok: true, speed: DEFAULT_SPEED, tabCount: tabs.length };
}

async function sendSpeedMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function ensureContentScript(tabId) {
  if (!isRealTabId(tabId)) return false;

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"]
    });
    return true;
  } catch (error) {
    // Expected on restricted pages like chrome:// and the Chrome Web Store.
    return false;
  }
}

async function messageTabWithInjectionFallback(tabId, message) {
  try {
    return await sendSpeedMessage(tabId, message);
  } catch (firstError) {
    const injected = await ensureContentScript(tabId);

    if (!injected) {
      return {
        ok: false,
        error: firstError?.message || String(firstError)
      };
    }

    try {
      return await sendSpeedMessage(tabId, message);
    } catch (secondError) {
      return {
        ok: false,
        error: secondError?.message || String(secondError)
      };
    }
  }
}

async function applySpeedToTab(tabId, speed) {
  return messageTabWithInjectionFallback(tabId, {
    type: "VIDEO_SPEEDER_SET_SPEED",
    speed: clampSpeed(speed)
  });
}

async function getTabStatus(tabId) {
  const speed = await getTabSpeed(tabId);
  const mode = await getLastMode();

  let status = {
    ok: false,
    speed,
    mediaCount: 0,
    enabled: speed !== DEFAULT_SPEED,
    reason: "No media controller is available on this page yet.",
    mode
  };

  if (isRealTabId(tabId)) {
    const response = await messageTabWithInjectionFallback(tabId, {
      type: "VIDEO_SPEEDER_GET_STATUS"
    });

    if (response?.ok) {
      status = {
        ...status,
        ...response,
        speed,
        mode
      };
    } else if (response?.error) {
      status.reason = response.error;
    }
  }

  return status;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  const respond = (promise) => {
    promise.then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    });
    return true;
  };

  switch (message.type) {
    case "VIDEO_SPEEDER_CONTENT_READY": {
      const tabId = sender?.tab?.id;
      return respond(
        getTabSpeed(tabId).then((speed) => ({
          ok: true,
          speed
        }))
      );
    }

    case "VIDEO_SPEEDER_GET_TAB_STATE":
      return respond(getTabStatus(message.tabId));

    case "VIDEO_SPEEDER_SET_TAB_SPEED":
      return respond(setTabSpeed(message.tabId, message.speed));

    case "VIDEO_SPEEDER_RESET_TAB_SPEED":
      return respond(resetTabSpeed(message.tabId));

    case "VIDEO_SPEEDER_SET_ALL_TABS_SPEED":
      return respond(setAllTabsSpeed(message.speed));

    case "VIDEO_SPEEDER_RESET_ALL_TABS":
      return respond(resetAllTabs());

    default:
      return false;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (isRealTabId(tabId)) {
    chrome.storage.session.remove(tabSpeedKey(tabId));
  }
});