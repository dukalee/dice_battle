// Renders the background-music draft loops to assets/audio/bgm-drafts/*.wav.
// Pure Node, no dependencies: small additive synth + drums + a looping reverb.
// Usage: node scripts/bgm-drafts.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 44100
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio', 'bgm-drafts')
const TAU = Math.PI * 2
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)

// ---- deterministic noise
let seed = 12345
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2147483648 - 1
}

// ---- envelopes: (t, gateSeconds) => 0..1
const adsr = (a, d, s, r) => (t, g) => {
  const base = (x) => (x < a ? x / a : x < a + d ? 1 - ((1 - s) * (x - a)) / d : s)
  return t <= g ? base(t) : base(g) * Math.max(0, 1 - (t - g) / r)
}
const expEnv = (tau) => (t, g) => Math.min(1, t / 0.003) * Math.exp(-t / tau) * (t > g ? Math.max(0, 1 - (t - g) / 0.06) : 1)

// ---- oscillators: (freq, t) => -1..1
const harm = (amps, det = 0) => (f, t) => {
  let v = 0
  for (let k = 0; k < amps.length; k++) {
    const fk = f * (k + 1)
    if (fk > SR * 0.45) break
    v += amps[k] * Math.sin(TAU * fk * t)
    if (det) v += amps[k] * Math.sin(TAU * fk * (1 + det) * t) + amps[k] * Math.sin(TAU * fk * (1 - det) * t)
  }
  return det ? v / 3 : v
}
const partials = (list) => (f, t) => list.reduce((v, [r, a]) => v + a * Math.sin(TAU * f * r * t), 0)
const square = (duty) => (f, t) => ((f * t) % 1 < duty ? 1 : -1)
const tri = (f, t) => (2 / Math.PI) * Math.asin(Math.sin(TAU * f * t))

const I = {
  pluckBright: { osc: harm([1, 0.6, 0.4, 0.3, 0.2, 0.12]), env: expEnv(0.22) },
  pluckSoft: { osc: harm([1, 0.35, 0.15]), env: expEnv(0.3) },
  bassPluck: { osc: harm([1, 0.5, 0.2]), env: expEnv(0.35) },
  bassSine: { osc: harm([1, 0.25]), env: adsr(0.02, 0.1, 0.8, 0.2) },
  pad: { osc: harm([1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.12, 0.1], 0.004), env: adsr(0.5, 0.3, 0.7, 0.7) },
  brass: { osc: harm([1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15], 0.003), env: adsr(0.05, 0.1, 0.8, 0.12) },
  bell: { osc: partials([[1, 1], [2.76, 0.35], [5.4, 0.18], [8.93, 0.08]]), env: expEnv(0.9) },
  chipLead: { osc: square(0.5), env: adsr(0.002, 0.05, 0.6, 0.03) },
  chipArp: { osc: square(0.25), env: adsr(0.002, 0.04, 0.5, 0.02) },
  chipBass: { osc: tri, env: adsr(0.002, 0.05, 0.85, 0.03) },
}

function track(bpm, bars) {
  const spb = 60 / bpm
  return { spb, len: Math.round(bars * 4 * spb * SR), buf: null, bars }
}
const newTrack = (bpm, bars) => {
  const t = track(bpm, bars)
  t.buf = new Float32Array(t.len)
  return t
}

// Notes wrap around the loop end so tails flow back into the start.
function note(trk, beat, dur, midi, vel, inst) {
  const f = mtof(midi)
  const gate = dur * trk.spb
  const total = gate + 0.7
  const s0 = Math.floor(beat * trk.spb * SR)
  const n = Math.floor(total * SR)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const a = inst.env(t, gate)
    if (t > gate && a < 1e-4) break
    trk.buf[(s0 + i) % trk.len] += inst.osc(f, t) * a * vel
  }
}

