"""Original chiptune soundtrack + sound effects for the promo video, synthesised from scratch (no samples, no licences).
usage: python video/make_audio.py  -> video/assets/audio/promo_music.wav (60 s, 44.1 kHz stereo)

Timing matches the scene layout in video/build_promo.jsx (SCENES).
"""
import os
import wave
import numpy as np

SR = 44100
DUR = 60.0
BPM = 120
BEAT = 60 / BPM          # 0.5 s
BAR = 4 * BEAT           # 2 s
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "assets", "audio", "promo_music.wav")

# scene cut times (seconds), shared with the AE script
CUTS = [4.5, 12.0, 18.0, 24.5, 38.0, 47.0, 53.0]
CARD_TIMES = [25.5 + 2.0 * i for i in range(6)]
SLOT_TIMES = [18.9 + 0.22 * i for i in range(12)]

mix_l = np.zeros(N)
mix_r = np.zeros(N)


def note_hz(n):
    """MIDI note -> Hz"""
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.005, d=0.08, s=0.6, r=0.05):
    t = np.arange(n) / SR
    total = n / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / a
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / d
    rel = t > total - r
    e[rel] *= np.clip((total - t[rel]) / r, 0, 1)
    return e


def square(f, n, duty=0.5, vib=0.0):
    t = np.arange(n) / SR
    ph = f * t + (vib * np.sin(2 * np.pi * 5.5 * t) / 5.5 if vib else 0)
    return np.where((ph % 1.0) < duty, 1.0, -1.0)


def triangle(f, n):
    t = np.arange(n) / SR
    return 2 * np.abs(2 * ((f * t) % 1.0) - 1) - 1


rng = np.random.default_rng(7)


def noise(n):
    return rng.uniform(-1, 1, n)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):  # short clips only
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0]
    l = gain * (1 - max(0, pan))
    r = gain * (1 + min(0, pan))
    mix_l[i0:i0 + len(sig)] += sig * l
    mix_r[i0:i0 + len(sig)] += sig * r


def tone(kind, midi, t0, dur, gain, pan=0.0, duty=0.5, vib=0.0, adsr=(0.004, 0.08, 0.55, 0.04)):
    n = int(dur * SR)
    f = note_hz(midi)
    w = square(f, n, duty, vib) if kind == "sq" else triangle(f, n)
    add(w * env(n, *adsr), t0, gain, pan)


# ---------------- music ----------------
# progression C - Am - F - G, one chord per bar; in the trophy section it modulates up to D - Bm - G - A
PROG = [(60, [0, 4, 7]), (57, [0, 3, 7]), (53, [0, 4, 7]), (55, [0, 4, 7])]
# melody per chord as scale steps from the chord root (8 eighth notes per bar, None = rest)
MEL = [
    [12, None, 16, 19, 16, None, 12, 14],
    [12, None, 15, 19, 15, 12, None, 10],
    [12, 14, 16, None, 19, 16, 14, None],
    [14, None, 17, 19, 21, 19, 17, 14],
]
MEL_B = [
    [19, 16, 12, 16, 19, None, 24, None],
    [19, 15, 12, 15, 19, None, 22, None],
    [21, 19, 16, 19, 21, None, 24, None],
    [19, 17, 14, 17, 19, 21, 23, None],
]


def bar_music(bar_idx, t0, shift=0, energy=1.0, intro=False, mel=MEL):
    root, chord = PROG[bar_idx % 4]
    root += shift
    e8 = BEAT / 2
    if intro:
        # soft arpeggio only
        for k in range(8):
            n = root + 12 + chord[k % 3] + (12 if k >= 6 else 0)
            tone("sq", n, t0 + k * e8, e8 * 0.9, 0.05, pan=0.3 * (1 if k % 2 else -1), duty=0.25)
        tone("tri", root - 12, t0, BAR * 0.95, 0.12, adsr=(0.01, 0.3, 0.7, 0.2))
        return
    # bass: root/fifth eighths
    for k in range(8):
        n = root - 12 + (7 if k % 4 == 2 else 0) + (12 if k % 4 == 3 else 0)
        tone("tri", n, t0 + k * e8, e8 * 0.85, 0.2 * energy, adsr=(0.003, 0.05, 0.7, 0.03))
    # arpeggio pad
    for k in range(8):
        n = root + 12 + chord[k % 3]
        tone("sq", n, t0 + k * e8, e8 * 0.6, 0.035 * energy, pan=0.4 * (1 if k % 2 else -1), duty=0.125)
    # lead
    line = mel[bar_idx % 4]
    for k, step in enumerate(line):
        if step is None:
            continue
        tone("sq", root + step, t0 + k * e8, e8 * 0.92, 0.075 * energy, duty=0.5, vib=0.004)
        tone("sq", root + step, t0 + k * e8 + 0.09, e8 * 0.8, 0.02 * energy, pan=-0.6, duty=0.5)  # echo
    # drums
    for b in range(4):
        tb = t0 + b * BEAT
        if b in (0, 2):  # kick: pitch-dropping sine
            n = int(0.16 * SR)
            t = np.arange(n) / SR
            kick = np.sin(2 * np.pi * (150 * np.exp(-t * 28) + 45) * t) * np.exp(-t * 18)
            add(kick, tb, 0.45 * energy)
        else:  # snare: noise burst
            n = int(0.14 * SR)
            sn = noise(n) * np.exp(-np.arange(n) / SR * 26)
            add(sn, tb, 0.13 * energy)
        for h in range(2):  # hats on eighths
            n = int(0.03 * SR)
            hh = np.diff(noise(n + 1)) * np.exp(-np.arange(n) / SR * 120)
            add(hh, tb + h * BEAT / 2, 0.05 * energy, pan=0.25)


