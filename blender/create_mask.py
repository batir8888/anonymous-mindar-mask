import bpy, math, os
from mathutils import Vector
from math import sin, cos, pi, exp, sqrt
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.5):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
 return m
ivory=mat('Porcelain • warm ivory',(.86,.81,.68),.32)
black=mat('Ink • charcoal',(.012,.009,.009),.5)
lip=mat('Smile • warm shadow',(.19,.065,.045))
rose=mat('Cheeks • muted rose',(.61,.27,.22))
# Front points towards Blender -Y; glTF conversion makes it +Z.
def depth(x,z):
 r=(x/1.02)**2+((z-.12)/1.48)**2
 d=.13+.28*sqrt(max(0,1-min(r,1)))
 d+=.40*exp(-(x/.18)**2-((z-.05)/.39)**2)
 d+=.16*exp(-(x/.22)**2-((z+.13)/.14)**2)
 d+=.095*(exp(-((x-.55)/.28)**2-((z+.15)/.27)**2)+exp(-((x+.55)/.28)**2-((z+.15)/.27)**2))
 d-=.075*(exp(-((x-.43)/.29)**2-((z-.40)/.18)**2)+exp(-((x+.43)/.29)**2-((z-.40)/.18)**2))
 d+=.07*exp(-(x/.48)**2-((z+.64)/.2)**2)
 return d
def mesh(name,verts,faces,material):
 me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
 ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 return ob
verts=[]; faces=[]; N=160; M=180
for j in range(M+1):
 z=-1.30+2.85*j/M
 width=1.02*sqrt(max(.00001,1-((z-.125)/1.425)**2))*(.84+.16/(1+exp(-5*(z+.3))))
 for i in range(N+1):
  x=width*(2*i/N-1); verts.append((x,-depth(x,z),z))
for j in range(M):
 for i in range(N):
  a=j*(N+1)+i; ids=[a,a+1,a+N+2,a+N+1]
  x=sum(verts[k][0] for k in ids)/4; z=sum(verts[k][2] for k in ids)/4
  eye= any(((x-s*.43)/.285)**2+((z-(.39+s*.07*(x-s*.43)))/.115)**2<1 for s in [-1,1])
  if not eye: faces.append(tuple(ids))
mask=mesh('Anonymous | sculpted shell',verts,faces,ivory)
smooth=mask.modifiers.new('Smooth eye contours','SMOOTH');smooth.factor=1.0;smooth.iterations=5
sol=mask.modifiers.new('Real shell thickness','SOLIDIFY');sol.thickness=.025
bev=mask.modifiers.new('Soft eye rims','BEVEL');bev.width=.012;bev.segments=2
# Surface ribbons follow the sculpt, taper at their ends.
def ribbon(name,fun,width,material,steps=90):
 vs=[]
 for i in range(steps+1):
  t=i/steps;x,z=fun(t); w=width(t)
  for dz in [-w,w]:vs.append((x,-depth(x,z+dz)-.009,z+dz))
 return mesh(name,vs,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(steps)],material)
for s in [-1,1]:
 ribbon('Arched eyebrow '+str(s),lambda t,s=s:(s*(.15+.65*t),.64+.13*sin(pi*t)-.10*t),lambda t:.008+.055*sin(pi*t)**.65,black)
 ribbon('Curled moustache '+str(s),lambda t,s=s:(s*(.035+.66*t),-.40-.09*sin(pi*t)+.13*t*t),lambda t:.006+.057*sin(pi*t)**.7,black)
 ribbon('Smile crease '+str(s),lambda t,s=s:(s*.68*t,-.67+.24*t*t),lambda t:.007+.010*sin(pi*t),lip)
 ribbon('Lower lip '+str(s),lambda t,s=s:(s*.46*t,-.74+.13*t*t),lambda t:.012*sin(pi*t),ivory)
 ribbon('Nostril '+str(s),lambda t,s=s:(s*(.07+.13*t),-.20-.025*sin(pi*t)),lambda t:.018*sin(pi*t),black)
 # small soft-colored cheek inset
 ribbon('Cheek rouge '+str(s),lambda t,s=s:(s*(.57+.18*t),-.20+.02*sin(pi*t)),lambda t:.045*sin(pi*t),rose)
vs=[]
for i in range(51):
 t=i/50;z=-.82-.39*t;w=.10*(1-t)**.7
 for x in [-w,w]:vs.append((x,-depth(x,z)-.018,z))
mesh('Pointed goatee',vs,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(50)],black)
dec=mask.modifiers.new('Mobile polygon budget','DECIMATE');dec.ratio=.35
# Separate studio collection; excluded from glTF selection.
model=list(bpy.context.scene.objects)
for ob in model:ob.select_set(True)
bpy.context.view_layer.objects.active=mask
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'assets','anonymous-mask.glb'),export_format='GLB',use_selection=True,export_apply=True)
# Render studio
world=bpy.context.scene.world;world.color=(.13,.13,.13);world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.047,.065,1)
def aim(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.25,-6.8,.55));cam=bpy.context.object;aim(cam,(0,0,.12));cam.data.type='ORTHO';cam.data.ortho_scale=3.65;bpy.context.scene.camera=cam
for name,loc,power,size in [('Key',(-3,-4,5),450,4),('Fill',(3,-2,1),220,3),('Rim',(1,2,4),500,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.name=name;ob.data.energy=power;ob.data.shape='DISK';ob.data.size=size;aim(ob,(0,0,0))
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=32;sc.render.resolution_x=900;sc.render.resolution_y=1050;sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG';sc.render.filepath=os.path.join(ROOT,'assets','anonymous-preview.png')
# Select model for a convenient opening view.
bpy.ops.object.select_all(action='DESELECT')
for ob in model:ob.select_set(True)
bpy.context.view_layer.objects.active=mask
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=4.8
   from mathutils import Quaternion
   area.spaces.active.region_3d.view_rotation=Quaternion((1,0,0),pi/2)
   area.spaces.active.region_3d.view_location=(0,0,.12)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Anonymous.blend'))
bpy.ops.render.render(write_still=True)
print('MODEL_READY',sum(len(o.data.polygons) for o in model))


