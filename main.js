import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { LINES, CAFE, ASSESS } from './dialogue.js';
import { buildCafe } from './cafe3d.js';
import { buildAirport } from './airport3d.js';

/* ---------- design tokens (from the Figma mid-fidelity file) ---------- */
const COL = { teal: '#1F9AA0', ink: '#2C4A52', mint: '#EAFBFC', line: '#BFEDEF', grey: '#6B7C82', ok: '#0B9A6D', bad: '#C0483B' };
/* Panel padding in px: the card edge is 4px thick + 20px of space, so 24 = 20px of visible padding.
   Change this one number to adjust the top and bottom padding of every panel. */
const PANEL_PAD = 24;
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
const vrBtn = VRButton.createButton(renderer);
document.body.appendChild(vrBtn);
vrBtn.addEventListener('click', () => { try { prewarmMic(); } catch (e) {} }, true);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.6, 0);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const gHemi = new THREE.HemisphereLight(0xffffff, 0x887766, 1.2);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.1);
sun.position.set(3, 6, 2);
scene.add(gHemi, sun);

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
    this.f = false; this.fa = 0; this.ft = 0; this.fd = 0; this.mod = 1; this.stg = null;
    this.cv = document.createElement('canvas');
    this.cv.width = px; this.cv.height = Math.round(px * h / w);
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false, depthWrite: false }));
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
  render() { this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); this.hits = []; this.fn(this); this.tex.needsUpdate = true; if (this.stg && stage.valid) restage(this); }
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
  // text whose capital-letter top sits exactly on `top`; returns the bottom (last baseline + descender)
  ttext(t, x, top, size, color, weight = 400, maxW = 1e4, align = 'left') {
    const c = this.ctx; c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
    const capH = c.measureText('H').actualBoundingBoxAscent || size * .7, ls = wrap(c, t, maxW);
    ls.forEach((l, i) => c.fillText(l, x, top + capH + i * size * 1.25));
    return top + capH + (ls.length - 1) * size * 1.25 + size * .22;
  }
  tm(t, size, weight = 400, maxW = 1e4) { // height ttext would use
    const c = this.ctx; c.font = `${weight} ${size}px ${FONT}`;
    const capH = c.measureText('H').actualBoundingBoxAscent || size * .7;
    return capH + (wrap(c, t, maxW).length - 1) * size * 1.25 + size * .22;
  }
  // resize the panel (canvas + mesh) to hPx so content can sit exactly 20px from the card edge
  fit(hPx, anchor = 'center') {
    hPx = Math.round(hPx);
    if (hPx === this.cv.height) return;
    const g = this.mesh.geometry.parameters.height, mid = this.mesh.position.y;
    const ref = anchor === 'bottom' ? mid - g / 2 : anchor === 'top' ? mid + g / 2 : mid;
    this.cv.height = hPx;
    const hm = hPx / this.cv.width * this.w;
    this.mesh.geometry.dispose(); this.mesh.geometry = new THREE.PlaneGeometry(this.w, hm);
    this.mesh.position.y = anchor === 'bottom' ? ref + hm / 2 : anchor === 'top' ? ref - hm / 2 : ref;
    this.h = hm; this.tex.dispose();
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


/* ---------- floating, card-less UI: soft dissolves + gaze-anchored "stage" ---------- */
const ease = (x) => x * x * (3 - 2 * x);
Object.assign(Panel.prototype, {
  soft(stg) { this.f = true; this.noScale = true; this.stg = stg || null; this.mesh.material.opacity = 0; return this; },
  show(d = 0) { this.ft = 1; this.fd = d; this.mesh.visible = true; return this; },
  hide() { this.ft = 0; this.fd = 0; return this; },
  snap() { this.fa = this.ft = this.fd = 0; this.mesh.visible = false; this.applyOpacity(); return this; },
  applyOpacity() { this.mesh.material.opacity = (this.f ? ease(this.fa) : 1) * this.mod; },
});
const GL = '#7FE3E8', GK = '#7BE0A9', GR = '#FF9A8E', GG = '#d3e3e6';
const lite = (c) => (c === COL.ok ? GK : c === COL.bad ? GR : c === COL.teal ? GL : GG);
// feathered dark pool behind floating text (no hard edge): the shadow of an off-canvas shape
function scrim(c, x, y, w, h, a = .55, blur = 55, r = 60) {
  c.save(); c.shadowColor = `rgba(6,14,18,${a})`; c.shadowBlur = blur; c.shadowOffsetX = 6000; c.shadowOffsetY = 0;
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(x - 6000, y, w, h, r); c.fill(); c.restore();
}
function glow(c, on = true) { c.shadowColor = on ? 'rgba(0,0,0,.6)' : 'transparent'; c.shadowBlur = on ? 10 : 0; c.shadowOffsetX = 0; c.shadowOffsetY = on ? 2 : 0; }
Panel.prototype.pill = function (x, y, w, h, label, id, fn) {
  const hv = this.hover === id, c = this.ctx;
  this.rr(x, y, w, h, h / 2, hv ? 'rgba(127,227,232,.38)' : 'rgba(255,255,255,.18)', hv ? GL : 'rgba(255,255,255,.8)', 3);
  glow(c); this.vtext(label, x + w / 2, y + h / 2, 34, '#fff', 600, w - 30, 'center'); glow(c, false);
  this.hits.push({ x, y, w, h, id, fn });
};
/* The stage remembers where the user was looking when a step began. Everything of that step is placed there and then stays put,
   so text can be re-read. It re-anchors only at the start of a step, if the user has turned >~37° or walked >0.3 m. */
const stage = { valid: false, ex: 0, ey: 1.6, ez: 0, fx: 0, fz: -1 };
function gazeNow() {
  camera.updateWorldMatrix(true, false);
  camera.getWorldPosition(o3); camera.getWorldDirection(d3); d3.y = 0;
  if (d3.lengthSq() < 1e-4) d3.set(0, 0, -1);
  d3.normalize();
}
function restage(p) {
  const s = p.stg, sc = A.big ? 1.25 : 1, dx = s.dx || 0;
  p.mesh.scale.setScalar(sc);
  const h = p.h * sc;
  const x = stage.ex + stage.fx * s.dist - stage.fz * dx, z = stage.ez + stage.fz * s.dist + stage.fx * dx;
  const y = stage.ey + s.dy + (s.edge === 'top' ? -h / 2 : s.edge === 'bottom' ? h / 2 : 0);
  p.mesh.position.set(x, y, z); p.mesh.lookAt(stage.ex, y, stage.ez);
}
const SPK = { x: -.45, z: -3.1 }; // barista / receptionist stand here
function stageSet(force, toSpeaker) {
  gazeNow();
  let ax = d3.x, az = d3.z, aim = false;
  if (toSpeaker) { // if the speaker is roughly in front of the user, aim the stage at them so the text sits beside them, not on them
    const sx = SPK.x - o3.x, sz = SPK.z - o3.z, sl = Math.hypot(sx, sz) || 1;
    if ((sx * d3.x + sz * d3.z) / sl > .64) { ax = sx / sl; az = sz / sl; aim = true; }
  }
  const dot = stage.fx * ax + stage.fz * az, mv = Math.hypot(o3.x - stage.ex, o3.z - stage.ez);
  if (force || aim || !stage.valid || dot < .8 || mv > .3) Object.assign(stage, { valid: true, ex: o3.x, ey: o3.y, ez: o3.z, fx: ax, fz: az });
  panels.forEach((p) => p.stg && restage(p));
  hudPlace();
}

/* ---------- game state ---------- */
let turn = 0, first = 0, tries = 0, order = [], reveal = false, showEn = false, busy = false, talking = false, score = 0;
let bubbleFr = '', bubbleEn = '', msg = { t: '', c: COL.grey };

/* street / intro card: floating text that appears in front of you */
const streetCard = new Panel(1.1, .5, (p) => {
  const c = p.ctx, W = p.cv.width, M = 90, tw = W - 2 * M - 40;
  const by = M + p.tm(card.t, 46, 700, tw) + 50;
  p.fit(by + 96 + M);
  scrim(c, 40, 40, W - 80, p.cv.height - 80, .6, 60, 70);
  glow(c); p.ttext(card.t, M, M, 46, '#fff', 700, tw); glow(c, false);
  p.pill(M - 10, by, 500, 96, card.b, 'enter', card.fn);
}, 1100).soft({ edge: 'center', dy: 0, dist: 1.2 });

/* the speaker's line: floats just above eye level, close to the user, and stays until the next line */
const bubble = new Panel(.85, .34, (p) => {
  const c = p.ctx, W = p.cv.width, M = 70, tw = W - 2 * M, showE = showEn || A.en;
  const tag = mode === 'cafe' ? 'Barista' : 'Information desk';
  const frT = M + 50, fr = p.tm(bubbleFr, 50, 700, tw), enT = frT + fr + 16, en = showE ? p.tm(bubbleEn, 38, 400, tw) : 0;
  p.fit((showE ? enT + en : frT + fr) + 50);
  scrim(c, 30, 30, W - 60, p.cv.height - 50, .55, 55, 70);
  glow(c); p.ttext(tag, M, M - 6, 24, GL, 400, tw);
  p.ttext(bubbleFr, M, frT, 50, '#fff', 700, tw);
  if (showE) p.ttext(bubbleEn, M, enT, 38, GG, 400, tw);
  glow(c, false);
}, 850).soft({ edge: 'bottom', dy: .1, dist: 1.15, dx: .62 });

/* reply choices (Figma: "Use the microphone to reply…", speaker icons, mic, "Skip. Not sure.") */
let order_ = [];
let listening = false, sel = -1, voiceOff = false;
/* Cloud speech-to-text (recommended on Quest Browser, which has no built-in recogniser).
   Set STT_DEFAULT to your Cloudflare Worker address (see stt-proxy/README.md), or test with ?stt=https://your-worker.workers.dev once. */
const STT_DEFAULT = '';
let STT_URL = STT_DEFAULT;
try { const q = new URLSearchParams(location.search).get('stt'); if (q !== null) localStorage.setItem('fvr-stt', q); STT_URL = localStorage.getItem('fvr-stt') || STT_DEFAULT; } catch (e) {}
const CAN_REC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
let cloudOff = false, thinking = false, cloud = null, sttTok = 0, sttFails = 0, micStream = null;
const useCloud = () => !!STT_URL && CAN_REC && !cloudOff;
/* Prototype mode: the mic button shows a "listening" animation, then accepts the selected reply as if it had been spoken.
   Set to false to use real recognition (cloud proxy or browser speech) instead. */
const SIM_VOICE = true;
const voiceOK = () => SIM_VOICE || useCloud() || (!!SR && !voiceOff);
/* the reply choices: plain floating rows under the speaker's line (no boxes) */
const choices = new Panel(.85, .32, (p) => {
  const c = p.ctx, W = p.cv.width, M = 40, X0 = 70, tw = W - 2 * X0 - 130;
  order_ = order;
  const hs = order.map((o) => Math.max(100, (A.en ? p.tm(o.fr, 44, 500, tw) + 8 + p.tm(o.en, 30, 400, tw) : p.tm(o.fr, 44, 500, tw)) + 44));
  p.fit(M * 2 + hs.reduce((x, y) => x + y, 0));
  scrim(c, 20, 20, W - 40, p.cv.height - 40, .55, 50, 60);
  let y = M;
  order.forEach((o, i) => {
    const h = hs[i], hv = p.hover === 'o' + i, hl = reveal && o.ok, on = sel === i;
    if (hl || on || hv) p.rr(X0 - 24, y + 4, W - 2 * X0 + 48, h - 8, 30, hl ? 'rgba(123,224,169,.24)' : on ? 'rgba(127,227,232,.26)' : 'rgba(255,255,255,.12)', hl ? GK : on ? GL : null, 3);
    else if (i > 0) { c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(X0, y, W - 2 * X0, 2); }
    speakerIcon(c, X0, y + h / 2 - 30, 60, p.hover === 's' + i ? GK : GL);
    glow(c);
    if (A.en) { const e = p.ttext(o.fr, X0 + 100, y + 20, 44, '#fff', 500, tw); p.ttext(o.en, X0 + 100, e + 4, 30, GG, 400, tw); }
    else p.vtext(o.fr, X0 + 100, y + h / 2, 44, '#fff', 500, tw);
    glow(c, false);
    p.hits.push({ x: X0 - 16, y, w: 104, h, id: 's' + i, fn: () => speak(o.fr, o.audio) });
    p.hits.push({ x: X0 - 24, y, w: W - 2 * X0 + 48, h, id: 'o' + i, fn: () => selectRow(i) });
    y += h;
  });
}, 850).soft({ edge: 'top', dy: -.06, dist: 1.15, dx: .62 });

/* feedback / instruction line between the speaker's line and the replies; dissolves when its text changes */
let fbShown = { t: '', c: COL.grey };
const fbP = new Panel(.85, .1, (p) => {
  const c = p.ctx, W = p.cv.width, t = fbShown.t, tw = W - 140;
  if (!t) return;
  p.fit(p.tm(t, 32, 600, tw) + 50);
  scrim(c, 30, 10, W - 60, p.cv.height - 20, .5, 28, 34);
  glow(c); p.ttext(t, 70, 25, 32, lite(fbShown.c), 600, tw); glow(c, false);
}, 850).soft({ edge: 'top', dy: .0, dist: 1.15, dx: .62 });

/* microphone: locked to the bottom centre of the user's view */
const micP = new Panel(.8, .34, (p) => {
  const c = p.ctx, W = p.cv.width, cx = W / 2, MY = 110, MR = 74, vo = voiceOK();
  scrim(c, 40, 15, W - 80, p.cv.height - 30, .5, 40, 80);
  const micOn = vo && sel >= 0 && !busy && !thinking, mh = p.hover === 'mic' && micOn, mc = listening ? COL.bad : micOn ? '#2F8A8C' : '#9AA3A7';
  if (vo) {
    if (listening) { c.beginPath(); c.arc(cx, MY, MR + 16, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,154,142,.55)'; c.lineWidth = 9; c.stroke(); }
    c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 20; c.shadowOffsetY = 8;
    c.beginPath(); c.arc(cx, MY, MR, 0, Math.PI * 2);
    c.fillStyle = listening ? '#FBE3E0' : micOn ? (mh ? '#DDF7F8' : '#F4FBFC') : 'rgba(225,230,232,.78)'; c.fill(); c.restore();
    c.beginPath(); c.arc(cx, MY, MR, 0, Math.PI * 2); c.strokeStyle = listening ? COL.bad : micOn ? GL : 'rgba(255,255,255,.5)'; c.lineWidth = 5; c.stroke();
    micIcon(c, cx, MY, 112, mc);
    const lab = thinking ? 'Checking…' : listening ? 'Listening… tap to stop' : micOn ? 'Tap to speak' : 'Select a reply first';
    glow(c); p.vtext(lab, cx, 232, 30, listening ? GR : micOn ? GL : GG, 600, W - 300, 'center'); glow(c, false);
    p.hits.push({ x: cx - 90, y: MY - 90, w: 180, h: 180, id: 'mic', fn: toggleMic });
  }
  const sk = p.hover === 'skip';
  glow(c); p.vtext('Skip. Not sure.', vo ? cx + MR + 130 : cx, MY, 28, sk ? '#fff' : GG, 600, 200, 'center'); glow(c, false);
  p.hits.push({ x: vo ? cx + MR + 20 : cx - 120, y: MY - 50, w: 230, h: 100, id: 'skip', fn: skip });
}, 800).soft();
camera.add(micP.mesh); micP.mesh.position.set(0, -.3, -.8);

/* results (Figma: score gauge, "Excellent job!") */
const result = new Panel(1.1, 1.1, (p) => {
  const W = p.cv.width, M = 90, cx = M + 240, cy = M + 40 + 200;
  const bodyB = 444 + p.tm(res.body, 36, 400, W - 2 * M), by = bodyB + 40;
  p.fit(by + 96 + M); const c = p.ctx;
  scrim(c, 30, 30, W - 60, p.cv.height - 60, .6, 70, 120);
  c.lineWidth = 40; c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(cx, cy, 200, Math.PI, 2 * Math.PI); c.stroke();
  c.strokeStyle = GL; c.beginPath(); c.arc(cx, cy, 200, Math.PI, Math.PI + Math.PI * Math.max(score, .01) / 10); c.stroke();
  glow(c);
  p.text(score.toFixed(1), cx, cy - 70, 90, '#fff', 600, 400, 'center');
  p.text(res.head, M, 344, 70, GL, 700, W - 2 * M);
  p.ttext(res.body, M, 444, 36, '#fff', 400, W - 2 * M);
  glow(c, false);
  p.pill(M - 10, by, 400, 96, res.btn, 'again', res.fn);
}).soft({ edge: 'center', dy: -.05, dist: 1.6 });

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
  const was = listening || thinking;
  listening = false; thinking = false; sttTok++;
  if (cloud) { const c = cloud; cloud = null; c.cancelled = true; cloudClean(c); try { if (c.rec.state !== 'inactive') c.rec.stop(); } catch (e) {} }
  if (srec) { const r = srec; srec = null; r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch (e) {} }
  if (was) rUI();
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
  else { msg = { t: `I heard “${alts[0]}”. Try saying: “${o.fr}”`, c: COL.bad }; rUI(); }
}
function toggleMic() {
  if (busy || paused || modal || thinking) return;
  if (!voiceOK()) return;
  if (sel < 0) { msg = { t: 'Select a reply first, then tap the microphone.', c: COL.grey }; return rUI(); }
  if (listening) { if (cloud && !cloud.finishing) return cloudFinish(); stopListening(); msg = { t: '', c: COL.grey }; return rUI(); }
  if (talking) { msg = { t: 'Wait until the barista has finished, then tap the mic.', c: COL.grey }; return rUI(); }
  try { synth && synth.cancel(); } catch (e) {}
  if (SIM_VOICE) {
    const o = order[sel];
    listening = true; msg = { t: 'Listening… say your reply in French.', c: COL.teal }; rUI();
    clearTimeout(recTimer);
    recTimer = setTimeout(() => { if (!listening) return; listening = false; pick(o, o.fr); }, 2400);
    return;
  }
  if (useCloud()) return cloudStart();
  const r = new SR();
  srec = r; r.lang = 'fr-CA'; r.interimResults = false; r.continuous = false; r.maxAlternatives = 5;
  let got = false;
  r.onresult = (e) => {
    got = true;
    const alts = [...e.results[0]].map((x) => x.transcript).filter(Boolean);
    stopListening();
    if (alts.length) heardIt(alts);
  };
  r.onerror = (e) => { if (srec !== r) return; got = true; stopListening(); if (e.error !== 'no-speech' && e.error !== 'aborted') voiceOff = true; msg = { t: micError(e.error), c: e.error === 'no-speech' ? COL.grey : COL.bad }; rUI(); };
  r.onend = () => { if (srec !== r) return; stopListening(); if (!got) { msg = { t: micError('no-speech'), c: COL.grey }; rUI(); } };
  try {
    r.start();
    listening = true;
    msg = { t: 'Listening… say your reply in French.', c: COL.teal };
    recTimer = setTimeout(() => { if (srec === r) { try { r.stop(); } catch (e) {} } }, 9000);
  } catch (e) { srec = null; voiceOff = true; msg = { t: micError('other'), c: COL.bad }; }
  rUI();
}

/* ---------- cloud speech-to-text: record the mic, send to the proxy, match the transcript ---------- */
async function getMic() {
  if (micStream && micStream.getAudioTracks().some((t) => t.readyState === 'live')) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  return micStream;
}
function prewarmMic() { if (useCloud()) getMic().then(() => { micReady(); }).catch(() => {}); }
function micReady() { const b = document.getElementById('micbtn'); if (b) { b.textContent = 'Microphone ready ✓'; b.disabled = true; } }
(() => { // small "Enable microphone" button on the 2D page, so the permission prompt happens before you enter VR
  if (!useCloud()) return;
  const h = document.getElementById('hint'); if (!h) return;
  const b = document.createElement('button'); b.id = 'micbtn'; b.textContent = 'Enable microphone';
  b.style.cssText = 'display:block;margin-top:8px;padding:6px 12px;border-radius:10px;border:1px solid #BFEDEF;background:#fff;color:#1F9AA0;font:600 14px inherit;cursor:pointer';
  b.onclick = () => getMic().then(micReady).catch(() => { b.textContent = 'Microphone blocked: allow it in the browser'; });
  h.appendChild(b);
  navigator.permissions && navigator.permissions.query({ name: 'microphone' }).then((r) => { if (r.state === 'granted') getMic().then(micReady).catch(() => {}); }).catch(() => {});
})();
function cloudClean(c) {
  clearInterval(c.iv); clearTimeout(c.timer);
  try { c.src && c.src.disconnect(); } catch (e) {}
  try { if (c.ctx) { const x = c.ctx; c.ctx = null; x.close().catch(() => {}); } } catch (e) {}
}
function cloudFinish() {
  const c = cloud; if (!c || c.finishing) return;
  c.finishing = true; cloudClean(c);
  try { c.rec.stop(); } catch (e) { c.rec.onstop && c.rec.onstop(); }
}
async function cloudStart() {
  const my = ++sttTok;
  listening = true; msg = { t: 'Listening… say your reply in French.', c: COL.teal }; rUI();
  try {
    const stream = await getMic();
    if (my !== sttTok) return;
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const c = cloud = { rec, chunks: [], mime: rec.mimeType || mime || 'audio/webm', heard: false, t0: performance.now(), last: 0 };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) c.chunks.push(e.data); };
    rec.onstop = async () => {
      if (c.cancelled || cloud !== c) return;
      cloud = null; cloudClean(c); listening = false;
      if (!c.heard || !c.chunks.length) { msg = { t: micError('no-speech'), c: COL.grey }; return rUI(); }
      thinking = true; msg = { t: 'Checking what you said…', c: COL.teal }; rUI();
      const tok = ++sttTok;
      try {
        const res = await fetch(STT_URL, { method: 'POST', headers: { 'Content-Type': c.mime.split(';')[0] }, body: new Blob(c.chunks, { type: c.mime }) });
        if (!res.ok) throw new Error('stt ' + res.status);
        const j = await res.json();
        if (tok !== sttTok) return;
        thinking = false; sttFails = 0;
        const t = (j.text || '').trim();
        if (!t) { msg = { t: micError('no-speech'), c: COL.grey }; return rUI(); }
        heardIt([t]);
      } catch (e) {
        if (tok !== sttTok) return;
        thinking = false;
        if (++sttFails >= 2) cloudOff = true; // fall back to point-and-trigger after two failures
        msg = { t: micError('network'), c: COL.bad }; rUI();
      }
    };
    // voice-activity detection: stop ~1.1 s after you finish speaking (or after 9 s)
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      c.ctx = new AC(); c.ctx.resume && c.ctx.resume();
      const an = c.ctx.createAnalyser(); an.fftSize = 1024;
      c.src = c.ctx.createMediaStreamSource(stream); c.src.connect(an);
      const buf = new Float32Array(an.fftSize);
      c.iv = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const now = performance.now();
        if (Math.sqrt(sum / buf.length) > .015) { c.heard = true; c.last = now; }
        if ((c.heard && now - c.last > 1100 && now - c.t0 > 1500) || now - c.t0 > (c.heard ? 9000 : 6500)) cloudFinish();
      }, 80);
    } catch (e) { c.heard = true; c.timer = setTimeout(cloudFinish, 5000); }
    rec.start();
  } catch (e) {
    if (my !== sttTok) return;
    listening = false; cloudOff = true;
    msg = { t: micError(e && e.name === 'NotFoundError' ? 'audio-capture' : 'not-allowed'), c: COL.bad }; rUI();
  }
}