t = 0.0
bar = 0
while t < DUR - 0.01:
    if t < 4.0:
        bar_music(bar, t, intro=True)
    elif 38.0 <= t < 46.0:
        bar_music(bar, t, shift=2, energy=1.15, mel=MEL_B)   # brighter for the achievement
    elif t >= 54.0:
        pass  # ending jingle below
    else:
        bar_music(bar, t, mel=MEL_B if (bar // 4) % 2 else MEL)
    t += BAR
    bar += 1

# ---------------- sound effects ----------------


def sfx_arp(t0, notes, step=0.06, gain=0.09, duty=0.5, length=0.09):
    for i, n in enumerate(notes):
        tone("sq", n, t0 + i * step, length, gain, duty=duty)


def sfx_coin(t0):
    tone("sq", 83, t0, 0.07, 0.08, duty=0.5)
    tone("sq", 88, t0 + 0.07, 0.25, 0.08, duty=0.5, adsr=(0.002, 0.05, 0.5, 0.15))


def sfx_whoosh(t0, dur=0.45, gain=0.12):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = noise(n) * np.sin(np.pi * tt / dur) ** 2
    add(lowpass(x, 2500), t0 - dur * 0.6, gain)


def sfx_blip(t0, n=76):
    tone("sq", n, t0, 0.05, 0.06, duty=0.25)


sfx_arp(3.85, [72, 76, 79, 84, 88], step=0.05, gain=0.08)          # PRESS START
for c in CUTS:
    sfx_whoosh(c)
sfx_blip(5.3, 79)                                                  # player select
for i, ts in enumerate(SLOT_TIMES):                               # inventory items
    sfx_blip(ts, 72 + (i % 6) * 2)
for ct in CARD_TIMES:                                              # quest cards
    sfx_coin(ct + 0.35)
sfx_arp(38.55, [67, 71, 74, 79, 83, 86, 91], step=0.07, gain=0.09)  # achievement unlocked
sfx_arp(39.1, [79, 83, 86, 91], step=0.12, gain=0.06, duty=0.25)
sfx_arp(42.6, [67, 71, 74, 79, 83, 86, 91], step=0.07, gain=0.09)  # second achievement
sfx_arp(43.15, [79, 83, 86, 91], step=0.12, gain=0.06, duty=0.25)
for k in range(3):                                                 # power-ups
    sfx_arp(47.6 + k * 0.8, [64 + k * 2, 71 + k * 2, 76 + k * 2], step=0.05, gain=0.06)

# ending jingle (C major fanfare) and a final chord
fan = [(72, 0.0, 0.15), (76, 0.15, 0.15), (79, 0.3, 0.15), (84, 0.45, 0.45), (79, 0.95, 0.15), (84, 1.1, 1.2)]
for n, dt, d in fan:
    tone("sq", n, 54.0 + dt, d, 0.09, vib=0.004)
    tone("tri", n - 24, 54.0 + dt, d, 0.18)
for n in [60, 64, 67, 72]:
    tone("sq", n, 55.6, 3.2, 0.035, duty=0.25, adsr=(0.01, 0.4, 0.5, 1.5))
tone("tri", 48, 55.6, 3.4, 0.22, adsr=(0.01, 0.4, 0.6, 1.5))
sfx_arp(57.2, [84, 88, 91, 96], step=0.08, gain=0.05, duty=0.25)

# ---------------- master ----------------
mix = np.stack([mix_l, mix_r], axis=1)
# gentle fades
fade_in = int(0.3 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
fade_out = int(1.5 * SR)
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
# soft clip and normalise to -1 dBFS
mix = np.tanh(mix * 1.4)
mix *= 0.89 / np.max(np.abs(mix))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", OUT, f"{DUR:.0f}s")
