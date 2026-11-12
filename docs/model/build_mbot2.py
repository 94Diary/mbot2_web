"""Stylized mBot2-like robot built procedurally in Blender (bpy 5.x).
Units: 1 = 1 cm. +X = front, +Y = robot's left, +Z = up.
Run:  python3 build_mbot2.py   (or Blender > Scripting > Run Script)
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.scale_length = 0.01  # 1 BU = 1 cm

# ---------------------------------------------------------------- materials
def mat(name, color, metal=0.0, rough=0.5, trans=0.0, ior=1.45, emit=None, emit_str=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    m.diffuse_color = (*color, 1.0 - 0.6 * trans) if not emit else (*emit, 1)  # Solid-mode colour
    m.metallic, m.roughness = metal, rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_str
    return m

M = {
    "blue":   mat("Anodized Blue", (0.0, 0.32, 0.62), metal=0.85, rough=0.32),
    "lblue":  mat("Gearbox Blue", (0.33, 0.6, 0.9), rough=0.55),
    "case":   mat("Smoky Case", (0.55, 0.58, 0.62), rough=0.06, trans=1.0, ior=1.08),
    "cyber":  mat("Smoky Dark", (0.22, 0.24, 0.27), rough=0.08, trans=0.85, ior=1.08),
    "pcb":    mat("PCB", (0.02, 0.025, 0.03), rough=0.4, metal=0.2),
    "black":  mat("Black Plastic", (0.015, 0.015, 0.017), rough=0.45),
    "rubber": mat("Rubber", (0.02, 0.02, 0.022), rough=0.85),
    "hub":    mat("Hub", (0.06, 0.06, 0.065), rough=0.35, metal=0.3),
    "grey":   mat("Grey Plastic", (0.45, 0.46, 0.47), rough=0.5),
    "ring":   mat("Sensor Ring", (0.5, 0.5, 0.52), rough=0.35),
    "mesh":   mat("Sensor Mesh", (0.08, 0.07, 0.07), metal=0.6, rough=0.6),
    "steel":  mat("Steel", (0.8, 0.8, 0.82), metal=1.0, rough=0.25),
    "white":  mat("Connector White", (0.9, 0.9, 0.88), rough=0.5),
    "batt":   mat("Battery", (0.3, 0.31, 0.32), rough=0.35, metal=0.3),
    "screen": mat("Screen", (0.0, 0.0, 0.0), rough=0.15, emit=(0.15, 0.55, 1.0), emit_str=2.5),
    "eye":    mat("Screen Eye", (1, 1, 1), emit=(1.0, 0.55, 0.15), emit_str=6.0),
    "cap":    mat("Capacitor", (0.55, 0.8, 0.95), rough=0.35, metal=0.3),
    "floor":  mat("Floor", (0.62, 0.62, 0.6), rough=0.7),
}

# ---------------------------------------------------------------- helpers
ALL = []

def finish(o, m, bevel=0.0, seg=3, smooth=False):
    if m:
        o.data.materials.append(m)
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width, b.segments, b.limit_method = bevel, seg, "ANGLE"
    if smooth:
        bpy.ops.object.shade_auto_smooth() if False else None
        for p in o.data.polygons:
            p.use_smooth = True
    ALL.append(o)
    return o

def box(name, size, loc, m=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name, o.scale = name, size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, bevel)

AXIS_ROT = {"x": (0, math.pi / 2, 0), "y": (math.pi / 2, 0, 0), "z": (0, 0, 0)}

def cyl(name, r, depth, loc, axis="z", m=None, bevel=0.0, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc,
                                        rotation=AXIS_ROT[axis], vertices=verts)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.rotation_euler = (0, 0, 0)
    return finish(o, m, bevel, smooth=True)

def strip_bevel(o):
    for md in list(o.modifiers):
        o.modifiers.remove(md)

def cut(target, cutters):
    """Boolean-difference a list of cutter objects from target, then delete them."""
    if not cutters:
        return
    for c in cutters:
        if c in ALL:
            ALL.remove(c)
        strip_bevel(c)
    bpy.ops.object.select_all(action="DESELECT")
    for c in cutters:
        c.select_set(True)
    bpy.context.view_layer.objects.active = cutters[0]
    if len(cutters) > 1:
        bpy.ops.object.join()
    cutter = bpy.context.object
    saved = list(target.modifiers)
    keep = [(md.name, md.type, getattr(md, "width", None)) for md in saved]
    strip_bevel(target)
    bm = target.modifiers.new("Cut", "BOOLEAN")
    bm.operation, bm.object, bm.solver = "DIFFERENCE", cutter, "MANIFOLD"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=bm.name)
    bpy.data.objects.remove(cutter)
    for name, typ, w in keep:
        if typ == "BEVEL":
            b = target.modifiers.new(name, "BEVEL")
            b.width, b.segments, b.limit_method = w, 3, "ANGLE"

def profile_plate(name, pts, y, thick, m):
    """Extrude a closed XZ polygon into a plate of given thickness centered at y."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new((x, y - thick / 2, z)) for x, z in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.y += thick
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    return finish(o, m)

