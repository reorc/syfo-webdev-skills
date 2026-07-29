# Syfo WebDev Skills

Syfo Hosted App 的官方 Web 开发 Skills：

- `syfo-webdev-static`：构建可静态导出的 Next.js Hosted App。
- `syfo-webdev-fullstack`：构建带服务端运行时、鉴权和数据库的 Next.js Hosted App。

本仓库是这两个 Skill 的唯一源码真源。`syfo-daemon` 的发布流水线从本仓库最新的
GitHub Release 下载经过 checksum 校验的压缩包，并把该版本嵌入 daemon 二进制。

## 本地安装

```bash
ln -s "$PWD/syfo-webdev-static" ~/.codex/skills/syfo-webdev-static
ln -s "$PWD/syfo-webdev-fullstack" ~/.codex/skills/syfo-webdev-fullstack
```

Claude Code 使用对应的 `~/.claude/skills/` 目录。

## 验证

```bash
npm test
```

## 发布

推送 `v*` tag 后，GitHub Actions 会运行验证并发布三个资产：

- `syfo-webdev-skills.tar.gz`
- `manifest.json`
- `checksums.txt`

压缩包顶层固定包含 `syfo-webdev-static/` 和 `syfo-webdev-fullstack/`。daemon 构建只接受
checksum 匹配且目录结构完整的 Release。

```bash
git tag v0.1.0
git push origin v0.1.0
```

