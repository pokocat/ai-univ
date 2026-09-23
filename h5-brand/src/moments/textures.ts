// 材质位图：小样的铂银复合膜、封口压纹带与会员证的镭射膜，都是产出的位图（src/assets/texture/），
// 不再用 CSS 条纹或彩虹渐变去仿。
// 文件还没落地时 glob 取不到、各处退回平印铂色（不画假材质），落地后不改代码即生效。
// 位图经 CSS 自定义属性交给样式表：--tex-<名字>: url("…")，样式里写 var(--tex-<名字>, none)。
const FILES = import.meta.glob('../assets/texture/*.{jpg,webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export type TextureName = 'foil' | 'foil-crimp' | 'holo';

export function texture(name: TextureName): string | undefined {
  for (const ext of ['webp', 'jpg', 'png']) {
    const url = FILES[`../assets/texture/${name}.${ext}`];
    if (url) return url;
  }
  return undefined;
}

/** 把取得到的材质写成行内样式里的自定义属性；取不到的不写，样式表按 none 回落 */
export function textureVars(names: TextureName[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names) {
    const url = texture(n);
    if (url) out[`--tex-${n}`] = `url("${url}")`;
  }
  return out;
}
