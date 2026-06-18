const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const COLORS = {
  bg: [20, 13, 0],
  cardFace: [245, 235, 210],
  cardBorder: [157, 89, 21],
  accent: [232, 165, 75],
  line: [180, 130, 70],
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function insideRoundedRect(x, y, left, top, width, height, radius) {
  const right = left + width - 1;
  const bottom = top + height - 1;
  if (x < left || x > right || y < top || y > bottom) return false;
  if (x >= left + radius && x <= right - radius) return true;
  if (y >= top + radius && y <= bottom - radius) return true;

  const corners = [
    [left + radius, top + radius],
    [right - radius, top + radius],
    [left + radius, bottom - radius],
    [right - radius, bottom - radius],
  ];

  for (const [cx, cy] of corners) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 3;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
}

function drawCardIcon(size) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    const offset = i * 3;
    pixels[offset] = COLORS.bg[0];
    pixels[offset + 1] = COLORS.bg[1];
    pixels[offset + 2] = COLORS.bg[2];
  }

  const margin = Math.max(1, Math.round(size * 0.12));
  const cardWidth = size - margin * 2;
  const cardHeight = Math.min(size - margin * 2, Math.round(cardWidth * 1.38));
  const left = Math.round((size - cardWidth) / 2);
  const top = Math.round((size - cardHeight) / 2);
  const radius = Math.max(1, Math.round(size * 0.08));
  const border = Math.max(1, Math.round(size * 0.045));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!insideRoundedRect(x, y, left, top, cardWidth, cardHeight, radius)) {
        continue;
      }

      const onBorder =
        !insideRoundedRect(
          x,
          y,
          left + border,
          top + border,
          cardWidth - border * 2,
          cardHeight - border * 2,
          Math.max(1, radius - border)
        );

      setPixel(pixels, size, x, y, onBorder ? COLORS.cardBorder : COLORS.cardFace);
    }
  }

  const innerLeft = left + border + Math.max(1, Math.round(size * 0.06));
  const innerRight = left + cardWidth - border - Math.max(1, Math.round(size * 0.06));
  const lineThickness = Math.max(1, Math.round(size * 0.04));
  const lineCount = size >= 48 ? 3 : size >= 24 ? 2 : 1;
  const lineAreaTop = top + border + Math.round(cardHeight * 0.28);
  const lineAreaBottom = top + cardHeight - border - Math.round(cardHeight * 0.2);
  const lineGap =
    lineCount > 1
      ? Math.max(lineThickness + 1, Math.floor((lineAreaBottom - lineAreaTop) / (lineCount + 1)))
      : 0;

  for (let i = 0; i < lineCount; i++) {
    const lineY =
      lineCount === 1
        ? Math.round(top + cardHeight * 0.52)
        : lineAreaTop + lineGap * (i + 1);
    for (let y = lineY; y < lineY + lineThickness; y++) {
      for (let x = innerLeft; x <= innerRight; x++) {
        setPixel(pixels, size, x, y, COLORS.line);
      }
    }
  }

  if (size >= 32) {
    const emblemSize = Math.max(2, Math.round(size * 0.1));
    const emblemX = left + Math.round(cardWidth * 0.5) - Math.floor(emblemSize / 2);
    const emblemY = top + border + Math.max(1, Math.round(size * 0.08));
    for (let y = emblemY; y < emblemY + emblemSize; y++) {
      for (let x = emblemX; x < emblemX + emblemSize; x++) {
        setPixel(pixels, size, x, y, COLORS.accent);
      }
    }
  }

  return pixels;
}

function createPng(size, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.alloc((1 + size * 3) * size);
  for (let y = 0; y < size; y++) {
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const offset = 1 + x * 3;
      const src = (y * size + x) * 3;
      row[offset] = pixels[src];
      row[offset + 1] = pixels[src + 1];
      row[offset + 2] = pixels[src + 2];
    }
    row.copy(raw, y * row.length);
  }

  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, "icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const pixels = drawCardIcon(size);
  const png = createPng(size, pixels);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
}

console.log("Icons created.");