def arc(cx, cz, r, a0, a1, n=16):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

# ---------------------------------------------------------------- chassis
WHEEL_X, WHEEL_R, WHEEL_Z = -3.0, 3.2, 3.2
PLATE_Y, PT = 4.2, 0.22  # side plate inner offset / thickness

side_outline = (
    [(-6.3, 1.0), (4.6, 1.0)]
    + arc(5.6, 2.5, 1.5, -90, 90)                       # rounded front lobe
    + [(-5.4, 4.0), (-7.4, 6.7)]
    + arc(-8.0, 6.2, 0.75, 50, 230, 8)                 # rounded tip of rear tab
    + [(-7.1, 3.4), (-6.3, 2.4)]
)

for side in (1, -1):
    y = side * (PLATE_Y + PT / 2)
    plate = profile_plate(f"SidePlate_{'L' if side > 0 else 'R'}", side_outline, y, PT, M["blue"])
    holes = []
    for i in range(4):          # 4 x 3 hole grid
        for j in range(3):
            holes.append(cyl("h", 0.26, 1, (-0.2 + i * 1.05, y, 1.6 + j * 0.95), "y", verts=20))
    for k in range(8):          # flower pattern around front lobe hole
        a = math.tau * k / 8
        holes.append(cyl("h", 0.22, 1, (5.6 + 0.9 * math.cos(a), y, 2.5 + 0.9 * math.sin(a)), "y", verts=16))
    holes.append(cyl("h", 0.42, 1, (5.6, y, 2.5), "y", verts=24))
    for t in range(3):          # holes along rear tab
        holes.append(cyl("h", 0.22, 1, (-6.2 - t * 0.65, y, 4.6 + t * 0.85), "y", verts=16))
    holes.append(cyl("h", 0.4, 1, (WHEEL_X, y, WHEEL_Z), "y", verts=24))  # axle
    cut(plate, holes)
    b = plate.modifiers.new("Bevel", "BEVEL"); b.width, b.segments, b.limit_method = 0.06, 2, "ANGLE"

# top deck & front / rear faces
box("Deck", (11.6, PLATE_Y * 2, 0.22), (-0.5, 0, 3.9), M["blue"], 0.05)
front = box("FrontFace", (0.22, PLATE_Y * 2, 2.9), (4.8, 0, 2.45), M["blue"], 0.05)
# little "smile" slot (crescent) in the front face
c1 = cyl("s1", 1.1, 1, (4.8, 0, 2.15), "x", verts=48)
c2 = cyl("s2", 1.15, 1.2, (4.8, 0, 2.75), "x", verts=48)
cut(c1, [c2]); ALL.append(c1) if c1 not in ALL else None
cut(front, [c1, cyl("eye", 0.14, 1, (4.8, 2.6, 1.6), "x", verts=16),
            cyl("eye", 0.14, 1, (4.8, -2.6, 3.6), "x", verts=16)])
rear = box("RearFace", (0.22, PLATE_Y * 2, 2.6), (-6.0, 0, 2.5), M["blue"], 0.05,
           rot=(0, math.radians(-14), 0))

# gearboxes + motors (visible from underneath)
for s in (1, -1):
    box("Gearbox", (3.0, 1.9, 2.3), (WHEEL_X, s * 3.05, 2.55), M["lblue"], 0.12)
    cyl("Motor", 0.62, 2.4, (WHEEL_X + 2.6, s * 2.1, 2.3), "x", M["steel"], 0.05)
    cyl("Axle", 0.25, 1.4, (WHEEL_X, s * 4.6, WHEEL_Z), "y", M["steel"])

# front caster + line-follower board underneath
box("CasterMount", (1.6, 2.2, 0.9), (3.6, 0, 1.0), M["black"], 0.2)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=(3.6, 0, 0.55), segments=32, ring_count=16)
finish(bpy.context.object, M["steel"], smooth=True).name = "CasterBall"
box("QuadRGB_PCB", (2.4, 8.6, 0.2), (5.3, 0, 0.75), M["pcb"], 0.08)
for yy in (-2.8, -0.9, 0.9, 2.8):
    box("RGB_led", (0.35, 0.35, 0.12), (5.6, yy, 0.6), M["white"])

