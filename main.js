import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { LINES, CAFE, ASSESS } from './dialogue.js';
import { buildCafe } from './cafe3d.js';

/* ---------- design tokens (from the Figma mid-fidelity file) ---------- */
const COL = { teal: '#1F9AA0', ink: '#2C4A52', mint: '#EAFBFC', line: '#BFEDEF', grey: '#6B7C82', ok: '#0B9A6D', bad: '#C0483B' };
const FONT = "'Source Sans 3','Segoe UI',Arial,sans-serif";

/* ---------- renderer / camera ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // refreshed every few frames in the main loop (saves a lot of GPU time)
renderer.shadowMap.needsUpdate = true;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.6, 0);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.2));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.1);
sun.position.set(3, 6, 2);
scene.add(sun);

/* ---------- small helpers ---------- */
const M = (c) => new THREE.MeshLambertMaterial({ color: c });
function box(parent, w, h, d, col, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(col));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function canvasPlane(w, h, px, draw, parent, x, y, z, ry = 0) {
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = Math.round(px * h / w);
  draw(cv.getContext('2d'), cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}
function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  out.push(line);
  return out;
}
function speakerIcon(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 0.07; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, .35); c.lineTo(.25, .35); c.lineTo(.55, .1); c.lineTo(.55, .9); c.lineTo(.25, .65); c.lineTo(0, .65); c.closePath(); c.fill();
  [.3, .5].forEach((r) => { c.beginPath(); c.arc(.55, .5, r, -0.9, 0.9); c.stroke(); });
  c.restore();
}
function micIcon(c, cx, cy, s, col) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * .08; c.lineCap = 'round';
  c.beginPath(); c.roundRect(cx - s * .13, cy - s * .36, s * .26, s * .5, s * .13); c.fill();
  c.beginPath(); c.arc(cx, cy - s * .05, s * .25, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.beginPath(); c.moveTo(cx, cy + s * .2); c.lineTo(cx, cy + s * .34); c.stroke();
}

/* ---------- UI panels (canvas textures, pointer-clickable) ---------- */
const panels = [];
class Panel {
  constructor(w, h, drawFn, px = 1024) {
    this.w = w; this.h = h; this.fn = drawFn; this.hits = []; this.hover = null;
    this.cv = document.createElement('canvas');
    this.cv.width = px; this.cv.height = Math.round(px * h / w);
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false }));
    this.mesh.userData.panel = this;
    this.mesh.visible = false;
    scene.add(this.mesh);
    panels.push(this);
  }
  place(x, y, z, faceUser = true) {
    this.mesh.position.set(x, y, z);
    if (faceUser) this.mesh.lookAt(0, y, 0);
    return this;
  }
  render() { this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); this.hits = []; this.fn(this); this.tex.needsUpdate = true; }
  setHover(id) { if (id !== this.hover) { this.hover = id; this.render(); } }
  at(uv) {
    const x = uv.x * this.cv.width, y = (1 - uv.y) * this.cv.height;
    return this.hits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }
  rr(x, y, w, h, r, fill, stroke, lw = 3) {
    const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  text(t, x, y, size, color, weight = 400, maxW = 1e4, align = 'left') {
    const c = this.ctx; c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'top';
    const ls = wrap(c, t, maxW);
    ls.forEach((l, i) => c.fillText(l, x, y + i * size * 1.25));
    return y + ls.length * size * 1.25;
  }
  // text whose capital-letter height is centred on cy (even space above and below)
  vtext(t, x, cy, size, color, weight = 400, maxW = 1e4, align = 'left') {
    const c = this.ctx; c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
    const capH = c.measureText('H').actualBoundingBoxAscent || size * .7, lh = size * 1.25, ls = wrap(c, t, maxW);
    const top = cy - ((ls.length - 1) * lh + capH) / 2 + capH;
    ls.forEach((l, i) => c.fillText(l, x, top + i * lh));
  }
  btn(x, y, w, h, label, id, fn, o = {}) {
    const hv = this.hover === id;
    this.rr(x, y, w, h, 18, hv ? '#D4F5F7' : COL.mint, hv ? COL.teal : COL.line);
    this.vtext(label, x + w / 2, y + h / 2, 34, o.color || COL.ink, o.weight || 600, w - 20, 'center');
    this.hits.push({ x, y, w, h, id, fn });
  }
  ghost(x, y, w, h, label, id, fn) { // text-only button: no fill, no stroke
    this.vtext(label, x + w / 2, y + h / 2, 34, this.hover === id ? COL.teal : COL.ink, 600, w - 20, 'center');
    this.hits.push({ x, y, w, h, id, fn });
  }
}

/* ---------- game state ---------- */
let turn = 0, first = 0, tries = 0, order = [], reveal = false, showEn = false, busy = false, talking = false, score = 0;
let bubbleFr = '', bubbleEn = '', msg = { t: '', c: COL.grey };

/* street card (Figma: "You are located in the Rosemont neighbourhood…") */
const streetCard = new Panel(1.25, 0.62, (p) => {
  const W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 36, 'rgba(244,251,252,.94)', COL.line);
  p.text(card.t, 50, 44, 42, COL.teal, 700, W - 100);
  p.btn(50, H - 150, 480, 100, card.b, 'enter', card.fn);
}).place(-0.55, 1.25, -1.5);

/* barista speech bubble */
const bubble = new Panel(1.3, 0.62, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  c.fillStyle = 'rgba(255,255,255,.96)'; c.strokeStyle = COL.line; c.lineWidth = 4;
  c.beginPath(); c.roundRect(10, 10, W - 20, H - 80, 34); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(80, H - 72); c.lineTo(46, H - 6); c.lineTo(170, H - 72); c.fill();
  const y = p.text(bubbleFr, 50, 44, 50, COL.ink, 700, W - 100);
  if (showEn || A.en) p.text(bubbleEn, 50, y + 8, 36, COL.grey, 400, W - 100);
}).place(0.25, 2.1, -2.6);

/* reply choices (Figma: "Use the microphone to reply…", speaker icons, mic, "Skip. Not sure.") */
let order_ = [];
let listening = false, sel = -1, voiceOff = false;
const voiceOK = () => !!SR && !voiceOff;
const choices = new Panel(1.5, 1.3, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 40, 'rgba(244,251,252,.95)', COL.line);
  p.text(voiceOK() ? 'Use the microphone to reply with the answer you believe best fits.' : 'Choose the reply you believe best fits. Point at it and pull the trigger.', 48, 34, 38, COL.teal, 700, W - 96);
  order_ = order;
  order.forEach((o, i) => {
    const y = 150 + i * 148, hv = p.hover === 'o' + i, hl = reveal && o.ok, on = sel === i;
    p.rr(40, y, W - 80, 130, 22, on || hv ? COL.mint : '#fff', hl ? COL.ok : on || hv ? COL.teal : COL.line, hl || on ? 6 : 3);
    speakerIcon(c, 70, y + 35, 60, p.hover === 's' + i ? COL.ok : COL.teal);
    if (A.en) { const e = p.text(o.fr, 160, y + 12, 30, COL.ink, 500, W - 240); p.text(o.en, 160, e + 2, 24, COL.grey, 400, W - 240); }
    else p.text(o.fr, 160, y + 20, 36, COL.ink, 500, W - 240);
    p.hits.push({ x: 56, y: y + 10, w: 96, h: 110, id: 's' + i, fn: () => speak(o.fr, o.audio) });
    p.hits.push({ x: 40, y, w: W - 80, h: 130, id: 'o' + i, fn: () => selectRow(i) });
  });
  p.text(msg.t, 48, 600, 30, msg.c, 600, W - 96);
  // microphone: grey and disabled until a reply is selected (Figma frame 17), teal when ready (frame 59)
  const MR = 60, MY = H - 90, micOn = voiceOK() && sel >= 0 && !busy, mh = p.hover === 'mic' && micOn, mc = listening ? COL.bad : micOn ? '#4A9798' : '#A5A5A5';
  if (listening) { c.beginPath(); c.arc(106, MY, MR + 14, 0, Math.PI * 2); c.strokeStyle = 'rgba(192,72,59,.3)'; c.lineWidth = 8; c.stroke(); }
  c.save(); c.shadowColor = 'rgba(0,0,0,.22)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
  c.beginPath(); c.arc(106, MY, MR, 0, Math.PI * 2);
  const mg = c.createLinearGradient(106, MY - MR, 106, MY + MR); mg.addColorStop(0, '#F8FAFB'); mg.addColorStop(1, '#EEF1F4');
  c.fillStyle = listening ? '#FBE3E0' : mh ? '#E6F8F8' : mg; c.fill(); c.restore();
  c.beginPath(); c.arc(106, MY, MR, 0, Math.PI * 2); c.strokeStyle = listening ? COL.bad : micOn ? '#B9DADA' : '#A5A5A5'; c.lineWidth = 5; c.stroke();
  micIcon(c, 106, MY, 100, mc);
  const lab = !voiceOK() ? '' : listening ? 'Listening… tap to stop' : micOn ? 'Tap to speak' : 'Select a reply first';
  p.text(lab, 190, MY - 18, 30, listening ? COL.bad : micOn ? COL.teal : COL.grey, 600, W - 640);
  p.hits.push({ x: 46, y: MY - MR, w: MR * 2, h: MR * 2, id: 'mic', fn: toggleMic });
  // skip: plain grey text, no fill or stroke
  const sx = W - 400, sy = H - 130, sw = 360, sh = 90, sk = p.hover === 'skip';
  p.vtext('Skip. Not Sure.', sx + sw / 2, sy + sh / 2, 34, sk ? '#4f5f65' : COL.grey, 600, sw - 20, 'center');
  p.hits.push({ x: sx, y: sy, w: sw, h: sh, id: 'skip', fn: skip });
}).place(1.0, 1.3, -1.05);

