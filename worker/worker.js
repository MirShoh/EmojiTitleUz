/* ============================================================================
 *  EmojiTitle API — Cloudflare Worker (bepul tarif yetadi)
 *
 *  Vazifasi: sayt tayyorlagan emoji fayllarini (WEBM/PNG) vaqtincha saqlaydi va
 *  Telegram bot orqali foydalanuvchi uchun emoji-pak yaratadi.
 *  Foydalanuvchi hech qanday bot yaratmaydi — faqat t.me/<bot>?start=<token> ni ochadi.
 *
 *  Oqim:  sayt --POST /api/jobs--> Worker (KV)  ->  foydalanuvchi botda /start <token> bosadi
 *         -> Telegram webhook --> Worker --createNewStickerSet--> pak tayyor.
 *
 *  Kerakli sozlamalar (README.md): KV namespace "JOBS", o'zgaruvchi BOT_USERNAME,
 *  sirlar BOT_TOKEN va WEBHOOK_SECRET.
 * ========================================================================== */

const MAX_FILES = 30;
const MAX_FILE_BYTES = 300 * 1024;
const JOB_TTL = 3600;               // 1 soat
const RATE_PER_MIN = 12;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const isWebm = (b) => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

function randomToken(bytes = 12) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function rateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
  const n = parseInt((await env.JOBS.get(key)) || '0', 10);
  if (n >= RATE_PER_MIN) return false;
  await env.JOBS.put(key, String(n + 1), { expirationTtl: 120 });
  return true;
}

// ------------------------------------------------------------------ /api/jobs
async function createJob(request, env) {
  if (!(await rateLimit(request, env))) return json({ error: "Juda ko'p so'rov. Bir daqiqadan keyin urinib ko'ring." }, 429);
  let form;
  try { form = await request.formData(); } catch (e) { return json({ error: "So'rov noto'g'ri" }, 400); }

  let meta;
  try { meta = JSON.parse(form.get('meta')); } catch (e) { return json({ error: 'meta yo\'q' }, 400); }
  const count = Number(meta.count);
  const format = meta.format === 'video' ? 'video' : meta.format === 'static' ? 'static' : null;
  if (!format || !Number.isInteger(count) || count < 1 || count > MAX_FILES) return json({ error: 'Parametrlar noto\'g\'ri' }, 400);

  const files = [];
  for (let i = 0; i < count; i++) {
    const f = form.get(`f${i}`);
    if (!f || typeof f === 'string') return json({ error: `f${i} fayli yo'q` }, 400);
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf.length > MAX_FILE_BYTES) return json({ error: `f${i} juda katta` }, 413);
    if (format === 'video' ? !isWebm(buf) : !isPng(buf)) return json({ error: `f${i} formati noto'g'ri` }, 400);
    files.push(buf);
  }

  const token = randomToken();
  const title = String(meta.title || 'Emoji').slice(0, 64);
  await env.JOBS.put(`job:${token}:meta`, JSON.stringify({ title, format, count, repaint: !!meta.repaint }), { expirationTtl: JOB_TTL });
  await Promise.all(files.map((b, i) => env.JOBS.put(`job:${token}:${i}`, b, { expirationTtl: JOB_TTL })));
  return json({ token });
}

// ------------------------------------------------------------------- Telegram
async function tg(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    ...(body instanceof FormData ? { body } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || 'Telegram xatosi');
  return j.result;
}

const say = (env, chatId, text, extra = {}) =>
  tg(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra }).catch(() => {});

