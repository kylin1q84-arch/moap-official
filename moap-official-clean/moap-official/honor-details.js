export const HONOR_CATALOG = [
  {
    honorId:"H001", name:"MSL总冠军",
    unit:"综合分", allowTie:false,
    rule:"采用综合评分制：单赛季总积分30%、场均积分20%、MVP场次累计积分15%、正分场次累计积分15%、最长连续MVP阶段积分10%、最长连续正分阶段积分10%。连续阶段先比较最长场次，同长度时取阶段积分最高的一段。综合分相同后依次比较六项原始指标，仍完全相同则暂不颁发。"
  },
  {
    honorId:"H003", name:"MSL年度最有价值牌手",
    unit:"综合分", allowTie:false,
    rule:"采用综合评分制：单赛季MVP场次30%、MVP率20%、MVP场次累计积分20%、最长连续MVP场次10%、最长连续MVP阶段积分10%、MVP场次爆发积分10%。MVP场次爆发积分仅累计该牌手本赛季获得MVP且实际积分达到50+的场次完整积分；低于50分计0，未获MVP的场次不计。综合分相同后依次比较六项原始指标，仍完全相同则暂不颁发。"
  }
];

export const HONOR_DETAILS = {};
