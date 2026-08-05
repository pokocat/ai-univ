# 主理人

主理人公社会员小程序的可预览前端工程。源码从 `/Users/donis/dev/ai-society/apps/member-app` 的当前工作区提取；包含其最新本地设计改动。

## 预览

在仓库根目录执行：

```bash
./scripts/open-wechat-preview.sh 主理人
```

或在微信开发者工具中导入本目录。项目配置中的 `miniprogramRoot` 指向 `miniprogram/`。

小程序使用原 AppID 和接口配置；涉及登录、会员、支付及真实数据的页面需要相应的微信开发权限和后端环境。其余页面结构、样式、图片与前端交互均可直接在开发者工具中查看和调整。
