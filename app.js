/* ============================================================================
 *  EmojiTitle — interfeys (core.js + webm.js dvigateli ustida)
 * ========================================================================== */
(function () {
  'use strict';
  const C = window.EmojiCore;
  const W = window.EmojiWebm;
  const cfg = window.EMOJITITLE || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const MAX_CHARS = 32;
  const MAX_TILES = 24;
  const LS = 'emojititle.v3';
  const LS_SAVED = 'emojititle.saved';
  const MAX_SAVED = 12;

  // ------------------------------------------------------------ holat
  const DEFAULT_DESIGN = {
    font: 'Montserrat', theme: 'news_blue', shape: 'ribbon', size: 'max', italic: false, anim: 'flow', speed: 1,
    custom: { c1: '#6a00ff', c2: '#ff0050', text: '#ffffff' },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const state = Object.assign({ text: 'Xushxabar' }, clone(DEFAULT_DESIGN));
  const ui = { bg: 'checker', grid: false, theme: null, tab: 'presets', emo: 34, howto: true, chat: 'dark' };
  let busy = false;
  let webmOK = null;           // null = tekshirilmoqda, true/false
  let saved = [];

  const PRESETS = [
    { name: 'Yangilik', font: 'Montserrat', theme: 'news_blue', shape: 'ribbon', size: 'max', anim: 'none' },
    { name: 'Shoshilinch', font: 'Montserrat', theme: 'news_red', shape: 'ribbon', size: 'max', italic: true, anim: 'flow' },
    { name: 'Banner', font: 'Rubik', theme: 'news_purple', shape: 'banner', size: 'max', anim: 'none' },
    { name: 'Klassik', font: 'Arial', theme: 'blue_green', shape: 'pill', size: 'max', anim: 'none' },
    { name: "To'lqin", font: 'Montserrat', theme: 'purple_red', shape: 'pill', size: 'max', anim: 'wave' },
    { name: 'Neon', font: 'Russo One', theme: 'rainbow', shape: 'none', size: 'max', anim: 'flow' },
    { name: 'Retro', font: 'Pacifico', theme: 'sunset', shape: 'round', size: 'max', anim: 'pulse' },
    { name: 'Oltin', font: 'Playfair', theme: 'black_gold', shape: 'slant', size: 'max', anim: 'none' },
    { name: 'Tungi', font: 'Oswald', theme: 'dark', shape: 'block', size: 'max', anim: 'marquee' },
    { name: 'Piksel', font: 'Pixel', theme: 'mint', shape: 'round', size: 'big', anim: 'none' },
    { name: 'Strelka', font: 'Montserrat', theme: 'insta', shape: 'arrow', size: 'max', anim: 'shine' },
    { name: 'Kristall', font: 'Rubik', theme: 'cyber', shape: 'hex', size: 'max', anim: 'glitch' },
    { name: 'Bilet', font: 'Oswald', theme: 'gold', shape: 'ticket', size: 'max', anim: 'shine' },
    { name: 'Xabar', font: 'Nunito', theme: 'aurora', shape: 'bubble', size: 'max', anim: 'bounce' },
    { name: 'Stiker', font: 'Bangers', theme: 'sunset', shape: 'sticker', size: 'max', anim: 'bounce' },
    { name: 'Kontur', font: 'Russo One', theme: 'cyber', shape: 'ring', size: 'max', anim: 'flow' },
    { name: 'Muhr', font: 'Comfortaa', theme: 'pink', shape: 'scallop', size: 'max', anim: 'float' },
    { name: 'Yozuv', font: 'Montserrat', theme: 'news_purple', shape: 'chamfer', size: 'max', anim: 'type' },
  ];

  const THEME_GROUPS = [
    ['Gradientlar', ['blue_green', 'purple_red', 'sunset', 'ocean', 'mint', 'pink', 'gold', 'dark', 'light']],
    ['Zamonaviy', ['aurora', 'insta', 'cyber', 'lime']],
    ['Yangilik uslubi', ['news_blue', 'news_red', 'news_green', 'news_purple', 'black_gold']],
    ['Maxsus', ['rainbow', 'adaptive', 'custom']],
  ];

  const ANIM_INFO = {
    none: ['🚫', 'Animatsiyasiz', 'Statik emoji'],
    wave: ['〰️', "To'lqin", "Harflar to'lqinsimon tebranadi"],
    pulse: ['💓', 'Puls', 'Matn yengil kattalashib-kichrayadi'],
    swing: ['🎡', 'Tebranish', "Matn chapga-o'ngga qiyshayadi"],
    marquee: ['➡️', 'Yugurish', "Matn chapdan o'ngga oqib o'tadi"],
    flow: ['✨', 'Gradient oqimi', 'Rang ichida harakatlanadi'],
    float: ['🫧', 'Suzish', 'Matn havoda yengil suzadi'],
    bounce: ['🏀', 'Sakrash', 'Harflar birin-ketin sakraydi'],
    shake: ['📳', 'Titroq', 'Matn tez-tez titraydi'],
    glitch: ['👾', 'Glitch', 'Raqamli «uzilish» effekti'],
    type: ['⌨️', 'Yozilish', 'Harflar birin-ketin yoziladi'],
    shine: ['💎', 'Yaltirash', 'Ustidan nur chizig\'i o\'tadi'],
  };
  const SIZE_INFO = { normal: "Atrofida bo'sh joy", big: 'Kattaroq', max: "To'liq balandlik" };
  const SPEEDS = [[1, '1× Oddiy'], [2, '2× Tez'], [3, '3× Juda tez']];

  const hasCyr = (t) => /[\u0400-\u04FF]/.test(t);

  function themeGradient(key) {
    if (key === 'rainbow') return 'linear-gradient(90deg,#ff3b3b,#ffb02e,#3be05b,#2ec9ff,#8a4cff,#ff3bd0)';
    const t = C.THEMES[key];
    const c = (a) => `rgb(${a.join(',')})`;
    return `linear-gradient(135deg, ${c(t.c1)}, ${c(t.c2)})`;
  }

  // ------------------------------------------------------- saqlash / havola
  function toHash() {
    const p = new URLSearchParams();
    p.set('t', state.text); p.set('f', state.font); p.set('c', state.theme);
    p.set('s', state.shape); p.set('a', state.anim); p.set('z', state.size);
    if (state.italic) p.set('i', '1');
    if (state.speed > 1) p.set('v', String(state.speed));
    if (state.theme === 'custom') { p.set('c1', state.custom.c1); p.set('c2', state.custom.c2); p.set('ct', state.custom.text); }
    return p.toString();
  }

  function applyParams(p) {
    if (p.has('t')) state.text = p.get('t').slice(0, MAX_CHARS);
    if (p.has('f') && C.FONTS.some((f) => f.id === p.get('f'))) state.font = p.get('f');
    if (p.has('c') && C.THEMES[p.get('c')]) state.theme = p.get('c');
    if (p.has('s') && C.SHAPES[p.get('s')]) state.shape = p.get('s');
    if (p.has('a') && C.ANIMS[p.get('a')]) state.anim = p.get('a');
    if (p.has('z') && C.SIZES[p.get('z')]) state.size = p.get('z');
    state.italic = p.get('i') === '1';
    const v = parseInt(p.get('v') || '1', 10);
    state.speed = [1, 2, 3].includes(v) ? v : 1;
    const hex = /^#[0-9a-f]{6}$/i;
    if (hex.test(p.get('c1') || '')) state.custom.c1 = p.get('c1');
    if (hex.test(p.get('c2') || '')) state.custom.c2 = p.get('c2');
    if (hex.test(p.get('ct') || '')) state.custom.text = p.get('ct');
  }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || 'null');
      if (s) {
        applyParams(new URLSearchParams(s.design || ''));
        ui.bg = s.bg || ui.bg; ui.grid = !!s.grid; ui.theme = s.theme || null;
        ui.tab = s.tab || ui.tab; ui.emo = s.emo || ui.emo; ui.howto = s.howto !== false; ui.chat = s.chat === 'light' ? 'light' : 'dark';
      }
    } catch (e) { /* ignore */ }
    try { saved = JSON.parse(localStorage.getItem(LS_SAVED) || '[]').slice(0, MAX_SAVED); } catch (e) { saved = []; }
    if (location.hash.length > 1) applyParams(new URLSearchParams(location.hash.slice(1)));
  }

  function saveState() {
    const h = toHash();
    try { history.replaceState(null, '', '#' + h); } catch (e) { /* ignore */ }
    try { localStorage.setItem(LS, JSON.stringify({ design: h, bg: ui.bg, grid: ui.grid, theme: ui.theme, tab: ui.tab, emo: ui.emo, howto: ui.howto, chat: ui.chat })); } catch (e) { /* ignore */ }
  }
  const saveSaved = () => { try { localStorage.setItem(LS_SAVED, JSON.stringify(saved)); } catch (e) { /* ignore */ } };

  const currentDesign = () => ({
    text: C.normalize(state.text), font: state.font, theme: state.theme, shape: state.shape,
    anim: state.anim, size: state.size, italic: state.italic, speed: state.speed, custom: state.custom,
  });
  const styleOf = () => ({
    font: state.font, theme: state.theme, shape: state.shape, size: state.size, italic: state.italic,
    anim: state.anim, speed: state.speed, custom: clone(state.custom),
  });

  // ------------------------------------------------------------- elementlar
  const el = {
    text: $('#text'), count: $('#count'), err: $('#err'), warn: $('#warn'),
    fonts: $('#fonts'), groups: $('#themeGroups'), shapes: $('#shapes'), sizes: $('#sizes'), anims: $('#anims'), speeds: $('#speeds'),
    presets: $('#presets'), saved: $('#saved'), savedEmpty: $('#savedEmpty'),
    custom: $('#customColors'), themeName: $('#themeName'), shapeNote: $('#shapeNote'),
    italic: $('#chkItalic'), view: $('#view'), stage: $('#stage'), inner: $('#stageInner'), grid: $('#gridOverlay'),
    info: $('#info'), play: $('#btnPlay'), chkGrid: $('#chkGrid'), howto: $('#howto'),
    zip: $('#btnZip'), png: $('#btnPng'), apng: $('#btnApng'), tgOpen: $('#btnTgOpen'),
    prog: $('#prog'), tgProg: $('#tgProg'), msg: $('#exportMsg'), tgStatus: $('#tgStatus'),
    webmNote: $('#webmNote'), tgNoWebm: $('#tgNoWebm'),
    chat1: $('#chatView'), chat2: $('#chatView2'), chatBg: $('#chatBg'),
  };
  const vctx = el.view.getContext('2d');

  // ------------------------------------------------------------- yig'ish
  function makeThumb(label, sub, ov, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'thumb'; b._ov = ov;
    b.innerHTML = '<canvas width="10" height="10"></canvas><span></span>' + (sub ? '<small></small>' : '');
    $('span', b).textContent = label;
    if (sub) $('small', b).textContent = sub;
    b.addEventListener('click', onClick);
    return b;
  }

  function applyStyle(p) {
    Object.assign(state, {
      font: p.font, theme: p.theme, shape: p.shape, anim: p.anim, size: p.size || 'max',
      italic: !!p.italic, speed: p.speed || 1,
    });
    if (p.custom) state.custom = clone(p.custom);
  }

  function buildPresets() {
    el.presets.innerHTML = '';
    PRESETS.forEach((p, i) => {
      const b = makeThumb(p.name, '', { font: p.font, theme: p.theme, shape: p.shape, size: p.size, italic: !!p.italic, anim: p.anim }, () => { applyStyle(p); commit(); });
      b.dataset.preset = i;
      el.presets.appendChild(b);
    });
  }

  function renderSaved() {
    el.saved.innerHTML = '';
    saved.forEach((p, i) => {
      const b = makeThumb(`№${i + 1}`, '', Object.assign({}, p), () => { applyStyle(p); commit(); });
      b.dataset.saved = i;
      const d = document.createElement('span');
      d.className = 'del'; d.textContent = '✕'; d.title = "O'chirish"; d.setAttribute('role', 'button');
      d.addEventListener('click', (e) => { e.stopPropagation(); saved.splice(i, 1); saveSaved(); renderSaved(); syncActive(); refreshThumbs(); });
      b.appendChild(d);
      el.saved.appendChild(b);
    });
    el.savedEmpty.hidden = saved.length > 0;
  }

  function buildSizes() {
    el.sizes.innerHTML = '';
    Object.keys(C.SIZES).forEach((k) => {
      const b = makeThumb(C.SIZES[k].label, SIZE_INFO[k], { size: k, anim: 'none' }, () => { state.size = k; commit(); });
      b.dataset.id = k;
      el.sizes.appendChild(b);
    });
  }

  function buildShapes() {
    el.shapes.innerHTML = '';
    Object.keys(C.SHAPES).forEach((k) => {
      const b = makeThumb(C.SHAPES[k].label, '', { shape: k, anim: 'none' }, () => { state.shape = k; commit(); });
      b.dataset.id = k;
      el.shapes.appendChild(b);
    });
  }

  function buildFonts() {
    el.fonts.innerHTML = '';
    C.FONTS.forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fnt'; b.dataset.id = f.id;
      b.innerHTML = '<span class="sample"></span><small></small>';
      const s = $('.sample', b);
      s.style.fontFamily = f.css; s.style.fontWeight = f.weight;
      $('small', b).textContent = f.label + (f.cyr === false ? ' · faqat lotin' : '');
      b.addEventListener('click', () => { state.font = f.id; commit(); });
      el.fonts.appendChild(b);
    });
    updateFontSamples();
  }

  function updateFontSamples() {
    const text = C.normalize(state.text);
    const sample = text.slice(0, 14) || 'Aa';
    const cyr = hasCyr(text);
    $$('.fnt', el.fonts).forEach((b) => {
      const s = $('.sample', b);
      s.textContent = sample;
      s.style.fontStyle = state.italic ? 'italic' : 'normal';
      const f = C.fontById(b.dataset.id);
      b.classList.toggle('dim', cyr && f.cyr === false);
    });
  }

  function buildThemes() {
    el.groups.innerHTML = '';
    THEME_GROUPS.forEach(([title, keys]) => {
      const g = document.createElement('div');
      g.className = 'tgroup';
      g.innerHTML = '<h5></h5><div class="swatches"></div>';
      $('h5', g).textContent = title;
      keys.forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sw'; b.dataset.id = k; b.title = C.THEMES[k].label;
        b.setAttribute('aria-label', C.THEMES[k].label);
        if (k === 'adaptive') b.classList.add('sw-adaptive');
        else if (k === 'custom') b.classList.add('sw-custom');
        else b.style.background = themeGradient(k);
        b.addEventListener('click', () => { state.theme = k; commit(); });
        $('.swatches', g).appendChild(b);
      });
      el.groups.appendChild(g);
    });
  }

  function buildAnims() {
    el.anims.innerHTML = '';
    Object.keys(C.ANIMS).forEach((k) => {
      const [icon, name, desc] = ANIM_INFO[k];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'anm'; b.dataset.id = k;
      b.innerHTML = '<i></i><b></b><small></small>';
      $('i', b).textContent = icon; $('b', b).textContent = name; $('small', b).textContent = desc;
      b.addEventListener('click', () => { state.anim = k; commit(); });
      el.anims.appendChild(b);
    });
    el.speeds.innerHTML = '';
    SPEEDS.forEach(([v, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.id = String(v); b.textContent = label;
      b.addEventListener('click', () => { state.speed = v; commit(); });
      el.speeds.appendChild(b);
    });
  }

  // ------------------------------------------------------------- holatni UIga yozish
  function mark(root, sel, id) {
    $$(sel, root).forEach((n) => {
      const on = n.dataset.id === id;
      n.classList.toggle('active', on);
      n.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  const sameStyle = (p) => p.font === state.font && p.theme === state.theme && p.shape === state.shape &&
    (p.size || 'max') === state.size && !!p.italic === !!state.italic && p.anim === state.anim &&
    (p.speed || 1) === state.speed && (p.theme !== 'custom' || JSON.stringify(p.custom) === JSON.stringify(state.custom));

  function updateNotes() {
    const text = C.normalize(state.text);
    const f = C.fontById(state.font);
    if (hasCyr(text) && f.cyr === false) {
      el.warn.textContent = `«${f.label}» shrifti kirill harflarini qo'llamaydi — ular boshqa shriftda chiqadi. Boshqa shrift tanlang.`;
      el.warn.hidden = false;
    } else el.warn.hidden = true;

    const noWebm = state.anim !== 'none' && webmOK === false;
    el.webmNote.hidden = !noWebm;
    el.tgNoWebm.hidden = !noWebm;
    $('#btnFast').disabled = busy || noWebm;
    $('#btnTg').disabled = busy || noWebm;
  }

  function syncActive() {
    mark(el.fonts, '.fnt', state.font);
    mark(el.groups, '.sw', state.theme);
    mark(el.shapes, '.thumb', state.shape);
    mark(el.sizes, '.thumb', state.size);
    mark(el.anims, '.anm', state.anim);
    mark(el.speeds, 'button', String(state.speed));
    $$('.thumb', el.presets).forEach((b) => b.classList.toggle('active', sameStyle(PRESETS[+b.dataset.preset])));
    $$('.thumb', el.saved).forEach((b) => b.classList.toggle('active', sameStyle(saved[+b.dataset.saved])));
    el.italic.checked = !!state.italic;
    el.custom.hidden = state.theme !== 'custom';
    el.themeName.textContent = C.THEMES[state.theme].label;
    const adaptive = state.theme === 'adaptive';
    el.shapes.style.opacity = adaptive ? '.4' : '';
    el.shapes.style.pointerEvents = adaptive ? 'none' : '';
    el.shapeNote.textContent = adaptive ? "— «Adaptiv» rangda faqat fonsiz shakl ishlaydi" : '';
    el.apng.disabled = state.anim === 'none' || busy;
    el.speeds.style.opacity = state.anim === 'none' ? '.45' : '';
    el.count.textContent = `${C.normalize(state.text).length} / ${MAX_CHARS}`;
    $$('.bgb').forEach((b) => b.classList.toggle('active', b.dataset.bg === ui.bg));
    el.stage.dataset.bg = ui.bg;
    el.chkGrid.checked = ui.grid; el.grid.hidden = !ui.grid;
    $$('#emoSize button').forEach((b) => b.classList.toggle('active', +b.dataset.px === ui.emo));
    $$('#chatTheme button').forEach((b) => b.classList.toggle('active', b.dataset.chat === ui.chat));
    el.chatBg.dataset.chat = ui.chat;
    $('#cc1').value = state.custom.c1; $('#cc2').value = state.custom.c2; $('#cct').value = state.custom.text;
    el.howto.hidden = !ui.howto;
    updateNotes();
  }

  // ------------------------------------------------------------- tablar
  function setTab(name, focus) {
    ui.tab = name;
    $$('.tabs [role="tab"]').forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.panel').forEach((p) => { p.hidden = p.id !== 'panel-' + name; });
    saveState();
    refreshThumbs();
  }

  // ------------------------------------------------------------- miniatyuralar
  let thumbToken = 0, thumbTimer = 0;

  async function paintThumbs(root) {
    const my = thumbToken;
    const text = C.normalize(state.text).slice(0, 10) || 'Aa';
    const btns = $$('.thumb', root);
    const base = currentDesign();
    const fonts = new Set(btns.map((b) => (b._ov && b._ov.font) || base.font));
    await Promise.all([...fonts].map((f) => C.ensureFont(C.fontById(f), text)));
    if (my !== thumbToken) return;
    btns.forEach((b) => {
      const cv = $('canvas', b);
      const d = Object.assign({}, base, { text }, b._ov || {});
      try {
        const plan = C.makePlan(d, 30);
        const r = C.createRenderer(d, { scale: 0.7, plan });
        r.draw(d.anim === 'none' ? 0 : 0.2);
        cv.width = r.W; cv.height = r.H;
        cv.getContext('2d').drawImage(r.canvas, 0, 0);
      } catch (e) {
        cv.width = 10; cv.height = 10;
      }
    });
  }

  function refreshThumbs() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => {
      thumbToken++;
      if (ui.tab === 'presets') { paintThumbs(el.presets); paintThumbs(el.saved); }
      else if (ui.tab === 'shape') { paintThumbs(el.sizes); paintThumbs(el.shapes); }
    }, 90);
  }

  // ------------------------------------------------------------- jonli preview
  let renderer = null, token = 0, paused = false, pausedP = 0, t0 = performance.now(), debounceT = 0;

  function showErr(msg) { el.err.textContent = msg; el.err.hidden = !msg; }

  function drawChat() {
    if (!renderer) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    [el.chat1, el.chat2].forEach((cv) => {
      const h = Math.round(ui.emo * dpr), w = renderer.tiles * h;
      if (cv.width !== w || cv.height !== h) {
        cv.width = w; cv.height = h;
        cv.style.width = renderer.tiles * ui.emo + 'px'; cv.style.height = ui.emo + 'px';
      }
      const c = cv.getContext('2d');
      c.clearRect(0, 0, w, h);
      c.imageSmoothingQuality = 'high';
      c.drawImage(renderer.canvas, 0, 0, w, h);
    });
  }

  function blit() {
    vctx.clearRect(0, 0, el.view.width, el.view.height);
    vctx.drawImage(renderer.canvas, 0, 0);
    drawChat();
  }

  async function rebuild() {
    const my = ++token;
    const design = currentDesign();
    if (!design.text) { showErr('Matn yozing'); return; }
    await C.ensureFont(C.fontById(design.font), design.text);
    if (my !== token) return;
    let plan;
    try {
      plan = C.makePlan(design, MAX_TILES);
    } catch (e) {
      if (e instanceof C.TooWide) {
        showErr(`Matn juda uzun: ${e.tiles} ta emoji kerak (limit ${e.max}). Qisqartiring, shriftni o'zgartiring yoki kattalikni kamaytiring.`);
        return;
      }
      throw e;
    }
    showErr('');
    const scale = plan.tiles > 10 ? 1.5 : 2;
    renderer = C.createRenderer(design, { scale, plan });
    el.view.width = renderer.W; el.view.height = renderer.H;
    el.inner.style.setProperty('--w', Math.min(plan.tiles * 150, 1100) + 'px');
    el.grid.style.setProperty('--n', plan.tiles);
    el.info.textContent = `${plan.tiles} ta emoji · ${renderer.animated ? 'animatsiyali' : 'statik'}`;
    el.play.hidden = !renderer.animated;
    renderer.draw(renderer.animated && paused ? pausedP : 0);
    blit();
  }

  function frameLoop(ts) {
    if (renderer && renderer.animated && !paused) {
      pausedP = ((ts - t0) / 2000) % 1;
      renderer.draw(pausedP);
      blit();
    }
    requestAnimationFrame(frameLoop);
  }

  /** Sozlama o'zgardi: UI + preview + havola + miniatyuralar yangilanadi. */
  function commit(delay) {
    syncActive();
    updateFontSamples();
    saveState();
    refreshThumbs();
    clearTimeout(debounceT);
    if (delay) debounceT = setTimeout(rebuild, delay); else rebuild();
  }

  // ------------------------------------------------------------- hodisalar
  el.text.addEventListener('input', () => { state.text = el.text.value; commit(140); });
  el.text.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.text.blur(); });

  ['cc1', 'cc2', 'cct'].forEach((id, i) => {
    $('#' + id).addEventListener('input', (e) => { state.custom[['c1', 'c2', 'text'][i]] = e.target.value; commit(60); });
  });
  el.italic.addEventListener('change', () => { state.italic = el.italic.checked; commit(); });

  $$('.bgb').forEach((b) => b.addEventListener('click', () => { ui.bg = b.dataset.bg; syncActive(); saveState(); }));
  el.chkGrid.addEventListener('change', () => { ui.grid = el.chkGrid.checked; syncActive(); saveState(); });
  $$('#emoSize button').forEach((b) => b.addEventListener('click', () => { ui.emo = +b.dataset.px; syncActive(); saveState(); drawChat(); }));

  $$('#chatTheme button').forEach((b) => b.addEventListener('click', () => { ui.chat = b.dataset.chat; syncActive(); saveState(); }));

  el.play.addEventListener('click', () => {
    paused = !paused;
    el.play.textContent = paused ? '▶' : '⏸';
    if (!paused) t0 = performance.now() - pausedP * 2000;
  });

  $$('.tabs [role="tab"]').forEach((t) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const tabs = $$('.tabs [role="tab"]'), i = tabs.indexOf(t);
      if (e.key === 'ArrowRight') { e.preventDefault(); setTab(tabs[(i + 1) % tabs.length].dataset.tab, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setTab(tabs[(i + tabs.length - 1) % tabs.length].dataset.tab, true); }
    });
  });

  $('#btnRandom').addEventListener('click', () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const text = C.normalize(state.text);
    state.font = pick(C.FONTS.filter((f) => !(hasCyr(text) && f.cyr === false))).id;
    state.theme = pick(Object.keys(C.THEMES).filter((k) => k !== 'adaptive' && k !== 'custom'));
    state.shape = pick(Object.keys(C.SHAPES));
    state.size = pick(['big', 'max', 'max']);
    state.italic = Math.random() < 0.25;
    state.anim = pick(Object.keys(C.ANIMS).filter((k) => k !== 'none'));
    commit();
  });

  $('#btnReset').addEventListener('click', () => {
    Object.assign(state, clone(DEFAULT_DESIGN));
    commit();
    toast("Dizayn boshlang'ich holatga qaytarildi");
  });

  $('#btnSave').addEventListener('click', () => {
    const s = styleOf();
    if (saved.some((p) => JSON.stringify(p) === JSON.stringify(s))) { toast('Bu dizayn allaqachon saqlangan'); return; }
    saved.unshift(s);
    saved = saved.slice(0, MAX_SAVED);
    saveSaved(); renderSaved(); syncActive(); refreshThumbs();
    toast('Dizayn saqlandi ★');
  });

  $('#howtoClose').addEventListener('click', () => { ui.howto = false; syncActive(); saveState(); });

  function applyTheme(mode) { ui.theme = mode; document.documentElement.dataset.theme = mode; }
  $('#btnTheme').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    saveState();
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  $('#btnShare').addEventListener('click', async () => {
    saveState();
    try { await navigator.clipboard.writeText(location.href); toast('Havola nusxalandi ✓ — dizayn shu havolada saqlangan'); }
    catch (e) { window.prompt('Havolani nusxalang:', location.href); }
  });

  $('#btnCopy').addEventListener('click', async () => {
    try {
      const blobP = C.buildPng(currentDesign(), { scale: 3 });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
      toast('Rasm nusxalandi ✓ — istalgan joyga qo‘ying (Ctrl+V)');
    } catch (e) { toast("Brauzer rasmni nusxalashga ruxsat bermadi — «PNG» ni yuklab oling"); }
  });

  // o'z shriftini yuklash
  $('#btnFontUpload').addEventListener('click', () => $('#fontFile').click());
  $('#fontFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const name = 'Custom ' + file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, '').slice(0, 24);
      const face = new FontFace(name, await file.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      if (!C.FONTS.some((f) => f.id === name)) C.FONTS.push({ id: name, label: name.replace('Custom ', ''), css: `"${name}"`, weight: 400 });
      buildFonts();
      state.font = name;
      commit();
      toast("Shrift qo'shildi ✓ (shu sessiya uchun)");
    } catch (err) {
      toast("Shriftni o'qib bo'lmadi");
    }
    e.target.value = '';
  });

  // ------------------------------------------------------------- eksport
  function say(text, cls) {
    el.msg.textContent = text; el.msg.className = 'note muted' + (cls ? ' ' + cls : '');
    el.tgStatus.textContent = text;
  }

  function setBusy(on) {
    busy = on;
    [el.zip, el.png, el.apng, el.tgOpen, $('#btnGuideZip'), $('#btnFast'), $('#btnTg')].forEach((b) => { b.disabled = on; });
    el.prog.hidden = !on; el.prog.value = 0;
    el.tgProg.hidden = !on; el.tgProg.value = 0;
    syncActive();
  }

  const slug = () => (C.normalize(state.text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 30)) || 'emoji';

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 15000);
  }

  function friendly(e) {
    const m = String((e && e.message) || e || '');
    if (m === 'NO_WEBM') return "Bu brauzer animatsiyali emoji (WEBM) yarata olmaydi. Chrome, Edge yoki Firefox'da oching.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Ulanib bo'lmadi. Internetni tekshiring.";
    if (e instanceof C.TooWide) return `Matn juda uzun: ${e.tiles} ta emoji kerak.`;
    return m;
  }

  async function run(label, fn) {
    if (busy) return;
    setBusy(true);
    say(label + '…');
    const progress = (x) => {
      el.prog.value = x; el.tgProg.value = x;
      say(`${label}… ${Math.round(x * 100)}%`);
    };
    try { await fn(progress); }
    catch (e) {
      console.error(e);
      say('Xatolik: ' + friendly(e), 'bad');
    } finally { setBusy(false); }
  }

  async function downloadZip(progress) {
    const d = currentDesign();
    const { blob, info } = await C.buildEmojiZip(d, { onProgress: progress });
    download(blob, `${slug()}_emoji.zip`);
    if (info.format === 'video') {
      say(`✓ ZIP yuklandi: ${info.count} ta WEBM (100×100, ${info.seconds.toFixed(1)} s, 30 FPS, eng kattasi ${Math.ceil(info.maxBytes / 1024)} KB) — Telegram talablariga mos. Ichidagi README.txt da qadamlar bor.`, 'ok');
    } else if (info.format === 'static') {
      say(`✓ ZIP yuklandi: ${info.count} ta PNG bo'lak (100×100).`, 'ok');
    } else {
      say("✓ ZIP yuklandi (kadrlar + convert skripti). Brauzeringiz WEBM yarata olmadi — Chrome, Edge yoki Firefox'da bir bosishda tayyor bo'ladi.", 'ok');
    }
  }

  el.zip.addEventListener('click', () => run('Emoji-pak tayyorlanmoqda', downloadZip));
  $('#btnGuideZip').addEventListener('click', () => run('Fayllar tayyorlanmoqda', downloadZip));

  el.png.addEventListener('click', () => run('PNG tayyorlanmoqda', async () => {
    download(await C.buildPng(currentDesign(), { scale: 5 }), `${slug()}.png`);
    say('✓ PNG yuklandi (shaffof fon).', 'ok');
  }));

  el.apng.addEventListener('click', () => run('Animatsiya tayyorlanmoqda', async (progress) => {
    download(await C.buildApng(currentDesign(), { onProgress: progress }), `${slug()}_animated.png`);
    say('✓ Animatsiyali PNG yuklandi (brauzerlarda ochiladi).', 'ok');
  }));

  // ------------------------------------------------------------- Telegram oynasi
  const dlg = $('#tgDialog');
  const tg = { token: $('#tgToken'), user: $('#tgUser'), remember: $('#tgRemember'), res: $('#tgResult') };
  const fastOK = !!(cfg.apiUrl && cfg.botUsername);

  try {
    const s = JSON.parse(localStorage.getItem(LS + '.tg') || 'null');
    if (s) { tg.token.value = s.token || ''; tg.user.value = s.user || ''; tg.remember.checked = true; }
  } catch (e) { /* ignore */ }

  function fillManual() {
    const animated = state.anim !== 'none' && webmOK !== false;
    $('#mKind').textContent = animated ? '«Video emoji»' : '«Static emoji»';
    $('#mFolder').textContent = animated ? 'webm' : 'emoji';
    const title = C.normalize(state.text).slice(0, 64);
    $('#mTitle').textContent = title;
    $('#mTitleCopy').dataset.copy = title;
  }

  function openDlg() {
    $('#mFast').hidden = !fastOK;
    $('#mManual').open = !fastOK;
    tg.res.hidden = true; $('#fastResult').hidden = true;
    el.tgStatus.textContent = '';
    fillManual();
    updateNotes();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  const closeDlg = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
  el.tgOpen.addEventListener('click', openDlg);
  $('#tgClose').addEventListener('click', closeDlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDlg(); });
  $('#tgEye').addEventListener('click', () => { tg.token.type = tg.token.type === 'password' ? 'text' : 'password'; });

  dlg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Nusxalandi ✓'); }
    catch (err) { window.prompt('Nusxalang:', b.dataset.copy); }
  });

  // --- tez yo'l: umumiy bot (worker/)
  $('#btnFast').addEventListener('click', () => run('Telegramga yuborilmoqda', async (progress) => {
    const res = $('#fastResult');
    res.hidden = true;
    try {
      const r = await C.uploadJob({ apiUrl: cfg.apiUrl, design: currentDesign(), title: C.normalize(state.text), onProgress: progress });
      const link = `https://t.me/${cfg.botUsername}?start=${r.token}`;
      res.className = 'tg-result';
      res.innerHTML = `✅ <b>Tayyor!</b> ${r.tiles} ta emoji yuborildi.<br>Endi Telegramni oching va <b>«Start»</b> ni bosing:<br>
        <a class="open-tg" href="${link}" target="_blank" rel="noopener">✈️ Telegramda ochish</a>
        <br><small>Havola 1 soat amal qiladi va bir marta ishlaydi.</small>`;
      res.hidden = false;
      say('✓ Fayllar yuborildi. Telegramda «Start» ni bosing.', 'ok');
      try { window.open(link, '_blank', 'noopener'); } catch (e) { /* brauzer to'sishi mumkin */ }
    } catch (e) {
      res.className = 'tg-result bad';
      res.textContent = '⚠️ ' + friendly(e);
      res.hidden = false;
      say('');
    }
  }));

  // --- o'z boti bilan
  function tgError(msg) {
    const m = String(msg || '');
    if (m === 'NO_WEBM') return friendly(new Error('NO_WEBM'));
    if (/unauthorized|token/i.test(m)) return "Bot token noto'g'ri. @BotFather bergan tokenni to'liq nusxalang.";
    if (/user not found|PEER_ID_INVALID|chat not found|USER_ID_INVALID/i.test(m)) return "Telegram sizni topa olmadi. Avval o'z botingizga /start yuboring va ID raqamingizni tekshiring.";
    if (/occupied|already/i.test(m)) return "Bu nom band. Yana bir marta urinib ko'ring.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Telegramga ulanib bo'lmadi. Internetni tekshiring.";
    return m;
  }

  $('#btnTg').addEventListener('click', () => run('Telegramda yaratilmoqda', async () => {
    tg.res.hidden = true;
    try {
      if (tg.remember.checked) localStorage.setItem(LS + '.tg', JSON.stringify({ token: tg.token.value, user: tg.user.value }));
      else localStorage.removeItem(LS + '.tg');
    } catch (e) { /* ignore */ }
    try {
      const r = await C.createTelegramPack({
        token: tg.token.value, userId: tg.user.value, design: currentDesign(),
        title: C.normalize(state.text), onProgress: (m) => say(m),
      });
      tg.res.className = 'tg-result';
      tg.res.innerHTML = `✅ <b>Tayyor!</b> ${r.tiles} ta ${r.animated ? 'animatsiyali ' : ''}emoji.<br><a href="${r.link}" target="_blank" rel="noopener">${r.link}</a><br>
        <small>Havolani Telegramda oching → «Qo'shish». Premium bo'lsa, istalgan chatda ishlatasiz.</small>`;
      tg.res.hidden = false;
      say('✓ Emoji-pak yaratildi.', 'ok');
    } catch (e) {
      tg.res.className = 'tg-result bad';
      tg.res.textContent = '⚠️ ' + tgError(e.message || e);
      tg.res.hidden = false;
      say('');
    }
  }));

  // ------------------------------------------------------------- boshlash
  loadState();
  applyTheme(ui.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  el.text.maxLength = MAX_CHARS;
  el.text.value = state.text;
  buildPresets(); renderSaved(); buildFonts(); buildThemes(); buildSizes(); buildShapes(); buildAnims();
  setTab(ui.tab);
  syncActive();
  saveState();
  rebuild();
  requestAnimationFrame(frameLoop);
  if (W && W.isSupported) W.isSupported().then((v) => { webmOK = v; syncActive(); });
  else webmOK = false;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rebuild(); refreshThumbs(); });
  if (matchMedia('(pointer: fine)').matches) el.text.focus();
})();