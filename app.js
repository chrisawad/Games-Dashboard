const gameList = document.querySelector("#games");
const template = document.querySelector("#game-template");
const modeSelect = document.querySelector("#mode");
const count = document.querySelector("#count");
const catalogStatus = document.querySelector("#catalog-status");

function fillList(list, values) {
  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }
}

function makeCard(game) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.game = game.id;
  card.querySelector(".game-icon").src = game.icon;
  const title = card.querySelector("h3");
  title.textContent = game.title;
  title.id = "title-" + game.id;
  card.setAttribute("aria-labelledby", title.id);
  card.querySelector(".description").textContent = game.description;
  fillList(card.querySelector(".modes"), game.modes);
  if (game.onlineJoin?.length) {
    card.querySelector("details").hidden = false;
    fillList(card.querySelector(".join-options"), game.onlineJoin);
  }
  const playLink = card.querySelector(".play");
  const launchUrl = new URL(game.playUrl);
  // A fragment survives the branded redirects even when they drop query parameters.
  if (!launchUrl.hash) launchUrl.hash = "from=games-dashboard";
  playLink.href = launchUrl.href;
  playLink.setAttribute("aria-label", "Play " + game.title);
  const sourceLink = card.querySelector(".source");
  sourceLink.href = game.repositoryUrl;
  sourceLink.setAttribute("aria-label", "Source for " + game.title);
  return card;
}

async function loadCatalog() {
  const response = await fetch("./catalog.json");
  if (!response.ok) throw new Error("Catalog request failed");
  const games = await response.json();
  for (const mode of new Set(games.flatMap(game => game.modes))) {
    modeSelect.add(new Option(mode, mode));
  }
  function showGames() {
    const matches = games.filter(game => !modeSelect.value || game.modes.includes(modeSelect.value));
    gameList.replaceChildren(...matches.map(makeCard));
    count.textContent = matches.length;
    catalogStatus.textContent = matches.length + (matches.length === 1 ? " game shown." : " games shown.");
  }
  showGames();
  count.hidden = false;
  modeSelect.closest("label").hidden = false;
  modeSelect.addEventListener("change", showGames);
}

loadCatalog().catch(() => {
  catalogStatus.classList.remove("visually-hidden");
  catalogStatus.textContent = "The game library couldn’t load. Check your connection and reload the page.";
});

const installButton = document.querySelector("#install");
const installStatus = document.querySelector("#install-status");
const installHelp = document.querySelector("#install-help");
const dismissInstallHelp = document.querySelector("#dismiss-install-help");
const installLabel = document.querySelector("#install-label");
const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const android = /Android/i.test(navigator.userAgent);
const framed = window.self !== window.top;
const standalone = window.matchMedia("(display-mode: standalone)");
const dashboardLaunch = new URLSearchParams(location.search).get("launch") === "dashboard";
let installPrompt;
let installed = false;
let listedAsInstalled = false;
let nativeInstallFailed = false;
let helpOpen = appleMobile || android || framed;

document.querySelector("#install-directions").textContent = appleMobile
  ? "Open the dashboard in Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if offered, then tap Add."
  : android
    ? "Open the dashboard in Chrome. In the ⋮ menu, choose Install app or Add to Home screen, then Install."
    : "Open the dashboard in your browser and choose its install option. In Safari on Mac, choose File → Add to Dock.";

function canInstall() {
  return !framed && (Boolean(installPrompt) ||
    (window.isSecureContext && !nativeInstallFailed && typeof navigator.install === "function"));
}

function updateInstallButton() {
  const inInstalledWindow = dashboardLaunch && !framed && (standalone.matches || navigator.standalone === true);
  const native = canInstall() || installButton.getAttribute("aria-disabled") === "true";
  installButton.hidden = installed || listedAsInstalled || inInstalledWindow;
  installHelp.hidden = installButton.hidden || !helpOpen || native;
  installLabel.textContent = native ? "Install app" : "Install help";
  if (native) installButton.removeAttribute("aria-expanded");
  else installButton.setAttribute("aria-expanded", String(!installHelp.hidden));
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  updateInstallButton();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  installPrompt = undefined;
  installStatus.textContent = "Games Dashboard is installed.";
  updateInstallButton();
});
standalone.addEventListener("change", updateInstallButton);
updateInstallButton();

async function checkDashboardInstallation() {
  if (typeof navigator.getInstalledRelatedApps !== "function") return;
  try {
    const manifest = document.querySelector('link[rel="manifest"]').href;
    const id = new URL("./", manifest).href;
    const apps = await navigator.getInstalledRelatedApps();
    listedAsInstalled = apps.some(app => app.platform === "webapp" && (app.id === id || app.url === manifest));
    updateInstallButton();
  } catch {
    // Embedded browsers may restrict the lookup. Keep the instructions available.
  }
}
checkDashboardInstallation();
window.addEventListener("focus", checkDashboardInstallation);

