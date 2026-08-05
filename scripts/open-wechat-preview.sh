#!/usr/bin/env bash
set -euo pipefail

project_name="${1:-}"
case "$project_name" in
  主理人|温泉) ;;
  *)
    echo "用法: $0 {主理人|温泉}" >&2
    exit 1
    ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)/$project_name"
cli="${WECHAT_DEVTOOLS_CLI:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"

if [[ ! -x "$cli" ]]; then
  echo "未找到微信开发者工具 CLI：$cli" >&2
  echo "请安装微信开发者工具，或设置 WECHAT_DEVTOOLS_CLI 后重试。" >&2
  exit 1
fi

exec "$cli" open --project "$project_dir"
