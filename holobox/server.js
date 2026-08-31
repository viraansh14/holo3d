/* HoloBox — local relay server (zero dependencies, Node >=16).
 *
 * Links a DISPLAY (the screen under your acrylic pyramid) to a CONTROLLER
 * (your phone/laptop) over your local Wi-Fi:
 *   - controller POSTs commands to /control
 *   - server keeps the latest state and pushes it to every display via SSE
 *   - controller PUTs model files to /upload?name=foo.glb ; display fetches them
 *
 * Run:  node server.js   (then open the printed URLs on the box screen + phone)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const MODELS = path.join(ROOT, 'models');
const PORT = process.env.PORT || 8011;
fs.mkdirSync(MODELS, { recursive: true });

// Latest scene state — new displays get this immediately on connect.
let state = {
  model: null, name: 'cube',
  rotX: 0, rotY: 0, autoSpin: true, spinSpeed: 0.5,
  scale: 1, color: '#16f2ff', material: 'normal', wireframe: false,
  mode: 'pyramid', faceRotate: true, gap: 0.18, bg: '#000000',
};

const clients = new Set(); // SSE display connections

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.obj': 'text/plain', '.stl': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

function send(res, code, type, body, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Access-Control-Allow-Origin': '*' }, extra || {}));
  res.end(body);
}

function broadcast() {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const c of clients) { try { c.write(payload); } catch (e) {} }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '');

  // --- SSE: a display subscribes for live state ---
  if (p === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (e) {} }, 15000);
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  // --- controller sends a command (partial state merge) ---
  if (p === '/control' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      Object.assign(state, body);
      broadcast();
      return send(res, 200, 'application/json', JSON.stringify({ ok: true }));
    } catch (e) { return send(res, 400, 'application/json', JSON.stringify({ ok: false, err: String(e) })); }
  }

  // --- controller uploads a model: PUT /upload?name=foo.glb ---
  if (p === '/upload' && req.method === 'PUT') {
    const name = (u.searchParams.get('name') || 'model.glb').replace(/[^\w.\-]/g, '_');
    const buf = await readBody(req);
    fs.writeFileSync(path.join(MODELS, name), buf);
    return send(res, 200, 'application/json', JSON.stringify({ ok: true, url: '/models/' + name, name }));
  }

  // --- list uploaded models ---
  if (p === '/models-list') {
    const files = fs.readdirSync(MODELS).filter((f) => /\.(glb|gltf|obj|stl)$/i.test(f));
    return send(res, 200, 'application/json', JSON.stringify(files));
  }

  // --- static files ---
  let file = p === '/' ? '/controller.html' : p;
  const fp = path.join(ROOT, decodeURIComponent(file));
  if (!fp.startsWith(ROOT)) return send(res, 403, 'text/plain', 'no');
  fs.readFile(fp, (err, data) => {
    if (err) return send(res, 404, 'text/plain', 'not found: ' + file);
    send(res, 200, MIME[path.extname(fp)] || 'application/octet-stream', data);
  });
});

server.listen(PORT, () => {
  const ips = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const a of iface) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  }
  console.log('\n  HoloBox server running.\n');
  console.log('  On the BOX SCREEN open:   http://localhost:' + PORT + '/display.html');
  console.log('  On your PHONE open:       (same Wi-Fi)');
  ips.forEach((ip) => console.log('        http://' + ip + ':' + PORT + '/controller.html'));
  console.log('\n  (laptop controller:       http://localhost:' + PORT + '/controller.html )\n');
});
