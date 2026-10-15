# Baked lighting

The room on the site is drawn with **lighting baked in Blender**: Cycles works out sunlight through the window, light bouncing off the walls, soft shadows and the night lamps once, offline. The site then shows every surface as *its texture × its lightmap*. That looks close to a photo and costs the browser almost nothing: no realtime lights, shadows or ambient occlusion.

## Files

| File | What it is |
| --- | --- |
| `room_source.glb` | The room exported from the live site (the source geometry). |
| `bake_room.py` | Blender script: detailed models → rounded edges → lightmap UVs → Cycles bake (day + night) → denoise → export. |
| `models.py` | The detailed bed (cloth-simulated blanket), ergonomic office chair (see-through mesh back, padded seat and armrests, five-star base) and acoustic guitar on a stand, built procedurally. They replace the simple shapes from the site (`model_bed`, `model_chair`, `model_guitar`). |
| `../site/public/room/room_baked.glb` | Room geometry + textures + a 2nd UV set for the lightmaps. |
| `../site/public/room/lightmap_{day,night,cozy}.webp` | The baked light (WEBP keeps them small). |
| `../site/public/room/lightmaps.json` | Brightness scale for each lightmap. |

Not baked: the two screens, the movie posters and the corkboard (objects named `nobake_*`). Their pictures are drawn or loaded live in the browser, so changing posters or corkboard notes in `content.ts` never needs a re-bake. In Blender the screens still act as soft light sources at night (`screen_lights()`).

If the files in `site/public/room/` are missing, the site falls back to the realtime-lit room automatically.

## Re-baking after you change the room

The room is still built in code (`site/src/room/*.tsx`). After changing furniture, layout or materials:

1. **Export the room from the browser.** Run `npm run dev` in `site/`, open `http://localhost:5173/?realtime` (the realtime-lit room), and in the browser console run:

   ```js
   await __room.exportScene()
   ```

   This saves `blender/room_source.glb` (dev server only).

2. **Bake** (about 2 hours on an M1, using its GPU; bakes day, night and cozy lighting):

   ```bash
   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python blender/bake_room.py -- --size 4096 --samples 320
   ```

   For a quick preview, use `--size 1024 --samples 48` (about 2 minutes).

3. Reload the site.

## Tuning

- **Brightness:** `EXPOSURE` in `site/src/room/BakedScene.tsx`.
- **Sun direction, sky, lamp strengths:** `setup_day()` / `setup_night()` in `bake_room.py`. Keep the sun direction in sync with `SUN_POSITION` in `site/src/room/layout.ts`, because the sunbeam effect uses it too.
- **Glow at night:** `HOT` colors in `BakedScene.tsx`.
