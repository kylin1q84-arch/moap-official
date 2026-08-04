export const HONOR_CATALOG = [
  {
    honorId:"H001", name:"MSL总冠军", grade:"A", category:"最高荣誉", points:20,
    unit:"综合分", allowTie:false,
    rule:"采用综合评分制：单赛季总积分40%、MVP场次20%、正分率10%、最长连庄10%、BGR指数10%、累计统治分差10%。累计统治分差仅统计大胜或独赢场次，每场按本人积分减去其他实际参赛牌手平均积分计算；同一场同时满足两类条件时只计一次。综合分相同后依次比较六项原始指标，仍完全相同则暂不颁发。"
  },
  {
    honorId:"H003", name:"MSL年度最有价值牌手", grade:"A", category:"最高荣誉", points:20,
    unit:"综合分", allowTie:false,
    rule:"采用综合评分制：单赛季MVP场次30%、MVP场次累计积分30%、最长连续MVP场次15%、MVP场次BGR指数15%、MVP场次单场最高积分5%、MVP率5%。综合分相同后依次比较六项原始指标，仍完全相同则暂不颁发。"
  },
  {
    honorId:"H011", name:"四人局之王", grade:"B", category:"专项能力", points:5,
    unit:"分", allowTie:false,
    rule:"依次比较：单赛季四人局总积分、四人局MVP场次、四人局正分率。至少参加1场四人局。"
  },
  {
    honorId:"H012", name:"五人局之王", grade:"B", category:"专项能力", points:5,
    unit:"分", allowTie:false,
    rule:"依次比较：单赛季五人局总积分、五人局MVP场次、五人局正分率。至少参加1场五人局。"
  },
  {
    honorId:"H005", name:"稳定先生", grade:"B", category:"专项能力", points:5,
    unit:"%", allowTie:false,
    rule:"依次比较：单赛季正分率、正分场次累计积分、正分场次场均积分；0分计为正分，缺席不计。"
  },
  {
    honorId:"H007", name:"铁人奖", grade:"B", category:"专项能力", points:5,
    unit:"场", allowTie:true,
    rule:"依次比较：单赛季实际参赛场次、最长连续参赛纪录；全部条件相同允许并列。"
  },
  {
    honorId:"H010", name:"独赢王", grade:"B", category:"专项能力", points:5,
    unit:"场", allowTie:false,
    rule:"独赢指本人积分≥0且同场其他所有实际参赛牌手均＜0。依次比较：独赢场次、独赢场次累计积分、独赢场次场均积分。全员均为0次则不颁发。"
  },
  {
    honorId:"H008", name:"大场面先生", grade:"B", category:"专项能力", points:5,
    unit:"BGR", allowTie:false,
    rule:"依次比较：单赛季BGR指数、单场最高积分、最长连续大场面纪录。大场面为单场积分≥50；BGR档位50–59/60–69/70–79/80–89/90–99/100+，权重1/2/3/5/8/12。"
  },
  {
    honorId:"H016", name:"大胜专家", grade:"B", category:"专项能力", points:5,
    unit:"场", allowTie:false,
    rule:"大胜场次＝本人单场积分－其他实际参赛牌手单场平均积分≥100，每场最多计1次。依次比较：大胜场次、这些场次累计统治分差、单场最大统治分差。全员均为0次则不颁发。"
  },
  {
    honorId:"H006", name:"连庄王", grade:"B", category:"专项能力", points:5,
    unit:"场", allowTie:false,
    rule:"依次比较：最长连续正分纪录、该最长阶段累计积分、连庄总次数。0分延续；缺席不增加也不中断；负分中断。连庄总次数为每段连续正分中第二场起的延续次数。"
  },
  {
    honorId:"H021", name:"翻车王", grade:"C", category:"趣味荣誉", points:0,
    unit:"场", allowTie:false,
    rule:"依次比较：单赛季积分≤-40的场次、这些场次累计积分更低、这些场次最低单场积分更低。全员均为0次则不颁发。"
  },
  {
    honorId:"H017", name:"提款机", grade:"C", category:"趣味荣誉", points:0,
    unit:"分", allowTie:false,
    rule:"依次比较：单赛季总积分更低、正分率更低、单场最低积分更低。"
  },
  {
    honorId:"H019", name:"鸽王", grade:"C", category:"趣味荣誉", points:0,
    unit:"场", allowTie:true,
    rule:"依次比较：单赛季实际参赛场次更少、最长连续缺席纪录更高；全部条件相同允许并列。"
  },
  {
    honorId:"H018", name:"过山车奖", grade:"C", category:"趣味荣誉", points:0,
    unit:"分", allowTie:false,
    rule:"第一条件：单赛季累计积分最大波动幅度＝累计积分最高值－累计积分最低值，累计曲线包含赛季开始的0分起点；第二条件：单场最高积分－单场最低积分；第三条件：累计积分正负转换次数，累计积分回到0不单独计转换。"
  }
];

export const HONOR_DETAILS = {};
