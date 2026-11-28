import assert from "node:assert/strict";
import test from "node:test";
import { CERTIFIED_SNAPSHOT } from "../certified-data.js";
import { comparePlayers, preparePlayerComparison } from "../player-compare.js";

const result = (playerId, score, { isMvp = false, isAbsent = false } = {}) => ({
  playerId, score, isMvp, isAbsent,
});
const A = (score, flags) => result("A", score, flags);
const B = (score, flags) => result("B", score, flags);
const game = (matchId, season, date, round, matchType, ...results) => ({
  matchId, season, date, round, matchType, results,
});
const data = {
  players: [
    { playerId: "A", name: "甲", joinSeason: "S1" },
    { playerId: "B", name: "乙", joinSeason: "S2" },
  ],
  goat: [{ playerId: "A", goatIndex: 91.4, rank: 2 }, { playerId: "B", goatIndex: 95, rank: 1 }],
  seasons: [{ id: "S1" }, { id: "S2" }, { id: "S3" }, { id: "S4" }],
  matches: [
    game("MOAP0006", "S3", "2026-03-01", 2, "五人局", A(13), B(15, { isMvp: true })),
    game("MOAP0004", "S2", "2026-02-02", 3, "四人局", A(4), B(null, { isMvp: true })),
    game("MOAP0001", "S1", "2026-01-01", 1, "四人局", A(5, { isMvp: true })),
    game("MOAP0003", "S2", "2026-02-01", 2, "五人局", A(-90, { isAbsent: true, isMvp: true }), B(10, { isMvp: true })),
    game("MOAP0002", "S2", "2026-02-01", 1, "四人局", A(0), B(0)),
    game("MOAP0005", "S3", "2026-03-01", 1, "五人局", A(-5), B(-10)),
  ],
};
const build = (season = "all") => comparePlayers(preparePlayerComparison(data), "A", "B", season);

test("career totals, averages, extrema and original GOAT values", () => {
  const { career: [a, b] } = build();
  assert.deepEqual([a.games, a.total, a.average, a.best, a.worst, a.goatIndex, a.rank], [5, 17, 3.4, 13, -5, 91.4, 2]);
  assert.deepEqual([b.games, b.total, b.average, b.best, b.worst, b.goatIndex, b.rank], [4, 15, 3.75, 15, -10, 95, 1]);
});

test("head-to-head uses only joint valid games, classifies ties and accumulates directional differences", () => {
  assert.deepEqual(build().shared, {
    games: 3, aLeads: 1, bLeads: 1, ties: 1, aTotal: 8, bTotal: 5,
    aMvps: 0, bMvps: 1, difference: 3,
  });
  const reversed = comparePlayers(preparePlayerComparison(data), "B", "A").shared;
  assert.deepEqual([reversed.aTotal, reversed.bTotal, reversed.aMvps, reversed.bMvps, reversed.difference], [5, 8, 1, 0, -3]);
});

test("absence and null are excluded; zero is a valid non-negative score", () => {
  const { trajectory, career: [a, b] } = build();
  assert.deepEqual(trajectory.map(row => [row.a.score, row.b.score]), [
    [5, null], [0, 0], [null, 10], [4, null], [-5, -10], [13, 15],
  ]);
  assert.deepEqual([a.nonNegativeRate, b.nonNegativeRate], [4 / 5, 3 / 4]);
});

test("MVP counts only eligible results and supports both players as MVP in a shared game", () => {
  const { career: [a, b] } = build();
  assert.deepEqual([a.mvps, a.mvpRate, b.mvps, b.mvpRate], [1, 1 / 5, 2, 2 / 4]);
  const sharedMvpData = {
    ...data, matches: [game("MOAP0008", "S3", "2026-03-03", 3, "五人局",
      A(8, { isMvp: true }), B(8, { isMvp: true }))],
  };
  const { shared } = comparePlayers(preparePlayerComparison(sharedMvpData), "A", "B");
  assert.deepEqual([shared.games, shared.ties, shared.aMvps, shared.bMvps], [1, 1, 1, 1]);
});

