import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENT_CATALOG, buildAchievementSystem } from "../achievements-engine.js";

const players=[
  {playerId:"P001",name:"甲",joinSeason:"S1"},
  {playerId:"P002",name:"乙",joinSeason:"S1"},
  {playerId:"P003",name:"丙",joinSeason:"S1"},
  {playerId:"P004",name:"丁",joinSeason:"S1"}
];

function isoDate(index){
  const date=new Date(Date.UTC(2026,0,1));
  date.setUTCDate(date.getUTCDate()+index);
  return date.toISOString().slice(0,10);
}

function makeMatch(index){
  const matchId=`MOAP${String(index+1).padStart(4,"0")}`;
  const common={matchId,season:"S1",round:index+1,date:isoDate(index),matchType:"四人局",venue:"测试场"};
  if(index===0){
    return {...common,results:[
      {playerId:"P001",player:"甲",score:-60,isMvp:false,isAbsent:false},
      {playerId:"P002",player:"乙",score:60,isMvp:true,isAbsent:false},
      {playerId:"P003",player:"丙",score:0,isMvp:false,isAbsent:false},
      {playerId:"P004",player:"丁",score:0,isMvp:false,isAbsent:false}
    ]};
  }
  const score=index===1?90:120;
  const opponent=-score/3;
  return {...common,results:[
    {playerId:"P001",player:"甲",score,isMvp:true,isAbsent:false},
    {playerId:"P002",player:"乙",score:opponent,isMvp:false,isAbsent:false},
    {playerId:"P003",player:"丙",score:opponent,isMvp:false,isAbsent:false},
    {playerId:"P004",player:"丁",score:opponent,isMvp:false,isAbsent:false}
  ]};
}

const matches=Array.from({length:100},(_,index)=>makeMatch(index));
const honors={
  P001:[
    {scope:"S1",honorId:"H001",name:"MOAP赛季总冠军",details:{evidence:[{matchId:"MOAP0002"}]}},
    {scope:"S1",honorId:"H002",name:"MOAP巅峰赛冠军",details:{evidence:[{matchId:"MOAP0002"}]}},
    {scope:"S1",honorId:"H003",name:"MOAP年度最有价值牌手",details:{evidence:[{matchId:"MOAP0002"}]}}
  ],
  P002:[],P003:[],P004:[]
};
const goatFirstByPlayer={P001:{matchId:"MOAP0002",season:"S1",round:2,date:matches[1].date,playerId:"P001",player:"甲",score:90,isMvp:true,goatRank:1}};

test("all 32 achievement definitions have a working unlock path",()=>{
  const system=buildAchievementSystem(players,matches,{honors,goatFirstByPlayer});
  const profile=system.byPlayer.P001;
  assert.equal(ACHIEVEMENT_CATALOG.length,32);
  assert.equal(profile.achievements.length,32);
  assert.equal(profile.unlocked,32);
  assert.deepEqual(profile.achievements.filter(item=>!item.unlocked).map(item=>item.id),[]);

  const byId=Object.fromEntries(profile.achievements.map(item=>[item.id,item]));
  assert.equal(byId.ACH001.evidence.matchId,"MOAP0100","season title settles on season final match");
  assert.equal(byId.ACH002.evidence.matchId,"MOAP0002","peak title keeps direct match evidence");
  assert.equal(byId.ACH003.evidence.matchId,"MOAP0100","annual MVP settles on season final match");
  assert.equal(byId.ACH009.evidence.matchId,"MOAP0100","100-game milestone unlocks on game 100");
  assert.equal(byId.ACH014.evidence.matchId,"MOAP0002","4-star MVP unlocks on the 90-point MVP");
  assert.equal(byId.ACH015.evidence.matchId,"MOAP0003","5-star MVP unlocks on the first 100+ MVP");
  assert.equal(byId.ACH021.evidence.matchId,"MOAP0003","120-point achievement uses the first 120-point match");
  assert.equal(byId.ACH030.evidence.matchId,"MOAP0002","comeback unlocks on the recovery match");
  assert.equal(byId.ACH032.evidence.matchId,"MOAP0002","historical GOAT uses supplied first-rank evidence");
});
