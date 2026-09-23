#!/usr/bin/env python3
"""
程序生成三张材质位图（小样铂银复合膜、封口压纹带、会员证镭射膜），输出到 src/assets/texture/。

为什么是程序生成而不是生图模型：这三种材质本来就是规整的物理结构（拉丝、压纹、衍射光栅），
用周期函数构造能保证**无缝平铺**（每一项的频率都是画布尺寸的整数倍、卷积用 FFT 的周期边界），
固定随机种子即可复现，体积也小。它们仍是真实的位图材质，不是 CSS 渐变假装的。

用法：python3 scripts/gen-textures.py   （依赖 numpy + Pillow；只在更新材质时手动跑，产物入库）
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'texture')
SEED = 20260923


def periodic_blur(img, sx, sy):
    """周期边界的各向异性高斯模糊（FFT），保证左右、上下接缝连续。"""
    h, w = img.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    kernel = np.exp(-2 * (np.pi ** 2) * ((fx * sx) ** 2 + (fy * sy) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(img) * kernel))


def norm(a):
    a = a - a.mean()
    return a / (np.abs(a).max() + 1e-9)


def lowfreq(rng, h, w, cutoff):
    """周期低频噪声：白噪声在频域里只留低于 cutoff 的分量。"""
    n = rng.normal(size=(h, w))
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    mask = (np.sqrt(fx ** 2 + fy ** 2) <= cutoff).astype(float)
    return norm(np.real(np.fft.ifft2(np.fft.fft2(n) * mask)))


def to_rgb(lum, tint, offset=0.0):
    rgb = np.clip(lum[..., None] * np.array(tint)[None, None, :] + offset, 0, 1)
    return Image.fromarray((rgb * 255 + 0.5).astype(np.uint8))


def brushed(rng, h, w, amount=1.0):
    """水平拉丝：白噪声沿 x 长程模糊、沿 y 几乎不模糊，再叠一层更细的短丝。"""
    long = norm(periodic_blur(rng.normal(size=(h, w)), 48, 0.55))
    short = norm(periodic_blur(rng.normal(size=(h, w)), 9, 0.4))
    return norm(0.75 * long + 0.25 * short) * amount


def foil(rng, size=512):
    h = w = size
    y, x = np.mgrid[0:h, 0:w].astype(float)
    grain = brushed(rng, h, w)
    sheen = lowfreq(rng, h, w, 2.2)                       # 大片的柔和明暗起伏
    # 极细菱形压纹（周期 8px，512 整除）：凹凸图再按左上光源取方向导数，得到压纹的受光 / 背光
    p = 8.0
    bump = np.abs(np.sin(np.pi * (x + y) / p) * np.sin(np.pi * (x - y) / p)) ** 0.6
    shade = norm(np.roll(bump, 1, axis=1) - bump + np.roll(bump, 1, axis=0) - bump)
    # 零星的细划痕：稀疏亮点沿 x 拉长
    scratches = rng.random((h, w)) > 0.9985
    scratches = norm(periodic_blur(scratches.astype(float), 22, 0.35))
    lum = 0.60 + 0.075 * grain + 0.05 * sheen + 0.022 * shade + 0.035 * np.clip(scratches, 0, None)
    return to_rgb(lum, (0.95, 0.975, 1.03))


def crimp(rng, w=512, h=64, pitch=4.0):
    y, x = np.mgrid[0:h, 0:w].astype(float)
    phase = 2 * np.pi * x / pitch                          # 128 条压纹，512 整除，横向无缝
    ridge = 0.5 * (1 - np.cos(phase))                      # 圆润的凸肋
    light = np.sin(phase)                                   # 受光面 / 背光面
    grain = brushed(rng, h, w, 0.8)
    wobble = lowfreq(rng, h, w, 3.0)                        # 热封压力不均的轻微起伏
    lum = 0.56 + 0.10 * light + 0.05 * (ridge - 0.5) + 0.035 * grain + 0.03 * wobble
    return to_rgb(lum, (0.95, 0.975, 1.03))


def holo(rng, w=512, h=256):
    y, x = np.mgrid[0:h, 0:w].astype(float)
    u, v = x / w, y / h
    # 四组方向不同的衍射光栅（整数频率 → 无缝），用周期低频噪声分片混合，像一块块角度不同的光栅
    gratings = [(11, 3), (-7, 9), (4, -12), (13, 13)]
    fields = [2 * np.pi * (a * u + b * v) for a, b in gratings]
    masks = [np.exp(3.2 * lowfreq(rng, h, w, 2.6)) for _ in gratings]
    total = sum(masks)
    phase = sum(f * m for f, m in zip(fields, masks)) / total
    # 周期空间里的同心弧：到两个圆心的环面距离
    arcs = np.zeros((h, w))
    for cx, cy in ((0.3, 0.4), (0.78, 0.7)):
        dx = np.minimum(np.abs(u - cx), 1 - np.abs(u - cx)) * w
        dy = np.minimum(np.abs(v - cy), 1 - np.abs(v - cy)) * h
        arcs += np.cos(np.sqrt(dx ** 2 + dy ** 2) / 5.5)
    hue = (phase / (2 * np.pi) + 0.12 * arcs + 0.35 * lowfreq(rng, h, w, 1.6)) % 1.0
    # 克制的珍珠色：在五个淡色之间按色相插值，而不是整圈彩虹
    stops = np.array([
        [0.97, 0.95, 0.93],   # 珍珠白
        [0.70, 0.93, 0.85],   # 薄荷
        [0.83, 0.76, 0.97],   # 淡紫
        [0.99, 0.87, 0.70],   # 香槟金
        [0.72, 0.87, 0.99],   # 天蓝
    ])
    t = hue * len(stops)
    i0 = np.floor(t).astype(int) % len(stops)
    i1 = (i0 + 1) % len(stops)
    f = (t - np.floor(t))[..., None]
    rgb = stops[i0] * (1 - f) + stops[i1] * f
    fine = 0.035 * np.cos(2 * np.pi * (64 * u + 32 * v))                 # 细密衍射线，约 2px 一条
    sparkle = (rng.random((h, w)) > 0.9975).astype(float)
    sparkle = np.clip(periodic_blur(sparkle, 0.7, 0.7) * 6, 0, 1)
    lum = 1 + fine + 0.06 * arcs / 2 + 0.25 * sparkle
    rgb = np.clip(rgb * lum[..., None], 0, 1)
    return Image.fromarray((rgb * 255 + 0.5).astype(np.uint8))


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(SEED)
    jobs = [('foil.jpg', foil(rng), 78), ('foil-crimp.jpg', crimp(rng), 80), ('holo.jpg', holo(rng), 80)]
    for name, im, q in jobs:
        path = os.path.join(OUT, name)
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        print(f'{name} {im.size[0]}x{im.size[1]} {os.path.getsize(path) // 1024}KB')


if __name__ == '__main__':
    main()
