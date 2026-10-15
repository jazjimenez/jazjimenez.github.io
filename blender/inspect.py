import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1])
meshes=[o for o in bpy.data.objects if o.type=='MESH']
print('OBJECTS', len(bpy.data.objects), 'MESHES', len(meshes), 'MATERIALS', len(bpy.data.materials), 'IMAGES', len(bpy.data.images))
print('TRIS', sum(len(o.data.polygons) for o in meshes))
for o in bpy.data.objects:
    if any(o.name.startswith(p) for p in ('clk_','anim_','emit_','nobake_')): print('NAMED', o.name, o.type, tuple(round(v,2) for v in o.matrix_world.translation))
print('UVS', {len(o.data.uv_layers) for o in meshes})