/* results (Figma: score gauge, "Excellent job!") */
const result = new Panel(1.1, 1.1, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height, cx = W / 2, cy = 330;
  p.rr(4, 4, W - 8, H - 8, 44, 'rgba(255,255,255,.97)', COL.line);
  c.lineWidth = 40; c.lineCap = 'round';
  c.strokeStyle = '#DDF2F3'; c.beginPath(); c.arc(cx, cy, 200, Math.PI, 2 * Math.PI); c.stroke();
  c.strokeStyle = COL.teal; c.beginPath(); c.arc(cx, cy, 200, Math.PI, Math.PI + Math.PI * score / 10); c.stroke();
  p.text(score.toFixed(1), cx, cy - 70, 90, COL.grey, 600, 400, 'center');
  p.text(res.head, cx, 430, 70, COL.teal, 700, W - 100, 'center');
  p.text(res.body, cx, 530, 36, COL.ink, 400, W - 140, 'center');
  p.btn(cx - 200, H - 190, 400, 100, res.btn, 'again', res.fn);
}).place(0, 1.5, -1.4);

/* ---------- speech: recorded audio first, browser voice as placeholder ---------- */
const synth = window.speechSynthesis;
let curAudio = null, epoch = 0;
const pend = [];
const gate = (f) => (paused ? pend.push(f) : f());
function speak(fr, audio, done) {
  const ep = epoch;
  let finished = false;
  const end = () => { if (!finished) { finished = true; if (done && ep === epoch) gate(done); } };
  const tts = () => {
    if (!synth) return later(1800, end);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(fr);
    u.lang = 'fr-CA'; u.rate = A.slow ? .65 : .9;
    const vs = synth.getVoices();
    const v = vs.find((x) => x.lang.replace('_', '-') === 'fr-CA') || vs.find((x) => x.lang.startsWith('fr'));
    if (v) u.voice = v;
    u.onend = end; u.onerror = end;
    synth.speak(u);
    later(A.slow ? 14000 : 9000, end);
  };
  if (audio) {
    let used = false;
    const fallback = () => { if (!used) { used = true; tts(); } };
    const au = new Audio(audio);
    au.playbackRate = A.slow ? .8 : 1; curAudio = au;
    au.onended = end; au.onerror = fallback;
    au.play().catch(fallback);
  } else tts();
}


/* ---------- voice replies: speech recognition (French, Canada) ---------- */
// Works where the browser offers the Web Speech API (Chrome/Quest Browser with a speech service).
// If it is missing or blocked, the reply buttons still work with point-and-trigger.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let srec = null, recTimer = null;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 0..1 closeness of what was heard to an expected reply (tolerates accents, punctuation, small recognition slips)
function sim(heard, want) {
  const a = norm(heard), b = norm(want);
  if (!a || !b) return 0;
  const whole = 1 - lev(a, b) / Math.max(a.length, b.length);
  const ta = a.split(' '), tb = b.split(' '), used = new Set();
  let hit = 0;
  ta.forEach((x) => {
    let bj = -1, bs = 0;
    tb.forEach((y, j) => { if (used.has(j)) return; const sc = 1 - lev(x, y) / Math.max(x.length, y.length); if (sc > bs) { bs = sc; bj = j; } });
    if (bs >= .75) { hit++; used.add(bj); }
  });
  return Math.max(whole, 2 * hit / (ta.length + tb.length));
}
function stopListening() {
  clearTimeout(recTimer);
  const was = listening;
  listening = false;
  if (srec) { const r = srec; srec = null; r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch (e) {} }
  if (was && choices.mesh.visible) choices.render();
}
function micError(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'The microphone is blocked. Allow the mic for this site, or point and pull the trigger on a reply.';
  if (code === 'audio-capture') return 'No microphone found. Point and pull the trigger on a reply instead.';
  if (code === 'network') return 'Voice needs an internet connection. Point and pull the trigger on a reply instead.';
  if (code === 'no-speech') return 'I didn’t hear anything. Tap the mic and try again.';
  return 'Voice did not work. Point and pull the trigger on a reply instead.';
}
function heardIt(alts) {
  if (busy) return;
  const o = order[sel];
  if (!o) return;
  const sc = Math.max(...alts.map((x) => sim(x, o.fr)));
  if (sc >= .6) pick(o, alts[0]);
  else { msg = { t: `I heard “${alts[0]}”. Try saying: “${o.fr}”`, c: COL.bad }; choices.render(); }
}
function toggleMic() {
  if (busy || paused || modal) return;
  if (!voiceOK()) return;
  if (sel < 0) { msg = { t: 'Select a reply first, then tap the microphone.', c: COL.grey }; return choices.render(); }
  if (listening) { stopListening(); msg = { t: '', c: COL.grey }; return choices.render(); }
  if (talking) { msg = { t: 'Wait until the barista has finished, then tap the mic.', c: COL.grey }; return choices.render(); }
  try { synth && synth.cancel(); } catch (e) {}
  const r = new SR();
  srec = r; r.lang = 'fr-CA'; r.interimResults = false; r.continuous = false; r.maxAlternatives = 5;
  let got = false;
  r.onresult = (e) => {
    got = true;
    const alts = [...e.results[0]].map((x) => x.transcript).filter(Boolean);
    stopListening();
    if (alts.length) heardIt(alts);
  };
  r.onerror = (e) => { if (srec !== r) return; got = true; stopListening(); if (e.error !== 'no-speech' && e.error !== 'aborted') voiceOff = true; msg = { t: micError(e.error), c: e.error === 'no-speech' ? COL.grey : COL.bad }; choices.render(); };
  r.onend = () => { if (srec !== r) return; stopListening(); if (!got) { msg = { t: micError('no-speech'), c: COL.grey }; choices.render(); } };
  try {
    r.start();
    listening = true;
    msg = { t: 'Listening… say your reply in French.', c: COL.teal };
    recTimer = setTimeout(() => { if (srec === r) { try { r.stop(); } catch (e) {} } }, 9000);
  } catch (e) { srec = null; voiceOff = true; msg = { t: micError('other'), c: COL.bad }; }
  choices.render();
}

/* ---------- dialogue flow ---------- */
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const renderAll = () => { bubble.render(); choices.render(); };

function startTurn() {
  const t = LINES[turn];
  stopListening(); sel = -1;
  tries = 0; reveal = false; showEn = false; busy = false; msg = { t: '', c: COL.grey };
  order = shuffle(t.options.map((o, i) => ({ ...o, audio: `audio/${ap()}_opt${i + 1}.mp3` })));
  bubbleFr = t.fr; bubbleEn = t.en; talking = true;
  cupG.visible = mode === 'cafe' && turn === LINES.length - 1;
  bubble.mesh.visible = choices.mesh.visible = true;
  hudPlace(); hud.mesh.visible = hudOn();
  renderAll();
  speak(t.fr, `audio/${ap()}_barista.mp3`, () => { talking = false; });
}
function selectRow(i) {
  if (busy) return;
  const o = order[i];
  if (!voiceOK()) return pick(o);
  stopListening();
  sel = i;
  msg = { t: 'Tap the microphone and say your reply in French.', c: COL.teal };
  choices.render();
}
function pick(o, heard) {
  if (busy) return;
  stopListening(); sel = -1;
  const t = LINES[turn];
  if (o.ok) {
    busy = true;
    if (tries === 0 && !reveal) first++;
    msg = { t: '✓ Très bien! ' + (t.note || ''), c: COL.ok };
    choices.render();
    speak(o.fr, o.audio, () => later(900, next));
  } else wrong(heard ? `I heard “${heard}”. Not quite. Tap a speaker icon to hear a reply, then try again.` : 'Not quite. Tap a speaker icon to hear a reply, then try again.');
}
function wrong(text) {
  if (busy) return;
  const t = LINES[turn];
  tries++; showEn = tries >= 2; talking = true; sel = -1;
  bubbleFr = 'Pardon? Je n’ai pas compris.'; bubbleEn = 'Sorry? I didn’t understand.';
  msg = { t: text, c: COL.bad };
  renderAll();
  speak(bubbleFr, 'audio/pardon.mp3', () => { talking = false; bubbleFr = t.fr; bubbleEn = t.en; bubble.render(); });
}
function skip() {
  if (busy) return;
  stopListening(); sel = -1;
  busy = true; reveal = true; showEn = true;
  const ok = LINES[turn].options.find((o) => o.ok);
  msg = { t: `A good reply: “${ok.fr}” (${ok.en})`, c: COL.teal };
  renderAll();
  speak(ok.fr, `audio/${ap()}_opt${LINES[turn].options.indexOf(ok) + 1}.mp3`, () => later(1200, next));
}
function next() {
  const prev = LINES[turn];
  turn++;
  if (prev && prev.pay && mode === 'cafe') return startPayment(prev.pay);
  if (turn < LINES.length) return startTurn();
  if (mode === 'assess') return finishAssess();
  score = +(first / LINES.length * 10).toFixed(1);
  res = { head: score >= 8 ? 'Excellent job!' : score >= 5 ? 'Bon travail!' : 'Keep practicing!', body: `You answered ${first} of ${LINES.length} replies correctly on the first try.`, btn: 'Play again', fn: playAgain };
  cupLive = true; cupMsg = 'Votre cortado est prêt! Point at it and pull the trigger (or click) to grab it.';
  bubble.mesh.visible = choices.mesh.visible = false; cupHint.mesh.visible = true; cupHint.render();
}
function goCafe() { transition(() => { resetCup(); resetPay(); loadScript(CAFE); mode = 'cafe'; setScene('cafe'); turn = 0; first = 0; startTurn(); }); }
function playAgain() { goCafe(); }