/* ---------- dialogue flow ---------- */
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
let lineKey = '', lineTm = 0, fbTm = 0, repliesOn = false;
const lineK = () => bubbleFr + '|' + bubbleEn + '|' + (showEn || A.en) + '|' + mode;
function syncLine() { // the speaker's line dissolves out and the new one dissolves in
  const k = lineK(); if (k === lineKey) return; lineKey = k;
  clearTimeout(lineTm);
  if (bubble.fa > .02) { bubble.hide(); lineTm = setTimeout(() => { bubble.render(); bubble.show(0); }, 330); }
  else { bubble.render(); bubble.show(0); }
}
function syncFb() {
  if (fbShown.t === msg.t && fbShown.c === msg.c) return;
  fbShown = { t: msg.t, c: msg.c }; clearTimeout(fbTm);
  const go = () => { fbP.render(); if (fbShown.t && repliesOn) fbP.show(0); };
  if (fbP.fa > .02) { fbP.hide(); fbTm = setTimeout(go, 280); } else go();
}
const rUI = () => { syncFb(); if (choices.ft) choices.render(); if (micP.ft) micP.render(); };
const renderAll = () => { syncLine(); rUI(); };
const talkP = () => [bubble, choices, fbP, micP];
function hideTalk(snap) {
  clearTimeout(lineTm); clearTimeout(fbTm);
  talkP().forEach((p) => (snap ? p.snap() : p.hide()));
  lineKey = ''; fbShown = { t: '', c: COL.grey }; repliesOn = false;
}
function showReplies() { // the replies, feedback line and mic appear once the speaker has finished
  repliesOn = true;
  choices.render(); choices.show(.1); micP.render(); micP.show(.35);
  fbShown = { t: '', c: COL.grey }; syncFb();
}

