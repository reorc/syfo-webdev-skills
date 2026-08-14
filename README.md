# Syfo WebDev Skills

Syfo Hosted App 的官方 Web 开发 Skills：

- `syfo-webdev`：新建与维护 `web-unified` App 的统一入口；新建时只接受显式 `site+none` 或 `app+tidb`。
- `syfo-webdev-static`：构建可静态导出的 Next.js Hosted App。
- `syfo-webdev-fullstack`：构建带服务端运行时、鉴权和数据库的 Next.js Hosted App。

后两者是 legacy 兼容入口；已存在的旧 static/fullstack App 继续走原目录和原流程，不会被
`syfo-webdev` 自动迁移、启用数据库或部署。本仓库是这三个 Skill 的唯一源码真源。`syfo-daemon` 的发布流水线从本仓库最新的
GitHub Release 下载经过 checksum 校验的压缩包，并把该版本嵌入 daemon 二进制。

## 本地安装

```bash
ln -s "$PWD/syfo-webdev-static" ~/.codex/skills/syfo-webdev-static
ln -s "$PWD/syfo-webdev-fullstack" ~/.codex/skills/syfo-webdev-fullstack
ln -s "$PWD/syfo-webdev" ~/.codex/skills/syfo-webdev
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

官方 `web-static` 模板升级后，额外运行一次跨仓库 canary。该命令会复制模板到临时目录，
使用模板声明的 npm 10 版本执行全新安装、lint、typecheck、test、Next.js build、artifact
检查和静态 smoke，不会把这套流程加入普通 Agent 部署：

```bash
npm run test:static-template-canary -- \
  --template /path/to/web-static-template
```

本地模板已经完成 frozen install 时，可用 `--reuse-install` 快速复验现有 checkout；正式 CI
应省略该参数以验证干净安装。

Fullstack 官方模板使用对应 runner；它额外检查 standalone artifact budget，并在不连接数据库
的条件下验证生产 server 能启动和提供登录入口：

```bash
npm run test:fullstack-template-canary -- \
  --template /path/to/web-fullstack-template
```

## 发布

推送 `v*` tag 后，GitHub Actions 会运行验证并发布三个资产：

- `syfo-webdev-skills.tar.gz`
- `manifest.json`
- `checksums.txt`

压缩包顶层固定包含 `syfo-webdev/`、`syfo-webdev-static/` 和 `syfo-webdev-fullstack/`。release
manifest 同时声明 daemon-owned `.syfo-managed.json` marker 合同；marker 由 daemon 安装时写入，
不得预置在压缩包中。daemon 构建只接受
checksum 匹配且目录结构完整的 Release。

```bash
git tag v0.1.0
git push origin v0.1.0
```
