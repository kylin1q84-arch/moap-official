export const CORE_HONOR_IDS = new Set(["H001", "H002", "H003"]);
export const HONOR_CATALOG = [
  {
    honorId:"H001", name:"MOAP赛季总冠军",
    unit:"分", allowTie:false,
    rule:"单赛季累计总积分最高的牌手获得MOAP赛季总冠军。若累计总积分完全相同，则依次比较场均积分、MVP场次积分、正分场次积分及爆发场次积分；前一项分出高低后立即停止比较。若全部比较条件仍完全相同，则该赛季MOAP赛季总冠军暂不颁发。"
  },
  {
    honorId:"H002", name:"MOAP巅峰赛冠军",
    unit:"分", allowTie:true,
    rule:"每赛季巅峰赛全场最终积分最高的牌手获得MOAP巅峰赛冠军。该荣誉仅依据该赛季巅峰赛最终全场成绩评选，不累计常规牌局成绩。若最高积分并列，则并列获得MOAP巅峰赛冠军。"
  },
  {
    honorId:"H003", name:"MOAP年度最有价值牌手",
    unit:"星", allowTie:false,
    rule:"单赛季累计MVP星数最高的牌手获得MOAP年度最有价值牌手。每次MVP根据该场最终积分获得1～5星：低于50分为1星，50～64分为2星，65～79分为3星，80～99分为4星，100分及以上为5星。若累计星数相同，则依次比较五星MVP次数、四星及以上MVP次数、三星及以上MVP次数、MVP总次数、MVP场次累计积分及MVP率；全部条件仍完全相同则暂不颁发。"
  }
];

export const HONOR_DETAILS = {};
