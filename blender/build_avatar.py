"""
Anime-style avatar of Muhammad Ebad Hafeez for the 3D portfolio.

HOW TO USE
1. Open Blender (3.6 or newer, 4.x recommended).
2. Go to the "Scripting" tab, click "Open", choose this file, then click "Run Script" (the ▶ button).
3. The script builds the character, rig and animations, then saves:
      ~/ebad_avatar/ebad_avatar.blend
      ~/ebad_avatar/avatar.glb
   (change OUTPUT_DIR below if you want another folder)
4. Copy avatar.glb into client/public/models/ and set avatar.url = '/models/avatar.glb'
   in client/src/data/portfolio.js.

The character is built from code: every mesh part is attached to a bone (rigid parenting),
so it animates cleanly in Three.js without weight painting.

Animations (GLB clip names): Idle, Blink, Wave, GlassesPush, PendantGlow, LevelUp,
PeaceJump, SitDown, Sleep, WakeUp, RubEyes
"""

import math
import os

OUTPUT_DIR = os.path.join(os.path.expanduser("~"), "ebad_avatar")
FPS = 30

# =====================================================================
# Small vector / quaternion helpers (pure Python so this file also runs
# outside Blender for previews)
# =====================================================================

def v_add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def v_mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def v_dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def v_cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def v_len(a): return math.sqrt(v_dot(a, a))
def v_norm(a):
    l = v_len(a)
    return (0.0, 0.0, 1.0) if l < 1e-9 else v_mul(a, 1.0 / l)
def v_lerp(a, b, t): return v_add(a, v_mul(v_sub(b, a), t))
def v_hadamard(a, b): return (a[0] * b[0], a[1] * b[1], a[2] * b[2])

Q_ID = (1.0, 0.0, 0.0, 0.0)  # (w, x, y, z)

def q_mul(a, b):
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw)

def q_conj(q): return (q[0], -q[1], -q[2], -q[3])

def q_axis_angle(axis, deg):
    axis = v_norm(axis)
    h = math.radians(deg) / 2
    s = math.sin(h)
    return (math.cos(h), axis[0] * s, axis[1] * s, axis[2] * s)

def q_euler(x=0.0, y=0.0, z=0.0):
    """Blender 'XYZ' Euler order: X applied first, then Y, then Z."""
    qx = q_axis_angle((1, 0, 0), x)
    qy = q_axis_angle((0, 1, 0), y)
    qz = q_axis_angle((0, 0, 1), z)
    return q_mul(qz, q_mul(qy, qx))

def q_rot(q, v):
    p = (0.0, v[0], v[1], v[2])
    r = q_mul(q_mul(q, p), q_conj(q))
    return (r[1], r[2], r[3])

def q_between(u, v):
    """Shortest rotation taking direction u onto direction v."""
    u, v = v_norm(u), v_norm(v)
    d = v_dot(u, v)
    if d > 0.999999:
        return Q_ID
    if d < -0.999999:
        axis = v_cross((1, 0, 0), u)
        if v_len(axis) < 1e-6:
            axis = v_cross((0, 1, 0), u)
        return q_axis_angle(axis, 180)
    c = v_cross(u, v)
    q = (1 + d, c[0], c[1], c[2])
    n = math.sqrt(sum(x * x for x in q))
    return tuple(x / n for x in q)

def q_norm(q):
    n = math.sqrt(sum(x * x for x in q))
    return tuple(x / n for x in q)


# =====================================================================
# Skeleton. Character faces -Y (Blender front view), Z up, metres.
# His right side is -X (".R"), left side is +X (".L").
# =====================================================================

def _mirror(p): return (-p[0], p[1], p[2])

BONES = []  # (name, head, tail, parent)

def _bone(name, head, tail, parent):
    BONES.append((name, head, tail, parent))

_bone("root", (0, 0, 0), (0, 0, 0.12), None)
_bone("hips", (0, 0, 0.95), (0, 0, 1.06), "root")
_bone("spine", (0, 0, 1.06), (0, 0, 1.25), "hips")
_bone("chest", (0, 0, 1.25), (0, 0, 1.44), "spine")
_bone("neck", (0, 0, 1.44), (0, 0, 1.54), "chest")
_bone("head", (0, 0, 1.54), (0, 0, 1.80), "neck")
_bone("eyes", (0, -0.11, 1.634), (0, -0.11, 1.674), "head")
_bone("glasses", (0, -0.145, 1.62), (0, -0.145, 1.66), "head")
_bone("pendant", (0, -0.112, 1.395), (0, -0.112, 1.36), "chest")

for side, sx in (("L", 1), ("R", -1)):
    def m(p, sx=sx): return (p[0] * sx, p[1], p[2])
    _bone(f"upper_arm.{side}", m((0.185, 0, 1.415)), m((0.235, 0.005, 1.15)), "chest")
    _bone(f"forearm.{side}", m((0.235, 0.005, 1.15)), m((0.262, -0.012, 0.915)), f"upper_arm.{side}")
    _bone(f"hand.{side}", m((0.262, -0.012, 0.915)), m((0.268, -0.015, 0.835)), f"forearm.{side}")
    _bone(f"thigh.{side}", m((0.095, 0, 0.94)), m((0.1, 0, 0.51)), "hips")
    _bone(f"shin.{side}", m((0.1, 0, 0.51)), m((0.1, 0.01, 0.085)), f"thigh.{side}")
    _bone(f"foot.{side}", m((0.1, 0.01, 0.085)), m((0.1, -0.12, 0.025)), f"shin.{side}")

_bone("index.R", (-0.268, -0.019, 0.838), (-0.27, -0.02, 0.783), "hand.R")
_bone("middle.R", (-0.269, -0.006, 0.836), (-0.271, -0.006, 0.778), "hand.R")

# Design coordinates above are for a realistic body. The stylized look comes from two maps:
# the body gets shorter and chunkier, the head gets much bigger (about 3.5 heads tall).
BODY_SXY = 1.0
BODY_SZ = 0.86
HEAD_SCALE = 1.24
HEAD_PIVOT = (0.0, 0.0, 1.54)
HEAD_BONES = ("head", "eyes", "glasses")

def body_map(p):
    return (p[0] * BODY_SXY, p[1] * BODY_SXY, p[2] * BODY_SZ)

HEAD_PIVOT_DST = body_map(HEAD_PIVOT)

def head_map(p):
    return v_add(HEAD_PIVOT_DST, v_mul(v_sub(p, HEAD_PIVOT), HEAD_SCALE))

def target_map(p):
    """Map an animation target given in design coords (near the face -> head map)."""
    return head_map(p) if p[2] >= 1.46 else body_map(p)

BONE_SRC = {b[0]: b for b in BONES}
BONES[:] = [(n, head_map(h) if n in HEAD_BONES else body_map(h), head_map(t) if n in HEAD_BONES else body_map(t), par)
            for (n, h, t, par) in BONES]

BONE = {b[0]: b for b in BONES}
BONE_NAMES = [b[0] for b in BONES]

def bone_dir(name):
    _, h, t, _ = BONE[name]
    return v_norm(v_sub(t, h))

def bone_len(name):
    _, h, t, _ = BONE[name]
    return v_len(v_sub(t, h))


# =====================================================================
# Materials (name -> colour, roughness, metallic, emission, alpha)
# =====================================================================

MATERIALS = {
    "Skin":        dict(color="#C4875F", rough=0.6),
    "SkinShade":   dict(color="#B07655", rough=0.6),
    "Blush":       dict(color="#CC8066", rough=0.75),
    "Lips":        dict(color="#7E4A44", rough=0.5),
    "LipsUpper":   dict(color="#A2655A", rough=0.6),
    "LipsSoft":    dict(color="#B9766A", rough=0.45),
    "Hair":        dict(color="#1C1820", rough=0.6),
    "HairShine":   dict(color="#3A3350", rough=0.3),
    "Brow":        dict(color="#1A1517", rough=0.6),
    "Stubble":     dict(color="#4A3A32", rough=0.85),
    "Goatee":      dict(color="#6B5345", rough=0.9),
    "EyeWhite":    dict(color="#F5F2EC", rough=0.3),
    "Iris":        dict(color="#3B2416", rough=0.15),
    "IrisLight":   dict(color="#9A6A3E", rough=0.3),
    "Pupil":       dict(color="#0D0908", rough=0.1),
    "EyeShine":    dict(color="#FFFFFF", rough=0.2, emission="#FFFFFF"),
    "Lash":        dict(color="#120E12", rough=0.5),
    "Shirt":       dict(color="#4C3022", rough=0.85),
    "ShirtDark":   dict(color="#3A241A", rough=0.85),
    "ShirtLight":  dict(color="#5E3D2C", rough=0.85),
    "Button":      dict(color="#8C6B50", rough=0.4),
    "Trousers":    dict(color="#E7DDC8", rough=0.9),
    "Crease":      dict(color="#CDBFA4", rough=0.9),
    "Shoe":        dict(color="#F4F2ED", rough=0.6),
    "Sole":        dict(color="#D5D0C6", rough=0.7),
    "Silver":      dict(color="#CDD2DA", rough=0.25, metal=0.9),
    "Star":        dict(color="#E3E7EE", rough=0.2, metal=0.9, emission="#000000"),
    "Gold":        dict(color="#D5A548", rough=0.3, metal=1.0),
    "WatchFace":   dict(color="#1C1B20", rough=0.2),
    "Bead":        dict(color="#0E0E12", rough=0.12),
    "Lens":        dict(color="#DCE8F6", rough=0.05, alpha=0.18),
}
MAT_NAMES = list(MATERIALS.keys())


