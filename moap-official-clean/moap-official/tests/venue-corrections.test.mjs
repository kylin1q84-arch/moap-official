import test from "node:test";
import assert from "node:assert/strict";
import { correctSourceData } from "../source-data-corrections.js";
import { assignOfficialMatchIds } from "../official-match-normalization.js";

const newVenue="胡小鸭共享棋牌室（华美空间店）";

test("2026-10-23 raw source MOAP0077 gets the venue correction, unrelated matches stay unchanged",()=>{
  const source={
    matches:[
      {id:"MOAP0075",match_date:"2026-10-05",season_id:"S3",round:27,venue:"拾贰茶铺（SM店）下半场"},
      {id:"MOAP0076",match_date:"2026-10-12",season_id:"S3",round:28,venue:"拾贰茶铺（SM店）"},
      {id:"MOAP0077",match_date:"2026-10-23",season_id:"S3",round:29,venue:"胡小鸭（华美空间店）"},
      {id:"MOAP0078",match_date:"2026-10-23",season_id:"S3",round:30,venue:"其他场地"}
    ]
  };
  const fixed=correctSourceData(source);
  assert.equal(fixed.matches[0].venue,source.matches[0].venue);
  assert.equal(fixed.matches[1].venue,source.matches[1].venue);
  assert.equal(fixed.matches[2].venue,newVenue);
  assert.equal(fixed.matches[3].venue,source.matches[3].venue);
  assert.equal(source.matches[2].venue,"胡小鸭（华美空间店）");
});

test("two official split sessions map raw MOAP0077 to displayed MOAP0075",()=>{
  const raw=Array.from({length:77},(_,i)=>{
    const index=i+1;
    return {id:`MOAP${String(index).padStart(4,"0")}`,
      match_date:index===77?"2026-10-23":"2026-10-05",
      season_id:"S3",round:index,venue:index===77?"胡小鸭（华美空间店）":"测试场地"};
  });
  const fixed=correctSourceData({matches:raw}).matches;
  const groups=[];
  for(let i=0;i<fixed.length;i++){
    const sourceId=i+1;
    if(sourceId===43||sourceId===75)continue;
    const sources=sourceId===42||sourceId===74?[fixed[i],fixed[i+1]]:[fixed[i]];
    groups.push({primary:fixed[i],sources,results:[],matchups:[]});
  }
  const official=assignOfficialMatchIds(groups);
  const last=official.matches.at(-1);
  assert.equal(official.matches.length,75);
  assert.equal(last.id,"MOAP0075");
  assert.equal(last.primarySourceMatchId,"MOAP0077");
  assert.equal(last.match_date,"2026-10-23");
  assert.equal(last.venue,newVenue);
  assert.equal(official.sourceToOfficialMatchId.MOAP0077,"MOAP0075");
});

test("existing MOAP0076 round correction still works",()=>{
  const fixed=correctSourceData({
    matches:[{id:"MOAP0076",match_date:"2026-10-12",season_id:"S4",round:1,venue:"测试场地"}]
  });
  assert.equal(fixed.matches[0].season_id,"S3");
  assert.equal(fixed.matches[0].round,28);
  assert.equal(fixed.matches[0].venue,"测试场地");
});
