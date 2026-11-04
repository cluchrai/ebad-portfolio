"""Software preview of the avatar (no Blender needed). Renders toon-shaded PNGs.
usage: python3 preview.py [Action] [frame] ; outputs to ./preview/"""
import sys, os, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import build_avatar as A

OUT = os.path.join(os.path.dirname(__file__), "preview")
os.makedirs(OUT, exist_ok=True)


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float) / 255


def posed_parts(pose):
    parts = A.build_all()
    C, H = A.fk(pose["rots"], pose["root"]) if pose else ({}, {})
    out = []
    for p in parts:
        V = np.array(p.verts, dtype=float)
        if pose:
            head = np.array(A.BONE[p.bone][1])
            if p.bone == "eyes" and pose.get("eyes"):
                V = head + (V - head) * np.array([1, 1, pose["eyes"]])
            if p.bone == "glasses" and pose.get("glasses"):
                V = V + np.array(pose["glasses"])
            q = C[p.bone]
            w, x, y, z = q
            R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
            V = (V - head) @ R.T + np.array(H[p.bone])
        out.append((p, V))
    return out


def render(parts, cam_pos, target, size=(800, 1000), fov=28, fname="out.png"):
    W, Hh = size
    cam = np.array(cam_pos, float); tgt = np.array(target, float)
    fwd = tgt - cam; fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 0, 1]); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    f = 0.5 * Hh / math.tan(math.radians(fov) / 2)
    color = np.zeros((Hh, W, 3)); color[:] = hex_rgb('#1E1B44')
    depth = np.full((Hh, W), np.inf)
    pid = np.full((Hh, W), -1, dtype=int)
    light = np.array([0.4, -0.7, 0.6]); light /= np.linalg.norm(light)
    for k, (p, V) in enumerate(parts):
        rel = V - cam
        cx = rel @ right; cy = rel @ up; cz = rel @ fwd
        sx = W / 2 + f * cx / cz; sy = Hh / 2 - f * cy / cz
        noout = "NoOutline" in p.group
        for fi, face in enumerate(p.faces):
            mat = A.MAT_NAMES[p.mats[fi]]
            spec = A.MATERIALS[mat]
            base = hex_rgb(spec['color'])
            for t in range(1, len(face) - 1):
                tri = [face[0], face[t], face[t + 1]]
                P = V[tri]
                n = np.cross(P[1] - P[0], P[2] - P[0]); nl = np.linalg.norm(n)
                if nl < 1e-12: continue
                n /= nl
                if np.dot(n, P[0] - cam) > 0: n = -n  # double-sided shading
                d = np.dot(n, light)
                shade = 1.0 if d > 0.15 else 0.72
                rim = 1.0
                if 'emission' in spec and spec['emission'] != '#000000': shade = 1.15
                col = np.clip(base * shade * rim, 0, 1)
                if spec.get('metal', 0) > 0.5:
                    col = np.clip(base * (0.75 + 0.45 * max(d, 0) ** 6 * 3), 0, 1)
                xs, ys, zs = sx[tri], sy[tri], cz[tri]
                if (zs <= 0.01).any(): continue
                x0, x1 = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
                y0, y1 = int(max(0, np.floor(ys.min()))), int(min(Hh - 1, np.ceil(ys.max())))
                if x1 < x0 or y1 < y0: continue
                gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
                den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
                if abs(den) < 1e-9: continue
                w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
                w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den
                w2 = 1 - w0 - w1
                m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
                if not m.any(): continue
                z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
                sub = depth[y0:y1 + 1, x0:x1 + 1]
                upd = m & (z < sub)
                if spec.get('alpha', 1) < 1:
                    cs = color[y0:y1 + 1, x0:x1 + 1]
                    cs[upd] = cs[upd] * 0.85 + np.array([1, 1, 1]) * 0.15
                    continue
                sub[upd] = z[upd]
                color[y0:y1 + 1, x0:x1 + 1][upd] = col
                pid[y0:y1 + 1, x0:x1 + 1][upd] = k * 1 if not noout else -2
    # outlines from depth jumps and part boundaries
    dz = np.zeros_like(depth); dd = np.where(np.isinf(depth), 50, depth)
    dz[1:-1, 1:-1] = np.maximum.reduce([abs(dd[1:-1, 1:-1] - dd[:-2, 1:-1]), abs(dd[1:-1, 1:-1] - dd[2:, 1:-1]),
                                        abs(dd[1:-1, 1:-1] - dd[1:-1, :-2]), abs(dd[1:-1, 1:-1] - dd[1:-1, 2:])])
    edge = (dz > 0.012 * (dd / 2.5)) & (pid != -2)
    color[edge] = color[edge] * 0.25 + hex_rgb('#1a1220') * 0.75
    Image.fromarray((np.clip(color, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, fname))
    return os.path.join(OUT, fname)


def vertex_normals(V, faces):
    N = np.zeros_like(V)
    for f in faces:
        for t in range(1, len(f) - 1):
            a, b, c = f[0], f[t], f[t + 1]
            n = np.cross(V[b] - V[a], V[c] - V[a])
            N[a] += n; N[b] += n; N[c] += n
    # merge normals of coincident vertices (poles, seams)
    key = np.round(V / 1e-5).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    acc = np.zeros((inv.max() + 1, 3)); np.add.at(acc, inv, N)
    N = acc[inv]
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l < 1e-12] = 1
    return N / l


