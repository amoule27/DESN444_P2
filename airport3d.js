// Low-poly airport arrivals hall with an information desk (inspired by the "Gate 54" reference image).
// Everything is built from simple boxes / cylinders + a few canvas signs, so it stays light for Quest 3.
// The user stands at (0, 0, 0) facing -Z. Dialogue panels float in front of the desk (z > -2), so keep that area clear.
import * as THREE from 'three';

const TEAL = '#1F8F96', TEAL_D = '#176e74', NAVY = '#26343f', WOOD = '#e4b27a', WOOD_D = '#b9772f';
const WHITE = '#eef1f2', WALL = '#dde1e4', GREY = '#9aa3a9', DARK = '#1d2328', ORANGE = '#e8923a';

export function buildAirport({ parent, FONT }) {
  const g = new THREE.Group(); parent.add(g);

  /* ---- helpers ---- */
  const mats = {};
  const M = (c) => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  const B = (w, h, d, c, x, y, z, ry = 0, p = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
    m.position.set(x, y, z); m.rotation.y = ry; p.add(m); return m;
  };
  const CYL = (rt, rb, h, c, x, y, z, p = g, seg = 16) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c));
    m.position.set(x, y, z); p.add(m); return m;
  };
  const dark = (c) => '#' + new THREE.Color(c).multiplyScalar(.68).getHexString();
  function sign(w, h, px, draw, x, y, z, ry = 0, p = g) {
    const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * h / w);
    draw(cv.getContext('2d'), cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = ry; p.add(m); return m;
  }
  function tiled(draw, cell, rep, w, d) {
    const cv = document.createElement('canvas'); cv.width = cv.height = cell * 2;
    draw(cv.getContext('2d'), cell);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / rep, d / rep); return t;
  }
  const rr = (c, x, y, w, h, r, fill) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); };

  /* ---- sky (gradient dome) + outside apron ---- */
  {
    const geo = new THREE.SphereGeometry(95, 24, 16), col = [], top = new THREE.Color('#7fa8c9'), hor = new THREE.Color('#dbe8ef');
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, p.getY(i) / 70)); const c = hor.clone().lerp(top, k); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false })));
  }
  const ground = (w, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M(c)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); return m; };
  ground(220, 50, '#858a8f', 0, -.03, -34);          // tarmac apron
  ground(220, 70, '#7a9a4d', 0, -.04, -84);           // grass beyond
  B(.25, .01, 40, '#e9c24a', -6, -.02, -26);          // painted taxi line
  B(80, .01, .25, '#e9c24a', 0, -.02, -22);
  const hangar = (x, z, w, s) => {
    const h = new THREE.Group(); h.position.set(x, 0, z); g.add(h);
    B(w, 5 * s, 10 * s, '#b9bec2', 0, 2.5 * s, 0, 0, h);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(5 * s, 5 * s, w, 20, 1, false, 0, Math.PI), M('#a3a9ae'));
    roof.rotation.z = Math.PI / 2; roof.position.y = 5 * s; roof.scale.set(.6, 1, 1); h.add(roof);
    B(w, .5 * s, .3, TEAL, 0, 4.2 * s, 5.1 * s, 0, h);
    for (let i = -2; i <= 2; i++) B(.08, 3.6 * s, .1, '#6e767c', i * (w / 5), 1.9 * s, 5.1 * s, 0, h);
  };
  hangar(-22, -36, 22, 1.2); hangar(18, -44, 18, 1.2); hangar(-4, -52, 26, 1.3);
  { // parked airliner seen through the windows
    const a = new THREE.Group(); a.position.set(5, 0, -21); g.add(a);
    const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 11, 4, 14), M('#f2f4f5')); fus.rotation.z = Math.PI / 2; fus.position.y = 2.4; a.add(fus);
    B(11.5, .22, .06, TEAL, 0, 2.05, 1.06, 0, a); B(11.5, .22, .06, TEAL, 0, 2.05, -1.06, 0, a);
    B(.9, .28, .06, DARK, 5.3, 2.8, 1.0, 0, a); B(.9, .28, .06, DARK, 5.3, 2.8, -1.0, 0, a);
    B(2.6, .14, 15, '#e3e7e9', .5, 1.9, 0, 0, a).rotation.y = 0;
    B(1.8, 2.4, .14, TEAL, -5.6, 4.3, 0, 0, a).rotation.z = -.35;
    B(1.6, .1, 4.6, '#e3e7e9', -5.7, 3.4, 0, 0, a);
    for (const z of [-3.6, 3.6]) CYL(.6, .6, 1.5, '#cfd5d9', 1.2, 1.4, z, a).rotation.z = Math.PI / 2;
    B(.12, 1.3, .12, GREY, 3.6, .65, 0, 0, a); B(.12, 1.3, .12, GREY, -.8, .65, 1.4, 0, a); B(.12, 1.3, .12, GREY, -.8, .65, -1.4, 0, a);
  }

  /* ---- hall shell: floor, ceiling, walls ---- */
  const HW = 7, ZB = 4, ZF = -9, H = 4;                 // half-width, back wall z, front (window) wall z, height
  {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, ZB - ZF), new THREE.MeshLambertMaterial({
      map: tiled((c, s) => { c.fillStyle = '#e2e5e7'; c.fillRect(0, 0, s * 2, s * 2); c.fillStyle = '#d3d8db'; c.fillRect(0, 0, s, s); c.fillRect(s, s, s, s); }, 64, 2, HW * 2, ZB - ZF)
    }));
    f.rotation.x = -Math.PI / 2; f.position.set(0, 0, (ZB + ZF) / 2); g.add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, ZB - ZF), new THREE.MeshLambertMaterial({
      map: tiled((cx, s) => { cx.fillStyle = '#8d959c'; cx.fillRect(0, 0, s * 2, s * 2); cx.fillStyle = '#7c858c'; cx.fillRect(0, 0, s, s); cx.fillRect(s, s, s, s); }, 64, 2.4, HW * 2, ZB - ZF)
    }));
    c.rotation.x = Math.PI / 2; c.position.set(0, H, (ZB + ZF) / 2); g.add(c);
  }
  const zc = (ZB + ZF) / 2, zl = ZB - ZF;
  for (const sx of [-1, 1]) {
    B(.2, H, zl, WALL, sx * HW, H / 2, zc);                              // side walls
    B(.22, .16, zl, '#2c3b44', sx * (HW - .01), .08, zc);                // skirting
    B(.22, .14, zl, TEAL, sx * (HW - .01), 3.2, zc);                     // teal band
    B(2.2, .5, zl, '#a9b0b6', sx * (HW - 1.1), H - .25, zc);             // soffit
    B(.06, .5, zl, TEAL, sx * (HW - 2.2), H - .25, zc);                  // soffit teal edge
    B(.35, .01, zl, TEAL, sx * 5.4, .006, zc);                           // floor guide lines
  }
  B(HW * 2, H, .2, WALL, 0, H / 2, ZB);                                   // wall behind the visitor
  B(HW * 2, .14, .22, TEAL, 0, 3.2, ZB - .01);
  B(HW * 2, .16, .22, '#2c3b44', 0, .08, ZB - .01);
  sign(4.2, .8, 1024, (c, w, h) => {
    rr(c, 0, 0, w, h, 40, TEAL); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${h * .5}px ${FONT}`; c.fillText('Bienvenue à Montréal', w / 2, h * .42);
    c.font = `500 ${h * .22}px ${FONT}`; c.fillText('Welcome to Montréal', w / 2, h * .8);
  }, 0, 2.3, ZB - .12, Math.PI);

  // window wall (view of the apron)
  B(HW * 2, .9, .2, WALL, 0, .45, ZF); B(HW * 2, .16, .22, '#2c3b44', 0, .08, ZF + .01);
  B(HW * 2, .7, .22, WALL, 0, 3.65, ZF); B(HW * 2, .14, .24, TEAL, 0, 3.3, ZF + .01);
  for (let x = -HW; x <= HW; x += 2) B(.14, 2.5, .16, '#2b3a44', x, 2.15, ZF);
  B(HW * 2, .06, .18, '#2b3a44', 0, .93, ZF);
  { const gl = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 2.4), new THREE.MeshBasicMaterial({ color: '#cfeaf0', transparent: true, opacity: .1, depthWrite: false })); gl.position.set(0, 2.15, ZF + .02); g.add(gl); }

  // ceiling light strips
  for (const x of [-4, -1.3, 1.3, 4]) { B(.34, .03, zl - .6, NAVY, x, H - .02, zc); B(.2, .04, zl - .6, '#ffffff', x, H - .045, zc).material = new THREE.MeshBasicMaterial({ color: '#ffffff' }); }

  // welcome mat where the visitor stands
  CYL(1.15, 1.15, .012, '#d7f0f2', 0, .008, -.1, g, 40);
  { const r = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 40), new THREE.MeshBasicMaterial({ color: TEAL })); r.rotation.x = -Math.PI / 2; r.position.set(0, .016, -.1); g.add(r); }

  /* ---- the information desk ---- */
  const DZ = -2.4;
  B(5.2, 2.9, .15, WHITE, 0, 1.45, -4.0);                                 // backdrop panel
  B(5.3, .18, .3, TEAL, 0, 2.9, -3.95);
  B(5.2, .1, .1, '#2c3b44', 0, .05, -3.95);
  for (let i = 0; i < 5; i++) B(.12, 2.5, .08, WOOD_D, 1.75 + i * .2, 1.3, -3.9);   // wood slats
  sign(2.3, .75, 768, (c, w, h) => {
    c.fillStyle = TEAL; c.fillRect(0, 0, w, h * .1);
    c.fillStyle = NAVY; c.font = `700 ${h * .42}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Bienvenue', w / 2, h * .55);
  }, -1.0, 1.9, -3.9, 0);
  // hanging sign
  for (const x of [-1.0, 1.0]) B(.04, 1.0, .04, '#c5cbd0', x, 3.5, DZ - .5);
  B(2.9, .9, .12, NAVY, 0, 2.98, DZ - .5);
  sign(2.8, .8, 1024, (c, w, h) => {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    c.fillStyle = ORANGE; c.beginPath(); c.arc(h * .5, h * .5, h * .34, 0, 7); c.fill();
    c.fillStyle = NAVY; c.font = `700 ${h * .5}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('i', h * .5, h * .53);
    c.fillStyle = '#fff'; c.textAlign = 'left';
    c.font = `700 ${h * .36}px ${FONT}`; c.fillText('Information', h * 1.0, h * .36);
    c.font = `500 ${h * .26}px ${FONT}`; c.fillStyle = '#cfe9ec'; c.fillText('Renseignements', h * 1.0, h * .7);
  }, 0, 2.98, DZ - .43, 0);
  B(4.6, 1.0, .7, WHITE, 0, .5, DZ);                                      // counter body
  B(4.62, .3, .02, TEAL, 0, .6, DZ + .36);
  B(4.62, .1, .72, '#2c3b44', 0, .05, DZ);
  B(5.0, .06, .98, WOOD, 0, 1.03, DZ);                                    // timber top
  B(.9, .72, .5, WHITE, 2.55, .36, DZ - .1); B(1.0, .05, .6, WOOD, 2.55, .74, DZ - .1);   // side wing
  // desk props
  B(.5, .32, .03, '#0e1318', -.9, 1.32, DZ - .15, .15); B(.06, .2, .06, DARK, -.9, 1.17, DZ - .15); B(.2, .02, .12, DARK, -.9, 1.07, DZ - .15);
  B(.38, .015, .13, '#2a3138', -.9, 1.07, DZ + .05);
  B(.34, .04, .26, '#fff', 1.3, 1.08, DZ + .1);
  for (let i = 0; i < 3; i++) { const c = [TEAL, ORANGE, '#d8e4ea'][i]; const m = B(.1, .2, .02, c, 1.1 + i * .13, 1.2, DZ + .15); m.rotation.x = -.25; }
  B(.3, .02, .24, DARK, 1.2, 1.065, DZ + .14);
  CYL(.05, .06, .04, '#c9a24a', .3, 1.08, DZ + .15); CYL(.01, .01, .03, DARK, .3, 1.11, DZ + .15);   // service bell

  /* ---- receptionist (head + mouth are animated by main.js) ---- */
  const person = (x, z) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    const skin = '#e2b48f';
    CYL(.2, .25, .72, TEAL, 0, 1.05, 0, p, 20);
    CYL(.21, .21, .05, WHITE, 0, 1.37, 0, p);
    CYL(.14, .15, .08, ORANGE, 0, 1.42, 0, p);
    B(.09, .06, .02, WHITE, .1, 1.2, .21, 0, p); B(.07, .01, .02, NAVY, .1, 1.21, .222, 0, p);
    CYL(.05, .055, .08, skin, 0, 1.49, 0, p);
    const head = new THREE.Group(); head.position.y = 1.62; p.add(head);
    const sph = (r, c, x, y, z, ph = head) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), M(c)); m.position.set(x, y, z); ph.add(m); return m; };
    sph(.14, skin, 0, 0, 0).scale.set(1, 1.1, 1);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.152, 20, 16, 0, Math.PI * 2, 0, Math.PI * .56), M('#5a3420')); hair.position.y = .03; head.add(hair);
    sph(.06, '#5a3420', 0, .14, -.1);
    for (const sx of [-1, 1]) { sph(.017, '#fff', sx * .05, .02, .125); sph(.01, '#2b1d14', sx * .05, .02, .14); sph(.02, '#e8a48a', sx * .09, -.03, .1).scale.set(1, .6, .4); }
    const mouth = B(.06, .012, .01, '#7a2f2f', 0, -.055, .135, 0, head);
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * .27, 1.38, 0); sh.rotation.x = -.8; p.add(sh);
      CYL(.045, .04, .55, TEAL, 0, -.275, 0, sh, 12); sph(.04, skin, 0, -.57, 0, sh);
    }
    return { g: p, head, mouth };
  };
  const rec = person(-.5, -3.1);

  /* ---- plants ---- */
  const plant = (x, z, s = 1) => {
    CYL(.2 * s, .16 * s, .4 * s, '#f2f2ee', x, .2 * s, z); CYL(.18 * s, .18 * s, .02, '#4a3526', x, .4 * s, z);
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.34 * s, 0), new THREE.MeshLambertMaterial({ color: '#3f8f4f', flatShading: true })); f.position.set(x, .75 * s, z); g.add(f);
    const f2 = f.clone(); f2.scale.setScalar(.7); f2.position.set(x + .12 * s, 1.0 * s, z); g.add(f2);
  };
  plant(-2.95, DZ + .1, 1.2); plant(3.15, DZ + .1, 1.2); plant(-6.3, 3.2, 1.4); plant(6.3, 3.2, 1.4);

  /* ---- luggage, cart, bench, vending machines, gate sign, check-in island ---- */
  const suitcase = (x, z, col, ry = 0, y = 0, p = g) => {
    const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; p.add(s);
    B(.42, .66, .27, col, 0, .43, 0, 0, s);
    for (const i of [-1, 0, 1]) B(.025, .56, .02, dark(col), i * .11, .43, .14, 0, s);
    B(.16, .04, .06, DARK, 0, .79, 0, 0, s);
    B(.03, .35, .03, GREY, .13, .96, -.08, 0, s); B(.18, .03, .03, DARK, 0, 1.13, -.08, 0, s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(.06, .06, .06, DARK, sx * .15, .06, sz * .09, 0, s);
    return s;
  };
  { // luggage cart
    const c = new THREE.Group(); c.position.set(-3.7, 0, -1.3); c.rotation.y = .5; g.add(c);
    B(.8, .06, .55, '#9aa3a9', 0, .14, 0, 0, c);
    for (const sx of [-1, 1]) { B(.03, .95, .03, GREY, sx * .36, .6, -.26, 0, c); for (const z of [-1, 1]) B(.07, .07, .07, DARK, sx * .34, .06, z * .22, 0, c); }
    B(.76, .05, .04, TEAL, 0, 1.08, -.26, 0, c);
    suitcase(-.12, 0, TEAL, 0, .17, c);
    suitcase(.2, 0, ORANGE, .1, .17, c).scale.setScalar(.8);
  }
  suitcase(-4.5, -1.8, NAVY, .4); suitcase(-2.5, -.6, '#c0483b', -.5).scale.setScalar(.9);
  { // wooden bench
    const b = new THREE.Group(); b.position.set(4.6, 0, -1.3); b.rotation.y = -.25; g.add(b);
    for (let i = 0; i < 3; i++) B(1.9, .05, .12, WOOD_D, 0, .46, -.16 + i * .16, 0, b);
    for (const sx of [-1, 1]) { B(.06, .44, .5, '#2c3b44', sx * .85, .22, 0, 0, b); }
    B(1.9, .45, .04, WOOD_D, 0, .75, -.28, 0, b).visible = false;
  }
  const vend = (col, z) => {
    const v = new THREE.Group(); v.position.set(HW - .6, 0, z); v.rotation.y = -Math.PI / 2; g.add(v);
    B(1.0, 2.0, .8, col, 0, 1.0, 0, 0, v); B(.7, 1.2, .04, '#9fc4cc', -.08, 1.15, .41, 0, v);
    B(.12, .35, .04, DARK, .38, 1.2, .41, 0, v); B(.6, .22, .04, DARK, -.08, .3, .41, 0, v);
    B(1.04, .1, .84, dark(col), 0, 2.02, 0, 0, v);
    for (const y of [.8, 1.15, 1.5]) B(.66, .03, .1, '#e8edef', -.08, y, .4, 0, v);
  };
  vend(TEAL, -4.6); vend(ORANGE, -5.7);
  { // hanging "Gates" sign, right side
    const s = new THREE.Group(); s.position.set(4.0, 3.0, -5.2); s.rotation.y = -.45; g.add(s);
    B(.04, 1.0, .04, '#c5cbd0', -.8, .6, 0, 0, s); B(.04, 1.0, .04, '#c5cbd0', .8, .6, 0, 0, s);
    B(2.0, .62, .1, NAVY, 0, 0, 0, 0, s);
    for (const side of [1, -1]) sign(1.96, .58, 640, (c, w, h) => {
      c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
      c.fillStyle = ORANGE; c.fillRect(h * .38, h * .2, h * .12, h * .6); c.fillRect(h * .2, h * .44, h * .5, h * .12); c.fillRect(h * .2, h * .3, h * .1, h * .1);
      c.fillStyle = '#fff'; c.font = `700 ${h * .44}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('Gates 1-9', h * 1.0, h * .54);
    }, 0, 0, .056 * side, side > 0 ? 0 : Math.PI, s);
  }
  { // check-in island with screens (left-back)
    const k = new THREE.Group(); k.position.set(-4.0, 0, -6.6); g.add(k);
    B(3.8, 2.6, .5, WHITE, 0, 1.3, -.2, 0, k); B(3.9, .16, .6, TEAL, 0, 2.62, -.2, 0, k);
    for (const [x, n, d] of [[-.95, '1730', '4'], [.95, '1850', '6']]) {
      B(1.5, .62, .05, '#0b1016', x, 1.95, .07, 0, k);
      sign(1.4, .52, 512, (c, w, h) => {
        c.fillStyle = '#0b1016'; c.fillRect(0, 0, w, h); c.fillStyle = TEAL; c.fillRect(0, 0, w, h * .3);
        c.fillStyle = '#fff'; c.font = `700 ${h * .24}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CHECK-IN', w / 2, h * .16);
        c.font = `600 ${h * .36}px ${FONT}`; c.fillText(n, w * .38, h * .66); c.fillStyle = ORANGE; c.fillText(d, w * .86, h * .66);
      }, x, 1.95, .1, 0, k);
    }
    for (const x of [-.95, .95]) {
      B(1.0, .95, .6, WHITE, x, .48, .7, 0, k); B(1.1, .05, .7, WOOD, x, .97, .7, 0, k);
      B(.4, .28, .03, '#0e1318', x, 1.2, .7, 0, k); B(.05, .16, .05, DARK, x, 1.05, .7, 0, k);
    }
    suitcase(-2.4, 1.3, '#f2b441', .3, 0, k);
  }

  return { rec };
}