test("non-negative streak uses calendar and round order, skips missing scores, breaks on negatives", () => {
  const { trajectory, career: [a, b] } = build();
  assert.deepEqual(trajectory.map(row => row.matchId), [
    "MOAP0001", "MOAP0002", "MOAP0003", "MOAP0004", "MOAP0005", "MOAP0006",
  ]);
  assert.deepEqual([a.longest, b.longest], [3, 2]);
});

test("season filters isolate trajectories and metrics without changing career or shared results", () => {
  for (const id of ["S1", "S2", "S3", "S4"]) {
    const scoped = build(id);
    assert.deepEqual(scoped.bySeason.map(row => row.id), [id]);
    assert.ok(scoped.trajectory.every(row => row.season === id));
    assert.deepEqual(scoped.career, build().career);
    assert.deepEqual(scoped.shared, build().shared);
  }
  const { trajectory: s2 } = build("S2");
  assert.deepEqual(s2.map(row => [row.a.total, row.a.average, row.b.mvps]), [[0, 0, 0], [0, 0, 1], [4, 2, 1]]);
  assert.equal(build("S4").trajectory.length, 0);
});

test("correct season starts, including a player who had not joined and a season with no games", () => {
  const [s1, s2, s3, s4] = build().bySeason;
  assert.equal(s1.b.beforeJoin, true);
  assert.equal(s1.b.games, 0);
  assert.equal(s1.b.average, null);
  assert.deepEqual([s2.b.games, s2.b.total, s3.b.games, s3.b.total], [2, 10, 2, 5]);
  assert.equal(s4.b.beforeJoin, false);
  assert.equal(s4.b.nonNegativeRate, null);
});

test("four-person and five-person games remain independent", () => {
  const [s1, s2, s3] = build().bySeason;
  assert.deepEqual([s1.a.four.total, s1.a.four.games, s1.a.five.games], [5, 1, 0]);
  assert.deepEqual([s2.b.four.total, s2.b.four.games, s2.b.five.total, s2.b.five.games], [0, 1, 10, 1]);
  assert.deepEqual([s3.a.four.games, s3.a.five.total, s3.a.five.average], [0, 8, 4]);
});

test("duplicate or unavailable player selections are rejected", () => {
  const index = preparePlayerComparison(data);
  assert.equal(comparePlayers(index, "A", "A"), null);
  assert.equal(comparePlayers(index, "A", "missing"), null);
});

test("official baseline validates every player and every pair without mutating the input", () => {
  const { players, matches, goat } = CERTIFIED_SNAPSHOT;
  const snapshot = JSON.stringify({ players, matches, goat });
  const index = preparePlayerComparison({ players, matches, goat });
  const valid = (match, id) => match.results.find(row => row.playerId === id && !row.isAbsent && Number.isFinite(row.score));
  for (const [i, player] of players.entries()) {
    for (const other of players.slice(i + 1)) {
      const model = comparePlayers(index, player.playerId, other.playerId);
      model.players.forEach((entry, side) => {
        const rows = matches.map(match => valid(match, entry.playerId)).filter(Boolean);
        const officialGoat = goat.find(row => row.playerId === entry.playerId);
        assert.deepEqual([model.career[side].games, model.career[side].total, model.career[side].mvps,
          model.career[side].goatIndex, model.career[side].rank],
        [rows.length, rows.reduce((sum, row) => sum + row.score, 0), rows.filter(row => row.isMvp).length,
          officialGoat.goatIndex, officialGoat.rank]);
      });
      const shared = matches.filter(match => valid(match, player.playerId) && valid(match, other.playerId));
      assert.equal(model.shared.games, shared.length);
      assert.equal(model.shared.games, model.shared.aLeads + model.shared.bLeads + model.shared.ties);
    }
  }
  assert.equal(JSON.stringify({ players, matches, goat }), snapshot);
});
