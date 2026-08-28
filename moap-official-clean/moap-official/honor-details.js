export const HONOR_CATALOG = [
  {
    honorId:"H001", name:"MSL总冠军", grade:"A", category:"最高荣誉", points:20,
    unit:"综合分", allowTie:false,
    rule:"采用综合评分制：单赛季总积分30%、场均积分20%、MVP场次累计积分15%、正分场次累计积分15%、最长连续MVP阶段积分10%、最长连续正分阶段积分10%。连续阶段先比较最长场次，同长度时取阶段积分最高的一段。综合分相同后依次比较六项原始指标，仍完全相同则暂不颁发。"
  },
  {
    honorId:"H003", name:"MSL年度最有价值牌手", grade:"A", category:"最高荣誉", points:20,
    unit:"综合分", allowTie:false,
    rule:"采用综合评分制：单赛季MVP场次30%、MVP率20%、MVP场次累计积分20%、最长连续MVP场次10%、最长连续MVP阶段积分10%、MVP场次爆发积分10%。MVP场次爆发积分仅累计该牌手本赛季获得MVP且实际积分达到50+的场次完整积分；低于50分计0，未获MVP的场次不计。综合分相同后依次比较六项原始指标，仍完全相同则暂不颁发。"
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
    rule:"依次比较：单赛季BGR指数、单场最高积分、最长连续爆发记录。爆发定义为单场积分≥50；BGR档位50–59/60–69/70–79/80–89/90–99/100+，权重1/2/3/5/8/12。"
  },
  {
    honorId:"H015", name:"逆袭王", grade:"B", category:"专项能力", points:5,
    unit:"分", allowTie:false,
    rule:"依次比较：单赛季最大逆袭幅度、最大逆袭阶段累计正分、最大逆袭阶段MVP场次。最大逆袭幅度＝某个实际比赛低谷累计积分之后出现的最高累计积分－该低谷累计积分；阶段累计正分只统计低谷之后至最高点之间得分≥0的场次。全员最大逆袭幅度均为0时不颁发。"
  },
  {
    honorId:"H006", name:"连庄王", grade:"B", category:"专项能力", points:5,
    unit:"场", allowTie:false,
    rule:"依次比较：最长连续正分纪录、该最长阶段累计积分、连庄总次数。0分延续；缺席不增加也不中断；负分中断。连庄总次数为每段连续正分中第二场起的延续次数。"
  },
  {
    honorId:"H021", name:"翻车王", grade:"C", category:"趣味荣誉", points:2,
    unit:"场", allowTie:false,
    rule:"依次比较：单赛季积分≤-40的场次、这些场次累计积分更低、这些场次最低单场积分更低。全员均为0次则不颁发。"
  },
  {
    honorId:"H017", name:"提款机", grade:"C", category:"趣味荣誉", points:2,
    unit:"分", allowTie:false,
    rule:"依次比较：单赛季总积分更低、正分率更低、单场最低积分更低。"
  },
  {
    honorId:"H019", name:"鸽王", grade:"C", category:"趣味荣誉", points:2,
    unit:"场", allowTie:true,
    rule:"依次比较：单赛季实际参赛场次更少、最长连续缺席纪录更高；全部条件相同允许并列。"
  },
  {
    honorId:"H018", name:"过山车奖", grade:"C", category:"趣味荣誉", points:2,
    unit:"反差", allowTie:false,
    rule:"依次比较：前后半赛季累计积分反差、前后半赛季正分率反差、前后半赛季MVP场次反差，三项均取绝对值且越大排名越高。只按实际参赛场次排序拆分；偶数场均分两半，奇数场时中间一场不进入前后半比较。"
  }
];

export const HONOR_DETAILS = {};