/* ---------- scenes ---------- */
const street = new THREE.Group(), cafe = new THREE.Group();
scene.add(street, cafe);
function setScene(name) {
  cur = name;
  const on = (...n) => n.includes(name);
  street.visible = on('street', 'tip');
  cafe.visible = on('cafe', 'result');
  desk.visible = on('deskintro', 'desk', 'level');
  globe.visible = on('load', 'signin', 'welcome', 'dash');
  grid.visible = dash.mesh.visible = on('dash');
  streetCard.mesh.visible = on('street', 'deskintro');
  bubble.mesh.visible = choices.mesh.visible = on('cafe', 'desk');
  result.mesh.visible = on('result', 'level');
  loading.mesh.visible = on('load', 'tip');
  sign.mesh.visible = on('signin', 'welcome');
  scene.background = new THREE.Color(on('street', 'tip') ? '#a9d6f5' : on('dash') ? '#dfe5e9' : on('desk', 'deskintro', 'level') ? '#2a2f36' : on('cafe', 'result') ? '#1b1512' : '#271f33');
  scene.fog = on('street', 'tip') ? new THREE.Fog('#a9d6f5', 18, 50) : null;
  if (on('dash')) { globe.position.set(.95, 1.45, -2.1); globe.scale.setScalar(.6); } else { globe.position.set(0, .2, -7); globe.scale.setScalar(3.5); }
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = on('cafe', 'result') ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  hud.mesh.visible = hudOn(); hudPlace(); hud.render();
  [loading, sign, dash, streetCard].forEach((p) => p.mesh.visible && p.render());
}

