# 0元上线操作手册

## A. 注册三个免费账户

建议三个平台使用同一个邮箱注册，并开启双重验证：

1. GitHub
2. Supabase
3. Vercel

域名暂时不买，使用Vercel免费网址。

## B. 创建Supabase项目

1. 登录Supabase，点击New project。
2. 项目名可填写 `moap-official`。
3. 数据库密码请自己保存，不要发送给任何人。
4. Region选择离你们较近的区域。
5. 等待项目创建完成。

## C. 建数据库并导入v10.1数据

进入 Supabase → SQL Editor → New query，按顺序复制并运行：

1. `supabase/01_schema.sql`
2. `supabase/02_views.sql`
3. `supabase/03_functions.sql`
4. `supabase/04_seed.sql`
5. `supabase/05_rls.sql`
6. `supabase/06_verify.sql`

验证结果应为：5名玩家、65场比赛、325条成绩；罗海泓总分440、GOAT指数154。

## D. 创建五个登录账号

1. Supabase → Authentication → Users。
2. 为五个人各创建一个邮箱密码账号。
3. 运行 `supabase/07_link_accounts_template.sql` 前，先把里面5个占位邮箱改成真实邮箱。
4. 罗海泓设为唯一admin，其余设为viewer。
5. 五个账号创建完后，关闭公开Sign up，只保留登录。

## E. 上传到GitHub

最简单方式：

1. GitHub点击New repository。
2. 仓库名：`moap-official`。
3. 选择Private。
4. 解压本ZIP，把全部文件上传到仓库根目录。
5. 确认没有上传 `.env.local`。

## F. Vercel免费部署

1. 登录Vercel，使用GitHub授权。
2. Add New → Project。
3. Import `moap-official` 仓库。
4. Framework会自动识别Next.js。
5. Environment Variables添加：
   - `NEXT_PUBLIC_SUPABASE_URL`：Supabase Connect面板中的Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase Connect面板中的Publishable key
6. 点击Deploy。
7. 完成后会获得类似 `moap-official.vercel.app` 的免费网址。

## G. 首次验收

- 五个账号均可登录。
- 普通成员看不到“录入比赛”。
- 罗海泓账号能进入录入页面。
- 榜单数据与Excel v10.1一致。
- 测试录入前先在Supabase备份；测试记录可在SQL Editor删除后重试。

## H. 免费方案注意事项

- 你们只有5个人，免费额度足够。
- 为防项目长期无访问被暂停，平时正常登录使用即可。
- 每月导出一次数据库数据，并保留最新版Excel作为离线官方档案。
