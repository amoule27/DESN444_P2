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
  btn(x, y, w, h, label, id, fn) {
    const hv = this.hover === id;
    this.rr(x, y, w, h, 18, hv ? '#D4F5F7' : COL.mint, hv ? COL.teal : COL.line);
    this.text(label, x + w / 2, y + (h - 42) / 2, 34, COL.ink, 600, w - 20, 'center');
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
let listening = false;
const choices = new Panel(1.5, 1.3, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 40, 'rgba(244,251,252,.95)', COL.line);
  p.text('Choose the reply you believe best fits.', 48, 40, 40, COL.teal, 700, W - 96);
  order_ = order;
  order.forEach((o, i) => {
    const y = 150 + i * 148, hv = p.hover === 'o' + i, hl = reveal && o.ok;
    p.rr(40, y, W - 80, 130, 22, hv ? COL.mint : '#fff', hl ? COL.ok : hv ? COL.teal : COL.line, hl ? 6 : 3);
    speakerIcon(c, 70, y + 35, 60, p.hover === 's' + i ? COL.ok : COL.teal);
    if (A.en) { const e = p.text(o.fr, 160, y + 12, 30, COL.ink, 500, W - 240); p.text(o.en, 160, e + 2, 24, COL.grey, 400, W - 240); }
    else p.text(o.fr, 160, y + 20, 36, COL.ink, 500, W - 240);
    p.hits.push({ x: 56, y: y + 10, w: 96, h: 110, id: 's' + i, fn: () => speak(o.fr, o.audio) });
    p.hits.push({ x: 40, y, w: W - 80, h: 130, id: 'o' + i, fn: () => pick(o) });
  });
  p.text(msg.t, 48, 600, 30, msg.c, 600, W - 96);
  const mh = p.hover === 'mic', mc = listening ? COL.bad : COL.teal;
  if (listening) { c.beginPath(); c.arc(100, H - 82, 60, 0, Math.PI * 2); c.strokeStyle = 'rgba(192,72,59,.35)'; c.lineWidth = 8; c.stroke(); }
  c.beginPath(); c.arc(100, H - 82, 48, 0, Math.PI * 2); c.fillStyle = listening ? '#FBE3E0' : mh ? '#D4F5F7' : COL.mint; c.fill();
  c.strokeStyle = listening ? COL.bad : mh ? COL.teal : COL.line; c.lineWidth = 4; c.stroke();
  micIcon(c, 100, H - 82, 80, mc);
  p.text(listening ? 'Listening… tap to stop' : 'Tap to speak', 176, H - 100, 30, listening ? COL.bad : COL.grey, 600, W - 620);
  p.hits.push({ x: 50, y: H - 132, w: 100, h: 100, id: 'mic', fn: toggleMic });
  p.btn(W - 400, H - 130, 360, 90, 'Skip. Not sure.', 'skip', skip);
}).place(1.05, 1.3, -1.45);

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
  let best = null, bs = 0;
  order.forEach((o) => alts.forEach((a) => { const sc = sim(a, o.fr); if (sc > bs) { bs = sc; best = o; } }));
  if (best && bs >= .6) pick(best, alts[0]);
  else wrong(`I heard “${alts[0]}”, which doesn’t match a reply. Tap a speaker icon to hear them, then try again.`);
}
function toggleMic() {
  if (busy || paused || modal) return;
  if (listening) { stopListening(); msg = { t: '', c: COL.grey }; return choices.render(); }
  if (!SR) { msg = { t: 'Voice is not supported in this browser. Point and pull the trigger on a reply.', c: COL.bad }; return choices.render(); }
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
  r.onerror = (e) => { if (srec !== r) return; got = true; stopListening(); msg = { t: micError(e.error), c: e.error === 'no-speech' ? COL.grey : COL.bad }; choices.render(); };
  r.onend = () => { if (srec !== r) return; stopListening(); if (!got) { msg = { t: micError('no-speech'), c: COL.grey }; choices.render(); } };
  try {
    r.start();
    listening = true;
    msg = { t: 'Listening… say your reply in French.', c: COL.teal };
    recTimer = setTimeout(() => { if (srec === r) { try { r.stop(); } catch (e) {} } }, 9000);
  } catch (e) { srec = null; msg = { t: micError('other'), c: COL.bad }; }
  choices.render();
}

