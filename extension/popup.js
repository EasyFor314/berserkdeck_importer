const contentEl = document.getElementById("content");
const copyBtn = document.getElementById("copy-btn");

let deckText = "";

function showStatus(message, isError = false) {
  contentEl.replaceChildren();
  const p = document.createElement("p");
  p.className = `status${isError ? " error" : ""}`;
  p.textContent = message;
  contentEl.appendChild(p);
  copyBtn.disabled = true;
  deckText = "";
}

function showDeck(text) {
  deckText = text;
  contentEl.replaceChildren();
  const pre = document.createElement("pre");
  pre.className = "deck-text";
  pre.textContent = text;
  contentEl.appendChild(pre);
  copyBtn.disabled = false;
  copyBtn.classList.remove("copied");
  copyBtn.textContent = "Скопировать";
}

async function copyDeckText() {
  if (!deckText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(deckText);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = deckText;
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

async function fetchDeckFromTab(tabId, deckId, code) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    files: ["page-bridge.js"],
  });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (deckId, code) => {
      try {
        const bridge = window.__berserkDeckImporter;
        if (!bridge?.fetchDeck) {
          return {
            ok: false,
            error: "Не удалось инициализировать расширение на странице.",
          };
        }

        const deck = await bridge.fetchDeck(deckId, code);
        return { ok: true, deck };
      } catch (error) {
        return {
          ok: false,
          error: error.message || "Не удалось загрузить колоду.",
        };
      }
    },
    args: [deckId, code],
  });

  return result?.result;
}

copyBtn.addEventListener("click", copyDeckText);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    showStatus("Не удалось определить текущую вкладку.", true);
    return;
  }

  const parsed = parseDeckUrl(tab.url);
  if (!parsed) {
    showStatus(
      "Откройте страницу колоды на berserkdeck.ru\n(например, /decks/53458).",
      true
    );
    return;
  }

  showStatus("Загрузка колоды…");

  try {
    const response = await fetchDeckFromTab(
      tab.id,
      parsed.deckId,
      parsed.code
    );

    if (!response?.ok) {
      showStatus(response?.error || "Не удалось загрузить колоду.", true);
      return;
    }

    showDeck(formatDeckText(response.deck));
  } catch {
    showStatus(
      "Не удалось получить данные со страницы.\nОбновите вкладку berserkdeck.ru и попробуйте снова.",
      true
    );
  }
}

init();
