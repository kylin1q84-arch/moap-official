import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayerComparison, buildComparisonSeries } from "../player-compare.js";

const makeMatch=(id,season,one,two,date)=>{
  const rows=[];
  if(one!=null)rows.push({playerId:"P001",score:one,isAbsent:false,isMvp:two==null||one>two});
  if(two!=null)rows.push({playerId:"P002",score:two,isAbsent:false,isMvp:one==null||two>one});
  return {matchId:id,season,date,results:rows};
};
const archive={
  players:[{playerId:"P001",name:"甲"},{playerId:"P002",name:"乙"}],
  matches:[
    makeMatch("MOAP0001","S1",50,-10,"2025-01-01"),
    makeMatch("MOAP0002","S1",null,30,"2025-01-02"),
    makeMatch("MOAP0003","S2",-15,15,"2026-01-03"),
    makeMatch("MOAP0004","S2",0,0,"2026-01-04"),
  ],
  honors:{
    P001:[{honorId:"H001",scope:"S1"},{honorId:"H003",scope:"S2"}],
    P002:[{honorId:"H002",scope:"S2"}]
  },
  goat:[{playerId:"P001",goatIndex:120,rank:1},{playerId:"P002",goatIndex:86,rank:2}],
  matchups:[
    {matchId:"MOAP0001",fromPlayerId:"P001",toPlayerId:"P002",points:12},
    {matchId:"MOAP0001",fromPlayerId:"P002",toPlayerId:"P001",points:-18},
    {matchId:"MOAP0003",fromPlayerId:"P001",toPlayerId:"P002",points:-4}
  ]
};

test("career comparison uses actual appearances, zeros are nonnegative",()=>{
  const c=buildPlayerComparison(archive,"P001","P002","all");
  assert.equal(c.left.games,3);
  assert.equal(c.right.games,4);
  assert.equal(c.left.total,35);
  assert.equal(c.right.total,35);
  assert.equal(c.left.average,35/3);
  assert.equal(c.right.average,35/4);
  assert.equal(c.left.positiveRate,2/3);
  assert.equal(c.common.length,3);
  assert.equal(c.together.leftLeads,1);
  assert.equal(c.together.rightLeads,1);
  assert.equal(c.together.ties,1);
  assert.equal(c.left.goatIndex,120);
  assert.equal(c.left.titles,1);
  assert.equal(c.left.annualMvp,1);
});

test("season selection scopes appearances and honors, hides lifetime GOAT",()=>{
  const c=buildPlayerComparison(archive,"P001","P002","S2");
  assert.equal(c.matches.length,2);
  assert.equal(c.left.games,2);
  assert.equal(c.left.total,-15);
  assert.equal(c.left.titles,0);
  assert.equal(c.left.annualMvp,1);
  assert.equal(c.right.peak,1);
  assert.equal(c.left.goatIndex,null);
});

test("directional matchup sums only matches with both recorded directions",()=>{
  const c=buildPlayerComparison(archive,"P001","P002","all");
  assert.equal(c.pairwise.covered,1);
  assert.equal(c.pairwise.leftPoints,12);
  assert.equal(c.pairwise.rightPoints,-18);
  assert.equal(c.pairwise.leftRecorded,2);
});

test("timeline aligns on official matches and holds absent players steady",()=>{
  const c=buildPlayerComparison(archive,"P001","P002","all");
  const series=buildComparisonSeries(c.matches,"P001","P002","total");
  assert.deepEqual(series.map(x=>x.left),[0,50,50,35,35]);
  assert.deepEqual(series.map(x=>x.right),[0,-10,20,35,35]);
  assert.equal(series[2].leftScore,null);
  const season=buildPlayerComparison(archive,"P001","P002","S2");
  assert.deepEqual(buildComparisonSeries(season.matches,"P001","P002","mvps").map(x=>x.left),[0,0,0]);
});
