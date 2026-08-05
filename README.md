# AI Univ 协作总控仓库

这个仓库用于产品、设计与研发围绕多个独立项目协作。它本身只维护跨项目资料、协作约定，以及各项目子模块所引用的版本；每个业务项目保持独立仓库和独立提交历史。

## 目录约定

- `主理人/`：主理人项目子模块（待接入独立远程仓库）。
- `wenquan/`：wenquan 项目子模块（待接入独立远程仓库）。

## 使用方式

首次拉取总控仓库后，执行：

```bash
git clone --recurse-submodules https://github.com/pokocat/ai-univ.git
```

已有本地仓库时，执行：

```bash
git submodule update --init --recursive
```

设计师或产品经理在某个项目目录内工作、提交该项目自己的变更；总控仓库只在需要把该项目推进到新的已确认版本时，提交对应的子模块版本指针。

## 接入新项目

每个项目必须先有独立的 Git 远程仓库，之后从总控仓库根目录执行：

```bash
git submodule add <项目仓库地址> <项目目录名>
git commit -m "chore: add <项目名> submodule"
```

子模块地址将记录在 `.gitmodules`，由总控仓库统一管理。