# =====================================================================
# Mesh building. Each Part is attached to one bone. Groups whose name
# contains "NoOutline" get no toon outline on the website.
# =====================================================================

class Part:
    def __init__(self, bone, group):
        self.bone = bone
        self.group = group
        self.verts = []
        self.faces = []
        self.mats = []

    @property
    def name(self):
        return f"AV_{self.bone}_{self.group}".replace(".", "_")

    def add(self, verts, faces, mat):
        off = len(self.verts)
        self.verts.extend(verts)
        mi = MAT_NAMES.index(mat)
        for f in faces:
            self.faces.append([i + off for i in f])
            self.mats.append(mi)


PARTS = {}

def part(bone, group="Body"):
    key = (bone, group)
    if key not in PARTS:
        PARTS[key] = Part(bone, group)
    return PARTS[key]


def ellipsoid(p, center, radii, mat, rot=Q_ID, u=20, v=12, deform=None, cut=None):
    """UV ellipsoid. deform(local_unit_point) -> local_unit_point. cut(world_point) -> True removes faces."""
    verts = []
    for j in range(v + 1):
        phi = math.pi * j / v - math.pi / 2  # -90 .. 90
        for i in range(u):
            th = 2 * math.pi * i / u
            lp = (math.cos(phi) * math.cos(th), math.cos(phi) * math.sin(th), math.sin(phi))
            if deform:
                lp = deform(lp)
            wp = v_add(center, q_rot(rot, v_hadamard(lp, radii)))
            verts.append(wp)
    faces = []
    for j in range(v):
        for i in range(u):
            a = j * u + i
            b = j * u + (i + 1) % u
            c = (j + 1) * u + (i + 1) % u
            d = (j + 1) * u + i
            f = [a, b, c, d]
            if cut:
                cen = v_mul(v_add(v_add(verts[a], verts[b]), v_add(verts[c], verts[d])), 0.25)
                if cut(cen):
                    continue
            faces.append(f)
    # Remove duplicate pole vertices' degenerate faces by keeping quads (works fine for rendering)
    p.add(verts, faces, mat)


def tube(p, path, radii, mat, seg=12, ref=(0, -1, 0), caps=True, closed=False, tip=False, ref_fn=None):
    """Loft rings along path. radii: list of (rx, ry) per point. ref: direction for ry axis."""
    n = len(path)
    verts = []
    for k in range(n):
        if closed:
            t = v_norm(v_sub(path[(k + 1) % n], path[k - 1]))
        elif k == 0:
            t = v_norm(v_sub(path[1], path[0]))
        elif k == n - 1:
            t = v_norm(v_sub(path[-1], path[-2]))
        else:
            t = v_norm(v_sub(path[k + 1], path[k - 1]))
        r = ref_fn(k, path[k]) if ref_fn else ref
        ay = v_sub(r, v_mul(t, v_dot(r, t)))
        if v_len(ay) < 1e-6:
            ay = v_cross(t, (1, 0, 0))
        ay = v_norm(ay)
        ax = v_norm(v_cross(ay, t))
        rx, ry = radii[k]
        for i in range(seg):
            a = 2 * math.pi * i / seg
            verts.append(v_add(path[k], v_add(v_mul(ax, rx * math.cos(a)), v_mul(ay, ry * math.sin(a)))))
    faces = []
    rings = n if closed else n - 1
    for k in range(rings):
        k2 = (k + 1) % n
        for i in range(seg):
            a = k * seg + i
            b = k * seg + (i + 1) % seg
            c = k2 * seg + (i + 1) % seg
            d = k2 * seg + i
            faces.append([a, d, c, b])
    if not closed:
        if caps:
            faces.append(list(range(seg - 1, -1, -1)))
        if tip:
            verts.append(v_add(path[-1], v_mul(v_norm(v_sub(path[-1], path[-2])), 0.6 * max(radii[-1]))))
            ti = len(verts) - 1
            base = (n - 1) * seg
            for i in range(seg):
                faces.append([base + i, ti, base + (i + 1) % seg])
        elif caps:
            base = (n - 1) * seg
            faces.append([base + i for i in range(seg)])
    p.add(verts, faces, mat)


