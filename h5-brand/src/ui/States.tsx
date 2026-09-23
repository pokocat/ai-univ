// 空态与读取失败：空态必须说明下一步；失败要说清哪一块没读到、怎么重试
import type { ComponentChildren } from 'preact';

interface BlankProps {
  title: string;
  /** 必填：告诉访客下一步去哪 */
  hint: string;
  action?: ComponentChildren;
}

export function Blank({ title, hint, action }: BlankProps) {
  return (
    <div class="blank" role="status">
      <p class="blank__title">{title}</p>
      <p class="blank__hint">{hint}</p>
      {action && <div class="blank__action">{action}</div>}
    </div>
  );
}

interface FailProps {
  /** 哪一块没读到，例「课程排期」 */
  what: string;
  onRetry: () => void;
}

export function LoadFailure({ what, onRetry }: FailProps) {
  return (
    <div class="load-failure" role="alert">
      <p>
        <b>{what}</b>读取失败
      </p>
      <button type="button" class="btn btn--ghost" onClick={onRetry}>
        重试
      </button>
    </div>
  );
}
