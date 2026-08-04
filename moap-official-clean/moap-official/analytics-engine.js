import { HONOR_CATALOG } from "./honor-details.js";

const EPS = 1e-9;
const byId = Object.fromEntries(HONOR_CATALOG.map(item => [item.honorId, item]));
const seasonNumber = value => Number(String(value || "").replace(/\D/g, "")) || 0;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = values => values.reduce((total, value) => total + num(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const std = values => {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (num(value) - average) ** 2)));
};
const eq = (a, b) => Math.abs(num(a) - num(b)) <= EPS;

export function bgrValue(score) {
  score = num(score);
  return score >= 100 ? 12 : score >= 90 ? 8 : score >= 80 ? 5 : score >= 70 ? 3 : score >= 60 ? 2 : score >= 50 ? 1 : 0;
}

function played(match) {
  return (match.results || []).filter(result => !result.isAbsent && result.score != null);
}

function playerResult(match, playerId) {
  return (match.results || []).find(result => result.playerId === playerId);
}

function sortedMatches(matches) {
  return [...(matches || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) ||
    num(a.round) - num(b.round) ||
    String(a.matchId).localeCompare(String(b.matchId))
  );
}

function eligiblePlayers(players, season) {
  return players.filter(player => seasonNumber(player.joinSeason) <= seasonNumber(season));
}