# ---------------------------------------------------------------- wheels
def wheel(side):
    y = side * (PLATE_Y + PT + 1.0)
    tire = cyl("Tire", WHEEL_R, 1.7, (WHEEL_X, y, WHEEL_Z), "y", M["rubber"], 0.55, verts=96)
    tire.modifiers["Bevel"].segments = 6
    cut(tire, [cyl("bore", 2.45, 1.2, (WHEEL_X, y + side * 0.6, WHEEL_Z), "y", verts=96)])
    hub = cyl("Hub", 2.45, 1.2, (WHEEL_X, y + side * 0.05, WHEEL_Z), "y", M["hub"], 0.04, verts=96)
    holes = []
    for ring_r, n in ((0.75, 6), (1.35, 12), (1.95, 18)):
        for k in range(n):
            a = math.tau * k / n + (0.25 if ring_r > 1.5 else 0)
            holes.append(cyl("hh", 0.2, 2, (WHEEL_X + ring_r * math.cos(a), y,
                                            WHEEL_Z + ring_r * math.sin(a)), "y", verts=12))
    cut(hub, holes)
    cyl("HubScrew", 0.3, 0.2, (WHEEL_X, y + side * 0.7, WHEEL_Z), "y", M["steel"], 0.05)

wheel(1); wheel(-1)

# ---------------------------------------------------------------- mBot2 shield (transparent case)
for sx in (-4.6, 3.6):
    for sy in (-3.2, 3.2):
        cyl("Standoff", 0.3, 0.7, (sx, sy, 4.35), "z", M["steel"])
box("ShieldPCB", (10.0, 7.6, 0.18), (-0.5, 0, 4.85), M["pcb"], 0.05)
cyl("Battery", 0.9, 6.6, (-1.6, 0, 5.85), "y", M["batt"], 0.15)
for (cx, cy) in ((1.2, 2.6), (2.3, 2.6), (1.2, -2.6), (2.8, -1.4)):
    cyl("Capacitor", 0.35, 0.7, (cx, cy, 5.3), "z", M["cap"], 0.05)
box("Chip", (1.2, 1.2, 0.15), (3.0, 0.4, 5.0), M["black"])
for i, py in enumerate((-2.0, -1.0, 1.0, 2.0)):   # side ports (S1/S2/M1/M2/mBuild)
    box("Port", (0.6, 0.45, 0.4), (-0.4 + i * 0.9, 4.0, 5.2), M["white"], 0.03)
    box("Port", (0.6, 0.45, 0.4), (-0.4 + i * 0.9, -4.0, 5.2), M["white"], 0.03)
box("ShieldCase", (10.4, 8.2, 2.5), (-0.5, 0, 5.85), M["case"], 0.35)
box("OnOff", (0.5, 0.3, 0.25), (1.5, -4.15, 5.0), M["black"])

# ---------------------------------------------------------------- CyberPi (controller on top-rear)
CX, CZ = -3.3, 7.65
box("CyberPiBoard", (4.7, 7.8, 0.15), (CX, 0, CZ - 0.35), M["pcb"])
box("CyberPiCase", (5.0, 8.3, 1.2), (CX, 0, CZ), M["cyber"], 0.3)
box("ScreenBezel", (2.9, 2.9, 0.06), (CX, 0, CZ + 0.61), M["black"], 0.05)
box("Screen", (2.5, 2.5, 0.04), (CX, 0, CZ + 0.64), M["screen"])
for ey in (-0.55, 0.55):                       # cute eyes on the screen
    box("ScreenEye", (0.75, 0.38, 0.02), (CX + 0.15, ey, CZ + 0.67), M["eye"], 0.12)
cyl("JoystickBase", 0.85, 0.25, (CX, 2.85, CZ + 0.68), "z", M["grey"], 0.08)
cyl("JoystickStem", 0.25, 0.5, (CX, 2.85, CZ + 0.95), "z", M["grey"])
cyl("JoystickCap", 0.55, 0.3, (CX, 2.85, CZ + 1.25), "z", M["grey"], 0.12)
# triangle + square buttons
bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.55, radius2=0.45, depth=0.25,
                                location=(CX - 0.9, -2.85, CZ + 0.72), rotation=(0, 0, math.radians(180)))
finish(bpy.context.object, M["grey"], 0.06).name = "BtnA"
box("BtnB", (0.85, 0.85, 0.25), (CX + 0.8, -2.85, CZ + 0.72), M["grey"], 0.1)
box("USB_C", (0.35, 0.95, 0.35), (CX - 2.55, -2.0, CZ - 0.1), M["steel"], 0.12)

