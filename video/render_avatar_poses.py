"""Renders transparent PNGs of the avatar in key poses for the promo video.
usage: blender -b blender/ebad_avatar.blend --python video/render_avatar_poses.py -- <out_dir> [Action:frame ...]
"""
import sys, os, math
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = os.path.abspath(argv[0] if argv else "video/assets/avatar")
shots = argv[1:] or ["Idle:1", "Wave:30", "PeaceJump:30", "LiftTrophy:60", "Juggle:30", "PlayGame:40", "Type:40", "LevelUp:60"]
os.makedirs(out_dir, exist_ok=True)

scene = bpy.context.scene
for ob in scene.objects:
    if ob.name.startswith("Stage_"):
        ob.hide_render = True

arm = next(o for o in scene.objects if o.type == "ARMATURE")

# camera: front three-quarter, full body
cam = scene.camera
cam.location = (0.95, -4.4, 1.05)
cam.rotation_euler = (math.radians(88), 0, math.radians(12))
cam.data.lens = 72

# soft fill so the shadow side is not black
if "Fill_Video" not in bpy.data.objects:
    fill = bpy.data.objects.new("Fill_Video", bpy.data.lights.new("FillV", type="SUN"))
    fill.data.energy = 1.2
    fill.rotation_euler = (math.radians(60), 0, math.radians(-140))
    scene.collection.objects.link(fill)
if scene.world is None:
    scene.world = bpy.data.worlds.new("W")
scene.world.color = (0.85, 0.85, 0.95)

r = scene.render
r.film_transparent = True
r.resolution_x, r.resolution_y, r.resolution_percentage = 900, 1300, 100
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
try:
    r.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    r.engine = "BLENDER_EEVEE"
try:
    scene.view_settings.view_transform = "Standard"
except TypeError:
    pass

try:
    scene.eevee.taa_render_samples = 32
except AttributeError:
    pass
# soft, clean shadows (the default shadow maps look jagged under the belt and collar)
for attr, val in (("shadow_ray_count", 4), ("shadow_step_count", 12), ("shadow_resolution_scale", 1.0),
                  ("shadow_cube_size", "4096"), ("shadow_cascade_size", "4096"), ("use_soft_shadows", True)):
    try:
        setattr(scene.eevee, attr, val)
    except (AttributeError, TypeError):
        pass
for ob in scene.objects:
    if ob.type == "LIGHT" and ob.data.type == "SUN":
        ob.data.angle = math.radians(4)
        for attr, val in (("use_shadow_jitter", True), ("shadow_jitter_overblur", 30.0),
                          ("shadow_filter_radius", 4.0), ("shadow_maximum_resolution", 0.0005)):
            try:
                setattr(ob.data, attr, val)
            except (AttributeError, TypeError):
                pass

# "Wave:30" renders one frame to <out>/Wave_30.png; "Wave:1-60" renders a sequence to <out>/Wave/Wave_0001.png
for shot in shots:
    name, frames = shot.split(":")
    act = bpy.data.actions[name]
    arm.animation_data.action = act
    try:
        if not arm.animation_data.action_slot and act.slots:
            arm.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass
    if frames == "all":
        frames = "%d-%d" % (int(act.frame_range[0]), int(act.frame_range[1]))
    if "-" in frames:
        a, b = map(int, frames.split("-"))
        os.makedirs(os.path.join(out_dir, name), exist_ok=True)
        for i, fr in enumerate(range(a, b + 1)):
            scene.frame_set(fr)
            r.filepath = os.path.join(out_dir, name, f"{name}_{i + 1:04d}.png")
            bpy.ops.render.render(write_still=True)
        print("wrote", name, b - a + 1, "frames")
    else:
        scene.frame_set(int(frames))
        r.filepath = os.path.join(out_dir, f"{name}_{frames}.png")
        bpy.ops.render.render(write_still=True)
        print("wrote", r.filepath)
