/* HoloRoom — Engine.
 * Turns a flat screen into a WINDOW into a 3D world using head-tracked
 * off-axis (asymmetric) projection — Robert Kooima's "Generalized Perspective
 * Projection". The screen is a fixed rectangle in space; as your eye moves the
 * frustum shears so the perspective stays physically correct. That parallax is
 * what your brain reads as real depth — no glasses needed.
 *
 * Project this onto a wall at 1:1 scale + track your head and the wall becomes
 * a window into a room. Add walls (CAVE) and you can walk inside it. Press the
 * XR button on a headset to step fully into true stereo 3D.
 */
(function (HOLO) {
  'use strict';
  const T = window.THREE;

  class Engine {
    constructor(canvas) {
      this.cfg = {
        screenDiagIn: 24,   // physical screen diagonal, inches (calibrate this!)
        near: 0.05, far: 60,
        screenW: 0.5, screenH: 0.3, // metres, derived from diag + aspect
      };
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.xr.enabled = true;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x000007);
      // Off-axis camera: we drive its projection + pose manually each frame.
      this.camera = new T.PerspectiveCamera(60, 1, this.cfg.near, this.cfg.far);
      this.scene.add(this.camera);
      // XR rig: when presenting, the headset drives a separate camera parent.
      this.xrRig = new T.Group();
      this.scene.add(this.xrRig);

      this.tracker = new HOLO.HeadTracker();
      this.current = null;
      this.sceneName = 'room';
      this._t = 0; this._last = 0;

      this._reuse = {
        pa: new T.Vector3(), pb: new T.Vector3(), pc: new T.Vector3(),
        pe: new T.Vector3(), va: new T.Vector3(), vb: new T.Vector3(),
        vc: new T.Vector3(), vr: new T.Vector3(), vu: new T.Vector3(),
        vn: new T.Vector3(), m: new T.Matrix4(),
      };

      this._resize();
      window.addEventListener('resize', () => this._resize());
      this.loadScene('room');
    }

    _resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      // Physical screen size from diagonal + the live viewport aspect, so the
      // rendered window exactly matches the glass — no stretch.
      const aspect = w / h;
      const diagM = this.cfg.screenDiagIn * 0.0254;
      const sh = diagM / Math.sqrt(1 + aspect * aspect);
      this.cfg.screenH = sh;
      this.cfg.screenW = sh * aspect;
      this.tracker.setScreenWidth(this.cfg.screenW);
    }

    loadScene(name) {
      if (this.current) { this.scene.remove(this.current.group); this._dispose(this.current.group); }
      const factory = HOLO.Scenes[name] || HOLO.Scenes.room;
      this.current = factory();
      this.sceneName = name;
      this.scene.add(this.current.group);
    }

    _dispose(obj) {
      obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }
      });
    }

    // ---- Generalized perspective projection (Kooima 2008) ----
    _updateOffAxis(eye) {
      const R = this._reuse, c = this.cfg;
      const W = c.screenW, H = c.screenH, n = c.near, f = c.far;
      // Screen corners on the plane z = 0, centred on the origin.
      R.pa.set(-W / 2, -H / 2, 0); // bottom-left
      R.pb.set( W / 2, -H / 2, 0); // bottom-right
      R.pc.set(-W / 2,  H / 2, 0); // top-left
      R.pe.set(eye.x, eye.y, Math.max(0.05, eye.z)); // eye

      R.vr.subVectors(R.pb, R.pa).normalize();          // screen right
      R.vu.subVectors(R.pc, R.pa).normalize();          // screen up
      R.vn.crossVectors(R.vr, R.vu).normalize();        // screen normal (toward viewer, +z)

      R.va.subVectors(R.pa, R.pe);
      R.vb.subVectors(R.pb, R.pe);
      R.vc.subVectors(R.pc, R.pe);

      const d = -R.va.dot(R.vn);                         // eye→screen distance
      const nd = n / d;
      const l = R.vr.dot(R.va) * nd;
      const r = R.vr.dot(R.vb) * nd;
      const b = R.vu.dot(R.va) * nd;
      const t = R.vu.dot(R.vc) * nd;

      this.camera.projectionMatrix.makePerspective(l, r, t, b, n, f);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      // Orient camera so its local axes align to the screen basis; place at eye.
      R.m.makeBasis(R.vr, R.vu, R.vn);
      this.camera.quaternion.setFromRotationMatrix(R.m);
      this.camera.position.copy(R.pe);
      this.camera.updateMatrixWorld(true);
    }

    setScene(name) { this.loadScene(name); }
    setTracker(mode) { return this.tracker.setMode(mode); }
    setScreenDiag(inches) { this.cfg.screenDiagIn = inches; this._resize(); }

    start() {
      this.renderer.setAnimationLoop((time) => {
        const now = time * 0.001;
        const dt = Math.min(0.05, now - this._last || 0.016);
        this._last = now; this._t += dt;
        if (this.current) this.current.update(this._t, dt);

        if (this.renderer.xr.isPresenting) {
          // Headset owns the camera; just render the scene through XR cameras.
          this.renderer.render(this.scene, this.camera);
        } else {
          const eye = this.tracker.update();
          this._updateOffAxis(eye);
          this.renderer.render(this.scene, this.camera);
        }
        if (this.onFrame) this.onFrame(this.tracker.eye, this.tracker.status);
      });
    }
  }

  HOLO.Engine = Engine;
})(window.HOLO = window.HOLO || {});