dismissInstallHelp.addEventListener("click", () => {
  helpOpen = false;
  updateInstallButton();
  installButton.focus();
});

installButton.addEventListener("click", async () => {
  if (installButton.getAttribute("aria-disabled") === "true") return;
  if (!canInstall()) {
    helpOpen = !helpOpen;
    updateInstallButton();
    return;
  }
  installButton.setAttribute("aria-disabled", "true");
  helpOpen = false;
  installStatus.textContent = "";
  try {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = undefined;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") installed = true;
    } else {
      await navigator.install();
      installed = true;
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      nativeInstallFailed = true;
      helpOpen = true;
    }
  } finally {
    installButton.removeAttribute("aria-disabled");
    updateInstallButton();
  }
});

const shareButton = document.querySelector("#share");
const shareLink = document.querySelector("#share-link");
const shareStatus = document.querySelector("#share-status");
const dashboardUrl = document.querySelector('link[rel="canonical"]').href;

shareButton.hidden = false;
shareButton.addEventListener("click", async () => {
  shareStatus.textContent = "";
  shareLink.hidden = true;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: document.title, url: dashboardUrl });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(dashboardUrl);
      shareStatus.textContent = "Dashboard link copied.";
      return;
    } catch {
      // Browsers can deny clipboard access even when they expose the API.
    }
  }
  shareStatus.textContent = "Copy this link to share Ultimate Games.";
  shareLink.value = dashboardUrl;
  shareLink.hidden = false;
  shareLink.focus();
  shareLink.select();
});

function watchUpdates(registration) {
  const workers = navigator.serviceWorker;
  const dialog = document.querySelector("#update-dialog");
  const detail = document.querySelector("#update-detail");
  const apply = document.querySelector("#apply-update");
  const check = document.querySelector("#check-update");
  const status = document.querySelector("#update-status");
  const description = detail.textContent;
  let pageController = workers.controller;
  let offeredWorker;
  let checking = false;
  let retryTimer;

  function availableUpdate() {
    if (registration.active && registration.waiting) return registration.waiting;
    // Another window can activate an update while this page is still showing the old UI.
    return pageController && workers.controller !== pageController ? workers.controller : null;
  }

  function showUpdate(force = false) {
    const worker = availableUpdate();
    if (!worker) return false;
    check.textContent = "Update available";
    status.textContent = "";
    if (!document.hidden && !dialog.open && (force || worker !== offeredWorker)) {
      offeredWorker = worker;
      detail.textContent = description;
      dialog.showModal();
    }
    return true;
  }

  function watchInstall() {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") showUpdate();
      if (worker.state === "redundant" && !availableUpdate() && status.textContent) {
        status.textContent = "The update couldn’t finish. Try checking again.";
      }
    });
  }

  async function checkForUpdates(manual = false) {
    if (document.hidden || showUpdate(manual)) return;
    if (manual) status.textContent = "Checking for updates…";
    if (checking || registration.installing) return;
    if (!navigator.onLine) {
      if (manual) status.textContent = "Connect to the internet to check for updates.";
      return;
    }
    checking = true;
    try {
      await registration.update();
      if (!showUpdate(manual) && !registration.installing && status.textContent) {
        status.textContent = "Games Dashboard is up to date.";
      }
    } catch {
      if (status.textContent) status.textContent = "Couldn’t check for updates. Try again when connected.";
    } finally {
      checking = false;
    }
  }

  workers.addEventListener("controllerchange", () => {
    if (!pageController) {
      pageController = workers.controller;
      if (!availableUpdate()) status.textContent = "";
      return;
    }
    if (apply.disabled) {
      clearTimeout(retryTimer);
      window.location.reload();
    } else {
      showUpdate();
    }
  });

  apply.addEventListener("click", () => {
    const waiting = registration.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    apply.disabled = true;
    detail.textContent = "Applying the update…";
    retryTimer = setTimeout(() => {
      apply.disabled = false;
      detail.textContent = "The update hasn’t finished. Try Update now again.";
    }, 15000);
    waiting.postMessage({ type: "APPLY_DASHBOARD_UPDATE" });
  });

  registration.addEventListener("updatefound", watchInstall);
  watchInstall();
  check.addEventListener("click", () => checkForUpdates(true));
  const checkOnReturn = () => checkForUpdates();
  document.addEventListener("visibilitychange", checkOnReturn);
  window.addEventListener("focus", checkOnReturn);
  window.addEventListener("online", checkOnReturn);
  window.setInterval(checkOnReturn, 5 * 60 * 1000);
  document.querySelector("#update-tools").hidden = false;
  checkForUpdates();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).then(watchUpdates).catch(error => {
    console.error("Offline browsing could not be enabled.", error);
  });
}
