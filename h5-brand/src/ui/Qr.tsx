// 二维码：永远画在纯白 #FFFFFF 上，四周留白不少于 4 个模块，纹理与色调不得侵入
import qrcode from 'qrcode-generator';
import { useMemo } from 'preact/hooks';

// 默认编码只取低 8 位，中文会乱码；统一按 UTF-8 编码
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

interface Props {
  payload: string;
  /** 渲染边长（px），不小于 168 */
  size?: number;
  label: string;
}

export function Qr({ payload, size = 200, label }: Props) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(payload, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
      }
    }
    return { d: path, n: count + 8 };
  }, [payload]);
  const px = Math.max(168, size);
  return (
    <svg
      class="qr"
      viewBox={`0 0 ${n} ${n}`}
      width={px}
      height={px}
      role="img"
      aria-label={label}
      shape-rendering="crispEdges"
    >
      <rect width={n} height={n} fill="#FFFFFF" />
      <path d={d} fill="#0B111E" />
    </svg>
  );
}
