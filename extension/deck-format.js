function parseDeckUrl(urlString) {
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

  const match = url.pathname.match(/^\/decks\/(\d+)(?:\/edit)?\/?$/);
  if (!match) {
    return null;
  }

  return {
    deckId: match[1],
    code: url.searchParams.get("code") || "",
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