/* Rosemont street (stylized stand-in; drop a 360 photo in assets/rosemont-360.jpg to replace it) */
const sty = new THREE.Group(); street.add(sty);
box(sty, 80, .1, 80, '#4b4e54', 0, -.1, -10);
box(sty, 4.4, .1, 60, '#bdb8b0', -.2, -.05, -10);
const brick = ['#8c5a45', '#a46a4f', '#6f4a3c', '#b07a5a', '#7d5444'];
for (let i = 0; i < 6; i++) {
  const z = -i * 6 - 1, h = 7 + (i % 3) * 1.5;
  box(sty, 1, h, 6, brick[i % 5], -2.9, h / 2, z);
  box(sty, .06, 1.3, 1.6, '#2b3a4a', -2.38, 4.2, z - 1.6);
  box(sty, .06, 1.3, 1.6, '#2b3a4a', -2.38, 4.2, z + 1.6);
  box(sty, .06, 1.8, i === 0 ? 2.2 : 3, '#3a5566', -2.38, 1.3, i === 0 ? z + 1.4 : z);
}
box(sty, .08, 2.2, 1.1, COL.teal, -2.37, 1.1, -2.9);
box(sty, 1.0, .1, 1.8, COL.teal, -1.95, 2.55, -2.9);
canvasPlane(1.7, .5, 512, (c, w, h) => {
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = COL.teal; c.fillRect(0, 0, w, 10);
  c.fillStyle = COL.ink; c.font = `700 ${h * .45}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Café Rosemont', w / 2, h / 2 + 4);
}, sty, -2.36, 3.1, -2.9, Math.PI / 2);
box(sty, .08, .9, 60, '#8a4b2a', 2.4, .45, -10);
box(sty, 1, 10, 60, '#7a6f68', 14, 5, -10);
for (const z of [-2, -9, -16]) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .15, 2.2, 8), M('#5a3d28')); trunk.position.set(3, 1.1, z); sty.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), M('#3f7d3a')); crown.position.set(3, 3.3, z); sty.add(crown);
}
new THREE.TextureLoader().load('assets/rosemont-360.jpg', (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 32).scale(-1, 1, 1), new THREE.MeshBasicMaterial({ map: t, fog: false, toneMapped: false }));
  s.position.y = 1.6; street.add(s); sty.visible = false; room.setOutside(t);
}, undefined, () => {});

/* Café interior: the realistic room lives in cafe3d.js */
const room = buildCafe({ parent: cafe, renderer, FONT });
const S = room.S;

/* Barista: a stylised figure. To use a licensed realistic character, add assets/barista.glb (it replaces this one). */
const barista = new THREE.Group(); barista.position.set(-.4, 0, -3.1); cafe.add(barista);
const proc = new THREE.Group(); barista.add(proc);
const skin = S({ color: '#d8a47c', roughness: .55, envMapIntensity: .25 });
const shirtM = S({ color: '#f0ede6', roughness: .8, envMapIntensity: .2 });
const apronM = S({ color: '#26332d', roughness: .85, envMapIntensity: .15, side: THREE.DoubleSide });
const hairM = S({ color: '#3a281d', roughness: .7, envMapIntensity: .2 });
const bp = (geo, mat, x, y, z, grp = proc) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
bp(new THREE.CylinderGeometry(.19, .21, .66, 24), shirtM, 0, 1.15, 0);
bp(new THREE.CylinderGeometry(.205, .225, .5, 24, 1, true, -1.2, 2.4), apronM, 0, 1.02, .005);
bp(new THREE.BoxGeometry(.27, .24, .02), apronM, 0, 1.36, .195);
[-1, 1].forEach((sd) => { bp(new THREE.BoxGeometry(.025, .3, .015), apronM, sd * .09, 1.5, .1).rotation.x = -.35; });
bp(new THREE.CylinderGeometry(.045, .055, .09, 14), skin, 0, 1.52, 0);
const head = new THREE.Group(); head.position.y = 1.64; proc.add(head);
bp(new THREE.SphereGeometry(.118, 28, 22), skin, 0, 0, 0, head).scale.set(1, 1.12, 1.02);
bp(new THREE.SphereGeometry(.124, 28, 20, 0, Math.PI * 2, 0, Math.PI * .58), hairM, 0, .025, -.008, head).scale.set(1, 1.1, 1.05);
bp(new THREE.SphereGeometry(.05, 14, 10), hairM, 0, .13, -.07, head);
[-.045, .045].forEach((x) => {
  bp(new THREE.SphereGeometry(.016, 12, 10), S({ color: '#ffffff', roughness: .3 }), x, .018, .105, head);
  bp(new THREE.SphereGeometry(.009, 10, 8), S({ color: '#2b1d14', roughness: .2 }), x, .018, .119, head);
  bp(new THREE.BoxGeometry(.04, .008, .01), hairM, x, .058, .112, head).rotation.z = x > 0 ? .12 : -.12;
});
bp(new THREE.SphereGeometry(.014, 10, 8), skin, 0, -.012, .12, head);
[-1, 1].forEach((sd) => bp(new THREE.SphereGeometry(.02, 10, 8), skin, sd * .116, 0, 0, head));
const mouth = bp(new THREE.BoxGeometry(.05, .01, .01), S({ color: '#8a3a3a', roughness: .5 }), 0, -.05, .108, head);
[-1, 1].forEach((sd) => {
  const sh = new THREE.Group(); sh.position.set(sd * .235, 1.4, 0); sh.rotation.x = -.35; proc.add(sh);
  bp(new THREE.CylinderGeometry(.04, .036, .3, 14), shirtM, 0, -.15, 0, sh);
  const el = new THREE.Group(); el.position.y = -.3; el.rotation.x = -1.15; sh.add(el);
  bp(new THREE.CylinderGeometry(.033, .028, .26, 14), skin, 0, -.13, 0, el);
  bp(new THREE.SphereGeometry(.036, 12, 10), skin, 0, -.28, 0, el);
});
let mixer = null;
new GLTFLoader().load('assets/barista.glb', (g) => {
  const m = g.scene, bb = new THREE.Box3().setFromObject(m), k = 1.72 / (bb.max.y - bb.min.y);
  m.scale.setScalar(k); m.position.y = -bb.min.y * k;
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  barista.add(m); proc.visible = false;
  if (g.animations.length) { mixer = new THREE.AnimationMixer(m); mixer.clipAction(g.animations[0]).play(); }
}, undefined, () => {});

/* ---------- app flow: loading → sign-in → dashboard → info desk → module ---------- */
const loadScript = (a) => LINES.splice(0, LINES.length, ...a);
let cur = 'load', dState = 'lang', pLearn = -1, mode = 'cafe', dMsg = '';
let gFocus = null, gSpin = true, selLoc = -1, markerT = 0;
let card = { t: 'You are located in the Rosemont neighbourhood. Enter the café to your left.', b: 'Enter the café', fn: goCafe };
let res = { head: '', body: '', btn: 'Play again', fn: playAgain };
const ap = () => (mode === 'assess' ? 'a' : 't') + (turn + 1);
const code = Array.from({ length: 9 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join(' ');
const later = (ms, fn) => { const ep = epoch; setTimeout(() => { if (ep === epoch) gate(fn); }, ms); };

function logo(c, x, y, s, hole) {
  c.fillStyle = COL.ok; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
  c.beginPath(); c.moveTo(x - s, y); c.lineTo(x - s, y + s * 1.25); c.lineTo(x - s * .3, y + s * .85); c.fill();
  if (!hole) c.globalCompositeOperation = 'destination-out';
  c.fillStyle = hole || '#000'; c.beginPath(); c.arc(x + s * .05, y - s * .05, s * .32, 0, 7); c.fill();
  c.globalCompositeOperation = 'source-over';
}
const loading = new Panel(1.2, .8, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  if (cur === 'tip') {
    p.rr(4, 4, W - 8, H - 8, 40, '#fff', COL.line);
    p.text('Use your map to navigate the neighbourhood.', W / 2, 90, 52, COL.ink, 600, W - 140, 'center');
    p.text('Look for the café on your route, then walk in.', W / 2, 300, 36, COL.grey, 400, W - 160, 'center');
    logo(c, 140, H - 110, 40, '#fff'); p.text('Connecting you…', 210, H - 135, 40, COL.ink, 500);
  } else { logo(c, W / 2, 230, 110); p.text('Connecting you…', W / 2, 400, 48, '#fff', 500, W, 'center'); }
}).place(0, 1.5, -1.6);

const sign = new Panel(1.1, .85, (p) => {
  const c = p.ctx, W = p.cv.width;
  p.rr(4, 4, W - 8, p.cv.height - 8, 44, '#fff', COL.line);
  p.text('Sign in', W / 2, 40, 64, '#111', 700, W, 'center');
  if (cur === 'signin') {
    [['Take off your headset and go to worldspeak.auth0.com/authenticate', 150], ['Enter this one-time login code on your external device.', 340]].forEach(([t, y], i) => {
      c.beginPath(); c.arc(80, y + 24, 30, 0, 7); c.fillStyle = COL.ok; c.fill();
      p.text(String(i + 1), 80, y + 4, 36, '#fff', 700, 60, 'center');
      p.text(t, 140, y, 34, COL.grey, 400, W - 190);
    });
    p.rr(60, 500, W - 120, 110, 16, '#fff', '#c9d2d6'); p.text(code, W / 2, 530, 48, COL.ink, 700, W, 'center');
  } else {
    c.beginPath(); c.arc(W / 2, 250, 56, 0, 7); c.fillStyle = COL.ok; c.fill();
    p.text('✓', W / 2, 205, 80, '#fff', 700, 100, 'center');
    p.text('Hello, Alex!', W / 2, 350, 64, COL.grey, 700, W, 'center');
    p.text('You’re all set. You will be connected in a moment.', W / 2, 450, 36, COL.grey, 400, W - 160, 'center');
  }
}).place(0, 1.5, -1.5);

/* globe + dashboard */
const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshLambertMaterial({ color: '#3a6ea5' }));
globe.rotation.x = .3; scene.add(globe);
new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg', (t) => {
  t.colorSpace = THREE.SRGBColorSpace; globe.material.map = t; globe.material.color.set('#ffffff'); globe.material.needsUpdate = true;
}, undefined, () => {});
/* popular French-speaking locations (photos optional: assets/loc_<id>.jpg) */
const LOCS = [
  { n: 'Nice', c: 'France', la: 43.70, lo: 7.26, id: 'nice' },
  { n: 'Geneva', c: 'Switzerland', la: 46.20, lo: 6.14, id: 'geneva' },
  { n: 'Montreal', c: 'Canada', la: 45.50, lo: -73.57, id: 'montreal', mod: true },
  { n: 'Paris', c: 'France', la: 48.86, lo: 2.35, id: 'paris' },
  { n: 'Québec City', c: 'Canada', la: 46.81, lo: -71.21, id: 'quebec' },
  { n: 'Brussels', c: 'Belgium', la: 50.85, lo: 4.35, id: 'brussels' },
  { n: 'Dakar', c: 'Senegal', la: 14.72, lo: -17.47, id: 'dakar' },
];
const llv = (la, lo) => { la *= Math.PI / 180; lo *= Math.PI / 180; return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)); };
LOCS.forEach((l) => { l.v = llv(l.la, l.lo); l.img = new Image(); l.img.onload = () => { l.ok = true; if (cur === 'dash' && dash.mesh.visible) dash.render(); }; l.img.src = `assets/loc_${l.id}.jpg`; });

// marker (Figma: soft halo, ring and mint dot), fades and grows in when a location is chosen
const mk = (g, col, op) => { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.userData.op = op; return m; };
const marker = new THREE.Group(); marker.visible = false; globe.add(marker);
const mHalo = mk(new THREE.CircleGeometry(.095, 48), '#e9f6f7', .42), mRing = mk(new THREE.RingGeometry(.072, .095, 48), '#f4fbfb', .9), mDot = mk(new THREE.CircleGeometry(.032, 32), '#b9e6e8', 1);
mHalo.position.z = 0; mRing.position.z = .001; mDot.position.z = .002;
marker.add(mHalo, mRing, mDot);
const locDots = new THREE.Group(); locDots.visible = false; globe.add(locDots);
LOCS.forEach((l) => { const d = new THREE.Mesh(new THREE.CircleGeometry(.022, 20), new THREE.MeshBasicMaterial({ color: '#1F9AA0', transparent: true, opacity: .85, toneMapped: false })); d.position.copy(l.v).multiplyScalar(1.003); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), l.v); locDots.add(d); });
const gZ = new THREE.Vector3(0, 0, 1), gEye = new THREE.Vector3(0, 1.6, 0);
function focusGlobe(v) {
  const to = gEye.clone().sub(globe.position).normalize(), now = v.clone().applyQuaternion(globe.quaternion);
  gFocus = new THREE.Quaternion().setFromUnitVectors(now, to).multiply(globe.quaternion);
}
function chooseLoc(i) {
  const l = LOCS[i];
  selLoc = i; markerT = 0; gSpin = false;
  marker.position.copy(l.v).multiplyScalar(1.004); marker.quaternion.setFromUnitVectors(gZ, l.v);
  focusGlobe(l.v);
  dMsg = l.mod ? '' : `${l.n} is marked on the globe. Only Montréal has a module in this prototype.`;
  dash.render();
}
function globeClick(point) {
  const v = globe.worldToLocal(point.clone()).normalize();
  let bi = -1, ba = .24;
  LOCS.forEach((l, i) => { const a = v.angleTo(l.v); if (a < ba) { ba = a; bi = i; } });
  if (bi >= 0 && (dState === 'loc' || dState === 'locall')) chooseLoc(bi);
}
// trackball: rotate the globe so the point under the pointer follows the pointer
const gDir = (pt) => pt.clone().sub(globe.position).normalize();
function globeDrag(drag, pt) {
  if (!pt) { drag.last = null; return 0; }
  const v = gDir(pt);
  let ang = 0;
  if (drag.last) { const q = new THREE.Quaternion().setFromUnitVectors(drag.last, v); ang = drag.last.angleTo(v); globe.quaternion.premultiply(q); gFocus = null; gSpin = false; }
  drag.last = v;
  return ang;
}
const grid = new THREE.GridHelper(40, 40, '#b8c2c9', '#cdd5da'); grid.visible = false; scene.add(grid);

const FLAGS = [
  ['German', 'h', ['#000000', '#dd0000', '#ffce00']], ['French', 'v', ['#0055a4', '#f1f1f1', '#ef4135']],
  ['Spanish', 'h', ['#c60b1e', '#ffc400', '#c60b1e'], [1, 2, 1]], ['Italian', 'v', ['#009246', '#f1f1f1', '#ce2b37']],
  ['Portuguese', 'v', ['#006600', '#ff0000'], [2, 3]], ['Japanese', 'jp'],
];
function drawFlag(c, f, x, y, w, h) {
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, 6); c.clip();
  if (f[1] === 'jp') { c.fillStyle = '#f4f4f4'; c.fillRect(x, y, w, h); c.fillStyle = '#bc002d'; c.beginPath(); c.arc(x + w / 2, y + h / 2, h * .3, 0, 7); c.fill(); }
  else {
    const ws = f[3] || f[2].map(() => 1), tot = ws.reduce((a, b) => a + b, 0); let o = 0;
    f[2].forEach((col, k) => { c.fillStyle = col; const l = ws[k] / tot; if (f[1] === 'h') c.fillRect(x, y + o * h, w, l * h + 1); else c.fillRect(x + o * w, y, l * w + 1, h); o += l; });
  }
  c.restore();
}
/* horizontal carousel with arrow buttons (Figma): items clip at the right edge, arrows below */
const cs = {};
function arrowBtn(p, x, y, dir, id, on, fn) {
  const c = p.ctx, r = 42, hv = p.hover === id && on, cx = x + r, cy = y + r;
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = hv ? '#DDF8F9' : '#F0FEFE'; c.fill(); c.strokeStyle = '#BFE6E6'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = on ? '#7f8d92' : '#c9d2d5'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
  const tip = cx + dir * 18, tail = cx - dir * 18, hb = tip - dir * 15;
  c.beginPath(); c.moveTo(tail, cy); c.lineTo(tip, cy); c.moveTo(hb, cy - 14); c.lineTo(tip, cy); c.lineTo(hb, cy + 14); c.stroke();
  p.hits.push({ x, y, w: r * 2, h: r * 2, id, fn: on ? fn : () => {} });
}
function carousel(p, key, x, y, w, h, n, iw, gap, drawItem, onPick) {
  const c = p.ctx, st = cs[key] || (cs[key] = { cur: 0, tgt: 0 }), step = iw + gap, max = Math.max(0, n * step - gap + 80 - w);
  st.tgt = Math.max(0, Math.min(max, st.tgt));
  p.rr(x, y, w, h, 28, 'rgba(255,255,255,.5)', '#D3DFE2');
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, 28); c.clip();
  for (let i = 0; i < n; i++) {
    const ix = x + 40 + i * step - st.cur;
    if (ix > x + w || ix + iw < x) continue;
    drawItem(i, ix, y + 30);
    const hx = Math.max(ix, x), hw = Math.min(ix + iw, x + w) - hx;
    p.hits.push({ x: hx, y, w: hw, h, id: key + i, fn: () => onPick(i) });
  }
  c.restore();
  const ay = y + h + 22;
  arrowBtn(p, x, ay, -1, key + 'L', st.tgt > 1, () => { st.tgt -= step; p.render(); });
  arrowBtn(p, x + 98, ay, 1, key + 'R', st.tgt < max - 1, () => { st.tgt += step; p.render(); });
  return ay;
}
const nudge = (key, d) => { const st = cs[key]; if (st) { st.tgt += d; dash.render(); } };
addEventListener('keydown', (e) => {
  if (cur !== 'dash' || paused) return;
  const key = dState === 'lang' ? 'f' : dState === 'loc' ? 'l' : null;
  if (key && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) nudge(key, e.key === 'ArrowRight' ? 240 : -240);
});
const LEARN = ['How to address people.', 'How to order with confidence.', 'Describe yourself.', 'Ask for directions.'];
const LEARN_SUB = ['Ask for directions from multiple locals.', 'Practice ordering at a cafe.', 'Introduce yourself to a group of locals.', 'Navigate downtown Montreal and ask for specific locations.'];
const gs = (s) => { dState = s; dMsg = ''; dash.render(); };
function list(p, items, subs, sel, y0, h, pickFn, enabled = () => true) {
  const c = p.ctx, W = p.cv.width;
  items.forEach((t, i) => {
    const y = y0 + i * (h + 16), hv = p.hover === 'r' + i, ok = enabled(i);
    p.rr(44, y, W - 88, h, 20, hv && ok ? COL.mint : '#fff', sel === i ? COL.teal : COL.line, sel === i ? 6 : 3);
    if (subs) { p.text(t, 76, y + 20, 32, ok ? COL.ink : '#9aa8ad', 400, W - 200); p.text(subs[i], 76, y + 64, 27, COL.grey, 400, W - 190); }
    else p.text(t, 76, y + 22, 36, ok ? COL.ink : '#9aa8ad', 500, W - 220);
    c.beginPath(); c.arc(W - 100, y + h / 2, 22, 0, 7); c.strokeStyle = COL.line; c.lineWidth = 4; c.stroke();
    if (sel === i) { c.beginPath(); c.arc(W - 100, y + h / 2, 12, 0, 7); c.fillStyle = COL.teal; c.fill(); }
    p.hits.push({ x: 44, y, w: W - 88, h, id: 'r' + i, fn: () => pickFn(i) });
  });
}
const dash = new Panel(1.6, 1.45, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 40, 'rgba(240,245,247,.96)', COL.line);
  p.text('Welcome, Alex', 44, 34, 58, COL.ink, 700);
  p.rr(560, 40, 420, 70, 35, '#fff', COL.line); p.vtext('Find a destination.', 600, 75, 32, '#9aa8ad');
  const back = (t, mw = W - 160) => {
    p.text('←', 44, 150, 44, COL.ink, 600); p.text(t, 110, 156, 34, COL.grey, 500, mw);
    p.hits.push({ x: 30, y: 140, w: 80, h: 70, id: 'back', fn: () => gs(dState === 'learn' ? 'loc' : dState === 'locall' ? 'loc' : 'lang') });
  };
  const goOn = () => { if (selLoc < 0) { dMsg = 'Select a location to continue.'; dash.render(); } else if (!LOCS[selLoc].mod) { dMsg = 'Only Montréal has a module in this prototype.'; dash.render(); } else gs('learn'); };
  if (dState === 'lang') {
    p.text('Discover locations by language', 44, 160, 36, COL.ink, 700);
    p.text('Select a language to view destinations on the globe.', 44, 210, 30, COL.grey);
    const ay = carousel(p, 'f', 44, 270, W - 88, 330, FLAGS.length, 220, 20, (i, x, y) => {
      const hv = p.hover === 'f' + i;
      if (hv) p.rr(x - 8, y - 8, 236, 270, 20, COL.mint, COL.line);
      drawFlag(c, FLAGS[i], x + 15, y + 30, 190, 128);
      p.text(FLAGS[i][0], x + 110, y + 190, 34, COL.ink, 500, 210, 'center');
    }, (i) => { if (i !== 1) { dMsg = 'Only French is available in this prototype.'; return dash.render(); } selLoc = -1; gs('loc'); });
    p.text(dMsg, 44, ay + 110, 30, COL.bad, 600, W - 88);
  } else if (dState === 'loc') {
    back('Popular French speaking locations.', W - 420);
    p.ghost(W - 44 - 220, 138, 220, 76, 'View All', 'all', () => gs('locall'));
    const ay = carousel(p, 'l', 44, 235, W - 88, 410, LOCS.length, 226, 22, (i, x, y) => {
      const l = LOCS[i], on = selLoc === i, hv = p.hover === 'l' + i;
      c.save(); c.beginPath(); c.roundRect(x, y, 226, 226, 14); c.clip();
      if (l.ok) { const im = l.img, k = Math.max(226 / im.width, 226 / im.height); c.drawImage(im, x + (226 - im.width * k) / 2, y + (226 - im.height * k) / 2, im.width * k, im.height * k); }
      else { const g = c.createLinearGradient(x, y, x + 226, y + 226); g.addColorStop(0, '#d5ecee'); g.addColorStop(1, '#8fc7cc'); c.fillStyle = g; c.fillRect(x, y, 226, 226); p.text(l.n[0], x + 113, y + 60, 110, 'rgba(255,255,255,.85)', 700, 226, 'center'); }
      if (hv && !on) { c.fillStyle = 'rgba(31,154,160,.12)'; c.fillRect(x, y, 226, 226); }
      c.restore();
      if (on) p.rr(x - 3, y - 3, 232, 232, 17, null, COL.teal, 6);
      p.text(l.n, x + 113, y + 248, 34, COL.ink, 700, 226, 'center');
      p.text(l.c, x + 113, y + 296, 30, COL.grey, 400, 226, 'center');
    }, (i) => chooseLoc(i));
    p.btn(W - 44 - 290, ay + 2, 290, 80, 'Continue', 'go', goOn);
    p.text(dMsg, 44, ay + 110, 30, COL.bad, 600, W - 88);
  } else if (dState === 'locall') {
    back('All French speaking locations.', W - 420);
    p.ghost(W - 44 - 220, 138, 220, 76, 'View Less', 'less', () => gs('loc'));
    list(p, LOCS.map((l) => `${l.n} · ${l.c}`), null, selLoc, 205, 62, (i) => chooseLoc(i));
    p.btn(W - 44 - 290, H - 118, 290, 80, 'Continue', 'go', goOn);
    p.text(dMsg, 44, H - 108, 28, COL.bad, 600, W - 420);
  } else {
    back('What do you want to learn?');
    list(p, LEARN, LEARN_SUB, pLearn, 215, 116, (i) => { pLearn = i; dMsg = ''; dash.render(); });
    const by = 215 + LEARN.length * 132 + 22;
    p.btn(W - 44 - 200, by, 200, 70, 'Continue', 'go', () => {
      if (pLearn < 0) { dMsg = 'Choose a topic to continue.'; dash.render(); }
      else if (pLearn === 1) toDesk();
      else { dMsg = 'Coming soon. This prototype has the café ordering module only.'; dash.render(); }
    }, { weight: 400, color: '#5f6f75' });
    p.text(dMsg, 44, by + 4, 30, COL.bad, 600, W - 340);
  }
}).place(-0.65, 1.35, -1.75);

/* info desk (stylized stand-in for your lobby photo) */
const desk = new THREE.Group(); scene.add(desk);
box(desk, 10, .1, 10, '#c9ced2', 0, -.05, -3);
box(desk, 10, 4, .1, '#20242a', 0, 2, -5.5);
box(desk, .1, 4, 10, '#2c3138', -5, 2, -3);
box(desk, 4.6, 1.05, .8, '#f4f5f6', 0, .52, -2.4);
box(desk, 4.8, .06, .95, '#e1e4e7', 0, 1.06, -2.4);
canvasPlane(1.8, .7, 512, (c, w, h) => {
  c.fillStyle = '#1b2430'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `600 ${h * .2}px ${FONT}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Information', w / 2, h / 2);
}, desk, .9, 2.3, -5.4);
function makePerson(parent, x, z, shirt, hairCol) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, .7, 16), M(shirt)); torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Group(); head.position.y = 1.54; g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 16), M('#e2b48f')));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.15, 20, 16, 0, Math.PI * 2, 0, Math.PI * .55), M(hairCol)); hair.position.y = .02; head.add(hair);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.06, .012, .01), M('#7a2f2f')); mouth.position.set(0, -.05, .135); head.add(mouth);
  [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .55, 10), M(shirt)); a.position.set(s * .27, 1.1, .05); a.rotation.z = s * .12; g.add(a); });
  return { g, head, mouth };
}
const rec = makePerson(desk, -.5, -3.1, '#1d1d22', '#b8531f');