function drum(trk, beat, kind, vel) {
  const s0 = Math.floor(beat * trk.spb * SR)
  const dur = { kick: 0.3, snare: 0.25, hat: 0.07, rim: 0.05, taiko: 0.5 }[kind]
  const n = Math.floor(dur * SR)
  let prev = 0
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let v = 0
    if (kind === 'kick') {
      ph += (TAU * (45 + 85 * Math.exp(-t / 0.03))) / SR
      v = Math.sin(ph) * Math.exp(-t / 0.11)
    } else if (kind === 'taiko') {
      ph += (TAU * (55 + 50 * Math.exp(-t / 0.05))) / SR
      v = Math.sin(ph) * Math.exp(-t / 0.25) * 1.2
    } else if (kind === 'snare') {
      v = noise() * Math.exp(-t / 0.07) * 0.8 + Math.sin(TAU * 190 * t) * Math.exp(-t / 0.05) * 0.5
    } else if (kind === 'rim') {
      v = Math.sin(TAU * 800 * t) * Math.exp(-t / 0.01) * 0.6 + noise() * Math.exp(-t / 0.008) * 0.3
    } else {
      const x = noise()
      v = (x - prev) * Math.exp(-t / 0.025) * 0.6
      prev = x
    }
    trk.buf[(s0 + i) % trk.len] += v * vel
  }
}

function reverb(trk, wet) {
  const { buf, len } = trk
  const delays = [3011, 3517, 4093, 4663, 5393]
  const out = new Float32Array(len)
  for (const d of delays) {
    const line = new Float32Array(d)
    let lp = 0
    let idx = 0
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < len; i++) {
        lp += 0.35 * (line[idx] - lp)
        line[idx] = buf[i] + lp * 0.8
        if (pass === 2) out[i] += line[idx]
        idx = (idx + 1) % d
      }
    }
  }
  for (let i = 0; i < len; i++) buf[i] += (wet * out[i]) / delays.length
}

