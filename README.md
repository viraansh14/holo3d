# HoloForge — home 3D / holographic displays

Real, buildable ways to show 3D in physical space at home. Built and verified
end-to-end, not just planned.

## ⭐ HoloBox — the main build (`holobox/`)

A clear pyramid (or 45° sheet) on a screen makes a 3D model **float inside a
glass box**. Load `.glb/.gltf/.obj/.stl` models and rotate / spin / recolour them
**live from your phone or laptop** over Wi-Fi.

- `server.js` — zero-dependency Node relay (phone → display over SSE) + uploads.
- `display.html` / `display.js` — the 4-view pyramid renderer that goes under the box.
- `controller.html` — phone/laptop UI: model picker, upload, rotate pad, spin,
  material/colour, pyramid↔sheet, calibration, and an auto-generated **cut
  template** sized to your screen.
- `BUILD.md` — how to cut and assemble the physical box, run it, and calibrate.

**Run:**
```bash
cd holobox && node server.js     # or double-click holobox/start.command
```
Open `display.html` on the screen under the box; open the printed LAN URL
(`…/controller.html`) on your phone. Full build steps in `holobox/BUILD.md`.

Status: ✅ working — pyramid layout, live phone→display control, model upload,
and OBJ/GLTF/STL loading all verified in-browser.

## Bonus: HoloRoom — walk *inside* a 3D world (`holoroom/`)

Head-tracked off-axis projection turns a screen/projector into a window you can
lean into and look around; a WebXR button steps you fully inside on a headset.
Project it onto walls + track your head for a walk-in "holodeck". Open
`holoroom/index.html` via a local server. ✅ parallax verified in-browser.

## Bonus: POV volumetric (`slicer/`, `firmware/`, `simulator/`)

Real glowing **voxels in a cylinder of air** from a spinning LED strip.
`slicer/slice.py` turns models (procedural globe/torus/helix or any `.obj/.stl`)
into cylindrical voxel frames for both a simulator and the **ESP32 firmware**
(`firmware/holo_pov/`). This is the genuine "floating light" hardware route.

---
The one honest law: light is invisible until it hits something, so a true
free-floating-in-clear-air hologram isn't possible at home. Each build here works
*with* that — a reflection medium (HoloBox), a perspective trick (HoloRoom), or
making light visible in real space (POV voxels).