/* flow */
function boot() {
  const go = new URLSearchParams(location.search).get('start'); // e.g. ?start=cafe, ?start=pay, ?start=street, ?start=dash, ?start=desk
  if (go === 'cafe' || go === 'pay') { loadScript(CAFE); mode = 'cafe'; first = 0; setScene('cafe'); turn = go === 'pay' ? 2 : 0; return go === 'pay' ? next() : startTurn(); }
  if (go === 'street') return setScene('street');
  if (go === 'dash') { dState = 'lang'; return setScene('dash'); }
  if (go === 'desk') return toDesk();
  setScene('load');
  later(2600, () => { setScene('signin'); later(3500, () => { setScene('welcome'); later(2200, () => transition(() => { dState = 'lang'; setScene('dash'); })); }); });
}
function toDesk() {
  transition(() => {
    card = { t: 'Welcome to Montréal! Before you begin, we need a bit of information about your speaking skills. This short assessment sets the difficulty of your module.', b: 'Begin speaking assessment', fn: beginAssess };
    setScene('deskintro');
  });
}
function beginAssess() { mode = 'assess'; loadScript(ASSESS); turn = 0; first = 0; setScene('desk'); startTurn(); }
function finishAssess() {
  score = +(4 + 6 * first / LINES.length).toFixed(1);
  res = { head: score >= 8 ? 'Excellent job!' : score >= 6 ? 'Bon travail!' : 'Good start!', body: `You have ${score >= 8 ? 'strong' : 'developing'} speaking skills. Based on your replies you will practice at a ${score} difficulty level. You can change this anytime in settings.`, btn: 'Begin module', fn: beginModule };
  setScene('level'); result.render();
}
function beginModule() {
  transition(() => {
    card = { t: 'You are located in the Rosemont neighbourhood. Enter the café to your left.', b: 'Enter the café', fn: goCafe };
    setScene('tip');
    later(3200, () => transition(() => setScene('street')));
  });
}

