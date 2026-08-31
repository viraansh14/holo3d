# HoloBox — build the real glass box

A transparent pyramid (or single 45° sheet) sitting on a screen makes a 3D model
appear to **float inside the glass**. You load models and spin/recolour them live
from your phone or laptop. The floating model is a reflection of the screen, but
because you rotate it in real time your eye reads it as a solid object in the box,
and the 4-sided pyramid lets you walk around and see every side.

This is the genuine, reliable, cheap version of a "hologram in a box". No physics
is being faked beyond what every commercial holographic showcase does.

---

## 1. What you need

**Reflector (pick one):**
- **4-sided pyramid (recommended)** — view from all sides, model floats centred.
- **Single 45° sheet** — one viewing side, bigger and brighter.

**Material for the reflector** — clearest you can get:
- Best: 0.5–1 mm clear acrylic / PETG sheet, or 2 mm glass cut by a glazier.
- Free/fast: a clear plastic document folder, CD jewel-case lids, or rigid
  transparent packaging. Thinner + clearer = cleaner image.

**The screen** — any of: a phone, a tablet (best brightness/size ratio), or a
monitor/laptop screen laid flat. Brighter screen = stronger hologram.

**For the "glass box" look (optional):** a small clear acrylic display cube to
sit the whole thing inside, or a black card box around it to kill stray light.

**Tools:** ruler, marker, sharp craft knife or scissors, cutting mat, clear tape
(or acrylic cement for a permanent build), a dark-ish room.

---

## 2. Cut the reflector

1. Run the app (Section 4) and open the **controller** on any device.
2. In **Cut template for the acrylic pyramid**, enter your screen's **diagonal**
   and **aspect ratio**. It prints the exact trapezoid (base / top / height) and
   gives a **Download cut template (SVG)** button.
3. Print the SVG **at 100% / actual size** (turn off "fit to page").
4. Trace the trapezoid onto your sheet and **cut 4** identical pieces
   (just **1** if you're doing the single-sheet version — cut one rectangle the
   width of your screen, height ≈ screen height).

> The trapezoid is a 45° face: base = ~95% of your screen's short side, a small
> flat top, slant height = (base − top)/2 × 1.414.

## 3. Assemble

**Pyramid:** stand the 4 trapezoids up with the wide edges down, angled inward so
the small tops meet near a point. Tape the vertical seams from the **outside**
with clear tape (or run a thin bead of acrylic cement). You'll get a truncated
pyramid (frustum). Keep tape off the reflecting faces.

**Single sheet:** prop the sheet at **45°** above the screen (a small stand or
two side walls). The model floats in front of the sheet.

## 4. Run it

```bash
cd ~/holo3d/holobox
node server.js
```

The server prints two URLs:
- **On the screen that goes under the box** open `…/display.html` and make it
  full-screen (F11 / browser fullscreen). Lay that screen flat, face up.
- **On your phone** (same Wi-Fi) open the `…/controller.html` URL it printed.

Place the pyramid **apex-up, centred** on the dark square in the middle of the
display. Dim the room.

## 5. Calibrate (10 seconds, from the phone)

On the controller, **Box mode & calibration**:
- **Centre gap** — slide until the 4 images sit just outside the pyramid's base
  edges (image fills each face).
- **Face rotation offset** — if the floating model is upside-down, set 180°.
- **Mirror** — if text/asymmetric models read back-to-front, toggle on.
- **Different side per face** — ON = walk around and see real different angles;
  OFF = same view all round (more symmetric).

Then just play: pick a model or **Upload** a `.glb / .gltf / .obj / .stl`, drag
the pad to rotate, set auto-spin, change material/colour.

---

## Tips for the best hologram

- **Darker room = stronger float.** Ambient light washes out the reflection.
- **Brighter screen, max brightness.** The image is only as bright as the screen.
- **Clearer/thinner reflector** removes the faint double-image (ghosting from the
  sheet's two surfaces). Glass or thin acrylic beats thick plastic.
- **`.glb` is the best format** — self-contained with colours/materials. Grab free
  models from Sketchfab/Poly Haven and upload them.
- High-contrast, glowing-looking models (the **Hologram** or **Glow** material)
  read as the most "holographic".
