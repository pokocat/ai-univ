# AI Univ 协作总控仓库

这个仓库用于产品、设计与研发围绕多个项目协作。它采用 monorepo：跨项目资料、项目代码和设计资产都由这个仓库统一管理、统一提交。

## 目录约定

- `主理人/`：主理人项目。
- `温泉/`：温泉项目。
- `h5-expo/`：北京国际美博会观众预登记 H5，包含展会首页、登记、入场证与论坛报名。
- `h5-liren/`：丽人公社 H5，包含消息、社群、AI 军师、诊断报告、会员与门店经营台。
- `h5-admin/`：统一运营后台 H5（桌面端），包含工作台、活动、运营计划、渠道、参展商、订单与分账、社群与 AI 七个视图。
- `AGENTS.md`：供 Codex 等 AI 助手读取的项目地图、修改边界和验证命令。
- `.github/CODEOWNERS`：目录审核责任人。当前由仓库主理人统一审核；后续可按项目指定设计师、产品经理和研发负责人。

## 使用方式

首次拉取仓库后，执行：

```bash
git clone https://github.com/pokocat/ai-univ.git
```

设计师或产品经理只在对应项目目录内改动并创建 Pull Request；所有变更均提交到这个仓库。跨项目的规范、共享资产和说明放在仓库根目录或后续约定的共享目录中。

### 只拉取一个项目

不需要完整工作区时，可以使用 sparse checkout：

```bash
git clone --filter=blob:none --sparse https://github.com/pokocat/ai-univ.git
cd ai-univ
git sparse-checkout set 主理人
```

将最后一行改为 `温泉`，即可只拉取温泉项目。Git 历史和权限仍由同一个仓库统一管理。

其他项目同理，例如只拉取三个纯静态 H5：

```bash
git sparse-checkout set h5-expo h5-liren h5-admin
```

## H5 本地预览

`h5-expo/`、`h5-liren/` 和 `h5-admin/` 都是无构建、无依赖的纯静态工程。`h5-expo` 与 `h5-liren` 会互相跳转并通过同源 `localStorage` 共享演示状态，因此建议在仓库根目录统一启动：

```bash
cd ai-univ
python3 -m http.server 8765
```

浏览器访问：

- 展会预登记：`http://localhost:8765/h5-expo/`
- 丽人公社：`http://localhost:8765/h5-liren/`
- 统一运营后台（桌面端，≥960px）：`http://localhost:8765/h5-admin/`
- 演示话术模式：在地址末尾加 `?script=1`

推荐使用浏览器手机视图，画布选择 iPhone 390×844。具体页面、交互和演示口径见两个目录内各自的 `README.md`。

## 新增项目

在仓库根目录创建一个新的项目目录并提交即可。不要在项目目录内初始化嵌套 Git 仓库，以免它脱离 monorepo 的统一版本管理。

## 协作规则

- 一个 Pull Request 尽量只涉及一个项目目录或一项共享规范。
- 项目目录内的改动由该目录的责任人审核；跨项目改动由仓库主理人审核。
- 设计源文件、交付资源和产品说明与其所属项目放在同一项目目录内，避免依赖个人电脑路径。
