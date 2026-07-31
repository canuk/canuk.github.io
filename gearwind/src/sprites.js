// Pixel-art authoring helpers.
// Sprites are authored as arrays of strings; each character indexes into a
// palette map. '.' or ' ' = transparent. Example:
//   const PAL = { g: '#40a040', d: '#206020' };
//   const ROWS = ['..gg..', '.gddg.', ...];
//   const img = makeSprite(ROWS, PAL);

export function makeSprite(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function flipH(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.translate(img.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  return c;
}

// Build a tileset: map of name -> canvas from {name: rows} + shared palette
export function makeTiles(defs, palette) {
  const out = {};
  for (const [name, rows] of Object.entries(defs)) out[name] = makeSprite(rows, palette);
  return out;
}
