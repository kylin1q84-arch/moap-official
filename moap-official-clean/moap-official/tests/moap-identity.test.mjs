import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeMatchIds } from "../match-id.js";
import { calculateHonorSystem } from "../analytics-engine.js";

const players=[
  {playerId:"P1",name:"甲",joinSeason:"S1"},
  {playerId:"P2",name:"乙",joinSeason:"S1"}
];
const match=(id,round,a,b,extra={})=>({
  matchId:id,season:"S1",round,date:`2024-01-${String(round).padStart(2,"0")}`,
  matchType:"五人局",venue:"测试场地",
  results:[{playerId:"P1",player:"甲",score:a,isMvp:a>b,isAbsent:false},
    {playerId:"P2",player:"乙",score:b,isMvp:b>a,isAbsent:false}],...extra
});

test("canonical IDs preserve source joins without an old-prefix alias",()=>{
  const raw={matches:[{id:"LEGACY0042"}],results:[{match_id:"LEGACY0042"}],
    absences:[{match_id:"LEGACY0042"}],matchups:[{match_id:"LEGACY0042"}],
    segments:[{sourceMatchId:"LEGACY0042"}]};
  const data=canonicalizeMatchIds(raw);
  assert.equal(data.matches[0].id,"MOAP0042");
  assert.equal(data.results[0].match_id,"MOAP0042");
  assert.equal(data.absences[0].match_id,"MOAP0042");
  assert.equal(data.matchups[0].match_id,"MOAP0042");
  assert.equal(data.segments[0].sourceMatchId,"MOAP0042");
});

test("H002 ignores a higher regular-match score",()=>{
  const system=calculateHonorSystem(players,[match("MOAP0001",1,200,-200),
    match("MOAP0005",5,20,80)]);
  const award=system.board.find(row=>row.honorId==="H002");
  assert.deepEqual(award.winners,["乙"]);
  assert.equal(award.value,80);
  assert.equal(award.details.evidence[0].matchId,"MOAP0005");
});

test("H002 reads full-match results, not a higher first-half score",()=>{
  const peak=match("MOAP0005",5,20,50,{isSplitSession:true,
    segmentEvidence:[{key:"first_half",scores:[100,0]}]});
  const award=calculateHonorSystem(players,[peak]).board.find(row=>row.honorId==="H002");
  assert.deepEqual(award.winners,["乙"]);
  assert.equal(award.value,50);
});

test("H002 permits ties and never silently picks from multiple peak matches",()=>{
  const tied=calculateHonorSystem(players,[match("MOAP0005",5,40,40)]);
  assert.deepEqual(tied.board.find(row=>row.honorId==="H002").winners,["甲","乙"]);
  const multiple=calculateHonorSystem(players,[
    match("MOAP0005",5,40,20),match("MOAP0006",6,30,10,{isSplitSession:true})
  ]);
  assert.equal(multiple.board.find(row=>row.honorId==="H002").status,"DATA_ISSUE");
  assert.equal(multiple.board.find(row=>row.honorId==="H002").winners.length,0);
  assert.equal(multiple.issues[0].code,"MULTIPLE_PEAK_MATCHES");
});

test("H001 and H003 retain their independent criteria",()=>{
  const system=calculateHonorSystem(players,[match("MOAP0001",1,30,-30),
    match("MOAP0005",5,10,20)]);
  assert.deepEqual(system.board.find(row=>row.honorId==="H001").winners,["甲"]);
  assert.deepEqual(system.board.find(row=>row.honorId==="H003").winners,["甲"]);
});
