import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { LINES, CAFE, ASSESS } from './dialogue.js';

/* ---------- design tokens (from the Figma mid-fidelity file) ---------- */
const COL = { teal: '#1F9AA0', ink: '#2C4A52', mint: '#EAFBFC', line: '#BFEDEF', grey: '#6B7C82', ok: '#0B9A6D', bad: '#C0483B' };
const FONT = "'Source Sans 3','Segoe UI',Arial,sans-serif";

/* ---------- renderer / camera ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
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
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
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
  if (showEn) p.text(bubbleEn, 50, y + 8, 36, COL.grey, 400, W - 100);
}).place(0.25, 2.1, -2.6);

/* reply choices (Figma: "Use the microphone to reply…", speaker icons, mic, "Skip. Not sure.") */
let order_ = [];
const choices = new Panel(1.5, 1.3, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 40, 'rgba(244,251,252,.95)', COL.line);
  p.text('Choose the reply you believe best fits.', 48, 40, 40, COL.teal, 700, W - 96);
  order_ = order;
  order.forEach((o, i) => {
    const y = 150 + i * 148, hv = p.hover === 'o' + i, hl = reveal && o.ok;
    p.rr(40, y, W - 80, 130, 22, hv ? COL.mint : '#fff', hl ? COL.ok : hv ? COL.teal : COL.line, hl ? 6 : 3);
    speakerIcon(c, 70, y + 35, 60, p.hover === 's' + i ? COL.ok : COL.teal);
    p.text(o.fr, 160, y + 20, 36, COL.ink, 500, W - 240);
    p.hits.push({ x: 56, y: y + 10, w: 96, h: 110, id: 's' + i, fn: () => speak(o.fr, o.audio) });
    p.hits.push({ x: 40, y, w: W - 80, h: 130, id: 'o' + i, fn: () => pick(o) });
  });
  p.text(msg.t, 48, 600, 30, msg.c, 600, W - 96);
  const mh = p.hover === 'mic';
  c.beginPath(); c.arc(100, H - 82, 48, 0, Math.PI * 2); c.fillStyle = mh ? '#D4F5F7' : COL.mint; c.fill();
  c.strokeStyle = mh ? COL.teal : COL.line; c.lineWidth = 4; c.stroke();
  micIcon(c, 100, H - 82, 80, COL.teal);
  p.hits.push({ x: 50, y: H - 132, w: 100, h: 100, id: 'mic', fn: () => { msg = { t: 'Voice replies arrive in Phase 2. For now, point and pull the trigger on a reply.', c: COL.grey }; choices.render(); } });
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
function speak(fr, audio, done) {
  let finished = false;
  const end = () => { if (!finished) { finished = true; done && done(); } };
  const tts = () => {
    if (!synth) return setTimeout(end, 1800);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(fr);
    u.lang = 'fr-CA'; u.rate = 0.9;
    const vs = synth.getVoices();
    const v = vs.find((x) => x.lang.replace('_', '-') === 'fr-CA') || vs.find((x) => x.lang.startsWith('fr'));
    if (v) u.voice = v;
    u.onend = end; u.onerror = end;
    synth.speak(u);
    setTimeout(end, 9000);
  };
  if (audio) {
    let used = false;
    const fallback = () => { if (!used) { used = true; tts(); } };
    const a = new Audio(audio);
    a.onended = end; a.onerror = fallback;
    a.play().catch(fallback);
  } else tts();
}

/* ---------- dialogue flow ---------- */
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const renderAll = () => { bubble.render(); choices.render(); };

