const DEFAULT_SPEED = 1;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const STEP = 0.05;

const elements = {
  speedSlider: document.getElementById("speedSlider"),
  speedBubble: document.getElementById("speedBubble"),
  minusButton: document.getElementById("minusButton"),
  plusButton: document.getElementById("plusButton"),
  resetButton: document.getElementById("resetButton"),
  tabModeButton: document.getElementById("tabModeButton"),
  allModeButton: document.getElementById("allModeButton"),
  pageStatus: document.getElementById("pageStatus"),
  presetButtons: Array.from(document.querySelectorAll(".preset-button"))
};

const state = {
  tabId: null,
  mode: "tab",
  speed: DEFAULT_SPEED,
  sendTimer: null
};

function clampSpeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(number * 100) / 100));
}

function formatSpeed(speed) {
  return `${clampSpeed(speed).toFixed(2)}x`;
}

function sliderPercent(speed) {
  return ((clampSpeed(speed) - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
}

function setMode(mode) {
  state.mode = mode === "all" ? "all" : "tab";
  elements.tabModeButton.classList.toggle("active", state.mode === "tab");
  elements.allModeButton.classList.toggle("active", state.mode === "all");
}

function renderSpeed(speed) {
  const cleanSpeed = clampSpeed(speed);
  state.speed = cleanSpeed;

  // Set both property and attribute so the custom-styled range always visually snaps back.
  elements.speedSlider.value = String(cleanSpeed);
  elements.speedSlider.setAttribute("value", String(cleanSpeed));
  elements.speedBubble.textContent = formatSpeed(cleanSpeed);

  const percent = sliderPercent(cleanSpeed);
  elements.speedSlider.style.setProperty("--progress", `${percent}%`);

  const placeBubble = () => {
    const sliderWidth = elements.speedSlider.getBoundingClientRect().width || 1;
    const thumbWidth = 52;
    const bubbleX =
      elements.speedSlider.offsetLeft +
      (percent / 100) * (sliderWidth - thumbWidth) +
      thumbWidth / 2;

    elements.speedBubble.style.left = `${bubbleX}px`;
  };

  placeBubble();
  requestAnimationFrame(placeBubble);
}

function setStatusText(status) {
  if (!status?.ok && status?.reason) {
    elements.pageStatus.textContent = "Page unavailable or no controller yet";
    return;
  }

  const mediaCount = status?.mediaCount ?? 0;
  elements.pageStatus.textContent =
    mediaCount === 1 ? "1 media element found" : `${mediaCount} media elements found`;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }
      resolve(response);
    });
  });
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  state.tabId = tab?.id ?? null;

  if (state.tabId === null) {
    elements.pageStatus.textContent = "No active tab found";
    return;
  }

  const status = await sendMessage({
    type: "VIDEO_SPEEDER_GET_TAB_STATE",
    tabId: state.tabId
  });

  setMode(status?.mode || "tab");
  renderSpeed(status?.speed ?? DEFAULT_SPEED);
  setStatusText(status);
}

async function applySpeed(speed, immediate = false) {
  const cleanSpeed = clampSpeed(speed);
  renderSpeed(cleanSpeed);

  window.clearTimeout(state.sendTimer);

  const submit = async () => {
    if (state.tabId === null) return;

    const message =
      state.mode === "all"
        ? {
            type: "VIDEO_SPEEDER_SET_ALL_TABS_SPEED",
            speed: cleanSpeed
          }
        : {
            type: "VIDEO_SPEEDER_SET_TAB_SPEED",
            tabId: state.tabId,
            speed: cleanSpeed
          };

    const response = await sendMessage(message);
    const status = await sendMessage({
      type: "VIDEO_SPEEDER_GET_TAB_STATE",
      tabId: state.tabId
    });

    setStatusText(status?.ok ? status : response);
  };

  if (immediate) {
    await submit();
  } else {
    state.sendTimer = window.setTimeout(submit, 45);
  }
}

async function resetSpeed() {
  if (state.tabId === null) return;

  window.clearTimeout(state.sendTimer);

  // Make the popup reflect reset immediately, especially in all-tabs mode.
  renderSpeed(DEFAULT_SPEED);

  const message =
    state.mode === "all"
      ? {
          type: "VIDEO_SPEEDER_RESET_ALL_TABS"
        }
      : {
          type: "VIDEO_SPEEDER_RESET_TAB_SPEED",
          tabId: state.tabId
        };

  const response = await sendMessage(message);

  // Force the local UI to stay at 1x even if a delayed status response returns stale data.
  renderSpeed(DEFAULT_SPEED);

  const status = await sendMessage({
    type: "VIDEO_SPEEDER_GET_TAB_STATE",
    tabId: state.tabId
  });

  setStatusText(status?.ok ? status : response);
  renderSpeed(DEFAULT_SPEED);
}

elements.speedSlider.addEventListener("input", (event) => {
  applySpeed(event.currentTarget.value);
});

elements.minusButton.addEventListener("click", () => {
  applySpeed(state.speed - STEP, true);
});

elements.plusButton.addEventListener("click", () => {
  applySpeed(state.speed + STEP, true);
});

elements.resetButton.addEventListener("click", resetSpeed);

elements.tabModeButton.addEventListener("click", () => {
  setMode("tab");
  applySpeed(state.speed, true);
});

elements.allModeButton.addEventListener("click", () => {
  setMode("all");
  applySpeed(state.speed, true);
});

for (const button of elements.presetButtons) {
  button.addEventListener("click", () => {
    applySpeed(button.dataset.speed, true);
  });
}

window.addEventListener("resize", () => {
  renderSpeed(state.speed);
});

loadActiveTab();