# MOAP Cloud v2（完整云端版）

这一版以原来的 `MOAP_Web_MVP_v1/index.html` 为母版，保留原有深绿金色界面和全部主要交互：

- 联赛总览、排行榜、个人档案、累计积分曲线
- 最近比赛、筛选搜索、四人局/五人局数据
- 对位净分矩阵、对位胜率矩阵
- 荣誉中心、GOAT、系统健康检查
- 管理员云端录入，积分合计与人数强制校验
- Supabase 邮箱密码登录；管理员可写，普通成员只读

## 数据来源

网页登录后会实时读取 Supabase 的 `players`、`seasons`、`matches`、`match_results`、`award_results`、`system_versions` 和当前账号 `profiles`。
`src/certified-data.js` 仅保留 v10.1 的认证说明与离线基线，不再作为比赛主数据库；页面实际排名和对位均由 Supabase 原始比赛记录重算。

## 你现有数据库不需要重做

原来的 5 名玩家、65 场比赛、325 条结果和登录账号全部保留。建议在 Supabase SQL Editor 运行一次：

`supabase/08_cloud_v2_upgrade.sql`

它只修复 RPC 与权限，不删除数据。

## Vercel 部署

1. 新建一个干净 GitHub 私有仓库，例如 `moap-cloud-v2`。
2. 上传本 ZIP 解压后的**内部全部文件**，确保仓库首页直接看到 `package.json`、`src`、`vercel.json`。
3. Vercel 导入仓库。Root Directory 保持 `./`。
4. 保留已有环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. 点击 Deploy。`vercel.json` 已固定 Build Command 和 Output Directory，不需要手动选择 Next.js，也不要填写 `public`。

## 登录权限

数据库 `profiles.role`：
- `admin`：可以录入比赛
- `viewer`：只能查看

罗海泓账号应绑定 `P001 / admin`。
