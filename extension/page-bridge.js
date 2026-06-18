(function () {
  const API_BASE = "https://www.berserkdeck.ru/dev/api";
  const ACCESS_TOKEN_KEY = "access_token";

  function getAccessToken() {
    try {
      const raw = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!raw) {
        return "";
      }

      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" ? parsed : "";
      } catch {
        return raw;
      }
    } catch {
      return "";
    }
  }

  function buildDeckApiUrl(deckId, code) {
    const apiUrl = new URL(`${API_BASE}/decks/${deckId}`);
    if (code) {
      apiUrl.searchParams.set("code", code);
    }
    return apiUrl.toString();
  }

  async function fetchDeck(deckId, code) {
    const accessToken = getAccessToken();
    const headers = { Accept: "application/json" };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(buildDeckApiUrl(deckId, code), { headers });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const apiMessage = payload.errorMessages?.[0];

      if (response.status === 404) {
        if (!accessToken) {
          throw new Error(
            "Колода недоступна. Войдите на berserkdeck.ru под своим аккаунтом."
          );
        }
        throw new Error(
          apiMessage || "Колода не найдена или у вас нет доступа."
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error("Сессия истекла. Обновите страницу и войдите снова.");
      }

      throw new Error(apiMessage || `Ошибка загрузки (${response.status}).`);
    }

    const payload = await response.json();
    const deck = payload.data ?? payload;

    if (!deck?.hero) {
      throw new Error("Не удалось разобрать данные колоды.");
    }

    return deck;
  }

  window.__berserkDeckImporter = { fetchDeck };
})();
