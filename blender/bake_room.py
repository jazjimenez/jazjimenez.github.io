"""
Bake photoreal lighting for the room.

  blender -b --factory-startup --python bake_room.py -- [--size 4096] [--samples 384]

Input : blender/room_source.glb   (exported from the live site: `await __room.exportScene()` in dev)
Output: site/public/room/room_baked.glb      geometry + original textures + a 2nd UV set for lightmaps
        site/public/room/lightmap_day.webp    baked sunlight + skylight + bounce light
        site/public/room/lightmap_night.webp  desk lamp, ceiling light, parol, moonlight
        site/public/room/lightmaps.json       intensity scale for each map

The site draws the baked room with unlit materials (texture × lightmap): photoreal light for the
cost of a texture lookup — no realtime lights, shadows or ambient occlusion.

Coordinates: glTF import converts three.js Y-up to Blender Z-up: three (x, y, z) -> blender (x, -z, y).
"""
import bpy, bmesh, json, math, os, sys, tempfile, time
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'room_source.glb')
OUT = os.path.join(HERE, '..', 'site', 'public', 'room')

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(args[args.index(name) + 1]) if name in args else default
SIZE = arg('--size', 4096)        # bake resolution; saved at half size (2× supersampled = less noise)
SAMPLES = arg('--samples', 384)

def b(x, y, z):
    """three.js coordinates -> Blender coordinates"""
    return Vector((x, -z, y))

def log(*a):
    print('[bake]', *a, flush=True)

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene

# Swap the simple bed/chair/plant for detailed models (see models.py).
sys.path.insert(0, HERE)
import models  # noqa: E402
detailed = models.replace_all(scene)

meshes = [o for o in scene.objects if o.type == 'MESH']
targets = [o for o in meshes if not o.name.startswith('nobake_')]
log(f'{len(meshes)} meshes, {len(targets)} bake targets')

# Every target needs its own mesh data (shared meshes would share one lightmap island).
bpy.ops.object.select_all(action='DESELECT')
for o in targets:
    o.select_set(True)
bpy.context.view_layer.objects.active = targets[0]
bpy.ops.object.make_single_user(object=True, obdata=True, material=False)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# ---------------------------------------------------------------- drop faces nobody can see
# Outer faces of the walls/floor/ceiling are never visible from inside — don't waste lightmap on them.
# Interior: three x,z ∈ [-3,3], y ∈ [0,3]  ->  blender x,y ∈ [-3,3], z ∈ [0,3]. Keep the window reveal.
def outside_room(c):
    eps = 0.03
    # window centre is three z=-0.6 -> blender y=+0.6
    in_window_reveal = c.x < -2.9 and 0.6 - 0.9 < c.y < 0.6 + 0.9 and 1.1 < c.z < 2.6
    if in_window_reveal:
        return False
    return c.x < -3 - eps or c.x > 3 + eps or c.y < -3 - eps or c.y > 3 + eps or c.z < -eps or c.z > 3 + eps

# The removed faces still matter for light: without them the walls are open boxes and sky light
# leaks in along the corners. Keep them in a separate 'blocker' object that shadows the bake but is
# never baked or exported.
def bevel_sharp_edges(o, bm):
    """Round off the razor-sharp edges of box-shaped furniture (real edges always catch a little light).
    Skips the room shell, flat things, tiny parts and the already-detailed models."""
    if o.name in detailed or o.name.startswith(('emit_', 'nobake_')):
        return
    dims = o.dimensions
    if max(dims) > 2.5 or min(dims) < 0.012 or len(bm.verts) > 200:
        return
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(60)]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=min(0.006, min(dims) * 0.2), segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)


blocker_bm = bmesh.new()
removed = 0
for o in targets:
    bm = bmesh.new()
    bm.from_mesh(o.data)
    mw = o.matrix_world
    dead = [f for f in bm.faces if outside_room(mw @ f.calc_center_median())]
    removed += len(dead)
    for f in dead:
        blocker_bm.faces.new([blocker_bm.verts.new(mw @ v.co) for v in f.verts])
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    # three.js geometry arrives with every hard edge split into separate vertices; weld them so faces
    # form proper UV islands (otherwise each face becomes its own island and the atlas packs terribly).
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges)
    bevel_sharp_edges(o, bm)
    bm.to_mesh(o.data)
    bm.free()
targets = [o for o in targets if len(o.data.polygons) > 0]
blocker_mesh = bpy.data.meshes.new('blocker')
blocker_bm.to_mesh(blocker_mesh)
blocker_bm.free()
blocker = bpy.data.objects.new('blocker', blocker_mesh)
scene.collection.objects.link(blocker)
blocker_mat = bpy.data.materials.new('blocker')
blocker_mat.use_nodes = True
blocker_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1)
blocker_mesh.materials.append(blocker_mat)
log(f'moved {removed} hidden faces to a light blocker')

