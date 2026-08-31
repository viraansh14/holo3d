#!/usr/bin/env python3
"""HoloForge slicer — turn 3D content into cylindrical voxel frames.

A POV volumetric display is a column/blade of addressable LEDs spun on a motor.
As it rotates, motion-blur paints a 3D image in a cylinder of air. The display
addresses voxels in CYLINDRICAL coordinates: (r = radius index, a = angle step,
z = height/LED index). This script voxelizes a model into that grid and emits:

  * a JSON file for the browser simulator (sparse list of lit voxels), and
  * a C header (PROGMEM) for the ESP32 firmware (one static frame).

Usage:
    python3 slice.py globe   --leds 40 --angles 120 --radii 10 -o models/globe
    python3 slice.py torus   -o models/torus
    python3 slice.py helix   -o models/helix
    python3 slice.py mesh model.obj -o models/custom   # .obj or .stl (ascii)

Geometry: the lit cylinder fits a unit space — radius in (0,1], height in [-1,1].
Cartesian cell centre for (r,a,z):
    radius = (r+1)/radii ;  theta = 2*pi*a/angles ;  height = -1 + 2*z/(leds-1)
    x = radius*cos(theta) ;  y = height ;  zc = radius*sin(theta)
"""
import argparse, json, math, os, struct, sys
import numpy as np