function writeWav(name, trk) {
  const { buf, len } = trk
  let peak = 0
  for (let i = 0; i < len; i++) {
    buf[i] = Math.tanh(buf[i] * 1.1)
    peak = Math.max(peak, Math.abs(buf[i]))
  }
  const gain = 0.85 / peak
  const data = Buffer.alloc(44 + len * 2)
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + len * 2, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(1, 22)
  data.writeUInt32LE(SR, 24)
  data.writeUInt32LE(SR * 2, 28)
  data.writeUInt16LE(2, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(len * 2, 40)
  for (let i = 0; i < len; i++) data.writeInt16LE(Math.round(buf[i] * gain * 32767), 44 + i * 2)
  writeFileSync(join(OUT, name), data)
  console.log(`${name}  ${(len / SR).toFixed(1)}s`)
}

// 8th-note pattern: 0 = rest
const eighths = (trk, bar, arr, inst, vel, len = 0.45) =>
  arr.forEach((m, i) => m && note(trk, bar * 4 + i * 0.5, len, m, vel, inst))
// [beat, dur, midi] list inside one bar
const phrase = (trk, bar, list, inst, vel) => list.forEach(([b, d, m]) => note(trk, bar * 4 + b, d, m, vel, inst))

// Chord = { root: bass midi, notes: triad/7th midi }
const C = { root: 36, notes: [60, 64, 67] }
const Am = { root: 45, notes: [57, 60, 64] }
const F = { root: 41, notes: [53, 57, 60] }
const G = { root: 43, notes: [55, 59, 62] }
const Amc = { root: 45, notes: [57, 60, 64] }
const Cc = { root: 48, notes: [55, 60, 64] }
const Dm = { root: 38, notes: [62, 65, 69, 74] }
const Bb = { root: 46, notes: [58, 62, 65, 70] }
const Fd = { root: 41, notes: [60, 65, 69, 72] }
const Cd = { root: 36, notes: [60, 64, 67, 72] }

mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------- 1. Tavern
{
  const T = newTrack(124, 16)
  const prog = [C, Am, F, G]
  const A = [
    [76, 0, 79, 76, 72, 0, 76, 79],
    [81, 0, 76, 72, 69, 0, 72, 76],
    [77, 0, 81, 77, 72, 0, 77, 81],
    [79, 77, 74, 0, 71, 74, 77, 74],
  ]
  const B = [
    [84, 0, 81, 79, 76, 0, 79, 81],
    [79, 0, 76, 72, 76, 0, 81, 0],
    [77, 81, 84, 81, 77, 72, 74, 77],
    [79, 0, 74, 71, 74, 0, 67, 0],
  ]
  for (let bar = 0; bar < 16; bar++) {
    const c = prog[bar % 4]
    note(T, bar * 4, 0.9, c.root, 0.5, I.bassPluck)
    note(T, bar * 4 + 2, 0.9, c.root + 7, 0.4, I.bassPluck)
    for (const b of [1, 3]) c.notes.forEach((m) => note(T, bar * 4 + b, 0.4, m, 0.1, I.pluckSoft))
    drum(T, bar * 4, 'kick', 0.7)
    drum(T, bar * 4 + 2, 'kick', 0.6)
    drum(T, bar * 4 + 1, 'rim', 0.4)
    drum(T, bar * 4 + 3, 'rim', 0.4)
    for (let i = 0; i < 4; i++) drum(T, bar * 4 + i + 0.5, 'hat', 0.28)
    eighths(T, bar, (bar >> 2) % 2 === 0 ? A[bar % 4] : B[bar % 4], I.pluckBright, 0.22)
  }
  reverb(T, 0.35)
  writeWav('1_tavern_gamble.wav', T)
}

// ------------------------------------------------------------- 2. Epic battle
{
  const T = newTrack(140, 16)
  const prog = [Amc, F, Cc, G]
  const A = [
    [81, 0, 81, 79, 76, 0, 72, 76],
    [77, 0, 77, 76, 72, 0, 69, 72],
    [76, 0, 79, 84, 0, 79, 76, 79],
    [74, 0, 79, 83, 0, 79, 74, 0],
  ]
  const B = [
    [84, 0, 0, 81, 0, 0, 76, 0],
    [81, 0, 0, 77, 0, 0, 72, 0],
    [79, 0, 0, 84, 0, 0, 79, 0],
    [83, 0, 81, 0, 79, 0, 74, 0],
  ]
  for (let bar = 0; bar < 16; bar++) {
    const c = prog[bar % 4]
    c.notes.forEach((m) => note(T, bar * 4, 3.9, m, 0.11, I.pad))
    for (let i = 0; i < 8; i++) note(T, bar * 4 + i * 0.5, 0.4, c.root + (i % 4 === 3 ? 12 : 0), 0.36, I.bassPluck)
    drum(T, bar * 4, 'kick', 0.8)
    drum(T, bar * 4 + 2, 'kick', 0.7)
    drum(T, bar * 4 + 2.5, 'kick', 0.5)
    drum(T, bar * 4 + 1, 'snare', 0.55)
    drum(T, bar * 4 + 3, 'snare', 0.55)
    drum(T, bar * 4, 'taiko', 0.6)
    drum(T, bar * 4 + 3.5, 'taiko', 0.45)
    for (let i = 0; i < 8; i++) drum(T, bar * 4 + i * 0.5, 'hat', 0.22)
    if (bar >= 4) eighths(T, bar, (bar >> 2) % 2 === 0 ? A[bar % 4] : B[bar % 4], I.brass, 0.2, 0.42)
    else eighths(T, bar, A[bar % 4], I.pluckBright, 0.13, 0.4)
  }
  reverb(T, 0.28)
  writeWav('2_epic_battle.wav', T)
}

// -------------------------------------------------------- 3. Dusk music box
{
  const T = newTrack(84, 16)
  const prog = [Dm, Bb, Fd, Cd]
  const idx = [0, 1, 2, 3, 2, 1, 2, 1]
  const A = [
    [[0, 2, 81], [2, 2, 77]],
    [[0, 3, 74], [3, 1, 77]],
    [[0, 2, 81], [2, 1, 84], [3, 1, 81]],
    [[0, 4, 79]],
  ]
  const B = [
    [[0, 1, 86], [1, 1, 84], [2, 2, 81]],
    [[0, 2, 82], [2, 2, 77]],
    [[0, 1.5, 84], [1.5, 0.5, 81], [2, 2, 77]],
    [[0, 2, 79], [2, 2, 76]],
  ]
  for (let bar = 0; bar < 16; bar++) {
    const c = prog[bar % 4]
    c.notes.forEach((m) => note(T, bar * 4, 3.95, m, 0.09, I.pad))
    note(T, bar * 4, 3.9, c.root, 0.4, I.bassSine)
    idx.forEach((k, i) => note(T, bar * 4 + i * 0.5, 0.5, c.notes[k] + 12, 0.1, I.bell))
    phrase(T, bar, (bar >> 2) % 2 === 0 ? A[bar % 4] : B[bar % 4], I.bell, 0.22)
  }
  reverb(T, 0.55)
  writeWav('3_dusk_musicbox.wav', T)
}

// ------------------------------------------------------------- 4. Chiptune
{
  const T = newTrack(150, 16)
  const prog = [C, G, Am, F]
  const arp = [
    (r) => [r, r + 4, r + 7, r + 4, r, r + 4, r + 7, r + 12],
    (r) => [r, r + 3, r + 7, r + 3, r, r + 3, r + 7, r + 12],
  ]
  const A = [
    [72, 76, 79, 76, 72, 76, 79, 84],
    [71, 74, 79, 74, 71, 74, 79, 83],
    [69, 72, 76, 72, 69, 72, 76, 81],
    [65, 69, 72, 69, 72, 77, 72, 69],
  ]
  const B = [
    [84, 0, 83, 84, 79, 0, 76, 79],
    [83, 0, 79, 83, 86, 0, 83, 79],
    [81, 0, 84, 81, 76, 0, 72, 76],
    [77, 0, 81, 84, 81, 0, 77, 72],
  ]
  for (let bar = 0; bar < 16; bar++) {
    const c = prog[bar % 4]
    const second = (bar >> 2) % 2 === 1
    for (let i = 0; i < 8; i++) note(T, bar * 4 + i * 0.5, 0.45, c.root + 12 + (i % 2 ? 12 : 0), 0.4, I.chipBass)
    drum(T, bar * 4, 'kick', 0.7)
    drum(T, bar * 4 + 2, 'kick', 0.7)
    drum(T, bar * 4 + 1, 'snare', 0.4)
    drum(T, bar * 4 + 3, 'snare', 0.4)
    for (let i = 0; i < 8; i++) drum(T, bar * 4 + i * 0.5, 'hat', i % 2 ? 0.25 : 0.15)
    if (second) {
      eighths(T, bar, B[bar % 4], I.chipLead, 0.17, 0.5)
      eighths(T, bar, arp[0](c.notes[0] + 12).map((m) => m), I.chipArp, 0.05, 0.3)
    } else {
      eighths(T, bar, A[bar % 4], I.chipLead, 0.15, 0.4)
    }
  }
  reverb(T, 0.08)
  writeWav('4_chiptune.wav', T)
}

// ------------------------------------------------ 5-7. Handheld-RPG style
// Original tunes written in the classic handheld-RPG idiom (pulse lead, triangle
// gallop bass, noise drums); no melody is taken from any existing game.
I.pulseEdge = { osc: square(0.125), env: adsr(0.002, 0.04, 0.65, 0.03) }

function rpgSong({ file, bpm, prog, A, B, bass, drums, lead, leadVel = 0.16, arpVel = 0.04, rev = 0.06 }) {
  const T = newTrack(bpm, 16)
  for (let bar = 0; bar < 16; bar++) {
    const c = prog[bar % 4]
    bass.forEach((off, s) => off !== null && note(T, bar * 4 + s * 0.25, 0.22, c.root + off, 0.4, I.chipBass))
    drums(T, bar)
    const melody = (bar >> 2) % 2 === 0 ? A[bar % 4] : B[bar % 4]
    eighths(T, bar, melody, lead, leadVel, 0.45)
    for (let s = 0; s < 16; s++) note(T, bar * 4 + s * 0.25, 0.2, c.notes[s % c.notes.length] + 12, arpVel, I.chipArp)
  }
  reverb(T, rev)
  writeWav(file, T)
}

const gallop = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0]
const bounce = [0, null, 12, null, 0, null, 12, 7, 0, null, 12, null, 0, null, 12, 7]

