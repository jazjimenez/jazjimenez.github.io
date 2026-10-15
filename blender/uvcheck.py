import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1])
tot=0; mn=[9,9]; mx=[-9,-9]; n=0; names=set()
for o in bpy.data.objects:
    if o.type!='MESH': continue
    names.add(tuple(l.name for l in o.data.uv_layers))
    if len(o.data.uv_layers)<2: continue
    uv=o.data.uv_layers[1].data
    for p in o.data.polygons:
        pts=[uv[i].uv for i in p.loop_indices]
        a=0
        for k in range(1,len(pts)-1):
            a+=abs((pts[k][0]-pts[0][0])*(pts[k+1][1]-pts[0][1])-(pts[k+1][0]-pts[0][0])*(pts[k][1]-pts[0][1]))/2
        tot+=a
        for q in pts:
            mn=[min(mn[0],q[0]),min(mn[1],q[1])]; mx=[max(mx[0],q[0]),max(mx[1],q[1])]
    n+=1
print('UVCHECK objs',n,'area',round(tot,4),'bbox',mn,mx,'layers',names)
