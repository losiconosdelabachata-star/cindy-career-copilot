"""Generates the app icons and launch screens from the Cindy logo (assets/logo-badge.png, assets/logo-full.png)
into native-app/resources/{android,ios}. Re-run only if the logo changes:  python tools/make-resources.py"""
import os, glob
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'native-app', 'resources')
badge = Image.open(os.path.join(ROOT, 'assets', 'logo-badge.png')).convert('RGBA')
full = Image.open(os.path.join(ROOT, 'assets', 'logo-full.png')).convert('RGBA')
BG = (238, 242, 245, 255)

def fit(img, box_w, box_h):
    r = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)

def centered(canvas_size, img, bg, scale=1.0):
    c = Image.new('RGBA', canvas_size, bg)
    s = fit(img, int(canvas_size[0] * scale), int(canvas_size[1] * scale))
    c.alpha_composite(s, ((canvas_size[0] - s.width) // 2, (canvas_size[1] - s.height) // 2))
    return c

# ---------- Android launcher icons ----------
RES = os.path.join(ROOT, 'native-app', 'android-res-template')   # structure only; actual res dir is created by cap add
legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
fore = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for d in legacy:
    p = os.path.join(OUT, 'android', f'mipmap-{d}'); os.makedirs(p, exist_ok=True)
    s = legacy[d]
    sq = centered((s, s), badge, (255, 255, 255, 255), 0.92)
    sq.convert('RGB').save(os.path.join(p, 'ic_launcher.png'), optimize=True)
    rd = sq.copy(); mask = Image.new('L', (s, s), 0); ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0)); out.paste(rd, (0, 0), mask); out.save(os.path.join(p, 'ic_launcher_round.png'), optimize=True)
    f = fore[d]
    centered((f, f), badge, (0, 0, 0, 0), 0.60).save(os.path.join(p, 'ic_launcher_foreground.png'), optimize=True)

# ---------- Android splash screens (same sizes the template ships) ----------
tpl = os.path.join(ROOT, 'native-app', 'android', 'app', 'src', 'main', 'res')
for f in glob.glob(os.path.join(tpl, 'drawable*', 'splash.png')):
    rel = os.path.relpath(f, tpl)
    w, h = Image.open(f).size
    dst = os.path.join(OUT, 'android', rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
    centered((w, h), full, BG, 0.5 if h >= w else 0.32).convert('RGB').save(dst, optimize=True)

# ---------- iOS icon + splash ----------
S = 1024
icon = centered((S, S), badge, (255, 255, 255, 255), 0.82).convert('RGB')
os.makedirs(os.path.join(OUT, 'ios'), exist_ok=True)
icon.save(os.path.join(OUT, 'ios', 'AppIcon-1024.png'), optimize=True)
Z = 2732
centered((Z, Z), full, BG, 0.55).convert('RGB').save(os.path.join(OUT, 'ios', 'splash-2732.png'), optimize=True)
print('resources written to', OUT)
