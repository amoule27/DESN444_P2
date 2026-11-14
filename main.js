import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { LINES } from './dialogue.js';

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
  p.text('You are located in the Rosemont neighbourhood. Enter the café to your left.', 50, 44, 46, COL.teal, 700, W - 100);
  p.btn(50, H - 150, 380, 100, 'Enter the café', 'enter', goCafe);
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
  const head = score >= 8 ? 'Excellent job!' : score >= 5 ? 'Bon travail!' : 'Keep practicing!';
  p.text(head, cx, 430, 70, COL.teal, 700, W - 100, 'center');
  p.text(`You answered ${first} of ${LINES.length} replies correctly on the first try.`, cx, 530, 40, COL.ink, 400, W - 140, 'center');
  p.btn(cx - 200, H - 190, 400, 100, 'Play again', 'again', playAgain);
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
  order = shuffle(t.options.map((o, i) => ({ ...o, audio: `audio/t${turn + 1}_opt${i + 1}.mp3` })));
  bubbleFr = t.fr; bubbleEn = t.en; talking = true;
  renderAll();
  speak(t.fr, `audio/t${turn + 1}_barista.mp3`, () => { talking = false; });
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
  speak(ok.fr, `audio/t${turn + 1}_opt${LINES[turn].options.indexOf(ok) + 1}.mp3`, () => setTimeout(next, 1200));
}
function next() {
  turn++;
  if (turn >= LINES.length) { score = +(first / LINES.length * 10).toFixed(1); setScene('result'); result.render(); } else startTurn();
}
function goCafe() { transition(() => { setScene('cafe'); turn = 0; first = 0; startTurn(); }); }
function playAgain() { goCafe(); }

/* ---------- scenes ---------- */
const street = new THREE.Group(), cafe = new THREE.Group();
scene.add(street, cafe);
function setScene(name) {
  street.visible = name === 'street';
  cafe.visible = name !== 'street';
  streetCard.mesh.visible = name === 'street';
  bubble.mesh.visible = choices.mesh.visible = name === 'cafe';
  result.mesh.visible = name === 'result';
  scene.background = new THREE.Color(name === 'street' ? '#a9d6f5' : '#1b1512');
  scene.fog = name === 'street' ? new THREE.Fog('#a9d6f5', 18, 50) : null;
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
setScene('street');
streetCard.render();
document.fonts && document.fonts.ready.then(() => { streetCard.render(); });

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

  if (fadeT) {
    fadeT.t += dt;
    const a = fadeT.t < .4 ? fadeT.t / .4 : 1 - (fadeT.t - .4) / .4;
    fade.material.opacity = Math.max(0, Math.min(1, a));
    if (!fadeT.done && fadeT.t >= .4) { fadeT.fn(); fadeT.done = true; }
    if (fadeT.t >= .8) { fade.material.opacity = 0; fadeT = null; }
  }
  renderer.render(scene, camera);
});
