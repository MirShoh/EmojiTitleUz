/* ============================================================================
 *  EmojiTitle — dizayn dvigateli (serversiz, to'liq brauzerda)
 *
 *  matn -> keng (n * 100 px) canvas -> 100x100 bo'laklar
 *  Eksport: PNG, APNG, ZIP (emoji-pak), Telegram Bot API (statik emoji-pak)
 *
 *  Telegram custom emoji: 100x100 px. Animatsiya: 60 kadr / 30 FPS = 2 s (aylanma).
 * ========================================================================== */
(function (root) {
  'use strict';

  const TILE = 100;
  const FPS = 30;
  const FRAMES = 60;
  const REF_H = 300; // o'lchash uchun mos yozuv balandligi (layout masshtabdan mustaqil)

  // ------------------------------------------------------------------ utils
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function toBlob(canvas, type) {
    type = type || 'image/png';
    if (canvas.toBlob) {
      return new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob xatosi'))), type));
    }
    // Node (faqat testlar uchun)
    return Promise.resolve(new Blob([canvas.toBuffer(type)], { type }));
  }

  async function blobBytes(b) { return new Uint8Array(await b.arrayBuffer()); }

  const APOS = /[\u2019\u2018\u02BC\u02BB`\u00B4]/g;
  function normalize(s) { return String(s).replace(APOS, "'").split(/\s+/).filter(Boolean).join(' '); }

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbStr = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function hsv2rgb(h, s, v) {
    const h6 = h * 6, i = Math.floor(h6) % 6, f = h6 - Math.floor(h6);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
    return [r * 255, g * 255, b * 255];
  }

  // ------------------------------------------------------------- shriftlar
  const FONTS = [
    { id: 'Arial', label: 'Arial', css: 'Arial, "Liberation Sans", Helvetica', weight: 700 },
    { id: 'Comic Sans', label: 'Comic Sans', css: '"Comic Sans MS", "Comic Neue", "Chalkboard SE"', weight: 700 },
    { id: 'Montserrat', label: 'Montserrat', css: '"Montserrat"', weight: 800 },
    { id: 'Rubik', label: 'Rubik', css: '"Rubik"', weight: 700 },
    { id: 'Nunito', label: 'Nunito', css: '"Nunito"', weight: 900 },
    { id: 'Oswald', label: 'Oswald', css: '"Oswald"', weight: 600 },
    { id: 'Comfortaa', label: 'Comfortaa', css: '"Comfortaa"', weight: 700 },
    { id: 'Playfair', label: 'Playfair', css: '"Playfair Display"', weight: 800 },
    { id: 'Pacifico', label: 'Pacifico', css: '"Pacifico"', weight: 400 },
    { id: 'Lobster', label: 'Lobster', css: '"Lobster"', weight: 400 },
    { id: 'Caveat', label: 'Caveat', css: '"Caveat"', weight: 700 },
    { id: 'Marck Script', label: 'Marck Script', css: '"Marck Script"', weight: 400 },
    { id: 'Russo One', label: 'Russo One', css: '"Russo One"', weight: 400 },
    { id: 'Bangers', label: 'Bangers', css: '"Bangers"', weight: 400, cyr: false },
    { id: 'Marker', label: 'Marker', css: '"Permanent Marker"', weight: 400, cyr: false },
    { id: 'Pixel', label: 'Pixel', css: '"Press Start 2P"', weight: 400 },
  ];

  function fontById(id) { return FONTS.find((f) => f.id === id) || FONTS[0]; }
  function fontString(f, size, italic) {
    return `${italic ? 'italic ' : ''}${f.weight} ${size}px ${f.css}, "Segoe UI", system-ui, sans-serif`;
  }

  /** Shrift (va kerakli unicode qismi) yuklanishini kutadi. */
  async function ensureFont(f, text) {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
    try { await document.fonts.load(fontString(f, 100), text || 'Aa'); } catch (e) { /* tizim shrifti */ }
  }

  // --------------------------------------------- mavzular, shakllar, animatsiyalar
  const THEMES = {
    blue_green: { label: "Moviy–yashil", c1: [0, 98, 255], c2: [0, 200, 83], text: [255, 255, 255] },
    purple_red: { label: 'Binafsha–qizil', c1: [70, 0, 255], c2: [255, 0, 60], text: [255, 255, 255] },
    sunset: { label: 'Quyosh botishi', c1: [255, 150, 0], c2: [255, 0, 120], text: [255, 255, 255] },
    ocean: { label: 'Okean', c1: [0, 190, 255], c2: [58, 71, 213], text: [255, 255, 255] },
    mint: { label: 'Yalpiz', c1: [0, 121, 107], c2: [46, 204, 113], text: [255, 255, 255] },
    pink: { label: 'Pushti', c1: [255, 64, 129], c2: [255, 138, 101], text: [255, 255, 255] },
    gold: { label: 'Oltin', c1: [255, 214, 10], c2: [255, 140, 0], text: [70, 35, 0] },
    dark: { label: 'Qora', c1: [22, 22, 32], c2: [85, 85, 112], text: [255, 255, 255] },
    light: { label: 'Oq', c1: [255, 255, 255], c2: [212, 220, 235], text: [25, 30, 45] },
    news_blue: { label: 'Yangilik: to\'q ko\'k → ko\'k', c1: [8, 24, 84], c2: [10, 120, 255], text: [255, 255, 255] },
    news_red: { label: 'Yangilik: qizil', c1: [88, 0, 22], c2: [255, 42, 64], text: [255, 255, 255] },
    news_green: { label: 'Yangilik: yashil', c1: [0, 58, 40], c2: [30, 214, 122], text: [255, 255, 255] },
    news_purple: { label: 'Yangilik: binafsha', c1: [32, 8, 84], c2: [158, 64, 255], text: [255, 255, 255] },
    black_gold: { label: 'Qora–oltin', c1: [10, 10, 12], c2: [86, 62, 8], text: [255, 208, 64] },
    aurora: { label: 'Aurora', c1: [0, 201, 167], c2: [123, 47, 247], text: [255, 255, 255] },
    insta: { label: 'Insta', c1: [131, 58, 180], c2: [253, 29, 29], text: [255, 255, 255] },
    cyber: { label: 'Kiber', c1: [0, 229, 255], c2: [255, 0, 200], text: [255, 255, 255] },
    lime: { label: 'Neon laym', c1: [182, 255, 0], c2: [0, 214, 143], text: [8, 30, 20] },
    rainbow: { label: 'Kamalak', c1: [0, 0, 0], c2: [0, 0, 0], text: [255, 255, 255], rainbow: true },
    adaptive: { label: 'Adaptiv (matn rangiga moslashadi)', c1: [255, 255, 255], c2: [255, 255, 255], text: [255, 255, 255], repaint: true },
    custom: { label: 'Maxsus', c1: [106, 0, 255], c2: [255, 0, 80], text: [255, 255, 255] },
  };

  // Kattalik: [oddiy, katta, maksimal]. Maksimalda fon butun balandlikni egallaydi va harflar katta bo'ladi.
  const SIZES = {
    normal: { label: 'Oddiy', cap: 0.40, i: 0 },
    big: { label: 'Katta', cap: 0.48, i: 1 },
    max: { label: 'Maksimal', cap: 0.55, i: 2 },
  };

  // Har bir maydon: [oddiy, katta, maksimal] yoki bitta son. Barchasi TILE balandligi ulushida.
  const SHAPES = {
    pill: { label: 'Kapsula', bg: true, ix: [0.06, 0.03, 0], iy: [0.13, 0.07, 0], radius: [0.37, 0.43, 0.5], pad: [0.36, 0.40, 0.44] },
    round: { label: 'Yumaloq', bg: true, ix: [0.06, 0.03, 0], iy: [0.13, 0.07, 0], radius: [0.20, 0.21, 0.22], pad: [0.26, 0.25, 0.24] },
    block: { label: 'Blok', bg: true, ix: 0, iy: 0, radius: 0, pad: [0.24, 0.24, 0.22] },
    banner: { label: 'Banner', bg: true, ix: 0, iy: 0, radius: 0, slantR: [0.20, 0.22, 0.24], pad: [0.24, 0.24, 0.22] },
    ribbon: { label: 'Lenta', bg: true, ix: 0, iy: 0, radius: 0, slantR: [0.20, 0.22, 0.24], cornerL: [0.14, 0.16, 0.18], cornerR: [0.05, 0.06, 0.07], pad: [0.30, 0.30, 0.30] },
    slant: { label: 'Qiya', bg: true, ix: 0, iy: 0, radius: 0, slantL: [0.20, 0.22, 0.24], slantR: [0.20, 0.22, 0.24], pad: [0.24, 0.24, 0.22] },
    none: { label: 'Fonsiz', bg: false, ix: 0, iy: 0, radius: 0, pad: 0.10 },
    // ---- zamonaviy shakllar ----
    arrow: { label: 'Strelka', bg: true, kind: 'arrow', ix: 0, iy: [0.10, 0.05, 0], radius: 0.09, point: [0.26, 0.28, 0.30], effR: [0.26, 0.28, 0.30], pad: [0.26, 0.26, 0.24] },
    hex: { label: 'Kristall', bg: true, kind: 'hex', ix: 0, iy: [0.10, 0.05, 0], radius: 0.05, point: [0.22, 0.24, 0.26], effL: [0.22, 0.24, 0.26], effR: [0.22, 0.24, 0.26], pad: [0.26, 0.26, 0.24] },
    ticket: { label: 'Bilet', bg: true, kind: 'ticket', ix: [0.04, 0.02, 0], iy: [0.10, 0.05, 0], radius: 0.10, notch: [0.12, 0.13, 0.14], pad: [0.36, 0.36, 0.34] },
    bubble: { label: 'Xabar', bg: true, kind: 'bubble', ix: [0.04, 0.02, 0], iy: [0.08, 0.04, 0], radius: [0.26, 0.28, 0.30], tail: [0.14, 0.15, 0.16], dy: [-0.07, -0.075, -0.08], pad: [0.34, 0.34, 0.32] },
    chamfer: { label: 'Kesik', bg: true, kind: 'chamfer', ix: 0, iy: [0.10, 0.05, 0], radius: 0.03, chamfer: [0.18, 0.20, 0.22], pad: [0.28, 0.28, 0.26] },
    leaf: { label: 'Barg', bg: true, kind: 'leaf', ix: [0.04, 0.02, 0], iy: [0.10, 0.05, 0], radius: [0.40, 0.45, 0.50], pad: [0.34, 0.34, 0.32] },
    scallop: { label: 'Tishli', bg: true, kind: 'scallop', ix: [0.05, 0.03, 0], iy: [0.05, 0.03, 0], bump: [0.07, 0.075, 0.08], pad: [0.32, 0.32, 0.30] },
    ring: { label: 'Kontur', bg: true, kind: 'ring', ix: [0.05, 0.04, 0.02], iy: [0.10, 0.06, 0.02], radius: [0.30, 0.34, 0.38], bw: [0.06, 0.07, 0.08], pad: [0.34, 0.34, 0.34] },
    sticker: { label: 'Stiker', bg: false, outline: [0.075, 0.085, 0.09], ix: 0, iy: 0, radius: 0, pad: 0.15 },
  };

  /** Shakl geometriyasini tanlangan kattalik uchun hisoblaydi. */
  function geom(shapeKey, sizeKey) {
    const sh = SHAPES[shapeKey] || SHAPES.pill;
    const i = (SIZES[sizeKey] || SIZES.max).i;
    const g = (v) => (Array.isArray(v) ? v[i] : (v || 0));
    const slantL = g(sh.slantL), slantR = g(sh.slantR);
    return {
      bg: sh.bg, kind: sh.kind || '', ix: g(sh.ix), iy: g(sh.iy), radius: g(sh.radius), pad: g(sh.pad),
      slantL, slantR, cornerL: g(sh.cornerL), cornerR: g(sh.cornerR),
      // matn joylashuvi uchun samarali chap/o'ng qirqim (qiya, uchli shakllarda)
      effL: sh.effL !== undefined ? g(sh.effL) : slantL, effR: sh.effR !== undefined ? g(sh.effR) : slantR,
      dy: g(sh.dy), point: g(sh.point), notch: g(sh.notch), tail: g(sh.tail), chamfer: g(sh.chamfer),
      bump: g(sh.bump), bw: g(sh.bw), outline: g(sh.outline),
    };
  }

  const ANIMS = {
    none: 'Animatsiyasiz',
    wave: "To'lqin",
    pulse: 'Puls',
    swing: 'Tebranish',
    marquee: 'Yugurish',
    flow: 'Gradient oqimi',
    float: 'Suzish',
    bounce: 'Sakrash',
    shake: 'Titroq',
    glitch: 'Glitch',
    type: 'Yozilish',
    shine: 'Yaltirash',
  };

  function themeOf(design) {
    if (design.theme === 'custom') {
      const c = design.custom || {};
      return {
        c1: hexToRgb(c.c1 || '#6a00ff'), c2: hexToRgb(c.c2 || '#ff0050'),
        text: hexToRgb(c.text || '#ffffff'),
      };
    }
    return THEMES[design.theme] || THEMES.blue_green;
  }

  // ------------------------------------------------------------------ layout
  class TooWide extends Error {
    constructor(tiles, max) { super(`${tiles} ta emoji kerak (limit ${max})`); this.tiles = tiles; this.max = max; }
  }

  /** Matn necha emojiga sig'ishini va shrift o'lchamini hisoblaydi (masshtabdan mustaqil). */
  function makePlan(design, maxTiles) {
    maxTiles = maxTiles || 20;
    const text = normalize(design.text);
    if (!text) throw new Error('Matn bo\'sh');
    const f = fontById(design.font);
    const italic = !!design.italic;
    const sizeKey = SIZES[design.size] ? design.size : 'max';
    const theme = themeOf(design);
    const spec = geom(theme.repaint ? 'none' : design.shape, sizeKey);
    const ctx = mk(10, 10).getContext('2d');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = fontString(f, 200, italic);
    const cap200 = Math.max(1, ctx.measureText('H').actualBoundingBoxAscent);
    const size = Math.max(8, 200 * (SIZES[sizeKey].cap * REF_H) / cap200);   // bosh harf balandligi = cap * H
    ctx.font = fontString(f, size, italic);
    const m = ctx.measureText(text);
    const l = -m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight;
    const cap = ctx.measureText('H').actualBoundingBoxAscent;
    const tw = r - l;
    const need = tw + 2 * (spec.ix + spec.pad) * REF_H + ((spec.effL + spec.effR) / 2) * REF_H;
    const tiles = Math.max(1, Math.ceil(need / REF_H - 1e-6));
    if (tiles > maxTiles) throw new TooWide(tiles, maxTiles);
    return {
      text, font: f, italic, theme, spec, tiles,
      sizeR: size / REF_H, lR: l / REF_H, rR: r / REF_H, capR: cap / REF_H,
      shiftR: (spec.effL - spec.effR) / 4,     // qiya qirralar tufayli ko'rinadigan markaz siljishi
      dyR: spec.dy || 0,                       // vertikal siljish (masalan, «Xabar» dumi uchun)
      animated: design.anim !== 'none',
    };
  }

  /** Uchlari turli radiusda yumaloqlangan ko'pburchak (arcTo bilan). */
  function roundedPoly(ctx, pts, radii) {
    const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const st = mid(pts[n - 1], pts[0]);
    ctx.beginPath();
    ctx.moveTo(st[0], st[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      ctx.arcTo(pts[i][0], pts[i][1], m[0], m[1], radii[i] || 0);
    }
    ctx.closePath();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- renderer
  /**
   * @param design {text,font,theme,shape,anim,custom}
   * @param opts   {scale: piksel/TILE (1 => 100px balandlik), plan, maxTiles}
   * @returns {tiles, W, H, frames, animated, canvas, ctx, draw(p)}  p = 0..1 (to'liq sikl)
   */
  function createRenderer(design, opts) {
    opts = opts || {};
    const plan = opts.plan || makePlan(design, opts.maxTiles);
    const S = opts.scale || 2;
    const H = Math.round(TILE * S);
    const W = plan.tiles * H;
    const { theme, spec, font } = plan;   // spec: geom() natijasi
    const anim = design.anim;
    const speed = design.speed > 1 ? Math.round(design.speed) : 1;
    const tw = (plan.rR - plan.lR) * H;

    // 1) matn maskasi (oq matn, shaffof fon)
    const textX = W / 2 - ((plan.lR + plan.rR) * H) / 2 + plan.shiftR * H;
    const textY = H / 2 + (plan.capR * H) / 2 + plan.dyR * H;
    const inkL = textX + plan.lR * H;                 // matnning chap chekkasi (px)
    const mask = mk(W, H);
    const mc = mask.getContext('2d');
    mc.font = fontString(font, plan.sizeR * H, plan.italic);
    mc.fillStyle = '#fff';
    mc.textAlign = 'left';
    mc.textBaseline = 'alphabetic';
    mc.fillText(plan.text, textX, textY);

    // 1b) «Stiker»: matn atrofidagi qalin kontur (alohida niqob, animatsiyada matn bilan birga harakatlanadi)
    let outMask = null, outColor = [255, 255, 255];
    if (spec.outline) {
      outMask = mk(W, H);
      const oc = outMask.getContext('2d');
      oc.font = mc.font; oc.textAlign = 'left'; oc.textBaseline = 'alphabetic';
      oc.fillStyle = '#fff'; oc.strokeStyle = '#fff';
      oc.lineJoin = 'round'; oc.miterLimit = 2; oc.lineWidth = spec.outline * H;
      oc.strokeText(plan.text, textX, textY);
      oc.fillText(plan.text, textX, textY);
      const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const avg = theme.rainbow ? 120 : (lum(theme.c1) + lum(theme.c2)) / 2;
      outColor = avg > 150 ? [20, 22, 34] : [255, 255, 255];   // yorug' matnga qora, qorong'iga oq kontur
    }

    // 2) shakl maskasi
    let shapeMask = null, clipMask = null;
    const isRing = spec.kind === 'ring';
    if (spec.bg) {
      shapeMask = mk(W, H);
      const sc = shapeMask.getContext('2d');
      sc.fillStyle = '#fff';
      const x0 = spec.ix * H, x1 = W - spec.ix * H, y0 = spec.iy * H, y1 = H - spec.iy * H;
      const w = x1 - x0, h = y1 - y0, ym = (y0 + y1) / 2, r = spec.radius * H;
      const kind = spec.kind || ((spec.slantL || spec.slantR) ? 'poly' : 'rrect');
      if (kind === 'poly') {                       // banner / lenta / qiya
        const cl = spec.cornerL * H, cr = spec.cornerR * H;
        roundedPoly(sc, [
          [x0 + spec.slantL * H, y0], [x1, y0], [x1 - spec.slantR * H, y1], [x0, y1],
        ], [spec.slantL ? cr : cl, cr, cr, cl]);
        sc.fill();
      } else if (kind === 'arrow') {               // o'ngga qaragan strelka
        const p = spec.point * H;
        roundedPoly(sc, [[x0, y0], [x1 - p, y0], [x1, ym], [x1 - p, y1], [x0, y1]], [r, r, 0.05 * H, r, r]);
        sc.fill();
      } else if (kind === 'hex') {                 // ikki uchi uchli «kristall»
        const p = spec.point * H;
        roundedPoly(sc, [[x0 + p, y0], [x1 - p, y0], [x1, ym], [x1 - p, y1], [x0 + p, y1], [x0, ym]], [r, r, r, r, r, r]);
        sc.fill();
      } else if (kind === 'chamfer') {             // kesilgan burchaklar
        const c = spec.chamfer * H;
        roundedPoly(sc, [
          [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
        ], [r, r, r, r, r, r, r, r]);
        sc.fill();
      } else if (kind === 'leaf') {                // qarama-qarshi burchaklari yumaloq «barg»
        const big = Math.min(r, h / 2), small = 0.12 * H;
        roundedPoly(sc, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [big, small, big, small]);
        sc.fill();
      } else if (kind === 'ticket') {              // yon tomonlarida o'yiqlari va nuqtali chizig'i bor bilet
        const nr = spec.notch * H;
        roundRectPath(sc, x0, y0, w, h, r);
        sc.fill();
        sc.globalCompositeOperation = 'destination-out';
        sc.beginPath();
        sc.moveTo(x0 + nr, ym); sc.arc(x0, ym, nr, 0, Math.PI * 2);
        sc.moveTo(x1 + nr, ym); sc.arc(x1, ym, nr, 0, Math.PI * 2);
        const dr = 0.022 * H, gap = 0.1 * H;
        for (let y = y0 + 0.06 * H; y < y1 - 0.03 * H; y += gap) {
          if (Math.abs(y - ym) < nr + 0.04 * H) continue;
          [x0 + 0.22 * H, x1 - 0.22 * H].forEach((x) => { sc.moveTo(x + dr, y); sc.arc(x, y, dr, 0, Math.PI * 2); });
        }
        sc.fill();
        sc.globalCompositeOperation = 'source-over';
      } else if (kind === 'bubble') {              // suhbat pufagi (dumi chapda pastda)
        const t = spec.tail * H;
        roundRectPath(sc, x0, y0, w, h - t, r);
        sc.fill();
        const bx = x0 + r + 0.02 * H;
        sc.beginPath();
        sc.moveTo(bx, y1 - t - 1); sc.lineTo(bx - 0.10 * H, y1); sc.lineTo(bx + 0.24 * H, y1 - t - 1);
        sc.closePath(); sc.fill();
      } else if (kind === 'scallop') {             // pochta markasi kabi to'lqinsimon chekka
        const rb = spec.bump * H, step = rb * 1.7;
        sc.fillRect(x0 + rb, y0 + rb, w - 2 * rb, h - 2 * rb);
        sc.beginPath();
        const along = (ax, ay, bx, by) => {
          const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
          for (let i = 0; i <= n; i++) {
            const cx = ax + ((bx - ax) * i) / n, cy = ay + ((by - ay) * i) / n;
            sc.moveTo(cx + rb, cy); sc.arc(cx, cy, rb, 0, Math.PI * 2);
          }
        };
        along(x0 + rb, y0 + rb, x1 - rb, y0 + rb); along(x0 + rb, y1 - rb, x1 - rb, y1 - rb);
        along(x0 + rb, y0 + rb, x0 + rb, y1 - rb); along(x1 - rb, y0 + rb, x1 - rb, y1 - rb);
        sc.fill();
      } else if (kind === 'ring') {                // faqat gradient ramka
        const bw = spec.bw * H;
        roundRectPath(sc, x0, y0, w, h, r);
        sc.fill();
        clipMask = mk(W, H);                       // ramka ichki qismi (yugurish animatsiyasi shu bilan kesiladi)
        const kc = clipMask.getContext('2d');
        kc.fillStyle = '#fff';
        roundRectPath(kc, x0 + bw, y0 + bw, w - 2 * bw, h - 2 * bw, Math.max(0, r - bw));
        kc.fill();
        sc.globalCompositeOperation = 'destination-out';
        sc.drawImage(clipMask, 0, 0);
        sc.globalCompositeOperation = 'source-over';
      } else {                                     // kapsula / yumaloq / blok
        roundRectPath(sc, x0, y0, w, h, r);
        sc.fill();
      }
      if (!clipMask) clipMask = shapeMask;
    }
    const solidText = !!shapeMask && !isRing;      // fonli shakllarda matn bitta rangda, «Kontur»da gradientda

    const out = mk(W, H), o = out.getContext('2d');
    const tmp = mk(W, H), t = tmp.getContext('2d');
    const tmp2 = outMask ? mk(W, H) : null, t2 = tmp2 ? tmp2.getContext('2d') : null;

    function gradient(ctx, phase) {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      if (theme.rainbow) {
        const N = 24;
        for (let i = 0; i <= N; i++) {
          const x = i / N;
          g.addColorStop(x, rgbStr(hsv2rgb(((x * 0.8 + phase) % 1 + 1) % 1, 0.8, 0.92)));
        }
        return g;
      }
      const colorAt = (x) => {
        const u = x * 0.5 + phase, f = u - Math.floor(u);
        return lerp(theme.c1, theme.c2, 1 - Math.abs(2 * f - 1));   // 0 -> 1 -> 0
      };
      const xs = new Set([0, 1]);
      for (let n = -1; n <= 4; n++) { const x = n - 2 * phase; if (x > 0 && x < 1) xs.add(x); }
      [...xs].sort((a, b) => a - b).forEach((x) => g.addColorStop(x, rgbStr(colorAt(x))));
      return g;
    }

    const hash = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
    const TAU = Math.PI * 2;

    /** src niqobini p (0..1) bo'yicha harakatlantirib, c kontekstiga chizadi. */
    function animateInto(c, src, p, clipM) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.clearRect(0, 0, W, H);
      const sw = Math.max(1, Math.round(H / 100));
      if (anim === 'wave' || anim === 'bounce') {
        for (let x = 0; x < W; x += sw) {
          const w = Math.min(sw, W - x);
          let dy;
          if (anim === 'wave') dy = 0.07 * H * Math.sin(TAU * (p - (x + w / 2) / (1.2 * H)));   // kasr -> silliq chetlar
          else dy = -0.10 * H * Math.pow(Math.max(0, Math.sin(TAU * (p - (x + w / 2) / (1.7 * H)))), 1.3);   // harflar ketma-ket sakraydi
          c.drawImage(src, x, 0, w, H, x, dy, w, H);
        }
      } else if (anim === 'float') {
        c.drawImage(src, 0.02 * H * Math.cos(TAU * p), 0.05 * H * Math.sin(TAU * p));
      } else if (anim === 'shake') {
        c.translate(W / 2, H / 2);
        c.rotate((0.7 * Math.PI / 180) * Math.sin(TAU * 5 * p));
        c.drawImage(src, -W / 2 + 0.018 * H * Math.sin(TAU * 6 * p), -H / 2 + 0.018 * H * Math.sin(TAU * 8 * p + 1.3));
        c.setTransform(1, 0, 0, 1, 0, 0);
      } else if (anim === 'glitch') {
        const f = Math.floor(p * FRAMES + 1e-6), burst = (f % 30) < 5;   // soniyada 2 marta qisqa «uzilish»
        if (burst) {
          const bands = 6, bh = H / bands;
          for (let i = 0; i < bands; i++) {
            const dx = (hash(f, i) - 0.5) * 0.22 * H * (hash(f + 7, i) > 0.35 ? 1 : 0);
            c.drawImage(src, 0, i * bh, W, bh, dx, i * bh, W, bh);
          }
        } else c.drawImage(src, 0, 0);
      } else if (anim === 'type') {
        const tw2 = Math.max(1, (plan.rR - plan.lR) * H);
        const grow = Math.min(1, p / 0.55), hold = p < 0.85 ? 1 : Math.max(0, 1 - (p - 0.85) / 0.15);
        const e = inkL + tw2 * (1 - Math.pow(1 - grow, 2));
        c.globalAlpha = hold;
        c.drawImage(src, 0, 0);
        c.globalAlpha = 1;
        if (grow < 1) {                              // yumshoq o'ng chekka
          const fw = 0.18 * H, g = c.createLinearGradient(e - fw, 0, e, 0);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalCompositeOperation = 'destination-in';
          c.fillStyle = g; c.fillRect(0, 0, e, H);     // e dan o'ngi o'chadi, e-fw..e oralig'i silliq so'nadi
          c.globalCompositeOperation = 'source-over';
        }
      } else if (anim === 'pulse') {
        const amp = Math.max(0, Math.min(0.07, 0.9 * (W - tw) / Math.max(tw, 1)));
        const sc2 = 1 + amp * Math.sin(TAU * p);
        c.translate(W / 2, H / 2); c.scale(sc2, sc2);
        c.drawImage(src, -W / 2, -H / 2);
        c.setTransform(1, 0, 0, 1, 0, 0);
      } else if (anim === 'swing') {
        const maxDeg = Math.min(5, Math.atan2(0.15 * H, Math.max(tw, 1) / 2) * 180 / Math.PI);
        c.translate(W / 2, H / 2); c.rotate((maxDeg * Math.PI / 180) * Math.sin(TAU * p));
        c.drawImage(src, -W / 2, -H / 2);
        c.setTransform(1, 0, 0, 1, 0, 0);
      } else if (anim === 'marquee') {
        const sh = Math.round(p * W);
        c.drawImage(src, sh, 0);
        c.drawImage(src, sh - W, 0);
        if (clipM) {
          c.globalCompositeOperation = 'destination-in';
          c.drawImage(clipM, 0, 0);
          c.globalCompositeOperation = 'source-over';
        }
      } else {
        c.drawImage(src, 0, 0);
      }
    }

    function draw(p) {
      p = (((p * speed) % 1) + 1) % 1;
      const phase = anim === 'flow' ? p : 0;
      animateInto(t, mask, p, clipMask);

      // 3) bo'yash
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = solidText ? rgbStr(theme.text) : gradient(t, phase);
      t.fillRect(0, 0, W, H);
      t.globalCompositeOperation = 'source-over';
      if (outMask) {
        animateInto(t2, outMask, p, null);
        t2.globalCompositeOperation = 'source-in';
        t2.fillStyle = rgbStr(outColor);
        t2.fillRect(0, 0, W, H);
        t2.globalCompositeOperation = 'source-over';
      }

      // 4) yig'ish
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'source-over';
      o.clearRect(0, 0, W, H);
      if (shapeMask) {
        o.fillStyle = gradient(o, phase);
        o.fillRect(0, 0, W, H);
        o.globalCompositeOperation = 'destination-in';
        o.drawImage(shapeMask, 0, 0);
        o.globalCompositeOperation = 'source-over';
        o.drawImage(tmp, 0, 0);
      } else {
        if (!theme.repaint) {
          o.shadowColor = 'rgba(0,0,0,0.45)';
          o.shadowBlur = 0.05 * H;
          o.shadowOffsetY = 0.03 * H;
        }
        o.drawImage(outMask ? tmp2 : tmp, 0, 0);
        o.shadowColor = 'rgba(0,0,0,0)';
        o.shadowBlur = 0;
        o.shadowOffsetY = 0;
        if (outMask) o.drawImage(tmp, 0, 0);
      }

      // 5) «Yaltirash»: qiyshiq nur chizig'i butun yozuv va fon bo'ylab o'tadi
      if (anim === 'shine' && !theme.repaint && p < 0.7) {
        const bw = 0.6 * H, x = -1.2 * bw + (p / 0.7) * (W + 2.4 * bw);
        o.save();
        o.globalCompositeOperation = 'source-atop';
        o.translate(x, 0);
        o.transform(1, 0, -0.4, 1, 0, 0);
        const g = o.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        o.fillStyle = g;
        o.fillRect(-bw / 2, -H, bw, 3 * H);
        o.restore();
      }
      return out;
    }

    return {
      plan, tiles: plan.tiles, W, H, frames: anim === 'none' ? 1 : FRAMES,
      animated: anim !== 'none', canvas: out, ctx: o, draw,
    };
  }

  // ------------------------------------------------------------------ CRC32
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf, crc) {
    let c = (crc === undefined ? 0 : crc) ^ 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // -------------------------------------------------------------------- ZIP
  /** entries: [{name, data: Uint8Array, mode?}] -> Blob (saqlash usuli, siqishsiz) */
  function buildZip(entries) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    const now = new Date();
    const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const e of entries) {
      const name = enc.encode(e.name), crc = crc32(e.data), size = e.data.length;
      const lh = new Uint8Array(30 + name.length), v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
      v.setUint16(8, 0, true); v.setUint16(10, dtime, true); v.setUint16(12, ddate, true);
      v.setUint32(14, crc, true); v.setUint32(18, size, true); v.setUint32(22, size, true);
      v.setUint16(26, name.length, true); v.setUint16(28, 0, true); lh.set(name, 30);
      chunks.push(lh, e.data);

      const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, (3 << 8) | 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, dtime, true);
      cv.setUint16(14, ddate, true); cv.setUint32(16, crc, true); cv.setUint32(20, size, true);
      cv.setUint32(24, size, true); cv.setUint16(28, name.length, true);
      cv.setUint32(38, ((e.mode || 0o100644) << 16) >>> 0, true); cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);
      offset += lh.length + size;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: 'application/zip' });
  }

  // ------------------------------------------------------------------- APNG
  async function deflate(u8) {
    const cs = new CompressionStream('deflate');
    const w = cs.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }

  function pngChunk(type, data) {
    const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }

  const u32 = (...n) => { const b = new Uint8Array(n.length * 4), v = new DataView(b.buffer); n.forEach((x, i) => v.setUint32(i * 4, x)); return b; };
  const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; a.forEach((x) => { o.set(x, p); p += x.length; }); return o; };

  function rawScanlines(ctx, W, H) {
    const img = ctx.getImageData(0, 0, W, H).data, row = W * 4;
    const raw = new Uint8Array((row + 1) * H);
    for (let y = 0; y < H; y++) raw.set(img.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
    return raw;
  }

  /** Animatsiyali PNG (to'liq alfa, brauzerlarda ishlaydi). */
  async function buildApng(design, opts) {
    opts = opts || {};
    const plan = makePlan(design, opts.maxTiles || 50);
    await ensureFont(plan.font, plan.text);
    const r = createRenderer(design, { scale: opts.scale || 2, plan });
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
    parts.push(pngChunk('IHDR', cat(u32(r.W, r.H), new Uint8Array([8, 6, 0, 0, 0]))));
    parts.push(pngChunk('acTL', u32(r.frames, 0)));
    let seq = 0;
    for (let k = 0; k < r.frames; k++) {
      r.draw(k / FRAMES);
      const z = await deflate(rawScanlines(r.ctx, r.W, r.H));
      const fctl = new Uint8Array(26), v = new DataView(fctl.buffer);
      v.setUint32(0, seq++); v.setUint32(4, r.W); v.setUint32(8, r.H);
      v.setUint16(20, 1); v.setUint16(22, FPS); fctl[24] = 1; fctl[25] = 0;   // dispose=BACKGROUND, blend=SOURCE
      parts.push(pngChunk('fcTL', fctl));
      parts.push(k === 0 ? pngChunk('IDAT', z) : pngChunk('fdAT', cat(u32(seq++), z)));
      if (opts.onProgress) opts.onProgress((k + 1) / r.frames);
    }
    parts.push(pngChunk('IEND', new Uint8Array(0)));
    return new Blob(parts, { type: 'image/png' });
  }

  // ---------------------------------------------------------------- eksport
  const pad = (n, w) => String(n).padStart(w, '0');

  /** Yuqori sifatli shaffof PNG (animatsiya bo'lsa — 1-kadr). */
  async function buildPng(design, opts) {
    opts = opts || {};
    const plan = makePlan(design, opts.maxTiles || 50);
    await ensureFont(plan.font, plan.text);
    const r = createRenderer(design, { scale: opts.scale || 5, plan });
    r.draw(0);
    return toBlob(r.canvas);
  }

  /**
   * Telegram uchun tayyor fayllar.
   *  format 'static' -> PNG bo'laklar; 'video' -> WEBM (VP9+alfa) bo'laklar;
   *  'frames' -> brauzer WEBM yarata olmasa, PNG kadrlar (ffmpeg skripti bilan).
   */
  async function buildTiles(design, opts) {
    opts = opts || {};
    const d = opts.forceStatic ? Object.assign({}, design, { anim: 'none' }) : design;
    const plan = makePlan(d, opts.maxTiles || 50);
    await ensureFont(plan.font, plan.text);
    const r = createRenderer(d, { scale: 3, plan });
    const T = r.tiles, N = r.frames, prog = opts.onProgress || (() => {});
    const W = root.EmojiWebm;
    const useWebm = r.animated && !!W && (await W.isSupported());

    const tc = mk(TILE, TILE), c = tc.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    const per = Array.from({ length: T }, () => []);
    for (let k = 0; k < N; k++) {
      r.draw(k / FRAMES);
      for (let i = 0; i < T; i++) {
        c.clearRect(0, 0, TILE, TILE);
        c.drawImage(r.canvas, i * r.H, 0, r.H, r.H, 0, 0, TILE, TILE);
        per[i].push(useWebm ? new Uint8ClampedArray(c.getImageData(0, 0, TILE, TILE).data)
          : await blobBytes(await toBlob(tc)));
      }
      prog(((k + 1) / N) * (useWebm ? 0.4 : 0.9));
      if (k % 6 === 5) await new Promise((res) => setTimeout(res, 0));   // interfeys qotib qolmasin
    }

    const files = [];
    if (!r.animated) {
      per.forEach((fr, i) => files.push({ name: `${pad(i + 1, 2)}.png`, data: fr[0] }));
      return { format: 'static', tiles: T, animated: false, files };
    }
    if (!useWebm) {
      per.forEach((fr, i) => fr.forEach((data, k) => files.push({ name: `${pad(i + 1, 2)}/${pad(k, 3)}.png`, data })));
      return { format: 'frames', tiles: T, animated: true, files };
    }
    for (let i = 0; i < T; i++) {
      files.push({ name: `${pad(i + 1, 2)}.webm`, data: await W.encodeEmojiWebm(per[i], { fps: FPS }) });
      prog(0.4 + (0.6 * (i + 1)) / T);
    }
    const sizes = files.map((f) => f.data.length);
    return {
      format: 'video', tiles: T, animated: true, files, seconds: N / FPS,
      maxBytes: Math.max(...sizes), totalBytes: sizes.reduce((a, b) => a + b, 0),
    };
  }

  const CONVERT_SH = `#!/bin/sh
# frames/NN/000.png ... -> webm/NN.webm  (Telegram custom emoji: VP9 + alfa, 100x100)
set -e
mkdir -p webm
for d in frames/*/; do
  n=$(basename "$d")
  ffmpeg -y -loglevel error -framerate ${FPS} -i "$d/%03d.png" \\
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -auto-alt-ref 0 -an "webm/$n.webm"
  echo "$n.webm tayyor"
done
`;
  const CONVERT_BAT = `@echo off
rem frames\\NN\\000.png ... -^> webm\\NN.webm  (Telegram custom emoji: VP9 + alfa, 100x100)
if not exist webm mkdir webm
for /d %%D in (frames\\*) do (
  ffmpeg -y -loglevel error -framerate ${FPS} -i "%%D\\%%03d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -auto-alt-ref 0 -an "webm\\%%~nxD.webm"
  echo %%~nxD.webm tayyor
)
pause
`;

  const STICKERS_HOWTO = (kind, folder, ext) => `Telegramga qo'shish — bot yaratmasdan, rasmiy @Stickers orqali:
  1. Telegramda @Stickers ni oching va  /newemojipack  yuboring.
  2. Turini tanlang: «${kind}».
  3. Pak nomini yozing.
  4. ${folder}/ papkasidagi fayllarni TARTIB bilan, «Fayl sifatida» (Send as file) yuboring: 01.${ext}, 02.${ext}, ...
  5. Har bir fayldan keyin bot emoji so'raydi — istalgan emoji (masalan 🔤) yuboring.
  6. /publish  →  (belgi so'ralsa /skip)  →  qisqa nom yozing. Havola tayyor!
Emojilarni chatda yonma-yon yozsangiz, butun yozuv hosil bo'ladi. Ishlatish uchun Premium kerak.
`;

  function readme(t) {
    if (t.format === 'static') {
      return `EmojiTitle — ${t.tiles} ta statik emoji bo'lagi
=====================================================
emoji/NN.png  -- 100x100 bo'laklar (chapdan o'ngga)
full.png      -- yuqori sifatli shaffof rasm

${STICKERS_HOWTO('Static emoji', 'emoji', 'png')}`;
    }
    if (t.format === 'video') {
      return `EmojiTitle — ${t.tiles} ta animatsiyali emoji (WEBM)
=====================================================
webm/NN.webm  -- Telegram talablariga mos: VP9 + shaffoflik, 100x100, ${t.seconds.toFixed(1)} s, 30 FPS, <= 256 KB
full.png      -- yuqori sifatli rasm (1-kadr)
animated.png  -- animatsiyali PNG (APNG) — sayt/brauzer uchun

${STICKERS_HOWTO('Video emoji', 'webm', 'webm')}`;
    }
    return `EmojiTitle — ${t.tiles} ta animatsiyali emoji bo'lagi (kadrlar)
=====================================================
Bu brauzer WEBM yarata olmadi, shuning uchun kadrlar berildi.
frames/NN/000.png...059.png  -- har bir bo'lakning kadrlari (100x100, shaffof)

WEBM yasash (ffmpeg kerak):
  Windows:      convert.bat ni ikki marta bosing
  Linux/macOS:  sh convert.sh
Natija: webm/01.webm, 02.webm, ...  Keyin @Stickers orqali yuboring:

${STICKERS_HOWTO('Video emoji', 'webm', 'webm')}
Maslahat: Chrome, Edge yoki Firefox'da ochsangiz, WEBM shu yerning o'zida yaratiladi.
`;
  }

  /** Emoji-pak ZIP. Natija: {blob, info} (info -- buildTiles natijasi, fayllarsiz). */
  async function buildEmojiZip(design, opts) {
    opts = opts || {};
    const prog = opts.onProgress || (() => {});
    const t = await buildTiles(design, { maxTiles: opts.maxTiles || 50, onProgress: (x) => prog(x * 0.7) });
    const enc = new TextEncoder();
    const dir = { static: 'emoji', video: 'webm', frames: 'frames' }[t.format];
    const entries = t.files.map((f) => ({ name: `${dir}/${f.name}`, data: f.data }));
    entries.push({ name: 'full.png', data: await blobBytes(await buildPng(design, { scale: 5 })) });
    prog(0.78);
    if (t.animated) {
      entries.push({ name: 'animated.png', data: await blobBytes(await buildApng(design, { onProgress: (x) => prog(0.78 + x * 0.2) })) });
    }
    if (t.format === 'frames') {
      entries.push({ name: 'convert.sh', data: enc.encode(CONVERT_SH), mode: 0o100755 });
      entries.push({ name: 'convert.bat', data: enc.encode(CONVERT_BAT.replace(/\n/g, '\r\n')) });
    }
    entries.push({ name: 'README.txt', data: enc.encode(readme(t)) });
    prog(1);
    const info = Object.assign({}, t, { files: undefined, count: t.files.length });
    return { blob: buildZip(entries), info };
  }

  // ---------------------------------------------------------------- Telegram
  /**
   * 1-usul: foydalanuvchining O'Z boti orqali pak yaratish (Bot API brauzerdan chaqiriladi).
   * Token faqat api.telegram.org ga yuboriladi.
   */
  async function createTelegramPack({ token, userId, title, design, onProgress }) {
    token = String(token || '').trim();
    if (!/^\d+:[\w-]{20,}$/.test(token)) throw new Error("Bot token noto'g'ri ko'rinadi");
    if (!/^\d+$/.test(String(userId).trim())) throw new Error("Telegram ID faqat raqamlardan iborat bo'lishi kerak");

    const call = async (method, form) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form });
      const j = await res.json();
      if (!j.ok) throw new Error(j.description || 'Telegram xatosi');
      return j.result;
    };

    const me = await call('getMe');
    const t = await buildTiles(design, { onProgress: (x) => onProgress && onProgress(`Tayyorlanmoqda… ${Math.round(x * 100)}%`) });
    if (t.format === 'frames') throw new Error('NO_WEBM');
    const fmt = t.format === 'video' ? 'video' : 'static';

    const name = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}_by_${me.username.toLowerCase()}`;
    const form = new FormData();
    form.append('user_id', String(userId).trim());
    form.append('name', name);
    form.append('title', (title || normalize(design.text)).slice(0, 64));
    form.append('sticker_type', 'custom_emoji');
    if (themeOf(design).repaint) form.append('needs_repainting', 'true');
    form.append('stickers', JSON.stringify(t.files.map((_, i) => ({ sticker: `attach://f${i}`, format: fmt, emoji_list: ['🔤'] }))));
    t.files.forEach((f, i) => form.append(`f${i}`, new Blob([f.data], { type: fmt === 'video' ? 'video/webm' : 'image/png' }), f.name));
    if (onProgress) onProgress('Telegramga yuborilmoqda…');
    await call('createNewStickerSet', form);
    return { name, link: `https://t.me/addstickers/${name}`, bot: me.username, tiles: t.files.length, animated: fmt === 'video' };
  }

  /**
   * 2-usul (tez): fayllar umumiy API'ga (worker/) yuklanadi, token qaytadi.
   * Foydalanuvchi t.me/<bot>?start=<token> ni ochadi — bot pakni o'zi yaratadi.
   */
  async function uploadJob({ apiUrl, design, title, onProgress }) {
    const t = await buildTiles(design, { onProgress: (x) => onProgress && onProgress(x * 0.85) });
    if (t.format === 'frames') throw new Error('NO_WEBM');
    const fd = new FormData();
    fd.append('meta', JSON.stringify({
      title: (title || normalize(design.text)).slice(0, 64),
      format: t.format === 'video' ? 'video' : 'static',
      repaint: !!themeOf(design).repaint,
      count: t.files.length,
    }));
    t.files.forEach((f, i) => fd.append(`f${i}`, new Blob([f.data], { type: f.name.endsWith('.webm') ? 'video/webm' : 'image/png' }), f.name));
    const res = await fetch(apiUrl.replace(/\/+$/, '') + '/api/jobs', { method: 'POST', body: fd });
    let j = {};
    try { j = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !j.token) throw new Error(j.error || `Server xatosi (${res.status})`);
    if (onProgress) onProgress(1);
    return { token: j.token, tiles: t.files.length, animated: t.format === 'video' };
  }

  root.EmojiCore = {
    TILE, FPS, FRAMES, FONTS, THEMES, SHAPES, SIZES, ANIMS, geom,
    normalize, fontById, fontString, ensureFont, themeOf, hexToRgb,
    makePlan, createRenderer, TooWide,
    buildPng, buildApng, buildTiles, buildEmojiZip, buildZip, createTelegramPack, uploadJob,
  };
})(typeof window !== 'undefined' ? window : globalThis);