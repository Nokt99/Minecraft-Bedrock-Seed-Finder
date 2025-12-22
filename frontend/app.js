const API_BASE = "/api";

let currentUser = null;
let authToken = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function setScreen(screenId) {
  $$(".screen").forEach((el) => el.classList.remove("screen-active"));
  $(`#${screenId}`).classList.add("screen-active");
}

function updateHeaderVersionLabel() {
  const version = $("#versionSelect").value;
  $("#luckyVersionLabel").textContent = version;
}

function updateUserStatus() {
  const statusEl = $("#userStatus");
  if (currentUser && authToken) {
    statusEl.textContent = currentUser.email || "Signed in";
    statusEl.classList.remove("user-status-guest");
    statusEl.classList.add("user-status-auth");
    $("#btnOpenAuth").textContent = "Account";
  } else {
    statusEl.textContent = "Guest";
    statusEl.classList.add("user-status-guest");
    statusEl.classList.remove("user-status-auth");
    $("#btnOpenAuth").textContent = "Sign in";
  }
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function createSeedResultCard(seedData, mode) {
  const template = $("#seedResultTemplate");
  const fragment = template.content.cloneNode(true);
  const root = fragment.querySelector(".seed-result");

  const seedValueEl = fragment.querySelector(".seed-value");
  const seedSubtitleEl = fragment.querySelector(".seed-subtitle");
  const scoreValueEl = fragment.querySelector(".score-value");
  const tagsContainer = fragment.querySelector(".seed-tags");
  const reasoningEl = fragment.querySelector(".seed-reasoning");
  const scoreMatchEl = fragment.querySelector(".score-chip-match");
  const scoreOpEl = fragment.querySelector(".score-chip-op");
  const scoreRarityEl = fragment.querySelector(".score-chip-rarity");
  const scoreConfEl = fragment.querySelector(".score-chip-confidence");
  const copyBtn = fragment.querySelector(".btn-copy-seed");
  const iframe = fragment.querySelector(".viewer-iframe");

  const version = $("#versionSelect").value;

  seedValueEl.textContent = seedData.seed;
  seedSubtitleEl.textContent =
    mode === "lucky"
      ? `Lucky mode • Bedrock ${version}`
      : `Seed Finder • Bedrock ${version}`;

  scoreValueEl.textContent = `${seedData.finalScore}`;
  reasoningEl.textContent = seedData.reason || "Engine-selected seed.";

  scoreMatchEl.textContent = `${seedData.matchScore}`;
  scoreOpEl.textContent = `${seedData.opScore}`;
  scoreRarityEl.textContent = `${seedData.rarityScore}`;
  scoreConfEl.textContent = `${seedData.confidenceScore}`;

  (seedData.tags || []).forEach((tag) => {
    const tagEl = document.createElement("span");
    tagEl.className = "seed-tag";
    tagEl.textContent = tag;
    tagsContainer.appendChild(tagEl);
  });

  iframe.src = "about:blank";
  iframe.title = `Preview for seed ${seedData.seed}`;

  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(seedData.seed)
      .then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1000);
      })
      .catch(() => {
        copyBtn.textContent = "Error";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1000);
      });
  });

  root.querySelectorAll(".btn-feedback").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const feedbackType = btn.dataset.feedback;
      await handleFeedback(seedData, feedbackType, mode, btn);
    });
  });

  return root;
}

async function handleFeedback(seedData, feedbackType, mode, buttonEl) {
  try {
    const version = $("#versionSelect").value;
    await apiFetch("/seeds/feedback", {
      method: "POST",
      body: JSON.stringify({
        seed: seedData.seed,
        version,
        mode,
        feedbackType
      })
    });

    buttonEl.textContent = feedbackType.toUpperCase();
    buttonEl.classList.add("btn-primary");
    setTimeout(() => {
      buttonEl.textContent =
        feedbackType === "op"
          ? "OP"
          : feedbackType === "mid"
          ? "Mid"
          : feedbackType === "match"
          ? "Matches"
          : "Wrong";
      buttonEl.classList.remove("btn-primary");
    }, 800);
  } catch (err) {
    console.error("Feedback error:", err);
    buttonEl.textContent = "Error";
    buttonEl.classList.add("btn-primary");
    setTimeout(() => {
      buttonEl.textContent =
        feedbackType === "op"
          ? "OP"
          : feedbackType === "mid"
          ? "Mid"
          : feedbackType === "match"
          ? "Matches"
          : "Wrong";
      buttonEl.classList.remove("btn-primary");
    }, 800);
  }
}