async function buildPack(env, userId, chatId, token) {
  const raw = await env.JOBS.get(`job:${token}:meta`);
  if (!raw) return say(env, chatId, "⌛ Bu havola eskirgan yoki allaqachon ishlatilgan.\nSaytga qaytib, emojini qayta yuboring.");
  const meta = JSON.parse(raw);
  await say(env, chatId, '⏳ Emoji-pak yaratilmoqda…');

  const files = [];
  for (let i = 0; i < meta.count; i++) {
    const buf = await env.JOBS.get(`job:${token}:${i}`, 'arrayBuffer');
    if (!buf) return say(env, chatId, '⚠️ Fayllar topilmadi. Saytdan qayta yuboring.');
    files.push(buf);
  }

  const name = `e${userId}_${randomToken(5).replace(/[^a-z0-9]/gi, 'x').toLowerCase()}_by_${env.BOT_USERNAME.toLowerCase()}`;
  const form = new FormData();
  form.append('user_id', String(userId));
  form.append('name', name);
  form.append('title', meta.title);
  form.append('sticker_type', 'custom_emoji');
  if (meta.repaint) form.append('needs_repainting', 'true');
  form.append('stickers', JSON.stringify(files.map((_, i) => ({ sticker: `attach://f${i}`, format: meta.format, emoji_list: ['🔤'] }))));
  files.forEach((b, i) => form.append(`f${i}`, new Blob([b], { type: meta.format === 'video' ? 'video/webm' : 'image/png' }), `${i}.${meta.format === 'video' ? 'webm' : 'png'}`));

  try {
    await tg(env, 'createNewStickerSet', form);
  } catch (e) {
    return say(env, chatId, `😔 Pak yaratilmadi: ${String(e.message).replace(/[<>&]/g, '')}`);
  }

  // bir martalik: fayllarni o'chiramiz
  await Promise.all([env.JOBS.delete(`job:${token}:meta`), ...files.map((_, i) => env.JOBS.delete(`job:${token}:${i}`))]);

  const link = `https://t.me/addstickers/${name}`;
  await say(env, chatId,
    `✅ <b>Emoji-pak tayyor!</b>\n\nQo'shish uchun bosing:\n${link}\n\n⚠️ Ishlatish uchun <b>Telegram Premium</b> kerak. Emojilarni yonma-yon yozsangiz, butun yozuv chiqadi.`,
    { reply_markup: { inline_keyboard: [[{ text: "➕ Qo'shish", url: link }]] } });

  // tayyor emoji-matnni ham yuboramiz (nusxalash / forward qilish uchun)
  try {
    const set = await tg(env, 'getStickerSet', { name });
    const ids = set.stickers.map((s) => s.custom_emoji_id).filter(Boolean);
    if (ids.length) {
      await tg(env, 'sendMessage', {
        chat_id: chatId,
        text: '⬜'.repeat(ids.length),
        entities: ids.map((id, i) => ({ type: 'custom_emoji', offset: i, length: 1, custom_emoji_id: id })),
      });
    }
  } catch (e) { /* bot o'z emojisini yubora olmasa — jim o'tamiz */ }
}

async function handleUpdate(request, env, ctx) {
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  const update = await request.json();
  const msg = update.message;
  if (!msg || !msg.text || !msg.from) return new Response('ok');

  const m = msg.text.match(/^\/start(?:@\w+)?(?:\s+([\w-]{8,64}))?$/);
  if (!m) return new Response('ok');

  if (m[1]) {
    ctx.waitUntil(buildPack(env, msg.from.id, msg.chat.id, m[1]));
  } else {
    ctx.waitUntil(say(env, msg.chat.id,
      "👋 Men EmojiTitle botiman.\n\nSaytda matn yozing, uslubni tanlang va «Telegramga qo'shish» ni bosing — emoji-pak shu yerda tayyor bo'ladi."));
  }
  return new Response('ok');
}

// --------------------------------------------------------------------- router
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/api/jobs' && request.method === 'POST') return createJob(request, env);
    if (url.pathname === '/webhook' && request.method === 'POST') return handleUpdate(request, env, ctx);
    if (url.pathname === '/health') return json({ ok: true, bot: env.BOT_USERNAME || null });
    return json({ name: 'EmojiTitle API', ok: true });
  },
};