// 5. Wild-encounter battle: minor key, galloping bass, fast
{
  const Em = { root: 40, notes: [64, 67, 71] }
  const Cm = { root: 36, notes: [60, 64, 67] }
  const D = { root: 38, notes: [62, 66, 69] }
  const B7 = { root: 35, notes: [59, 63, 66] }
  rpgSong({
    file: '5_wild_battle.wav',
    bpm: 168,
    prog: [Em, Cm, D, B7],
    A: [
      [76, 0, 79, 76, 83, 0, 79, 76],
      [72, 0, 76, 72, 79, 0, 76, 72],
      [74, 0, 78, 74, 81, 0, 78, 74],
      [71, 75, 78, 0, 83, 0, 78, 75],
    ],
    B: [
      [83, 0, 83, 81, 79, 0, 76, 79],
      [84, 0, 84, 83, 79, 0, 76, 72],
      [81, 0, 81, 78, 74, 0, 78, 81],
      [83, 0, 78, 75, 71, 75, 78, 0],
    ],
    bass: gallop,
    lead: I.pulseEdge,
    drums: (T, bar) => {
      for (const b of [0, 1.5, 2]) drum(T, bar * 4 + b, 'kick', 0.7)
      for (const b of [1, 3]) drum(T, bar * 4 + b, 'snare', 0.45)
      for (let i = 0; i < 16; i++) drum(T, bar * 4 + i * 0.25, 'hat', i % 2 ? 0.14 : 0.22)
    },
  })
}

