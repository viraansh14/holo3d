/* HoloRoom — Scenes.
 * Each scene returns { group, update(t, dt) }. World units are METRES.
 * The physical screen sits on the plane z = 0. Content behind the screen has
 * z < 0 (recedes into the wall); content with z > 0 pops out toward you.
 * Deep, high-contrast geometry on a black void is what sells the parallax —
 * that's the whole illusion: your eye reads motion-parallax as real depth.
 */
(function (HOLO) {
  'use strict';
  const T = window.THREE;

  function glow(color) {
    return new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  }
  function wire(color, opacity) {
    return new T.LineBasicMaterial({ color, transparent: true, opacity: opacity ?? 0.6 });
  }

  // Grid plane as line segments (cheap, crisp, no z-fighting).
  function gridPlane(w, h, nx, ny, color, opacity) {
    const g = new T.BufferGeometry();
    const pts = [];
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      pts.push(x, -h / 2, 0, x, h / 2, 0);
    }
    for (let j = 0; j <= ny; j++) {
      const y = -h / 2 + (h * j) / ny;
      pts.push(-w / 2, y, 0, w / 2, y, 0);
    }
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    return new T.LineSegments(g, wire(color, opacity));
  }

  const Scenes = {};

  // ---- THE HOLODECK ROOM: a deep neon corridor you look into ----
  Scenes.room = function () {
    const group = new T.Group();
    const DEPTH = 6, W = 2.2, H = 1.5;
    const cyan = 0x16f2ff, mag = 0xff2bd6, vio = 0x7a5cff;

    // Floor, ceiling, two side walls — all receding from z=0 to z=-DEPTH.
    function wallZ(rotAxis, rotAng, pos, w, h, nx, ny, col) {
      const p = gridPlane(w, h, nx, ny, col, 0.5);
      if (rotAxis === 'x') p.rotation.x = rotAng;
      if (rotAxis === 'y') p.rotation.y = rotAng;
      p.position.set(pos[0], pos[1], pos[2]);
      group.add(p);
    }
    wallZ('x',  Math.PI / 2, [0, -H / 2, -DEPTH / 2], W, DEPTH, 11, 30, cyan); // floor
    wallZ('x', -Math.PI / 2, [0,  H / 2, -DEPTH / 2], W, DEPTH, 11, 30, vio);  // ceiling
    wallZ('y',  Math.PI / 2, [-W / 2, 0, -DEPTH / 2], DEPTH, H, 30, 8, mag);   // left
    wallZ('y', -Math.PI / 2, [ W / 2, 0, -DEPTH / 2], DEPTH, H, 30, 8, mag);   // right
    // Back wall.
    const back = gridPlane(W, H, 11, 8, cyan, 0.7); back.position.z = -DEPTH; group.add(back);

    // Floating rotating wireframe solids at varied depth — the parallax anchors.
    const solids = [];
    const geos = [new T.IcosahedronGeometry(0.16, 0), new T.TorusGeometry(0.16, 0.05, 8, 24),
                  new T.OctahedronGeometry(0.18, 0), new T.BoxGeometry(0.22, 0.22, 0.22)];
    const cols = [cyan, mag, vio, 0x39ff88];
    for (let i = 0; i < 7; i++) {
      const eg = new T.EdgesGeometry(geos[i % geos.length]);
      const m = new T.LineSegments(eg, wire(cols[i % cols.length], 0.95));
      m.position.set((Math.random() - 0.5) * (W - 0.4),
                     (Math.random() - 0.5) * (H - 0.4),
                     -0.4 - Math.random() * (DEPTH - 1));
      m.userData.spin = new T.Vector3(Math.random(), Math.random(), Math.random())
                          .multiplyScalar(0.6 + Math.random());
      group.add(m); solids.push(m);
    }
    // A glowing core orb near mid-depth that pops slightly toward you.
    const orb = new T.Mesh(new T.SphereGeometry(0.12, 24, 16), glow(0xffffff));
    orb.position.set(0, 0, -1.0); group.add(orb);

    return {
      group,
      update(t, dt) {
        solids.forEach((s) => {
          s.rotation.x += s.userData.spin.x * dt;
          s.rotation.y += s.userData.spin.y * dt;
        });
        orb.position.z = -1.0 + Math.sin(t * 0.8) * 0.25;
        orb.material.opacity = 0.7 + 0.3 * Math.sin(t * 3);
      }
    };
  };

  // ---- PLANET: a rotating glowing globe in a starfield (your VAJRA vibe) ----
  Scenes.planet = function () {
    const group = new T.Group();
    // Stars filling deep space behind the screen.
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = -0.5 - Math.random() * 7;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    group.add(new T.Points(sg, new T.PointsMaterial({ color: 0x9fd8ff, size: 0.012 })));

    // Wireframe globe with a latitude/longitude shimmer.
    const globe = new T.Group();
    const sphere = new T.Mesh(new T.SphereGeometry(0.5, 48, 32),
      new T.MeshBasicMaterial({ color: 0x0a2a4a, transparent: true, opacity: 0.55 }));
    const wireG = new T.LineSegments(new T.WireframeGeometry(new T.SphereGeometry(0.5, 24, 16)),
      wire(0x16f2ff, 0.5));
    globe.add(sphere); globe.add(wireG);
    // Equator + axis rings.
    const ring = new T.Mesh(new T.TorusGeometry(0.62, 0.006, 8, 80), glow(0xff2bd6));
    ring.rotation.x = Math.PI / 2; globe.add(ring);
    globe.position.z = -1.2; group.add(globe);

    return {
      group,
      update(t, dt) {
        globe.rotation.y += dt * 0.4;
        ring.rotation.z += dt * 0.6;
        group.children[0].rotation.y += dt * 0.01;
      }
    };
  };

  // ---- NEBULA: a volumetric cloud of particles you float through ----
  Scenes.nebula = function () {
    const group = new T.Group();
    const N = 6000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const c1 = new T.Color(0x16f2ff), c2 = new T.Color(0xff2bd6), tmp = new T.Color();
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.5) * 1.4;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
      pos[i * 3 + 2] = -1.3 + r * Math.cos(ph);
      tmp.copy(c1).lerp(c2, Math.random());
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const pts = new T.Points(g, new T.PointsMaterial({
      size: 0.02, vertexColors: true, transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, depthWrite: false }));
    group.add(pts);
    return { group, update(t, dt) { pts.rotation.y += dt * 0.12; pts.rotation.z += dt * 0.05; } };
  };

  // ---- TUNNEL: an infinite neon tube you fly down. Strong "inside it" feel. ----
  Scenes.tunnel = function () {
    const group = new T.Group();
    const rings = [], COUNT = 40, SP = 0.35;
    for (let i = 0; i < COUNT; i++) {
      const hue = (i / COUNT);
      const c = new T.Color().setHSL(0.5 + hue * 0.3, 1, 0.55);
      const r = new T.Mesh(new T.TorusGeometry(0.6, 0.02, 6, 40), glow(c.getHex()));
      r.position.z = -i * SP;
      rings.push(r); group.add(r);
    }
    return {
      group,
      update(t, dt) {
        rings.forEach((r) => {
          r.position.z += dt * 1.2;
          r.rotation.z += dt * 0.5;
          if (r.position.z > 0.4) r.position.z -= COUNT * SP;
          const d = -r.position.z;
          r.material.opacity = Math.max(0.05, 1 - d / (COUNT * SP));
        });
      }
    };
  };

  HOLO.Scenes = Scenes;
  HOLO.SCENE_LIST = ['room', 'planet', 'nebula', 'tunnel'];
})(window.HOLO = window.HOLO || {});
