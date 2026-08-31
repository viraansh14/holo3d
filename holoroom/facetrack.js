/* HoloRoom — Head tracker.
 * Produces an "eye" position in METERS relative to the centre of the physical
 * screen: {x: right+, y: up+, z: distance-in-front+}. The off-axis projection
 * engine consumes this to turn the screen into a window you can look around.
 *
 * Three backends, graceful fallback:
 *   mouse  — always works. Move mouse = move head; wheel = move closer/further.
 *   gyro   — phone/tablet tilt (deviceorientation).
 *   face   — webcam. Native FaceDetector if present, else MediaPipe FaceMesh
 *            from CDN if online, else stays on the previous backend.
 */
(function (HOLO) {
  'use strict';

  class HeadTracker {
    constructor() {
      // Sensible default: eye 60cm in front, centred.
      this.eye = { x: 0, y: 0, z: 0.6 };
      this.mode = 'mouse';
      this.status = 'mouse ready';
      this.smoothing = 0.25;           // 0..1, higher = snappier
      this._target = { x: 0, y: 0, z: 0.6 };
      this._screenW = 0.5;             // metres, set by engine for scaling
      this._bindMouse();
    }

    setScreenWidth(m) { this._screenW = m; }

    // ---- public: call once per frame to apply smoothing ----
    update() {
      const s = this.smoothing;
      this.eye.x += (this._target.x - this.eye.x) * s;
      this.eye.y += (this._target.y - this.eye.y) * s;
      this.eye.z += (this._target.z - this.eye.z) * s;
      return this.eye;
    }

    async setMode(mode) {
      this.mode = mode;
      if (mode === 'mouse') { this.status = 'mouse ready'; }
      else if (mode === 'gyro') { await this._bindGyro(); }
      else if (mode === 'face') { await this._bindFace(); }
    }

    // ---------------- mouse ----------------
    _bindMouse() {
      window.addEventListener('mousemove', (e) => {
        if (this.mode !== 'mouse') return;
        // Map cursor to a comfortable ±0.35m sweep horizontally, ±0.22m vertical.
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        this._target.x = nx * 0.35;
        this._target.y = -ny * 0.22;
      });
      window.addEventListener('wheel', (e) => {
        if (this.mode !== 'mouse') return;
        this._target.z = Math.min(1.6, Math.max(0.18, this._target.z + e.deltaY * 0.0008));
      }, { passive: true });
    }

    // ---------------- gyro -----------------
    async _bindGyro() {
      // iOS needs an explicit permission gesture.
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') { this.status = 'gyro denied'; return; }
        }
      } catch (e) { /* non-iOS */ }
      this.status = 'gyro ready — tilt the device';
      window.addEventListener('deviceorientation', (e) => {
        if (this.mode !== 'gyro') return;
        // beta: front-back tilt (-180..180), gamma: left-right (-90..90)
        const g = (e.gamma || 0), b = (e.beta || 0);
        this._target.x = Math.max(-0.4, Math.min(0.4, (g / 45) * 0.4));
        this._target.y = Math.max(-0.3, Math.min(0.3, ((b - 45) / 45) * 0.3));
      });
    }

    // ---------------- face -----------------
    async _bindFace() {
      this.status = 'starting camera…';
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' }, audio: false
        });
      } catch (e) {
        this.status = 'camera blocked — staying on ' + (this.mode = 'mouse');
        return;
      }
      const video = document.createElement('video');
      video.autoplay = true; video.playsInline = true; video.muted = true;
      video.srcObject = stream;
      await video.play();
      this._video = video;

      // Backend A: native Shape Detection API (no download).
      if ('FaceDetector' in window) {
        try {
          const det = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          this.status = 'face: native detector';
          this._faceLoopNative(det, video);
          return;
        } catch (e) { /* fall through */ }
      }
      // Backend B: MediaPipe FaceMesh via CDN (needs internet, more accurate).
      const ok = await this._loadMediaPipe();
      if (ok) { this.status = 'face: MediaPipe'; this._faceLoopMediaPipe(video); return; }

      this.status = 'no face backend — staying on mouse';
      this.mode = 'mouse';
    }

    _mapFace(cx, cy, sizeFrac, vw, vh) {
      // cx,cy = face centre px; sizeFrac = face width / video width (proxy for distance).
      // Mirror x (selfie). Bigger face => closer => smaller z.
      const nx = -(((cx / vw) * 2 - 1));
      const ny = -(((cy / vh) * 2 - 1));
      this._target.x = nx * 0.4;
      this._target.y = ny * 0.3;
      const z = Math.min(1.4, Math.max(0.22, 0.18 / Math.max(0.06, sizeFrac)));
      this._target.z = z;
    }

    async _faceLoopNative(det, video) {
      const tick = async () => {
        if (this.mode !== 'face') return;
        try {
          const faces = await det.detect(video);
          if (faces && faces[0]) {
            const b = faces[0].boundingBox;
            this._mapFace(b.x + b.width / 2, b.y + b.height / 2,
                          b.width / video.videoWidth, video.videoWidth, video.videoHeight);
          }
        } catch (e) { /* transient */ }
        requestAnimationFrame(tick);
      };
      tick();
    }

    _loadMediaPipe() {
      return new Promise((resolve) => {
        if (window.FaceMesh) return resolve(true);
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        s.onload = () => resolve(!!window.FaceMesh);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
    }

    _faceLoopMediaPipe(video) {
      const fm = new window.FaceMesh({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
      });
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: false,
                      minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      fm.onResults((res) => {
        if (this.mode !== 'face') return;
        const lm = res.multiFaceLandmarks && res.multiFaceLandmarks[0];
        if (!lm) return;
        // Landmark 1 = nose tip. Eye corners 33 & 263 give inter-ocular width.
        const nose = lm[1];
        const eL = lm[33], eR = lm[263];
        const w = Math.hypot(eR.x - eL.x, eR.y - eL.y); // fraction of frame
        this._mapFace(nose.x * video.videoWidth, nose.y * video.videoHeight,
                      w, 1, 1);
      });
      const pump = async () => {
        if (this.mode !== 'face') return;
        try { await fm.send({ image: video }); } catch (e) {}
        requestAnimationFrame(pump);
      };
      pump();
    }
  }

  HOLO.HeadTracker = HeadTracker;
})(window.HOLO = window.HOLO || {});
