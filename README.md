# 🎨 EmojiTitle — matndan animatsiyali Telegram emoji

Matn yozing → uslubni tanlang → **Telegramga qo'shing**. Sayt statik (HTML + CSS + JS), server shart emas.

## Ochish

* Eng oson: `index.html` ni ikki marta bosib **Chrome / Edge / Firefox** da oching.
* Yoki: `python -m http.server 8000` → http://localhost:8000
* Internetga qo'yish: papkani GitHub Pages / Netlify / Cloudflare Pages ga yuklang (build kerak emas).

## Animatsiyali emoji Telegramda qanday ishlaydi

Telegram animatsiyali custom emoji uchun **WEBM (VP9 + shaffoflik), 100×100, ≤ 3 s, ≤ 30 FPS, ≤ 256 KB** talab qiladi.
Sayt buni **brauzerning o'zida** yaratadi (WebCodecs + o'z WebM muxer'i) — ffmpeg ham, skript ham kerak emas.
Fayllar `ffprobe`/`libvpx` va Chrome pleyerida tekshirilgan (shaffoflik to'g'ri, odatda 10–35 KB).

### Telegramga qo'shishning 3 yo'li (hech birida foydalanuvchi bot yaratmaydi)

| Yo'l | Kim uchun | Nima kerak |
|---|---|---|
| ⚡ **Tez yo'l** | hamma | Sayt egasi bir marta `worker/` ni o'rnatadi (pastda). Foydalanuvchi: tugma → «Start» → tayyor |
| 📲 **@Stickers orqali** | hamma, hech qanday sozlamasiz | Rasmiy @Stickers botiga fayllarni qo'lda yuboradi (sayt qadamlarni va nusxalash tugmalarini beradi) |
| 🤖 **O'z botim bilan** | ilg'orlar | O'z bot tokeni + Telegram ID; brauzerdan to'g'ridan-to'g'ri yaratiladi |

`config.js` da `apiUrl` bo'sh bo'lsa, «Tez yo'l» yashiriladi va @Stickers yo'li ochiq turadi.

## «Tez yo'l»ni yoqish (bir marta, ~10 daqiqa, bepul)

Worker fayllarni 1 soatga saqlaydi va foydalanuvchi botda `/start <token>` bosganda pakni **uning nomiga** yaratadi.

```bash
# 1) @BotFather da bitta umumiy bot oching (/newbot) — token va username oling
# 2) Cloudflare hisobi (bepul) + wrangler
npm i -g wrangler && wrangler login
cd worker
wrangler kv namespace create JOBS          # chiqqan id ni wrangler.toml ga yozing
# wrangler.toml da BOT_USERNAME ni o'zgartiring (@ siz)
wrangler secret put BOT_TOKEN              # BotFather tokeni
wrangler secret put WEBHOOK_SECRET         # istalgan uzun tasodifiy matn (A-Z a-z 0-9 _ -)
wrangler deploy                            # -> https://emojititle-api.<nom>.workers.dev

# 3) Telegram webhook'ni ulang
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://emojititle-api.<nom>.workers.dev/webhook" -d "secret_token=<WEBHOOK_SECRET>"
```

So'ng `config.js` ni to'ldiring:

```js
window.EMOJITITLE = { apiUrl: 'https://emojititle-api.<nom>.workers.dev', botUsername: 'SizningBotingiz' };
```

Xavfsizlik: bot tokeni faqat Worker sirlarida; havolalar 1 soat amal qiladi va bir marta ishlaydi; fayl turi va hajmi tekshiriladi; IP bo'yicha tezlik limiti bor.

## Imkoniyatlar

* Jonli preview, «Telegramda shunday ko'rinadi» (qorong'i/yorug' rejim, Oddiy / Katta / Jumbo), fonlar, bo'laklar chegaralari; ostida — «Yuklab olish».
* 16 shrift (Kirill belgisi yo'q shriftlar belgilangan va kirill matnda ogohlantiriladi), o'z shriftingizni yuklash, kursiv.
* 21 rang («yangilik» va zamonaviy gradientlar, kamalak, adaptiv, maxsus), 16 shakl (banner, strelka, kristall, bilet, xabar, kesik, barg, tishli, kontur, stiker…), 3 kattalik.
* 12 harakat (suzish, sakrash, titroq, glitch, yozilish, yaltirash…), **tezlik** (1× / 2× / 3×), 18 tayyor uslub, 🎲 tasodifiy, **★ saqlanganlar**.
* Eksport: ZIP (WEBM/PNG + README), PNG, animatsiyali PNG, 📋 rasmni nusxalash.
* Dizayn havolada saqlanadi (`#t=...`) — «🔗 Havola» bilan ulashing.

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `index.html`, `style.css` | Sahifa va dizayn |
| `core.js` | Canvas dvigateli, animatsiyalar, PNG/APNG/ZIP, Telegram API |
| `webm.js` | WEBM (VP9 + alfa) kodlagich va muxer |
| `app.js` | Interfeys |
| `config.js` | `apiUrl`, `botUsername` |
| `worker/` | «Tez yo'l» uchun Cloudflare Worker |

## Cheklovlar

* WEBM yaratish **WebCodecs** talab qiladi: Chrome, Edge, Opera, Firefox (kompyuter) va Android Chrome. Safari/iOS da ZIP'ga kadrlar + `convert` skripti beriladi.
* Custom emoji'ni ishlatish uchun Telegram **Premium** kerak (pak yaratish uchun kerak emas).
* Matn ≤ 32 belgi, ≤ 24 emoji.