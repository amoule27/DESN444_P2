// Realistic airport arrivals hall with an information desk, built with the same techniques as the café (cafe3d.js):
// PBR materials with procedural textures, a sun streaming through the window wall with real shadows,
// recessed ceiling lights, contact shadows, glass reflections, and merged geometry for a steady Quest frame rate.
// The visitor stands at (0, 0, 0) facing -Z. Dialogue panels float in front of the desk (z > -2), so keep that area clear.
// buildAirport() returns { rec } (the receptionist: .head and .mouth are animated by main.js) plus the sun light.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rng = (seed) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const cnv = (w, h = w) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; };

const TEAL = '#1F8F96', NAVY = '#26343f', ORANGE = '#e8923a';

export function buildAirport({ parent, renderer, FONT }) {
  const g = new THREE.Group(); parent.add(g);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mkTex = (cv, srgb = true) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const clamp = (t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const tiled = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

  /* ---------- image-based light + material factory ---------- */
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const S = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: .35, ...o });

  /* ---------- procedural textures ---------- */
  function texPorcelain() { // large polished porcelain tiles with soft veining and grout lines (2 x 2 tiles)
    const r = rng(5), [cv, c] = cnv(1024), t = 512;
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * t, y0 = ty * t, sh = 178 + r() * 14;
      c.fillStyle = `rgb(${sh},${sh - 2},${sh - 6})`; c.fillRect(x0, y0, t, t);
      for (let i = 0; i < 7; i++) { const x = x0 + r() * t, y = y0 + r() * t, gr = c.createRadialGradient(x, y, 0, x, y, 120 + r() * 140); gr.addColorStop(0, r() < .5 ? 'rgba(120,118,112,.07)' : 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x0, y0, t, t); }
      c.save(); c.beginPath(); c.rect(x0, y0, t, t); c.clip(); c.lineCap = 'round';
      for (let v = 0; v < 6; v++) {
        let x = x0 + r() * t, y = y0 + r() * t, a = r() * 6.28; c.lineWidth = .5 + r() * 1.6; c.strokeStyle = `rgba(110,108,104,${.07 + r() * .16})`; c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 18; k++) { a += (r() - .5) * .8; x += Math.cos(a) * 30; y += Math.sin(a) * 30; c.lineTo(x, y); } c.stroke();
      }
      for (let i = 0; i < 700; i++) { c.fillStyle = r() < .5 ? 'rgba(90,88,84,.10)' : 'rgba(255,255,255,.12)'; c.fillRect(x0 + r() * t, y0 + r() * t, 1 + r() * 2, 1 + r() * 2); }
      c.restore();
      c.strokeStyle = 'rgba(70,68,64,.85)'; c.lineWidth = 5; c.strokeRect(x0 + 2.5, y0 + 2.5, t - 5, t - 5);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 7, y0 + t - 7); c.lineTo(x0 + 7, y0 + 7); c.lineTo(x0 + t - 7, y0 + 7); c.stroke();
    }
    return mkTex(cv);
  }
  function texAcoustic() { // one 0.6 m ceiling tile: fissured mineral board with a recessed edge
    const r = rng(9), [cv, c] = cnv(512);
    c.fillStyle = '#ecebe6'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { c.fillStyle = r() < .6 ? `rgba(60,60,55,${.05 + r() * .12})` : 'rgba(255,255,255,.35)'; c.fillRect(r() * 512, r() * 512, 1 + r() * 4, 1 + r() * 1.4); }
    c.strokeStyle = 'rgba(40,40,38,.7)'; c.lineWidth = 6; c.strokeRect(3, 3, 506, 506);
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.strokeRect(9, 9, 494, 494);
    return mkTex(cv);
  }
  function texPlaster(base, seed) {
    const r = rng(seed), [cv, c] = cnv(512);
    c.fillStyle = base; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) { const x = r() * 512, y = r() * 512, gr = c.createRadialGradient(x, y, 0, x, y, 90 + r() * 120); gr.addColorStop(0, r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 512, 512); }
    for (let i = 0; i < 5000; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; c.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    return mkTex(cv);
  }
  function texWood() { // light oak veneer
    const r = rng(11), [cv, c] = cnv(512), pal = ['#c79a66', '#bd8f5c', '#d1a574', '#b98857'];
    c.fillStyle = pal[0]; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) { c.fillStyle = pal[(r() * pal.length) | 0]; c.fillRect(0, i * 64, 512, 64); c.fillStyle = 'rgba(40,22,8,.35)'; c.fillRect(0, i * 64, 512, 2); }
    for (let i = 0; i < 160; i++) { const y = r() * 512; c.strokeStyle = r() < .55 ? `rgba(70,40,15,${.05 + r() * .1})` : `rgba(255,230,190,${.05 + r() * .07})`; c.lineWidth = .6 + r() * 1.4; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(170, y + (r() - .5) * 8, 340, y + (r() - .5) * 8, 512, y + (r() - .5) * 6); c.stroke(); }
    return mkTex(cv);
  }
  function texStone() { // pale quartz counter
    const r = rng(21), [cv, c] = cnv(512);
    c.fillStyle = '#e9e8e4'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12; i++) { const x = r() * 512, y = r() * 512, gr = c.createRadialGradient(x, y, 0, x, y, 100 + r() * 100); gr.addColorStop(0, 'rgba(120,125,130,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 512, 512); }
    for (let i = 0; i < 2500; i++) { c.fillStyle = r() < .5 ? 'rgba(90,92,96,.14)' : 'rgba(255,255,255,.4)'; c.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5); }
    return mkTex(cv);
  }
  function texAsphalt() {
    const r = rng(41), [cv, c] = cnv(512);
    c.fillStyle = '#74777a'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const s = 90 + r() * 70; c.fillStyle = `rgba(${s},${s},${s + 4},${.2 + r() * .3})`; c.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
    return mkTex(cv);
  }
  const radial = (size, stops) => { const [cv, c] = cnv(size), gr = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); c.fillStyle = gr; c.fillRect(0, 0, size, size); return clamp(mkTex(cv)); };
  const aoTex = radial(128, [[0, 'rgba(0,0,0,.85)'], [.55, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]);
  const aoLineTex = (() => { const [cv, c] = cnv(8, 128), gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 8, 128); return clamp(mkTex(cv)); })();

  const porcT = texPorcelain(), acouT = texAcoustic(), woodT = texWood(), stoneT = texStone(), asphT = texAsphalt();

  /* ---------- materials ---------- */
  const HW = 7, ZB = 4, ZF = -9, H = 4;                 // half-width, back wall z, front (window) wall z, height
  const zc = (ZB + ZF) / 2, zl = ZB - ZF;
  const mFloor = S({ map: tiled(porcT, HW * 2 / 2.4, zl / 2.4), bumpMap: tiled(porcT, HW * 2 / 2.4, zl / 2.4), bumpScale: .8, roughness: .22, envMapIntensity: .5 });
  const mCeil = S({ map: tiled(acouT, HW * 2 / .6, zl / .6), roughness: .95, envMapIntensity: .1 });
  const mWall = S({ map: tiled(texPlaster('#e6e3dc', 4), 4, 1.6), roughness: .92, envMapIntensity: .15 });
  const mWallLt = S({ map: tiled(texPlaster('#f1efea', 6), 3, 1.6), roughness: .92, envMapIntensity: .15 });
  const mTeal = S({ color: TEAL, roughness: .45, envMapIntensity: .4 });
  const mNavy = S({ color: NAVY, roughness: .5, envMapIntensity: .35 });
  const mOrange = S({ color: ORANGE, roughness: .5, envMapIntensity: .3 });
  const mWood = S({ map: woodT, roughness: .5, envMapIntensity: .3 });
  const mWoodD = S({ map: tiled(woodT, 1, 1), color: '#a67545', roughness: .55, envMapIntensity: .3 });
  const mStone = S({ map: stoneT, roughness: .16, envMapIntensity: .8 });
  const mWhite = S({ color: '#f3f2ee', roughness: .38, envMapIntensity: .45 });
  const mDark = S({ color: '#1f2428', roughness: .55, envMapIntensity: .4 });
  const mBlack = S({ color: '#15181b', metalness: .7, roughness: .38, envMapIntensity: .6 });
  const mSteel = S({ color: '#b9bdc2', metalness: 1, roughness: .28, envMapIntensity: 1.1 });
  const mGrey = S({ color: '#9aa3a9', roughness: .5, envMapIntensity: .4 });
  const mGlass = new THREE.MeshStandardMaterial({ color: '#d6ecf2', roughness: .03, metalness: 0, transparent: true, opacity: .1, envMap: env, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const mLeaf = S({ color: '#2f6a37', roughness: .45, envMapIntensity: .4, side: THREE.DoubleSide });
  const mLeaf2 = S({ color: '#3c7a41', roughness: .4, envMapIntensity: .4, side: THREE.DoubleSide });
  const mPot = S({ color: '#f1f0ec', roughness: .35, envMapIntensity: .5 });
  const mSoil = S({ color: '#2a1d14', roughness: 1 });
  const mLight = new THREE.MeshBasicMaterial({ color: '#fffaf0', toneMapped: false });

  /* ---------- tiny builders ---------- */
  const put = (grp, geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; grp.add(m); return m; };
  const bx = (w, h, d, mat, x, y, z, cast = true, grp = g) => put(grp, new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);
  const cyl = (rt, rb, h, mat, x, y, z, grp = g, seg = 20) => put(grp, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
  const plane = (w, h, mat, x, y, z, rx = 0, ry = 0, cast = false) => { const m = put(g, new THREE.PlaneGeometry(w, h), mat, x, y, z, cast, true); m.rotation.set(rx, ry, 0); return m; };
  function sign(w, h, px, draw, x, y, z, ry = 0, grp = g) { // lit sign: unaffected by scene lighting
    const [cv, c] = cnv(px, Math.round(px * h / w)); draw(c, cv.width, cv.height);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: clamp(mkTex(cv)), toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = ry; grp.add(m); return m;
  }
  const rr = (c, x, y, w, h, r, fill) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); };
  const aoMat = (op) => new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: op, depthWrite: false, toneMapped: false });
  const aoLineMat = new THREE.MeshBasicMaterial({ map: aoLineTex, transparent: true, depthWrite: false, toneMapped: false });
  const aoBlob = (x, z, w, d, op = .5) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), aoMat(op)); m.position.set(x, .004, z); g.add(m); };

  /* ---------- outside: sky, apron, hangars, parked airliner (seen through the windows) ---------- */
  {
    const geo = new THREE.SphereGeometry(95, 24, 16), col = [], top = new THREE.Color('#6fa6d6'), hor = new THREE.Color('#e3eef5'), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, p.getY(i) / 70)); const c = hor.clone().lerp(top, k); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false })));
  }
  const mApron = S({ map: tiled(asphT, 14, 5), roughness: .9, envMapIntensity: .1 });
  const mGrass = S({ color: '#7a9a4d', roughness: 1, envMapIntensity: .05 });
  const ground = (w, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat); m.position.set(x, y, z); g.add(m); };
  ground(220, 50, mApron, 0, -.03, -34); ground(220, 70, mGrass, 0, -.04, -84);
  const mPaint = S({ color: '#e9c24a', roughness: .8, envMapIntensity: .1 });
  bx(.25, .01, 40, mPaint, -6, -.02, -26, false); bx(80, .01, .25, mPaint, 0, -.02, -22, false);
  const mHangar = S({ color: '#b9bec2', roughness: .6, metalness: .3, envMapIntensity: .6 }), mRoof = S({ color: '#a3a9ae', roughness: .5, metalness: .4, envMapIntensity: .7 });
  const hangar = (x, z, w, s) => {
    const h = new THREE.Group(); h.position.set(x, 0, z); g.add(h);
    bx(w, 5 * s, 10 * s, mHangar, 0, 2.5 * s, 0, false, h);
    const roof = put(h, new THREE.CylinderGeometry(5 * s, 5 * s, w, 20, 1, false, 0, Math.PI), mRoof, 0, 5 * s, 0, false); roof.rotation.z = Math.PI / 2; roof.scale.set(.6, 1, 1);
    bx(w, .5 * s, .3, mTeal, 0, 4.2 * s, 5.1 * s, false, h);
    for (let i = -2; i <= 2; i++) bx(.08, 3.6 * s, .1, mDark, i * (w / 5), 1.9 * s, 5.1 * s, false, h);
  };
  hangar(-22, -36, 22, 1.2); hangar(18, -44, 18, 1.2); hangar(-4, -52, 26, 1.3);
  { // airliner
    const a = new THREE.Group(); a.position.set(5, 0, -21); g.add(a);
    const mBody = S({ color: '#f3f5f6', roughness: .3, metalness: .15, envMapIntensity: .9 });
    const fus = put(a, new THREE.CapsuleGeometry(1.05, 11, 6, 20), mBody, 0, 2.4, 0, false); fus.rotation.z = Math.PI / 2;
    bx(11.5, .22, .06, mTeal, 0, 2.05, 1.06, false, a); bx(11.5, .22, .06, mTeal, 0, 2.05, -1.06, false, a);
    bx(.9, .28, .06, mDark, 5.3, 2.8, 1.0, false, a); bx(.9, .28, .06, mDark, 5.3, 2.8, -1.0, false, a);
    bx(2.6, .14, 15, mBody, .5, 1.9, 0, false, a);
    bx(1.8, 2.4, .14, mTeal, -5.6, 4.3, 0, false, a).rotation.z = -.35;
    bx(1.6, .1, 4.6, mBody, -5.7, 3.4, 0, false, a);
    for (const z of [-3.6, 3.6]) put(a, new THREE.CylinderGeometry(.6, .6, 1.5, 20), S({ color: '#cfd5d9', metalness: .6, roughness: .3, envMapIntensity: .9 }), 1.2, 1.4, z, false).rotation.z = Math.PI / 2;
    bx(.12, 1.3, .12, mGrey, 3.6, .65, 0, false, a); bx(.12, 1.3, .12, mGrey, -.8, .65, 1.4, false, a); bx(.12, 1.3, .12, mGrey, -.8, .65, -1.4, false, a);
  }

  /* ---------- hall shell ---------- */
  plane(HW * 2, zl, mFloor, 0, 0, zc, -Math.PI / 2);
  const ceil = plane(HW * 2, zl, mCeil, 0, H, zc, Math.PI / 2, 0, true); ceil.material.shadowSide = THREE.DoubleSide;
  for (const sx of [-1, 1]) {
    plane(zl, H, mWall, sx * HW, H / 2, zc, 0, -sx * Math.PI / 2);                       // side walls
    bx(.05, .16, zl, mDark, sx * (HW - .03), .08, zc, false);                              // skirting
    bx(.05, .14, zl, mTeal, sx * (HW - .03), 3.2, zc, false);                              // teal band
    bx(2.2, .5, zl, mGrey, sx * (HW - 1.1), H - .25, zc);                                  // soffit
    bx(.06, .5, zl, mTeal, sx * (HW - 2.2), H - .25, zc, false);
    bx(.35, .01, zl, mTeal, sx * 5.4, .006, zc, false);                                    // floor guide line
  }
  plane(HW * 2, H, mWall, 0, H / 2, ZB, 0, Math.PI);                                        // wall behind the visitor
  bx(HW * 2, .14, .06, mTeal, 0, 3.2, ZB - .03, false); bx(HW * 2, .16, .06, mDark, 0, .08, ZB - .03, false);
  sign(4.2, .8, 1024, (c, w, h) => {
    rr(c, 0, 0, w, h, 40, TEAL); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${h * .5}px ${FONT}`; c.fillText('Bienvenue à Montréal', w / 2, h * .42);
    c.font = `500 ${h * .22}px ${FONT}`; c.fillText('Welcome to Montréal', w / 2, h * .8);
  }, 0, 2.3, ZB - .1, Math.PI);

  // window wall: knee wall, steel mullions, glass, transom
  bx(HW * 2, .9, .22, mWallLt, 0, .45, ZF); bx(HW * 2, .16, .24, mDark, 0, .08, ZF + .01, false);
  bx(HW * 2, .7, .22, mWallLt, 0, 3.65, ZF); bx(HW * 2, .14, .24, mTeal, 0, 3.3, ZF + .01, false);
  for (let x = -HW; x <= HW; x += 2) bx(.14, 2.5, .16, mBlack, x, 2.15, ZF);
  bx(HW * 2, .06, .18, mBlack, 0, .93, ZF); bx(HW * 2, .06, .18, mBlack, 0, 3.27, ZF);
  bx(HW * 2, .04, .5, mWood, 0, .93, ZF + .3, false);                                          // window sill
  plane(HW * 2, 2.4, mGlass, 0, 2.1, ZF + .02);

  // ceiling: recessed light panels (emissive) with frames, plus a bulkhead above the desk
  for (const x of [-4, -1.3, 1.3, 4]) {
    bx(.5, .05, zl - .6, mDark, x, H - .03, zc, false);
    put(g, new THREE.BoxGeometry(.38, .02, zl - .7), mLight, x, H - .06, zc, false, false);
  }
  bx(HW * 2 - 4.4, .45, .3, mWallLt, 0, H - .22, -4.8);

  // wayfinding signs on the side walls
  const wayfind = (x, z, ry, fr, en) => sign(2.2, .6, 768, (c, w, h) => {
    rr(c, 0, 0, w, h, 26, NAVY); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = `700 ${h * .36}px ${FONT}`; c.fillText(fr, h * .45, h * .36); c.font = `500 ${h * .24}px ${FONT}`; c.fillStyle = '#cfe9ec'; c.fillText(en, h * .45, h * .74);
    c.strokeStyle = ORANGE; c.lineWidth = h * .09; c.lineCap = 'round'; c.lineJoin = 'round'; const ax = w - h * .7, ay = h / 2;
    c.beginPath(); c.moveTo(ax - h * .25, ay); c.lineTo(ax + h * .25, ay); c.moveTo(ax + h * .06, ay - h * .19); c.lineTo(ax + h * .25, ay); c.lineTo(ax + h * .06, ay + h * .19); c.stroke();
  }, x, 2.55, z, ry);
  wayfind(-HW + .04, -3, Math.PI / 2, 'Arrivées', 'Arrivals'); wayfind(HW - .04, -3, -Math.PI / 2, 'Sortie', 'Exit');

  // welcome mat where the visitor stands
  put(g, new THREE.CylinderGeometry(1.15, 1.15, .012, 48), S({ color: '#d4eaec', roughness: .95, envMapIntensity: .1 }), 0, .008, -.1, false);
  { const r = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 48), mTeal); r.rotation.x = -Math.PI / 2; r.position.set(0, .016, -.1); r.receiveShadow = true; g.add(r); }
  [[0, ZF, HW * 2, 0], [HW, zc, zl, -Math.PI / 2], [0, ZB, HW * 2, Math.PI], [-HW, zc, zl, Math.PI / 2]].forEach(([x, z, len, ang]) => { // soft contact shadow along the walls
    const grp = new THREE.Group(); grp.position.set(x, .005, z); grp.rotation.y = ang; g.add(grp);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, .6).rotateX(-Math.PI / 2), aoLineMat); m.position.z = .3; grp.add(m);
  });

  /* ---------- light: sun through the window wall, fill, warm desk lights ---------- */
  const sun = new THREE.DirectionalLight(0xfff0d8, 4.5);
  sun.position.set(-7, 8.5, -17); sun.target.position.set(0, 0, -2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  g.add(sun, sun.target);
  g.add(new THREE.HemisphereLight(0xeaf3fa, 0x9a9488, .6));
  [[-2.2, -2.2], [2.2, -2.2]].forEach(([x, z]) => { const l = new THREE.PointLight(0xfff0dc, 1.4, 0, 2); l.position.set(x, 3.4, z); g.add(l); });

  /* ---------- the information desk ---------- */
  const DZ = -2.4;
  bx(5.2, 2.9, .15, mWhite, 0, 1.45, -4.0);                                  // backdrop panel
  bx(5.3, .18, .3, mTeal, 0, 2.9, -3.95); bx(5.2, .1, .1, mDark, 0, .05, -3.95);
  for (let i = 0; i < 5; i++) bx(.12, 2.5, .08, mWoodD, 1.75 + i * .2, 1.3, -3.9);        // wood slats
  sign(2.3, .75, 768, (c, w, h) => {
    c.fillStyle = '#f6f5f1'; c.fillRect(0, 0, w, h); c.fillStyle = TEAL; c.fillRect(0, 0, w, h * .1);
    c.fillStyle = NAVY; c.font = `700 ${h * .42}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Bienvenue', w / 2, h * .55);
  }, -1.0, 1.9, -3.9);
  for (const x of [-1.0, 1.0]) cyl(.015, .015, 1.0, mSteel, x, 3.5, DZ - .5, g, 8); // hanging sign wires
  bx(2.9, .9, .12, mNavy, 0, 2.98, DZ - .5);
  sign(2.8, .8, 1024, (c, w, h) => {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    c.fillStyle = ORANGE; c.beginPath(); c.arc(h * .5, h * .5, h * .34, 0, 7); c.fill();
    c.fillStyle = NAVY; c.font = `700 ${h * .5}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('i', h * .5, h * .53);
    c.fillStyle = '#fff'; c.textAlign = 'left';
    c.font = `700 ${h * .36}px ${FONT}`; c.fillText('Information', h * 1.0, h * .36);
    c.font = `500 ${h * .26}px ${FONT}`; c.fillStyle = '#cfe9ec'; c.fillText('Renseignements', h * 1.0, h * .7);
  }, 0, 2.98, DZ - .43);
  const mSlat = S({ map: tiled(woodT, 4, 1), roughness: .5, envMapIntensity: .3, color: '#d8b48a' });
  bx(4.6, 1.0, .7, mSlat, 0, .5, DZ);                                         // counter body (wood front)
  bx(4.62, .3, .02, mTeal, 0, .6, DZ + .36, false); bx(4.62, .1, .72, mDark, 0, .05, DZ);
  bx(5.0, .06, .98, mStone, 0, 1.03, DZ);                                     // quartz top
  bx(.9, .72, .5, mWhite, 2.55, .36, DZ - .1); bx(1.0, .05, .6, mStone, 2.55, .74, DZ - .1);
  aoBlob(0, DZ, 5.8, 1.7, .55); aoBlob(2.55, DZ - .1, 1.5, 1.1, .4);
  // desk props: monitor (lit screen), keyboard, brochure rack, service bell
  const [mcv, mc] = cnv(512, 320);
  { const gr = mc.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#16394a'); gr.addColorStop(1, '#0d1e2a'); mc.fillStyle = gr; mc.fillRect(0, 0, 512, 320);
    mc.fillStyle = TEAL; mc.fillRect(0, 0, 512, 56); mc.fillStyle = '#fff'; mc.font = `700 32px ${FONT}`; mc.textBaseline = 'middle'; mc.fillText('Arrivées · Arrivals', 24, 30);
    [['AF 346', 'Paris', '14:20'], ['AC 871', 'Toronto', '14:35'], ['TS 205', 'Nice', '14:50']].forEach(([f, d, t], i) => { mc.font = `500 28px ${FONT}`; mc.fillStyle = '#9fd8dc'; mc.fillText(f, 24, 98 + i * 52); mc.fillStyle = '#fff'; mc.fillText(d, 170, 98 + i * 52); mc.fillStyle = ORANGE; mc.fillText(t, 400, 98 + i * 52); }); }
  put(g, new THREE.BoxGeometry(.5, .32, .03), mBlack, -.9, 1.32, DZ - .15, true).rotation.y = .15;
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(.46, .285), new THREE.MeshBasicMaterial({ map: clamp(mkTex(mcv)), toneMapped: false })); m.position.set(-.9 + .003, 1.32, DZ - .15 + .017); m.rotation.y = .15; g.add(m); }
  bx(.06, .2, .06, mBlack, -.9, 1.17, DZ - .15); bx(.2, .02, .12, mBlack, -.9, 1.07, DZ - .15);
  bx(.38, .015, .13, mDark, -.9, 1.07, DZ + .05);
  bx(.34, .04, .26, mWhite, 1.3, 1.08, DZ + .1);
  for (let i = 0; i < 3; i++) { const m = bx(.1, .2, .02, [mTeal, mOrange, mWhite][i], 1.1 + i * .13, 1.2, DZ + .15); m.rotation.x = -.25; }
  bx(.3, .02, .24, mDark, 1.2, 1.065, DZ + .14);
  put(g, new THREE.CylinderGeometry(.05, .06, .04, 24), S({ color: '#c9a24a', metalness: 1, roughness: .25, envMapIntensity: 1 }), .3, 1.08, DZ + .15);
  cyl(.01, .01, .03, mBlack, .3, 1.11, DZ + .15, g, 8);

  /* ---------- receptionist (head + mouth are animated by main.js) ---------- */
  const person = (x, z) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    const skin = S({ color: '#d9a883', roughness: .55, envMapIntensity: .25 }), hair = S({ color: '#4a2c1a', roughness: .7, envMapIntensity: .2 });
    const blazer = S({ color: '#1f6f75', roughness: .8, envMapIntensity: .2 }), shirt = S({ color: '#f3f1ec', roughness: .8, envMapIntensity: .2 });
    put(p, new THREE.CylinderGeometry(.2, .25, .72, 28), blazer, 0, 1.05, 0);
    put(p, new THREE.CylinderGeometry(.21, .21, .05, 28), shirt, 0, 1.37, 0);
    put(p, new THREE.CylinderGeometry(.14, .15, .08, 24), S({ color: ORANGE, roughness: .6, envMapIntensity: .25 }), 0, 1.42, 0);
    bx(.09, .06, .02, mWhite, .1, 1.2, .21, false, p); bx(.07, .01, .02, mNavy, .1, 1.21, .222, false, p);
    put(p, new THREE.CylinderGeometry(.05, .055, .08, 16), skin, 0, 1.49, 0);
    const head = new THREE.Group(); head.position.y = 1.62; p.add(head);
    const sph = (r, mat, x, y, z, ph = head) => put(ph, new THREE.SphereGeometry(r, 24, 18), mat, x, y, z);
    sph(.14, skin, 0, 0, 0).scale.set(1, 1.1, 1);
    put(head, new THREE.SphereGeometry(.152, 24, 18, 0, Math.PI * 2, 0, Math.PI * .56), hair, 0, .03, 0);
    sph(.06, hair, 0, .14, -.1);
    sph(.016, skin, 0, -.01, .14).scale.set(1, 1.2, 1);
    const eyeW = S({ color: '#fff', roughness: .3 }), eyeD = S({ color: '#2b1d14', roughness: .3 }), cheek = S({ color: '#e8a48a', roughness: .6 });
    for (const sx of [-1, 1]) { sph(.017, eyeW, sx * .05, .02, .125); sph(.01, eyeD, sx * .05, .02, .14); sph(.02, cheek, sx * .09, -.03, .1).scale.set(1, .6, .4); }
    const mouth = bx(.06, .012, .01, S({ color: '#8a3a3a', roughness: .5 }), 0, -.055, .135, false, head);
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * .27, 1.38, 0); sh.rotation.x = -.8; p.add(sh);
      put(sh, new THREE.CylinderGeometry(.045, .04, .55, 14), blazer, 0, -.275, 0); sph(.04, skin, 0, -.57, 0, sh);
    }
    return { g: p, head, mouth };
  };
  const rec = person(-.5, -3.1);

  /* ---------- plants (real leaves, like the café) ---------- */
  const plant = (x, z, s = 1) => {
    const pg = new THREE.Group(); pg.position.set(x, 0, z); pg.scale.setScalar(s); g.add(pg);
    put(pg, new THREE.CylinderGeometry(.2, .16, .4, 24), mPot, 0, .2, 0); put(pg, new THREE.CylinderGeometry(.19, .19, .02, 24), mSoil, 0, .4, 0, false);
    put(pg, new THREE.CylinderGeometry(.018, .025, 1.2, 8), S({ color: '#5b4a33', roughness: .8 }), 0, .6, 0, false);
    const r = rng(Math.floor(x * 100 + z * 10 + 77));
    for (let i = 0; i < 30; i++) {
      const y = .45 + (i / 30) * .85, yaw = r() * 6.28, tilt = .15 + r() * .9;
      const gy = new THREE.Group(); gy.position.y = y; gy.rotation.y = yaw; pg.add(gy);
      const gt = new THREE.Group(); gt.rotation.x = -tilt; gy.add(gt);
      const lf = put(gt, new THREE.SphereGeometry(1, 12, 8), i % 3 ? mLeaf : mLeaf2, 0, 0, .15, false); lf.scale.set(.085, .013, .18);
    }
    aoBlob(x, z, .9 * s, .9 * s, .5);
  };
  plant(-2.95, DZ + .1, 1.3); plant(3.15, DZ + .1, 1.3); plant(-6.3, 3.2, 1.5); plant(6.3, 3.2, 1.5);

  /* ---------- luggage, cart, bench, vending machines, gate sign, check-in island ---------- */
  const suitcase = (x, z, col, ry = 0, y = 0, p = g, sc = 1, ao = true) => {
    const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; s.scale.setScalar(sc); p.add(s);
    const shell = S({ color: col, roughness: .35, metalness: .1, envMapIntensity: .6 });
    put(s, new RoundedBoxGeometry(.42, .66, .27, 4, .045), shell, 0, .43, 0);
    for (const i of [-1, 0, 1]) bx(.022, .56, .02, mDark, i * .11, .43, .14, false, s);
    bx(.16, .04, .06, mBlack, 0, .79, 0, true, s);
    bx(.03, .35, .03, mSteel, .13, .96, -.08, true, s); bx(.18, .03, .03, mBlack, 0, 1.13, -.08, true, s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(.03, .03, .05, mBlack, sx * .15, .045, sz * .09, s, 12).rotation.z = Math.PI / 2;
    if (ao) aoBlob(x, z, .7 * sc, .55 * sc, .4);
    return s;
  };
  { // luggage cart
    const c = new THREE.Group(); c.position.set(-3.7, 0, -1.3); c.rotation.y = .5; g.add(c);
    bx(.8, .06, .55, mGrey, 0, .14, 0, true, c);
    for (const sx of [-1, 1]) { bx(.03, .95, .03, mSteel, sx * .36, .6, -.26, true, c); for (const z of [-1, 1]) cyl(.04, .04, .05, mBlack, sx * .34, .05, z * .22, c, 14).rotation.z = Math.PI / 2; }
    bx(.76, .05, .04, mTeal, 0, 1.08, -.26, true, c);
    suitcase(-.12, 0, TEAL, 0, .17, c, 1, false); suitcase(.2, 0, ORANGE, .1, .17, c, .8, false);
    aoBlob(-3.7, -1.3, 1.3, 1.0, .45);
  }
  suitcase(-4.5, -1.8, NAVY, .4); suitcase(-2.5, -.6, '#c0483b', -.5, 0, g, .9);
  { // wooden bench
    const b = new THREE.Group(); b.position.set(4.6, 0, -1.3); b.rotation.y = -.25; g.add(b);
    for (let i = 0; i < 3; i++) bx(1.9, .05, .12, mWood, 0, .46, -.16 + i * .16, true, b);
    for (const sx of [-1, 1]) { bx(.05, .44, .5, mBlack, sx * .85, .22, 0, true, b); }
    aoBlob(4.6, -1.3, 2.3, 1.0, .45);
  }
  const vend = (col, z) => {
    const v = new THREE.Group(); v.position.set(HW - .6, 0, z); v.rotation.y = -Math.PI / 2; g.add(v);
    bx(1.0, 2.0, .8, S({ color: col, roughness: .4, envMapIntensity: .5 }), 0, 1.0, 0, true, v);
    const [pcv, pc] = cnv(256, 400); pc.fillStyle = '#e9f2f4'; pc.fillRect(0, 0, 256, 400);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { pc.fillStyle = ['#c0483b', '#1F8F96', '#e8923a', '#26343f'][(r + k) % 4]; pc.fillRect(14 + k * 60, 20 + r * 94, 44, 62); pc.fillStyle = 'rgba(0,0,0,.25)'; pc.fillRect(8, 84 + r * 94, 240, 4); }
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(.66, 1.05), new THREE.MeshBasicMaterial({ map: clamp(mkTex(pcv)), toneMapped: false })); lit.position.set(-.08, 1.2, .405); v.add(lit);
    put(v, new THREE.PlaneGeometry(.7, 1.1), mGlass, -.08, 1.2, .41, false, false);
    bx(.12, .35, .04, mBlack, .38, 1.2, .41, true, v); bx(.6, .22, .04, mBlack, -.08, .3, .41, true, v);
    bx(1.04, .1, .84, mDark, 0, 2.02, 0, true, v);
    aoBlob(HW - .6, z, 1.4, 1.5, .45);
  };
  vend(TEAL, -4.6); vend(ORANGE, -5.7);
  { // hanging "Gates" sign, right side
    const s = new THREE.Group(); s.position.set(4.0, 3.0, -5.2); s.rotation.y = -.45; g.add(s);
    cyl(.015, .015, 1.0, mSteel, -.8, .6, 0, s, 8); cyl(.015, .015, 1.0, mSteel, .8, .6, 0, s, 8);
    bx(2.0, .62, .1, mNavy, 0, 0, 0, true, s);
    for (const side of [1, -1]) sign(1.96, .58, 640, (c, w, h) => {
      c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
      c.fillStyle = ORANGE; c.fillRect(h * .38, h * .2, h * .12, h * .6); c.fillRect(h * .2, h * .44, h * .5, h * .12); c.fillRect(h * .2, h * .3, h * .1, h * .1);
      c.fillStyle = '#fff'; c.font = `700 ${h * .44}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('Gates 1-9', h * 1.0, h * .54);
    }, 0, 0, .056 * side, side > 0 ? 0 : Math.PI, s);
  }
  { // check-in island with screens (left-back)
    const k = new THREE.Group(); k.position.set(-4.0, 0, -6.6); g.add(k);
    bx(3.8, 2.6, .5, mWhite, 0, 1.3, -.2, true, k); bx(3.9, .16, .6, mTeal, 0, 2.62, -.2, true, k);
    for (const [x, n, d] of [[-.95, '1730', '4'], [.95, '1850', '6']]) {
      bx(1.5, .62, .05, mBlack, x, 1.95, .07, true, k);
      sign(1.4, .52, 512, (c, w, h) => {
        c.fillStyle = '#0b1016'; c.fillRect(0, 0, w, h); c.fillStyle = TEAL; c.fillRect(0, 0, w, h * .3);
        c.fillStyle = '#fff'; c.font = `700 ${h * .24}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CHECK-IN', w / 2, h * .16);
        c.font = `600 ${h * .36}px ${FONT}`; c.fillText(n, w * .38, h * .66); c.fillStyle = ORANGE; c.fillText(d, w * .86, h * .66);
      }, x, 1.95, .1, 0, k);
    }
    for (const x of [-.95, .95]) {
      bx(1.0, .95, .6, mWhite, x, .48, .7, true, k); bx(1.1, .05, .7, mStone, x, .97, .7, true, k);
      bx(.4, .28, .03, mBlack, x, 1.2, .7, true, k); bx(.05, .16, .05, mBlack, x, 1.05, .7, true, k);
    }
    suitcase(-2.4, 1.3, '#f2b441', .3, 0, k, 1, false);
    aoBlob(-4.0, -6.9, 4.6, 2.4, .45);
  }

  /* ---------- fewer draw calls: merge static meshes that share a material ---------- */
  const skip = new Set([rec.g]);
  parent.updateMatrixWorld(true);
  const inv = parent.matrixWorld.clone().invert(), buckets = new Map();
  g.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== g; p = p.parent) if (skip.has(p)) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  buckets.forEach((list) => {
    if (list.length < 2) return;
    const geos = list.map((o) => o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));
    let merged = null;
    try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
    geos.forEach((ge) => ge.dispose());
    if (!merged) return;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
    list.forEach((o) => { o.removeFromParent(); o.geometry.dispose(); });
    g.add(mm);
  });

  return { rec, sun };
}
