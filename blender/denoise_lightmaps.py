"""Edge-preserving clean-up of already-baked lightmaps (for bakes made without the in-script filter).

  blender -b --factory-startup --python blender/denoise_lightmaps.py -- [--radius 3]
"""
import bpy, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'site', 'public', 'room')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RADIUS = int(args[args.index('--radius') + 1]) if '--radius' in args else 3


def to_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def to_srgb(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.maximum(x, 1e-8), 1 / 2.4) - 0.055)


def denoise(img, radius, sigma_s, sigma_r=0.22):
    h, w, _ = img.shape
    lum = img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    pad = np.pad(img, ((radius, radius), (radius, radius), (0, 0)), mode='edge')
    lpad = np.pad(lum, radius, mode='edge')
    acc = np.zeros_like(img)
    wsum = np.zeros_like(lum)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            nb = pad[radius + dy:radius + dy + h, radius + dx:radius + dx + w]
            nl = lpad[radius + dy:radius + dy + h, radius + dx:radius + dx + w]
            wgt = np.exp(-(dx * dx + dy * dy) / (2 * sigma_s ** 2)) * np.exp(-0.5 * ((nl - lum) / (sigma_r * (lum + 0.02))) ** 2)
            acc += nb * wgt[..., None]
            wsum += wgt
    return acc / wsum[..., None]


for label in ('day', 'night', 'cozy'):
    path = os.path.join(OUT, f'lightmap_{label}.webp')
    src = bpy.data.images.load(path)
    src.colorspace_settings.name = 'Non-Color'
    w, h = src.size
    px = np.empty(w * h * 4, dtype=np.float32)
    src.pixels.foreach_get(px)
    rgb = px.reshape(h, w, 4)[:, :, :3]
    clean = to_srgb(np.clip(denoise(to_linear(rgb), RADIUS, RADIUS * 0.75), 0, 1))
    out = np.ones((h, w, 4), dtype=np.float32)
    out[:, :, :3] = clean
    img = bpy.data.images.new(f'{label}_clean', w, h, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = path
    img.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.quality = 90
    img.save()
    print('[denoise]', label, 'done', flush=True)
