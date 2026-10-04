#!/usr/bin/env python3
"""
Превращает HDRI-карту (например, с Poly Haven, формат .hdr или .exr) в карту отражений
для стекла: assets/img/glass-env.jpg.

Как пользоваться:
    pip install opencv-python-headless numpy
    python3 tools/make_glass_env.py путь/к/файлу.hdr
    python3 tools/make_glass_env.py путь/к/файлу.hdr --exposure 1.2 --yaw 90

Без аргументов (--demo) делает временную карту из нескольких софтбоксов —
чтобы стекло работало, пока настоящего HDRI нет.

Что делает скрипт:
  1. читает HDRI (линейные значения яркости);
  2. берёт горизонтальную полосу вокруг горизонта (в ней обычно свет студии);
  3. тон-маппингом превращает в обычную картинку, оставляя тёмный фон и яркие блики;
  4. убирает цвет: остаётся только яркость, подкрашенная фирменным кремовым (#EEE5D5);
  5. слегка размывает и сохраняет JPEG.
"""
import argparse
import os
import sys

os.environ.setdefault('OPENCV_IO_ENABLE_OPENEXR', '1')   # чтобы читать и .exr

import cv2
import numpy as np

CREAM = np.array([213, 229, 238], dtype=np.float32) / 255.0   # #EEE5D5 в порядке BGR
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'glass-env.jpg')


def demo_env(w=2048, h=1024):
    """Временная карта: тёмная студия с тремя софтбоксами и полом/потолком."""
    img = np.full((h, w, 3), 0.015, np.float32)
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    img += 0.05 * np.exp(-((yy - 0.5) / 0.12) ** 2)                 # слабое свечение у горизонта

    def box(cx, cy, bw, bh, power):
        x0, x1 = int((cx - bw / 2) * w), int((cx + bw / 2) * w)
        y0, y1 = int((cy - bh / 2) * h), int((cy + bh / 2) * h)
        img[y0:y1, x0:x1] += power

    box(0.12, 0.45, 0.07, 0.22, 14.0)    # высокий узкий софтбокс
    box(0.38, 0.40, 0.16, 0.10, 9.0)     # широкая полоса
    box(0.64, 0.50, 0.05, 0.30, 18.0)    # вертикальный блик
    box(0.86, 0.42, 0.12, 0.08, 7.0)
    return cv2.GaussianBlur(img, (0, 0), 14)      # мягкие края, как у настоящих софтбоксов


def load_hdri(path):
    """Читает .hdr через OpenCV, а .exr — через OpenEXR (pip install OpenEXR)."""
    env = None
    if path.lower().endswith('.exr'):
        env = cv2.imread(path, cv2.IMREAD_ANYCOLOR | cv2.IMREAD_ANYDEPTH)
        if env is None:
            try:
                import OpenEXR
            except ImportError:
                sys.exit('Для .exr нужна библиотека: pip install OpenEXR (или возьмите .hdr)')
            ch = OpenEXR.File(path).channels()
            rgb = ch['RGB'].pixels if 'RGB' in ch else np.dstack([ch[k].pixels for k in ('R', 'G', 'B')])
            env = rgb[..., ::-1]                                  # RGB -> BGR, как у OpenCV
    else:
        env = cv2.imread(path, cv2.IMREAD_ANYCOLOR | cv2.IMREAD_ANYDEPTH)
    if env is None:
        sys.exit('Не удалось открыть файл: ' + path)
    env = np.ascontiguousarray(env, dtype=np.float32)
    if env.ndim == 2:
        env = cv2.cvtColor(env, cv2.COLOR_GRAY2BGR)
    return env


def tonemap(lin, exposure):
    x = lin * exposure
    x = x / (1.0 + x)                       # Рейнхард: сжимаем яркие места
    x = np.clip(x, 0, 1) ** 1.35            # чуть темнее середину — блики остаются контрастными
    return x


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('hdr', nargs='?', help='файл .hdr или .exr; без него — временная карта')
    ap.add_argument('--demo', action='store_true', help='временная карта из софтбоксов')
    ap.add_argument('--exposure', type=float, default=1.0, help='яркость (по умолчанию 1.0)')
    ap.add_argument('--yaw', type=float, default=0.0, help='повернуть окружение по горизонтали, градусы')
    ap.add_argument('--band', type=float, default=34.0, help='полуширина полосы вокруг горизонта, градусы')
    ap.add_argument('--out', default=OUT, help='куда сохранить')
    a = ap.parse_args()

    if a.hdr and not a.demo:
        env = load_hdri(a.hdr)
    else:
        env = demo_env()

    h, w = env.shape[:2]
    if a.yaw:
        env = np.roll(env, int(a.yaw / 360.0 * w), axis=1)

    # Полоса вокруг горизонта: широта ±band градусов
    half = int(h * a.band / 180.0)
    env = env[h // 2 - half: h // 2 + half]

    # Яркость -> тон-маппинг -> кремовый оттенок
    lum = 0.114 * env[..., 0] + 0.587 * env[..., 1] + 0.299 * env[..., 2]
    lum = tonemap(lum, a.exposure)
    img = lum[..., None] * CREAM[None, None, :] * 1.05
    img = np.clip(img, 0, 1)

    # Размер и лёгкое размытие, как у матового стекла
    target_w = 1800
    scale = target_w / img.shape[1]
    img = cv2.resize(img, (target_w, max(1, int(img.shape[0] * scale))), interpolation=cv2.INTER_AREA)
    img = cv2.GaussianBlur(img, (0, 0), 3.0)

    out = os.path.abspath(a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cv2.imwrite(out, (img * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 82])
    print('Готово:', out, '%dx%d' % (img.shape[1], img.shape[0]), '(%d КБ)' % (os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
