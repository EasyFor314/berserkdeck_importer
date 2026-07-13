function parseBerserkdeckUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "berserkdeck.ru") {
    return null;
  }

  const deckMatch = url.pathname.match(/^\/decks\/(\d+)(?:\/edit)?\/?$/);
  if (deckMatch) {
    return {
      type: "deck",
      deckId: deckMatch[1],
      code: url.searchParams.get("code") || "",
    };
  }

  const albumMatch = url.pathname.match(/^\/albums\/(\d+)\/?$/);
  if (albumMatch) {
    return {
      type: "album",
      albumId: albumMatch[1],
    };
  }

  return null;
}

function parseDeckUrl(urlString) {
  const parsed = parseBerserkdeckUrl(urlString);
  if (!parsed || parsed.type !== "deck") {
    return null;
  }

  return {
    deckId: parsed.deckId,
    code: parsed.code,
  };
}

function parseAlbumUrl(urlString) {
  const parsed = parseBerserkdeckUrl(urlString);
  if (!parsed || parsed.type !== "album") {
    return null;
  }

  return {
    albumId: parsed.albumId,
  };
}

function sortCards(cards) {
  return [...cards].sort((a, b) =>
    a.card.name.localeCompare(b.card.name, "ru")
  );
}

function formatCardLines(cards) {
  return sortCards(cards).map((item) => `${item.count} ${item.card.name}`);
}

function formatDeckText(deck) {
  const lines = [
    "Герой:",
    deck.hero?.name || "—",
    "",
    "Основная колода:",
    ...formatCardLines(deck.mainDeck || []),
    "",
    "Дополнительная колода:",
    ...formatCardLines(deck.sideboard || []),
  ];

  return lines.join("\n");
}

function sortAlbumCards(cards) {
  return [...cards].sort((a, b) =>
    (a.card?.name || "").localeCompare(b.card?.name || "", "ru")
  );
}

function formatAlbumCardLine(item) {
  const count = item.count ?? 1;
  const condition = item.condition || "NM";
  const name = item.card?.name || "—";
  const price = item.price;

  const line = `${count} ${condition} ${name}`;
  if (price === null || price === undefined || price === "") {
    return line;
  }

  return `${line} ${price}`;
}

function formatAlbumText(album, cards) {
  const albumName = album?.data?.name || album?.data?.albumName || "—";
  const lines = ["Альбом:", albumName, "", ...sortAlbumCards(cards).map(formatAlbumCardLine)];

  return lines.join("\n");
}
