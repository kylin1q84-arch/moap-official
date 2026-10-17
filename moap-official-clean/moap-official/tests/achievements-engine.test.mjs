import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENT_CATALOG, buildAchievementSystem } from "../achievements-engine.js";

const players=[
  {playerId:"P001",name:"甲",joinSeason:"S1"},
  {playerId:"P002",name:"乙",joinSeason:"S1"},
  {playerId:"P003",name:"丙",joinSeason:"S1"},
  {playerId:"P004",name:"丁",joinSeason:"S1"}
];

const matches=[
  {
    matchId:"MOAP0001",season:"S1",round:1,date:"2026-01-01",matchType:"四人局",venue:"A",
    results:[
      {playerId:"P001",player:"甲",score:-55,isMvp:false,isAbsent:false},
      {playerId:"P002",player:"乙",score:30,isMvp:true,isAbsent:false},
      {playerId:"P003",player:"丙",score:15,isMvp:false,isAbsent:false},
      {playerId:"P004",player:"丁",score:10,isMvp:false,isAbsent:false}
    ]
  },
  {
    matchId:"MOAP0002",season:"S1",round:2,date:"2026-01-02",matchType:"四人局",venue:"A",
    results:[
      {playerId:"P001",player:"甲",score:105,isMvp:true,isAbsent:false},
      {playerId:"P002",player:"乙",score:-20,isMvp:false,isAbsent:false},
      {playerId:"P003",player:"丙",score:-35,isMvp:false,isAbsent:false},
      {playerId:"P004",player:"丁",score:-50,isMvp:false,isAbsent:false}
    ]
  },
  {
    matchId:"MOAP0003",season:"S1",round:3,date:"2026-01-03",matchType:"四人局",venue:"A",
    results:[
      {playerId:"P001",player:"甲",score:65,isMvp:true,isAbsent:false},
      {playerId:"P002",player:"乙",score:5,isMvp:false,isAbsent:false},
      {playerId:"P003",player:"丙",score:-25,isMvp:false,isAbsent:false},
      {playerId:"P004",player:"丁",score:-45,isMvp:false,isAbsent:false}
    ]
  },
  {
    matchId:"MOAP0004",season:"S1",round:4,date:"2026-01-04",matchType:"四人局",venue:"A",
    results:[
      {playerId:"P001",player:"甲",score:25,isMvp:false,isAbsent:false},
      {playerId:"P002",player:"乙",score:10,isMvp:true,isAbsent:false},
      {playerId:"P003",player:"丙",score:-15,isMvp:false,isAbsent:false},
      {playerId:"P004",player:"丁",score:-20,isMvp:false,isAbsent:false}
    ]
  }
];

const honors={
  P001:[{scope:"S1",honorId:"H001",name:"MOAP赛季总冠军",details:{evidence:[]}}],
  P002:[],P003:[],P004:[]
};

test("catalog contains exactly 32 unique achievements",()=>{
  assert.equal(ACHIEVEMENT_CATALOG.length,32);
  assert.equal(new Set(ACHIEVEMENT_CATALOG.map(item=>item.id)).size,32);
  assert.deepEqual(ACHIEVEMENT_CATALOG.slice(0,3).map(item=>item.category),["official","official","official"]);
});

test("achievement engine unlocks score, MVP, comeback, streak and official achievements",()=>{
  const goatFirstByPlayer={P001:{matchId:"MOAP0002",season:"S1",round:2,date:"2026-01-02",playerId:"P001",player:"甲",score:105,isMvp:true,goatRank:1}};
  const system=buildAchievementSystem(players,matches,{honors,goatFirstByPlayer});
  const p1=system.byPlayer.P001;
  const byId=Object.fromEntries(p1.achievements.map(item=>[item.id,item]));

  assert.equal(byId.ACH001.unlocked,true,"official season title should unlock");
  assert.equal(byId.ACH010.unlocked,true,"first MVP should unlock");
  assert.equal(byId.ACH015.unlocked,true,"105-point MVP should unlock five-star achievement");
  assert.equal(byId.ACH020.unlocked,true,"105 points should unlock 100-point achievement");
  assert.equal(byId.ACH021.unlocked,false,"105 points should not unlock 120-point achievement");
  assert.equal(byId.ACH022.unlocked,true,"three consecutive non-negative played matches should unlock");
  assert.equal(byId.ACH025.unlocked,true,"two consecutive MVP matches should unlock");
  assert.equal(byId.ACH027.unlocked,true,"105/-20/-35/-50 is a solo win");
  assert.equal(byId.ACH030.unlocked,true,"-55 followed by +105 should unlock comeback");
  assert.equal(byId.ACH031.unlocked,true,"105 vs -20 lead exceeds 80");
  assert.equal(byId.ACH032.unlocked,true,"provided historical GOAT evidence should unlock");
  assert.equal(byId.ACH020.evidence.matchId,"MOAP0002");
});

test("locked milestone reports progress instead of fake unlock",()=>{
  const system=buildAchievementSystem(players,matches,{honors,goatFirstByPlayer:{}});
  const p1=system.byPlayer.P001;
  const hundred=p1.achievements.find(item=>item.id==="ACH009");
  assert.equal(hundred.unlocked,false);
  assert.equal(hundred.progress.value,4);
  assert.equal(hundred.progress.target,100);
});
