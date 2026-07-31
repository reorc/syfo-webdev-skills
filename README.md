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

如果目标目录包含 `.syfo-managed.json`，它是 daemon 从某个正式 Release 安装的实体副本，
不会随本仓库工作树自动更新。开发调试时应先备份该目录，再改用指向当前仓库的软链；不要把
未发布的源码直接伪装成 daemon 管理版本。

## 生效链路

- 本地源码修改只影响当前仓库，不会自动影响 `~/.codex/skills/`、`~/.claude/skills/` 或测试机器。
- 本地开发可通过仓库软链验证新描述；重新启动 Agent 会话后才会重新发现 frontmatter。
- 测试人员使用的 daemon 内嵌版本必须先发布新的 `syfo-webdev-skills` tag/Release，再由
  `syfo-daemon` 流水线下载、校验并嵌入，最后安装或升级测试机 daemon。
- 验收时检查每个 skill 的 `.syfo-managed.json`，确认 `version` 和 `commit` 对应预期 Release；
  否则即使源码仓库已修改，模型仍会读取旧描述。

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