# Welding dropped the imported custom normals: rebuild smooth/hard shading by angle (≈ three.js look).
for o in targets:
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        try:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except RuntimeError:
            pass
    o.data.shade_smooth()
    o.data.set_sharp_from_angle(angle=math.radians(40))

# ---------------------------------------------------------------- lightmap UVs (shared atlas)
for o in targets:
    uv = o.data.uv_layers.new(name='lightmap')
    o.data.uv_layers[0].active_render = True   # base-colour textures keep using the original UVs
    o.data.uv_layers.active = uv               # the bake writes through the lightmap UVs

bpy.ops.object.select_all(action='DESELECT')
for o in targets:
    o.select_set(True)
bpy.context.view_layer.objects.active = targets[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=0.0015)
bpy.ops.object.mode_set(mode='OBJECT')
log('lightmap UVs packed')

# ---------------------------------------------------------------- render settings
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    log('using GPU:', [d.name for d in prefs.devices if d.use])
except Exception as e:  # noqa: BLE001
    log('GPU unavailable, using CPU:', e)

scene.render.engine = 'CYCLES'
scene.cycles.samples = SAMPLES
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 2
scene.cycles.transparent_max_bounces = 8
scene.cycles.sample_clamp_indirect = 8.0  # tame fireflies
scene.render.bake.margin = 16
scene.render.bake.margin_type = 'EXTEND'