function startTurn() {
  const t = LINES[turn];
  stopListening(); sel = -1;
  tries = 0; reveal = false; showEn = false; busy = false;
  msg = { t: voiceOK() ? 'Use the microphone to reply with the answer you believe best fits.' : 'Choose the reply you believe best fits. Point at it and pull the trigger.', c: COL.teal };
  order = shuffle(t.options.map((o, i) => ({ ...o, audio: `audio/${ap()}_opt${i + 1}.mp3` })));
  bubbleFr = t.fr; bubbleEn = t.en; talking = true;
  cupG.visible = mode === 'cafe' && turn === LINES.length - 1;
  hud.mesh.visible = hudOn();
  const old = talkP().some((p) => p.fa > .02);
  hideTalk();
  const go = () => {
    stageSet(false, true);
    syncLine();
    speak(t.fr, `audio/${ap()}_barista.mp3`, () => { talking = false; showReplies(); });
  };
  if (old) later(450, go); else go();
}
function selectRow(i) {
  if (busy) return;
  const o = order[i];
  if (!voiceOK()) return pick(o);
  stopListening();
  sel = i;
  msg = { t: 'Tap the microphone and say your reply in French.', c: COL.teal };
  rUI();
}
function pick(o, heard) {
  if (busy) return;
  stopListening(); sel = -1;
  const t = LINES[turn];
  if (o.ok) {
    busy = true;
    if (tries === 0 && !reveal) first++;
    msg = { t: '✓ Très bien! ' + (t.note || ''), c: COL.ok };
    rUI();
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
  speak(bubbleFr, 'audio/pardon.mp3', () => { talking = false; bubbleFr = t.fr; bubbleEn = t.en; syncLine(); });
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
  hideTalk(); stageSet(false, true); cupHint.render(); cupHint.show(.7);
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
  [streetCard, cupHint, payHint, result].forEach((p) => p.snap()); hideTalk(true);
  loading.mesh.visible = on('load', 'tip');
  sign.mesh.visible = on('signin', 'welcome');
  scene.background = new THREE.Color(on('street', 'tip') ? '#a9d6f5' : on('dash') ? '#dfe5e9' : on('desk', 'deskintro', 'level') ? '#2a2f36' : on('cafe', 'result') ? '#1b1512' : '#271f33');
  scene.fog = on('street', 'tip') ? new THREE.Fog('#a9d6f5', 18, 50) : null;
  if (on('dash')) { globe.position.set(.95, 1.45, -2.1); globe.scale.setScalar(.6); } else { globe.position.set(0, .2, -7); globe.scale.setScalar(3.5); }
  renderer.shadowMap.needsUpdate = true;
  gHemi.visible = sun.visible = !on('desk', 'deskintro', 'level'); // the airport has its own lighting
  renderer.toneMapping = on('cafe', 'result', 'desk', 'deskintro', 'level') ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  hud.mesh.visible = hudOn(); hudPlace(); hud.render();
  [loading, sign, dash].forEach((p) => p.mesh.visible && p.render());
  if (on('street', 'deskintro')) { stageSet(true); streetCard.render(); streetCard.show(1.1); }
  if (on('result', 'level')) { stageSet(true); result.render(); result.show(.9); }
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
  const c = p.ctx, W = p.cv.width;
  if (cur === 'tip') {
    const PAD = PANEL_PAD, t1 = 'Use your map to navigate the neighbourhood.', t2 = 'Look for the café on your route, then walk in.';
    const b1 = PAD + p.tm(t1, 52, 600, W - 140), t2top = b1 + 40, b2 = t2top + p.tm(t2, 36, 400, W - 160), rowCy = b2 + 64;
    p.fit(rowCy + 40 + PAD); const H = p.cv.height;
    p.rr(4, 4, W - 8, H - 8, 40, '#fff', COL.line);
    p.ttext(t1, W / 2, PAD, 52, COL.ink, 600, W - 140, 'center');
    p.ttext(t2, W / 2, t2top, 36, COL.grey, 400, W - 160, 'center');
    logo(c, 140, rowCy, 40, '#fff'); p.vtext('Connecting you…', 210, rowCy, 40, COL.ink, 500);
  } else {
    const H = p.cv.height; logo(c, W / 2, 230, 110); p.text('Connecting you…', W / 2, 400, 48, '#fff', 500, W, 'center'); }
}).place(0, 1.5, -1.6);

