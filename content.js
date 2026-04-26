(() => {
  if (window.__VIDEO_SPEEDER_INSTALLED__) return;
  window.__VIDEO_SPEEDER_INSTALLED__ = true;

  const DEFAULT_SPEED = 1;
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4;
  const MEDIA_SELECTOR = "video,audio";

  const state = {
    speed: DEFAULT_SPEED,
    enabled: false,
    settingInternally: false,
    knownMedia: new Set(),
    observer: null
  };

  function clampSpeed(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULT_SPEED;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(number * 100) / 100));
  }

  function isMediaElement(node) {
    return node instanceof HTMLMediaElement;
  }

  function currentMediaElements() {
    return Array.from(document.querySelectorAll(MEDIA_SELECTOR));
  }

  function safelySetMediaSpeed(media, speed) {
    if (!isMediaElement(media)) return;

    try {
      state.settingInternally = true;

      media.defaultPlaybackRate = speed;
      media.playbackRate = speed;

      // Preserve pitch where supported.
      if ("preservesPitch" in media) media.preservesPitch = true;
      if ("mozPreservesPitch" in media) media.mozPreservesPitch = true;
      if ("webkitPreservesPitch" in media) media.webkitPreservesPitch = true;
    } catch {
      // Some protected/custom players can reject playbackRate changes.
    } finally {
      window.setTimeout(() => {
        state.settingInternally = false;
      }, 0);
    }
  }

  function enforceSpeed(media) {
    if (!isMediaElement(media)) return;
    if (!state.enabled) return;

    if (media.playbackRate !== state.speed || media.defaultPlaybackRate !== state.speed) {
      safelySetMediaSpeed(media, state.speed);
    }
  }

  function trackMedia(media) {
    if (!isMediaElement(media) || state.knownMedia.has(media)) return;

    state.knownMedia.add(media);

    media.addEventListener("play", () => enforceSpeed(media), true);
    media.addEventListener("playing", () => enforceSpeed(media), true);
    media.addEventListener("loadedmetadata", () => enforceSpeed(media), true);
    media.addEventListener("loadeddata", () => enforceSpeed(media), true);
    media.addEventListener("canplay", () => enforceSpeed(media), true);

    media.addEventListener(
      "ratechange",
      () => {
        if (state.settingInternally) return;
        window.setTimeout(() => enforceSpeed(media), 0);
      },
      true
    );

    if (state.enabled) {
      safelySetMediaSpeed(media, state.speed);
    }
  }

  function scan(root = document) {
    if (!root) return;

    if (isMediaElement(root)) {
      trackMedia(root);
      return;
    }

    if (typeof root.querySelectorAll === "function") {
      root.querySelectorAll(MEDIA_SELECTOR).forEach(trackMedia);
    }
  }

  function setSpeed(speed) {
    state.speed = clampSpeed(speed);
    state.enabled = state.speed !== DEFAULT_SPEED;

    scan(document);

    const media = currentMediaElements();
    for (const element of media) {
      safelySetMediaSpeed(element, state.speed);
    }

    return {
      ok: true,
      speed: state.speed,
      enabled: state.enabled,
      mediaCount: media.length
    };
  }

  function status() {
    scan(document);

    return {
      ok: true,
      speed: state.speed,
      enabled: state.enabled,
      mediaCount: currentMediaElements().length
    };
  }

  function startObserver() {
    if (state.observer) return;

    state.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          scan(node);
        }
      }
    });

    const target = document.documentElement || document.body || document;
    state.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;

    if (message.type === "VIDEO_SPEEDER_SET_SPEED") {
      sendResponse(setSpeed(message.speed));
      return true;
    }

    if (message.type === "VIDEO_SPEEDER_GET_STATUS") {
      sendResponse(status());
      return true;
    }

    return false;
  });

  scan(document);
  startObserver();

  chrome.runtime.sendMessage({ type: "VIDEO_SPEEDER_CONTENT_READY" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.ok) {
      setSpeed(response.speed ?? DEFAULT_SPEED);
    }
  });
})();