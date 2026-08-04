# Single-HTML preserve fast path

Use this path when the user provides one HTML file, or one HTML file plus local assets, and asks to publish it as a Syfo website without login, private secrets, APIs, server rendering, durable writes, or a database.

## Goal

Preserve the page and reach the deployment confirmation card with the fewest justified changes and checks. The Syfo static deployment contract still uses the official Next.js export template and FC static adapter; the source page does not need to be redesigned as a React application.

## Source audit

1. Confirm the intended HTML entry file and application name.
2. Inventory relative stylesheets, scripts, images, fonts, audio, video, and downloads.
3. Check for absolute local paths, missing files, private credentials, server calls, form backends, and request-time assumptions.
4. Classify frontend scope as `preserve` unless the user requested a redesign or the page is unusable at a narrow viewport.
5. Escalate to `syfo-webdev-fullstack` only for a concrete backend requirement, not because the user said "App", "deploy", "上线", or "Syfo".

## Minimal migration

- Keep the original HTML file source-controlled as the migration reference.
- Preserve DOM order, classes, IDs, anchors, copy, inline styles, and local asset filenames where compatible.
- Integrate the page into the official static template with the fewest changed files needed to export `/index.html`.
- Do not introduce a content schema, parser/extractor module, component decomposition, state library, database, API route, or test framework unless the source behavior requires it.
- Move only incompatible document-level metadata, styles, or scripts into the corresponding minimal template location. Record any behavior that could not be preserved exactly.
- Fix only deployment blockers and high-confidence mobile overflow or accessibility defects; do not broaden a deployment request into a redesign.

## Fast validation lane

Run each expensive gate once unless code changes afterward:

1. Skill doctor.
2. Frozen install when the matching dependency state is not already proven.
3. One production build and artifact assembly.
4. Static smoke for health, root, and real 404 behavior; add Range smoke only when audio or video exists.
5. Browser acceptance at one representative desktop width and about 390 px, plus one representative anchor or interaction when present.
6. `syfo app validate --json`.
7. Immutable commit, push, and authorized deploy preparation.

Do not separately run broad lint, typecheck, or test suites for untouched scaffold code when the production build already validates the minimal wrapper and repository instructions do not require them. Run focused checks when JavaScript/TypeScript logic, dependencies, runtime files, forms, or media behavior changed.

## Routing examples

Static:

- "我本机有一个 HTML，原样部署成 Syfo 网站。"
- "把这个单页作品集上线，不需要登录、API 或数据库。"
- "Deploy this self-contained HTML page as a public Hosted App."

Fullstack:

- "HTML 表单要用服务器密钥提交到私有 API。"
- "登录后保存每个用户的数据到 TiDB。"
- "页面内容必须根据 Cookie 或请求头实时渲染。"