# ---------------------------------------------------------------- materials: light-emitting bits
def emission(obj_name, color, strength):
    o = scene.objects.get(obj_name)
    if not o:
        return
    for slot in o.material_slots:
        bsdf = next((n for n in slot.material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bsdf.inputs['Emission Color'].default_value = (*color, 1)
            bsdf.inputs['Emission Strength'].default_value = strength

def outside_glow(strength, tint):
    """The street/sky picture outside the window lights the room like a real sky would."""
    o = scene.objects.get('nobake_outside')
    if not o:
        return
    for slot in o.material_slots:
        nt = slot.material.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
        if bsdf and tex:
            nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = strength
            bsdf.inputs['Base Color'].default_value = (*tint, 1)

world = bpy.data.worlds.new('sky')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']

def clear_lights():
    for o in [o for o in scene.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o, do_unlink=True)

def add_light(kind, name, loc, energy, color, size=0.05, direction=None):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == 'SUN':
        data.angle = math.radians(0.8)  # soft-ish sun edge
    elif kind == 'AREA':
        data.shape = 'DISK'
        data.size = size
    else:
        data.shadow_soft_size = size
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.location = loc
    if direction is not None:
        o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return o

def world_pos(name, fallback):
    o = scene.objects.get(name)
    return o.matrix_world.translation.copy() if o else fallback

def setup_day():
    clear_lights()
    sun_from = b(-9, 6.5, 1.2)  # matches SUN_POSITION in site/src/room/layout.ts
    add_light('SUN', 'sun', sun_from, 4.2, (1.0, 0.9, 0.78), direction=-sun_from.normalized())
    bg.inputs['Color'].default_value = (0.5, 0.68, 0.95, 1)
    bg.inputs['Strength'].default_value = 1.2
    outside_glow(1.4, (1, 1, 1))
    emission('emit_parol', (1, 0.6, 0.2), 0)
    emission('emit_ceiling', (1, 0.85, 0.6), 0)
    emission('emit_bulb', (1, 0.8, 0.5), 0)

def screen_lights(power):
    """The monitor and the MacBook screens glow a cool white onto the keyboard, desk and your face."""
    for name, share in (('nobake_screen_monitor', 1.0), ('nobake_screen_laptop', 0.6)):
        scr = scene.objects.get(name)
        if not scr:
            continue
        poly = scr.data.polygons[0]
        vs = [scr.matrix_world @ scr.data.vertices[i].co for i in poly.vertices]
        centre = sum(vs, Vector()) / len(vs)
        normal = (scr.matrix_world.to_3x3() @ poly.normal).normalized()
        if normal.y > 0:  # make sure it faces the chair (−Y in Blender is toward the desk wall)
            normal = -normal
        w, h = sorted(((vs[1] - vs[0]).length, (vs[2] - vs[1]).length), reverse=True)
        light = add_light('AREA', name[7:], centre + normal * 0.004, power * share, (0.78, 0.84, 1.0), direction=normal)
        light.data.shape = 'RECTANGLE'
        light.data.size, light.data.size_y = w, h


def setup_night(cozy=False):
    """Night. `cozy`: the ceiling light and parol are off — only the desk lamp, laptop and window."""
    clear_lights()
    moon_from = b(-9, 6.5, 1.2)
    add_light('SUN', 'moon', moon_from, 0.12, (0.55, 0.65, 1.0), direction=-moon_from.normalized())
    bg.inputs['Color'].default_value = (0.05, 0.07, 0.16, 1)
    bg.inputs['Strength'].default_value = 0.4
    outside_glow(0.25, (0.6, 0.65, 1.0))
    # Desk lamp: a soft disc light at the shade's mouth, aimed where the shade points, plus a faint
    # glow inside the shade so its lining lights up.
    bulb = scene.objects.get('emit_bulb')
    if bulb:
        mouth = bulb.matrix_world.translation.copy()
        aim = (bulb.matrix_world.to_3x3() @ bulb.data.polygons[0].normal).normalized()
        if aim.z > 0:
            aim = -aim  # the disc is double-sided; the light goes down
    else:
        mouth, aim = b(-0.7, 1.21, -2.49), Vector((0.18, -0.28, -1)).normalized()
    # A shade focuses the light: a strong area light with a limited spread makes a real pool on the desk.
    lamp = add_light('AREA', 'desk_lamp', mouth + aim * 0.01, 60, (1.0, 0.74, 0.46), size=0.16, direction=aim)
    lamp.data.spread = math.radians(110)
    add_light('POINT', 'desk_lamp_glow', mouth - aim * 0.05, 1.0, (1.0, 0.74, 0.46), size=0.02)
    screen_lights(5 if cozy else 3)
    # the glowing mouth of the shade: bright to look at, but not a floodlight (emission goes both ways)
    emission('emit_bulb', (1, 0.8, 0.5), 8)
    if cozy:
        emission('emit_parol', (1, 0.6, 0.2), 0)
        emission('emit_ceiling', (1, 0.85, 0.6), 0)
        return
    ceil = world_pos('emit_ceiling', b(0, 2.97, 0))
    add_light('AREA', 'ceiling_light', ceil + Vector((0, 0, -0.05)), 140, (1.0, 0.82, 0.6), size=0.5, direction=Vector((0, 0, -1)))
    parol = world_pos('emit_parol', b(-2.2, 2.4, -1.9))
    add_light('POINT', 'parol', parol, 18, (1.0, 0.55, 0.2), size=0.15)
    emission('emit_parol', (1, 0.6, 0.2), 6)
    emission('emit_ceiling', (1, 0.85, 0.6), 8)

# ---------------------------------------------------------------- bake
bake_img = bpy.data.images.new('lightmap', SIZE, SIZE, float_buffer=True, alpha=False)
bake_nodes = []
for mat in {s.material for o in targets for s in o.material_slots if s.material}:
    mat.use_nodes = True
    n = mat.node_tree.nodes.new('ShaderNodeTexImage')
    n.image = bake_img
    n.interpolation = 'Linear'
    mat.node_tree.nodes.active = n
    bake_nodes.append((mat, n))

# The mason jar's glass is real glass for the bake (light passes through and refracts).
for mat in bpy.data.materials:
    if mat.name.startswith('glass') and mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bsdf.inputs['Transmission Weight'].default_value = 1.0
            bsdf.inputs['Roughness'].default_value = 0.05
            bsdf.inputs['Alpha'].default_value = 1.0
            bsdf.inputs['IOR'].default_value = 1.5


def under(o, prefix):
    """Is `o` (or any of its parents) named prefix…?"""
    while o is not None:
        if o.name.startswith(prefix):
            return True
        o = o.parent
    return False


# The two cups share a spot on the desk and are never shown together: the mug by day, the jar at
# night. They're baked separately (each only in the lighting it appears in) so they don't shadow
# each other; everything else is baked as one merged copy.
cups_day = [o for o in targets if under(o, 'cup_day')]
cups_night = [o for o in targets if under(o, 'cup_night')]
cups = cups_day + cups_night
room_targets = [o for o in targets if o not in cups]

# Bake one merged copy instead of ~200 objects (Cycles bakes object by object; the overhead dominates).
# Same lightmap UVs and materials, so it writes the same atlas. The originals are hidden meanwhile.
bpy.ops.object.select_all(action='DESELECT')
for o in room_targets:
    o.select_set(True)
bpy.context.view_layer.objects.active = room_targets[0]
bpy.ops.object.duplicate(linked=False)
bpy.ops.object.join()
proxy = bpy.context.view_layer.objects.active
proxy.name = 'bake_proxy'
for o in targets:
    o.hide_render = True
bpy.ops.object.select_all(action='DESELECT')
proxy.select_set(True)
bpy.context.view_layer.objects.active = proxy

os.makedirs(OUT, exist_ok=True)
scales = {}

def srgb_encode(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.maximum(x, 1e-8), 1 / 2.4) - 0.055)

def denoise(img, radius=2, sigma_s=1.6, sigma_r=0.22):
    """Edge-preserving (bilateral) smoothing: removes Monte-Carlo speckle but keeps shadow edges.
    The range term is relative to brightness, so dark corners and bright patches are treated alike."""
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


def oidn(img):
    """Denoise a float image with OpenImageDenoise via a throwaway compositor scene. Returns H×W×3."""
    w, h = img.size
    sc = bpy.data.scenes.new('denoise')
    cam = bpy.data.objects.new('denoise_cam', bpy.data.cameras.new('denoise_cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.view_settings.view_transform = 'Standard'
    ng = bpy.data.node_groups.new('denoise', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    src = ng.nodes.new('CompositorNodeImage')
    src.image = img
    dn = ng.nodes.new('CompositorNodeDenoise')
    dn.inputs['HDR'].default_value = True
    out = ng.nodes.new('NodeGroupOutput')
    ng.links.new(src.outputs['Image'], dn.inputs['Image'])
    ng.links.new(dn.outputs[0], out.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = True
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    path = os.path.join(tempfile.gettempdir(), f'lightmap_denoised_{os.getpid()}.exr')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    res = bpy.data.images.load(path)
    res.colorspace_settings.name = 'Linear Rec.709'
    px = np.empty(w * h * 4, dtype=np.float32)
    res.pixels.foreach_get(px)
    bpy.data.images.remove(res)
    bpy.data.scenes.remove(sc)
    os.remove(path)
    return px.reshape(h, w, 4)[:, :, :3]


def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def bake(label, active_cups):
    t0 = time.time()
    for o in cups:  # only this lighting's cup is in the scene
        o.hide_render = o not in active_cups
    select_only([proxy])
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=8, use_clear=True)
    if active_cups:  # then the cup itself, into the same atlas (no margin, so neighbours stay intact)
        select_only(active_cups)
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=0, use_clear=False)
    log(f'{label}: baked in {time.time() - t0:.0f}s')
    try:
        rgb = oidn(bake_img)  # AI denoiser (OpenImageDenoise) on the full-res bake
        log(f'{label}: denoised with OIDN')
    except Exception as e:  # noqa: BLE001
        log(f'{label}: OIDN unavailable ({e}); using the bilateral filter only')
        px = np.empty(SIZE * SIZE * 4, dtype=np.float32)
        bake_img.pixels.foreach_get(px)
        rgb = px.reshape(SIZE, SIZE, 4)[:, :, :3]
    # 2× downsample = averaging 4 samples per texel (cheap denoise)
    half = SIZE // 2
    rgb = rgb.reshape(half, 2, half, 2, 3).mean(axis=(1, 3))
    rgb = denoise(rgb, radius=1, sigma_s=0.9)  # light touch-up for anything OIDN left
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lit = lum[lum > 1e-4]
    # Expose for the room, not the sun patch: anything brighter than 6× the median just clips
    # (it reads as blown-out sunlight anyway) and the 8-bit range goes to the interior.
    scale = float(min(np.percentile(lit, 99.5), 6 * np.median(lit))) if lit.size else 1.0
    scale = max(scale, 1e-3)
    enc = srgb_encode(np.clip(rgb / scale, 0, 1))
    out = np.ones((half, half, 4), dtype=np.float32)
    out[:, :, :3] = enc
    img = bpy.data.images.new(f'lightmap_{label}_out', half, half, alpha=False)
    img.colorspace_settings.name = 'Non-Color'  # values are already sRGB-encoded; write them as-is
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = os.path.join(OUT, f'lightmap_{label}.webp')
    img.file_format = 'WEBP'  # ~30% smaller than JPEG at the same quality
    scene.render.image_settings.quality = 90
    img.save()
    scales[label] = scale
    log(f'{label}: saved, scale={scale:.3f}')

setup_day()
bake('day', cups_day)
setup_night()
bake('night', cups_night)
setup_night(cozy=True)
bake('cozy', cups_night)

with open(os.path.join(OUT, 'lightmaps.json'), 'w') as f:
    json.dump({'scale': scales, 'size': SIZE // 2}, f, indent=2)

# ---------------------------------------------------------------- export
bpy.data.objects.remove(proxy, do_unlink=True)
bpy.data.objects.remove(blocker, do_unlink=True)
for o in targets:
    o.hide_render = False
for mat, n in bake_nodes:
    mat.node_tree.nodes.remove(n)
emission('emit_parol', (1, 0.6, 0.2), 0)
emission('emit_ceiling', (1, 0.85, 0.6), 0)
emission('emit_bulb', (1, 0.8, 0.5), 0)
clear_lights()

bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'room_baked.glb'),
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_image_format='WEBP',
    export_image_quality=85,
    export_lights=False,
    export_cameras=False,
    export_yup=True,
    export_apply=False,
)
log('exported', os.path.join(OUT, 'room_baked.glb'))