/* ---------- cortado to grab at the end of the module ---------- */
let cupLive = false, cupHeld = null, cupMsg = '', mouseCup = null;
const cupT = new THREE.Vector3();
const cupG = new THREE.Group(); cupG.position.set(.55, 1.052, -1.98); cupG.scale.setScalar(1.3); cupG.visible = false; cafe.add(cupG);
const cupMat = new THREE.MeshLambertMaterial({ color: '#f6f3ee' });
const saucer = new THREE.Mesh(new THREE.CylinderGeometry(.065, .055, .01, 20), cupMat); saucer.position.y = .005; cupG.add(saucer);
const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(.038, .028, .055, 20), cupMat); cupBody.position.y = .04; cupG.add(cupBody);
const cupHandle = new THREE.Mesh(new THREE.TorusGeometry(.016, .004, 6, 12), cupMat); cupHandle.position.set(.042, .042, 0); cupG.add(cupHandle);
const coffee = new THREE.Mesh(new THREE.CylinderGeometry(.033, .033, .004, 20), M('#5a3a22')); coffee.position.y = .066; cupG.add(coffee);
const cupGrab = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); cupGrab.position.y = .05; cupG.add(cupGrab);
room.steam(cupG, 0, .085, 0, 1);
const cupHint = new Panel(1.1, .34, (p) => {
  const W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 30, 'rgba(244,251,252,.95)', COL.line);
  p.text(cupMsg, W / 2, 30, 46, COL.teal, 700, W - 80, 'center');
}).place(.55, 1.6, -1.9);
function resetCup() {
  cupLive = false; cupHeld = null; cupG.visible = false; saucer.visible = true;
  cupG.position.set(.55, 1.052, -1.98); cupG.scale.setScalar(1.3); cupHint.mesh.visible = false;
}
function grabCup(c) {
  if (!cupLive) return;
  cupLive = false; cupHeld = c || 'mouse'; cupG.scale.setScalar(1); saucer.visible = false;
  try { c.userData.src.gamepad.hapticActuators[0].pulse(.7, 90); } catch (e) {}
  cupMsg = 'Santé! Bon appétit!'; cupHint.render();
  later(2600, () => { cupHint.mesh.visible = false; setScene('result'); result.render(); });
}

/* ---------- accessibility settings (remembered on this device) ---------- */
const A = Object.assign({ en: false, big: false, slow: false, calm: false, seat: false }, (() => { try { return JSON.parse(localStorage.getItem('fvr-a11y')) || {}; } catch (e) { return {}; } })());
let paused = false, modal = null, a11yFrom = null;

/* ---------- top-right buttons (Figma: pause + accessibility) ---------- */
/* Figma icon style: soft mint fill, light cyan ring, grey-teal edge and a drop shadow */
function iconLayer(c, path, hv, outer) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.shadowColor = 'rgba(0,0,0,.30)'; c.shadowBlur = 14; c.shadowOffsetY = 9;
  path(); c.lineWidth = outer; c.strokeStyle = '#BCD5DA'; c.stroke();
  c.restore();
  c.lineJoin = 'round'; c.lineCap = 'round';
  path(); c.lineWidth = outer - 8; c.strokeStyle = hv ? '#C4EEF2' : '#D9F1F4'; c.stroke();
  path(); c.lineWidth = 8; c.fillStyle = hv ? '#FFFFFF' : '#F2FEFF'; c.strokeStyle = c.fillStyle; c.fill(); c.stroke();
}
function roundPoly(c, pts, r) {
  const n = pts.length;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i + n - 1) % n], [x, y] = pts[i], [nx, ny] = pts[(i + 1) % n];
    const a = [(px + x) / 2, (py + y) / 2], b = [(x + nx) / 2, (y + ny) / 2];
    if (i === 0) c.moveTo(a[0], a[1]);
    c.arcTo(x, y, b[0], b[1], r);
  }
  c.closePath();
}
function iconPause(c, cx, cy, k, hv) {
  c.save(); c.translate(cx, cy); c.scale(k, k);
  [-52, 52].forEach((x) => iconLayer(c, () => { c.beginPath(); c.roundRect(x - 12, -100, 24, 200, 12); }, hv, 24));
  c.restore();
}
function iconAccess(c, cx, cy, k, hv) {
  c.save(); c.translate(cx, cy); c.scale(k, k);
  iconLayer(c, () => { c.beginPath(); c.arc(0, -108, 20, 0, 7); }, hv, 34);
  iconLayer(c, () => roundPoly(c, [[-112, -54], [112, -54], [112, -32], [28, -2], [70, 108], [62, 134], [40, 134], [0, 58], [-40, 134], [-62, 134], [-70, 108], [-28, -2], [-112, -32]], 9), hv, 28);
  c.restore();
}
const HUD_PAUSE = ['deskintro', 'desk', 'level', 'street', 'cafe', 'result'];
const hudOn = () => HUD_PAUSE.includes(cur) || cur === 'dash';
const hud = new Panel(.17, .4, (p) => {
  const W = p.cv.width, H = p.cv.height, havePause = HUD_PAUSE.includes(cur) && !modal, kP = .9, kA = .92;
  if (havePause) {
    p.hits.push({ x: W / 2 - 120, y: H * .25 - 150, w: 240, h: 300, id: 'pause', fn: () => (modal === 'pause' ? closeModal() : openModal('pause')) });
    iconPause(p.ctx, W / 2, H * .25, kP, p.hover === 'pause');
  }
  const ay = havePause ? H * .75 : H * .25;
  p.hits.push({ x: W / 2 - 140, y: ay - 160, w: 280, h: 320, id: 'access', fn: () => (modal === 'a11y' ? a11yBack() : openModal('a11y', modal === 'pause' ? 'pause' : null)) });
  iconAccess(p.ctx, W / 2, ay, kA, p.hover === 'access');
}, 340);
hud.noScale = true;
function frontOf(mesh, dist, dy = 0) {
  camera.updateWorldMatrix(true, false);
  camera.getWorldPosition(o3); camera.getWorldDirection(d3); d3.y = 0;
  if (d3.lengthSq() < 1e-4) d3.set(0, 0, -1);
  d3.normalize();
  mesh.position.set(o3.x + d3.x * dist, o3.y + dy, o3.z + d3.z * dist);
  mesh.lookAt(o3.x, mesh.position.y, o3.z);
}
function hudPlace() {
  if ((cur === 'cafe' || cur === 'desk') && choices.mesh.visible) { // dock on the right-hand edge of the reply panel
    const m = choices.mesh, k = m.scale.x;
    hud.mesh.quaternion.copy(m.quaternion);
    hud.mesh.position.copy(m.position)
      .addScaledVector(d3.set(1, 0, 0).applyQuaternion(m.quaternion), .75 * k + .12)
      .addScaledVector(w3.set(0, 1, 0).applyQuaternion(m.quaternion), .65 * k - .2 - .02);
    return;
  }
  camera.updateWorldMatrix(true, false);
  camera.getWorldPosition(o3); camera.getWorldDirection(d3); d3.y = 0;
  if (d3.lengthSq() < 1e-4) d3.set(0, 0, -1);
  d3.normalize();
  hud.mesh.position.set(o3.x + d3.x * 1.1 - d3.z * .68, o3.y + .42, o3.z + d3.z * 1.1 + d3.x * .68);
  hud.mesh.lookAt(o3.x, hud.mesh.position.y, o3.z);
}

/* ---------- pause + settings screens (Figma: pale full-view overlay, frosted globe, plain text) ---------- */
const ovTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 512);
  [[0, '#E3F0F2'], [.45, '#EDFAFB'], [.7, '#E6F4F5'], [1, '#D5DEE1']].forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const ovDome = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ map: ovTex, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
