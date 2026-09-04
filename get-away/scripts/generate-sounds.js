const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SAMPLE_RATE = 44100;
const BIT_RATE = 128;

function loadLame() {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "node_modules", "@breezystack", "lamejs", "dist", "lamejs.iife.js"),
    "utf8"
  );
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.lamejs;
}

function encodeMp3(lamejs, samples) {
  const mp3encoder = new lamejs.Mp3Encoder(1, SAMPLE_RATE, BIT_RATE);
  const blockSize = 1152;
  const mp3buf = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const md = mp3encoder.encodeBuffer(chunk);
    if (md.length > 0) mp3buf.push(Buffer.from(md));
  }
  const end = mp3encoder.flush();
  if (end.length > 0) mp3buf.push(Buffer.from(end));

  return Buffer.concat(mp3buf);
}

function writeMp3(fullPath, buffer) {
  fs.writeFileSync(fullPath, buffer);
  console.log(`wrote ${path.basename(fullPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

function envelope(n, attack, release) {
  const a = Math.max(1, Math.floor(attack * SAMPLE_RATE));
  const r = Math.max(1, Math.floor(release * SAMPLE_RATE));
  const total = n.length;
  for (let i = 0; i < total; i++) {
    let g = 1;
    if (i < a) g = i / a;
    const relStart = total - r;
    if (i > relStart) g = Math.min(g, (total - i) / r);
    n[i] *= g;
  }
  return n;
}

function tone(freq, dur, opts = {}) {
  const { attack = 0.005, release = 0.05, amp = 0.5, wave = "sine" } = opts;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const p = 2 * Math.PI * freq * t;
    switch (wave) {
      case "square":
        out[i] = Math.sin(p) >= 0 ? 1 : -1;
        break;
      case "triangle":
        out[i] = (2 / Math.PI) * Math.asin(Math.sin(p));
        break;
      case "saw":
        out[i] = (2 / Math.PI) * Math.atan(Math.tan(p / 2)) * 2;
        break;
      default:
        out[i] = Math.sin(p);
    }
  }
  envelope(out, attack, release);
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const scale = (amp || 0.5) / peak;
  for (let i = 0; i < out.length; i++) out[i] *= scale;
  return out;
}

function mix(...channels) {
  const len = Math.max(...channels.map((c) => c.length));
  const out = new Float32Array(len);
  channels.forEach((c) => {
    for (let i = 0; i < c.length; i++) out[i] += c[i];
  });
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  if (peak > 0.99) {
    const s = 0.99 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= s;
  }
  return out;
}

function concat(...channels) {
  let len = 0;
  channels.forEach((c) => (len += c.length));
  const out = new Float32Array(len);
  let off = 0;
  channels.forEach((c) => {
    out.set(c, off);
    off += c.length;
  });
  return out;
}

function silence(dur) {
  return new Float32Array(Math.floor(dur * SAMPLE_RATE));
}

function noise(dur, amp = 0.4) {
  const n = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  for (let i = 0; i < n.length; i++) n[i] = (Math.random() * 2 - 1) * amp;
  return n;
}

/* ---- Sound recipes ---- */

// buttonPress: crisp UI click (two short ticks, woody feel)
function buttonPress() {
  const body = tone(1800, 0.05, { wave: "square", amp: 0.25, attack: 0.001, release: 0.04 });
  const tick = tone(900, 0.03, { wave: "square", amp: 0.3, attack: 0.001, release: 0.025 });
  const click = mixedNoise(0.035, 0.18);
  return mix(body, click, concat(silence(0.09), tick, silence(0.05)));
}

function mixedNoise(dur, amp) {
  const n = noise(dur, amp);
  const lp = n.slice();
  let prev = 0;
  for (let i = 0; i < lp.length; i++) {
    prev += 0.25 * (lp[i] - prev);
    lp[i] = prev;
  }
  envelope(lp, 0.002, dur * 0.8);
  return lp;
}

// cardPlay: single sharp "slap" — short noise burst w/ low thump
function cardPlay() {
  const thump = tone(220, 0.09, { wave: "sine", amp: 0.5, attack: 0.002, release: 0.07 });
  const slap = mixedNoise(0.06, 0.5);
  return mix(thump, slap, tone(1600, 0.03, { wave: "triangle", amp: 0.15, attack: 0.001, release: 0.025 }));
}

// trickWon: ascending two-note confirm
function trickWon() {
  const a = tone(660, 0.12, { amp: 0.35, release: 0.1 });
  const b = tone(990, 0.18, { amp: 0.35, release: 0.15 });
  return concat(a, b);
}

// safe: soft pleasant ding
function safe() {
  const d1 = tone(880, 0.22, { amp: 0.35, release: 0.18 });
  const d2 = tone(1320, 0.25, { amp: 0.25, release: 0.2 });
  return mix(d1, d2);
}

// loser: low descending wobble
function loser() {
  const n = Math.floor(0.55 * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 220 - 120 * Math.min(1, t / 0.4);
    out[i] = Math.sin(2 * Math.PI * f * t) * 0.4 + 0.5 * Math.sin(2 * Math.PI * f * 1.5 * t) * Math.sin(Math.PI * t * 2);
  }
  envelope(out, 0.01, 0.15);
  return out;
}

// turnChange: subtle tick
function turnChange() {
  const t = tone(1400, 0.04, { wave: "triangle", amp: 0.22, attack: 0.001, release: 0.035 });
  const t2 = tone(1100, 0.03, { wave: "triangle", amp: 0.18, attack: 0.001, release: 0.025 });
  return mix(t, concat(silence(0.07), t2, silence(0.05)));
}

// gameOver: 3-note arpeggio (c major-ish)
function gameOver() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const parts = [];
  notes.forEach((f, i) => {
    const t = tone(f, i === notes.length - 1 ? 0.4 : 0.16, { amp: 0.32, release: i === notes.length - 1 ? 0.35 : 0.12 });
    parts.push(t);
  });
  return concat(...parts);
}

function main() {
  const lamejs = loadLame();
  const outDir = path.join(__dirname, "..", "assets", "sounds");

  const recipes = {
    "button-press.mp3": buttonPress,
    "card-play.mp3": cardPlay,
    "trick-won.mp3": trickWon,
    "safe.mp3": safe,
    "loser.mp3": loser,
    "turn-change.mp3": turnChange,
    "game-over.mp3": gameOver,
  };

  Object.entries(recipes).forEach(([name, recipe]) => {
    const samples = recipe();
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      int16[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
    }
    const mp3 = encodeMp3(lamejs, int16);
    writeMp3(path.join(outDir, name), mp3);
  });

  console.log("Done. Generated all sound files in assets/sounds/");
}

main();