# MOAP Vercel 免登录 + 荣誉详情修复

在当前 Vercel 项目的根目录（与 package.json、vercel.json 同级）覆盖：

- index.html
- app.js
- style.css
- build.mjs

并新增：

- honor-details.js

保留原来的：

- certified-data.js
- package.json
- vercel.json

Vercel 环境变量继续保留：

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

提交后重新部署。此版本不使用邮箱密码，打开网址直接进入；荣誉卡片可以点击查看规则、排名、公式和证据。