ovDome.renderOrder = -100; ovDome.frustumCulled = false;
const ovGlobe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55, depthTest: false, depthWrite: false, toneMapped: false }));
ovGlobe.renderOrder = -90; ovGlobe.scale.setScalar(.4); ovGlobe.frustumCulled = false;
const ov = new THREE.Group(); ov.add(ovDome, ovGlobe); ov.visible = false; scene.add(ov);
const GREY = '#6f6f6f';
function arrowL(c, x, y, w, col) {
  c.strokeStyle = col; c.lineWidth = 3.5; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x + w, y); c.lineTo(x, y); c.moveTo(x + 18, y - 17); c.lineTo(x, y); c.lineTo(x + 18, y + 17); c.stroke();
}
const pauseP = new Panel(.9, .7, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height, cy = H / 2;
  arrowL(c, W / 2 - 88, cy - 135, 52, p.hover === 'exit' ? COL.teal : '#1a1a1a');
  p.vtext('EXIT', W / 2 - 8, cy - 135, 44, p.hover === 'exit' ? COL.teal : GREY, 400, 300, 'left');
  p.vtext('Paused', W / 2, cy, 92, COL.teal, 700, W, 'center');
  p.vtext('RESUME', W / 2, cy + 135, 44, p.hover === 'resume' ? COL.teal : GREY, 400, 400, 'center');
  p.hits.push({ x: W / 2 - 140, y: cy - 190, w: 280, h: 110, id: 'exit', fn: goHome });
  p.hits.push({ x: W / 2 - 170, y: cy + 80, w: 340, h: 110, id: 'resume', fn: closeModal });
});
const playP = new Panel(.2, .2, (p) => {
  const c = p.ctx, hv = p.hover === 'play';
  c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = '#5D9FA3'; c.fillStyle = hv ? '#B4EDF1' : '#CDF5F7';
  c.beginPath(); c.moveTo(78, 52); c.lineTo(78, 204); c.lineTo(210, 128); c.closePath(); c.fill(); c.stroke();
  p.hits.push({ x: 40, y: 30, w: 190, h: 200, id: 'play', fn: closeModal });
}, 256);
const A_ROWS = [['en', 'English translations', 'Show English under every French line'], ['big', 'Larger panels', 'Make cards and menus bigger'], ['slow', 'Slower speech', 'The barista speaks more slowly'], ['seat', 'Seated mode', 'Raises your view if you are sitting'], ['calm', 'Reduce motion', 'No screen fades between scenes']];
const CATS = [['ACCESSIBILITY', 'Accessibility', ['seat', 'calm']], ['DISPLAY', 'Display', ['big']], ['LANGUAGE', 'Language', ['en']], ['DIFFICULTY', 'Difficulty', ['slow']]];
let a11yCat = null;
const a11yBack = () => { if (a11yCat !== null) { a11yCat = null; a11yP.render(); } else if (a11yFrom === 'pause') openModal('pause'); else closeModal(); };
const a11yP = new Panel(.9, .9, (p) => {
  const c = p.ctx, W = p.cv.width, cx = W / 2, cat = a11yCat === null ? null : CATS[a11yCat];
  arrowL(c, cx - 26, 150, 52, p.hover === 'back' ? COL.teal : '#1a1a1a');
  p.hits.push({ x: cx - 90, y: 95, w: 180, h: 110, id: 'back', fn: a11yBack });
  p.vtext(cat ? cat[1] : 'Accessibility', cx, 330, 92, COL.teal, 700, W, 'center');
  if (!cat) CATS.forEach(([label], i) => {
    const y = 490 + i * 100;
    p.vtext(label, cx, y, 44, p.hover === 'c' + i ? COL.teal : GREY, 400, W, 'center');
    p.hits.push({ x: cx - 260, y: y - 45, w: 520, h: 90, id: 'c' + i, fn: () => { a11yCat = i; p.render(); } });
  });
  else cat[2].forEach((k, i) => {
    const row = A_ROWS.find((r) => r[0] === k), y = 480 + i * 200, on = A[k], hv = p.hover === 'k' + k;
    p.vtext(row[1].toUpperCase(), cx, y, 44, hv ? COL.teal : GREY, 400, W - 120, 'center');
    p.vtext(on ? 'ON' : 'OFF', cx, y + 62, 40, on ? COL.teal : '#9aa8ad', 700, W, 'center');
    p.vtext(row[2], cx, y + 118, 28, '#8a979c', 400, W - 160, 'center');
    p.hits.push({ x: 90, y: y - 50, w: W - 180, h: 190, id: 'k' + k, fn: () => { A[k] = !A[k]; applyA(); } });
  });
});
pauseP.noScale = a11yP.noScale = playP.noScale = true;
let modalHid = [];
function ovPlace() {
  camera.updateWorldMatrix(true, false); camera.getWorldPosition(o3); camera.getWorldDirection(d3); d3.y = 0;
  if (d3.lengthSq() < 1e-4) d3.set(0, 0, -1);
  d3.normalize();
  const rx = -d3.z, rz = d3.x, hy = o3.y, hx = o3.x, hz = o3.z;
  ov.position.set(hx, hy, hz);
  ovGlobe.position.set(d3.x * 1.7 + rx * .5, 0, d3.z * 1.7 + rz * .5);
  ovGlobe.quaternion.copy(globe.quaternion);
  if (globe.material.map) ovGlobe.material.map = globe.material.map;
  ovGlobe.material.needsUpdate = true;
  [pauseP, a11yP].forEach((q) => { q.mesh.position.set(hx + d3.x * 1.5 - rx * .5, hy, hz + d3.z * 1.5 - rz * .5); q.mesh.lookAt(hx, hy, hz); q.mesh.scale.setScalar(A.big ? 1.45 : 1.25); });
  const gx = hx + ovGlobe.position.x, gz = hz + ovGlobe.position.z, dx = hx - gx, dz = hz - gz, dl = Math.hypot(dx, dz);
  playP.mesh.position.set(gx + dx / dl * .44, hy, gz + dz / dl * .44); playP.mesh.lookAt(hx, hy, hz);
}
function modalRestore() {
  modalHid.forEach((o) => { o.visible = true; }); modalHid = [];
  ov.visible = false; pauseP.mesh.visible = a11yP.mesh.visible = playP.mesh.visible = false;
}
function openModal(kind, from) {
  stopListening();
  if (!modal) {
    try { synth && synth.pause(); curAudio && curAudio.pause(); } catch (e) {}
    const keep = new Set([ov, hud.mesh, pauseP.mesh, a11yP.mesh, playP.mesh, rig]);
    modalHid = scene.children.filter((o) => o.visible && !keep.has(o));
    modalHid.forEach((o) => { o.visible = false; });
    ovPlace();
  }
  modal = kind; paused = true; a11yFrom = from || null; a11yCat = null;
  ov.visible = true;
  pauseP.mesh.visible = playP.mesh.visible = kind === 'pause'; a11yP.mesh.visible = kind === 'a11y';
  hudPlace(); hud.render(); (kind === 'pause' ? pauseP : a11yP).render(); playP.render();
}
function closeModal() {
  modal = null; paused = false; modalRestore(); hudPlace(); hud.render();
  try {
    synth && synth.resume();
    if (curAudio && curAudio.paused && !curAudio.ended && curAudio.currentTime > 0) curAudio.play().catch(() => {});
  } catch (e) {}
  pend.splice(0).forEach((f) => f());
}
function goHome() {
  modal = null; paused = false; modalRestore(); hud.render();
  epoch++; pend.length = 0; talking = false;
  try { synth && synth.cancel(); curAudio && curAudio.pause(); } catch (e) {}
  resetCup(); resetPay(); fadeT = null; fade.material.opacity = 0;
  dState = 'lang'; gFocus = null; gSpin = true; selLoc = -1; transition(() => setScene('dash'));
}
function applyA() {
  panels.forEach((p) => { if (!p.noScale) p.mesh.scale.setScalar(A.big ? 1.25 : 1); });
  rig.position.y = A.seat ? .4 : 0;
  hudPlace();
  [bubble, choices, a11yP, pauseP].forEach((p) => p.mesh.visible && p.render());
  try { localStorage.setItem('fvr-a11y', JSON.stringify(A)); } catch (e) {}
}

/* ---------- payment: tap your card on the terminal ---------- */
const PAY_Z = -1.4;
const v3 = new THREE.Vector3(), w3 = new THREE.Vector3();
let payOn = false, payDone = true, payHolder = null, payNear = 0, mouseTerm = null, actx = null;
const card3d = room.makeCard();
const payHint = new Panel(.8, .3, (p) => {
  const W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 34, 'rgba(244,251,252,.96)', COL.line);
  p.text('Tap your card on the terminal to pay.', 40, 28, 40, COL.teal, 700, W - 80);
  p.text('You can also point at the terminal and pull the trigger.', 40, 96, 28, COL.grey, 400, W - 80);
  p.btn(W - 280, H - 100, 240, 76, 'Skip', 'skiptap', tapDone);
});
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(1046, n); o.frequency.setValueAtTime(1568, n + .12);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.25, n + .01); g.gain.exponentialRampToValueAtTime(.0001, n + .34);
    o.connect(g); g.connect(actx.destination); o.start(n); o.stop(n + .36);
  } catch (e) {}
}
function pickHand() {
  if (!renderer.xr.isPresenting) return 'mouse';
  return ctrls.find((c) => c.userData.src && c.userData.src.handedness === 'right') || ctrls.find((c) => c.userData.src) || ctrls[1];
}
function startPayment(p) {
  busy = true; payDone = false;
  transition(() => {
    rig.position.z = PAY_Z; hudPlace();
    choices.mesh.visible = false;
    room.terminal.setState('pay');
    payHolder = pickHand(); payNear = 0; payOn = true;
    if (payHolder === 'mouse') { camera.add(card3d); card3d.position.set(.2, -.2, -.55); card3d.rotation.set(1.0, 0, -.15); card3d.scale.setScalar(1.5); }
    else { payHolder.add(card3d); card3d.position.set(0, -.012, -.1); card3d.rotation.set(0, 0, 0); card3d.scale.setScalar(1); }
    payHint.mesh.position.set(.3, 1.5, -2.05); payHint.mesh.lookAt(0, 1.5, PAY_Z); payHint.mesh.visible = true; payHint.render();
    bubbleFr = p.fr; bubbleEn = p.en; showEn = true; talking = true; bubble.render();
    speak(p.fr, 'audio/pay.mp3', () => { talking = false; });
  });
}
function tapDone() {
  if (!payOn || payDone) return;
  payDone = true;
  room.terminal.setState('ok'); beep();
  try { if (payHolder && payHolder !== 'mouse') payHolder.userData.src.gamepad.hapticActuators[0].pulse(.8, 120); } catch (e) {}
  payHint.mesh.visible = false;
  bubbleFr = 'Parfait, c’est approuvé. Merci!'; bubbleEn = 'Perfect, it’s approved. Thank you!'; showEn = true; talking = true; bubble.render();
  speak(bubbleFr, 'audio/pay_ok.mp3', () => { talking = false; });
  later(2800, endPayment);
}
function endPayment() {
  transition(() => {
    rig.position.z = 0; hudPlace(); card3d.removeFromParent(); payOn = false; payHolder = null;
    room.terminal.setState('idle'); room.terminal.ring.visible = false;
    startTurn();
  });
}
function resetPay() {
  payOn = false; payDone = true; payHolder = null; payNear = 0;
  rig.position.z = 0; card3d.removeFromParent(); payHint.mesh.visible = false;
  room.terminal.setState('idle'); room.terminal.ring.visible = false;
}