# ---------- procedural value noise (for fake continents) ----------
def _hash3(ix, iy, iz):
    n = (ix * 374761393 + iy * 668265263 + iz * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def _vnoise(x, y, z):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    def lerp(a, b, t): return a + (b - a) * (t * t * (3 - 2 * t))
    c = [[[_hash3(ix + dx, iy + dy, iz + dz) for dz in (0, 1)]
          for dy in (0, 1)] for dx in (0, 1)]
    x0 = [[lerp(c[0][dy][dz], c[1][dy][dz], fx) for dz in (0, 1)] for dy in (0, 1)]
    y0 = [lerp(x0[0][dz], x0[1][dz], fy) for dz in (0, 1)]
    return lerp(y0[0], y0[1], fz)


# ---------- model occupancy functions: f(x,y,z) -> None | (r,g,b) ----------
def m_globe(x, y, z):
    rad = math.sqrt(x * x + y * y + z * z)
    if abs(rad - 0.85) > 0.06:
        return None
    # latitude for ice caps; fractal noise for land/ocean.
    lat = math.asin(max(-1, min(1, y / max(1e-6, rad))))
    n = _vnoise(x * 3 + 5, y * 3, z * 3) * 0.6 + _vnoise(x * 6, y * 6, z * 6) * 0.4
    if abs(lat) > 1.32:
        return (235, 245, 255)                       # polar ice
    if n > 0.52:
        g = 90 + int(120 * (n - 0.52) / 0.48)
        return (40, min(200, g), 60)                 # land
    return (20, 70, 180)                             # ocean


def m_torus(x, y, z):
    R, rr = 0.6, 0.28
    q = math.sqrt(x * x + z * z) - R
    d = math.sqrt(q * q + y * y)
    if abs(d - rr) > 0.05:
        return None
    ang = (math.atan2(z, x) + math.pi) / (2 * math.pi)
    c = _hsv(ang, 0.9, 1.0)
    return c


def m_helix(x, y, z):
    # Double helix (DNA-ish) along the vertical axis.
    best = None
    for phase, col in ((0.0, (0, 230, 255)), (math.pi, (255, 60, 200))):
        th = y * 3.0 * math.pi + phase
        cx, cz = 0.55 * math.cos(th), 0.55 * math.sin(th)
        d = math.sqrt((x - cx) ** 2 + (z - cz) ** 2)
        if d < 0.12:
            best = col
    # rungs
    th = y * 3.0 * math.pi
    if abs(((y * 6) % 1.0) - 0.0) < 0.06:
        cx, cz = 0.55 * math.cos(th), 0.55 * math.sin(th)
        if abs(x + cx) < 0.6 and abs(z + cz) < 0.6:
            d_line = abs(x * math.sin(th) - z * math.cos(th))
            if d_line < 0.08 and math.sqrt(x * x + z * z) < 0.56:
                return (200, 200, 120)
    return best


def _hsv(h, s, v):
    i = int(h * 6) % 6
    f = h * 6 - int(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    r, g, b = [(v, t, p), (q, v, p), (p, v, t),
               (p, q, v), (t, p, v), (v, p, q)][i]
    return (int(r * 255), int(g * 255), int(b * 255))


# ---------- ascii OBJ / STL surface voxelization ----------
def load_mesh(path):
    verts, tris = [], []
    ext = os.path.splitext(path)[1].lower()
    with open(path) as f:
        if ext == '.obj':
            for line in f:
                if line.startswith('v '):
                    verts.append([float(t) for t in line.split()[1:4]])
                elif line.startswith('f '):
                    idx = [int(p.split('/')[0]) - 1 for p in line.split()[1:]]
                    for k in range(1, len(idx) - 1):
                        tris.append((idx[0], idx[k], idx[k + 1]))
        else:  # ascii STL
            cur = []
            for line in f:
                s = line.split()
                if len(s) == 4 and s[0] == 'vertex':
                    cur.append([float(s[1]), float(s[2]), float(s[3])])
                    if len(cur) == 3:
                        base = len(verts)
                        verts.extend(cur)
                        tris.append((base, base + 1, base + 2))
                        cur = []
    v = np.array(verts, float)
    if len(v) == 0:
        sys.exit('No vertices parsed (binary STL not supported — re-export as ASCII/OBJ).')
    v -= v.mean(0)
    v /= np.abs(v).max() * 1.05          # fit unit space
    return v, tris


def voxelize_mesh(path, leds, angles, radii):
    v, tris = load_mesh(path)
    lit = {}
    # Sample each triangle densely; drop samples into the nearest cylindrical cell.
    for (a, b, c) in tris:
        p0, p1, p2 = v[a], v[b], v[c]
        n = 8
        for i in range(n + 1):
            for j in range(n - i + 1):
                u, w = i / n, j / n
                p = p0 * (1 - u - w) + p1 * u + p2 * w
                cell = _to_cell(p[0], p[1], p[2], leds, angles, radii)
                if cell:
                    lit[cell] = (180, 220, 255)
    return [[z, a, r, _hex(col)] for (r, a, z), col in lit.items()]


def _to_cell(x, y, z, leds, angles, radii):
    radius = math.sqrt(x * x + z * z)
    if radius > 1.0 or abs(y) > 1.0:
        return None
    r = min(radii - 1, max(0, round(radius * radii - 1)))
    a = int(((math.atan2(z, x) + math.pi) / (2 * math.pi)) * angles) % angles
    zi = min(leds - 1, max(0, round((y + 1) / 2 * (leds - 1))))
    return (r, a, zi)


def _hex(c):
    return '%02x%02x%02x' % (max(0, min(255, c[0])), max(0, min(255, c[1])), max(0, min(255, c[2])))


PROC = {'globe': m_globe, 'torus': m_torus, 'helix': m_helix}


def slice_proc(fn, leds, angles, radii):
    lit = []
    for z in range(leds):
        y = -1 + 2 * z / (leds - 1)
        for a in range(angles):
            th = 2 * math.pi * a / angles
            for r in range(radii):
                radius = (r + 1) / radii
                x, zc = radius * math.cos(th), radius * math.sin(th)
                col = fn(x, y, zc)
                if col:
                    lit.append([z, a, r, _hex(col)])
    return lit


def write_outputs(name, lit, leds, angles, radii, fps, out):
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    data = {'type': 'holo-voxel-v1', 'geometry': 'cylindrical', 'name': name,
            'leds': leds, 'angles': angles, 'radii': radii, 'fps': fps,
            'frames': [{'lit': lit}]}
    with open(out + '.json', 'w') as f:
        json.dump(data, f)
    # C header: angle-major RGB for radius 0 (the simplest single-strip build).
    shell = {}
    for z, a, r, hx in lit:
        if r == radii - 1:                      # outermost = the rim strip
            shell[(a, z)] = hx
    with open(out + '.h', 'w') as f:
        f.write(f'// {name}: shell frame for single rim strip. {angles} angles x {leds} leds.\n')
        f.write(f'#define HOLO_ANGLES {angles}\n#define HOLO_LEDS {leds}\n')
        f.write('const uint32_t HOLO_FRAME[HOLO_ANGLES][HOLO_LEDS] = {\n')
        for a in range(angles):
            row = ','.join('0x' + shell.get((a, z), '000000') for z in range(leds))
            f.write('  {' + row + '},\n')
        f.write('};\n')
    print(f'{name}: {len(lit)} lit voxels -> {out}.json (+ {out}.h)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('model', help='globe|torus|helix|mesh')
    ap.add_argument('path', nargs='?', help='.obj/.stl when model=mesh')
    ap.add_argument('--leds', type=int, default=40)
    ap.add_argument('--angles', type=int, default=120)
    ap.add_argument('--radii', type=int, default=10)
    ap.add_argument('--fps', type=int, default=20)
    ap.add_argument('-o', '--out', default=None)
    a = ap.parse_args()
    out = a.out or os.path.join('models', a.model)
    if a.model == 'mesh':
        if not a.path:
            sys.exit('mesh needs a path to an .obj/.stl file')
        lit = voxelize_mesh(a.path, a.leds, a.angles, a.radii)
        name = os.path.splitext(os.path.basename(a.path))[0]
    elif a.model in PROC:
        lit = slice_proc(PROC[a.model], a.leds, a.angles, a.radii)
        name = a.model
    else:
        sys.exit(f'unknown model: {a.model}')
    write_outputs(name, lit, a.leds, a.angles, a.radii, a.fps, out)


if __name__ == '__main__':
    main()
