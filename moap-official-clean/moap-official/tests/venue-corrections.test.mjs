import test from "node:test";
import assert from "node:assert/strict";
import { correctSourceData } from "../source-data-corrections.js";

test("MOAP0075 on 2026-10-23 uses the corrected Hu Xiaoya venue name", () => {
  const source = {
    matches: [
      {id:"MOAP0075",match_date:"2026-10-23",season_id:"S3",round:28,venue:"胡小鸭（华美空间店）"},
      {id:"MOAP0074",match_date:"2026-10-12",season_id:"S3",round:27,venue:"拾贰茶铺（SM店）"},
      {id:"MOAP0075",match_date:"2025-10-23",season_id:"S2",round:28,venue:"另一场地"}
    ]
  };
  const fixed=correctSourceData(source);
  assert.equal(fixed.matches[0].venue,"胡小鸭共享棋牌室（华美空间店）");
  assert.equal(fixed.matches[0].season_id,"S3");
  assert.equal(fixed.matches[0].round,28);
  assert.equal(fixed.matches[1].venue,"拾贰茶铺（SM店）");
  assert.equal(fixed.matches[2].venue,"另一场地");
  assert.equal(source.matches[0].venue,"胡小鸭（华美空间店）");
});

test("existing MOAP0076 round correction continues working", () => {
  const fixed=correctSourceData({
    matches:[{id:"MOAP0076",match_date:"2026-10-12",season_id:"S4",round:1,venue:"测试场地"}]
  });
  assert.equal(fixed.matches[0].season_id,"S3");
  assert.equal(fixed.matches[0].round,28);
  assert.equal(fixed.matches[0].venue,"测试场地");
});
