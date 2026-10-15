/* ============================================================================
 *  WEBM (VP9 + alfa) kodlagich — to'liq brauzerda (WebCodecs + o'z muxer'imiz)
 *
 *  Telegram custom emoji (video): WEBM, VP9, 100x100, <= 3 s, <= 30 FPS, <= 256 KB, ovozsiz.
 *  Shaffoflik WEBM'da ikkita VP9 oqim bilan beriladi (xuddi ffmpeg/libvpx kabi):
 *     - rang oqimi        -> asosiy Block
 *     - alfa oqimi (luma = alfa) -> BlockAdditions (BlockAddID=1), Video.AlphaMode=1
 * ========================================================================== */
(function (root) {
  'use strict';

  const SIZE = 100;
  const CODEC = 'vp09.00.10.08';          // VP9 profile 0, level 1.0, 8-bit
  const MAX_BYTES = 256 * 1024;
  const te = new TextEncoder();

  // ------------------------------------------------------------------ EBML
  const concat = (arrs) => {
    const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0));
    let p = 0;
    for (const a of arrs) { out.set(a, p); p += a.length; }
    return out;
  };
  const idBytes = (id) => { const b = []; while (id > 0) { b.unshift(id & 255); id = Math.floor(id / 256); } return Uint8Array.from(b); };
  function sizeBytes(n) {
    let len = 1;
    while (n >= Math.pow(2, 7 * len) - 1 && len < 8) len++;
    const out = new Uint8Array(len);
    let v = n;
    for (let i = len - 1; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
    out[0] |= 1 << (8 - len);
    return out;
  }
  const el = (id, payload) => concat([idBytes(id), sizeBytes(payload.length), payload]);
  function uintBytes(n) {
    const b = [];
    do { b.unshift(n % 256); n = Math.floor(n / 256); } while (n > 0);
    return Uint8Array.from(b);
  }
  const elUint = (id, n) => el(id, uintBytes(n));
  function elSint(id, n) {        // ishorali butun
    let len = 1;
    while (n < -Math.pow(2, 8 * len - 1) || n >= Math.pow(2, 8 * len - 1)) len++;
    const out = new Uint8Array(len);
    let v = n < 0 ? n + Math.pow(2, 8 * len) : n;
    for (let i = len - 1; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
    return el(id, out);
  }
  const elStr = (id, s) => el(id, te.encode(s));
  function elFloat64(id, f) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, f); return el(id, b); }

  /**
   * frames: [{data: Uint8Array (rang VP9 kadri), key: bool, alpha: Uint8Array|null}]
   */
  function muxWebm({ width, height, fps, frames }) {
    const hasAlpha = frames.every((f) => f.alpha);
    const msPer = 1000 / fps;
    const ebml = el(0x1A45DFA3, concat([
      elUint(0x4286, 1), elUint(0x42F7, 1), elUint(0x42F2, 4), elUint(0x42F3, 8),
      elStr(0x4282, 'webm'), elUint(0x4287, 4), elUint(0x4285, 2),
    ]));
    const info = el(0x1549A966, concat([
      elUint(0x2AD7B1, 1000000), elFloat64(0x4489, frames.length * msPer),
      elStr(0x4D80, 'EmojiTitle'), elStr(0x5741, 'EmojiTitle'),
    ]));
    const video = el(0xE0, concat([elUint(0xB0, width), elUint(0xBA, height)].concat(hasAlpha ? [elUint(0x53C0, 1)] : [])));
    const tracks = el(0x1654AE6B, el(0xAE, concat([
      elUint(0xD7, 1), elUint(0x73C5, 1), elUint(0x83, 1), elUint(0x9C, 0),
      elStr(0x86, 'V_VP9'), elUint(0x23E383, Math.round(1e9 / fps)), video,
    ])));

    const cl = [elUint(0xE7, 0)];
    frames.forEach((f, i) => {
      const t = Math.round(i * msPer);
      const head = Uint8Array.from([0x81, (t >> 8) & 255, t & 255, 0x00]);
      const group = [el(0xA1, concat([head, f.data]))];
      if (hasAlpha) group.push(el(0x75A1, el(0xA6, concat([elUint(0xEE, 1), el(0xA5, f.alpha)]))));
      if (!f.key) group.push(elSint(0xFB, -Math.round(msPer)));
      cl.push(el(0xA0, concat(group)));
    });
    const cluster = el(0x1F43B675, concat(cl));
    const cues = el(0x1C53BB6B, el(0xBB, concat([
      elUint(0xB3, 0), el(0xB7, concat([elUint(0xF7, 1), elUint(0xF1, info.length + tracks.length)])),
    ])));
    return concat([ebml, el(0x18538067, concat([info, tracks, cluster, cues]))]);
  }

  // ------------------------------------------------------- rang konvertatsiyasi
  /** Shaffof piksellarga qo'shni rang "oqizib" qo'yiladi — chekkalarda qora hoshiya paydo bo'lmasligi uchun. */
  function bleed(src, w, h, passes) {
    const px = new Uint8ClampedArray(src);
    for (let k = 0; k < passes; k++) {
      const copy = new Uint8ClampedArray(px);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (copy[i + 3] !== 0) continue;
          let r = 0, g = 0, b = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
              const j = (yy * w + xx) * 4;
              if (copy[j + 3] > 0) { r += copy[j]; g += copy[j + 1]; b += copy[j + 2]; n++; }
            }
          }
          if (n) { px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n; px[i + 3] = 1; }   // 1 = "rangi bor, ammo ko'rinmas"
        }
      }
    }
    return px;
  }

  /** RGBA -> I420 (BT.601, limited range) — ffmpeg/Telegram konvertatsiyasi bilan bir xil. */
  function rgbaToI420(rgba, w, h) {
    const Y = new Uint8Array(w * h), U = new Uint8Array((w * h) / 4), V = new Uint8Array((w * h) / 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        Y[y * w + x] = ((66 * rgba[i] + 129 * rgba[i + 1] + 25 * rgba[i + 2] + 128) >> 8) + 16;
      }
    }
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const i = ((y + dy) * w + x + dx) * 4;
          r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2];
        }
        r /= 4; g /= 4; b /= 4;
        const o = (y / 2) * (w / 2) + x / 2;
        U[o] = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
        V[o] = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
      }
    }
    return concat([Y, U, V]);
  }

  function alphaToI420(rgba, w, h) {
    const buf = new Uint8Array(w * h * 3 / 2).fill(128);
    for (let i = 0; i < w * h; i++) buf[i] = rgba[i * 4 + 3];
    return buf;
  }

  // ---------------------------------------------------------------- kodlash
  async function isSupported() {
    try {
      if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return false;
      const r = await VideoEncoder.isConfigSupported({ codec: CODEC, width: SIZE, height: SIZE, framerate: 30, bitrate: 500000 });
      return !!(r && r.supported);
    } catch (e) { return false; }
  }

  /** Bitta VP9 oqimini kodlaydi. makeFrame(i) -> VideoFrame */
  async function encodeStream(count, makeFrame, quantizer, bitrate, fps) {
    const out = [];
    let failure = null;
    const enc = new VideoEncoder({
      output: (chunk) => { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); out.push({ data: d, key: chunk.type === 'key' }); },
      error: (e) => { failure = e; },
    });
    let useQ = true;
    const base = { codec: CODEC, width: SIZE, height: SIZE, framerate: fps, latencyMode: 'quality' };
    try {
      const s = await VideoEncoder.isConfigSupported(Object.assign({ bitrateMode: 'quantizer' }, base));
      useQ = !!(s && s.supported);
    } catch (e) { useQ = false; }
    enc.configure(useQ ? Object.assign({ bitrateMode: 'quantizer' }, base) : Object.assign({ bitrate, bitrateMode: 'variable' }, base));
    for (let i = 0; i < count; i++) {
      const f = makeFrame(i);
      const opts = { keyFrame: i === 0 };
      if (useQ) opts.vp9 = { quantizer };
      enc.encode(f, opts);
      f.close();
      if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    }
    await enc.flush();
    enc.close();
    if (failure) throw failure;
    if (out.length !== count) throw new Error(`Kodlagich ${count} o'rniga ${out.length} kadr qaytardi`);
    return out;
  }

  /**
   * frames: 100x100 RGBA kadrlar (Uint8ClampedArray) -> Telegram custom emoji WEBM (Uint8Array).
   * Hajm 256 KB dan oshsa, sifat avtomatik pasaytiriladi.
   */
  async function encodeEmojiWebm(frames, opts) {
    opts = opts || {};
    const fps = opts.fps || 30;
    const n = frames.length;
    if (n / fps > 3) throw new Error("Animatsiya 3 soniyadan uzun bo'lmasligi kerak");
    const colorPx = frames.map((f) => rgbaToI420(bleed(f, SIZE, SIZE, 2), SIZE, SIZE));
    const alphaPx = frames.map((f) => alphaToI420(f, SIZE, SIZE));
    const us = 1e6 / fps;
    const cs = { primaries: 'smpte170m', transfer: 'smpte170m', matrix: 'smpte170m', fullRange: false };
    const mkFrame = (buf, i, space) => new VideoFrame(buf, {
      format: 'I420', codedWidth: SIZE, codedHeight: SIZE, timestamp: Math.round(i * us), duration: Math.round(us), colorSpace: space,
    });

    let last = null;
    for (const [qc, qa, br] of [[22, 6, 900000], [30, 12, 600000], [38, 20, 400000], [46, 30, 250000]]) {
      const color = await encodeStream(n, (i) => mkFrame(colorPx[i], i, cs), qc, br, fps);
      const alpha = await encodeStream(n, (i) => mkFrame(alphaPx[i], i, { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: true }), qa, br, fps);
      const data = muxWebm({
        width: SIZE, height: SIZE, fps,
        frames: color.map((c, i) => ({ data: c.data, key: c.key, alpha: alpha[i].data })),
      });
      last = data;
      if (data.length <= (opts.maxBytes || MAX_BYTES)) return data;
    }
    throw new Error(`WEBM ${(last.length / 1024) | 0} KB — 256 KB limitidan katta`);
  }

  root.EmojiWebm = { isSupported, encodeEmojiWebm, muxWebm, rgbaToI420, SIZE };
})(typeof window !== 'undefined' ? window : globalThis);
