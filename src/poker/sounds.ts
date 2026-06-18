/* Pure Web Audio API synth — ポーカー用の効果音セット。アセット
 * (mp3 等) は持たない。低ファイルサイズ、低レイテンシで音色は素朴。
 *
 * デザイン:
 *  ・AudioContext は最初の play() でレイジに作る (Safari/Chrome の
 *    user-gesture 制約に対応)
 *  ・各 play 関数は独立 envelope を持ち、重ねがけ可能
 *  ・mute (= volume 0) は呼び出し側でガード
 */

let cachedContext: AudioContext | null = null;
let cachedMuted = false;

function getCtx(): AudioContext | null {
  if (cachedMuted) return null;
  if (typeof window === "undefined") return null;
  if (cachedContext && cachedContext.state !== "closed") return cachedContext;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedContext = new Ctor();
  } catch {
    return null;
  }
  return cachedContext;
}

export function setPokerSoundsMuted(muted: boolean) {
  cachedMuted = muted;
}

export function isPokerSoundsMuted(): boolean {
  return cachedMuted;
}

/** 軽い "コツッ" — 個別カードの deal / flip 用。 */
export function playFlip(pitch = 320, gain = 0.06) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, t0 + 0.06);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}

/** カードを切るホワイトノイズの一吹き。BiquadFilter で帯域を絞る。 */
export function playShuffle() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const duration = 0.42;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // 小さい trailing fade で「ザザ…」感
    const fade = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * 0.7 * fade * fade;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  noise.connect(bp).connect(g).connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + duration);
}

/** Hold 切替 — 短いシン C 風の click。 */
export function playHold() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(820, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.14);
}

/** 勝った時の三和音 (Maj 3 度 + 5 度 + オクターブ)。 */
export function playWin(magnitude: "small" | "big" = "small") {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const base = magnitude === "big" ? 523.25 : 392; // C5 vs G4
  const tones = [base, base * 1.25, base * 1.5, base * 2];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t0 + i * 0.07);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + i * 0.07 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.07 + 0.45);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0 + i * 0.07);
    osc.stop(t0 + i * 0.07 + 0.48);
  });
}

/** Royal Flush 級のジャックポット。長めのファンファーレ。 */
export function playJackpot() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  // ドソミドソ ファ-ソ
  const seq = [523.25, 783.99, 659.25, 523.25, 783.99, 698.46, 783.99];
  seq.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, t0 + i * 0.12);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.28);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0 + i * 0.12);
    osc.stop(t0 + i * 0.12 + 0.3);
  });
  // 終止音
  setTimeout(() => {
    const ctx2 = getCtx();
    if (!ctx2) return;
    const t2 = ctx2.currentTime;
    const osc = ctx2.createOscillator();
    const g = ctx2.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1046.5, t2); // C6
    g.gain.setValueAtTime(0.0001, t2);
    g.gain.exponentialRampToValueAtTime(0.08, t2 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.8);
    osc.connect(g).connect(ctx2.destination);
    osc.start(t2);
    osc.stop(t2 + 0.82);
  }, 900);
}

/** 負けた時の下降。 */
export function playLose() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.32);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.42);
}

/** チップ着金音 — bell-like ピン。 */
export function playChip() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1320, t0);
  osc.frequency.exponentialRampToValueAtTime(1760, t0 + 0.08);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.34);
}

/** スタッガで N 枚分の deal/flip を鳴らす ヘルパー。 */
export function playDealSequence(count: number, intervalMs = 80) {
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => playFlip(300 + (i % 3) * 25, 0.05), i * intervalMs);
  }
}