function setupNavigation() {
  $("#btnGoLucky").addEventListener("click", () => {
    setScreen("screenLucky");
    updateHeaderVersionLabel();
  });

  $("#btnGoFinder").addEventListener("click", () => {
    setScreen("screenFinder");
  });

  $$(".back-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.back;
      if (target === "home") setScreen("screenHome");
    });
  });

  $("#versionSelect").addEventListener("change", () => {
    updateHeaderVersionLabel();
  });
}

function setupLuckyMode() {
  const btn = $("#btnGenerateLucky");
  const statusEl = $("#luckyStatus");
  const container = $("#resultContainerLucky");

  btn.addEventListener("click", async () => {
    const version = $("#versionSelect").value;
    statusEl.textContent = "Rolling a hybrid-chaos seed from the engine...";
    container.innerHTML = "";

    try {
      const data = await apiFetch(`/seeds/lucky?version=${encodeURIComponent(version)}`);
      if (!data || !data.seed) {
        statusEl.textContent = data.message || "No seeds available yet for this version.";
        return;
      }

      const card = createSeedResultCard(data, "lucky");
      container.appendChild(card);
      statusEl.textContent = "Result ready. Mark feedback to train the engine.";
    } catch (err) {
      console.error("Lucky error:", err);
      statusEl.textContent = "Error getting a Lucky seed. Try again.";
    }
  });
}

function setupFinderMode() {
  const btn = $("#btnFinderSearch");
  const descriptionEl = $("#finderDescription");
  const statusEl = $("#finderStatus");
  const container = $("#resultContainerFinder");

  btn.addEventListener("click", async () => {
    const description = descriptionEl.value.trim();
    if (!description) {
      statusEl.textContent = "Describe what you want first.";
      return;
    }

    const version = $("#versionSelect").value;
    statusEl.textContent = "Searching the engine’s brain for a good match...";
    container.innerHTML = "";

    try {
      const data = await apiFetch("/seeds/find", {
        method: "POST",
        body: JSON.stringify({ version, description })
      });

      if (!data || !data.seed) {
        statusEl.textContent = data.message || "No matching seeds yet. Try adjusting your idea.";
        return;
      }

      const card = createSeedResultCard(data, "finder");
      container.appendChild(card);
      statusEl.textContent = "Result ready. Mark feedback to help it learn.";
    } catch (err) {
      console.error("Finder error:", err);
      statusEl.textContent = "Error finding a seed. Try again.";
    }
  });
}

function setupAuthModal() {
  const modal = $("#authModal");
  const openBtn = $("#btnOpenAuth");
  const closeBtn = $("#btnCloseAuth");
  const toggleModeBtn = $("#btnToggleAuthMode");
  const form = $("#authForm");
  const titleEl = $("#authTitle");
  const subtitleEl = $(".modal-subtitle");

  let mode = "login";

  function openModal() {
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  function updateMode() {
    if (mode === "login") {
      titleEl.textContent = "Sign in";
      subtitleEl.textContent =
        "Sign in to sync your preferences and let the engine learn your style.";
      toggleModeBtn.textContent = "Need an account? Create one";
    } else {
      titleEl.textContent = "Create an account";
      subtitleEl.textContent =
        "We’ll start building a personal profile so the engine can predict what you like.";
      toggleModeBtn.textContent = "Already have an account? Sign in";
    }
  }

  openBtn.addEventListener("click", () => {
    openModal();
  });

  closeBtn.addEventListener("click", closeModal);
  $("#authModal .modal-backdrop").addEventListener("click", closeModal);

  toggleModeBtn.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    updateMode();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value.trim();

    if (!email || !password) return;

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const data = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      authToken = data.token;
      currentUser = data.user;
      updateUserStatus();
      form.reset();
      closeModal();
    } catch (err) {
      console.error("Auth error:", err);
      subtitleEl.textContent = "Authentication failed. Check your details and try again.";
    }
  });

  updateMode();
}

async function loadCurrentUser() {
  try {
    const data = await apiFetch("/auth/me", { method: "GET" });
    if (data && data.user) {
      currentUser = data.user;
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  } finally {
    updateUserStatus();
  }
}

function init() {
  setScreen("screenHome");
  updateHeaderVersionLabel();
  updateUserStatus();
  setupNavigation();
  setupLuckyMode();
  setupFinderMode();
  setupAuthModal();
  loadCurrentUser();
}

document.addEventListener("DOMContentLoaded", init);
