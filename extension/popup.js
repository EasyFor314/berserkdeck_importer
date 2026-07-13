const contentEl = document.getElementById("content");
const copyBtn = document.getElementById("copy-btn");
const titleEl = document.getElementById("title");

let exportText = "";

function setTitle(text) {
  if (titleEl) {
    titleEl.textContent = text;
  }
}

function showStatus(message, isError = false) {
  contentEl.replaceChildren();
  const p = document.createElement("p");
  p.className = `status${isError ? " error" : ""}`;
  p.textContent = message;
  contentEl.appendChild(p);
  copyBtn.disabled = true;
  exportText = "";
}

function showText(text) {
  exportText = text;
  contentEl.replaceChildren();
  const pre = document.createElement("pre");
  pre.className = "deck-text";
  pre.textContent = text;
  contentEl.appendChild(pre);
  copyBtn.disabled = false;
  copyBtn.classList.remove("copied");
  copyBtn.textContent = "Скопировать";
}

async function copyExportText() {
  if (!exportText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(exportText);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = exportText;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  copyBtn.classList.add("copied");
  copyBtn.textContent = "Скопировано!";
}

async function runOnTab(tabId, funcName, args) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    files: ["page-bridge.js"],
  });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (funcName, args) => {
      try {
        const bridge = window.__berserkDeckImporter;
        const fn = bridge?.[funcName];
        if (!fn) {
          return {
            ok: false,
            error: "Не удалось инициализировать расширение на странице.",
          };
        }

        const data = await fn(...args);
        return { ok: true, data };
      } catch (error) {
        return {
          ok: false,
          error: error.message || "Не удалось загрузить данные.",
        };
      }
    },
    args: [funcName, args],
  });

  return result?.result;
}

copyBtn.addEventListener("click", copyExportText);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    showStatus("Не удалось определить текущую вкладку.", true);
    return;
  }

  const parsed = parseBerserkdeckUrl(tab.url);
  if (!parsed) {
    showStatus(
      "Откройте страницу колоды или альбома на berserkdeck.ru\n(например, /decks/53458 или /albums/635).",
      true
    );
    return;
  }

  if (parsed.type === "deck") {
    setTitle("Текст колоды");
    showStatus("Загрузка колоды…");

    const response = await runOnTab(tab.id, "fetchDeck", [
      parsed.deckId,
      parsed.code,
    ]);

    if (!response?.ok) {
      showStatus(response?.error || "Не удалось загрузить колоду.", true);
      return;
    }

    showText(formatDeckText(response.data));
    return;
  }

  setTitle("Текст альбома");
  showStatus("Загрузка альбома…");

  try {
    const response = await runOnTab(tab.id, "fetchAlbum", [parsed.albumId]);

    if (!response?.ok) {
      showStatus(response?.error || "Не удалось загрузить альбом.", true);
      return;
    }

    showText(formatAlbumText(response.data.album, response.data.cards));
  } catch {
    showStatus(
      "Не удалось получить данные со страницы.\nОбновите вкладку berserkdeck.ru и попробуйте снова.",
      true
    );
  }
}

init();
