export const HONOR_CATALOG = [
  {honorId:"H001",name:"MSL总冠军",grade:"A",category:"最高荣誉",points:10,unit:"分",allowTie:false,rule:"依次比较：单赛季总积分、正分率、单场最高积分。全部条件仍相同则暂不颁发，等待人工裁定。"},
  {honorId:"H002",name:"MSL年度最佳牌手",grade:"A",category:"最高荣誉",points:15,unit:"综合分",allowTie:false,rule:"年度综合评分最高者获得；如综合评分完全相同则暂不颁发，等待人工裁定。综合评分沿用官方权重：总积分35%、MVP 25%、场均15%、正分率10%、BGR 10%、冠军加成5%。"},
  {honorId:"H003",name:"MSL赛季MVP",grade:"A",category:"最高荣誉",points:7,unit:"次",allowTie:false,rule:"依次比较：赛季MVP场次、MVP场次累计积分、最长连续MVP纪录。全部条件仍相同则暂不颁发。"},
  {honorId:"H011",name:"四人局之王",grade:"B",category:"专项能力",points:5,unit:"分",allowTie:false,rule:"依次比较：四人局总积分、四人局MVP场次、四人局正分率。"},
  {honorId:"H012",name:"五人局之王",grade:"B",category:"专项能力",points:5,unit:"分",allowTie:false,rule:"依次比较：五人局总积分、五人局MVP场次、五人局正分率。"},
  {honorId:"H004",name:"得分王",grade:"B",category:"专项能力",points:5,unit:"分/场",allowTie:false,rule:"依次比较：赛季场均积分、正分场次场均积分、MVP场次场均积分。"},
  {honorId:"H005",name:"稳定先生",grade:"B",category:"专项能力",points:5,unit:"%",allowTie:false,rule:"依次比较：赛季正分率、正分场次累计积分、正分场次场均积分；0分计为正分。"},
  {honorId:"H007",name:"铁人奖",grade:"B",category:"专项能力",points:5,unit:"场",allowTie:true,rule:"依次比较：赛季参赛场次、连续参赛最长纪录；全部条件相同允许并列。"},
  {honorId:"H010",name:"独赢王",grade:"B",category:"专项能力",points:5,unit:"场",allowTie:false,rule:"独赢指本人积分≥0且同场其余实际参赛牌手全部为负分。依次比较：独赢场次、独赢场次累计积分、独赢场次场均积分。"},
  {honorId:"H008",name:"大场面先生",grade:"B",category:"专项能力",points:5,unit:"BGR",allowTie:false,rule:"依次比较：BGR指数、单场最高积分、最长连续大场面纪录。大场面为单场积分≥50；BGR档位50–59/60–69/70–79/80–89/90–99/100+，权重1/2/3/5/8/12。"},
  {honorId:"H016",name:"大胜专家",grade:"B",category:"专项能力",points:5,unit:"场",allowTie:false,rule:"大胜场次指本人对同场最低分牌手的领先分差≥100，每场最多计1次。依次比较：大胜场次、大胜场次累计净胜分、最大领先分差。"},
  {honorId:"H006",name:"连庄王",grade:"B",category:"专项能力",points:5,unit:"场",allowTie:false,rule:"依次比较：最长连庄纪录、该最长连庄阶段积分、连庄总次数。0分延续；缺席不增加也不中断；负分中断。连庄总次数为每段连续正分中第二场起的延续次数。"},
  {honorId:"H013",name:"关键局之王",grade:"B",category:"专项能力",points:5,unit:"分",allowTie:false,rule:"按赛季赛程最后3场计算，缺席按0分。依次比较：最后3场总积分、MVP次数、单场最高积分。"},
  {honorId:"H015",name:"低谷反弹王",grade:"B",category:"专项能力",points:5,unit:"分",allowTie:false,rule:"最大反弹幅度＝低谷后的最高单场积分－低谷单场积分；反弹阶段为低谷下一场至反弹最高点。依次比较：最大反弹幅度、反弹阶段累计积分、反弹阶段大场面次数。"},
  {honorId:"H021",name:"翻车王",grade:"C",category:"趣味荣誉",points:0,unit:"场",allowTie:false,rule:"依次比较：赛季单场≤-40的场次、这些场次累计积分更低、这些场次最低单场积分更低。全员均为0次则不颁发。"},
  {honorId:"H017",name:"财神爷",grade:"C",category:"趣味荣誉",points:0,unit:"分",allowTie:false,rule:"依次比较：赛季总积分更低、正分率更低、单场最低积分更低。"},
  {honorId:"H019",name:"鸽王",grade:"C",category:"趣味荣誉",points:0,unit:"场",allowTie:true,rule:"依次比较：赛季参赛场次更少、连续缺席最长纪录更高；全部条件相同允许并列。"},
  {honorId:"H018",name:"过山车奖",grade:"C",category:"趣味荣誉",points:0,unit:"波动指数",allowTie:false,rule:"最大波动指数采用实际参赛单场积分的总体标准差。依次比较：波动指数、单场最高积分、单场最低积分更低。"},
  {honorId:"H022",name:"赛季大满贯",grade:"D",category:"生涯成就",points:0,unit:"项",allowTie:false,rule:"同一赛季同时获得MSL总冠军、MSL年度最佳牌手、MSL赛季MVP，并获得任意6项B级荣誉。"}
];
export const HONOR_DETAILS = {};
