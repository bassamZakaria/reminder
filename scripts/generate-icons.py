#!/usr/bin/env python3
"""Draws the Recall app icon and writes every platform's icon set. Requires Pillow."""
import json
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
SUPERSAMPLE = 4
CANVAS = 1024 * SUPERSAMPLE
TOP = (255, 190, 70)
BOTTOM = (240, 138, 0)
LINE = (252, 210, 140)
BADGE = (240, 138, 0)


def gradient(size):
    img = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,))
    return img


def draw_glyph(img, inset, scale):
    w = CANVAS
    draw = ImageDraw.Draw(img)

    def point(x, y):
        return inset + x * w * scale, inset + y * w * scale

    x0, y0 = point(0.25, 0.20)
    x1, y1 = point(0.75, 0.80)
    radius = int(w * 0.07 * scale)
    shadow = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x0, y0 + w * 0.012 * scale, x1, y1 + w * 0.012 * scale], radius, fill=(120, 60, 0, 70))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(w * 0.01 * scale)))
    draw.rounded_rectangle([x0, y0, x1, y1], radius, fill=(255, 255, 255, 255))

    line = int(w * 0.035 * scale)
    for i, (a, b) in enumerate([(0.33, 0.60), (0.33, 0.67), (0.33, 0.52)]):
        y = point(0, 0.30 + i * 0.085)[1]
        draw.rounded_rectangle([point(a, 0)[0], y, point(b, 0)[0], y + line], line // 2, fill=LINE + (255,))

    cx, cy = point(0.60, 0.64)
    r = w * 0.135 * scale
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BADGE + (255,))
    stroke = int(w * 0.035 * scale)
    pts = [(cx - r * 0.45, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.38), (cx + r * 0.5, cy - r * 0.35)]
    draw.line(pts, fill=(255, 255, 255, 255), width=stroke, joint='curve')
    for x, y in (pts[0], pts[-1]):
        draw.ellipse([x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2], fill=(255, 255, 255, 255))


def full_bleed():
    img = gradient(CANVAS)
    draw_glyph(img, 0, 1)
    return img


def mac_shape():
    # macOS icons carry their own rounded-rect body and shadow inside a transparent canvas.
    w = CANVAS
    pad, radius = int(w * 0.098), int(w * 0.18)
    img = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    shadow = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + int(w * 0.012), w - pad, w - pad + int(w * 0.012)], radius, fill=(0, 0, 0, 90))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(w * 0.012)))
    mask = Image.new('L', (w, w), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, w - pad, w - pad], radius, fill=255)
    img.paste(gradient(w), (0, 0), mask)
    draw_glyph(img, pad, (w - 2 * pad) / w)
    return img


def android_foreground():
    # Adaptive icon foreground: glyph inside the 66% safe zone of a 108dp canvas, transparent elsewhere.
    img = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    inset = CANVAS * 0.17
    draw_glyph(img, inset, (CANVAS - 2 * inset) / CANVAS)
    return img


def save(img, path, size, rgb=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = img.resize((size, size), Image.LANCZOS)
    (out.convert('RGB') if rgb else out).save(path)


def main():
    ios_dir = os.path.join(ROOT, 'ios/Recall/Images.xcassets/AppIcon.appiconset')
    for name in os.listdir(ios_dir):
        if name.endswith('.png'):
            os.remove(os.path.join(ios_dir, name))
    save(full_bleed(), os.path.join(ios_dir, 'AppIcon-1024.png'), 1024, rgb=True)
    with open(os.path.join(ios_dir, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': 'AppIcon-1024.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}], 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)

    mac_dir = os.path.join(ROOT, 'macos/Recall-macOS/Assets.xcassets/AppIcon.appiconset')
    mac = mac_shape()
    images = []
    for points in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            name = f'icon_{points}x{points}{"@2x" if scale == 2 else ""}.png'
            save(mac, os.path.join(mac_dir, name), points * scale)
            images.append({'filename': name, 'idiom': 'mac', 'scale': f'{scale}x', 'size': f'{points}x{points}'})
    with open(os.path.join(mac_dir, 'Contents.json'), 'w') as f:
        json.dump({'images': images, 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)

    android_res = os.path.join(ROOT, 'android/app/src/main/res')
    if os.path.isdir(android_res):
        densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
        legacy = full_bleed()
        foreground = android_foreground()
        for density, factor in densities.items():
            folder = os.path.join(android_res, f'mipmap-{density}')
            save(legacy, os.path.join(folder, 'ic_launcher.png'), int(48 * factor))
            save(legacy, os.path.join(folder, 'ic_launcher_round.png'), int(48 * factor))
            save(foreground, os.path.join(folder, 'ic_launcher_foreground.png'), int(108 * factor))
        save(full_bleed(), os.path.join(ROOT, 'assets/icon/play-store-512.png'), 512, rgb=True)

    save(full_bleed(), os.path.join(ROOT, 'assets/icon/icon-1024.png'), 1024, rgb=True)


if __name__ == '__main__':
    main()