function startTurn() {
  const t = LINES[turn];
  tries = 0; reveal = false; showEn = false; busy = false; msg = { t: '', c: COL.grey };
  order = shuffle(t.options.map((o, i) => ({ ...o, audio: `audio/${ap()}_opt${i + 1}.mp3` })));
  bubbleFr = t.fr; bubbleEn = t.en; talking = true;
  renderAll();
  speak(t.fr, `audio/${ap()}_barista.mp3`, () => { talking = false; });
}
function pick(o) {
  if (busy) return;
  const t = LINES[turn];
  if (o.ok) {
    busy = true;
    if (tries === 0 && !reveal) first++;
    msg = { t: '✓ Très bien! ' + (t.note || ''), c: COL.ok };
    choices.render();
    speak(o.fr, o.audio, () => setTimeout(next, 900));
  } else {
    tries++; showEn = tries >= 2; talking = true;
    bubbleFr = 'Pardon? Je n’ai pas compris.'; bubbleEn = 'Sorry? I didn’t understand.';
    msg = { t: 'Not quite. Tap a speaker icon to hear a reply, then try again.', c: COL.bad };
    renderAll();
    speak(bubbleFr, 'audio/pardon.mp3', () => { talking = false; bubbleFr = t.fr; bubbleEn = t.en; bubble.render(); });
  }
}
function skip() {
  if (busy) return;
  busy = true; reveal = true; showEn = true;
  const ok = LINES[turn].options.find((o) => o.ok);
  msg = { t: `A good reply: “${ok.fr}” (${ok.en})`, c: COL.teal };
  renderAll();
  speak(ok.fr, `audio/${ap()}_opt${LINES[turn].options.indexOf(ok) + 1}.mp3`, () => setTimeout(next, 1200));
}
function next() {
  turn++;
  if (turn < LINES.length) return startTurn();
  if (mode === 'assess') return finishAssess();
  score = +(first / LINES.length * 10).toFixed(1);
  res = { head: score >= 8 ? 'Excellent job!' : score >= 5 ? 'Bon travail!' : 'Keep practicing!', body: `You answered ${first} of ${LINES.length} replies correctly on the first try.`, btn: 'Play again', fn: playAgain };
  setScene('result'); result.render();
}
function goCafe() { transition(() => { loadScript(CAFE); mode = 'cafe'; setScene('cafe'); turn = 0; first = 0; startTurn(); }); }
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
  const s = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 32).scale(-1, 1, 1), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  s.position.y = 1.6; street.add(s); sty.visible = false;
}, undefined, () => {});

/* Café interior */
box(cafe, 6, .1, 6.5, '#a67c52', 0, -.05, -1.75);
box(cafe, 6, .1, 6.5, '#f3ece2', 0, 3, -1.75);
box(cafe, 6, 3, .1, '#e8dccb', 0, 1.5, -5);
box(cafe, 6, 3, .1, '#e8dccb', 0, 1.5, 1.5);
box(cafe, .1, 3, 6.5, '#e8dccb', -3, 1.5, -1.75);
box(cafe, .1, 3, 6.5, '#d9c7b0', 3, 1.5, -1.75);
box(cafe, .06, 1.4, 2, '#cfe9ff', -2.93, 1.7, -1).material = new THREE.MeshBasicMaterial({ color: '#d8efff' });
box(cafe, 3.2, 1, .7, COL.ink, .4, .5, -2.2);
box(cafe, 3.4, .06, .85, '#e9e2d6', .4, 1.03, -2.2);
const machine = box(cafe, .7, .45, .5, '#b9bcc2', 1.3, 1.28, -2.3);
box(cafe, .5, .08, .2, '#555', 1.3, 1.1, -2.1);
const glass = box(cafe, 1, .5, .55, '#cfe9ee', -.9, 1.3, -2.2);
glass.material = new THREE.MeshLambertMaterial({ color: '#cfe9ee', transparent: true, opacity: .35 });
['#d9a15b', '#c9803f', '#e8c27a', '#b9733a'].forEach((c, i) => box(cafe, .14, .08, .14, c, -1.15 + i * .17, 1.1, -2.2));
box(cafe, 3, .06, .3, '#7a5a3c', 0, 1.9, -4.85);
[-1, -.4, .2, .8].forEach((x) => { const cup = new THREE.Mesh(new THREE.CylinderGeometry(.05, .04, .08, 10), M('#f6f3ee')); cup.position.set(x, 1.96, -4.85); cafe.add(cup); });
canvasPlane(1.4, 1, 512, (c, w, h) => {
  c.fillStyle = '#26343a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f3efe6'; c.textBaseline = 'top';
  c.font = `700 ${h * .13}px ${FONT}`; c.textAlign = 'center'; c.fillText('Menu', w / 2, h * .06);
  const rows = [['Espresso', '3,00 $'], ['Cortado', '3,75 $'], ['Café filtre', '2,75 $'], ['Latté', '4,75 $'], ['Croissant', '3,25 $']];
  c.font = `500 ${h * .085}px ${FONT}`;
  rows.forEach((r, i) => { const y = h * .27 + i * h * .13; c.textAlign = 'left'; c.fillText(r[0], w * .1, y); c.textAlign = 'right'; c.fillText(r[1], w * .9, y); });
}, cafe, 1.7, 2.15, -4.93);
[[2.1, -.4], [-2.1, 0]].forEach(([x, z]) => {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .05, 20), M('#7a5a3c')); top.position.set(x, .75, z); cafe.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .75, 8), M('#3b2f28')); leg.position.set(x, .37, z); cafe.add(leg);
  [-.55, .55].forEach((dx) => { const st = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .05, 14), M(COL.teal)); st.position.set(x + dx, .45, z); cafe.add(st); box(cafe, .04, .45, .04, '#3b2f28', x + dx, .22, z); });
});
[-1, 1].forEach((x) => {
  box(cafe, .02, .6, .02, '#222', x, 2.7, -1.5);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffd9a0' })); lamp.position.set(x, 2.35, -1.5); cafe.add(lamp);
});
const warm = new THREE.PointLight(0xffcf94, 14, 9, 2); warm.position.set(0, 2.5, -1.5); cafe.add(warm);

