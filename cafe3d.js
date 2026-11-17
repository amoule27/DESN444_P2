// Realistic café interior for "Un cortado à Rosemont".
// Everything here is generated in code (no downloads): PBR materials with procedural textures,
// a sun streaming through the storefront with real shadows, warm pendant lamps, and props.
// buildCafe() returns helpers that main.js uses (terminal, steam, outside view, standard material).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = (seed) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const cnv = (w, h = w) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; };

export function buildCafe({ parent, renderer, FONT }) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mkTex = (cv, srgb = true) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const clamp = (t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const tiled = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

  /* ---------- image-based light (soft reflections) + material factory ---------- */
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const S = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: .35, ...o });

  /* ---------- procedural textures ---------- */
  function texWood() {
    const R = rng(11), [cv, c] = cnv(1024), ph = 128;
    const pal = ['#a9794b', '#9c6e44', '#b3834f', '#8d6139', '#a37448', '#b88b5b'];
    const plank = (x, y, len, seed) => {
      const r = rng(seed);
      c.fillStyle = pal[(r() * pal.length) | 0]; c.fillRect(x, y, len, ph);
      const g = c.createLinearGradient(0, y, 0, y + ph); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.09)');
      c.fillStyle = g; c.fillRect(x, y, len, ph);
      for (let i = 0; i < 44; i++) {
        const yy = y + r() * ph;
        c.strokeStyle = r() < .55 ? `rgba(55,32,14,${.05 + r() * .1})` : `rgba(235,205,165,${.04 + r() * .07})`;
        c.lineWidth = .6 + r() * 1.5;
        c.beginPath(); c.moveTo(x, yy);
        c.bezierCurveTo(x + len * .3, yy + (r() - .5) * 8, x + len * .7, yy + (r() - .5) * 8, x + len, yy + (r() - .5) * 6); c.stroke();
      }
      if (r() < .3) { c.fillStyle = 'rgba(60,35,16,.35)'; c.beginPath(); c.ellipse(x + len * (.2 + r() * .6), y + ph * (.3 + r() * .4), 9 + r() * 8, 4 + r() * 3, 0, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(25,14,6,.6)'; c.fillRect(x, y, 2.5, ph);
    };
    for (let row = 0; row < 8; row++) {
      let x = R() * 1024, rem = 1024;
      while (rem > 1) {
        let len = Math.min(rem, 330 + R() * 320); if (rem - len < 220) len = rem;
        const seed = (R() * 1e9) | 0;
        plank(x, row * ph, len, seed);
        if (x + len > 1024) plank(x - 1024, row * ph, len, seed);
        x = (x + len) % 1024; rem -= len;
      }
      c.fillStyle = 'rgba(25,14,6,.55)'; c.fillRect(0, row * ph, 1024, 2.5);
    }
    return mkTex(cv);
  }
  function texBrick() {
    const [cv, c] = cnv(1024), bw = 1024 / 6, bh = 64;
    const pal = ['#8e4f3b', '#9a5640', '#7f4636', '#a5614a', '#8a5642', '#733f31', '#b06a4f'];
    c.fillStyle = '#b3a99a'; c.fillRect(0, 0, 1024, 1024);
    const brick = (x, y, seed) => {
      const r = rng(seed);
      c.fillStyle = pal[(r() * pal.length) | 0]; c.beginPath(); c.roundRect(x + 3, y + 3, bw - 6, bh - 6, 4); c.fill();
      for (let i = 0; i < 60; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.09)' : 'rgba(255,220,190,.09)'; c.fillRect(x + 4 + r() * (bw - 10), y + 4 + r() * (bh - 10), 1 + r() * 3, 1 + r() * 2); }
      const g = c.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.14)');
      c.fillStyle = g; c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    };
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let i = -1; i < 7; i++) brick(i * bw + off, row * bh, row * 100 + (((i % 6) + 6) % 6));
    }
    return mkTex(cv);
  }
  function texTile() {
    const [cv, c] = cnv(1024), tw = 128, th = 64;
    c.fillStyle = '#c4c4bf'; c.fillRect(0, 0, 1024, 1024);
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? tw / 2 : 0;
      for (let i = -1; i < 9; i++) {
        const r = rng(row * 50 + (((i % 8) + 8) % 8)), x = i * tw + off, y = row * th, sh = 240 + r() * 12;
        c.fillStyle = `rgb(${sh},${sh},${sh - 3})`; c.beginPath(); c.roundRect(x + 2, y + 2, tw - 4, th - 4, 6); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 5, y + th - 5); c.lineTo(x + 5, y + 4); c.lineTo(x + tw - 5, y + 4); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.09)'; c.beginPath(); c.moveTo(x + tw - 4, y + 6); c.lineTo(x + tw - 4, y + th - 4); c.lineTo(x + 5, y + th - 4); c.stroke();
      }
    }
    return mkTex(cv);
  }
  function texPlaster(base, seed) {
    const r = rng(seed), [cv, c] = cnv(512);
    c.fillStyle = base; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) { const x = r() * 512, y = r() * 512, g = c.createRadialGradient(x, y, 0, x, y, 90 + r() * 120); const dark = r() < .5; g.addColorStop(0, dark ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 512, 512); }
    for (let i = 0; i < 5000; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; c.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    return mkTex(cv);
  }
  function texMarble() {
    const r = rng(21), [cv, c] = cnv(1024);
    c.fillStyle = '#efeee9'; c.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 26; i++) { const x = r() * 1024, y = r() * 1024, g = c.createRadialGradient(x, y, 0, x, y, 140 + r() * 160); g.addColorStop(0, 'rgba(120,125,130,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 1024, 1024); }
    c.shadowColor = 'rgba(80,85,90,.4)'; c.shadowBlur = 3;
    for (let v = 0; v < 14; v++) {
      let x = r() * 1024, y = r() * 1024, a = r() * 6.28; c.lineWidth = .6 + r() * 2; c.strokeStyle = `rgba(95,100,108,${.12 + r() * .28})`; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 26; k++) { a += (r() - .5) * .9; x += Math.cos(a) * 34; y += Math.sin(a) * 34; c.lineTo(x, y); } c.stroke();
    }
    return mkTex(cv);
  }
  function texSlats() {
    const r = rng(33), [cv, c] = cnv(512), pal = ['#4a3223', '#3f2a1d', '#523826', '#46301f'];
    for (let i = 0; i < 8; i++) {
      const x = i * 64; c.fillStyle = pal[(r() * 4) | 0]; c.fillRect(x, 0, 64, 512);
      for (let k = 0; k < 26; k++) { const xx = x + 3 + r() * 58; c.strokeStyle = r() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,220,180,.07)'; c.lineWidth = .6 + r() * 1.4; c.beginPath(); c.moveTo(xx, 0); c.bezierCurveTo(xx + (r() - .5) * 6, 170, xx + (r() - .5) * 6, 340, xx, 512); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x, 0, 3, 512);
    }
    return mkTex(cv);
  }
  const radial = (size, stops) => { const [cv, c] = cnv(size), g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, size, size); return clamp(mkTex(cv)); };
  const aoTex = radial(128, [[0, 'rgba(0,0,0,.85)'], [.55, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]);
  const glowTex = radial(128, [[0, 'rgba(255,225,170,1)'], [.25, 'rgba(255,200,130,.45)'], [1, 'rgba(255,190,110,0)']]);
  const steamTex = radial(64, [[0, 'rgba(255,255,255,.9)'], [.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
  const aoLineTex = (() => { const [cv, c] = cnv(8, 128), g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 8, 128); return clamp(mkTex(cv)); })();

  const woodT = texWood(), brickT = texBrick(), tileT = texTile(), marbleT = texMarble(), slatsT = texSlats();

  /* chalkboard menu + poster: redrawn once fonts are loaded */
  const [chalkCv, chalk] = cnv(1024, 560), chalkTex = clamp(mkTex(chalkCv));
  const drawChalk = () => {
    const c = chalk, r = rng(7); c.clearRect(0, 0, 1024, 560);
    c.fillStyle = '#222725'; c.fillRect(0, 0, 1024, 560);
    for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(255,255,255,${.012 + r() * .02})`; c.lineWidth = 20 + r() * 50; c.beginPath(); c.moveTo(r() * 1024, r() * 560); c.lineTo(r() * 1024, r() * 560); c.stroke(); }
    const ink = (a) => `rgba(246,245,238,${a})`;
    c.textBaseline = 'top'; c.textAlign = 'center'; c.fillStyle = ink(.95); c.font = 'italic 700 78px Georgia, serif'; c.fillText('Café Rosemont', 512, 22);
    c.strokeStyle = ink(.7); c.lineWidth = 3; c.beginPath(); c.moveTo(300, 112); c.bezierCurveTo(420, 104, 600, 120, 724, 110); c.stroke();
    const rows = [['Espresso', '3,00 $'], ['Cortado', '3,75 $'], ['Café filtre', '2,75 $'], ['Latté', '4,75 $'], ['Chocolat chaud', '4,25 $'], ['Croissant', '3,25 $'], ['Pain au chocolat', '3,50 $']];
    c.font = `500 44px ${FONT}`;
    rows.forEach(([n, p], i) => {
      const y = 140 + i * 59, hot = n === 'Cortado';
      c.fillStyle = ink(hot ? 1 : .88); c.textAlign = 'left'; c.fillText(n, 90, y); c.textAlign = 'right'; c.fillText(p, 934, y);
      c.fillStyle = ink(.35); for (let x = 90 + c.measureText(n).width + 14; x < 934 - c.measureText(p).width - 14; x += 12) c.fillRect(x, y + 36, 3, 3);
      if (hot) { c.strokeStyle = ink(.8); c.lineWidth = 3; c.beginPath(); c.roundRect(70, y - 6, 884, 56, 14); c.stroke(); }
    });
    chalkTex.needsUpdate = true;
  };
  const [posterCv, pc] = cnv(600, 800), posterTex = clamp(mkTex(posterCv));
  const drawPoster = () => {
    pc.fillStyle = '#f1e7d3'; pc.fillRect(0, 0, 600, 800);
    pc.fillStyle = '#e0a84a'; pc.beginPath(); pc.arc(300, 290, 150, 0, 7); pc.fill();
    pc.fillStyle = '#2f4a40'; [[60, 470, 90, 200], [160, 400, 110, 270], [290, 440, 80, 230], [380, 360, 120, 310], [510, 450, 80, 220]].forEach(([x, y, w, h]) => pc.fillRect(x, y, w, h));
    pc.fillStyle = '#1b2a26'; pc.fillRect(0, 640, 600, 160);
    pc.fillStyle = '#f1e7d3'; pc.textAlign = 'center'; pc.textBaseline = 'middle'; pc.font = `700 78px ${FONT}`; pc.fillText('MONTRÉAL', 300, 700); pc.font = `400 30px ${FONT}`; pc.fillText('Quartier Rosemont', 300, 765);
    posterTex.needsUpdate = true;
  };
  drawChalk(); drawPoster();

  /* ---------- materials ---------- */
  const mFloor = S({ map: tiled(woodT, 6.25, 6.8), bumpMap: tiled(woodT, 6.25, 6.8), bumpScale: 1.4, roughness: .5, envMapIntensity: .45 });
  const mBrick = S({ map: tiled(brickT, 6.5, 3.2), bumpMap: tiled(brickT, 6.5, 3.2), bumpScale: 3, roughness: .92, envMapIntensity: .2 });
  const mTile = S({ map: tiled(tileT, 5, 1.2), roughness: .22, envMapIntensity: .6 });
  const mGreen = S({ map: tiled(texPlaster('#35523f', 3), 3, 1.5), roughness: .95, envMapIntensity: .15 });
  const mCream = S({ map: tiled(texPlaster('#eae2d3', 4), 3, 1.6), roughness: .95, envMapIntensity: .15 });
  const mCeil = S({ map: tiled(texPlaster('#efe9df', 5), 3, 3), roughness: .95, envMapIntensity: .1 });
  const mSlat = S({ map: tiled(slatsT, 8, 1), bumpMap: tiled(slatsT, 8, 1), bumpScale: 1.5, roughness: .55, envMapIntensity: .3 });
  const mMarble = S({ map: marbleT, roughness: .18, envMapIntensity: .7 });
  const mOak = S({ color: '#a77b4e', roughness: .55, envMapIntensity: .3 });
  const mDark = S({ color: '#3a2a20', roughness: .6, envMapIntensity: .3 });
  const mSteel = S({ color: '#b9bdc2', metalness: 1, roughness: .28, envMapIntensity: 1.1 });
  const mBlack = S({ color: '#17191c', metalness: .7, roughness: .38, envMapIntensity: .6 });
  const mWhite = S({ color: '#f4f1ec', roughness: .22, envMapIntensity: .5 });
  const mGlass = new THREE.MeshStandardMaterial({ color: '#d6ecf2', roughness: .03, metalness: 0, transparent: true, opacity: .09, envMap: env, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const mLeaf = S({ color: '#2f5d34', roughness: .45, envMapIntensity: .4, side: THREE.DoubleSide });
  const mTerra = S({ color: '#a65a3a', roughness: .85, envMapIntensity: .15 });

  /* ---------- tiny builders ---------- */
  const put = (grp, geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; grp.add(m); return m; };
  const mesh = (geo, mat, x, y, z, cast, recv) => put(parent, geo, mat, x, y, z, cast, recv);
  const bx = (w, h, d, mat, x, y, z, cast = true) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);
  const cyl = (rt, rb, h, mat, x, y, z, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);

  /* ---------- the room shell ---------- */
  mesh(new THREE.PlaneGeometry(6, 6.5).rotateX(-Math.PI / 2), mFloor, 0, 0, -1.75, false, true);
  const ceil = mesh(new THREE.PlaneGeometry(6, 6.5).rotateX(Math.PI / 2), mCeil, 0, 3.2, -1.75, true, false);
  ceil.material.shadowSide = THREE.DoubleSide;
  [-4, -2, 0].forEach((z) => bx(6, .2, .16, mDark, 0, 3.1, z, false));
  mesh(new THREE.PlaneGeometry(6, 1.45), mTile, 0, .725, -5, false, true);
  mesh(new THREE.PlaneGeometry(6, 1.75), mGreen, 0, 2.325, -5, false, true);
  bx(6, .05, .04, mOak, 0, 1.46, -4.98, false);
  mesh(new THREE.PlaneGeometry(6.5, 3.2).rotateY(-Math.PI / 2), mBrick, 3, 1.6, -1.75, false, true);
  mesh(new THREE.PlaneGeometry(6, 3.2).rotateY(Math.PI), mCream, 0, 1.6, 1.5, false, true);
  bx(6, .12, .02, mWhite, 0, .06, 1.49, false);

  /* storefront on the left wall: knee wall, piers, steel frames, glass, door */
  const X = -3.06;
  bx(.12, .5, 5.15, mGreen, X, .25, -2.425);
  bx(.12, .3, 6.5, mCream, X, 3.05, -1.75);
  bx(.12, 2.4, .4, mCream, X, 1.7, -4.8);
  bx(.12, 2.4, .25, mCream, X, 1.7, .025);
  bx(.12, 2.9, .4, mCream, X, 1.45, 1.3);
  const Xw = -3.0;
  const post = (z, y0, y1) => bx(.07, y1 - y0, .05, mBlack, Xw, (y0 + y1) / 2, z);
  const rail = (z0, z1, y, th = .05) => bx(.07, th, z1 - z0, mBlack, Xw, y, (z0 + z1) / 2);
  [-4.6, -3.475, -2.35, -1.225, -.1].forEach((z) => post(z, .5, 2.9));
  rail(-4.6, -.1, .5); rail(-4.6, -.1, 2.25); rail(-4.6, -.1, 2.9);
  post(.15, 0, 2.9); post(1.1, 0, 2.9); rail(.15, 1.1, 2.25); rail(.15, 1.1, 2.9); bx(.07, .22, .95, mBlack, Xw, .11, .625); rail(.15, 1.1, 1.0, .04);
  cyl(.014, .014, .7, mSteel, Xw + .06, 1.05, .98, 12);
  const pane = (z0, z1, y0, y1) => mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0).rotateY(Math.PI / 2), mGlass, Xw, (y0 + y1) / 2, (z0 + z1) / 2, false, false);
  pane(-4.6, -.1, .5, 2.9); pane(.15, 1.1, 0, 2.9);
  bx(.2, .04, 4.55, mOak, -2.9, .52, -2.35, false);
  { // "OUVERT" sign hanging on the door glass
    const [cv, c] = cnv(256, 128); c.fillStyle = '#1b1512'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#ff8a6a'; c.lineWidth = 5; c.strokeRect(8, 8, 240, 112);
    c.fillStyle = '#ff9a7a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 60px ${FONT}`; c.fillText('OUVERT', 128, 66);
    const t = clamp(mkTex(cv)); mesh(new THREE.PlaneGeometry(.3, .15).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.DoubleSide }), Xw + .03, 1.7, .62, false, false);
  }

  /* the view outside: your Rosemont 360 photo shows through the windows when it is available */
  const [skyCv, sc] = cnv(8, 256), sg = sc.createLinearGradient(0, 0, 0, 256);
  sg.addColorStop(0, '#6fb4ef'); sg.addColorStop(.5, '#cfe6f7'); sg.addColorStop(.52, '#9a948a'); sg.addColorStop(1, '#6e6a64');
  sc.fillStyle = sg; sc.fillRect(0, 0, 8, 256);
  const outside = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 32).scale(-1, 1, 1), new THREE.MeshBasicMaterial({ map: clamp(mkTex(skyCv)), fog: false, toneMapped: false }));
  outside.position.y = 1.6; outside.rotation.y = Math.PI / 2; parent.add(outside);
  const setOutside = (tex) => { outside.material.map = tex; outside.material.needsUpdate = true; };

  /* ---------- light: sun through the window, fill, pendants ---------- */
  const sun = new THREE.DirectionalLight(0xfff0d8, 8);
  sun.position.set(-9, 6.5, -1.5); sun.target.position.set(0, 0, -2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 24 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .02;
  parent.add(sun, sun.target);
  parent.add(new THREE.HemisphereLight(0xfff1de, 0x7a6048, 1.0));

  const lamps = [];
  const mShade = S({ color: '#1d1f22', metalness: .6, roughness: .35, side: THREE.DoubleSide }), mBulb = new THREE.MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false });
  const pendant = (x, z, int) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    put(g, new THREE.CylinderGeometry(.004, .004, .65, 6), mBlack, 0, 2.885, 0, false);
    const shade = put(g, new THREE.SphereGeometry(.17, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mShade, 0, 2.4, 0, false);
    shade.receiveShadow = false;
    put(g, new THREE.SphereGeometry(.045, 14, 10), mBulb, 0, 2.37, 0, false, false);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: .8 }));
    sp.position.set(0, 2.3, 0); sp.scale.setScalar(.55); g.add(sp);
    const l = new THREE.PointLight(0xffc88a, int, 0, 2); l.position.set(0, 2.28, 0); g.add(l); lamps.push(l);
  };
  pendant(-.9, -1.3, 2.2); pendant(.9, -1.3, 2.2); pendant(-.4, -3.3, 3);

  /* fake soft shadows on the floor (contact shadows) */
  const aoMats = {};
  const aoMat = (op) => aoMats[op] || (aoMats[op] = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: op, depthWrite: false, toneMapped: false }));
  const aoLineMat = new THREE.MeshBasicMaterial({ map: aoLineTex, transparent: true, depthWrite: false, toneMapped: false });
  const aoBlob = (x, z, w, d, op = .5) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), aoMat(op)); m.position.set(x, .004, z); parent.add(m); };
  [[0, -5, 6, 0], [3, -1.75, 6.5, -Math.PI / 2], [0, 1.5, 6, Math.PI], [-3, -1.75, 6.5, Math.PI / 2]].forEach(([x, z, len, ang]) => {
    const g = new THREE.Group(); g.position.set(x, .005, z); g.rotation.y = ang; parent.add(g);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, .7).rotateX(-Math.PI / 2), aoLineMat); m.position.z = .35; g.add(m);
  });

  /* ---------- counter, espresso bar ---------- */
  bx(3.2, 1.0, .7, mSlat, .4, .5, -2.2);
  bx(3.4, .05, .85, mMarble, .4, 1.025, -2.2);
  aoBlob(.4, -2.2, 3.9, 1.3, .55);

  const mach = new THREE.Group(); mach.position.set(-.6, 1.05, -2.15); parent.add(mach);
  put(mach, new THREE.BoxGeometry(.8, .4, .5), mSteel, 0, .2, 0);
  put(mach, new THREE.BoxGeometry(.82, .03, .52), mBlack, 0, .415, 0);
  put(mach, new THREE.BoxGeometry(.8, .02, .5), mBlack, 0, .01, 0);
  [-.18, .18].forEach((x) => {
    put(mach, new THREE.CylinderGeometry(.034, .034, .05, 16), mBlack, x, .2, -.27);
    put(mach, new THREE.CylinderGeometry(.03, .026, .035, 16), mSteel, x, .15, -.28);
    put(mach, new THREE.BoxGeometry(.02, .02, .13), mBlack, x, .15, -.36);
  });
  put(mach, new THREE.CylinderGeometry(.04, .04, .012, 24), mWhite, .3, .3, .253).rotation.x = Math.PI / 2;
  put(mach, new THREE.BoxGeometry(.78, .03, .2), mBlack, 0, .02, -.36);
  put(mach, new THREE.CylinderGeometry(.01, .01, .22, 8), mSteel, .35, .22, -.2);
  [-.27, -.09, .09, .27].forEach((x) => { put(mach, new THREE.CylinderGeometry(.04, .03, .06, 16), mWhite, x, .475, .02); });
  put(mach, new THREE.BoxGeometry(.7, .26, .01), mBlack, 0, .2, .252);
  for (let i = 0; i < 7; i++) put(mach, new THREE.BoxGeometry(.62, .007, .014), mSteel, 0, .1 + i * .035, .256, false);
  put(mach, new THREE.BoxGeometry(.9, .014, .02), mSteel, 0, .43, .25, false); put(mach, new THREE.BoxGeometry(.9, .014, .02), mSteel, 0, .43, -.25, false);
  put(mach, new THREE.BoxGeometry(.14, .032, .006), S({ color: '#b8935a', metalness: 1, roughness: .3, envMapIntensity: 1 }), -.25, .36, .255, false);
  put(mach, new THREE.CylinderGeometry(.015, .015, .04, 12), mBlack, -.3, .3, .26).rotation.x = Math.PI / 2;
  const espCup = put(mach, new THREE.CylinderGeometry(.036, .028, .05, 16), mWhite, 0, .07, -.37);
  const grinder = new THREE.Group(); grinder.position.set(-1.09, 1.05, -2.3); parent.add(grinder);
  put(grinder, new THREE.BoxGeometry(.19, .08, .26), mBlack, 0, .04, 0);
  put(grinder, new THREE.CylinderGeometry(.07, .09, .26, 18), mSteel, 0, .2, 0);
  put(grinder, new THREE.CylinderGeometry(.095, .055, .2, 18), S({ color: '#2b1c12', transparent: true, opacity: .75, roughness: .2 }), 0, .43, 0, false);
  const jug = cyl(.045, .035, .13, mSteel, -.08, 1.05 + .065, -2.4, 16);

  /* pastry case */
  put(parent, new THREE.BoxGeometry(.8, .05, .5), mBlack, 1.5, 1.075, -2.2);
  const g4 = (w, h, d, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mGlass, x, y, z, false, false);
  g4(.8, .005, .5, 1.5, 1.46, -2.2); g4(.8, .36, .005, 1.5, 1.28, -1.95); g4(.8, .36, .005, 1.5, 1.28, -2.45); g4(.005, .36, .5, 1.1, 1.28, -2.2); g4(.005, .36, .5, 1.9, 1.28, -2.2);
  bx(.76, .012, .44, mWhite, 1.5, 1.27, -2.2, false);
  const mCroi = S({ color: '#c98a3d', roughness: .55, envMapIntensity: .2 }), mPain = S({ color: '#a6652a', roughness: .55, envMapIntensity: .2 });
  const croissant = (x, y, z, ry) => { const m = put(parent, new THREE.TorusGeometry(.04, .019, 10, 18, Math.PI * 1.05), mCroi, x, y + .02, z); m.rotation.set(-Math.PI / 2, 0, ry); m.scale.set(1, 1, .85); };
  const pain = (x, y, z, ry) => { const m = put(parent, new THREE.CapsuleGeometry(.02, .07, 4, 8), mPain, x, y + .022, z); m.rotation.set(0, ry, Math.PI / 2); m.scale.set(1, 1, 1.4); };
  [[1.25, 1.1, -2.1], [1.45, 1.1, -2.3], [1.65, 1.1, -2.1], [1.75, 1.1, -2.32]].forEach(([x, y, z], i) => croissant(x, y, z, i * 1.3));
  [[1.3, 1.285, -2.3], [1.52, 1.285, -2.12], [1.72, 1.285, -2.3]].forEach(([x, y, z], i) => pain(x, y, z, i * .4));
  croissant(1.5, 1.285, -2.3, 2.1);

  /* ---------- back wall: bar, shelves, chalkboard ---------- */
  bx(5.6, .9, .6, mDark, 0, .45, -4.65); bx(5.7, .04, .66, mOak, 0, .92, -4.65);
  aoBlob(0, -4.4, 5.8, .8, .5);
  { // kettle, canisters, cups on the back bar
    const k = new THREE.Group(); k.position.set(1.4, .94, -4.65); parent.add(k);
    put(k, new THREE.CylinderGeometry(.09, .1, .12, 20), mBlack, 0, .06, 0); put(k, new THREE.CylinderGeometry(.09, .09, .06, 20), mBlack, 0, .15, 0);
    const sp = put(k, new THREE.CylinderGeometry(.01, .012, .2, 8), mBlack, .13, .16, 0); sp.rotation.z = -.9;
    [2.0, 2.2, 2.4].forEach((x, i) => cyl(.06, .06, .16 + i * .03, mWhite, x, .94 + .08 + i * .015, -4.7, 18));
    [-2.4, -2.2].forEach((x) => cyl(.05, .05, .2, mSteel, x, 1.04, -4.72, 18));
  }
  const shelf = (y) => { bx(2.7, .035, .24, mOak, -1.5, y, -4.88, false); [-2.7, -.3].forEach((x) => bx(.03, .16, .2, mBlack, x, y - .1, -4.88, false)); };
  shelf(1.8); shelf(2.2);
  for (let i = 0; i < 9; i++) cyl(.04, .03, .075, mWhite, -2.75 + i * .095, 1.8 + .055, -4.88, 16);
  [['#5a3a22', -1.85], ['#6b4428', -1.7], ['#3d2a1a', -1.55]].forEach(([col, x]) => {
    cyl(.055, .055, .15, new THREE.MeshStandardMaterial({ color: '#cfe0e4', transparent: true, opacity: .28, roughness: .08, envMap: env, depthWrite: false }), x - 0, 1.8 + .095, -4.88, 16);
    cyl(.05, .05, .1, S({ color: col, roughness: .8 }), x, 1.8 + .07, -4.88, 16);
  });
  [['#b98e5b', -1.2], ['#3a5c4a', -1.08], ['#c25a3c', -.96], ['#b98e5b', -.84]].forEach(([col, x]) => { bx(.09, .15, .05, S({ color: col, roughness: .75 }), x, 1.8 + .095, -4.88, false); });
  [-2.7, -2.5, -2.35].forEach((x, i) => bx(.035, .22 - i * .02, .15, S({ color: ['#2f4a6b', '#b3452e', '#d8c9a8'][i], roughness: .8 }), x, 2.2 + .125, -4.88, false));
  const miniPlant = (x, y, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
    put(g, new THREE.CylinderGeometry(.05, .04, .09, 14), mTerra, 0, .045, 0);
    for (let i = 0; i < 7; i++) { const lf = put(g, new THREE.SphereGeometry(1, 10, 8), mLeaf, Math.cos(i * 2.4) * .03, .13 + (i % 3) * .03, Math.sin(i * 2.4) * .03, false); lf.scale.set(.025, .06, .012); lf.rotation.set(.3 * Math.sin(i), i * 2.4, .5 * Math.cos(i)); }
  };
  miniPlant(-1.1, 2.2 + .02, -4.88); miniPlant(-2.55, .54, -4.0, 1.1); miniPlant(-2.55, .54, -2.9, 1.0); miniPlant(-2.55, .54, -1.3, 1.2);

  bx(2.2, 1.2, .05, mDark, 1.8, 2.05, -4.96);
  mesh(new THREE.PlaneGeometry(2.05, 1.05), new THREE.MeshBasicMaterial({ map: chalkTex, toneMapped: false }), 1.8, 2.05, -4.93, false, false);
  bx(.06, .03, .15, mOak, 1.8, 1.42, -4.9, false);

  /* ---------- seating ---------- */
  const mCushion = S({ color: '#2f6b6a', roughness: .5, envMapIntensity: .3 });
  bx(.5, .42, 2.8, mDark, 2.7, .21, -.05); bx(.5, .09, 2.8, mCushion, 2.7, .465, -.05); bx(.12, .5, 2.8, mCushion, 2.92, .85, -.05).rotation.z = -.12;
  aoBlob(2.65, -.05, .9, 3.2, .5);
  const table = (x, z, round) => {
    if (round) { cyl(.35, .35, .035, mMarble, x, .74, z, 28); cyl(.03, .03, .7, mBlack, x, .37, z, 12); cyl(.2, .22, .03, mBlack, x, .015, z, 20); }
    else { bx(.62, .04, .62, mOak, x, .74, z); cyl(.03, .03, .7, mBlack, x, .37, z, 12); cyl(.2, .22, .03, mBlack, x, .015, z, 20); }
    aoBlob(x, z, 1.3, 1.3, .45);
    const sc2 = cyl(.05, .036, .06, mWhite, x - .08, .79 + .03, z + .05, 16); const sa = cyl(.07, .06, .012, mWhite, x - .08, .76 + .014, z + .05, 20);
    return { sc2, sa };
  };
  const chair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    put(g, new THREE.CylinderGeometry(.2, .2, .04, 22), mDark, 0, .46, 0);
    [[-.13, -.13], [.13, -.13], [-.13, .13], [.13, .13]].forEach(([a, b]) => put(g, new THREE.CylinderGeometry(.012, .01, .46, 8), mDark, a, .23, b, true));
    const back = put(g, new THREE.TorusGeometry(.19, .014, 8, 24, Math.PI * .9), mDark, 0, .74, 0); back.rotation.set(-Math.PI / 2, 0, Math.PI * .05);
    [-.14, .14].forEach((a) => put(g, new THREE.CylinderGeometry(.01, .01, .3, 8), mDark, a, .6, -.14));
    aoBlob(x, z, .6, .6, .5);
  };
  table(-2.4, -1.0, true); chair(-2.4, -.45, Math.PI); chair(-2.4, -1.55, 0);
  table(-2.4, -3.3, true); chair(-2.4, -2.75, Math.PI); chair(-2.4, -3.85, 0);
  table(1.95, -.6, false); chair(1.3, -.6, Math.PI / 2); table(1.95, .75, false); chair(1.3, .75, Math.PI / 2);

  /* plants */
  const mLeaf2 = S({ color: '#3a6f3c', roughness: .4, side: THREE.DoubleSide });
  const plant = (x, z, h) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    put(g, new THREE.CylinderGeometry(.2, .15, .38, 22), mTerra, 0, .19, 0); put(g, new THREE.CylinderGeometry(.195, .195, .02, 22), S({ color: '#2a1d14', roughness: 1 }), 0, .37, 0, false);
    put(g, new THREE.CylinderGeometry(.018, .025, h, 8), S({ color: '#5b4a33', roughness: .8 }), 0, h / 2, 0, false);
    const r = rng(Math.floor(x * 100 + z * 10 + 77));
    for (let i = 0; i < 26; i++) {
      const y = .4 + (i / 26) * (h - .4), yaw = r() * 6.28, tilt = .15 + r() * .9;
      const gy = new THREE.Group(); gy.position.y = y; gy.rotation.y = yaw; g.add(gy);
      const gt = new THREE.Group(); gt.rotation.x = -tilt; gy.add(gt);
      const lf = put(gt, new THREE.SphereGeometry(1, 12, 8), mLeaf, 0, 0, .14, false); lf.scale.set(.075, .012, .16);
      lf.material = i % 3 ? mLeaf : mLeaf2;
    }
    aoBlob(x, z, .8, .8, .5);
  };
  plant(-2.6, 1.05, 1.5); plant(2.65, -4.55, 1.3);

  /* art */
  bx(.04, .92, .72, mDark, 2.96, 1.8, -2.75, false);
  mesh(new THREE.PlaneGeometry(.62, .82).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: posterTex, toneMapped: false }), 2.935, 1.8, -2.75, false, false);
  bx(.5, .62, .04, mDark, 0, 1.9, 1.47, false);
  mesh(new THREE.PlaneGeometry(.42, .54).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: posterTex, toneMapped: false }), 0, 1.9, 1.445, false, false);
  { // wall clock
    const [cv, c] = cnv(256); c.fillStyle = '#f6f3ec'; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill(); c.strokeStyle = '#26332d'; c.lineWidth = 8; c.stroke();
    c.fillStyle = '#26332d'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 3, 6, 6); }
    c.lineCap = 'round'; c.lineWidth = 9; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(2.4) * 56, 128 - Math.cos(2.4) * 56); c.stroke();
    c.lineWidth = 6; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(.3) * 84, 128 - Math.cos(.3) * 84); c.stroke();
    mesh(new THREE.PlaneGeometry(.42, .42).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: clamp(mkTex(cv)), transparent: true, toneMapped: false }), -1.3, 2.2, 1.46, false, false);
  }
  bx(1.1, .035, .2, mOak, 1.3, 1.5, 1.4, false); [.85, 1.75].forEach((x) => bx(.03, .14, .16, mBlack, x, 1.42, 1.4, false));
  miniPlant(1.0, 1.52, 1.4, 1.2); miniPlant(1.6, 1.52, 1.4, 1.0);
  [-1.6, -4.0].forEach((z) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: .6 })); sp.position.set(2.88, 2.3, z); sp.scale.setScalar(.4); parent.add(sp); put(parent, new THREE.SphereGeometry(.04, 12, 8), mBulb, 2.9, 2.3, z, false, false); });

  /* ---------- steam ---------- */
  const steams = [];
  const steam = (grp, x, y, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, y, z); grp.add(g);
    const puffs = [];
    for (let i = 0; i < 5; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false })); sp.userData.ph = i / 5; g.add(sp); puffs.push(sp); }
    steams.push({ puffs, s });
    return g;
  };
  steam(mach, 0, .1, -.37, 1);
  const update = (t) => {
    for (const st of steams) st.puffs.forEach((sp, i) => {
      const ph = (t * .28 + sp.userData.ph) % 1, s = st.s;
      sp.position.set(Math.sin(t * .9 + i * 2) * .012 * s, ph * .22 * s, 0);
      const k = (.05 + ph * .11) * s; sp.scale.set(k, k, 1); sp.material.opacity = Math.sin(ph * Math.PI) * .28;
    });
  };

  /* ---------- the card terminal (portable, on the counter in front of the customer) ---------- */
  const terminal = (() => {
    const tilt = .55, g = new THREE.Group(); g.position.set(.12, 1.27, -1.98); g.rotation.x = tilt; parent.add(g);
    cyl(.012, .012, .2, mBlack, .12, 1.15, -1.985, 10); cyl(.055, .06, .014, mBlack, .12, 1.057, -1.98, 24);
    put(g, new THREE.BoxGeometry(.09, .025, .17), S({ color: '#26292d', roughness: .45, metalness: .2 }), 0, 0, 0);
    const [scv, c] = cnv(256, 384), stex = clamp(mkTex(scv));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(.07, .105).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }));
    scr.position.set(0, .0132, -.03); g.add(scr);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) put(g, new THREE.BoxGeometry(.014, .004, .01), S({ color: r === 3 ? ['#b3452e', '#c9b34a', '#2e8f64'][k] : '#8a8f94', roughness: .5 }), (k - 1) * .022, .0145, .034 + r * .0145, false);
    const leds = [0, 1, 2, 3].map((i) => put(g, new THREE.BoxGeometry(.008, .003, .005), new THREE.MeshBasicMaterial({ color: '#444', toneMapped: false }), (i - 1.5) * .016, .0135, -.0825, false, false));
    let state = 'idle';
    const draw = () => {
      const ok = state === 'ok', pay = state === 'pay';
      c.fillStyle = ok ? '#0b7a55' : '#0f2a31'; c.fillRect(0, 0, 256, 384);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      if (pay) {
        c.font = `500 26px ${FONT}`; c.fillStyle = '#9fd8dc'; c.fillText('TOTAL', 128, 46);
        c.fillStyle = '#fff'; c.font = `700 70px ${FONT}`; c.fillText('4,31 $', 128, 112);
        c.strokeStyle = '#6fe0e6'; c.lineWidth = 8; c.lineCap = 'round';
        [28, 52, 76].forEach((r) => { c.beginPath(); c.arc(86, 240, r, -.7, .7); c.stroke(); });
        c.fillStyle = '#6fe0e6'; c.beginPath(); c.arc(86, 240, 9, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.font = `600 30px ${FONT}`; c.fillText('Appuyez ici', 128, 330);
        c.font = `400 22px ${FONT}`; c.fillStyle = '#9fd8dc'; c.fillText('Tap here', 128, 362);
      } else if (ok) {
        c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(72, 150); c.lineTo(112, 192); c.lineTo(188, 108); c.stroke();
        c.font = `700 40px ${FONT}`; c.fillText('Approuvé', 128, 270); c.font = `400 24px ${FONT}`; c.fillText('Approved', 128, 312);
      } else { c.fillStyle = '#6fa8ad'; c.font = `500 30px ${FONT}`; c.fillText('Prêt', 128, 192); }
      stex.needsUpdate = true;
      leds.forEach((l) => l.material.color.set(ok ? '#38e08a' : pay ? '#4aa3ff' : '#444'));
    };
    draw();
    const anchor = new THREE.Object3D(); anchor.position.set(0, .07, -.015); g.add(anchor);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(anchor.position); g.add(hit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.1, .0035, 8, 40), new THREE.MeshBasicMaterial({ color: '#1F9AA0', toneMapped: false, transparent: true, opacity: .9 }));
    ring.position.copy(anchor.position); ring.rotation.x = -Math.PI / 2 - tilt; ring.visible = false; g.add(ring);
    return {
      group: g, anchor, hit, ring,
      setState(s) { state = s; draw(); },
      redraw() { draw(); },
      tick(t, active, near) { ring.visible = active; if (!active) return; ring.scale.setScalar(1 + .1 * Math.sin(t * 5)); ring.material.color.set(near ? '#0B9A6D' : '#1F9AA0'); },
    };
  })();

  /* a payment card to hold in your hand (generic design, no real brand) */
  const makeCard = () => {
    const [cv, c] = cnv(512, 323), g = c.createLinearGradient(0, 0, 512, 323);
    g.addColorStop(0, '#1F9AA0'); g.addColorStop(1, '#1d3b44'); c.fillStyle = g; c.fillRect(0, 0, 512, 323);
    const sh = c.createLinearGradient(0, 0, 512, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.16)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, 0, 512, 323);
    c.fillStyle = '#e3c26a'; c.beginPath(); c.roundRect(48, 104, 84, 64, 10); c.fill(); c.strokeStyle = 'rgba(90,60,10,.5)'; c.lineWidth = 2; c.strokeRect(62, 116, 56, 40);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 6; c.lineCap = 'round'; [14, 26, 38].forEach((r) => { c.beginPath(); c.arc(430, 136, r, -.8, .8); c.stroke(); });
    c.fillStyle = '#fff'; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.font = `600 38px ${FONT}`; c.fillText('••••  ••••  ••••  4242', 48, 230);
    c.font = `500 26px ${FONT}`; c.fillText('ALEX', 48, 284); c.textAlign = 'right'; c.fillText('12/28', 464, 284);
    const face = S({ map: clamp(mkTex(cv)), roughness: .35, metalness: .1 }), side = S({ color: '#e8eef0', roughness: .4 }), back = S({ color: '#dfe6e8', roughness: .5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(.0856, .0016, .054), [side, side, face, back, side, side]);
    m.scale.setScalar(1.8); m.castShadow = true;
    const grp = new THREE.Group(); grp.add(m); return grp;
  };

  /* fewer draw calls: merge static meshes that share a material (keeps the Quest at a steady frame rate) */
  const skip = new Set([terminal.group]);
  parent.updateMatrixWorld(true);
  const inv = parent.matrixWorld.clone().invert(), buckets = new Map();
  parent.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== parent; p = p.parent) if (skip.has(p)) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  buckets.forEach((list) => {
    if (list.length < 2) return;
    const geos = list.map((o) => o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
    list.forEach((o) => { o.removeFromParent(); o.geometry.dispose(); });
    parent.add(mm);
  });

  const refresh = () => { drawChalk(); drawPoster(); terminal.redraw(); };

  return { S, env, setOutside, update, steam, terminal, makeCard, refresh, lamps, sun };
}