def render_smooth(parts, cam_pos, target, size=(800, 1000), fov=28, fname="out.png", ss=2):
    W, Hh = size[0] * ss, size[1] * ss
    cam = np.array(cam_pos, float); tgt = np.array(target, float)
    fwd = tgt - cam; fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 0, 1]); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    f = 0.5 * Hh / math.tan(math.radians(fov) / 2)
    yy = np.linspace(0, 1, Hh)[:, None, None]
    color = hex_rgb('#3B3474') * (1 - yy) + hex_rgb('#17183A') * yy + np.zeros((Hh, W, 3))
    depth = np.full((Hh, W), np.inf)
    keyL = np.array([-0.45, -0.75, 0.55]); keyL /= np.linalg.norm(keyL)
    fillL = np.array([0.7, -0.4, 0.1]); fillL /= np.linalg.norm(fillL)
    rimL = np.array([0.3, 0.9, 0.35]); rimL /= np.linalg.norm(rimL)
    key_c, fill_c, rim_c = np.array([1.0, 0.95, 0.88]), np.array([0.55, 0.62, 0.85]), np.array([1.0, 0.8, 0.6])
    for (p, V) in parts:
        NV = vertex_normals(V, p.faces)
        rel = V - cam
        cx = rel @ right; cy = rel @ up; cz = rel @ fwd
        sx = W / 2 + f * cx / cz; sy = Hh / 2 - f * cy / cz
        for fi, face in enumerate(p.faces):
            spec = A.MATERIALS[A.MAT_NAMES[p.mats[fi]]]
            base = hex_rgb(spec['color'])
            rough = spec.get('rough', 0.6); metal = spec.get('metal', 0)
            emis = 'emission' in spec and spec['emission'] != '#000000'
            alpha = spec.get('alpha', 1)
            for t in range(1, len(face) - 1):
                tri = [face[0], face[t], face[t + 1]]
                xs, ys, zs = sx[tri], sy[tri], cz[tri]
                if (zs <= 0.01).any(): continue
                x0, x1 = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
                y0, y1 = int(max(0, np.floor(ys.min()))), int(min(Hh - 1, np.ceil(ys.max())))
                if x1 < x0 or y1 < y0: continue
                den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
                if abs(den) < 1e-9: continue
                gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
                w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
                w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den
                w2 = 1 - w0 - w1
                m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
                if not m.any(): continue
                z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
                sub = depth[y0:y1 + 1, x0:x1 + 1]
                upd = m & (z < sub)
                if not upd.any(): continue
                n = (w0[..., None] * NV[tri[0]] + w1[..., None] * NV[tri[1]] + w2[..., None] * NV[tri[2]])[upd]
                n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
                pos = (w0[..., None] * V[tri[0]] + w1[..., None] * V[tri[1]] + w2[..., None] * V[tri[2]])[upd]
                view = cam - pos; view /= np.linalg.norm(view, axis=1, keepdims=True)
                flip = (n * view).sum(1) < 0
                n[flip] *= -1
                dk = (n @ keyL); df = (n @ fillL); dr = (n @ rimL)
                wrap = np.clip((dk + 0.35) / 1.35, 0, 1) ** 1.3
                diff = wrap[:, None] * key_c * 0.95 + np.clip((df + 0.2) / 1.2, 0, 1)[:, None] * fill_c * 0.35 + 0.12
                rim = np.clip(1 - (n * view).sum(1), 0, 1) ** 3 * np.clip(dr + 0.3, 0, 1) * 0.55
                hv = keyL + view; hv /= np.linalg.norm(hv, axis=1, keepdims=True)
                shin = 8 + (1 - rough) * 120
                specv = np.clip((n * hv).sum(1), 0, 1) ** shin * max(0.0, 0.8 - rough) * 1.6
                col = base * diff
                if A.MAT_NAMES[p.mats[fi]] in ("Skin", "SkinShade", "Blush"):
                    sss = np.exp(-((dk - 0.05) ** 2) / 0.05)[:, None] * np.array([0.25, 0.06, 0.02])
                    col = col + sss * base * 1.5
                if metal > 0.5:
                    env = 0.55 + 0.45 * n[:, 2:3]
                    col = base * env * 0.9 + specv[:, None] * 1.5
                else:
                    col = col + specv[:, None] * 0.9
                col = col + rim[:, None] * rim_c * base * 1.4
                if emis:
                    col = base * 1.05 + 0 * col
                col = np.clip(col, 0, 1)
                region = color[y0:y1 + 1, x0:x1 + 1]
                if alpha < 1:
                    fres = np.clip(1 - (n * view).sum(1), 0, 1) ** 2
                    a = (alpha + fres * 0.4)[:, None]
                    region[upd] = region[upd] * (1 - a) + (col * 0.6 + specv[:, None] * 2) * a
                    continue
                sub[upd] = z[upd]
                region[upd] = col
    img = Image.fromarray((np.clip(color, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8))
    img = img.resize(size, Image.LANCZOS)
    img.save(os.path.join(OUT, fname))
    return os.path.join(OUT, fname)


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else None
    frame = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    views = sys.argv[3].split(",") if len(sys.argv) > 3 else ["front", "three", "face"]
    pose = None
    if action:
        acts = A.build_actions()
        keys = acts[action]["keys"]
        pose = min(keys, key=lambda kv: abs(kv[0] - frame))[1]
        if "rots" not in pose:
            base = A.make_pose(); base["eyes"] = pose["eyes"]; pose = base
    parts = posed_parts(pose)
    tag = f"{action or 'rest'}_{frame}"
    cams = {
        "front": ((0, -3.8, 1.0), (0, 0, 0.88), (700, 1000), 26),
        "three": ((1.8, -3.2, 1.2), (0, 0, 0.88), (700, 1000), 26),
        "side": ((3.8, 0, 1.0), (0, 0, 0.88), (700, 1000), 26),
        "face": ((0.5, -1.25, 1.52), (0, 0, 1.47), (800, 800), 20),
        "facefront": ((0, -1.3, 1.48), (0, 0, 1.47), (800, 800), 20),
    }
    for v in views:
        c, t, s, fov = cams[v]
        print(render_smooth(parts, c, t, s, fov, f"{tag}_{v}.png"))