/* Barista */
const barista = new THREE.Group(); barista.position.set(-.4, 0, -3.1); cafe.add(barista);
const torso = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, .7, 16), M(COL.teal)); torso.position.y = 1.05; barista.add(torso);
const head = new THREE.Group(); head.position.y = 1.54; barista.add(head);
head.add(new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 16), M('#e2b48f')));
const hair = new THREE.Mesh(new THREE.SphereGeometry(.15, 20, 16, 0, Math.PI * 2, 0, Math.PI * .55), M('#3a2a20')); hair.position.y = .02; head.add(hair);
[-.05, .05].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(.015, 8, 8), M('#222')); e.position.set(x, .02, .13); head.add(e); });
const mouth = new THREE.Mesh(new THREE.BoxGeometry(.06, .012, .01), M('#7a2f2f')); mouth.position.set(0, -.05, .135); head.add(mouth);
[-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .55, 10), M(COL.teal)); a.position.set(s * .27, 1.1, .05); a.rotation.z = s * .12; barista.add(a); });

/* ---------- app flow: loading → sign-in → dashboard → info desk → module ---------- */
const loadScript = (a) => LINES.splice(0, LINES.length, ...a);
let cur = 'load', dState = 'lang', pLearn = -1, pMod = -1, mode = 'cafe', dMsg = '', gT = null;
let card = { t: 'You are located in the Rosemont neighbourhood. Enter the café to your left.', b: 'Enter the café', fn: goCafe };
let res = { head: '', body: '', btn: 'Play again', fn: playAgain };
const ap = () => (mode === 'assess' ? 'a' : 't') + (turn + 1);
const code = Array.from({ length: 9 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join(' ');
const later = (ms, fn) => setTimeout(fn, ms);

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

/* ---------- scene fade ---------- */
const fade = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false }));
fade.position.z = -.3; fade.renderOrder = 999; camera.add(fade);
let fadeT = null;
function transition(fn) { if (!fadeT) fadeT = { t: 0, fn, done: false }; }

/* ---------- pointing: VR controllers / hands + mouse preview ---------- */
const ray = new THREE.Raycaster();
const tmpM = new THREE.Matrix4(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const intersect = () => ray.intersectObjects(panels.filter((p) => shown(p.mesh)).map((p) => p.mesh), false)[0];
const clickHit = (h) => { const b = h.object.userData.panel.at(h.uv); if (b) b.fn(); };

const ctrls = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x1F9AA0 }));
  line.scale.z = 2; c.add(line); c.userData.line = line;
  c.addEventListener('selectstart', () => { if (c.userData.hit) clickHit(c.userData.hit); });
  rig.add(c);
  return c;
});

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
addEventListener('pointerup', () => { if (drag && drag.moved < 6 && mouseHit && !renderer.xr.isPresenting) clickHit(mouseHit); drag = null; });

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
document.fonts && document.fonts.ready.then(() => panels.forEach((p) => p.mesh.visible && p.render()));
boot();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .1), t = clock.elapsedTime;
  const want = new Map();
  for (const c of ctrls) {
    tmpM.identity().extractRotation(c.matrixWorld);
    o3.setFromMatrixPosition(c.matrixWorld); d3.set(0, 0, -1).applyMatrix4(tmpM);
    ray.set(o3, d3);
    const h = renderer.xr.isPresenting ? intersect() : null;
    c.userData.hit = h; c.userData.line.scale.z = h ? h.distance : 2;
    if (h) { const p = h.object.userData.panel, b = p.at(h.uv); want.set(p, b ? b.id : null); }
  }
  mouseHit = null;
  if (mouseOn && !renderer.xr.isPresenting) {
    ray.setFromCamera(mouse, camera);
    mouseHit = intersect() || null;
    if (mouseHit) { const p = mouseHit.object.userData.panel, b = p.at(mouseHit.uv); want.set(p, b ? b.id : null); }
    renderer.domElement.style.cursor = mouseHit && want.get(mouseHit.object.userData.panel) ? 'pointer' : 'default';
  }
  panels.forEach((p) => { if (p.mesh.visible) p.setHover(want.get(p) ?? null); });

  barista.position.y = Math.sin(t * 1.5) * .005;
  head.rotation.z = talking ? Math.sin(t * 7) * .05 : Math.sin(t * .8) * .02;
  mouth.scale.y = talking ? 1 + Math.abs(Math.sin(t * 14)) * 5 : 1;

  rec.head.rotation.z = talking ? Math.sin(t * 7) * .05 : 0;
  rec.mouth.scale.y = talking ? 1 + Math.abs(Math.sin(t * 14)) * 5 : 1;
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
