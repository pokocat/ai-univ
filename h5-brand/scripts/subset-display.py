# 展示字体子集化的字体侧工作：由 scripts/subset-display.mjs 调用，不单独使用。
#
# 输入是一份可变字体（Noto Sans SC，wght 100–900）与一份字符清单；输出一个静态字重的 WOFF2。
# 顺序是「先子集、后定字重」：源字体三万多个字形，先裁到几百个再做 instancer，快两个数量级。
#
# 用法：python3 subset-display.py --src <ttf> --text-file <utf8 文本> --weight 200 \
#         --family "Brand Display SC" --out <woff2>
# 标准输出是一行 JSON：{"bytes", "glyphs", "chars", "missing"}。
# missing 非空时照样写出文件，但由调用方决定失败——缺字不能静默变成回落到系统字体。
import argparse
import json
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# 字重 → 样式名（name 表 17 / 2 用）
STYLE = {
    100: 'Thin',
    200: 'ExtraLight',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'SemiBold',
    700: 'Bold',
}

# 保留的 name 记录：0 版权 / 1–6 族名与版本 / 13–14 许可证。
# 版权行里写着保留字体名 'Source'（OFL 第 3 条），改名后的族名刻意不含它。
KEEP_NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14]


def set_name(font, name_id, value):
    table = font['name']
    table.removeNames(nameID=name_id)
    table.setName(value, name_id, 3, 1, 0x409)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--text-file', required=True)
    ap.add_argument('--weight', type=int, required=True)
    ap.add_argument('--family', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    with open(a.text_file, encoding='utf-8') as fh:
        text = fh.read()
    wanted = sorted({ord(ch) for ch in text})

    font = TTFont(a.src)
    if 'fvar' not in font:
        raise SystemExit('源字体不是可变字体（缺 fvar），无法按字重取静态实例')
    axes = {ax.axisTag: ax for ax in font['fvar'].axes}
    wght = axes.get('wght')
    if wght is None or not (wght.minValue <= a.weight <= wght.maxValue):
        raise SystemExit(f'源字体的 wght 轴不含 {a.weight}')

    cmap = font.getBestCmap()
    missing = [chr(u) for u in wanted if u not in cmap]

    opts = subset.Options()
    opts.hinting = False  # 手机上靠系统抗锯齿，字节码对 CJK 展示字号没有收益
    opts.name_IDs = KEEP_NAME_IDS
    opts.name_languages = [0x409]
    opts.notdef_outline = True
    opts.drop_tables += ['BASE', 'vhea', 'vmtx', 'VORG', 'DSIG']
    opts.layout_features = ['kern', 'locl', 'ccmp', 'mark', 'mkmk']  # 横排展示只需要这些
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=wanted)
    sub.subset(font)

    font = instancer.instantiateVariableFont(font, {'wght': a.weight})
    for tag in ('STAT', 'fvar', 'avar', 'HVAR', 'MVAR', 'gvar', 'cvar'):
        if tag in font:
            del font[tag]
    # 256 以上的 name 记录只给 fvar / STAT 的轴与实例命名用，定成静态字重后已无人引用
    for rec in [r for r in font['name'].names if r.nameID >= 256]:
        font['name'].removeNames(nameID=rec.nameID)

    style = STYLE.get(a.weight, str(a.weight))
    fam = a.family
    ps = fam.replace(' ', '') + '-' + style
    regular = a.weight == 400
    set_name(font, 1, fam if regular else f'{fam} {style}')
    set_name(font, 2, 'Regular')
    set_name(font, 3, f'{ps};subset')
    set_name(font, 4, f'{fam} {style}')
    set_name(font, 6, ps)
    if regular:
        font['name'].removeNames(nameID=16)
        font['name'].removeNames(nameID=17)
    else:
        set_name(font, 16, fam)
        set_name(font, 17, style)
    font['OS/2'].usWeightClass = a.weight

    font.flavor = 'woff2'
    font.save(a.out)

    # 读回写出的文件核对实际覆盖，清单只写字体里真有的字
    check = TTFont(a.out)
    got = check.getBestCmap()
    covered = ''.join(chr(u) for u in sorted(got))
    import os

    json.dump(
        {
            'bytes': os.path.getsize(a.out),
            'glyphs': check['maxp'].numGlyphs,
            'chars': covered,
            'missing': ''.join(missing),
        },
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == '__main__':
    main()
