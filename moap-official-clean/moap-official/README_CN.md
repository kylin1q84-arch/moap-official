# MOAP

五人麻将数据系统 · 实时分析

MOAP 使用原生 HTML、CSS、JavaScript。页面先显示仓库内的认证基线，再通过现有 Supabase 公开读取更新牌局、对位、纪录、状态与荣誉。生产数据库及其历史原始记录不由本仓库改写。

## 牌局编号与赛制

浏览器读取原始数据后，先根据牌局 ID 末尾数字统一为 `MOAPxxxx`，再进行 Source Data Correction 和规范档案合并。原始 Source ID 与对外规范档案 ID 分属不同序列；录入新牌局使用 Source 序列的最大号加一。

赛制包括常规局与巅峰赛。当前巅峰赛为 S1 `MOAP0005`、S2 `MOAP0042`、S3 `MOAP0073`。S2、S3 各有两段真实来源证据，详情可切换全场、上半场与下半场；S1 不生成不存在的半场数据。

## 荣誉

核心荣誉仅有：MOAP赛季总冠军（H001）、MOAP巅峰赛冠军（H002）、MOAP年度最有价值牌手（H003）。H002 只读取每赛季唯一巅峰赛规范档案的全场最终积分；并列最高分共同获奖，多场巅峰赛会报告数据异常而不擅自选取。

## 部署

`npm run build` 输出至 `dist`。Vercel 构建需提供 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。本轮不需要数据库迁移，也不改变公开云端读取方式。