// 6. Route / adventure: bright major key, bouncy bass
{
  const G6 = { root: 43, notes: [67, 71, 74] }
  const Em = { root: 40, notes: [64, 67, 71] }
  const C6 = { root: 36, notes: [60, 64, 67] }
  const D6 = { root: 38, notes: [62, 66, 69] }
  rpgSong({
    file: '6_route_adventure.wav',
    bpm: 128,
    prog: [G6, Em, C6, D6],
    A: [
      [79, 0, 83, 79, 86, 0, 83, 79],
      [83, 0, 79, 83, 76, 0, 79, 83],
      [84, 0, 79, 76, 79, 0, 84, 0],
      [81, 0, 78, 74, 78, 0, 81, 0],
    ],
    B: [
      [83, 0, 81, 79, 81, 0, 83, 0],
      [79, 0, 76, 79, 83, 0, 79, 0],
      [84, 0, 83, 81, 79, 0, 76, 79],
      [78, 0, 81, 86, 85, 0, 81, 78],
    ],
    bass: bounce,
    lead: I.chipLead,
    leadVel: 0.17,
    arpVel: 0.025,
    drums: (T, bar) => {
      for (const b of [0, 2]) drum(T, bar * 4 + b, 'kick', 0.55)
      for (const b of [1, 3]) drum(T, bar * 4 + b, 'snare', 0.3)
      for (let i = 0; i < 8; i++) drum(T, bar * 4 + i * 0.5, 'hat', 0.18)
    },
  })
}

// 7. Rival / gym-leader showdown: tense, fastest, edgy lead
{
  const Am7 = { root: 45, notes: [69, 72, 76] }
  const F7 = { root: 41, notes: [65, 69, 72] }
  const E7 = { root: 40, notes: [64, 68, 71] }
  rpgSong({
    file: '7_rival_showdown.wav',
    bpm: 176,
    prog: [Am7, Am7, F7, E7],
    A: [
      [81, 0, 81, 84, 0, 81, 76, 0],
      [81, 0, 81, 84, 0, 83, 81, 0],
      [77, 0, 77, 81, 0, 77, 72, 0],
      [76, 0, 80, 83, 0, 80, 76, 0],
    ],
    B: [
      [84, 0, 83, 84, 0, 76, 81, 0],
      [84, 0, 83, 81, 0, 76, 72, 0],
      [81, 0, 77, 81, 84, 0, 81, 77],
      [83, 0, 80, 76, 80, 0, 83, 0],
    ],
    bass: gallop,
    lead: I.pulseEdge,
    leadVel: 0.18,
    arpVel: 0.05,
    drums: (T, bar) => {
      for (const b of [0, 0.5, 2, 2.5]) drum(T, bar * 4 + b, 'kick', 0.7)
      for (const b of [1, 3]) drum(T, bar * 4 + b, 'snare', 0.5)
      drum(T, bar * 4 + 3.5, 'snare', 0.35)
      for (let i = 0; i < 16; i++) drum(T, bar * 4 + i * 0.25, 'hat', i % 4 === 0 ? 0.25 : 0.12)
    },
  })
}
