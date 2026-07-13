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

  const ALBUM_PAGE_SIZE = 128;

  function buildAuthHeaders() {
    const accessToken = getAccessToken();
    const headers = { Accept: "application/json" };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return { headers, accessToken };
  }

  async function parseApiError(response, accessToken, notFoundMessage, loginMessage) {
    const payload = await response.json().catch(() => ({}));
    const apiMessage = payload.errorMessages?.[0];

    if (response.status === 404) {
      if (!accessToken) {
        throw new Error(loginMessage);
      }
      throw new Error(apiMessage || notFoundMessage);
    }

    if (response.status === 401 || response.status === 403) {
      if (!accessToken) {
        throw new Error(loginMessage);
      }
      throw new Error("Сессия истекла. Обновите страницу и войдите снова.");
    }

    throw new Error(apiMessage || `Ошибка загрузки (${response.status}).`);
  }

  function buildDeckApiUrl(deckId, code) {
    const apiUrl = new URL(`${API_BASE}/decks/${deckId}`);
    if (code) {
      apiUrl.searchParams.set("code", code);
    }
    return apiUrl.toString();
  }

  async function fetchDeck(deckId, code) {
    const { headers, accessToken } = buildAuthHeaders();
    const response = await fetch(buildDeckApiUrl(deckId, code), { headers });

    if (!response.ok) {
      await parseApiError(
        response,
        accessToken,
        "Колода не найдена или у вас нет доступа.",
        "Колода недоступна. Войдите на berserkdeck.ru под своим аккаунтом."
      );
    }

    const payload = await response.json();
    const deck = payload.data ?? payload;

    if (!deck?.hero) {
      throw new Error("Не удалось разобрать данные колоды.");
    }

    return deck;
  }

  function buildAlbumCardsApiUrl(albumId, page) {
    const apiUrl = new URL(`${API_BASE}/albums/${albumId}/cards`);
    apiUrl.searchParams.set("page", String(page));
    apiUrl.searchParams.set("size", String(ALBUM_PAGE_SIZE));
    return apiUrl.toString();
  }

  async function fetchAlbumCardsPage(albumId, page) {
    const { headers, accessToken } = buildAuthHeaders();
    const response = await fetch(buildAlbumCardsApiUrl(albumId, page), { headers });

    if (!response.ok) {
      await parseApiError(
        response,
        accessToken,
        "Альбом не найден или у вас нет доступа.",
        "Альбом недоступен. Войдите на berserkdeck.ru под своим аккаунтом."
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  }

  async function fetchAlbum(albumId) {
    const { headers, accessToken } = buildAuthHeaders();
    const response = await fetch(`${API_BASE}/albums/${albumId}`, { headers });

    if (!response.ok) {
      await parseApiError(
        response,
        accessToken,
        "Альбом не найден или у вас нет доступа.",
        "Альбом недоступен. Войдите на berserkdeck.ru под своим аккаунтом."
      );
    }

    const payload = await response.json();
    const album = payload.data ? payload : { data: payload };
    const albumData = album.data ?? album;

    if (!albumData?.id) {
      throw new Error("Не удалось разобрать данные альбома.");
    }

    const firstPage = await fetchAlbumCardsPage(albumId, 1);
    const cards = [...(firstPage.content || [])];
    const totalPages = firstPage.totalPages || 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const nextPage = await fetchAlbumCardsPage(albumId, page);
      cards.push(...(nextPage.content || []));
    }

    return { album, cards };
  }

  window.__berserkDeckImporter = { fetchDeck, fetchAlbum };
})();