# ---------------------------------------------------------------- ultrasonic sensor 2
SX, SZ = 5.6, 5.5
box("SensorBody", (1.1, 5.8, 2.5), (SX, 0, SZ), M["black"], 0.3)
box("SensorBracket", (0.35, 2.8, 2.0), (5.15, 0, 3.9), M["black"], 0.15)
for yy in (-0.65, 0.65):
    cyl("BracketScrew", 0.28, 0.3, (5.38, yy, 3.55), "x", M["steel"], 0.06)
for yy in (-1.4, 1.4):
    cyl("EyeTube", 1.08, 1.5, (SX + 1.1, yy, SZ - 0.05), "x", M["black"], 0.1)
    ring = cyl("EyeRing", 0.92, 0.3, (SX + 1.85, yy, SZ - 0.05), "x", M["ring"], 0.06)
    cut(ring, [cyl("bore", 0.7, 1, (SX + 2.2, yy, SZ - 0.05), "x", verts=48)])
    cyl("EyeMesh", 0.7, 0.1, (SX + 1.78, yy, SZ - 0.05), "x", M["mesh"])
    cyl("EyeCore", 0.18, 0.12, (SX + 1.84, yy, SZ - 0.05), "x", M["grey"])

# ---------------------------------------------------------------- mBuild cables
def cable(name, pts, r=0.09):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution = "3D", r, 4
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_endpoint_u, sp.order_u = True, 4
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    o.data.materials.append(M["black"])
    ALL.append(o)

cable("Cable_Sensor", [(5.3, 2.9, 6.1), (6.2, 4.9, 6.0), (7.0, 6.3, 3.0), (5.5, 6.0, 1.1),
                       (3.5, 5.2, 2.6), (1.6, 4.4, 4.6), (0.5, 4.2, 5.2)])
cable("Cable_RGB", [(5.4, -3.2, 0.9), (6.2, -4.9, 1.5), (5.6, -5.5, 4.2), (4.2, -4.6, 6.3),
                    (2.5, -4.3, 5.4), (1.4, -4.2, 5.2)])

# ---------------------------------------------------------------- group everything under one empty
root = bpy.data.objects.new("mBot2", None)
scene.collection.objects.link(root)
for o in ALL:
    if o.name in bpy.data.objects:
        o.parent = root

# ---------------------------------------------------------------- stage, lights, camera
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
floor = bpy.context.object; floor.name = "Floor"; floor.data.materials.append(M["floor"])

world = bpy.data.worlds.new("World"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.78, 0.82, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

def area(name, loc, energy, size, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, "AREA"); l.energy, l.size, l.color = energy, size, color
    o = bpy.data.objects.new(name, l); scene.collection.objects.link(o)
    o.location = loc
    d = Vector((0, 0, 4)) - o.location
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

area("Key", (40, 30, 45), 9e4, 30, (1.0, 0.96, 0.9))
area("Fill", (-20, -45, 25), 3.5e4, 40, (0.85, 0.9, 1.0))
area("Rim", (-45, 20, 35), 4e4, 20)

cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 70
cam = bpy.data.objects.new("Camera", cam_data); scene.collection.objects.link(cam)
scene.camera = cam

def aim(loc, target=(0, 0, 3.8)):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

aim((46, 34, 26))
bpy.context.view_layer.update()

# make Solid viewport use material colours when the file is opened
for scr in bpy.data.screens:
    for area_ in scr.areas:
        for sp in area_.spaces:
            if sp.type == "VIEW_3D":
                sp.shading.type = "MATERIAL"
scene.display.shading.color_type = "MATERIAL"

blend_path = os.path.join(OUT, "mbot2.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("saved", blend_path)

# ---------------------------------------------------------------- optional renders / export
if "--render" in sys.argv:
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = int(os.environ.get("SAMPLES", 96))
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1400, 1050
    scene.view_settings.look = "AgX - Medium High Contrast"
    shots = {
        "front34": ((46, 34, 26), (0, 0, 3.8)),
        "front":   ((60, 0, 14), (0, 0, 4.2)),
        "side":    ((0, 62, 10), (0, 0, 4.2)),
        "rear34":  ((-42, -36, 30), (0, 0, 3.8)),
    }
    for n, (loc, tgt) in shots.items():
        aim(loc, tgt)
        scene.render.filepath = os.path.join(OUT, f"render_{n}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", n)
    aim((46, 34, 26))

if "--glb" in sys.argv:
    floor.hide_set(True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for o in root.children: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "mbot2.glb"), use_selection=True,
                              export_apply=True, export_yup=True)
    print("exported glb")
