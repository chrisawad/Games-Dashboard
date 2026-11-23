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
  playLink.href = game.playUrl;
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
const standalone = window.matchMedia("(display-mode: standalone)");
let installPrompt;
let installed = false;

function updateInstallButton() {
  const canPrompt = typeof navigator.install === "function" || Boolean(installPrompt);
  installButton.hidden = !canPrompt || installed || standalone.matches || navigator.standalone === true;
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

installButton.addEventListener("click", async () => {
  if (installButton.getAttribute("aria-disabled") === "true") return;
  installButton.setAttribute("aria-disabled", "true");
  installStatus.textContent = "";
  try {
    if (typeof navigator.install === "function") {
      await navigator.install();
      installed = true;
    } else if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = undefined;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") installed = true;
    }
  } catch (error) {
    if (error.name !== "AbortError") installStatus.textContent = "Try installing from your browser’s menu.";
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(error => {
    console.error("Offline browsing could not be enabled.", error);
  });
}