/* ---------- dialogue flow ---------- */
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const renderAll = () => { bubble.render(); choices.render(); };

function startTurn() {
  const t = LINES[turn];
  stopListening();
  tries = 0; reveal = false; showEn = false; busy = false; msg = { t: '', c: COL.grey };
  order = shuffle(t.options.map((o, i) => ({ ...o, audio: `audio/${ap()}_opt${i + 1}.mp3` })));
  bubbleFr = t.fr; bubbleEn = t.en; talking = true;
  cupG.visible = mode === 'cafe' && turn === LINES.length - 1;
  bubble.mesh.visible = choices.mesh.visible = true;
  renderAll();
  speak(t.fr, `audio/${ap()}_barista.mp3`, () => { talking = false; });
}
function pick(o, heard) {
  if (busy) return;
  stopListening();
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
  tries++; showEn = tries >= 2; talking = true;
  bubbleFr = 'Pardon? Je n’ai pas compris.'; bubbleEn = 'Sorry? I didn’t understand.';
  msg = { t: text, c: COL.bad };
  renderAll();
  speak(bubbleFr, 'audio/pardon.mp3', () => { talking = false; bubbleFr = t.fr; bubbleEn = t.en; bubble.render(); });
}
function skip() {
  if (busy) return;
  stopListening();
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
let cur = 'load', dState = 'lang', pLearn = -1, pMod = -1, mode = 'cafe', dMsg = '', gT = null;
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
const LA = 45.5 * Math.PI / 180, LO = -73.6 * Math.PI / 180;
const pin = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff4b3e' }));
pin.position.set(Math.cos(LA) * Math.cos(LO), Math.sin(LA), -Math.cos(LA) * Math.sin(LO)).multiplyScalar(1.01);
pin.visible = false; globe.add(pin);
const grid = new THREE.GridHelper(40, 40, '#b8c2c9', '#cdd5da'); grid.visible = false; scene.add(grid);

const FLAGS = [['German', ['#000', '#d00', '#fc0'], 1], ['French', ['#0055a4', '#fff', '#ef4135'], 0], ['Spanish', ['#c60b1e', '#ffc400', '#c60b1e'], 1], ['Italian', ['#009246', '#fff', '#ce2b37'], 0]];
const LEARN = ['How to address people', 'How to order with confidence', 'How to ask for directions'];
const LEARN_SUB = ['Pronouns, adjectives, greetings.', 'Quantities, etiquette, modifiers.', 'Streets, landmarks, transit.'];
const MODS = ['Explore a quiet neighbourhood in Montréal and practice ordering at a café.', 'Walk through old town Montréal and practice your skills at a sit-down diner.', 'Explore a local Montréal gift shop and practice asking for specific items.'];
const gs = (s) => { dState = s; dMsg = ''; dash.render(); };
function list(p, items, subs, sel, y0, h, pickFn, enabled = () => true) {
  const c = p.ctx, W = p.cv.width;
  items.forEach((t, i) => {
    const y = y0 + i * (h + 16), hv = p.hover === 'r' + i, ok = enabled(i);
    p.rr(44, y, W - 88, h, 20, hv && ok ? COL.mint : '#fff', sel === i ? COL.teal : COL.line, sel === i ? 6 : 3);
    p.text(t, 76, y + (subs ? 16 : 22), 36, ok ? COL.ink : '#9aa8ad', 500, W - 220);
    if (subs) p.text(subs[i], 76, y + 66, 30, COL.grey);
    c.beginPath(); c.arc(W - 100, y + h / 2, 22, 0, 7); c.strokeStyle = COL.line; c.lineWidth = 4; c.stroke();
    if (sel === i) { c.beginPath(); c.arc(W - 100, y + h / 2, 12, 0, 7); c.fillStyle = COL.teal; c.fill(); }
    p.hits.push({ x: 44, y, w: W - 88, h, id: 'r' + i, fn: () => pickFn(i) });
  });
}
const dash = new Panel(1.6, 1.45, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 40, 'rgba(240,245,247,.96)', COL.line);
  p.text('Welcome, Alex', 44, 34, 58, COL.ink, 700);
  p.rr(560, 40, 420, 70, 35, '#fff', COL.line); p.text('Find a destination.', 600, 58, 32, '#9aa8ad');
  const back = (t) => {
    p.text('←', 44, 150, 44, COL.ink, 600); p.text(t, 110, 156, 34, COL.grey, 500, W - 160);
    p.hits.push({ x: 30, y: 140, w: 80, h: 70, id: 'back', fn: () => gs(dState === 'mods' ? 'learn' : 'lang') });
  };
  if (dState === 'lang') {
    p.text('Discover locations by language', 44, 160, 36, COL.ink, 700);
    p.text('Select a language to view destinations on the globe.', 44, 210, 30, COL.grey);
    FLAGS.forEach(([n, cs, hz], i) => {
      const x = 44 + i * 240, y = 290, hv = p.hover === 'f' + i;
      p.rr(x, y, 220, 230, 20, hv ? COL.mint : '#fff', hv ? COL.teal : COL.line);
      cs.forEach((col, k) => { c.fillStyle = col; if (hz) c.fillRect(x + 20, y + 24 + k * 40, 180, 40); else c.fillRect(x + 20 + k * 60, y + 24, 60, 120); });
      c.strokeStyle = '#d5dcdf'; c.lineWidth = 2; c.strokeRect(x + 20, y + 24, 180, 120);
      p.text(n, x + 110, y + 168, 34, COL.ink, 500, 200, 'center');
      p.hits.push({ x, y, w: 220, h: 230, id: 'f' + i, fn: () => {
        if (i !== 1) { dMsg = 'Only French is available in this prototype.'; return dash.render(); }
        const ty = -Math.PI / 2 - LO;
        globe.rotation.y = ty + ((globe.rotation.y - ty + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        gT = { x: LA, y: ty }; pin.visible = true; gs('learn');
      } });
    });
  } else if (dState === 'learn') {
    back('What do you want to learn?');
    list(p, LEARN, LEARN_SUB, pLearn, 230, 120, (i) => { pLearn = i; dMsg = ''; dash.render(); });
    p.btn(44, H - 150, 300, 90, 'Continue', 'go', () => { if (pLearn < 0) { dMsg = 'Choose a topic to continue.'; dash.render(); } else gs('mods'); });
  } else {
    back('Suggested modules according to your learning goals.');
    list(p, MODS, null, pMod, 230, 160, (i) => { if (i === 0) { pMod = 0; dMsg = ''; } else dMsg = 'Coming soon. This prototype has the café module only.'; dash.render(); }, (i) => i === 0);
    p.btn(44, H - 150, 300, 90, 'Continue', 'go', () => { if (pMod === 0) toDesk(); else { dMsg = 'Choose a module to continue.'; dash.render(); } });
  }
  p.text(dMsg, dState === 'lang' ? 44 : 380, dState === 'lang' ? 560 : H - 130, 30, COL.bad, 600, W - 440);
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
function iconPause(c, cx, cy, s, col) {
  c.fillStyle = col;
  c.beginPath(); c.roundRect(cx - s * .32, cy - s * .36, s * .24, s * .72, s * .07); c.fill();
  c.beginPath(); c.roundRect(cx + s * .08, cy - s * .36, s * .24, s * .72, s * .07); c.fill();
}
function iconAccess(c, cx, cy, s, col) {
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = s * .12;
  c.beginPath(); c.arc(cx, cy - s * .38, s * .12, 0, 7); c.fill();
  c.beginPath(); c.moveTo(cx - s * .42, cy - s * .16); c.lineTo(cx, cy - s * .05); c.lineTo(cx + s * .42, cy - s * .16); c.stroke();
  c.beginPath(); c.moveTo(cx, cy - s * .05); c.lineTo(cx, cy + s * .14); c.stroke();
  c.beginPath(); c.moveTo(cx - s * .3, cy + s * .44); c.lineTo(cx, cy + s * .14); c.lineTo(cx + s * .3, cy + s * .44); c.stroke();
}
const HUD_PAUSE = ['deskintro', 'desk', 'level', 'street', 'cafe', 'result'];
const hudOn = () => HUD_PAUSE.includes(cur) || cur === 'dash';
const hud = new Panel(.34, .14, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height, cy = H / 2, R = 150;
  const draw = (cx, id, icon, fn) => {
    const hv = p.hover === id;
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = hv ? 'rgba(31,154,160,.95)' : 'rgba(18,30,36,.55)'; c.fill();
    c.lineWidth = 7; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
    icon(c, cx, cy, R * 1.15, '#ffffff');
    p.hits.push({ x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, id, fn });
  };
  if (HUD_PAUSE.includes(cur)) draw(W * .3, 'pause', iconPause, () => (modal === 'pause' ? closeModal() : openModal('pause')));
  draw(W * .74, 'access', iconAccess, () => (modal === 'a11y' ? closeModal() : openModal('a11y')));
});
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
  camera.updateWorldMatrix(true, false);
  camera.getWorldPosition(o3); camera.getWorldDirection(d3); d3.y = 0;
  if (d3.lengthSq() < 1e-4) d3.set(0, 0, -1);
  d3.normalize();
  hud.mesh.position.set(o3.x + d3.x * 1.1 - d3.z * .68, o3.y + .42, o3.z + d3.z * 1.1 + d3.x * .68);
  hud.mesh.lookAt(o3.x, hud.mesh.position.y, o3.z);
}

/* ---------- pause menu + accessibility panel ---------- */
const pauseP = new Panel(.9, .64, (p) => {
  const W = p.cv.width;
  p.rr(4, 4, W - 8, p.cv.height - 8, 44, 'rgba(255,255,255,.98)', COL.line);
  p.text('Paused', W / 2, 44, 64, COL.teal, 700, W, 'center');
  p.text('Nothing moves while you are paused. Take your time.', W / 2, 130, 30, COL.grey, 400, W - 140, 'center');
  p.btn(80, 220, W - 160, 100, 'Resume', 'resume', closeModal);
  p.btn(80, 345, W - 160, 100, 'Accessibility settings', 'acc', () => openModal('a11y', 'pause'));
  p.btn(80, 470, W - 160, 100, 'Back to dashboard', 'home', goHome);
});
const A_ROWS = [['en', 'English translations', 'Show English under every French line'], ['big', 'Larger panels', 'Make cards and menus bigger'], ['slow', 'Slower speech', 'The barista speaks more slowly'], ['seat', 'Seated mode', 'Raises your view if you are sitting'], ['calm', 'Reduce motion', 'No screen fades between scenes']];
const a11yP = new Panel(1.0, .98, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 44, 'rgba(255,255,255,.98)', COL.line);
  p.text('Accessibility', W / 2, 36, 60, COL.teal, 700, W, 'center');
  A_ROWS.forEach(([k, t, sub], i) => {
    const y = 130 + i * 140, hv = p.hover === 'k' + k;
    p.rr(40, y, W - 80, 120, 22, hv ? COL.mint : '#fff', hv ? COL.teal : COL.line);
    p.text(t, 70, y + 18, 38, COL.ink, 600, W - 300);
    p.text(sub, 70, y + 68, 26, COL.grey, 400, W - 300);
    const on = A[k], sx = W - 190, sy = y + 30;
    p.rr(sx, sy, 110, 60, 30, on ? COL.teal : '#c9d3d6');
    c.beginPath(); c.arc(on ? sx + 80 : sx + 30, sy + 30, 24, 0, 7); c.fillStyle = '#fff'; c.fill();
    p.hits.push({ x: 40, y, w: W - 80, h: 120, id: 'k' + k, fn: () => { A[k] = !A[k]; applyA(); } });
  });
  p.btn(W / 2 - 200, H - 130, 400, 90, 'Done', 'done', () => (a11yFrom === 'pause' ? openModal('pause') : closeModal()));
});
pauseP.noScale = a11yP.noScale = true;
function openModal(kind, from) {
  stopListening();
  modal = kind; paused = true; a11yFrom = from || null;
  try { synth && synth.pause(); curAudio && curAudio.pause(); } catch (e) {}
  pauseP.mesh.visible = kind === 'pause'; a11yP.mesh.visible = kind === 'a11y';
  const p = kind === 'pause' ? pauseP : a11yP;
  frontOf(p.mesh, 1.0); p.render();
}
function closeModal() {
  modal = null; paused = false; pauseP.mesh.visible = a11yP.mesh.visible = false;
  try {
    synth && synth.resume();
    if (curAudio && curAudio.paused && !curAudio.ended && curAudio.currentTime > 0) curAudio.play().catch(() => {});
  } catch (e) {}
  pend.splice(0).forEach((f) => f());
}
function goHome() {
  modal = null; paused = false; pauseP.mesh.visible = a11yP.mesh.visible = false;
  epoch++; pend.length = 0; talking = false;
  try { synth && synth.cancel(); curAudio && curAudio.pause(); } catch (e) {}
  resetCup(); resetPay(); fadeT = null; fade.material.opacity = 0;
  dState = 'lang'; gT = null; transition(() => setScene('dash'));
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
const clickHit = (h) => { const p = h.object.userData.panel; if (modal && p !== hud && p !== pauseP && p !== a11yP) return; const b = p.at(h.uv); if (b) b.fn(); };

const ctrls = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x1F9AA0 }));
  line.scale.z = 2; c.add(line); c.userData.line = line;
  c.addEventListener('connected', (e) => { c.userData.src = e.data; });
  c.addEventListener('selectstart', () => {
    if (!paused && c.userData.cup) return grabCup(c);
    if (!paused && c.userData.term) return tapDone();
    if (c.userData.hit) clickHit(c.userData.hit);
  });
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
  if (drag && !renderer.xr.isPresenting) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
    camera.rotation.y += dx * .004; camera.rotation.x = Math.max(-1, Math.min(1, camera.rotation.x + dy * .004));
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
addEventListener('pointerup', () => { if (drag && drag.moved < 6 && !renderer.xr.isPresenting) { if (!paused && mouseCup) grabCup(null); else if (!paused && mouseTerm) tapDone(); else if (mouseHit) clickHit(mouseHit); } drag = null; });

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
    c.userData.term = payOn && !payDone && renderer.xr.isPresenting ? ray.intersectObject(room.terminal.hit, false)[0] || null : null;
    if (h) { const p = h.object.userData.panel, b = p.at(h.uv); want.set(p, b ? b.id : null); }
  }
  mouseHit = null; mouseCup = null; mouseTerm = null;
  if (mouseOn && !renderer.xr.isPresenting) {
    ray.setFromCamera(mouse, camera);
    mouseHit = intersect() || null;
    if (cupLive) mouseCup = ray.intersectObject(cupGrab, false)[0] || null;
    if (payOn && !payDone) mouseTerm = ray.intersectObject(room.terminal.hit, false)[0] || null;
    if (mouseHit) { const p = mouseHit.object.userData.panel, b = p.at(mouseHit.uv); want.set(p, b ? b.id : null); }
    renderer.domElement.style.cursor = (mouseHit && want.get(mouseHit.object.userData.panel)) || mouseCup || mouseTerm ? 'pointer' : 'default';
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
  if (globe.visible) {
    if (gT) { const k = Math.min(1, dt * 2.5); globe.rotation.y += (gT.y - globe.rotation.y) * k; globe.rotation.x += (gT.x - globe.rotation.x) * k; } else globe.rotation.y += dt * .08;
  }
  if (fadeT) {
    fadeT.t += dt;
    const a = fadeT.t < .4 ? fadeT.t / .4 : 1 - (fadeT.t - .4) / .4;
    fade.material.opacity = Math.max(0, Math.min(1, a));
    if (!fadeT.done && fadeT.t >= .4) { fadeT.fn(); fadeT.done = true; }
    if (fadeT.t >= .8) { fade.material.opacity = 0; fadeT = null; }
  }
  renderer.render(scene, camera);
});
