# Vercel 构建修复

本版本在 `app/layout.tsx` 中加入：

```ts
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

MOAP 是登录后读取 Supabase 数据的动态应用，因此统一改为请求时渲染，避免 Vercel 在 `Generating static pages` 阶段预渲染登录/重定向路由。

部署：
1. 用本版本覆盖 GitHub 仓库中网站根目录的文件。
2. 确认 Vercel Root Directory 仍指向包含 `package.json` 的目录。
3. 确认两个环境变量存在。
4. 在 Deployments 中选择 Redeploy，并取消勾选 `Use existing Build Cache`（若页面显示该选项）。