/* ---------- scene fade ---------- */
const fade = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false }));
fade.position.z = -.3; fade.renderOrder = 999; camera.add(fade);
let fadeT = null;
function transition(fn) { if (A.calm) return fn(); if (!fadeT) fadeT = { t: 0, fn, done: false }; }

/* ---------- pointing: VR controllers / hands + mouse preview ---------- */
const ray = new THREE.Raycaster();
const tmpM = new THREE.Matrix4(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const intersect = () => ray.intersectObjects(panels.filter((p) => shown(p.mesh)).map((p) => p.mesh), false)[0];
const clickHit = (h) => { const p = h.object.userData.panel; if (modal && p !== hud && p !== pauseP && p !== a11yP && p !== playP) return; const b = p.at(h.uv); if (b) b.fn(); };

let gCtl = null, mouseGlobe = null;
const ctrls = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x1F9AA0 }));
  line.scale.z = 2; c.add(line); c.userData.line = line;
  c.addEventListener('connected', (e) => { c.userData.src = e.data; });
  c.addEventListener('selectstart', () => {
    if (!paused && c.userData.cup) return grabCup(c);
    if (!paused && c.userData.term) return tapDone();
    if (c.userData.hit) return clickHit(c.userData.hit);
    if (c.userData.globe && !modal) { const pt = c.userData.globe.point; gCtl = { c, last: gDir(pt), start: pt.clone(), moved: 0 }; }
  });
  c.addEventListener('selectend', () => { if (gCtl && gCtl.c === c) { if (gCtl.moved < .05) globeClick(gCtl.start); gCtl = null; } });
  rig.add(c);
  return c;
});

{ // show the real controllers / hands in VR
  const cmf = new XRControllerModelFactory(), hmf = new XRHandModelFactory();
  [0, 1].forEach((i) => {
    try { const g = renderer.xr.getControllerGrip(i); g.add(cmf.createControllerModel(g)); rig.add(g); } catch (e) {}
    try { const h = renderer.xr.getHand(i); h.add(hmf.createHandModel(h, 'mesh')); rig.add(h); } catch (e) {}
  });
}

const mouse = new THREE.Vector2(); let mouseOn = false, mouseHit = null, drag = null;
addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseOn = true;
  if (drag && drag.globe && !renderer.xr.isPresenting) {
    drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
    ray.setFromCamera(mouse, camera);
    if (drag.moved >= 6) globeDrag(drag, ray.intersectObject(globe, false)[0]?.point);
  } else if (drag && !renderer.xr.isPresenting) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
    camera.rotation.y += dx * .004; camera.rotation.x = Math.max(-1, Math.min(1, camera.rotation.x + dy * .004));
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: 0, globe: !!(mouseGlobe && !mouseHit && !modal) };
  if (drag.globe) drag.last = gDir(mouseGlobe.point);
});
addEventListener('pointerup', () => { if (drag && drag.moved < 6 && !renderer.xr.isPresenting) { if (!paused && mouseCup) grabCup(null); else if (!paused && mouseTerm) tapDone(); else if (mouseHit) clickHit(mouseHit); else if (drag.globe && mouseGlobe) globeClick(mouseGlobe.point); } drag = null; });

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
let shadowTick = 0;
document.fonts && document.fonts.ready.then(() => { panels.forEach((p) => p.mesh.visible && p.render()); room.refresh(); });
applyA();
boot();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .1) * (paused ? 0 : 1), t = clock.elapsedTime, talkNow = talking && !paused;
  const want = new Map();
  for (const c of ctrls) {
    tmpM.identity().extractRotation(c.matrixWorld);
    o3.setFromMatrixPosition(c.matrixWorld); d3.set(0, 0, -1).applyMatrix4(tmpM);
    ray.set(o3, d3);
    const h = renderer.xr.isPresenting ? intersect() : null;
    c.userData.hit = h; c.userData.line.scale.z = h ? h.distance : 2;
    c.userData.cup = cupLive && renderer.xr.isPresenting ? ray.intersectObject(cupGrab, false)[0] || null : null;
    c.userData.globe = !h && cur === 'dash' && !paused && renderer.xr.isPresenting ? ray.intersectObject(globe, false)[0] || null : null;
    c.userData.term = payOn && !payDone && renderer.xr.isPresenting ? ray.intersectObject(room.terminal.hit, false)[0] || null : null;
    if (h) { const p = h.object.userData.panel, b = p.at(h.uv); want.set(p, b ? b.id : null); }
  }
  mouseHit = null; mouseCup = null; mouseTerm = null; mouseGlobe = null;
  if (mouseOn && !renderer.xr.isPresenting) {
    ray.setFromCamera(mouse, camera);
    mouseHit = intersect() || null;
    if (cupLive) mouseCup = ray.intersectObject(cupGrab, false)[0] || null;
    if (payOn && !payDone) mouseTerm = ray.intersectObject(room.terminal.hit, false)[0] || null;
    if (cur === 'dash' && !paused) mouseGlobe = ray.intersectObject(globe, false)[0] || null;
    if (mouseHit) { const p = mouseHit.object.userData.panel, b = p.at(mouseHit.uv); want.set(p, b ? b.id : null); }
    renderer.domElement.style.cursor = (mouseHit && want.get(mouseHit.object.userData.panel)) || mouseCup || mouseTerm ? 'pointer' : mouseGlobe && !mouseHit ? (drag && drag.globe ? 'grabbing' : 'grab') : 'default';
  }
  panels.forEach((p) => { if (p.mesh.visible) p.setHover(want.get(p) ?? null); });

  room.update(t);
  if ((shadowTick = (shadowTick + 1) % 6) === 0) renderer.shadowMap.needsUpdate = true;
  if (mixer) mixer.update(dt);
  if (payOn && !payDone && !paused) {
    let near = false;
    if (payHolder && payHolder !== 'mouse') { room.terminal.anchor.getWorldPosition(w3); card3d.getWorldPosition(v3); near = v3.distanceTo(w3) < .13; }
    payNear = near ? payNear + dt : Math.max(0, payNear - dt * 2);
    room.terminal.tick(t, true, near);
    if (payNear > .3) tapDone();
  } else room.terminal.tick(t, false, false);
  barista.position.y = Math.sin(t * 1.5) * .005;
  head.rotation.z = talkNow ? Math.sin(t * 7) * .05 : Math.sin(t * .8) * .02;
  mouth.scale.y = talkNow ? 1 + Math.abs(Math.sin(t * 14)) * 5 : 1;

  if (cupHeld) {
    if (cupHeld === 'mouse') cupT.set(.2, -.25, -.55).applyMatrix4(camera.matrixWorld); else cupT.set(0, -.04, -.12).applyMatrix4(cupHeld.matrixWorld);
    cupG.position.lerp(cupT, Math.min(1, dt * 10));
  }
  cupMat.emissive.set(cupLive && (mouseCup || ctrls.some((c) => c.userData.cup)) ? '#1F9AA0' : '#000000');
  rec.head.rotation.z = talkNow ? Math.sin(t * 7) * .05 : 0;
  rec.mouth.scale.y = talkNow ? 1 + Math.abs(Math.sin(t * 14)) * 5 : 1;
  if (gCtl) {
    const h = gCtl.c.userData.globe;
    if (h) gCtl.moved += globeDrag(gCtl, h.point); else gCtl.last = null;
  }
  if (globe.visible) {
    if (gFocus) { globe.quaternion.slerp(gFocus, 1 - Math.exp(-dt * 4)); if (globe.quaternion.angleTo(gFocus) < .002) gFocus = null; }
    else if (gSpin && !gCtl && !(drag && drag.globe)) globe.rotateY(dt * .08);
  }
  const dd = cur === 'dash';
  marker.visible = dd && selLoc >= 0 && dState !== 'lang';
  locDots.visible = dd && (dState === 'loc' || dState === 'locall');
  if (marker.visible) {
    markerT = Math.min(1, markerT + dt / .9);
    const e = 1 - Math.pow(1 - markerT, 3);
    marker.scale.setScalar(.6 + .4 * e);
    [mHalo, mRing, mDot].forEach((m) => { m.material.opacity = m.userData.op * e; });
    mHalo.scale.setScalar(1 + (markerT >= 1 ? Math.sin(t * 2.2) * .05 : 0));
  }
  let spun = false;
  for (const k in cs) { const q = cs[k]; if (Math.abs(q.tgt - q.cur) > .5) { q.cur += (q.tgt - q.cur) * Math.min(1, dt * 10); spun = spun || dt > 0; } else q.cur = q.tgt; }
  if (spun && dash.mesh.visible) dash.render();
  if (fadeT) {
    fadeT.t += dt;
    const a = fadeT.t < .4 ? fadeT.t / .4 : 1 - (fadeT.t - .4) / .4;
    fade.material.opacity = Math.max(0, Math.min(1, a));
    if (!fadeT.done && fadeT.t >= .4) { fadeT.fn(); fadeT.done = true; }
    if (fadeT.t >= .8) { fade.material.opacity = 0; fadeT = null; }
  }
  renderer.render(scene, camera);
});