/* sign-in: two Figma frames ("Sign In" steps + one-time code, then "Hello, Alex!") that dissolve into each other.
   Layout numbers are the frame's own pixels (1404 px wide), scaled by K to the panel canvas. */
let sgMix = 0; // 0 = steps frame, 1 = hello frame (animated in the main loop)
const sign = new Panel(1.1, .85, (p) => {
  const c = p.ctx, W = p.cv.width, K = W / 1404, m = sgMix * sgMix * (3 - 2 * sgMix);
  p.fit(1080 * K + (940 - 1080) * K * m, 'top'); const H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 44, '#fff', COL.line);
  const GREY = '#7a7a7a', cx = W / 2;
  c.save(); c.textBaseline = 'alphabetic';
  // shared title
  c.fillStyle = '#000'; c.font = `700 ${108 * K}px ${FONT}`; c.textAlign = 'center'; c.fillText('Sign In', cx, 226 * K);
  // frame 1: steps + code
  if (m < 1) {
    c.globalAlpha = 1 - m;
    [[398, ['Take off your headset and go to', 'https://worldspeak.auth0.com/authenticate'], 1], [630, ['Enter this one time login code on your', 'external device.'], 2]].forEach(([cy, ls, n]) => {
      c.beginPath(); c.arc(184 * K, cy * K, 54 * K, 0, 7); c.fillStyle = COL.ok; c.fill();
      c.fillStyle = '#fff'; c.font = `700 ${48 * K}px ${FONT}`; c.textAlign = 'center'; c.fillText(String(n), 184 * K, (cy + 17) * K);
      c.fillStyle = GREY; c.font = `400 ${46 * K}px ${FONT}`; c.textAlign = 'left';
      ls.forEach((l, i) => { const y = (cy + 7 + i * 80) * K; c.fillText(l, 283 * K, y); if (n === 1 && i === 1) { const w = c.measureText(l).width; c.fillRect(283 * K, y + 7 * K, w, 3 * K); } });
    });
    p.rr(127 * K, 805 * K, 1150 * K, 162 * K, 16 * K, '#fff', '#bdbdbd', 4 * K);
    c.fillStyle = '#000'; c.font = `700 ${54 * K}px ${FONT}`; c.textAlign = 'center';
    if ('letterSpacing' in c) c.letterSpacing = `${10 * K}px`;
    c.fillText(code.replace(/ /g, ''), cx + 5 * K, 906 * K);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  // frame 2: success
  if (m > 0) {
    c.globalAlpha = m;
    c.beginPath(); c.arc(cx, 398 * K, 54 * K, 0, 7); c.fillStyle = COL.ok; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 7 * K; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(681 * K, 404 * K); c.lineTo(699 * K, 421 * K); c.lineTo(731 * K, 382 * K); c.stroke();
    c.fillStyle = GREY; c.textAlign = 'center';
    c.font = `600 ${82 * K}px ${FONT}`; c.fillText('Hello, Alex!', cx, 620 * K);
    c.font = `400 ${46 * K}px ${FONT}`;
    c.fillText('You’re all set. You will be connected in a', cx, 703 * K); c.fillText('moment.', cx, 783 * K);
  }
  c.restore();
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
    p.rr(44, y, W - 88, h, 20, ok ? (hv ? COL.mint : '#fff') : '#E9EDEF', sel === i && ok ? COL.teal : ok ? COL.line : '#DCE2E5', sel === i && ok ? 6 : 3);
    if (subs) { p.text(t, 76, y + 20, 32, ok ? COL.ink : '#A9B4B9', 400, W - 200); p.text(subs[i], 76, y + 64, 27, ok ? COL.grey : '#B9C3C7', 400, W - 190); }
    else p.text(t, 76, y + 22, 36, ok ? COL.ink : '#A9B4B9', 500, W - 220);
    if (ok) { c.beginPath(); c.arc(W - 100, y + h / 2, 22, 0, 7); c.strokeStyle = COL.line; c.lineWidth = 4; c.stroke(); }
    else p.text('Coming soon', W - 76, y + h / 2 - 14, 24, '#A9B4B9', 600, 220, 'right');
    if (sel === i && ok) { c.beginPath(); c.arc(W - 100, y + h / 2, 12, 0, 7); c.fillStyle = COL.teal; c.fill(); }
    p.hits.push({ x: 44, y, w: W - 88, h, id: 'r' + i, fn: () => pickFn(i) });
  });
}
const dash = new Panel(1.6, 1.45, (p) => {
  const c = p.ctx, W = p.cv.width, PAD = PANEL_PAD;
  const bottom = { lang: dMsg ? 772 : 706, loc: dMsg ? 817 : 749, locall: 837, learn: 835 }[dState];
  p.fit(bottom + PAD); const H = p.cv.height;
  p.rr(4, 4, W - 8, H - 8, 40, 'rgba(240,245,247,.96)', COL.line);
  p.vtext('Welcome, Alex', 44, PAD + 35, 58, COL.ink, 700);
  p.rr(560, PAD, 420, 70, 35, '#fff', COL.line); p.vtext('Find a destination.', 600, PAD + 35, 32, '#9aa8ad');
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
    p.btn(W - 44 - 290, 757, 290, 80, 'Continue', 'go', goOn);
    p.text(dMsg, 44, 767, 28, COL.bad, 600, W - 420);
  } else {
    back('What do you want to learn?');
    list(p, LEARN, LEARN_SUB, pLearn, 215, 116, (i) => { if (i !== 1) { dMsg = 'Coming soon. This prototype has the café ordering module only.'; return dash.render(); } pLearn = i; dMsg = ''; dash.render(); }, (i) => i === 1);
    const by = 215 + LEARN.length * 132 + 22;
    p.btn(W - 44 - 200, by, 200, 70, 'Continue', 'go', () => {
      if (pLearn < 0) { dMsg = 'Choose a topic to continue.'; dash.render(); }
      else if (pLearn === 1) toDesk();
      else { dMsg = 'Coming soon. This prototype has the café ordering module only.'; dash.render(); }
    }, { weight: 400, color: '#5f6f75' });
    p.text(dMsg, 44, by + 4, 30, COL.bad, 600, W - 340);
  }
}).place(-0.65, 1.35, -1.75);

