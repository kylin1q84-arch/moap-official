import test from "node:test";
import assert from "node:assert/strict";
import { buildAchievementSystem } from "../achievements-engine.js";

const players=[
  {playerId:"P001",name:"甲",joinSeason:"S1"},
  {playerId:"P002",name:"乙",joinSeason:"S1"},
  {playerId:"P003",name:"丙",joinSeason:"S1"},
  {playerId:"P004",name:"丁",joinSeason:"S1"}
];

const matches=[
  {matchId:"MOAP0001",season:"S1",round:1,date:"2026-01-01",matchType:"四人局",results:[
    {playerId:"P001",player:"甲",score:20,isMvp:true,isAbsent:false},
    {playerId:"P002",player:"乙",score:10,isMvp:false,isAbsent:false},
    {playerId:"P003",player:"丙",score:-10,isMvp:false,isAbsent:false},
    {playerId:"P004",player:"丁",score:-20,isMvp:false,isAbsent:false}
  ]},
  {matchId:"MOAP0002",season:"S1",round:2,date:"2026-01-08",matchType:"四人局",results:[
    {playerId:"P001",player:"甲",score:15,isMvp:true,isAbsent:false},
    {playerId:"P002",player:"乙",score:5,isMvp:false,isAbsent:false},
    {playerId:"P003",player:"丙",score:-5,isMvp:false,isAbsent:false},
    {playerId:"P004",player:"丁",score:-15,isMvp:false,isAbsent:false}
  ]},
  {matchId:"MOAP0003",season:"S1",round:3,date:"2026-01-15",matchType:"四人局",results:[
    {playerId:"P001",player:"甲",score:-5,isMvp:false,isAbsent:false},
    {playerId:"P002",player:"乙",score:25,isMvp:true,isAbsent:false},
    {playerId:"P003",player:"丙",score:-10,isMvp:false,isAbsent:false},
    {playerId:"P004",player:"丁",score:-10,isMvp:false,isAbsent:false}
  ]}
];

const honors={
  P001:[
    {scope:"S1",honorId:"H001",name:"MOAP赛季总冠军",details:{evidence:[{matchId:"MOAP0001"}]}},
    {scope:"S1",honorId:"H003",name:"MOAP年度最有价值牌手",details:{evidence:[{matchId:"MOAP0001"}]}}
  ],
  P002:[{scope:"S1",honorId:"H002",name:"MOAP巅峰赛冠军",details:{evidence:[{matchId:"MOAP0002"}]}}],
  P003:[],P004:[]
};

test("season-settlement honors use the final match while peak honors keep direct evidence",()=>{
  const system=buildAchievementSystem(players,matches,{honors,goatFirstByPlayer:{}});
  const p1=Object.fromEntries(system.byPlayer.P001.achievements.map(item=>[item.id,item]));
  const p2=Object.fromEntries(system.byPlayer.P002.achievements.map(item=>[item.id,item]));

  assert.equal(p1.ACH001.evidence.matchId,"MOAP0003");
  assert.equal(p1.ACH001.evidence.date,"2026-01-15");
  assert.equal(p1.ACH001.evidence.evidenceType,"season_settlement");
  assert.equal(p1.ACH003.evidence.matchId,"MOAP0003");
  assert.equal(p1.ACH003.evidence.evidenceType,"season_settlement");
  assert.equal(p2.ACH002.evidence.matchId,"MOAP0002");
  assert.equal(p2.ACH002.evidence.evidenceType,"direct_match");
});
