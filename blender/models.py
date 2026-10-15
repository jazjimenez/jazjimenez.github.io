"""
Detailed furniture, modelled procedurally in Blender, that replaces the simple shapes the site
builds in three.js. Used by bake_room.py before baking, so the new models get baked lighting too.

Each builder rebuilds one named group from the exported room (model_bed, model_chair, model_guitar):
the old simple meshes are removed and the new ones are parented to the same empty, so they sit
exactly where the site placed the original.

Local axes (Blender, Z up): the glTF importer turns three.js (x, y, z) into (x, -z, y). So:
  bed   — headboard toward +Y, width along X
  chair — office chair facing +Y (toward the desk), backrest toward -Y
"""
import bpy, bmesh, math, random
from mathutils import Matrix, Quaternion, Vector

scene = None  # set by replace_all()


# ------------------------------------------------------------------ helpers

def lin(hex_color):
    """'#rrggbb' (sRGB) -> linear RGBA for Blender colour sockets."""
    h = hex_color.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def material(name, color, rough=0.6, metal=0.0, source=None):
    """New Principled material, or a copy of `source` (keeps its image texture, e.g. the wood)."""
    if source is not None:
        m = source.copy()
        m.name = name
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    m.use_backface_culling = False  # exported as double-sided (thin leaves, cloth)
    return m


def add_box(bm, center, size, bevel=0.0, segments=2):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=Vector(size), verts=verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=verts)
    if bevel:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=segments, profile=0.5, affect='EDGES', clamp_overlap=True)
    return verts


def add_rod(bm, a, b, r1, r2=None, segments=12):
    """Tapered cylinder from point a (radius r1) to point b (radius r2)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r1, radius2=r2 if r2 is not None else r1, depth=d.length)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.rotate(bm, verts=res['verts'], cent=(0, 0, 0), matrix=q.to_matrix())
    bmesh.ops.translate(bm, vec=(a + b) / 2, verts=res['verts'])
    return res['verts']


def box_uv(bm, scale):
    """Box-projected UVs (each face mapped from its dominant axis) — no edit-mode operators needed."""
    bm.normal_update()
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal
        axis = max(range(3), key=lambda i: abs(n[i]))
        a, b2 = [i for i in range(3) if i != axis]
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (co[a] / scale, co[b2] / scale)


def make_object(name, bm, mat, parent, smooth=True, uv_scale=0.5, fix_normals=True):
    if fix_normals:  # faces must point outward, or the bake lights the wrong side
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    box_uv(bm, uv_scale)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.parent = parent
    if smooth:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(35))
    return o


def rebuild_uv(o, scale=0.5):
    """Recompute box UVs after modifiers changed the mesh (e.g. the chair's remesh)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for layer in list(bm.loops.layers.uv.values()):
        bm.loops.layers.uv.remove(layer)
    box_uv(bm, scale)
    bm.to_mesh(o.data)
    bm.free()


def apply_modifiers(o):
    with bpy.context.temp_override(active_object=o, object=o, selected_objects=[o], selected_editable_objects=[o]):
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)


def clear_children(empty):
    """Remove the simple meshes; return their materials (to reuse e.g. the wood)."""
    mats = []
    for c in list(empty.children_recursive):
        if c.type == 'MESH':
            mats.extend(s.material for s in c.material_slots if s.material)
    for c in list(empty.children_recursive):
        bpy.data.objects.remove(c, do_unlink=True)
    return mats


def textured(mats):
    """First material that uses an image texture (the wood)."""
    for m in mats:
        if m.use_nodes and any(n.type == 'TEX_IMAGE' and n.image for n in m.node_tree.nodes):
            return m
    return None


# ------------------------------------------------------------------ bed

