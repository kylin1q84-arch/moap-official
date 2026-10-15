import test from "node:test";
import assert from "node:assert/strict";
import { filterMatchesByFormat, matchFormatKey } from "../match-format.js";
import { buildDataLeaderboard, buildRecordCenter } from "../records-engine.js";

const players=[
  {playerId:"P1",name:"甲",joinSeason:"S1"},
  {playerId:"P2",name:"乙",joinSeason:"S1"}
];
function match(matchId,season,round,score,{peak=false,type="五人局",date}={}){
  return {matchId,season,round,date:date||`2026-01-${String(round).padStart(2,"0")}`,matchType:type,
    isSplitSession:peak,results:[
      {playerId:"P1",player:"甲",score,isMvp:score>0,isAbsent:false},
      {playerId:"P2",player:"乙",score:-score,isMvp:score<0,isAbsent:false}
    ]};
}
const matches=[
  match("MOAP0001","S1",1,10),
  match("MOAP0005","S1",5,30),
  match("MOAP0020","S2",1,-5,{type:"四人局"}),
  match("MOAP0042","S2",22,40,{peak:true}),
  match("MOAP0060","S3",1,15),
  match("MOAP0073","S3",26,119,{peak:true,date:"2026-10-05"})
];

test("all preserves the original normalized match collection; regular and peak partition it",()=>{
  assert.equal(filterMatchesByFormat(matches,"all"),matches);
  assert.deepEqual(filterMatchesByFormat(matches,"split_long").map(row=>row.matchId),["MOAP0005","MOAP0042","MOAP0073"]);
  assert.deepEqual(filterMatchesByFormat(matches,"regular").map(row=>row.matchId),["MOAP0001","MOAP0020","MOAP0060"]);
  assert.equal(matchFormatKey(matches[1]),"split_long");
});

test("leaderboard recalculates after format selection, then intersects season and player count",()=>{
  const all=buildDataLeaderboard(players,filterMatchesByFormat(matches,"all"),{metric:"points"});
  assert.deepEqual(all,buildDataLeaderboard(players,matches,{metric:"points"}));
  const regular=buildDataLeaderboard(players,filterMatchesByFormat(matches,"regular"),{metric:"points"});
  const peak=buildDataLeaderboard(players,filterMatchesByFormat(matches,"split_long"),{metric:"points"});
  assert.equal(regular.find(row=>row.playerId==="P1").total,20);
  assert.equal(peak.find(row=>row.playerId==="P1").total,189);
  assert.equal(peak.find(row=>row.playerId==="P1").games,3);
  const s3Peak=buildDataLeaderboard(players,filterMatchesByFormat(matches,"split_long"),{season:"S3",type:"five",metric:"points"});
  assert.equal(s3Peak.find(row=>row.playerId==="P1").total,119);
  assert.equal(s3Peak.find(row=>row.playerId==="P1").games,1);
  assert.deepEqual(buildDataLeaderboard(players,filterMatchesByFormat(matches,"split_long"),{season:"S1",type:"four",metric:"points"}),[]);
});

test("record evidence and streaks are rebuilt from the selected sequence",()=>{
  const center=buildRecordCenter(players,filterMatchesByFormat(matches,"split_long"));
  const single=center.views.all.all.single.find(row=>row.id==="HIST_SINGLE_HIGH");
  assert.ok(single);
  assert.equal(single.value,119);
  assert.deepEqual([...new Set(single.evidence.map(item=>item.matchId))],["MOAP0073"]);
  const streak=center.views.all.all.continuous.find(row=>row.id==="HIST_POS_STREAK");
  assert.equal(streak.value,3);
  assert.ok(streak.evidence.every(item=>["MOAP0005","MOAP0042","MOAP0073"].includes(item.matchId)));
  const s2=center.views.S2.all.single.find(row=>row.id==="HIST_SINGLE_HIGH");
  assert.equal(s2.value,40);
  assert.ok(s2.evidence.every(item=>item.matchId==="MOAP0042"));
});
