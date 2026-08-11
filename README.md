# GitHub Today

每天读取 GitHub Trending Today，并把仓库 README 整理为简洁的中文技术文章。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。

## 更新今日内容

在 `.env.local` 中填写：

```dotenv
GITHUB_TOKEN=
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
AI_MODEL=deepseek-v4-flash
HTTPS_PROXY=
```

如果浏览器通过本地代理访问 GitHub，而 Node.js 直连失败，请填写代理，例如：

```dotenv
HTTPS_PROXY=http://127.0.0.1:7897
```

然后运行：

```bash
npm run update
```

更新成功后，`data/today.json` 会被整批替换。当前版本只保存今日内容。

## 每天 8:07 更新

项目使用 GitHub Actions 在云端更新，不依赖本机开机或代理。

将项目上传到 GitHub 后，在仓库中打开：

```text
Settings → Secrets and variables → Actions → New repository secret
```

添加下面的 Secret：

```text
Name: DEEPSEEK_API_KEY
Secret: 你的 DeepSeek API Key
```

工作流位于 `.github/workflows/update-today.yml`，每天按 `Asia/Shanghai` 时区 08:07 运行，也可以在 Actions 页面手动执行。更新成功后只提交新的 `data/today.json`。
