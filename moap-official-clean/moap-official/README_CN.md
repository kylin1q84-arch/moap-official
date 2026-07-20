# MOAP Official Free Edition v1.0

基于 `MOAP_Official_v10.1_LTS_Official.xlsx` 制作的正式云端项目，采用零成本方案：

- Next.js 16（网页）
- Supabase Free（数据库、账号登录、权限）
- GitHub Free（私有源代码仓库）
- Vercel Hobby（免费发布与 `*.vercel.app` 网址）

## 已包含

- 65场历史比赛、325条逐人成绩迁移SQL
- 五名玩家档案
- 登录与管理员/普通成员权限
- 生涯积分榜、赛季数据、比赛中心、玩家详情
- 正式比赛录入：人数校验、总分必须为0、自动并列MVP
- v10.1荣誉快照与动态GOAT指数
- RLS安全策略和审计日志

## 部署顺序

详细步骤见 `DEPLOY_STEP_BY_STEP.md`。最短流程：

1. 创建Supabase免费项目。
2. 在SQL Editor依次运行 `supabase/01` 到 `07`。
3. 把本项目上传到GitHub私有仓库。
4. Vercel导入GitHub仓库。
5. 设置两个环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. 点击Deploy。

## 本地运行（可选）

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 重要安全说明

- 不要把Supabase密码、数据库密码或Secret Key提交到GitHub。
- 浏览器和Vercel只填写Publishable Key，不填写Secret Key。
- 源代码建议使用GitHub私有仓库。
- 正式数据写入只允许通过数据库RPC，网页端不能绕过校验直接修改比赛表。

## 当前范围

荣誉中心使用v10.1 LTS认证快照；GOAT指数会依据荣誉积分、生涯MVP和赛季冠军动态计算。后续新增S4比赛会实时更新基础数据和GOAT中的MVP部分；完整S4赛季荣誉需要在赛季结束时执行下一版荣誉引擎。