def box(p, center, size, mat, rot=Q_ID):
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    corners = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
               (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    verts = [v_add(center, q_rot(rot, c)) for c in corners]
    faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    p.add(verts, faces, mat)


def star_plate(p, center, r_out, r_in, depth, mat, points=8, rot=Q_ID):
    """Flat star facing -Y."""
    ring = []
    for i in range(points * 2):
        a = math.pi * i / points + math.pi / 2
        r = r_out if i % 2 == 0 else r_in
        ring.append((math.cos(a) * r, 0.0, math.sin(a) * r))
    n = len(ring)
    verts = []
    for y in (-depth / 2, depth / 2):
        for (x, _, z) in ring:
            verts.append(v_add(center, q_rot(rot, (x, y, z))))
    verts.append(v_add(center, q_rot(rot, (0, -depth * 0.9, 0))))  # front centre (slight bevel)
    verts.append(v_add(center, q_rot(rot, (0, depth * 0.9, 0))))   # back centre
    fc, bc = 2 * n, 2 * n + 1
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append([fc, j, i])
        faces.append([bc, n + i, n + j])
        faces.append([i, j, n + j, n + i])
    p.add(verts, faces, mat)


# =====================================================================
# THE CHARACTER
# =====================================================================

HEAD_C = (0.0, -0.002, 1.655)
HEAD_R = (0.106, 0.117, 0.15)
CAP_R = (0.116, 0.127, 0.16)


def jaw_deform(lp):
    """Young, slim face: narrow V jaw, defined chin, slight cheekbones."""
    x, y, z = lp
    if z < 0.12:
        t = min(1.0, (0.12 - z) / 1.12)
        x *= 1 - 0.36 * t ** 1.4
        if y > 0:
            y *= 1 - 0.55 * t ** 1.2          # jaw/neck narrows from the back
        else:
            y = y * (1 - 0.1 * t) - 0.03 * t  # chin stays forward
    if y < 0:
        g = math.exp(-((z + 0.12) ** 2) / 0.02) * math.exp(-((abs(x) - 0.62) ** 2) / 0.04)
        x *= 1 + 0.035 * g                     # cheekbones
        if z > 0.1:
            y *= 1 - 0.04 * min(1, (z - 0.1) / 0.5)   # flatter forehead
    return (x, y, z)


_FACE_BINS = None


def _face_bins():
    global _FACE_BINS
    if _FACE_BINS is None:
        bins = {}
        n = 260
        for j in range(n + 1):
            ph = -math.pi / 2 + math.pi * j / n
            for i in range(n + 1):
                th = -math.pi / 2 + math.pi * i / n
                lp = (math.cos(ph) * math.sin(th), -math.cos(ph) * math.cos(th), math.sin(ph))
                x, y, z = jaw_deform(lp)
                wx, wy, wz = HEAD_C[0] + x * HEAD_R[0], HEAD_C[1] + y * HEAD_R[1], HEAD_C[2] + z * HEAD_R[2]
                key = (round(wx / 0.0015), round(wz / 0.0015))
                if key not in bins or wy < bins[key]:
                    bins[key] = wy
        _FACE_BINS = bins
    return _FACE_BINS


def face_y(xw, zw):
    """World Y of the front skin surface at world (x, z)."""
    bins = _face_bins()
    kx, kz = round(xw / 0.0015), round(zw / 0.0015)
    for r in range(0, 6):
        vals = [bins[(kx + dx, kz + dz)] for dx in range(-r, r + 1) for dz in range(-r, r + 1)
                if (kx + dx, kz + dz) in bins]
        if vals:
            return min(vals)
    return HEAD_C[1] - HEAD_R[1]


def on_face(x, z, out=0.0):
    return (x, face_y(x, z) - out, z)


HAIR_C = (0.006, -0.016, 1.732)
HAIR_R = (0.126, 0.14, 0.1)


def _ell_pt(center, radii, theta, phi, scale=1.0):
    th, ph = math.radians(theta), math.radians(phi)
    lp = (math.cos(ph) * math.sin(th), -math.cos(ph) * math.cos(th), math.sin(ph))
    return v_add(center, v_mul(v_hadamard(lp, radii), scale))


def scalp(theta, phi, scale=1.0, surf="cap"):
    """theta: 0 = front, +90 = his left (+X). phi: elevation."""
    if surf == "mass":
        return _ell_pt(HAIR_C, HAIR_R, theta, phi, scale)
    return _ell_pt(HEAD_C, CAP_R, theta, phi, scale)


def push_out(pt, margin=1.04, surf="cap"):
    c, r = (HAIR_C, HAIR_R) if surf == "mass" else (HEAD_C, CAP_R)
    q = v_sub(pt, c)
    qn = (q[0] / r[0], q[1] / r[1], q[2] / r[2])
    l = v_len(qn)
    if l < margin:
        qn = v_mul(qn, margin / max(l, 1e-6))
        return v_add(c, v_hadamard(qn, r))
    return pt


def strand(p, theta, phi, flow, length, width, thick, bend, mat="Hair", rings=9, margin=1.03, surf="cap",
           curl=None, taper=0.82):
    """A hair lock. flow: start direction. bend: quadratic offset. curl(t)->extra offset vector."""
    base = scalp(theta, phi, 0.99, surf)
    c = HAIR_C if surf == "mass" else HEAD_C
    flow = v_norm(flow)
    path = []
    for k in range(rings):
        t = k / (rings - 1)
        pt = v_add(base, v_add(v_mul(flow, length * t), v_mul(bend, t * t)))
        if curl:
            pt = v_add(pt, curl(t))
        m = margin if t < 0.7 else margin - 0.05 * (t - 0.7) / 0.3
        pt = push_out(pt, m if k > 0 else 0.99, surf)
        if surf == "mass":
            pt = push_out(pt, 1.02, "cap")
        path.append(pt)
    radii = []
    for k in range(rings):
        t = k / (rings - 1)
        w = width * (1 - taper * t ** 1.5) * (0.92 + 0.2 * math.sin(math.pi * min(1, t * 1.3)))
        h = thick * (1 - 0.65 * t ** 1.5)
        radii.append((max(w, 0.0015), max(h, 0.0012)))

    def ref_fn(k, pt):
        return v_norm(v_sub(pt, c))

    tube(p, path, radii, mat, seg=10, caps=True, tip=True, ref_fn=ref_fn)


def build_head():
    hp = part("head")
    ellipsoid(hp, HEAD_C, HEAD_R, "Skin", u=48, v=34, deform=jaw_deform)

    # ears (close to the head)
    for sx in (1, -1):
        ellipsoid(hp, (0.103 * sx, 0.012, 1.628), (0.011, 0.02, 0.028), "Skin", rot=q_euler(z=-12 * sx), u=14, v=10)
        ellipsoid(hp, (0.109 * sx, 0.01, 1.627), (0.005, 0.013, 0.021), "SkinShade", rot=q_euler(z=-12 * sx), u=10, v=6)

    # long straight nose with a narrow bridge
    bridge = [on_face(0, 1.652, -0.002), on_face(0, 1.632, 0.002), on_face(0, 1.613, 0.0055), on_face(0, 1.601, 0.0085)]
    tube(hp, bridge, [(0.0075, 0.006), (0.0085, 0.0068), (0.0102, 0.0078), (0.0112, 0.0082)], "Skin", seg=12)
    ellipsoid(hp, on_face(0, 1.598, 0.0088), (0.0105, 0.0075, 0.0078), "Skin", u=14, v=10)
    for sx in (1, -1):
        ellipsoid(hp, on_face(0.0095 * sx, 1.594, 0.005), (0.0055, 0.0055, 0.0045), "Skin", u=10, v=8)
        ellipsoid(hp, on_face(0.0052 * sx, 1.5895, 0.0105), (0.0028, 0.002, 0.0016), "SkinShade", u=8, v=5)

    # lips: thin upper lip, fuller lower lip, neutral expression
    mz = 1.567
    pts = [on_face(x, mz + 0.0006 * (1 - abs(x) / 0.019), 0.0012) for x in (-0.019, -0.009, 0.0, 0.009, 0.019)]
    tube(hp, pts, [(0.0012, 0.0012)] * len(pts), "Lips", seg=6)
    ellipsoid(hp, on_face(0, mz + 0.0035, 0.0006), (0.0135, 0.004, 0.0026), "LipsUpper", u=12, v=6)
    ellipsoid(hp, on_face(0, mz - 0.0055, 0.0004), (0.0125, 0.0055, 0.0042), "LipsSoft", u=12, v=8)

    # thin moustache + light goatee patches (soft, like his stubble)
    for sx in (1, -1):
        pts = [on_face(0.002 * sx, 1.5775, 0.0016), on_face(0.011 * sx, 1.5765, 0.0014), on_face(0.02 * sx, 1.5715, 0.0008)]
        tube(hp, pts, [(0.0026, 0.0011), (0.0027, 0.0011), (0.0012, 0.0008)], "Stubble", seg=6, tip=True,
             ref_fn=lambda k, pt: (0, 0, 1))
    ellipsoid(hp, on_face(0, 1.551, 0.0006), (0.0055, 0.0022, 0.0045), "Stubble", u=10, v=6)
    ellipsoid(hp, on_face(0, 1.537, 0.0005), (0.0095, 0.0022, 0.0075), "Goatee", u=14, v=8)

    # thick straight brows sitting low over the eyes
    for sx in (1, -1):
        pts = [on_face(0.013 * sx, 1.6625, 0.0025), on_face(0.032 * sx, 1.6685, 0.0028),
               on_face(0.053 * sx, 1.669, 0.0024), on_face(0.072 * sx, 1.6635, 0.0012)]
        tube(hp, pts, [(0.0072, 0.0035), (0.0078, 0.0037), (0.0062, 0.003), (0.0026, 0.0016)], "Brow", seg=10,
             tip=True, ref_fn=lambda k, pt: (0, 0, 1))

    # ---------------- hair ----------------
    def cap_cut(c):
        x, y, z = c
        if z < 1.57:
            return True
        if y < -0.03 and z < 1.705:
            return True
        if abs(x) > 0.07 and y < 0.035 and z < 1.665 - 0.45 * (y + 0.03):
            return True
        return False
    ellipsoid(hp, HEAD_C, CAP_R, "Hair", u=56, v=38, cut=cap_cut)

    # thick wavy volume on top
    def mass_deform(lp):
        x, y, z = lp
        th = math.atan2(x, -y)
        bump = 1 + 0.05 * math.sin(6 * th + 5 * z) * max(0.0, z + 0.2) + 0.025 * math.sin(13 * th - 2 * z)
        return (x * bump + 0.05 * max(0.0, z), y * bump, z * (1 + 0.06 * math.sin(5 * th + 1)))
    def mass_cut(c):
        x, y, z = c
        if z < 1.672:
            return True
        if y < -0.06 and z < 1.712:
            return True
        return False
    ellipsoid(hp, HAIR_C, HAIR_R, "Hair", u=64, v=34, deform=mass_deform, cut=mass_cut)

    # broad flat waves lying on the volume, sweeping from a side part on his right (-X) to his left (+X)
    for i, (th, ph, ln) in enumerate(((-48, 52, 0.15), (-34, 62, 0.16), (-18, 70, 0.15), (-4, 76, 0.13),
                                      (-56, 66, 0.13), (-38, 78, 0.12), (-22, 40, 0.15), (-6, 46, 0.14),
                                      (10, 54, 0.12), (24, 62, 0.1))):
        strand(hp, th, ph, (0.85, -0.42, 0.18), ln, 0.06, 0.011, (0.0, -0.02, -0.08),
               surf="mass", margin=1.012 + 0.006 * (i % 3), rings=11, taper=0.7)

    # front locks dropping from the hairline over his forehead toward his left brow (wavy)
    front = [(-24, 12, 0.07, 0.0, 0.03), (-10, 10, 0.085, 0.4, 0.034), (4, 10, 0.095, 0.9, 0.036),
             (18, 12, 0.085, 1.4, 0.034), (32, 16, 0.065, 1.9, 0.03), (-36, 16, 0.05, 2.4, 0.028)]
    for th, ph, ln, phase, wd in front:
        curl = (lambda t, phase=phase: (0.01 * math.sin(math.pi * 1.5 * t + phase), -0.004 * t, 0.0))
        strand(hp, th, ph, (0.35, -0.35, -0.87), ln, wd, 0.011, (0.018, -0.018, 0.005),
               surf="mass", margin=1.01, rings=11, curl=curl, taper=0.75)

    # short tapered sides and back
    for th in (80, 98, 116, -80, -98, -116):
        for ph in (10, 30):
            strand(hp, th, ph, (0, 0.4, -1), 0.045, 0.05, 0.011, (0, 0.01, -0.005), rings=6, margin=1.025)
    for th in range(135, 230, 19):
        for ph in (8, 30):
            strand(hp, th, ph, (0, 0.5, -1), 0.06, 0.055, 0.013, (0, 0.01, -0.01), rings=6, margin=1.03)


EYE_X = 0.041
EYE_Z = 1.636


def build_eyes():
    ep = part("eyes", "FaceNoOutline")
    for sx in (1, -1):
        cx = EYE_X * sx
        rot = q_mul(q_euler(z=18 * sx), q_euler(y=-6 * sx))   # follow the face, outer corner slightly up
        c = on_face(cx, EYE_Z, -0.0005)
        def at(dx, dy, dz):
            return v_add(c, q_rot(rot, (dx * sx, dy, dz)))
        ellipsoid(ep, c, (0.0185, 0.0055, 0.0108), "EyeWhite", rot=rot, u=18, v=10)
        ellipsoid(ep, at(-0.0012, -0.0034, -0.0004), (0.0102, 0.0038, 0.0102), "Iris", rot=rot, u=16, v=10)
        ellipsoid(ep, at(-0.0012, -0.0049, -0.0004), (0.0052, 0.0024, 0.0052), "Pupil", rot=rot, u=12, v=8)
        ellipsoid(ep, at(0.0028, -0.0062, 0.0035), (0.0022, 0.0011, 0.0022), "EyeShine", rot=rot, u=8, v=5)
        # heavy upper lid (skin) covering the top of the eye: gives his calm, half-lidded look
        ellipsoid(ep, at(0.0, -0.0004, 0.0092), (0.0196, 0.0052, 0.0034), "SkinShade", rot=rot, u=18, v=8)
    lp = part("eyes", "Lids")
    for sx in (1, -1):
        cx = EYE_X * sx
        pts = [on_face(cx - 0.0175 * sx, EYE_Z + 0.0005, 0.003), on_face(cx - 0.007 * sx, EYE_Z + 0.0046, 0.0058),
               on_face(cx + 0.007 * sx, EYE_Z + 0.0052, 0.0058), on_face(cx + 0.017 * sx, EYE_Z + 0.0028, 0.0035),
               on_face(cx + 0.022 * sx, EYE_Z + 0.004, 0.0025)]
        tube(lp, pts, [(0.0018, 0.0014), (0.0024, 0.0016), (0.0024, 0.0016), (0.0018, 0.0013), (0.0008, 0.0008)],
             "Lash", seg=6, tip=True, ref_fn=lambda k, pt: (0, 0, 1))
        pts = [on_face(cx - 0.011 * sx, EYE_Z - 0.0072, 0.002), on_face(cx + 0.006 * sx, EYE_Z - 0.0082, 0.002),
               on_face(cx + 0.016 * sx, EYE_Z - 0.005, 0.002)]
        tube(lp, pts, [(0.0009, 0.0007)] * 3, "SkinShade", seg=5, ref_fn=lambda k, pt: (0, 0, 1))


def build_glasses():
    gp = part("glasses", "Frames")
    lens = part("glasses", "LensNoOutline")
    y = face_y(0.045, EYE_Z) - 0.016
    for sx in (1, -1):
        cx, cz = 0.047 * sx, EYE_Z - 0.002
        w, h = 0.036, 0.03
        # big geometric frame: flat top, angled sides, rounded bottom corners
        shape = [(-1.0, 0.75), (-0.55, 1.0), (0.55, 1.0), (1.0, 0.72), (1.0, -0.2), (0.75, -0.85), (0.35, -1.0),
                 (-0.35, -1.0), (-0.75, -0.85), (-1.0, -0.2)]
        pts = []
        for k in range(len(shape)):
            a, b = shape[k], shape[(k + 1) % len(shape)]
            for s in (0.0, 0.5):
                u, v = a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s
                px = cx + u * w * sx
                pts.append((px, y + 0.007 * max(0.0, u), cz + v * h))
        tube(gp, pts, [(0.0013, 0.0013)] * len(pts), "Silver", seg=6, caps=False, closed=True,
             ref_fn=lambda k, pt: (0, -1, 0))
        lv = [(cx, y + 0.001, cz)] + [(px, py + 0.0004, pz) for (px, py, pz) in pts]
        lf = [[0, (i + 1) % len(pts) + 1, i + 1] for i in range(len(pts))]
        lens.add(lv, lf, "Lens")
        outer = (cx + w * sx, y + 0.007, cz + 0.6 * h)
        tube(gp, [outer, (0.1 * sx, y + 0.04, cz + 0.016), (0.112 * sx, -0.02, cz + 0.012), (0.111 * sx, 0.018, 1.62)],
             [(0.0013, 0.0013)] * 4, "Silver", seg=6)
        ellipsoid(gp, on_face(0.0095 * sx, 1.622, 0.004), (0.0022, 0.0016, 0.003), "Silver", u=8, v=5)
    tube(gp, [(-0.016, y, EYE_Z + 0.022), (0, y - 0.002, EYE_Z + 0.025), (0.016, y, EYE_Z + 0.022)],
         [(0.0013, 0.0013)] * 3, "Silver", seg=6)
    tube(gp, [(-0.013, y + 0.001, EYE_Z + 0.004), (0, y - 0.001, EYE_Z + 0.0), (0.013, y + 0.001, EYE_Z + 0.004)],
         [(0.0012, 0.0012)] * 3, "Silver", seg=6)


def build_torso():
    # trousers top (hips)
    hp = part("hips")
    rings = [(0.80, 0.150, 0.108), (0.88, 0.156, 0.11), (0.96, 0.152, 0.106), (1.0, 0.148, 0.104)]
    tube(hp, [(0, 0, r[0]) for r in rings], [(r[1], r[2]) for r in rings], "Trousers", seg=20)
    # untucked shirt hem over the trousers
    rings = [(0.855, 0.168, 0.12), (0.87, 0.172, 0.124), (0.95, 0.168, 0.12), (1.08, 0.155, 0.107)]
    tube(hp, [(0, 0, r[0]) for r in rings], [(r[1], r[2]) for r in rings], "Shirt", seg=24, caps=False)
    tube(hp, [(0, 0, 0.856), (0, 0, 0.87)], [(0.164, 0.116), (0.168, 0.12)], "ShirtDark", seg=24, caps=False)
    box(hp, (0, -0.124, 0.93), (0.006, 0.006, 0.09), "ShirtDark")  # placket bottom

    sp = part("spine")
    rings = [(1.04, 0.158, 0.11), (1.15, 0.158, 0.108), (1.27, 0.164, 0.108)]
    tube(sp, [(0, 0, r[0]) for r in rings], [(r[1], r[2]) for r in rings], "Shirt", seg=22)

    cp = part("chest")
    rings = [(1.24, 0.168, 0.112), (1.33, 0.178, 0.112), (1.40, 0.185, 0.104), (1.44, 0.15, 0.085),
             (1.465, 0.075, 0.062)]
    tube(cp, [(0, 0, r[0]) for r in rings], [(r[1], r[2]) for r in rings], "Shirt", seg=22)
    # placket + buttons
    box(cp, (0, -0.1135, 1.30), (0.02, 0.006, 0.12), "ShirtDark")
    box(sp, (0, -0.110, 1.14), (0.02, 0.006, 0.2), "ShirtDark")
    for z in (0.96, 1.06, 1.16, 1.26):
        ellipsoid(part("hips" if z < 1.05 else ("spine" if z < 1.25 else "chest")),
                  (0, -0.118 if z > 1.05 else -0.128, z), (0.0055, 0.003, 0.0055), "Button", u=10, v=5)
    # open collar: skin V, then the two collar flaps
    cp.add([(-0.045, -0.104, 1.452), (0.045, -0.104, 1.452), (0, -0.111, 1.355)], [[0, 2, 1]], "Skin")
    for sx in (1, -1):
        tube(cp, [(0.05 * sx, -0.06, 1.47), (0.05 * sx, -0.098, 1.452), (0.02 * sx, -0.113, 1.375)],
             [(0.006, 0.02), (0.007, 0.024), (0.004, 0.012)], "ShirtLight", seg=8, tip=True,
             ref_fn=lambda k, pt, sx=sx: (sx, -0.3, 0))
        tube(cp, [(0.07 * sx, 0.02, 1.468), (0.065 * sx, -0.04, 1.472), (0.05 * sx, -0.06, 1.47)],
             [(0.006, 0.016)] * 3, "ShirtLight", seg=8)
    # chain: V from the neck down to the star
    for sx in (1, -1):
        pts = [(0.05 * sx, 0.01, 1.468), (0.052 * sx, -0.05, 1.462), (0.038 * sx, -0.093, 1.43),
               (0.018 * sx, -0.108, 1.405), (0.002 * sx, -0.112, 1.392)]
        tube(cp, pts, [(0.0018, 0.0018)] * len(pts), "Silver", seg=5)

    # neck
    np_ = part("neck")
    tube(np_, [(0, 0.004, 1.43), (0, 0.004, 1.50), (0, -0.002, 1.575)],
         [(0.04, 0.039), (0.037, 0.037), (0.04, 0.042)], "Skin", seg=16)
    ellipsoid(np_, (0, -0.032, 1.505), (0.014, 0.01, 0.012), "SkinShade", u=8, v=6)  # adam's apple hint


def build_pendant():
    pp = part("pendant", "Star")
    ellipsoid(pp, (0, -0.112, 1.392), (0.003, 0.003, 0.003), "Silver", u=8, v=5)  # bail
    star_plate(pp, (0, -0.118, 1.372), 0.021, 0.0075, 0.0045, "Star", points=8)


def build_arms():
    for side, sx in (("L", 1), ("R", -1)):
        ua, fa, hd = f"upper_arm.{side}", f"forearm.{side}", f"hand.{side}"
        _, sh, el, _ = BONE_SRC[ua]
        _, _, wr, _ = BONE_SRC[fa]
        # shoulder ball + sleeve
        up = part(ua)
        ellipsoid(up, v_add(sh, (-0.022 * sx, 0, 0.0)), (0.056, 0.054, 0.05), "Shirt", u=16, v=10)
        tube(up, [v_lerp(sh, el, t) for t in (0.0, 0.5, 1.0)],
             [(0.054, 0.052), (0.05, 0.048), (0.047, 0.046)], "Shirt", seg=14)
        fp = part(fa)
        ellipsoid(fp, el, (0.048, 0.047, 0.048), "Shirt", u=14, v=8)  # elbow
        tube(fp, [v_lerp(el, wr, t) for t in (0.0, 0.25, 0.42)],
             [(0.047, 0.046), (0.045, 0.044), (0.044, 0.043)], "Shirt", seg=14)
        # rolled cuff
        tube(fp, [v_lerp(el, wr, t) for t in (0.38, 0.46, 0.53)],
             [(0.047, 0.046), (0.052, 0.051), (0.046, 0.045)], "ShirtLight", seg=14)
        tube(fp, [v_lerp(el, wr, t) for t in (0.45, 0.75, 1.0)],
             [(0.036, 0.034), (0.033, 0.031), (0.028, 0.025)], "Skin", seg=12)
        wpos = v_lerp(el, wr, 0.9)
        axis = v_norm(v_sub(wr, el))
        if side == "L":
            # gold watch
            tube(fp, [v_sub(wpos, v_mul(axis, 0.008)), v_add(wpos, v_mul(axis, 0.008))],
                 [(0.032, 0.029), (0.032, 0.029)], "Gold", seg=14)
            face_c = v_add(wpos, (0.028, -0.004, 0))
            tube(fp, [face_c, v_add(face_c, (0.007, 0, 0))], [(0.014, 0.014), (0.012, 0.012)], "Gold", seg=14,
                 ref=(0, 0, 1))
            tube(fp, [v_add(face_c, (0.0065, 0, 0)), v_add(face_c, (0.0075, 0, 0))],
                 [(0.0115, 0.0115), (0.0115, 0.0115)], "WatchFace", seg=14, ref=(0, 0, 1))
        else:
            # black bead bracelet
            ax2 = v_norm(v_cross(axis, (0, -1, 0)))
            ay2 = v_norm(v_cross(axis, ax2))
            for i in range(12):
                a = 2 * math.pi * i / 12
                c = v_add(wpos, v_add(v_mul(ax2, 0.034 * math.cos(a)), v_mul(ay2, 0.032 * math.sin(a))))
                ellipsoid(fp, c, (0.0085, 0.0085, 0.0085), "Bead", u=10, v=6)

        # ---- hand ----
        _, hh, ht, _ = BONE_SRC[hd]
        hdir = v_norm(v_sub(ht, hh))
        inward = (-sx, 0, 0)   # palm faces the body
        hp = part(hd)
        palm_c = v_add(hh, v_mul(hdir, 0.038))
        ellipsoid(hp, palm_c, (0.021, 0.037, 0.044), "Skin", u=16, v=10)
        # thumb (front side), slightly toward the palm
        t0 = v_add(hh, (0.004 * -sx, -0.026, -0.012))
        tube(hp, [t0, v_add(t0, (0.008 * -sx, -0.012, -0.024)), v_add(t0, (0.014 * -sx, -0.012, -0.044))],
             [(0.012, 0.0115), (0.0105, 0.0105), (0.009, 0.009)], "Skin", seg=10, tip=True)
        base = v_add(hh, v_mul(hdir, 0.074))
        fingers = [(-0.019, 0.05), (-0.006, 0.055), (0.006, 0.052), (0.017, 0.042)]  # (y offset, length)
        for fi, (yo, ln) in enumerate(fingers):
            if side == "R" and fi < 2:
                continue  # index and middle on their own bones
            f0 = v_add(base, (0, yo, 0))
            f1 = v_add(f0, v_mul(hdir, ln * 0.45))
            f2 = v_add(f1, v_add(v_mul(hdir, ln * 0.25), v_mul(inward, ln * 0.3)))
            f3 = v_add(f2, v_add(v_mul(hdir, ln * 0.02), v_mul(inward, ln * 0.28)))
            tube(hp, [f0, f1, f2, f3], [(0.0098, 0.0095)] * 3 + [(0.0085, 0.008)], "Skin", seg=10, tip=True)

    # right index and middle fingers (straight at rest, curled by animation)
    for bname, ln in (("index.R", 0.055), ("middle.R", 0.06)):
        _, h, t, _ = BONE_SRC[bname]
        d = v_norm(v_sub(t, h))
        fp = part(bname)
        pts = [v_add(h, v_mul(d, s * ln)) for s in (-0.05, 0.5, 1.0)]
        tube(fp, pts, [(0.0098, 0.0095), (0.0095, 0.0092), (0.0086, 0.0082)], "Skin", seg=10, tip=True)


def build_legs():
    for side, sx in (("L", 1), ("R", -1)):
        th, sh, ft = f"thigh.{side}", f"shin.{side}", f"foot.{side}"
        _, hip, knee, _ = BONE_SRC[th]
        _, _, ankle, _ = BONE_SRC[sh]
        tp = part(th)
        tube(tp, [v_add(hip, (0, 0, 0.06)), v_lerp(hip, knee, 0.5), knee],
             [(0.083, 0.085), (0.078, 0.08), (0.074, 0.077)], "Trousers", seg=16)
        ellipsoid(tp, knee, (0.07, 0.073, 0.05), "Trousers", u=14, v=8)
        # front pleat crease
        tube(tp, [v_add(hip, (0.0, -0.084, 0.0)), v_add(knee, (0, -0.078, 0))], [(0.0025, 0.0016)] * 2,
             "Crease", seg=5)
        sp = part(sh)
        # wide-leg trousers that flare a little and break over the shoe
        tube(sp, [knee, v_lerp(knee, ankle, 0.5), v_add(ankle, (0, -0.012, 0.012)), v_add(ankle, (0, -0.02, -0.02))],
             [(0.074, 0.077), (0.077, 0.081), (0.081, 0.088), (0.082, 0.09)], "Trousers", seg=16)
        tube(sp, [v_add(knee, (0, -0.078, 0)), v_add(ankle, (0, -0.096, -0.01))], [(0.0025, 0.0016)] * 2,
             "Crease", seg=5)
        fp = part(ft)
        _, fh, ftail, _ = BONE_SRC[ft]
        # white sneaker
        ellipsoid(fp, v_add(fh, (0, -0.045, -0.04)), (0.05, 0.13, 0.045), "Shoe", u=18, v=10,
                  cut=lambda c, fh=fh: c[2] < fh[2] - 0.075)
        tube(fp, [v_add(fh, (0, 0.085, -0.073)), v_add(fh, (0, -0.045, -0.075)), v_add(fh, (0, -0.172, -0.072))],
             [(0.05, 0.012), (0.054, 0.012), (0.044, 0.011)], "Sole", seg=14, ref=(0, 0, 1))
        ellipsoid(fp, v_add(fh, (0, -0.12, -0.035)), (0.044, 0.06, 0.03), "Shoe", u=14, v=8)  # toe box


def build_all():
    PARTS.clear()
    build_head()
    build_eyes()
    build_glasses()
    build_torso()
    build_pendant()
    build_arms()
    build_legs()
    for key, p in PARTS.items():
        fn = head_map if key[0] in HEAD_BONES else body_map
        p.verts = [fn(v) for v in p.verts]
    return list(PARTS.values())


# =====================================================================
# POSING: forward kinematics + analytic two-bone IK for the arms.
# A pose gives each bone a rotation expressed in rest (armature) axes,
# applied around the bone head. Blender keyframes are derived from it.
# =====================================================================

def fk(rots, root_loc=(0, 0, 0)):
    C, H = {}, {}
    for name, head, tail, parent in BONES:
        r = rots.get(name, Q_ID)
        if parent is None:
            C[name] = r
            H[name] = v_add(head, root_loc)
        else:
            ph = BONE[parent][1]
            H[name] = v_add(H[parent], q_rot(C[parent], v_sub(head, ph)))
            C[name] = q_mul(C[parent], r)
    return C, H


def solve_arm(rots, root_loc, side, target, pole):
    ua, fa = f"upper_arm.{side}", f"forearm.{side}"
    C, H = fk(rots, root_loc)
    parent = BONE[ua][3]
    Cp = C[parent]
    S = H[ua]
    a = bone_len(ua)
    b = v_len(v_sub(BONE[fa][2], BONE[fa][1]))
    d = v_sub(target, S)
    dist = max(abs(a - b) + 1e-4, min(v_len(d), a + b - 1e-4))
    dn = v_norm(d)
    cos_a = (a * a + dist * dist - b * b) / (2 * a * dist)
    sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
    pv = v_sub(pole, S)
    pp = v_sub(pv, v_mul(dn, v_dot(pv, dn)))
    if v_len(pp) < 1e-6:
        pp = (0, 1, 0)
    pp = v_norm(pp)
    E = v_add(S, v_add(v_mul(dn, a * cos_a), v_mul(pp, a * sin_a)))
    T = v_add(S, v_mul(dn, dist))
    r_up = q_between(bone_dir(ua), q_rot(q_conj(Cp), v_sub(E, S)))
    C_up = q_mul(Cp, r_up)
    r_fo = q_between(bone_dir(fa), q_rot(q_conj(C_up), v_sub(T, E)))
    rots[ua] = r_up
    rots[fa] = r_fo


def crouch(rots, deg, side_list=("L", "R")):
    for s in side_list:
        rots[f"thigh.{s}"] = q_euler(x=-deg)
        rots[f"shin.{s}"] = q_euler(x=2 * deg)
        rots[f"foot.{s}"] = q_euler(x=-deg)
    return -2 * bone_len("thigh.L") * (1 - math.cos(math.radians(deg)))


FINGER_RELAX = q_euler(y=-55)
FINGER_FIST = q_euler(y=-95)


def make_pose(euler=None, root=(0, 0, 0), crouch_deg=0, ik=None, eyes=None, glasses=None, fingers="relax",
              pendant_spin=0.0, extra=None):
    rots = {}
    # neutral: relaxed elbows
    rots["forearm.L"] = q_euler(x=-8)
    rots["forearm.R"] = q_euler(x=-8)
    root = body_map(tuple(root))
    if crouch_deg:
        dz = crouch(rots, crouch_deg)
        root = (root[0], root[1], root[2] + dz)
    for name, e in (euler or {}).items():
        rots[name] = q_euler(*e)
    if pendant_spin:
        rots["pendant"] = q_mul(rots.get("pendant", Q_ID), q_euler(z=pendant_spin))
    # fingers
    if fingers == "relax":
        rots["index.R"] = FINGER_RELAX
        rots["middle.R"] = FINGER_RELAX
    elif fingers == "fist":
        rots["index.R"] = FINGER_FIST
        rots["middle.R"] = FINGER_FIST
    elif fingers == "peace":
        rots["index.R"] = q_euler(x=-9)
        rots["middle.R"] = q_euler(x=9)
    elif fingers == "point":
        rots["index.R"] = Q_ID
        rots["middle.R"] = FINGER_FIST
    if extra:
        rots.update(extra)
    for side, (target, pole) in (ik or {}).items():
        solve_arm(rots, root, side, target_map(target), target_map(pole))
    return {"rots": rots, "root": root, "eyes": eyes, "glasses": glasses}


# convenient IK pole positions (elbows point down/out/back)
def pole_down(side): return (0.55 * (1 if side == "L" else -1), 0.35, 0.95)
def pole_up(side): return (0.6 * (1 if side == "L" else -1), 0.25, 1.15)

REST_WRIST = {"L": BONE["forearm.L"][2], "R": BONE["forearm.R"][2]}


def breathing(t):
    """t in [0, 1] loop phase -> small chest/spine rotation."""
    s = math.sin(2 * math.pi * t)
    return {"chest": (-1.2 * s, 0, 0), "spine": (0.6 * s, 0, 0)}


# =====================================================================
# ANIMATIONS. Each is a list of (frame, pose). eye_keys: whether the
# action drives the eyes bone (only Blink, Sleep, WakeUp, RubEyes do,
# so Blink can play on top of any other clip).
# =====================================================================

def anim_idle():
    keys = []
    for f in range(1, 122, 15):
        t = (f - 1) / 120
        s = math.sin(2 * math.pi * t)
        e = breathing(t)
        e["hips"] = (0, 0, 1.6 * s)
        e["spine"] = (e["spine"][0], -0.8 * s, 0)
        e["head"] = (1.5 * math.sin(2 * math.pi * t + 1), 1.2 * s, 2 * math.sin(2 * math.pi * t * 1))
        e["upper_arm.L"] = (1.5 * s, -3, 0)
        e["upper_arm.R"] = (-1.5 * s, 3, 0)
        e["forearm.L"] = (-9 - 1.5 * s, 0, 0)
        e["forearm.R"] = (-9 + 1.5 * s, 0, 0)
        keys.append((f, make_pose(e, root=(0, 0, -0.004 * (1 - math.cos(2 * math.pi * t)) / 2))))
    return dict(keys=keys, loop=True, eye_keys=False)


def anim_blink():
    return dict(keys=[(1, {"eyes": 1.0}), (3, {"eyes": 0.08}), (5, {"eyes": 0.08}), (8, {"eyes": 1.0})],
                loop=False, eye_keys=True, eyes_only=True)


def anim_wave():
    R = "R"
    up = (-0.31, -0.1, 1.72)
    keys = [(1, make_pose())]
    keys.append((12, make_pose({"head": (0, 6, 4), "chest": (0, 3, 0)},
                               ik={R: (up, pole_up(R))}, fingers="open", extra={"hand.R": q_euler(y=10)})))
    for i, f in enumerate(range(18, 60, 7)):
        sw = 1 if i % 2 == 0 else -1
        tgt = (up[0] + 0.025 * sw, up[1], up[2] + 0.005 * (i % 2))
        keys.append((f, make_pose({"head": (0, 6, 4), "chest": (0, 3, 0)},
                                  ik={R: (tgt, pole_up(R))}, fingers="open",
                                  extra={"hand.R": q_euler(y=10 + 28 * sw)})))
    keys.append((68, make_pose({"head": (0, 2, 1)}, ik={R: ((-0.3, -0.08, 1.2), pole_down(R))})))
    keys.append((80, make_pose()))
    return dict(keys=keys, loop=False, eye_keys=False)


def anim_glasses_push():
    R = "R"
    near = (-0.06, -0.24, 1.53)
    push = (-0.045, -0.235, 1.555)
    p_el = (-0.32, -0.15, 1.15)
    hand_tilt = {"hand.R": q_euler(x=-25, y=25)}
    keys = [
        (1, make_pose()),
        (14, make_pose({"head": (7, 0, -3)}, ik={R: (near, p_el)}, fingers="point", extra=hand_tilt)),
        (20, make_pose({"head": (5, 0, -3)}, ik={R: (push, p_el)}, fingers="point", extra=hand_tilt,
                       glasses=(0, 0, 0.01))),
        (26, make_pose({"head": (-5, -2, -2), "chest": (-2, 0, 0)}, ik={R: (push, p_el)}, fingers="point",
                       extra=hand_tilt, glasses=(0, 0, 0.01))),
        (34, make_pose({"head": (-6, -3, 0), "chest": (-2, 0, 0)},
                       ik={R: ((-0.12, -0.2, 1.4), p_el)}, fingers="point", glasses=(0, 0, 0.004))),
        (48, make_pose({"head": (-3, -1, 0)}, glasses=(0, 0, 0.0))),
        (60, make_pose()),
    ]
    return dict(keys=keys, loop=False, eye_keys=False)


def anim_pendant_glow():
    L = "L"
    hold = (0.055, -0.2, 1.33)
    keys = [(1, make_pose())]
    keys.append((14, make_pose({"head": (20, 0, 0), "neck": (6, 0, 0)}, ik={L: (hold, pole_down(L))})))
    # pendant lifts off and spins twice
    for k, f in enumerate(range(18, 64, 3)):
        spin = 720 * k / 15
        keys.append((f, make_pose({"head": (14 - 0.8 * k, 0, 0), "neck": (5, 0, 0), "chest": (-1.5, 0, 0)},
                                  ik={L: ((0.07, -0.21, 1.34), pole_down(L))}, pendant_spin=spin,
                                  extra={"pendant": q_euler(x=-55 * min(1, k / 3))})))
    keys.append((70, make_pose({"head": (-9, 0, 0), "chest": (-4, 0, 0)}, pendant_spin=720,
                               extra={"pendant": q_euler(x=-20)})))
    keys.append((82, make_pose({"head": (-6, 0, 0), "chest": (-3, 0, 0)})))
    keys.append((96, make_pose()))
    return dict(keys=keys, loop=False, eye_keys=False)


def anim_level_up():
    L, R = "L", "R"
    keys = [(1, make_pose())]
    keys.append((10, make_pose({"spine": (14, 0, 0), "head": (-6, 0, 0)}, crouch_deg=28,
                               ik={L: ((0.25, 0.05, 0.85), pole_down(L)), R: ((-0.25, 0.05, 0.85), pole_down(R))},
                               fingers="fist")))
    keys.append((18, make_pose({"spine": (-6, 0, 0), "head": (-10, 0, 0)}, root=(0, 0, 0.16),
                               ik={L: ((0.27, -0.06, 1.98), pole_up(L)), R: ((-0.27, -0.06, 1.98), pole_up(R))},
                               fingers="fist", extra={"thigh.L": q_euler(x=-10), "shin.L": q_euler(x=25)})))
    keys.append((25, make_pose({"spine": (-8, 0, 0), "head": (-12, 0, 0)}, root=(0, 0, 0.2),
                               ik={L: ((0.3, -0.04, 1.99), pole_up(L)), R: ((-0.3, -0.04, 1.99), pole_up(R))},
                               fingers="fist", extra={"thigh.L": q_euler(x=-30), "shin.L": q_euler(x=60)})))
    keys.append((33, make_pose({"spine": (8, 0, 0)}, crouch_deg=18,
                               ik={L: ((0.3, -0.1, 1.3), pole_down(L)), R: ((-0.3, -0.1, 1.3), pole_down(R))},
                               fingers="fist")))
    # fist pump x2
    for f, z in ((42, 1.9), (49, 1.62), (56, 1.9), (63, 1.62)):
        keys.append((f, make_pose({"head": (-4, -4, -6), "chest": (0, 4, -6)},
                                  ik={R: ((-0.24, -0.12, z), pole_up(R)), L: ((0.2, 0.06, 1.02), pole_down(L))},
                                  fingers="fist")))
    keys.append((76, make_pose({"head": (-2, 0, 0)})))
    keys.append((90, make_pose()))
    return dict(keys=keys, loop=False, eye_keys=False)


def anim_peace_jump():
    L, R = "L", "R"
    face = (-0.16, -0.2, 1.6)
    pose_e = {"head": (0, -10, -6), "chest": (0, -3, -4)}
    keys = [(1, make_pose())]
    keys.append((7, make_pose({"spine": (10, 0, 0)}, crouch_deg=20)))
    keys.append((14, make_pose(dict(pose_e), root=(0, 0, 0.12), ik={R: (face, pole_up(R)),
                               L: ((0.3, -0.05, 1.05), pole_down(L))}, fingers="peace",
                               extra={"hand.R": q_euler(x=-30, z=20), "thigh.L": q_euler(x=-25),
                                      "shin.L": q_euler(x=55)})))
    keys.append((22, make_pose(dict(pose_e), crouch_deg=10, ik={R: (face, pole_up(R)),
                               L: ((0.28, 0.02, 1.0), pole_down(L))}, fingers="peace",
                               extra={"hand.R": q_euler(x=-30, z=20)})))
    keys.append((38, make_pose(dict(pose_e), ik={R: (face, pole_up(R)), L: ((0.28, 0.02, 1.0), pole_down(L))},
                               fingers="peace", extra={"hand.R": q_euler(x=-30, z=20)})))
    keys.append((52, make_pose()))
    return dict(keys=keys, loop=False, eye_keys=False)


SEATED_EULER = {"thigh.L": (-90, 4, 0), "thigh.R": (-90, -4, 0), "spine": (-10, 0, 0), "chest": (-4, 0, 0)}
SEATED_ROOT = (0, 0.05, -0.84)
SEATED_IK = {"L": ((0.2, 0.2, 0.06), (0.7, 0.5, 0.5)), "R": ((-0.2, 0.2, 0.06), (-0.7, 0.5, 0.5))}


def seated(extra_euler=None, eyes=None):
    e = dict(SEATED_EULER)
    for k, v in (extra_euler or {}).items():
        e[k] = v
    return make_pose(e, root=SEATED_ROOT, ik=SEATED_IK, eyes=eyes)


def anim_sit_down():
    keys = [(1, make_pose(eyes=1.0))]
    keys.append((12, make_pose({"head": (-4, 0, 6)}, eyes=1.0)))  # little yawn-look
    keys.append((24, make_pose({"spine": (22, 0, 0)}, crouch_deg=55, eyes=0.6,
                               ik={"L": ((0.25, -0.1, 0.55), pole_down("L")), "R": ((-0.25, -0.1, 0.55), pole_down("R"))})))
    keys.append((40, seated({"head": (14, 0, 0)}, eyes=0.35)))
    keys.append((48, seated({"head": (26, 4, 0)}, eyes=0.08)))
    return dict(keys=keys, loop=False, eye_keys=True)


def anim_sleep():
    keys = []
    for f in range(1, 92, 15):
        t = (f - 1) / 90
        s = math.sin(2 * math.pi * t)
        keys.append((f, seated({"head": (26 + 4 * s, 4, 3 * s), "chest": (-4 - 1.5 * s, 0, 0)}, eyes=0.08)))
    return dict(keys=keys, loop=True, eye_keys=True)


def anim_wake_up():
    keys = [(1, seated({"head": (26, 4, 0)}, eyes=0.08))]
    keys.append((6, seated({"head": (-14, 0, 0), "chest": (-8, 0, 0)}, eyes=1.35)))
    keys.append((14, make_pose({"spine": (-6, 0, 0), "head": (-10, 0, 0)}, root=(0, 0, 0.08), eyes=1.3,
                               ik={"L": ((0.36, -0.05, 1.6), pole_up("L")), "R": ((-0.36, -0.05, 1.6), pole_up("R"))},
                               fingers="open")))
    keys.append((22, make_pose({"head": (2, 0, 0)}, crouch_deg=12, eyes=1.1)))
    keys.append((30, make_pose({"head": (0, 0, -8)}, eyes=1.0)))
    keys.append((36, make_pose({"head": (0, 0, 8)}, eyes=1.0)))
    keys.append((44, make_pose(eyes=1.0)))
    return dict(keys=keys, loop=False, eye_keys=True)


def anim_rub_eyes():
    L, R = "L", "R"
    keys = [(1, make_pose(eyes=1.0))]
    keys.append((10, make_pose({"head": (6, 0, 0)}, eyes=0.5)))
    for i, f in enumerate(range(16, 46, 5)):
        o = 0.012 * (1 if i % 2 == 0 else -1)
        keys.append((f, make_pose({"head": (10, 0, 2 * (1 if i % 2 else -1))}, eyes=0.15, fingers="fist",
                                  ik={L: ((0.055 + o, -0.25, 1.55), (0.45, -0.1, 1.1)),
                                      R: ((-0.055 + o, -0.25, 1.55), (-0.45, -0.1, 1.1))},
                                  extra={"hand.L": q_euler(x=-40), "hand.R": q_euler(x=-40)})))
    keys.append((54, make_pose({"head": (2, 0, 0)}, eyes=0.55)))
    keys.append((60, make_pose({"head": (-2, 0, 0)}, eyes=0.8)))
    keys.append((66, make_pose(eyes=1.0)))
    return dict(keys=keys, loop=False, eye_keys=True)


def build_actions():
    return {
        "Idle": anim_idle(),
        "Blink": anim_blink(),
        "Wave": anim_wave(),
        "GlassesPush": anim_glasses_push(),
        "PendantGlow": anim_pendant_glow(),
        "LevelUp": anim_level_up(),
        "PeaceJump": anim_peace_jump(),
        "SitDown": anim_sit_down(),
        "Sleep": anim_sleep(),
        "WakeUp": anim_wake_up(),
        "RubEyes": anim_rub_eyes(),
    }


# "open" fingers = straight (rest pose); make_pose treats unknown modes as rest
# =====================================================================
# BLENDER SIDE
# =====================================================================

def _hex(c):
    c = c.lstrip("#")
    srgb = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in srgb]
    return (*lin, 1.0)


