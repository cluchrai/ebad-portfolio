"""Writes avatar.glb straight from build_avatar.py (no Blender needed).

Node layout: one node per bone (rest rotation = identity, translation = offset from the parent head),
mesh nodes are children of their bone. Animations drive bone rotation, root/glasses translation
and eyes scale, sampled at 30 fps with ease-in-out between keys.

usage: python3 export_glb.py [out_path]
"""
import json, math, os, struct, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import build_avatar as A

FPS = A.FPS


def to_gl(v):  # Blender (x, y, z) Z-up, -Y forward  ->  glTF (x, z, -y) Y-up, +Z forward
    return (v[0], v[2], -v[1])


def q_to_gl(q):  # (w, x, y, z) Blender -> [x, y, z, w] glTF
    w, x, y, z = q
    return [x, z, -y, w]


def slerp(a, b, t):
    a = np.array(a, float); b = np.array(b, float)
    d = float(np.dot(a, b))
    if d < 0:
        b = -b; d = -d
    if d > 0.9995:
        r = a + t * (b - a)
        return r / np.linalg.norm(r)
    th = math.acos(d)
    return (math.sin((1 - t) * th) * a + math.sin(t * th) * b) / math.sin(th)


def ease(t):
    return t * t * (3 - 2 * t)


def vertex_normals(V, faces):
    N = np.zeros_like(V)
    for f in faces:
        for t in range(1, len(f) - 1):
            a, b, c = f[0], f[t], f[t + 1]
            n = np.cross(V[b] - V[a], V[c] - V[a])
            N[a] += n; N[b] += n; N[c] += n
    key = np.round(V / 1e-5).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    acc = np.zeros((inv.max() + 1, 3)); np.add.at(acc, inv, N)
    N = acc[inv]
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l < 1e-12] = 1
    return N / l


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    h = h.lstrip('#')
    return [srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.views, self.accessors = [], []

    def add(self, arr, comp, typ, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(self.bin) % 4:
            self.bin += b'\0'
        off = len(self.bin)
        self.bin += arr.tobytes()
        view = {"buffer": 0, "byteOffset": off, "byteLength": arr.nbytes}
        if target:
            view["target"] = target
        self.views.append(view)
        count = arr.shape[0]
        acc = {"bufferView": len(self.views) - 1, "componentType": comp, "count": count, "type": typ}
        if minmax:
            flat = arr.reshape(count, -1)
            acc["min"] = [float(x) for x in flat.min(0)]
            acc["max"] = [float(x) for x in flat.max(0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1


def main(out):
    parts = A.build_all()
    actions = A.build_actions()
    g = GLB()

    # ---------- materials ----------
    materials = []
    for name in A.MAT_NAMES:
        s = A.MATERIALS[name]
        m = {"name": name, "doubleSided": True, "pbrMetallicRoughness": {
            "baseColorFactor": hex_lin(s["color"]) + [s.get("alpha", 1.0)],
            "metallicFactor": s.get("metal", 0.0), "roughnessFactor": s.get("rough", 0.6)}}
        if "emission" in s and s["emission"] != "#000000":
            m["emissiveFactor"] = hex_lin(s["emission"])
        if s.get("alpha", 1.0) < 1.0:
            m["alphaMode"] = "BLEND"
        materials.append(m)

    # ---------- nodes: bones ----------
    nodes = []
    bone_index = {}
    for name, head, tail, parent in A.BONES:
        bone_index[name] = len(nodes)
        ph = A.BONE[parent][1] if parent else (0, 0, 0)
        nodes.append({"name": name, "translation": list(to_gl(A.v_sub(head, ph))), "children": []})
    for name, head, tail, parent in A.BONES:
        if parent:
            nodes[bone_index[parent]]["children"].append(bone_index[name])

    # ---------- meshes ----------
    meshes = []
    for p in parts:
        V = np.array(p.verts, float)
        head = np.array(A.BONE[p.bone][1])
        N = vertex_normals(V, p.faces)
        L = V - head
        P_gl = np.stack([L[:, 0], L[:, 2], -L[:, 1]], 1).astype(np.float32)
        N_gl = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1).astype(np.float32)
        pos_acc = g.add(P_gl, 5126, "VEC3", 34962, minmax=True)
        nrm_acc = g.add(N_gl, 5126, "VEC3", 34962)
        by_mat = {}
        for f, mi in zip(p.faces, p.mats):
            tris = by_mat.setdefault(mi, [])
            for t in range(1, len(f) - 1):
                tris.extend([f[0], f[t], f[t + 1]])
        prims = []
        for mi, idx in by_mat.items():
            arr = np.array(idx, dtype=np.uint32 if len(V) > 65535 else np.uint16)
            ia = g.add(arr, 5125 if arr.dtype == np.uint32 else 5123, "SCALAR", 34963)
            prims.append({"attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc}, "indices": ia, "material": mi})
        meshes.append({"name": p.name, "primitives": prims})
        nodes.append({"name": p.name, "mesh": len(meshes) - 1})
        nodes[bone_index[p.bone]]["children"].append(len(nodes) - 1)

    for n in nodes:
        if "children" in n and not n["children"]:
            del n["children"]

    top = len(nodes)
    nodes.append({"name": "EbadAvatar", "children": [bone_index["root"]]})

    # ---------- animations ----------
    rest_off = {name: np.array(nodes[bone_index[name]]["translation"]) for name, *_ in A.BONES}
    animations = []
    for aname, spec in actions.items():
        keys = spec["keys"]
        f0, f1 = keys[0][0], keys[-1][0]
        frames = list(range(f0, f1 + 1))
        times = np.array([(f - f0) / FPS for f in frames], np.float32)

        def sample(getter, kind):
            out = []
            for f in frames:
                for i in range(len(keys) - 1):
                    if keys[i][0] <= f <= keys[i + 1][0]:
                        a, b = keys[i], keys[i + 1]
                        break
                t = 0 if b[0] == a[0] else ease((f - a[0]) / (b[0] - a[0]))
                va, vb = getter(a[1]), getter(b[1])
                if kind == "rot":
                    out.append(slerp(va, vb, t))
                else:
                    out.append(np.array(va) + (np.array(vb) - np.array(va)) * t)
            return np.array(out, np.float32)

        t_acc = g.add(times, 5126, "SCALAR", minmax=True)
        samplers, channels = [], []

        def channel(node, path, data, typ):
            samplers.append({"input": t_acc, "output": g.add(data, 5126, typ), "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path}})

        if not spec.get("eyes_only"):
            for name, *_ in A.BONES:
                if name == "eyes":
                    continue
                channel(bone_index[name], "rotation",
                        sample(lambda pz, n=name: q_to_gl(pz["rots"].get(n, A.Q_ID)), "rot"), "VEC4")
            channel(bone_index["root"], "translation",
                    sample(lambda pz: list(rest_off["root"] + np.array(to_gl(pz["root"]))), "vec"), "VEC3")
            channel(bone_index["glasses"], "translation",
                    sample(lambda pz: list(rest_off["glasses"] + np.array(to_gl(pz.get("glasses") or (0, 0, 0)))),
                           "vec"), "VEC3")
        if spec["eye_keys"]:
            # Blender eyes Z-scale -> glTF Y-scale
            channel(bone_index["eyes"], "scale",
                    sample(lambda pz: [1.0, pz.get("eyes") or 1.0, 1.0], "vec"), "VEC3")
        animations.append({"name": aname, "samplers": samplers, "channels": channels})

    while len(g.bin) % 4:
        g.bin += b'\0'
    gltf = {
        "asset": {"version": "2.0", "generator": "ebad-portfolio build_avatar.py"},
        "scene": 0, "scenes": [{"name": "Avatar", "nodes": [top]}],
        "nodes": nodes, "meshes": meshes, "materials": materials,
        "accessors": g.accessors, "bufferViews": g.views,
        "buffers": [{"byteLength": len(g.bin)}], "animations": animations,
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(g.bin)
    with open(out, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A)); fh.write(js)
        fh.write(struct.pack("<II", len(g.bin), 0x004E4942)); fh.write(bytes(g.bin))
    print(f"wrote {out}: {total / 1024:.0f} KB, {len(meshes)} meshes, {len(animations)} animations")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "client", "public", "models", "avatar.glb"))