def build_bed(empty):
    clear_children(empty)
    fabric = material('hd_bed_fabric', '#8f8a82', rough=1.0)
    metal = material('hd_bed_legs', '#1c1c1e', rough=0.35, metal=0.9)

    # modern upholstered platform on slim metal legs
    bm = bmesh.new()
    add_box(bm, (0, 0, 0.195), (1.1, 2.06, 0.25), bevel=0.035, segments=4)
    # padded headboard panel (+Y) …
    add_box(bm, (0, 1.065, 0.6), (1.16, 0.07, 1.06), bevel=0.03, segments=4)
    frame = make_object('hd_bed_frame', bm, fabric, empty)
    # … with channel-tufted cushions on its front face
    bm = bmesh.new()
    channels = 6
    cw = 1.08 / channels
    for i in range(channels):
        cx = -0.54 + cw * (i + 0.5)
        verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
        bmesh.ops.subdivide_edges(bm, edges=list({e for v in verts for e in v.link_edges}), cuts=6, use_grid_fill=True)
        mine = [v for v in bm.verts if abs(v.co.x) <= 0.5001 and abs(v.co.y) <= 0.5001 and abs(v.co.z) <= 0.5001 and not v.tag]
        for v in mine:
            u = v.co.x * 2  # -1..1 across the channel
            puff = 1 - 0.55 * u * u
            v.co = Vector((cx + v.co.x * (cw - 0.008), 1.005 + v.co.y * 0.05 * puff, 0.76 + v.co.z * 0.66))
            v.tag = True
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(55)]
    bmesh.ops.bevel(bm, geom=edges, offset=0.012, segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
    make_object('hd_bed_headboard_cushions', bm, fabric, empty)
    legs = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_rod(legs, (sx * 0.46, sy * 0.9, 0.0), (sx * 0.46, sy * 0.9, 0.075), 0.014, segments=12)
    make_object('hd_bed_legs', legs, metal, empty)

    # mattress: soft rounded block
    bm = bmesh.new()
    add_box(bm, (0, 0, 0.42), (0.95, 1.93, 0.2), bevel=0.045, segments=5)
    mattress = make_object('hd_bed_mattress', bm, material('hd_mattress', '#f1ede4', rough=0.9), empty)

    # pillows: subdivided boxes puffed in the middle and pinched at the seams
    pillow_mat = material('hd_pillow', '#fbf8f2', rough=0.95)
    pillows = []
    for sx in (-1, 1):
        bm = bmesh.new()
        verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=8, use_grid_fill=True)
        hx, hy, hz = 0.215, 0.165, 0.075
        for v in bm.verts:
            u, w, t = v.co.x * 2, v.co.y * 2, v.co.z * 2  # -1..1
            puff = (1 - 0.75 * u * u) * (1 - 0.75 * w * w)
            v.co = Vector((u * hx, w * hy, t * hz * max(puff, 0.08)))
        bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-14), 3, 'X'))
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(sx * 4), 3, 'Z'))
        bmesh.ops.translate(bm, vec=Vector((sx * 0.235, 0.73, 0.605)), verts=bm.verts[:])
        pillows.append(make_object(f'hd_pillow_{"l" if sx < 0 else "r"}', bm, pillow_mat, empty))

    # blanket: a cloth simulation draped over the mattress
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=40, y_segments=40, size=0.5)
    bmesh.ops.scale(bm, vec=Vector((1.28, 1.24, 1)), verts=bm.verts[:])
    bmesh.ops.translate(bm, vec=Vector((0, -0.29, 0.62)), verts=bm.verts[:])
    blanket = make_object('hd_bed_blanket', bm, material('hd_blanket', '#2e6b5e', rough=1.0), empty, smooth=True)
    drape(blanket, colliders=[mattress, frame] + pillows, frames=45)
    solid = blanket.modifiers.new('thickness', 'SOLIDIFY')
    solid.thickness = 0.012
    solid.offset = 1
    apply_modifiers(blanket)


def drape(cloth, colliders, frames=45):
    """Run Blender's cloth simulation for `frames` frames and freeze the result."""
    for c in colliders:
        col = c.modifiers.new('Collision', 'COLLISION')
        c.collision.thickness_outer = 0.006
        c.collision.cloth_friction = 8
    mod = cloth.modifiers.new('Cloth', 'CLOTH')
    s = mod.settings
    s.quality = 8
    s.mass = 0.25
    s.air_damping = 1.5
    s.tension_stiffness = s.compression_stiffness = 12
    s.shear_stiffness = 8
    s.bending_stiffness = 0.15  # soft fabric → folds
    mod.collision_settings.distance_min = 0.006
    mod.collision_settings.use_self_collision = False
    mod.point_cache.frame_start = 1
    mod.point_cache.frame_end = frames
    for f in range(1, frames + 1):
        scene.frame_set(f)
    with bpy.context.temp_override(active_object=cloth, object=cloth, selected_objects=[cloth], selected_editable_objects=[cloth]):
        bpy.ops.object.modifier_apply(modifier='Cloth')
    scene.frame_set(1)
    for c in colliders:
        for m in [m for m in c.modifiers if m.type == 'COLLISION']:
            c.modifiers.remove(m)