def run_in_blender():
    import bpy
    import bmesh
    from mathutils import Vector, Quaternion, Matrix

    # ---------- clean scene ----------
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(coll):
            coll.remove(item)
    scene = bpy.context.scene
    scene.render.fps = FPS

    root_coll = bpy.data.collections.get("EbadAvatar") or bpy.data.collections.new("EbadAvatar")
    if root_coll.name not in scene.collection.children:
        scene.collection.children.link(root_coll)

    # ---------- materials ----------
    mats = {}
    for name, spec in MATERIALS.items():
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = _hex(spec["color"])
        bsdf.inputs["Roughness"].default_value = spec.get("rough", 0.6)
        bsdf.inputs["Metallic"].default_value = spec.get("metal", 0.0)
        if "emission" in spec:
            key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
            bsdf.inputs[key].default_value = _hex(spec["emission"])
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = 1.0 if spec["emission"] != "#000000" else 0.0
        if spec.get("alpha", 1.0) < 1.0:
            bsdf.inputs["Alpha"].default_value = spec["alpha"]
            try:
                m.surface_render_method = "BLENDED"
            except AttributeError:
                m.blend_method = "BLEND"
        m.diffuse_color = _hex(spec["color"])
        mats[name] = m

    # ---------- armature ----------
    arm_data = bpy.data.armatures.new("EbadRig")
    arm = bpy.data.objects.new("EbadAvatar", arm_data)
    root_coll.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent in BONES:
        eb = arm_data.edit_bones.new(name)
        eb.head = head
        eb.tail = tail
        eb.roll = 0.0
        if parent:
            eb.parent = arm_data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    arm_data.display_type = "STICK"
    arm.show_in_front = True

    # ---------- meshes, rigidly parented to bones ----------
    parts = build_all()
    for p in parts:
        me = bpy.data.meshes.new(p.name)
        me.from_pydata(p.verts, [], p.faces)
        used = sorted(set(p.mats))
        for mi in used:
            me.materials.append(mats[MAT_NAMES[mi]])
        remap = {mi: i for i, mi in enumerate(used)}
        for poly, mi in zip(me.polygons, p.mats):
            poly.material_index = remap[mi]
            poly.use_smooth = True
        me.validate(clean_customdata=False)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(p.name, me)
        root_coll.objects.link(ob)
        bone = arm_data.bones[p.bone]
        ob.parent = arm
        ob.parent_type = "BONE"
        ob.parent_bone = p.bone
        ob.matrix_parent_inverse = (arm.matrix_world @ bone.matrix_local @
                                    Matrix.Translation((0, bone.length, 0))).inverted()

    # ---------- animations ----------
    rest3 = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}

    def basis_quat(name, q):
        B = rest3[name]
        R = Quaternion(q).to_matrix()
        return (B.inverted() @ R @ B).to_quaternion()

    def basis_loc(name, world_offset):
        return rest3[name].inverted() @ Vector(world_offset)

    if arm.animation_data is None:
        arm.animation_data_create()
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"

    actions = build_actions()
    body_bones = [n for n in BONE_NAMES if n != "eyes"]
    for aname, spec in actions.items():
        act = bpy.data.actions.new(aname)
        act.use_fake_user = True
        arm.animation_data.action = act
        last_q = {}
        for frame, pose in spec["keys"]:
            if spec.get("eyes_only"):
                pb = arm.pose.bones["eyes"]
                s = pose["eyes"]
                pb.scale = Vector((1, s, 1))  # eyes bone points up: local Y = world Z
                pb.keyframe_insert("scale", frame=frame, group="eyes")
                continue
            for bname in body_bones:
                pb = arm.pose.bones[bname]
                q = basis_quat(bname, pose["rots"].get(bname, Q_ID))
                if bname in last_q and last_q[bname].dot(q) < 0:
                    q.negate()
                last_q[bname] = q.copy()
                pb.rotation_quaternion = q
                pb.keyframe_insert("rotation_quaternion", frame=frame, group=bname)
            rb = arm.pose.bones["root"]
            rb.location = basis_loc("root", pose["root"])
            rb.keyframe_insert("location", frame=frame, group="root")
            gb = arm.pose.bones["glasses"]
            gb.location = basis_loc("glasses", pose.get("glasses") or (0, 0, 0))
            gb.keyframe_insert("location", frame=frame, group="glasses")
            if spec["eye_keys"]:
                eb = arm.pose.bones["eyes"]
                s = pose.get("eyes") or 1.0
                eb.scale = Vector((1, s, 1))
                eb.keyframe_insert("scale", frame=frame, group="eyes")
        try:
            act.use_frame_range = True
            act.frame_range = (spec["keys"][0][0], spec["keys"][-1][0])
        except (AttributeError, TypeError):
            pass

    # reset pose and show Idle in the .blend
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    arm.animation_data.action = bpy.data.actions["Idle"]
    scene.frame_start, scene.frame_end = 1, 121

    # ---------- a simple stage so the .blend looks nice ----------
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=0.8, fill_type="NGON", location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "Stage_NotExported"
    gm = bpy.data.materials.new("Stage")
    gm.diffuse_color = _hex("#2B2150")
    ground.data.materials.append(gm)
    for c in list(ground.users_collection):
        c.objects.unlink(ground)
    scene.collection.objects.link(ground)

    # light and camera so the .blend renders nicely (not exported)
    sun = bpy.data.objects.new("Sun_NotExported", bpy.data.lights.new("Sun", type="SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Camera_NotExported", bpy.data.cameras.new("Camera"))
    cam.location = (1.6, -3.6, 1.35)
    cam.rotation_euler = (math.radians(84), 0, math.radians(24))
    scene.collection.objects.link(cam)
    scene.camera = cam

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    blend_path = os.path.join(OUTPUT_DIR, "ebad_avatar.blend")
    glb_path = os.path.join(OUTPUT_DIR, "avatar.glb")

    # ---------- export GLB (only the avatar) ----------
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for ob in root_coll.objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = arm
    kwargs = dict(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True,
                  export_animations=True, export_yup=True, export_force_sampling=True)
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_animation_mode="ACTIONS")
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)

    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("=" * 60)
    print("Avatar built.")
    print("  Blender file:", blend_path)
    print("  Web model:   ", glb_path)
    print("=" * 60)


try:
    import bpy  # noqa: F401
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False

if IN_BLENDER and __name__ == "__main__":
    run_in_blender()