function longestBoolean(schedule, predicate, { ignoreAbsent = false } = {}) {
  let current = 0;
  let best = 0;
  for (const item of schedule) {
    if (item.absent && ignoreAbsent) continue;
    if (predicate(item)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function consecutiveStageMetrics(schedule, predicate) {
  let current = [];
  const groups = [];
  for (const item of schedule) {
    if (item.absent) continue;
    if (predicate(item)) current.push(item);
    else {
      if (current.length) groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  const maxLength = Math.max(0, ...groups.map(group => group.length));
  const longestGroups = groups.filter(group => group.length === maxLength);
  const bestPoints = Math.max(0, ...longestGroups.map(group => sum(group.map(item => item.score))));
  const bestGroup = [...longestGroups].sort((a, b) => sum(b.map(item => item.score)) - sum(a.map(item => item.score)))[0] || [];
  return { maxLength, bestPoints, bestGroup, groups };
}

function streakMetrics(schedule) {
  const stage = consecutiveStageMetrics(schedule, item => item.score >= 0);
  const extensions = sum(stage.groups.map(group => Math.max(0, group.length - 1)));
  return { maxLength: stage.maxLength, bestPoints: stage.bestPoints, extensions, bestGroup: stage.bestGroup };
}

function compareTuple(a, b, criteria) {
  for (const [key, direction] of criteria) {
    const av = num(a[key]);
    const bv = num(b[key]);
    if (eq(av, bv)) continue;
    return direction === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
  }
  return 0;
}

function rankRows(rows, criteria) {
  const sorted = [...rows].sort((a, b) => compareTuple(a, b, criteria) || String(a.playerId).localeCompare(String(b.playerId)));
  let rank = 0;
  let previous = null;
  return sorted.map((row, index) => {
    if (!previous || compareTuple(row, previous, criteria) !== 0) rank = index + 1;
    previous = row;
    return { ...row, rank };
  });
}

function typeStats(entries, matchType) {
  const selected = entries.filter(entry => entry.matchType === matchType);
  const scores = selected.map(entry => entry.score);
  return {
    games: selected.length,
    total: sum(scores),
    mvps: selected.filter(entry => entry.isMvp).length,
    positiveRate: selected.length ? selected.filter(entry => entry.score >= 0).length / selected.length : 0,
    average: mean(scores)
  };
}

function dominationEvent(entry, playerId) {
  const opponents = played(entry.match).filter(result => result.playerId !== playerId);
  const opponentAverage = opponents.length ? mean(opponents.map(result => result.score)) : 0;
  const margin = entry.score - opponentAverage;
  const isSolo = entry.score >= 0 && opponents.length > 0 && opponents.every(result => num(result.score) < 0);
  const isBigWin = opponents.length > 0 && margin >= 100;
  return { ...entry, opponentAverage, margin, isSolo, isBigWin, qualifies: isSolo || isBigWin };
}

function cumulativeSwing(entries) {
  let cumulative = 0;
  const values = [0];
  let signChanges = 0;
  let previousNonZeroSign = 0;
  for (const entry of entries) {
    cumulative += entry.score;
    values.push(cumulative);
    const sign = cumulative > 0 ? 1 : cumulative < 0 ? -1 : 0;
    if (sign !== 0) {
      if (previousNonZeroSign !== 0 && sign !== previousNonZeroSign) signChanges += 1;
      previousNonZeroSign = sign;
    }
  }
  return {
    cumulativeHigh: Math.max(...values),
    cumulativeLow: Math.min(...values),
    cumulativeSwing: Math.max(...values) - Math.min(...values),
    cumulativeSignChanges: signChanges,
    cumulativeValues: values
  };
}

function seasonMetrics(players, matches, season) {
  const seasonMatches = sortedMatches(matches.filter(match => match.season === season));
  const rows = [];

  for (const player of eligiblePlayers(players, season)) {
    const schedule = seasonMatches.map(match => {
      const result = playerResult(match, player.playerId);
      const absent = !result || result.isAbsent || result.score == null;
      return {
        match,
        result,
        absent,
        score: absent ? 0 : num(result.score),
        isMvp: !!(!absent && result.isMvp),
        matchType: match.matchType
      };
    });

    const entries = schedule.filter(item => !item.absent).map(item => ({
      matchId: item.match.matchId,
      date: item.match.date,
      round: item.match.round,
      season: item.match.season,
      matchType: item.match.matchType,
      venue: item.match.venue || "未填写场地",
      score: item.score,
      isMvp: item.isMvp,
      match: item.match
    }));

    const scores = entries.map(entry => entry.score);
    const positive = entries.filter(entry => entry.score >= 0);
    const mvpEntries = entries.filter(entry => entry.isMvp);
    const dominationEntries = entries.map(entry => dominationEvent(entry, player.playerId));
    const soloEntries = dominationEntries.filter(entry => entry.isSolo);
    const bigWins = dominationEntries.filter(entry => entry.isBigWin);
    const dominanceEntries = dominationEntries.filter(entry => entry.qualifies);
    const streak = streakMetrics(schedule);
    const mvpStage = consecutiveStageMetrics(schedule, item => item.isMvp);
    const cumulative = cumulativeSwing(entries);

    rows.push({
      playerId: player.playerId,
      player: player.name,
      schedule,
      entries,
      games: entries.length,
      total: sum(scores),
      average: mean(scores),
      positiveRate: entries.length ? positive.length / entries.length : 0,
      positiveTotal: sum(positive.map(entry => entry.score)),
      positiveAverage: mean(positive.map(entry => entry.score)),
      best: scores.length ? Math.max(...scores) : 0,
      worst: scores.length ? Math.min(...scores) : 0,
      mvps: mvpEntries.length,
      mvpTotal: sum(mvpEntries.map(entry => entry.score)),
      mvpAverage: mean(mvpEntries.map(entry => entry.score)),
      mvpBgr: sum(mvpEntries.map(entry => bgrValue(entry.score))),
      mvpBest: mvpEntries.length ? Math.max(...mvpEntries.map(entry => entry.score)) : 0,
      mvpRate: entries.length ? mvpEntries.length / entries.length : 0,
      longestMvp: mvpStage.maxLength,
      longestMvpPoints: mvpStage.bestPoints,
      longestMvpEvidence: mvpStage.bestGroup.map(item => ({
        matchId: item.match.matchId, date: item.match.date, round: item.match.round, season: item.match.season,
        matchType: item.match.matchType, venue: item.match.venue || "未填写场地", score: item.score, isMvp: item.isMvp
      })),
      longestPositiveEvidence: streak.bestGroup.map(item => ({
        matchId: item.match.matchId, date: item.match.date, round: item.match.round, season: item.match.season,
        matchType: item.match.matchType, venue: item.match.venue || "未填写场地", score: item.score, isMvp: item.isMvp
      })),
      four: typeStats(entries, "四人局"),
      five: typeStats(entries, "五人局"),
      soloCount: soloEntries.length,
      soloTotal: sum(soloEntries.map(entry => entry.score)),
      soloAverage: mean(soloEntries.map(entry => entry.score)),
      soloEntries,
      bgr: sum(scores.map(bgrValue)),
      longestBigStage: longestBoolean(schedule, item => !item.absent && item.score >= 50, { ignoreAbsent: true }),
      bigWinCount: bigWins.length,
      bigWinDominanceTotal: sum(bigWins.map(entry => entry.margin)),
      bigWinScoreTotal: sum(bigWins.map(entry => entry.score)),
      maxDominanceMargin: Math.max(0, ...bigWins.map(entry => entry.margin)),
      bigWins,
      dominanceTotal: sum(dominanceEntries.map(entry => entry.margin)),
      dominanceEntries,
      longestStreak: streak.maxLength,
      longestStreakPoints: streak.bestPoints,
      streakExtensions: streak.extensions,
      crashCount: entries.filter(entry => entry.score <= -40).length,
      crashTotal: sum(entries.filter(entry => entry.score <= -40).map(entry => entry.score)),
      crashWorst: Math.min(0, ...entries.filter(entry => entry.score <= -40).map(entry => entry.score)),
      longestParticipation: longestBoolean(schedule, item => !item.absent),
      longestAbsence: longestBoolean(schedule, item => item.absent),
      volatility: std(scores),
      singleRange: scores.length ? Math.max(...scores) - Math.min(...scores) : 0,
      ...cumulative
    });
  }

  addCompositeScores(rows, [
    { target: "championScore", formulaTarget: "championFormula", components: [
      ["total", 30, "总积分", "分"],
      ["average", 20, "场均积分", "分/场"],
      ["mvpTotal", 15, "MVP场次累计积分", "分"],
      ["positiveTotal", 15, "正分场次累计积分", "分"],
      ["longestMvpPoints", 10, "最长连续MVP阶段积分", "分"],
      ["longestStreakPoints", 10, "最长连续正分阶段积分", "分"]
    ]},
    { target: "mvpValueScore", formulaTarget: "mvpValueFormula", components: [
      ["mvps", 30, "MVP场次", "次"],
      ["mvpRate", 20, "MVP率", "%"],
      ["mvpTotal", 20, "MVP场次累计积分", "分"],
      ["longestMvp", 10, "最长连续MVP", "场"],
      ["longestMvpPoints", 10, "最长连续MVP阶段积分", "分"],
      ["mvpBgr", 10, "MVP场次BGR", "BGR"]
    ]}
  ]);

  return { season, matches: seasonMatches, rows };
}

function normalizedScores(rows, key) {
  const values = rows.map(row => num(row[key]));
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (eq(high, low)) {
    const shared = eq(high, 0) ? 0 : 100;
    return Object.fromEntries(rows.map(row => [row.playerId, shared]));
  }
  return Object.fromEntries(rows.map(row => [row.playerId, (num(row[key]) - low) / (high - low) * 100]));
}

function addCompositeScores(rows, definitions) {
  for (const definition of definitions) {
    const normalized = Object.fromEntries(definition.components.map(([key]) => [key, normalizedScores(rows, key)]));
    for (const row of rows) {
      const formula = definition.components.map(([key, weight, label, unit]) => {
        const standardScore = normalized[key][row.playerId];
        const contribution = standardScore * weight / 100;
        return {
          指标: label,
          权重: `${weight}%`,
          原始值: formatMetric(row[key], unit),
          标准分: Number(standardScore.toFixed(2)),
          贡献分: Number(contribution.toFixed(2))
        };
      });
      row[definition.target] = Number(sum(formula.map(item => item.贡献分)).toFixed(4));
      row[definition.formulaTarget] = formula;
    }
  }
}

function getPath(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}

function flattenFor(rows, fields) {
  return rows.map(row => {
    const output = { ...row };
    for (const [destination, path] of Object.entries(fields)) output[destination] = getPath(row, path);
    return output;
  });
}

function formatMetric(value, unit) {
  if (unit === "%") return `${(num(value) * 100).toFixed(2)}%`;
  if (["分/场", "综合分", "波动指数"].includes(unit)) return `${num(value).toFixed(2)}${unit}`;
  return `${Number.isInteger(num(value)) ? num(value) : num(value).toFixed(2)}${unit || ""}`;
}

function criteriaText(criteria, row) {
  return criteria.map(criterion => ({ 指标: criterion.label, 数值: formatMetric(row[criterion.key], criterion.unit) }));
}

function evidenceFor(id, row) {
  if (id === "H001") return row.longestPositiveEvidence || row.entries;
  if (id === "H003") return row.entries.filter(entry => entry.isMvp);
  if (id === "H010") return row.soloEntries;
  if (id === "H016") return row.bigWins.map(entry => ({ ...entry, margin: Number(entry.margin.toFixed(2)) }));
  return [];
}

function evaluateAward(scope, id, rows, criteria, { eligibility = () => true, requirePositive = false } = {}) {
  const catalog = byId[id];
  const eligible = rows.filter(eligibility);
  if (!eligible.length) return { scope, honorId: id, catalog, status: "NOT_AWARDED", winners: [], ranking: [], criteria };

  const tuple = criteria.map(criterion => [criterion.key, criterion.dir]);
  const ranking = rankRows(eligible, tuple);
  const top = ranking[0];
  if (requirePositive && num(top[criteria[0].key]) <= 0) {
    return { scope, honorId: id, catalog, status: "NOT_AWARDED", winners: [], ranking, criteria, reason: "无人达到最低触发条件" };
  }

  const tied = ranking.filter(row => compareTuple(row, top, tuple) === 0);
  const pending = !catalog.allowTie && tied.length > 1;
  const winners = pending ? [] : (catalog.allowTie ? tied : [top]);
  return {
    scope,
    honorId: id,
    catalog,
    status: pending ? "PENDING_TIEBREAK" : "LIVE_CALCULATED",
    winners,
    ranking,
    pending,
    criteria,
    summary: pending
      ? `${scope} ${catalog.name}全部比较条件仍完全相同，暂不颁发。`
      : `${winners.map(row => row.player).join(" / ")}获得${scope}${catalog.name}。`
  };
}

function awardObject(result, row) {
  const catalog = result.catalog;
  const primaryKey = result.criteria?.[0]?.key;
  const formula = catalog.honorId === "H001"
    ? row.championFormula
    : catalog.honorId === "H003"
      ? row.mvpValueFormula
      : criteriaText(result.criteria || [], row);
  return {
    ownerPlayerId: row.playerId,
    scope: result.scope,
    honorId: catalog.honorId,
    name: catalog.name,
    grade: catalog.grade,
    category: catalog.category,
    value: num(row[primaryKey] ?? 1),
    points: catalog.points,
    status: result.status,
    details: {
      rule: catalog.rule,
      unit: catalog.unit,
      winner: row.player,
      winners: result.winners.map(winner => winner.player),
      officialValue: num(row[primaryKey] ?? 1),
      calculationStatus: "LIVE_RECALCULATED_V1_8_1_RULES",
      ranking: result.ranking.map(ranked => ({
        playerId: ranked.playerId,
        player: ranked.player,
        value: num(ranked[primaryKey] ?? 0),
        unit: catalog.unit,
        rank: ranked.rank,
        note: criteriaText(result.criteria || [], ranked).map(item => `${item.指标} ${item.数值}`).join(" · ")
      })),
      formula,
      evidence: evidenceFor(catalog.honorId, row),
      summary: result.summary
    }
  };
}

function seasonAwards(players, matches, season) {
  const base = seasonMetrics(players, matches, season);
  const rows = base.rows;
  const results = [];
  const push = (id, sourceRows, criteria, options) => {
    const result = evaluateAward(season, id, sourceRows, criteria, options);
    results.push(result);
    return result;
  };

  push("H001", rows, [
    { key: "championScore", dir: "desc", label: "总冠军综合评分", unit: "综合分" },
    { key: "total", dir: "desc", label: "总积分", unit: "分" },
    { key: "average", dir: "desc", label: "场均积分", unit: "分/场" },
    { key: "mvpTotal", dir: "desc", label: "MVP场次累计积分", unit: "分" },
    { key: "positiveTotal", dir: "desc", label: "正分场次累计积分", unit: "分" },
    { key: "longestMvpPoints", dir: "desc", label: "最长连续MVP阶段积分", unit: "分" },
    { key: "longestStreakPoints", dir: "desc", label: "最长连续正分阶段积分", unit: "分" }
  ], { eligibility: row => row.games > 0 });

  push("H003", rows, [
    { key: "mvpValueScore", dir: "desc", label: "最有价值牌手综合评分", unit: "综合分" },
    { key: "mvps", dir: "desc", label: "MVP场次", unit: "次" },
    { key: "mvpRate", dir: "desc", label: "MVP率", unit: "%" },
    { key: "mvpTotal", dir: "desc", label: "MVP场次累计积分", unit: "分" },
    { key: "longestMvp", dir: "desc", label: "最长连续MVP", unit: "场" },
    { key: "longestMvpPoints", dir: "desc", label: "最长连续MVP阶段积分", unit: "分" },
    { key: "mvpBgr", dir: "desc", label: "MVP场次BGR", unit: "BGR" }
  ], { eligibility: row => row.games > 0, requirePositive: true });

  const four = flattenFor(rows, { typeTotal: "four.total", typeMvps: "four.mvps", typeRate: "four.positiveRate", typeGames: "four.games" });
  push("H011", four, [
    { key: "typeTotal", dir: "desc", label: "四人局总积分", unit: "分" },
    { key: "typeMvps", dir: "desc", label: "四人局MVP", unit: "次" },
    { key: "typeRate", dir: "desc", label: "四人局正分率", unit: "%" }
  ], { eligibility: row => row.typeGames > 0 });

  const five = flattenFor(rows, { typeTotal: "five.total", typeMvps: "five.mvps", typeRate: "five.positiveRate", typeGames: "five.games" });
  push("H012", five, [
    { key: "typeTotal", dir: "desc", label: "五人局总积分", unit: "分" },
    { key: "typeMvps", dir: "desc", label: "五人局MVP", unit: "次" },
    { key: "typeRate", dir: "desc", label: "五人局正分率", unit: "%" }
  ], { eligibility: row => row.typeGames > 0 });

  push("H005", rows, [
    { key: "positiveRate", dir: "desc", label: "正分率", unit: "%" },
    { key: "positiveTotal", dir: "desc", label: "正分累计积分", unit: "分" },
    { key: "positiveAverage", dir: "desc", label: "正分场均", unit: "分/场" }
  ], { eligibility: row => row.games > 0 });

  push("H007", rows, [
    { key: "games", dir: "desc", label: "参赛场次", unit: "场" },
    { key: "longestParticipation", dir: "desc", label: "最长连续参赛", unit: "场" }
  ]);

  push("H010", rows, [
    { key: "soloCount", dir: "desc", label: "独赢场次", unit: "场" },
    { key: "soloTotal", dir: "desc", label: "独赢累计积分", unit: "分" },
    { key: "soloAverage", dir: "desc", label: "独赢场均", unit: "分/场" }
  ], { requirePositive: true });

  push("H008", rows, [
    { key: "bgr", dir: "desc", label: "BGR指数", unit: "BGR" },
    { key: "best", dir: "desc", label: "单场最高", unit: "分" },
    { key: "longestBigStage", dir: "desc", label: "最长连续大场面", unit: "场" }
  ], { eligibility: row => row.games > 0 });

  push("H016", rows, [
    { key: "bigWinCount", dir: "desc", label: "大胜场次", unit: "场" },
    { key: "bigWinDominanceTotal", dir: "desc", label: "累计统治分差", unit: "分" },
    { key: "maxDominanceMargin", dir: "desc", label: "最大统治分差", unit: "分" }
  ], { requirePositive: true });

  push("H006", rows, [
    { key: "longestStreak", dir: "desc", label: "最长连庄", unit: "场" },
    { key: "longestStreakPoints", dir: "desc", label: "最长连庄阶段积分", unit: "分" },
    { key: "streakExtensions", dir: "desc", label: "连庄总次数", unit: "次" }
  ], { eligibility: row => row.games > 0 });

  push("H021", rows, [
    { key: "crashCount", dir: "desc", label: "≤-40场次", unit: "场" },
    { key: "crashTotal", dir: "asc", label: "翻车累计积分", unit: "分" },
    { key: "crashWorst", dir: "asc", label: "最低单场", unit: "分" }
  ], { requirePositive: true });

  push("H017", rows, [
    { key: "total", dir: "asc", label: "总积分", unit: "分" },
    { key: "positiveRate", dir: "asc", label: "正分率", unit: "%" },
    { key: "worst", dir: "asc", label: "单场最低", unit: "分" }
  ]);

  push("H019", rows, [
    { key: "games", dir: "asc", label: "参赛场次", unit: "场" },
    { key: "longestAbsence", dir: "desc", label: "最长连续缺席", unit: "场" }
  ]);

  push("H018", rows, [
    { key: "cumulativeSwing", dir: "desc", label: "累计积分最大波动幅度", unit: "分" },
    { key: "singleRange", dir: "desc", label: "单场最高/最低积分差", unit: "分" },
    { key: "cumulativeSignChanges", dir: "desc", label: "累计积分正负转换次数", unit: "次" }
  ], { eligibility: row => row.games > 0 });

  const awards = [];
  for (const result of results) {
    for (const winner of result.winners) awards.push(awardObject(result, winner));
  }

  return { season, rows, results, awards };
}

export function calculateHonorSystem(players, matches) {
  const seasons = [...new Set((matches || []).map(match => match.season))]
    .filter(Boolean)
    .sort((a, b) => seasonNumber(a) - seasonNumber(b));
  const honors = Object.fromEntries(players.map(player => [player.playerId, []]));
  const board = [];
  const seasonMetricsMap = {};

  for (const season of seasons) {
    const calculation = seasonAwards(players, matches, season);
    seasonMetricsMap[season] = calculation.rows;
    calculation.awards.forEach(award => honors[award.ownerPlayerId].push(award));
    calculation.results.forEach(result => board.push({
      scope: season,
      honorId: result.honorId,
      name: result.catalog.name,
      grade: result.catalog.grade,
      category: result.catalog.category,
      status: result.status,
      winners: result.winners.map(winner => winner.player),
      winnerIds: result.winners.map(winner => winner.playerId),
      value: result.ranking[0] ? num(result.ranking[0][result.criteria?.[0]?.key]) : null,
      unit: result.catalog.unit,
      summary: result.summary || result.reason || "",
      allowTie: result.catalog.allowTie
    }));
  }

  return { honors, board, seasons, seasonMetrics: seasonMetricsMap, catalog: HONOR_CATALOG };
}

function recentEntries(matches,pid,n=5){const arr=[];for(const m of sortedMatches(matches)){const r=playerResult(m,pid);if(r&&!r.isAbsent&&r.score!=null)arr.push({matchId:m.matchId,season:m.season,round:m.round,date:m.date,matchType:m.matchType,venue:m.venue||'未填写场地',score:num(r.score),isMvp:!!r.isMvp});}return arr.slice(-n);}
function slope(values){if(values.length<2)return 0;const xs=values.map((_,i)=>i),xm=mean(xs),ym=mean(values);const den=sum(xs.map(x=>(x-xm)**2));return den?sum(xs.map((x,i)=>(x-xm)*(values[i]-ym)))/den:0;}
function minmax(rows,key){const vals=rows.map(x=>num(x[key])),lo=Math.min(...vals),hi=Math.max(...vals);return x=>eq(hi,lo)?.5:(num(x[key])-lo)/(hi-lo);}
function weightedRecent(entries){const base=[.10,.15,.20,.25,.30].slice(5-entries.length),ws=sum(base);return {score:entries.length?sum(entries.map((x,i)=>x.score*base[i]))/ws:0,positive:entries.length?sum(entries.map((x,i)=>(x.score>=0?1:0)*base[i]))/ws:0,mvp:entries.length?sum(entries.map((x,i)=>(x.isMvp?1:0)*base[i]))/ws:0,bgr:entries.length?sum(entries.map((x,i)=>bgrValue(x.score)*base[i]))/ws:0};}
function ordinalRanks(rows,key,dir='desc'){const sorted=[...rows].sort((a,b)=>dir==='asc'?num(a[key])-num(b[key]):num(b[key])-num(a[key])||String(a.playerId).localeCompare(String(b.playerId)));let rank=0,prev=null;const out={};sorted.forEach((row,index)=>{const value=num(row[key]);if(index===0||!eq(value,prev))rank=index+1;prev=value;out[row.playerId]=rank;});return out;}
function seasonRatingLabel(rating){if(rating>=92)return '统治级赛季';if(rating>=86)return '冠军级赛季';if(rating>=80)return '顶尖赛季';if(rating>=74)return '强势赛季';if(rating>=68)return '稳定赛季';if(rating>=62)return '合格赛季';return '调整赛季';}
function careerRatingLabel(rating){if(rating>=92)return '历史级门面';if(rating>=86)return '冠军级核心';if(rating>=80)return '全明星核心';if(rating>=74)return '高水平主力';if(rating>=68)return '稳定主力';if(rating>=62)return '可靠轮换';if(rating>=56)return '竞争型牌手';return '调整中的牌手';}
function careerMetrics(players,matches,honors={}){
  const seasons=[...new Set((matches||[]).map(m=>m.season).filter(Boolean))].sort((a,b)=>seasonNumber(a)-seasonNumber(b));
  const seasonRows={};
  seasons.forEach(season=>{
    const rows=players.map(p=>{
      const entries=recentEntries(matches.filter(m=>m.season===season),p.playerId,999),scores=entries.map(x=>x.score),games=entries.length,mvps=entries.filter(x=>x.isMvp).length;
      return {playerId:p.playerId,player:p.name,season,games,total:sum(scores),average:mean(scores),positiveRate:games?entries.filter(x=>x.score>=0).length/games:0,mvps,mvpRate:games?mvps/games:0,bgr:sum(scores.map(bgrValue)),bgrPerGame:games?sum(scores.map(bgrValue))/games:0,best:games?Math.max(...scores):null,worst:games?Math.min(...scores):null,volatility:std(scores)};
    });
    const active=rows.filter(x=>x.games>0);
    if(active.length){
      const nTotal=minmax(active,'total'),nAvg=minmax(active,'average'),nPos=minmax(active,'positiveRate'),nMvp=minmax(active,'mvpRate'),nBgr=minmax(active,'bgrPerGame'),nGames=minmax(active,'games');
      active.forEach(x=>{x.rating=Math.round(50+49*(nTotal(x)*.35+nAvg(x)*.20+nPos(x)*.15+nMvp(x)*.15+nBgr(x)*.10+nGames(x)*.05));x.ratingLabel=seasonRatingLabel(x.rating);});
      const ratingRanks=ordinalRanks(active,'rating'),totalRanks=ordinalRanks(active,'total');
      active.forEach(x=>{x.ratingRank=ratingRanks[x.playerId];x.totalRank=totalRanks[x.playerId];});
    }
    seasonRows[season]=rows;
  });
  let rows=players.map(p=>{
    const entries=recentEntries(matches,p.playerId,999),scores=entries.map(x=>x.score),games=entries.length,mvps=entries.filter(x=>x.isMvp).length;
    const hs=honors?.[p.playerId]||[],honorPoints=sum(hs.map(h=>h.points||0));
    const seasonHistory=seasons.map(s=>seasonRows[s].find(x=>x.playerId===p.playerId)).filter(x=>x&&x.games>0);
    return {playerId:p.playerId,player:p.name,games,total:sum(scores),average:mean(scores),positiveRate:games?entries.filter(x=>x.score>=0).length/games:0,mvps,mvpRate:games?mvps/games:0,bgr:sum(scores.map(bgrValue)),bgrPerGame:games?sum(scores.map(bgrValue))/games:0,best:games?Math.max(...scores):null,worst:games?Math.min(...scores):null,volatility:std(scores),honorPoints,honorCount:hs.length,gradeA:hs.filter(h=>h.grade==='A').length,gradeB:hs.filter(h=>h.grade==='B').length,titles:hs.filter(h=>h.honorId==='H001').length,seasonHistory};
  });
  const active=rows.filter(x=>x.games>0),nTotal=minmax(active,'total'),nAvg=minmax(active,'average'),nPos=minmax(active,'positiveRate'),nMvp=minmax(active,'mvpRate'),nBgr=minmax(active,'bgrPerGame'),nHonor=minmax(active,'honorPoints');
  rows=rows.map(r=>({...r,overallRating:r.games?Math.round(50+49*(nTotal(r)*.25+nAvg(r)*.20+nPos(r)*.15+nMvp(r)*.15+nBgr(r)*.10+nHonor(r)*.15)):50}));
  const ratingRanks=ordinalRanks(rows,'overallRating'),totalRanks=ordinalRanks(rows,'total'),avgRanks=ordinalRanks(rows,'average'),positiveRanks=ordinalRanks(rows,'positiveRate'),mvpRanks=ordinalRanks(rows,'mvpRate'),bgrRanks=ordinalRanks(rows,'bgrPerGame'),honorRanks=ordinalRanks(rows,'honorPoints');
  return Object.fromEntries(rows.map(r=>{
    const history=[...r.seasonHistory].sort((a,b)=>seasonNumber(a.season)-seasonNumber(b.season)),bestSeason=[...history].sort((a,b)=>b.rating-a.rating||b.total-a.total)[0]||null;
    let trend='跨赛季表现整体平稳';const ratings=history.map(x=>x.rating);
    if(ratings.length>=2&&ratings.every((x,i)=>i===0||x>ratings[i-1]))trend='跨赛季评分持续上升';
    else if(ratings.length>=2&&ratings.every((x,i)=>i===0||x<ratings[i-1]))trend='跨赛季评分呈下降趋势';
    else if(bestSeason&&bestSeason.season===history.at(-1)?.season)trend='当前赛季达到生涯阶段高点';
    else if(bestSeason)trend=`生涯峰值出现在${bestSeason.season}`;
    return [r.playerId,{...r,overallRank:ratingRanks[r.playerId],totalRank:totalRanks[r.playerId],averageRank:avgRanks[r.playerId],positiveRank:positiveRanks[r.playerId],mvpRank:mvpRanks[r.playerId],bgrRank:bgrRanks[r.playerId],honorRank:honorRanks[r.playerId],ratingLabel:careerRatingLabel(r.overallRating),bestSeason,trend,seasonRange:history.length?`${history[0].season}–${history.at(-1).season}`:'—'}];
  }));
}
function computePower(players,matches){
  const latestSeason=[...new Set(matches.map(m=>m.season))].sort((a,b)=>seasonNumber(a)-seasonNumber(b)).at(-1);
  let rows=players.map(p=>{
    const recent=recentEntries(matches,p.playerId,5),w=weightedRecent(recent);
    const seasonEntries=recentEntries(matches.filter(m=>m.season===latestSeason),p.playerId,999);
    const seasonScores=seasonEntries.map(x=>x.score),seasonTotal=sum(seasonScores),seasonGames=seasonScores.length;
    const season={id:latestSeason||'—',games:seasonGames,total:seasonTotal,average:mean(seasonScores),positiveRate:seasonGames?seasonEntries.filter(x=>x.score>=0).length/seasonGames:0,mvps:seasonEntries.filter(x=>x.isMvp).length,bgr:sum(seasonScores.map(bgrValue)),best:seasonGames?Math.max(...seasonScores):null,worst:seasonGames?Math.min(...seasonScores):null,volatility:std(seasonScores)};
    return {playerId:p.playerId,player:p.name,recent,weightedScore:w.score,recentPositive:w.positive,recentMvp:w.mvp,recentBgr:w.bgr,trend:slope(recent.map(x=>x.score)),vsSeason:w.score-season.average,recentTotal:sum(recent.map(x=>x.score)),recentAverage:mean(recent.map(x=>x.score)),recentStd:std(recent.map(x=>x.score)),seasonAverage:season.average,season,latest:recent.at(-1)||null};
  });
  const totalRanks=ordinalRanks(rows.map(r=>({...r,seasonTotal:r.season.total})),'seasonTotal');
  const avgRanks=ordinalRanks(rows.map(r=>({...r,seasonAvg:r.season.average})),'seasonAvg');
  const positiveRanks=ordinalRanks(rows.map(r=>({...r,seasonPositive:r.season.positiveRate})),'seasonPositive');
  const mvpRanks=ordinalRanks(rows.map(r=>({...r,seasonMvps:r.season.mvps})),'seasonMvps');
  const bgrRanks=ordinalRanks(rows.map(r=>({...r,seasonBgr:r.season.bgr})),'seasonBgr');
  rows=rows.map(r=>({...r,season:{...r.season,totalRank:totalRanks[r.playerId],averageRank:avgRanks[r.playerId],positiveRank:positiveRanks[r.playerId],mvpRank:mvpRanks[r.playerId],bgrRank:bgrRanks[r.playerId]}}));
  const nScore=minmax(rows,'weightedScore'),nPos=minmax(rows,'recentPositive'),nMvp=minmax(rows,'recentMvp'),nBgr=minmax(rows,'recentBgr'),nTrend=minmax(rows,'trend'),nVs=minmax(rows,'vsSeason');
  rows=rows.map(r=>({...r,powerIndex:Math.round(100*(nScore(r)*.35+nPos(r)*.20+nMvp(r)*.15+nBgr(r)*.10+nTrend(r)*.10+nVs(r)*.10))})).sort((a,b)=>b.powerIndex-a.powerIndex||b.weightedScore-a.weightedScore||a.playerId.localeCompare(b.playerId));
  return rows.map((r,i)=>({...r,rank:i+1}));
}
function statusLabel(r){if(r.recent.length<3)return '🕒 样本不足';const last3=r.recent.slice(-3).map(x=>x.score);if(r.latest?.isMvp&&r.powerIndex>=55)return '👑 MVP状态';if(last3.length===3&&last3.every(x=>x>=0))return '🎯 连续正分';if(last3.length===3&&last3[0]<last3[1]&&last3[1]<last3[2])return r.powerIndex>=45?'🚀 强势上升':'📈 回暖中';if(last3.length===3&&last3[0]>last3[1]&&last3[1]>last3[2])return r.powerIndex>=55?'🎢 高开低走':'📉 状态下滑';if(r.recent.filter(x=>x.score>=50).length>=2)return '⚡ 大场面模式';if(r.recentStd>=35)return '🌊 表现起伏';if(r.powerIndex>=85)return '🔥 炙手可热';if(r.powerIndex>=70)return '🔥 手感火热';if(r.powerIndex>=55)return '✅ 状态稳定';if(r.powerIndex>=45)return '➖ 状态平平';if(r.powerIndex>=30)return '🌧 状态低迷';return '🧊 深陷低谷';}
function archetypes(rows){const avgRank=[...rows].sort((a,b)=>b.seasonAverage-a.seasonAverage).map(x=>x.playerId),posRank=[...rows].sort((a,b)=>b.recentPositive-a.recentPositive).map(x=>x.playerId),bgrRank=[...rows].sort((a,b)=>b.recentBgr-a.recentBgr).map(x=>x.playerId),volRank=[...rows].sort((a,b)=>b.recentStd-a.recentStd).map(x=>x.playerId);return Object.fromEntries(rows.map(r=>{let t='稳定轮换';if(avgRank.indexOf(r.playerId)<2&&posRank.indexOf(r.playerId)<2&&r.recentMvp>0)t='全能型核心';else if(avgRank[0]===r.playerId)t='得分型牌手';else if(posRank[0]===r.playerId)t='稳定型牌手';else if(bgrRank[0]===r.playerId&&r.recentBgr>0)t='大场面牌手';else if(volRank[0]===r.playerId&&r.recentStd>25)t='高波动攻击手';return [r.playerId,t];}));}
function seasonAssessment(r){
  const s=r.season||{};
  if(!s.games)return {label:'赛季样本不足',summary:`${r.player}在当前赛季暂无有效参赛记录。`,outlook:'需要更多正式比赛后才能形成完整的赛季定位。'};
  let label='中游竞争者',outlook='当前赛季仍有提升空间，后续关键在于提高正分延续性。';
  if(s.totalRank===1){label='赛季领跑者';outlook='目前掌握积分榜主动权，需要继续保持稳定输出并控制低分场次。';}
  else if(s.totalRank===2){label='争冠集团';outlook='与榜首仍处于可追赶范围，连续正分或一场大胜都可能改变争冠格局。';}
  else if(s.totalRank===3){label='中游核心';outlook='整体处于中游位置，需要通过稳定正分和MVP表现向前两名施压。';}
  else if(s.total<0){label='赛季追赶者';outlook='赛季累计积分仍为负，首要任务是缩小负分并建立连续正分阶段。';}
  else {label='上升追赶者';outlook='目前尚未进入领先集团，但保持正分可以逐步缩小积分差距。';}
  const summary=`${s.id}已出战${s.games}场，累计${s.total>=0?'+':''}${s.total}分，积分排名第${s.totalRank}；场均${s.average.toFixed(2)}分，正分率${(s.positiveRate*100).toFixed(1)}%，取得${s.mvps}次MVP，BGR指数${s.bgr}。`;
  return {label,summary,outlook};
}
function careerAssessment(r){
  const c=r.career||{};
  if(!c.games)return {label:'生涯样本不足',summary:`${r.player}暂无足够的历季正式比赛数据。`,evaluation:'需要更多赛季数据后才能形成长期定位。',outlook:'当前以积累有效比赛样本为主。',strengths:[],risks:[]};
  const strengths=[],risks=[];
  if(c.totalRank<=2)strengths.push(`S1–S3累计积分排名第${c.totalRank}`);
  if(c.averageRank<=2)strengths.push(`生涯场均排名第${c.averageRank}`);
  if(c.positiveRank<=2)strengths.push(`生涯正分率排名第${c.positiveRank}`);
  if(c.mvpRank<=2)strengths.push(`MVP效率排名第${c.mvpRank}`);
  if(c.honorRank<=2&&c.honorPoints>0)strengths.push(`官方荣誉积分排名第${c.honorRank}`);
  if(c.total<0)risks.push('历季累计积分仍为负，长期稳定输出不足');
  if(c.positiveRate<.5)risks.push(`生涯正分率${(c.positiveRate*100).toFixed(1)}%，低于五成`);
  if(c.volatility>=35)risks.push(`生涯波动指数${c.volatility.toFixed(1)}，比赛上下限差距较大`);
  if(!risks.length)risks.push('长期数据结构较均衡，主要观察能否继续抬高个人峰值');
  const best=c.bestSeason;
  const summary=`${c.seasonRange}共出战${c.games}场，累计${c.total>=0?'+':''}${c.total}分，场均${c.average.toFixed(2)}分，正分率${(c.positiveRate*100).toFixed(1)}%，取得${c.mvps}次MVP、BGR ${c.bgr}，累计${c.honorPoints}荣誉分。`;
  const evaluation=`${r.player}的MSL生涯定位为“${c.ratingLabel}”，综合评分${c.overallRating}，联盟排名第${c.overallRank}。${c.trend}${best?`，其中${best.season}以${best.rating}分成为目前评分最高的单赛季。`:''}${strengths.length?`长期优势主要体现在${strengths.slice(0,3).join('、')}。`:''}`;
  const outlook=c.overallRank<=2?'已经进入联盟长期核心层，后续重点是把高水平赛季转化为更多A级荣誉和冠军。':c.total>=0?'具备进入长期核心层的基础，提升MVP效率与高分场次将明显拉高综合评分。':'目前仍处于生涯追赶阶段，优先目标是改善累计积分、正分率与赛季稳定性。';
  return {label:c.ratingLabel,summary,evaluation,outlook,strengths,risks};
}
function reportFor(r,all){
  const totalRank=[...all].sort((a,b)=>b.recentTotal-a.recentTotal).findIndex(x=>x.playerId===r.playerId)+1;
  const trendKey=r.movement>0||r.indexChange>=8?'up':r.movement<0||r.indexChange<=-8?'down':'hold';
  const headline=trendKey==='up'?'行情上涨':trendKey==='down'?'行情下跌':'持续观望';
  const latest=r.latest,strengths=[],risks=[];
  if(totalRank===1)strengths.push(`最近5场累计${r.recentTotal>=0?'+':''}${r.recentTotal}，同期排名第1`);
  if(r.recentPositive>=.6)strengths.push(`近期正分率${(r.recentPositive*100).toFixed(0)}%`);
  if(r.recent.filter(x=>x.isMvp).length)strengths.push(`最近5场拿到${r.recent.filter(x=>x.isMvp).length}次MVP`);
  if(r.recent.filter(x=>x.score>=50).length)strengths.push(`出现${r.recent.filter(x=>x.score>=50).length}场50+大场面`);
  if(r.recentStd>=35)risks.push(`近期波动指数${r.recentStd.toFixed(1)}，上下限差距较大`);
  if(r.recent.filter(x=>x.score<0).length>=3)risks.push('最近5场负分次数偏多');
  if(r.weightedScore<r.seasonAverage)risks.push(`近期加权表现低于赛季场均${r.seasonAverage.toFixed(1)}`);
  if(!risks.length)risks.push('当前没有明显数据预警，重点观察状态延续性');
  const direction=r.movement>0?`实力榜上升${r.movement}位`:r.movement<0?`实力榜下降${Math.abs(r.movement)}位`:'实力榜位置保持不变';
  const summary=`${r.player}目前位列MSL实力榜第${r.rank}，状态指数${r.powerIndex}。${direction}。最近5场累计${r.recentTotal>=0?'+':''}${r.recentTotal}，${latest?`最新一场${latest.score>=0?'+':''}${latest.score}${latest.isMvp?'并获得MVP':''}`:'近期暂无有效比赛'}。`;
  const next=latest?.isMvp?'下一场重点观察能否延续MVP级输出，并在精准对位中建立稳定吃分对象。':r.powerIndex<45?'下一场重点是止住负分趋势，提高整场稳定性。':'下一场重点观察正分延续性与关键局爆发。';
  const seasonView=seasonAssessment(r),careerView=careerAssessment(r);
  return {trendKey,headline,summary,strengths:strengths.length?strengths:['近期表现接近个人常态，暂无特别突出的单项'],risks,next,seasonLabel:seasonView.label,seasonSummary:seasonView.summary,seasonOutlook:seasonView.outlook,careerLabel:careerView.label,careerSummary:careerView.summary,careerEvaluation:careerView.evaluation,careerOutlook:careerView.outlook,careerStrengths:careerView.strengths,careerRisks:careerView.risks};
}
export function buildMslStatusCenter(players,matches,honors={}){
  const current=computePower(players,matches),previous=computePower(players,sortedMatches(matches).slice(0,-1));
  const prevBy=Object.fromEntries(previous.map(x=>[x.playerId,x])),careerBy=careerMetrics(players,matches,honors);
  let rows=current.map(r=>{const prev=prevBy[r.playerId];return {...r,career:careerBy[r.playerId],movement:prev?prev.rank-r.rank:0,indexChange:prev?r.powerIndex-prev.powerIndex:0};});
  const types=archetypes(rows);rows=rows.map(r=>({...r,label:statusLabel(r),archetype:types[r.playerId]}));rows=rows.map(r=>({...r,report:reportFor(r,rows)}));
  const hottest=rows[0],coldest=rows.at(-1),riser=[...rows].sort((a,b)=>b.movement-a.movement||b.indexChange-a.indexChange)[0],volatile=[...rows].sort((a,b)=>b.recentStd-a.recentStd)[0],overall=[...rows].sort((a,b)=>b.career.overallRating-a.career.overallRating||a.playerId.localeCompare(b.playerId))[0];
  const latest=sortedMatches(matches).at(-1);let gameRecap=null;
  if(latest){const pp=played(latest).sort((a,b)=>num(b.score)-num(a.score)),top=pp[0],second=pp[1],bottom=pp.at(-1);gameRecap={title:`${top?.player||'本场赢家'}领跑最新一轮，${bottom?.player||'末位牌手'}承压`,meta:`${latest.season} 第${latest.round}局 · ${latest.date} · ${latest.venue||'未填写场地'}`,body:`${top?.player||'—'}以${top?`${num(top.score)>=0?'+':''}${num(top.score)}`:'—'}取得全场最高分${top?.isMvp?'并拿下MVP':''}，领先第二名${top&&second?num(top.score)-num(second.score):0}分；全场最大分差${top&&bottom?num(top.score)-num(bottom.score):0}分。`,scores:pp.map(x=>({player:x.player,score:num(x.score),isMvp:!!x.isMvp}))};}
  const storylines=[`🔥 当前最火热：${hottest.player}，状态指数${hottest.powerIndex}。`,`🧊 当前最低迷：${coldest.player}，状态指数${coldest.powerIndex}。`,`🏅 生涯综合评分最高：${overall.player}，OVR ${overall.career.overallRating}。`,`📈 行情上升最快：${riser.player}，${riser.movement>0?`实力榜上升${riser.movement}位`:`指数变化${riser.indexChange>=0?'+':''}${riser.indexChange}`}。`,`🌊 近期波动最大：${volatile.player}，波动指数${volatile.recentStd.toFixed(1)}。`];
  return {rankings:rows,storylines,gameRecap,methodology:'状态指数：最近5场加权净分35% + 正分率20% + MVP15% + BGR10% + 走势10% + 相对当前赛季表现10%。生涯综合评分（OVR）：S1至当前全部赛季累计积分25% + 生涯场均20% + 生涯正分率15% + MVP率15% + 场均BGR10% + 官方荣誉积分15%，按联盟相对表现换算为50–99分。两套评分均不影响官方积分、荣誉或GOAT计算。'};
}