/* info desk: low-poly airport arrivals hall (built in airport3d.js) */
const desk = new THREE.Group(); scene.add(desk);
const rec = buildAirport({ parent: desk, renderer, FONT }).rec;

/* flow */
function boot() {
  const go = new URLSearchParams(location.search).get('start'); // e.g. ?start=cafe, ?start=pay, ?start=street, ?start=dash, ?start=desk
  if (go === 'cafe' || go === 'pay') { loadScript(CAFE); mode = 'cafe'; first = 0; setScene('cafe'); turn = go === 'pay' ? 2 : 0; return go === 'pay' ? next() : startTurn(); }
  if (go === 'street') return setScene('street');
  if (go === 'dash') { dState = 'lang'; return setScene('dash'); }
  if (go === 'desk') return toDesk();
  setScene('load');
  later(2600, () => { setScene('signin'); later(3800, () => { setScene('welcome'); later(2800, () => transition(() => { dState = 'lang'; setScene('dash'); })); }); });
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
  transition(() => setScene('level'));
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
const cupHint = new Panel(.85, .2, (p) => {
  const c = p.ctx, W = p.cv.width, M = 60;
  p.fit(M * 2 + p.tm(cupMsg, 46, 700, W - 140));
  scrim(c, 30, 20, W - 60, p.cv.height - 40, .55, 50, 70);
  glow(c); p.ttext(cupMsg, 70, M, 46, GL, 700, W - 140); glow(c, false);
}, 850).soft({ edge: 'top', dy: .1, dist: 1.15, dx: .62 });
function resetCup() {
  cupLive = false; cupHeld = null; cupG.visible = false; saucer.visible = true;
  cupG.position.set(.55, 1.052, -1.98); cupG.scale.setScalar(1.3); cupHint.snap();
}
function grabCup(c) {
  if (!cupLive) return;
  cupLive = false; cupHeld = c || 'mouse'; cupG.scale.setScalar(1); saucer.visible = false;
  try { c.userData.src.gamepad.hapticActuators[0].pulse(.7, 90); } catch (e) {}
  cupMsg = 'Santé! Bon appétit!'; cupHint.hide(); setTimeout(() => { cupHint.render(); cupHint.show(0); }, 420);
  later(2800, () => { cupHint.hide(); transition(() => setScene('result')); });
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
function iconPlay(c, cx, cy, k, hv) {
  c.save(); c.translate(cx, cy); c.scale(k, k);
  iconLayer(c, () => roundPoly(c, [[-50, -100], [-50, 100], [90, 0]], 14), hv, 24);
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
  const W = p.cv.width, H = p.cv.height, havePause = HUD_PAUSE.includes(cur), kP = .9, kA = .92;
  if (havePause) { // pause icon normally; while paused or in settings it becomes a play icon that resumes
    p.hits.push({ x: W / 2 - 120, y: H * .25 - 150, w: 240, h: 300, id: 'pause', fn: () => (modal ? closeModal() : openModal('pause')) });
    (modal ? iconPlay : iconPause)(p.ctx, W / 2, H * .25, kP, p.hover === 'pause');
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
  if ((cur === 'cafe' || cur === 'desk') && stage.valid) { // sits just right of the dialogue, in the same place all step
    const dx = 1.22 * (A.big ? 1.25 : 1), d = 1.0, y = stage.ey + .08; // right of the dialogue column
    hud.mesh.position.set(stage.ex + stage.fx * d - stage.fz * dx, y, stage.ez + stage.fz * d + stage.fx * dx);
    hud.mesh.lookAt(stage.ex, y, stage.ez);
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
const ovDome = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ color: '#070d10', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
ovDome.renderOrder = 900; ovDome.frustumCulled = false; // drawn over the whole scene, under the pause/settings text
const OV_DARK = .74; // how dark the dimmed screen gets (0 to 1)
const ov = new THREE.Group(); ov.add(ovDome); ov.visible = false; scene.add(ov);
let ovA = 0, ovTarget = 0, ovPanels = []; // ovPanels: scene cards that fade out while the screen is dimmed // current / target dissolve amount, animated in the main loop
const GREY = '#d3dde0', LT = '#ffffff', TL = '#62d6dc'; // light text for the dimmed background
function arrowL(c, x, y, w, col) {
  c.strokeStyle = col; c.lineWidth = 3.5; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x + w, y); c.lineTo(x, y); c.moveTo(x + 18, y - 17); c.lineTo(x, y); c.lineTo(x + 18, y + 17); c.stroke();
}
const pauseP = new Panel(.9, .7, (p) => {
  const c = p.ctx, W = p.cv.width, H = p.cv.height, cy = H / 2;
  p.vtext('RESUME', W / 2, cy - 135, 44, p.hover === 'resume' ? TL : GREY, 400, 400, 'center');
  p.vtext('Paused', W / 2, cy, 92, TL, 700, W, 'center');
  c.font = `400 44px ${FONT}`;
  const tw = c.measureText('EXIT MODULE').width, tot = 52 + 24 + tw, x0 = W / 2 - tot / 2, hv = p.hover === 'exit';
  arrowL(c, x0, cy + 135, 52, hv ? TL : LT);
  p.vtext('EXIT MODULE', x0 + 76, cy + 135, 44, hv ? TL : GREY, 400, 500, 'left');
  p.hits.push({ x: W / 2 - 170, y: cy - 190, w: 340, h: 110, id: 'resume', fn: closeModal });
  p.hits.push({ x: x0 - 30, y: cy + 80, w: tot + 60, h: 110, id: 'exit', fn: goHome });
});
const A_ROWS = [['en', 'English translations', 'Show English under every French line'], ['big', 'Larger panels', 'Make cards and menus bigger'], ['slow', 'Slower speech', 'The barista speaks more slowly'], ['seat', 'Seated mode', 'Raises your view if you are sitting'], ['calm', 'Reduce motion', 'No screen fades between scenes']];
const CATS = [['DISPLAY', 'Display', ['big', 'seat', 'calm']], ['LANGUAGE', 'Language', ['en']], ['DIFFICULTY', 'Difficulty', ['slow']]];
let a11yCat = null;
const a11yBack = () => { if (a11yCat !== null) { a11yCat = null; a11yP.render(); } else if (a11yFrom === 'pause') openModal('pause'); else closeModal(); };
const a11yP = new Panel(.9, .9, (p) => {
  const c = p.ctx, W = p.cv.width, cx = W / 2, cat = a11yCat === null ? null : CATS[a11yCat];
  arrowL(c, cx - 26, 150, 52, p.hover === 'back' ? TL : LT);
  p.hits.push({ x: cx - 90, y: 95, w: 180, h: 110, id: 'back', fn: a11yBack });
  p.vtext(cat ? cat[1] : 'Accessibility', cx, 330, 92, TL, 700, W, 'center');
  if (!cat) CATS.forEach(([label], i) => {
    const y = 490 + i * 100;
    p.vtext(label, cx, y, 44, p.hover === 'c' + i ? TL : GREY, 400, W, 'center');
    p.hits.push({ x: cx - 260, y: y - 45, w: 520, h: 90, id: 'c' + i, fn: () => { a11yCat = i; p.render(); } });
  });
  else cat[2].forEach((k, i) => {
    const gap = cat[2].length > 2 ? 175 : 200, row = A_ROWS.find((r) => r[0] === k), y = 470 + i * gap, on = A[k], hv = p.hover === 'k' + k;
    p.vtext(row[1].toUpperCase(), cx, y, 44, hv ? TL : GREY, 400, W - 120, 'center');
    p.vtext(on ? 'ON' : 'OFF', cx, y + 62, 40, on ? TL : '#8a979c', 700, W, 'center');
    p.vtext(row[2], cx, y + 118, 28, '#aab7bc', 400, W - 160, 'center');
    p.hits.push({ x: 90, y: y - 50, w: W - 180, h: gap - 10, id: 'k' + k, fn: () => { A[k] = !A[k]; applyA(); } });
  });
});
pauseP.noScale = a11yP.noScale = true;
[pauseP, a11yP, hud].forEach((q) => { q.mesh.renderOrder = 1000; q.mesh.material.depthTest = false; });
function ovPlace() {
  camera.updateWorldMatrix(true, false); camera.getWorldPosition(o3); camera.getWorldDirection(d3); d3.y = 0;
  if (d3.lengthSq() < 1e-4) d3.set(0, 0, -1);
  d3.normalize();
  const hy = o3.y, hx = o3.x, hz = o3.z;
  ov.position.set(hx, hy, hz);
  [pauseP, a11yP].forEach((q) => { q.mesh.position.set(hx + d3.x * 1.5, hy, hz + d3.z * 1.5); q.mesh.lookAt(hx, hy, hz); q.mesh.scale.setScalar(A.big ? 1.45 : 1.25); });
}
function modalRestore() {
  ov.visible = false; ovA = ovTarget = 0; ovDome.material.opacity = 0;
  ovPanels.forEach((q) => { q.mod = 1; q.applyOpacity(); q.mesh.visible = true; }); ovPanels = [];
  pauseP.mesh.visible = a11yP.mesh.visible = false;
  [pauseP, a11yP].forEach((q) => { q.mesh.material.opacity = 1; });
}
function openModal(kind, from) {
  stopListening();
  if (!modal) {
    try { synth && synth.pause(); curAudio && curAudio.pause(); } catch (e) {}
    ovPanels = panels.filter((q) => q.mesh.visible && q !== hud && q !== pauseP && q !== a11yP);
    ovPlace();
  }
  modal = kind; paused = true; a11yFrom = from || null; a11yCat = null;
  ov.visible = true; ovTarget = 1;
  pauseP.mesh.visible = kind === 'pause'; a11yP.mesh.visible = kind === 'a11y';
  [pauseP, a11yP].forEach((q) => { q.mesh.material.opacity = ovA; });
  hudPlace(); hud.render(); (kind === 'pause' ? pauseP : a11yP).render();
}
function closeModal() {
  modal = null; paused = false; ovTarget = 0; hudPlace(); hud.render(); // the dim fades out in the main loop, then modalRestore() runs
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
  if (bubble.ft) syncLine();
  [bubble, choices, fbP, micP, a11yP, pauseP].forEach((p) => p.mesh.visible && p.render());
  try { localStorage.setItem('fvr-a11y', JSON.stringify(A)); } catch (e) {}
}

/* ---------- payment: tap your card on the terminal ---------- */
const PAY_Z = -1.4;
const v3 = new THREE.Vector3(), w3 = new THREE.Vector3();
let payOn = false, payDone = true, payHolder = null, payNear = 0, mouseTerm = null, actx = null;
const card3d = room.makeCard();
const payHint = new Panel(.85, .3, (p) => {
  const c = p.ctx, W = p.cv.width, M = 50, t1 = 'Tap your card on the terminal to pay.', t2 = 'You can also point at the terminal and pull the trigger.';
  const b1 = M + p.tm(t1, 40, 700, W - 140), t2top = b1 + 14, b2 = t2top + p.tm(t2, 28, 400, W - 140), by = b2 + 34;
  p.fit(by + 72 + M);
  scrim(c, 30, 20, W - 60, p.cv.height - 40, .55, 50, 70);
  glow(c); p.ttext(t1, 70, M, 40, '#fff', 700, W - 140); p.ttext(t2, 70, t2top, 28, GG, 400, W - 140); glow(c, false);
  p.pill(60, by, 220, 72, 'Skip', 'skiptap', tapDone);
}, 850).soft({ edge: 'top', dy: -.02, dist: 1.15, dx: .62 });
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
    rig.position.z = PAY_Z; hideTalk(true);
    room.terminal.setState('pay');
    payHolder = pickHand(); payNear = 0; payOn = true;
    if (payHolder === 'mouse') { camera.add(card3d); card3d.position.set(.2, -.2, -.55); card3d.rotation.set(1.0, 0, -.15); card3d.scale.setScalar(1.5); }
    else { payHolder.add(card3d); card3d.position.set(0, -.012, -.1); card3d.rotation.set(0, 0, 0); card3d.scale.setScalar(1); }
    stageSet(true, true); payHint.render(); payHint.show(.9);
    bubbleFr = p.fr; bubbleEn = p.en; showEn = true; talking = true; syncLine();
    speak(p.fr, 'audio/pay.mp3', () => { talking = false; });
  });
}
function tapDone() {
  if (!payOn || payDone) return;
  payDone = true;
  room.terminal.setState('ok'); beep();
  try { if (payHolder && payHolder !== 'mouse') payHolder.userData.src.gamepad.hapticActuators[0].pulse(.8, 120); } catch (e) {}
  payHint.hide();
  bubbleFr = 'Parfait, c’est approuvé. Merci!'; bubbleEn = 'Perfect, it’s approved. Thank you!'; showEn = true; talking = true; syncLine();
  speak(bubbleFr, 'audio/pay_ok.mp3', () => { talking = false; });
  later(2800, endPayment);
}
function endPayment() {
  transition(() => {
    rig.position.z = 0; payHint.snap(); hideTalk(true); card3d.removeFromParent(); payOn = false; payHolder = null;
    room.terminal.setState('idle'); room.terminal.ring.visible = false;
    startTurn();
  });
}
function resetPay() {
  payOn = false; payDone = true; payHolder = null; payNear = 0;
  rig.position.z = 0; card3d.removeFromParent(); payHint.snap();
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
const intersect = () => ray.intersectObjects(panels.filter((p) => shown(p.mesh) && (!p.f || (p.ft > 0 && p.fa > .3)) && (!modal || p === hud || p === pauseP || p === a11yP)).map((p) => p.mesh), false)[0];
const clickHit = (h) => { const p = h.object.userData.panel; if (modal && p !== hud && p !== pauseP && p !== a11yP) return; const b = p.at(h.uv); if (b) b.fn(); };

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
  const rawDt = Math.min(clock.getDelta(), .1), dt = rawDt * (paused ? 0 : 1), t = clock.elapsedTime, talkNow = talking && !paused;
  for (const p of panels) if (p.f) { // soft dissolve of floating panels
    if (p.fd > 0) p.fd -= rawDt;
    else if (p.fa !== p.ft) p.fa = p.ft > p.fa ? Math.min(1, p.fa + rawDt / .8) : Math.max(0, p.fa - rawDt / .5);
    p.applyOpacity();
    if (p.fa === 0 && p.ft === 0 && p.mesh.visible) p.mesh.visible = false;
  }
  if (ov.visible && ovA !== ovTarget) { // soft dissolve of the dimmed pause / settings screen
    ovA = ovTarget > ovA ? Math.min(1, ovA + rawDt / .5) : Math.max(0, ovA - rawDt / .4);
    const e = ovA * ovA * (3 - 2 * ovA);
    ovDome.material.opacity = OV_DARK * e;
    [pauseP, a11yP].forEach((q) => { q.mesh.material.opacity = e; });
    ovPanels.forEach((q) => { q.mod = 1 - e; q.applyOpacity(); q.mesh.visible = e < 1; }); // fully dimmed: the scene's panels are removed so nothing can cover the menu
    if (ovA === 0 && ovTarget === 0) modalRestore();
  }
  if (sign.mesh.visible) { // dissolve between the two sign-in frames
    if (cur === 'signin' && sgMix > 0) { sgMix = 0; sign.render(); }
    const tg = cur === 'welcome' ? 1 : 0;
    if (sgMix !== tg) { sgMix = tg > sgMix ? Math.min(tg, sgMix + dt / 1.1) : Math.max(tg, sgMix - dt / 1.1); sign.render(); }
  }
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
    fade.material.opacity = ease(Math.max(0, Math.min(1, a)));
    if (!fadeT.done && fadeT.t >= .4) { fadeT.fn(); fadeT.done = true; }
    if (fadeT.t >= .8) { fade.material.opacity = 0; fadeT = null; }
  }
  renderer.render(scene, camera);
});