# ------------------------------------------------------------------ ergonomic office chair

def tube(points, radius, cyclic=False, resolution=3):
    """A round tube along a polyline (built as a bevelled curve, then converted to mesh)."""
    cu = bpy.data.curves.new('tube', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, c in zip(sp.points, points):
        p.co = (c[0], c[1], c[2], 1)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new('tube_tmp', cu)
    scene.collection.objects.link(ob)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return bm


def merge(dst, src):
    """Append bmesh `src` into bmesh `dst`."""
    tmp = bpy.data.meshes.new('merge_tmp')
    src.to_mesh(tmp)
    src.free()
    dst.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)


def mesh_fabric_material():
    """See-through woven mesh: a small RGBA texture (threads opaque, gaps transparent), alpha-clipped."""
    import numpy as np
    size, period, thread = 128, 16, 6
    img = bpy.data.images.new('hd_mesh_weave', size, size, alpha=True)
    x = np.arange(size)
    X, Y = np.meshgrid(x, x)
    threads = ((X % period) < thread) | ((Y % period) < thread)
    shade = 0.035 + 0.02 * (((X // period) + (Y // period)) % 2)  # over/under weave variation
    px = np.zeros((size, size, 4), dtype=np.float32)
    px[..., :3] = shade[..., None]
    px[..., 3] = threads.astype(np.float32)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    m = bpy.data.materials.new('hd_mesh')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    clip = nt.nodes.new('ShaderNodeMath')
    clip.operation = 'ROUND'  # recognised by the glTF exporter as an alpha cut-off
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], clip.inputs[0])
    nt.links.new(clip.outputs[0], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.8
    m.use_backface_culling = False
    return m


def back_point(u, v):
    """Point on the curved mesh backrest. u ∈ [-1, 1] across, v ∈ [0, 1] bottom → top.
    The sides wrap toward the sitter (+Y), with a lumbar bulge low down and the top leaning back."""
    half_w = 0.215 + 0.025 * math.sin(math.pi * min(v * 1.25, 1))
    x = u * half_w
    z = 0.6 + v * 0.56
    y = -0.255 + 0.075 * u * u + 0.03 * math.exp(-((v - 0.27) / 0.14) ** 2) - 0.035 * v * v
    # tilt the whole back ~8° (top moves away from the desk)
    py, pz = -0.255, 0.6
    t = math.radians(8)
    dy, dz = y - py, z - pz
    return Vector((x, py + dy * math.cos(t) - dz * math.sin(t), pz + dy * math.sin(t) + dz * math.cos(t)))


def build_office_chair(empty):
    clear_children(empty)
    alu = material('hd_aluminium', '#c9ccd1', rough=0.28, metal=1.0)
    chrome = material('hd_chrome', '#e6e8ea', rough=0.12, metal=1.0)
    black = material('hd_black_plastic', '#1d1e21', rough=0.5)
    fabric = material('hd_seat_fabric', '#3a3e44', rough=0.95)
    pad = material('hd_arm_pad', '#17181b', rough=0.65)

    # --- five-star base with casters
    base = bmesh.new()
    add_rod(base, (0, 0, 0.075), (0, 0, 0.125), 0.055, segments=24)
    wheels = bmesh.new()
    for i in range(5):
        a = math.radians(90 + i * 72)
        leg = bmesh.ops.create_cube(base, size=1.0)['verts']
        L = 0.3
        for v in leg:  # tapered arm, thinner toward the tip and sloping down
            k = v.co.x + 0.5  # 0 at hub … 1 at tip
            v.co = Vector((0.04 + k * L, v.co.y * 0.05 * (1 - 0.3 * k), 0.1 - 0.022 * k + v.co.z * 0.035 * (1 - 0.35 * k)))
        bmesh.ops.rotate(base, verts=leg, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Z'))
        d = Vector((math.cos(a), math.sin(a), 0))
        tip = d * 0.325
        side = Vector((-d.y, d.x, 0))
        add_box(base, tip + Vector((0, 0, 0.062)), (0.032, 0.032, 0.03), bevel=0.006)  # caster fork
        for sgn in (-1, 1):  # twin wheels
            c = tip + side * (sgn * 0.011) + Vector((0, 0, 0.03))
            add_rod(wheels, c - side * 0.007, c + side * 0.007, 0.028, segments=18)
    make_object('hd_chair_base', base, alu, empty)
    make_object('hd_chair_wheels', wheels, black, empty)

    # --- gas lift and tilt mechanism
    lift = bmesh.new()
    add_rod(lift, (0, 0, 0.12), (0, 0, 0.27), 0.03, segments=20)
    add_box(lift, (0, 0, 0.41), (0.2, 0.24, 0.055), bevel=0.01)
    add_rod(lift, (0.1, 0.07, 0.405), (0.235, 0.11, 0.395), 0.006, segments=8)
    knob = bmesh.ops.create_uvsphere(lift, u_segments=12, v_segments=8, radius=0.014)['verts']
    bmesh.ops.translate(lift, vec=Vector((0.24, 0.112, 0.395)), verts=knob)
    make_object('hd_chair_mechanism', lift, black, empty)
    rod = bmesh.new()
    add_rod(rod, (0, 0, 0.26), (0, 0, 0.39), 0.022, segments=20)
    make_object('hd_chair_gaslift', rod, chrome, empty)

    # --- seat: padded cushion with a waterfall front edge, on a plastic shell
    seat = bmesh.new()
    verts = bmesh.ops.create_cube(seat, size=1.0)['verts']
    bmesh.ops.subdivide_edges(seat, edges=seat.edges[:], cuts=10, use_grid_fill=True)
    for v in seat.verts:
        x, y, z = v.co.x * 0.5, v.co.y * 0.48, v.co.z * 0.075
        top = z > 0
        if top:
            z -= 0.012 * (1 - (2 * x) ** 2) * (1 - (2 * y / 0.96) ** 2)  # gentle dish
        if y > 0.12:
            z -= (y - 0.12) ** 2 * 1.4  # waterfall edge rolls down at the front
        v.co = Vector((x, y + 0.02, z + 0.5))
    edges = [e for e in seat.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(60)]
    bmesh.ops.bevel(seat, geom=edges, offset=0.03, segments=4, profile=0.5, affect='EDGES', clamp_overlap=True)
    make_object('hd_chair_seat', seat, fabric, empty)
    shell = bmesh.new()
    add_box(shell, (0, 0.01, 0.452), (0.47, 0.45, 0.022), bevel=0.009)
    make_object('hd_chair_shell', shell, black, empty)

    # --- mesh backrest: curved frame + woven mesh + lumbar bar + spine
    n = 10  # superellipse exponent for the frame outline (rounded rectangle)
    outline = []
    for i in range(96):
        t = i / 96 * 2 * math.pi
        c, s_ = math.cos(t), math.sin(t)
        u = math.copysign(abs(c) ** (2 / n), c)
        v = 0.5 + 0.5 * math.copysign(abs(s_) ** (2 / n), s_)
        outline.append(back_point(u, v))
    frame = tube(outline, 0.014, cyclic=True)
    lumbar = tube([back_point(u / 10, 0.27) + Vector((0, 0.012, 0)) for u in range(-9, 10)], 0.009)
    merge(frame, lumbar)
    bottom = back_point(0, 0)
    spine = tube([Vector((0, -0.09, 0.41)), Vector((0, -0.2, 0.43)), Vector((0, -0.27, 0.5)), bottom + Vector((0, -0.01, -0.01))], 0.017)
    merge(frame, spine)
    make_object('hd_chair_backframe', frame, black, empty)

    weave = bmesh.new()
    N = 28
    grid = [[weave.verts.new(back_point(-1 + 2 * i / N, j / N)) for i in range(N + 1)] for j in range(N + 1)]
    for j in range(N):
        for i in range(N):
            weave.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    make_object('hd_chair_mesh', weave, mesh_fabric_material(), empty, uv_scale=0.03, fix_normals=False)

    # --- armrests: bracket from under the seat, post, soft pad
    arms = bmesh.new()
    pads = bmesh.new()
    for sx in (-1, 1):
        add_box(arms, (sx * 0.2, -0.02, 0.43), (0.16, 0.05, 0.02), bevel=0.006)
        add_box(arms, (sx * 0.275, -0.02, 0.56), (0.035, 0.065, 0.26), bevel=0.012, segments=3)
        add_box(pads, (sx * 0.275, 0.0, 0.7), (0.085, 0.26, 0.032), bevel=0.014, segments=4)
    make_object('hd_chair_arms', arms, black, empty)
    make_object('hd_chair_armpads', pads, pad, empty)


# ------------------------------------------------------------------ acoustic guitar on a stand

# body half-width along its length (metres): lower bout, waist, upper bout
GUITAR_OUTLINE = [(0.0, 0.0), (0.015, 0.11), (0.05, 0.17), (0.12, 0.19), (0.2, 0.172), (0.26, 0.13), (0.3, 0.122),
                  (0.35, 0.138), (0.4, 0.145), (0.45, 0.125), (0.485, 0.075), (0.5, 0.0)]


def guitar_half_width(l):
    pts = GUITAR_OUTLINE
    for (l0, w0), (l1, w1) in zip(pts, pts[1:]):
        if l0 <= l <= l1:
            t = (l - l0) / (l1 - l0)
            t = t * t * (3 - 2 * t)  # smooth between control points
            return w0 + (w1 - w0) * t
    return 0.0


def guitar_outline(inset=0.0, samples=48):
    right = [(guitar_half_width(l) - inset, l) for l in (i / samples * 0.5 for i in range(1, samples))]
    return [(x, l) for x, l in right] + [(-x, l) for x, l in reversed(right)]


def build_guitar(empty):
    clear_children(empty)
    spruce = material('hd_guitar_top', '#e2c08f', rough=0.35)
    mahogany = material('hd_guitar_body', '#7a3f1c', rough=0.3)
    dark = material('hd_guitar_dark', '#24170f', rough=0.5)
    hole = material('hd_guitar_hole', '#0b0806', rough=1.0)
    steel = material('hd_guitar_steel', '#d8d8d8', rough=0.2, metal=1.0)
    stand_mat = material('hd_stand', '#1b1b1d', rough=0.45, metal=0.6)
    made = []

    # body: outline extruded backward (+Y), edges rounded
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0.0, l)) for x, l in guitar_outline()]
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=Vector((0, 0.1, 0)), verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(60)]
    bmesh.ops.bevel(bm, geom=edges, offset=0.007, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    made.append(make_object('hd_guitar_body', bm, mahogany, empty))
    # spruce top, just in front of the body
    bm = bmesh.new()
    vs = [bm.verts.new((x, -0.0015, l)) for x, l in guitar_outline(inset=0.006)]
    bmesh.ops.triangulate(bm, faces=[bm.faces.new(vs)])
    made.append(make_object('hd_guitar_top', bm, spruce, empty, fix_normals=False))
    # rosette ring + sound hole, bridge
    for r, mat, y, name in ((0.056, dark, -0.0025, 'hd_guitar_rosette'), (0.045, hole, -0.003, 'hd_guitar_hole')):
        bm = bmesh.new()
        c = bmesh.ops.create_circle(bm, cap_ends=True, segments=40, radius=r)
        bmesh.ops.rotate(bm, verts=c['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
        bmesh.ops.translate(bm, vec=Vector((0, y, 0.36)), verts=c['verts'])
        made.append(make_object(name, bm, mat, empty, fix_normals=False))
    bm = bmesh.new()
    add_box(bm, (0, -0.007, 0.2), (0.15, 0.01, 0.028), bevel=0.003)
    # neck + fretboard + headstock (tilted back)
    add_box(bm, (0, -0.006, 0.68), (0.05, 0.007, 0.37), bevel=0.002)  # fretboard
    made.append(make_object('hd_guitar_board', bm, dark, empty))
    bm = bmesh.new()
    add_box(bm, (0, 0.013, 0.68), (0.048, 0.03, 0.37), bevel=0.008, segments=3)  # neck
    head = add_box(bm, (0, 0.006, 0.955), (0.085, 0.018, 0.19))  # tilt first, round the edges after
    bmesh.ops.rotate(bm, verts=head, cent=Vector((0, 0.006, 0.865)), matrix=Matrix.Rotation(math.radians(-14), 3, 'X'))
    bmesh.ops.bevel(bm, geom=list({e for v in head for e in v.link_edges}), offset=0.006, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    made.append(make_object('hd_guitar_neck', bm, mahogany, empty))
    # frets, strings, tuning pegs
    bm = bmesh.new()
    nut, scale = 0.865, 0.665
    for n in range(0, 15):
        l = nut - scale * (1 - 2 ** (-n / 12))
        add_box(bm, (0, -0.0105, l), (0.05, 0.002, 0.0025))
    for i in range(6):
        u = (i - 2.5) / 2.5
        add_rod(bm, (u * 0.028, -0.0135, 0.205), (u * 0.021, -0.0135, nut), 0.0011, segments=5)
    for side in (-1, 1):
        for k in range(3):
            z = 0.9 + k * 0.045
            add_rod(bm, (side * 0.04, 0.006 + (z - 0.865) * 0.24, z), (side * 0.07, 0.006 + (z - 0.865) * 0.24, z), 0.004, segments=8)
    made.append(make_object('hd_guitar_metal', bm, steel, empty))

    # lean the guitar back on its stand: rotate about X at the base, lift onto the cradle
    lean = Matrix.Translation((0, 0, 0.1)) @ Matrix.Rotation(math.radians(15), 4, 'X')
    for o in made:
        o.data.transform(lean)

    # A-frame stand: back pole to the neck yoke, two front legs, padded cradle
    st = bmesh.new()
    neck_pt = lean @ Vector((0, 0.03, 0.74))
    hub = Vector((0, 0.1, 0.32))
    merge(st, tube([Vector((0, 0.34, 0.0)), hub, neck_pt + Vector((0, 0.03, -0.02))], 0.009))
    for sx in (-1, 1):
        merge(st, tube([Vector((sx * 0.17, -0.14, 0.0)), hub], 0.009))
        merge(st, tube([hub, Vector((sx * 0.13, -0.04, 0.1))], 0.008))
        add_rod(st, (sx * 0.13, -0.075, 0.1), (sx * 0.13, -0.005, 0.1), 0.014, segments=12)  # rubber cradle tips
    for sx in (-1, 1):  # neck yoke arms
        merge(st, tube([neck_pt + Vector((0, 0.03, -0.02)), neck_pt + Vector((sx * 0.035, -0.005, 0.02))], 0.006))
    made.append(make_object('hd_guitar_stand', st, stand_mat, empty))

    # turn the whole thing to face the chair at the desk (three.js z = -1.7 → blender y = 1.7)
    here = empty.matrix_world.translation
    to_chair = Vector((0.0, 1.7)) - here.xy
    yaw = math.atan2(to_chair.y, to_chair.x) + math.pi / 2  # front faces −Y before turning
    for o in made:
        o.data.transform(Matrix.Rotation(yaw, 4, 'Z'))


# ------------------------------------------------------------------ entry point

def replace_all(sc):
    """Swap the simple bed/chair/guitar for the detailed models. Returns the names of new objects."""
    global scene
    scene = sc
    before = set(o.name for o in sc.objects)
    for name, build in (('model_bed', build_bed), ('model_chair', build_office_chair), ('model_guitar', build_guitar)):
        empty = sc.objects.get(name)
        if empty is None:
            print(f'[models] {name} not found; keeping the simple version', flush=True)
            continue
        build(empty)
        print(f'[models] built {name}', flush=True)
    return set(o.name for o in sc.objects) - before
