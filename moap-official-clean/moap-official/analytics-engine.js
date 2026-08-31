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

export function getMvpStarLevel(score) {
  score = num(score);
  if (score >= 100) return 5;
  if (score >= 80) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  return 1;
}

export function formatMvpStars(level) {
  return "★".repeat(Math.max(0, Math.min(5, Math.trunc(num(level)))));
}

export function aggregateMvpStars(entries = [], games = entries.length) {
  const mvpEntries = entries.filter(entry => entry?.isMvp).map(entry => {
    const starLevel = getMvpStarLevel(entry.score);
    return { ...entry, starLevel, starText: formatMvpStars(starLevel) };
  });
  const count = level => mvpEntries.filter(entry => entry.starLevel === level).length;
  const oneStar = count(1), twoStar = count(2), threeStar = count(3), fourStar = count(4), fiveStar = count(5);
  return {
    totalStars: sum(mvpEntries.map(entry => entry.starLevel)),
    mvpCount: mvpEntries.length,
    oneStar, twoStar, threeStar, fourStar, fiveStar,
    fourPlus: fourStar + fiveStar,
    threePlus: threeStar + fourStar + fiveStar,
    mvpPoints: sum(mvpEntries.map(entry => entry.score)),
    mvpRate: games ? mvpEntries.length / games : 0,
    entries: mvpEntries
  };
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


function comebackMetrics(entries) {
  if (!entries || entries.length < 2) {
    return { comebackAmplitude:0, comebackPositiveTotal:0, comebackMvps:0, comebackLow:0, comebackPeak:0, comebackLowDate:null, comebackPeakDate:null, comebackEvidence:[] };
  }
  let cumulative = 0;
  const points = entries.map(entry => { cumulative += num(entry.score); return cumulative; });
  let lowIndex = 0, lowValue = points[0];
  let best = { amplitude:0, positiveTotal:0, mvps:0, lowIndex:-1, peakIndex:-1, low:0, peak:0 };
  for (let peakIndex = 1; peakIndex < points.length; peakIndex += 1) {
    const amplitude = points[peakIndex] - lowValue;
    const stage = entries.slice(lowIndex + 1, peakIndex + 1);
    const positiveTotal = sum(stage.filter(entry => entry.score >= 0).map(entry => entry.score));
    const mvps = stage.filter(entry => entry.isMvp).length;
    const better = amplitude > best.amplitude + EPS ||
      (eq(amplitude, best.amplitude) && positiveTotal > best.positiveTotal + EPS) ||
      (eq(amplitude, best.amplitude) && eq(positiveTotal, best.positiveTotal) && mvps > best.mvps);
    if (amplitude > 0 && better) best = { amplitude, positiveTotal, mvps, lowIndex, peakIndex, low:lowValue, peak:points[peakIndex] };
    if (points[peakIndex] < lowValue - EPS) { lowValue = points[peakIndex]; lowIndex = peakIndex; }
  }
  const stage = best.lowIndex >= 0 ? entries.slice(best.lowIndex + 1, best.peakIndex + 1) : [];
  return {
    comebackAmplitude: best.amplitude,
    comebackPositiveTotal: best.positiveTotal,
    comebackMvps: best.mvps,
    comebackLow: best.low,
    comebackPeak: best.peak,
    comebackLowDate: best.lowIndex >= 0 ? entries[best.lowIndex]?.date : null,
    comebackPeakDate: best.peakIndex >= 0 ? entries[best.peakIndex]?.date : null,
    comebackEvidence: stage.map(entry => ({ ...entry }))
  };
}

function halfSeasonContrast(entries) {
  const half = Math.floor((entries || []).length / 2);
  if (!half) return { halfFrontGames:0, halfBackGames:0, halfFrontTotal:0, halfBackTotal:0, halfScoreDiff:0, halfFrontPositiveRate:0, halfBackPositiveRate:0, halfPositiveRateDiff:0, halfFrontMvps:0, halfBackMvps:0, halfMvpDiff:0 };
  const front = entries.slice(0, half);
  const back = entries.slice(entries.length - half);
  const frontTotal = sum(front.map(entry => entry.score));
  const backTotal = sum(back.map(entry => entry.score));
  const frontPositiveRate = front.filter(entry => entry.score >= 0).length / front.length;
  const backPositiveRate = back.filter(entry => entry.score >= 0).length / back.length;
  const frontMvps = front.filter(entry => entry.isMvp).length;
  const backMvps = back.filter(entry => entry.isMvp).length;
  return {
    halfFrontGames:front.length, halfBackGames:back.length,
    halfFrontTotal:frontTotal, halfBackTotal:backTotal, halfScoreDiff:Math.abs(frontTotal-backTotal),
    halfFrontPositiveRate:frontPositiveRate, halfBackPositiveRate:backPositiveRate, halfPositiveRateDiff:Math.abs(frontPositiveRate-backPositiveRate),
    halfFrontMvps:frontMvps, halfBackMvps:backMvps, halfMvpDiff:Math.abs(frontMvps-backMvps)
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
    const mvpStarStats = aggregateMvpStars(entries, entries.length);
    const dominationEntries = entries.map(entry => dominationEvent(entry, player.playerId));
    const soloEntries = dominationEntries.filter(entry => entry.isSolo);
    const bigWins = dominationEntries.filter(entry => entry.isBigWin);
    const dominanceEntries = dominationEntries.filter(entry => entry.qualifies);
    const streak = streakMetrics(schedule);
    const mvpStage = consecutiveStageMetrics(schedule, item => item.isMvp);
    const bigStage = consecutiveStageMetrics(schedule, item => item.score >= 50);
    const cumulative = cumulativeSwing(entries);
    const comeback = comebackMetrics(entries);
    const halfContrast = halfSeasonContrast(entries);

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
      mvpExplosionPoints: sum(mvpEntries.filter(entry => entry.score >= 50).map(entry => entry.score)),
      mvpBest: mvpEntries.length ? Math.max(...mvpEntries.map(entry => entry.score)) : 0,
      mvpRate: entries.length ? mvpEntries.length / entries.length : 0,
      mvpStars: mvpStarStats.totalStars,
      oneStarMvps: mvpStarStats.oneStar,
      twoStarMvps: mvpStarStats.twoStar,
      threeStarMvps: mvpStarStats.threeStar,
      fourStarMvps: mvpStarStats.fourStar,
      fiveStarMvps: mvpStarStats.fiveStar,
      fourPlusMvps: mvpStarStats.fourPlus,
      threePlusMvps: mvpStarStats.threePlus,
      mvpStarEntries: mvpStarStats.entries,
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
      bigStageCount: entries.filter(entry => entry.score >= 50).length,
      explosionTotal: sum(entries.filter(entry => entry.score >= 50).map(entry => entry.score)),
      longestBigStage: bigStage.maxLength,
      longestBigStageEvidence: bigStage.bestGroup.map(item => ({ matchId:item.match.matchId,date:item.match.date,round:item.match.round,season:item.match.season,matchType:item.match.matchType,venue:item.match.venue||"未填写场地",score:item.score,isMvp:item.isMvp })),
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
      ...cumulative,
      ...comeback,
      ...halfContrast
    });
  }



  return { season, matches: seasonMatches, rows };
}

export function buildCurrentSeasonRatings(players, matches) {
  const ordered = sortedMatches(matches || []);
  const latestSeason = [...new Set(ordered.map(match => match.season).filter(Boolean))]
    .sort((a, b) => seasonNumber(a) - seasonNumber(b)).at(-1);
  if (!latestSeason) return { season: null, rows: [], methodology: "暂无当前赛季数据。" };

  const base = seasonMetrics(players, ordered, latestSeason);
  const active = base.rows.filter(row => row.games > 0);
  if (!active.length) return { season: latestSeason, rows: [], methodology: "当前赛季暂无有效参赛数据。" };

  const scale = (key, inverse = false) => {
    const values = active.map(row => num(row[key]));
    const low = Math.min(...values), high = Math.max(...values);
    return row => {
      if (eq(high, low)) return 0.5;
      const value = (num(row[key]) - low) / (high - low);
      return inverse ? 1 - value : value;
    };
  };

  const nTotal = scale("total"), nAverage = scale("average"), nPositiveRate = scale("positiveRate"), nPositiveAverage = scale("positiveAverage");
  const nMvps = scale("mvps"), nMvpRate = scale("mvpRate"), nMvpTotal = scale("mvpTotal");
  const nBgr = scale("bgr"), nBigStageCount = scale("bigStageCount"), nBest = scale("best");
  const nVolatility = scale("volatility", true), nPositiveStreak = scale("longestStreak"), nCrash = scale("crashCount", true);

  let rows = active.map(row => {
    const scoring = 100 * (nTotal(row) * 0.50 + nAverage(row) * 0.50);
    const quality = 100 * (nPositiveRate(row) * 0.60 + nPositiveAverage(row) * 0.40);
    const mvpImpact = 100 * (nMvps(row) * 0.40 + nMvpRate(row) * 0.30 + nMvpTotal(row) * 0.30);
    const bigStage = 100 * (nBgr(row) * 0.40 + nBigStageCount(row) * 0.30 + nBest(row) * 0.30);
    const stability = 100 * (nVolatility(row) * 0.45 + nPositiveStreak(row) * 0.35 + nCrash(row) * 0.20);
    const composite = scoring * 0.30 + quality * 0.25 + mvpImpact * 0.20 + bigStage * 0.15 + stability * 0.10;
    const rating = Math.round(50 + 49 * composite / 100);
    return {
      ...row,
      season: latestSeason,
      dimensionScores: {
        scoring: Number(scoring.toFixed(1)),
        quality: Number(quality.toFixed(1)),
        mvpImpact: Number(mvpImpact.toFixed(1)),
        bigStage: Number(bigStage.toFixed(1)),
        stability: Number(stability.toFixed(1))
      },
      composite: Number(composite.toFixed(2)),
      rating,
      ratingLabel: seasonRatingLabel(rating)
    };
  });

  rows.sort((a, b) => b.composite - a.composite || b.total - a.total || b.average - a.average || String(a.playerId).localeCompare(String(b.playerId)));
  let rank = 0, previous = null;
  rows = rows.map((row, index) => {
    if (previous == null || !eq(row.composite, previous)) rank = index + 1;
    previous = row.composite;
    return { ...row, rank };
  });

  return {
    season: latestSeason,
    rows,
    methodology: "当前赛季OVR只使用当前赛季比赛：得分表现30%（总积分15%+场均15%）＋比赛质量25%（正分率15%+正分场次均分10%）＋MVP影响力20%（MVP次数、MVP率、MVP场次积分）＋爆发能力15%（BGR、爆发场次、单场最高）＋稳定性10%（波动、连续正分、极端负分）。各项仅在当前赛季参赛牌手之间标准化，最终换算为50–99分。"
  };
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

function awardTiebreak(result) {
  const ranking = result.ranking || [];
  const criteria = result.criteria || [];
  const top = ranking[0];
  if (!top || !criteria.length) return { triggered:false, decidedBy:null, decidedLabel:null, summary:"暂无可比较数据。" };
  const primary = criteria[0];
  let contenders = ranking.filter(row => eq(row[primary.key], top[primary.key]));
  if (contenders.length <= 1) {
    const summary = result.honorId === "H001"
      ? "本赛季由累计总积分直接决出冠军，未触发同分决胜。"
      : "本赛季由累计MVP星数直接决出年度最有价值牌手，未触发同星决胜。";
    return { triggered:false, decidedBy:primary.key, decidedLabel:primary.label, candidates:[top.player], summary };
  }
  const originalCandidates = contenders.map(row => row.player);
  for (const criterion of criteria.slice(1)) {
    contenders = contenders.filter(row => eq(row[criterion.key], top[criterion.key]));
    if (contenders.length === 1) {
      return { triggered:true, decidedBy:criterion.key, decidedLabel:criterion.label, candidates:originalCandidates, summary:`主指标相同，最终由${criterion.label}决出。` };
    }
  }
  return { triggered:true, decidedBy:null, decidedLabel:null, candidates:originalCandidates, summary:"全部比较条件仍完全相同，本赛季该荣誉暂不颁发。" };
}


function awardProcessFormula(honorId, row, criteria = []) {
  return criteriaText(criteria || [], row).map(item => ({ 指标:item.指标, 结果:item.数值 }));
}

function metricEvidenceFor(honorId, row, item) {
  const label = String(item?.指标 || "");
  const all = row.entries || [];
  const mvp = row.mvpStarEntries || all.filter(entry => entry.isMvp).map(entry => {
    const starLevel=getMvpStarLevel(entry.score);
    return {...entry,starLevel,starText:formatMvpStars(starLevel)};
  });
  const positive = all.filter(entry => entry.score >= 0);
  const explosion = all.filter(entry => entry.score >= 50);
  const withTag = (entries, tag="") => entries.map(entry => ({ ...entry, processTag:tag, bgr:bgrValue(entry.score) }));
  if (honorId === "H001") {
    if (label.includes("累计总积分")) return withTag(all,"逐场积分累计");
    if (label.includes("场均积分")) return withTag(all,`${formatMetric(row.total,"分")} ÷ ${formatMetric(row.games,"场")}`);
    if (label.includes("MVP场次积分")) return withTag(mvp,"正式MVP场次积分累计");
    if (label.includes("正分场次积分")) return withTag(positive,"正分场次积分累计");
    if (label.includes("爆发场次积分")) return withTag(explosion,"单场积分≥50的爆发场次积分累计");
  }
  if (honorId === "H003") {
    if (label.includes("MVP率")) return withTag(all,`${formatMetric(row.mvps,"次")} ÷ ${formatMetric(row.games,"场")}`);
    return mvp.map(entry => ({ ...entry, processTag:`正式MVP · ${entry.starText}` }));
  }
  return withTag(all,"原始比赛明细");
}
function rankingDetailFor(result, row) {
  const primaryKey=result.criteria?.[0]?.key;
  const base={playerId:row.playerId,player:row.player,rank:row.rank,value:num(row[primaryKey]??0),unit:result.catalog.unit};
  if(result.honorId==="H001")return {...base,metrics:{
    total:row.total,average:row.average,mvpPoints:row.mvpTotal,positivePoints:row.positiveTotal,explosionPoints:row.explosionTotal
  }};
  if(result.honorId==="H003")return {...base,metrics:{
    totalStars:row.mvpStars,mvpCount:row.mvps,fiveStar:row.fiveStarMvps,fourStar:row.fourStarMvps,threeStar:row.threeStarMvps,twoStar:row.twoStarMvps,oneStar:row.oneStarMvps,
    fourPlus:row.fourPlusMvps,threePlus:row.threePlusMvps,mvpPoints:row.mvpTotal,mvpRate:row.mvpRate
  },mvpMatches:(row.mvpStarEntries||[]).map(entry=>({
    matchId:entry.matchId,round:entry.round,date:entry.date,matchType:entry.matchType,venue:entry.venue,score:entry.score,starLevel:entry.starLevel,starText:entry.starText
  }))};
  return base;
}

function awardObject(result, row) {
  const catalog = result.catalog;
  const primaryKey = result.criteria?.[0]?.key;
  const formula = awardProcessFormula(catalog.honorId, row, result.criteria || []);
  return {
    ownerPlayerId: row.playerId,
    scope: result.scope,
    honorId: catalog.honorId,
    name: catalog.name,
     value: num(row[primaryKey] ?? 1),
     status: result.status,
    details: {
      rule: catalog.rule,
      unit: catalog.unit,
      winner: row.player,
      winners: result.winners.map(winner => winner.player),
      officialValue: num(row[primaryKey] ?? 1),
      calculationStatus: "LIVE_RECALCULATED_V3_DUAL_TRACK_RULES",
      ranking: result.ranking.map(ranked => rankingDetailFor(result, ranked)),
      formula,
      evidence: evidenceFor(catalog.honorId, row),
      tiebreak: awardTiebreak(result),
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
    { key: "total", dir: "desc", label: "累计总积分", unit: "分" },
    { key: "average", dir: "desc", label: "场均积分", unit: "分/场" },
    { key: "mvpTotal", dir: "desc", label: "MVP场次积分", unit: "分" },
    { key: "positiveTotal", dir: "desc", label: "正分场次积分", unit: "分" },
    { key: "explosionTotal", dir: "desc", label: "爆发场次积分", unit: "分" }
  ], { eligibility: row => row.games > 0 });

  push("H003", rows, [
    { key: "mvpStars", dir: "desc", label: "累计MVP星数", unit: "星" },
    { key: "fiveStarMvps", dir: "desc", label: "五星MVP次数", unit: "次" },
    { key: "fourPlusMvps", dir: "desc", label: "四星及以上MVP次数", unit: "次" },
    { key: "threePlusMvps", dir: "desc", label: "三星及以上MVP次数", unit: "次" },
    { key: "mvps", dir: "desc", label: "MVP总次数", unit: "次" },
    { key: "mvpTotal", dir: "desc", label: "MVP场次累计积分", unit: "分" },
    { key: "mvpRate", dir: "desc", label: "MVP率", unit: "%" }
  ], { eligibility: row => row.games > 0 && row.mvps > 0 });

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
    calculation.results.forEach(result => {
      const top = result.ranking[0] || null;
      const primaryKey = result.criteria?.[0]?.key;
      const winnerNames = result.winners.map(winner => winner.player);
      board.push({
        scope: season,
        honorId: result.honorId,
        name: result.catalog.name,
        status: result.status,
        winners: winnerNames,
        winnerIds: result.winners.map(winner => winner.playerId),
        value: top ? num(top[primaryKey]) : null,
        unit: result.catalog.unit,
        summary: result.summary || result.reason || "",
        allowTie: result.catalog.allowTie,
        details: top ? {
          rule: result.catalog.rule, unit: result.catalog.unit,
          winner: winnerNames.length ? winnerNames.join(" / ") : (result.status === "PENDING_TIEBREAK" ? "待定" : "本季不颁发"),
          winners: winnerNames, officialValue: num(top[primaryKey] ?? 0),
          calculationStatus: "LIVE_RECALCULATED_V3_DUAL_TRACK_RULES",
          ranking: result.ranking.map(ranked => rankingDetailFor(result, ranked)),
          formula: awardProcessFormula(result.honorId, top, result.criteria || []),
          evidence: evidenceFor(result.honorId, top),
          tiebreak: awardTiebreak(result),
          summary: result.summary || result.reason || ""
        } : { rule: result.catalog.rule, unit: result.catalog.unit, winner:"本季不颁发", winners:[], officialValue:null, calculationStatus:"LIVE_RECALCULATED_V3_DUAL_TRACK_RULES", ranking:[], formula:[], evidence:[], tiebreak:awardTiebreak(result), summary:result.summary || result.reason || "" }
      });
    });
  }

  return { honors, board, seasons, seasonMetrics: seasonMetricsMap, catalog: HONOR_CATALOG };
}

function recentEntries(matches,pid,n=5){const arr=[];for(const m of sortedMatches(matches)){const r=playerResult(m,pid);if(r&&!r.isAbsent&&r.score!=null)arr.push({matchId:m.matchId,season:m.season,round:m.round,date:m.date,matchType:m.matchType,venue:m.venue||'未填写场地',score:num(r.score),isMvp:!!r.isMvp});}return arr.slice(-n);}
function slope(values){if(values.length<2)return 0;const xs=values.map((_,i)=>i),xm=mean(xs),ym=mean(values);const den=sum(xs.map(x=>(x-xm)**2));return den?sum(xs.map((x,i)=>(x-xm)*(values[i]-ym)))/den:0;}
function minmax(rows,key){const vals=rows.map(x=>num(x[key])),lo=Math.min(...vals),hi=Math.max(...vals);return x=>eq(hi,lo)?.5:(num(x[key])-lo)/(hi-lo);}
function weightedRecent(entries){const base=[.10,.15,.20,.25,.30].slice(5-entries.length),ws=sum(base);return {score:entries.length?sum(entries.map((x,i)=>x.score*base[i]))/ws:0,positive:entries.length?sum(entries.map((x,i)=>(x.score>=0?1:0)*base[i]))/ws:0,mvp:entries.length?sum(entries.map((x,i)=>(x.isMvp?1:0)*base[i]))/ws:0,bgr:entries.length?sum(entries.map((x,i)=>bgrValue(x.score)*base[i]))/ws:0};}
function ordinalRanks(rows,key,dir='desc'){const sorted=[...rows].sort((a,b)=>dir==='asc'?num(a[key])-num(b[key]):num(b[key])-num(a[key])||String(a.playerId).localeCompare(String(b.playerId)));let rank=0,prev=null;const out={};sorted.forEach((row,index)=>{const value=num(row[key]);if(index===0||!eq(value,prev))rank=index+1;prev=value;out[row.playerId]=rank;});return out;}
function officialHonorRanks(rows){
  const sorted=[...rows].sort((a,b)=>num(b.titles)-num(a.titles)||num(b.mvAwards)-num(a.mvAwards)||num(b.officialHonorCount)-num(a.officialHonorCount)||String(a.playerId).localeCompare(String(b.playerId)));
  let rank=0,previous="";
  const out={};
  sorted.forEach((row,index)=>{
    const key=`${num(row.titles)}|${num(row.mvAwards)}|${num(row.officialHonorCount)}`;
    if(index===0||key!==previous)rank=index+1;
    previous=key;
    out[row.playerId]=rank;
  });
  return out;
}
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
    const hs=(honors?.[p.playerId]||[]).filter(h=>h.honorId==='H001'||h.honorId==='H003');
    const seasonHistory=seasons.map(s=>seasonRows[s].find(x=>x.playerId===p.playerId)).filter(x=>x&&x.games>0);
    return {playerId:p.playerId,player:p.name,games,total:sum(scores),average:mean(scores),positiveRate:games?entries.filter(x=>x.score>=0).length/games:0,mvps,mvpRate:games?mvps/games:0,bgr:sum(scores.map(bgrValue)),bgrPerGame:games?sum(scores.map(bgrValue))/games:0,best:games?Math.max(...scores):null,worst:games?Math.min(...scores):null,volatility:std(scores),officialHonorCount:hs.length,titles:hs.filter(h=>h.honorId==='H001').length,mvAwards:hs.filter(h=>h.honorId==='H003').length,seasonHistory};
  });
  const active=rows.filter(x=>x.games>0),nTotal=minmax(active,'total'),nAvg=minmax(active,'average'),nPos=minmax(active,'positiveRate'),nMvp=minmax(active,'mvpRate'),nBgr=minmax(active,'bgrPerGame'),nHonor=minmax(active,'officialHonorCount');
  rows=rows.map(r=>({...r,overallRating:r.games?Math.round(50+49*(nTotal(r)*.25+nAvg(r)*.20+nPos(r)*.15+nMvp(r)*.15+nBgr(r)*.10+nHonor(r)*.15)):50}));
  const ratingRanks=ordinalRanks(rows,'overallRating'),totalRanks=ordinalRanks(rows,'total'),avgRanks=ordinalRanks(rows,'average'),positiveRanks=ordinalRanks(rows,'positiveRate'),mvpRanks=ordinalRanks(rows,'mvpRate'),bgrRanks=ordinalRanks(rows,'bgrPerGame'),honorRanks=officialHonorRanks(rows);
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
function seasonStyleMetrics(matches,pid,season){
  const seasonMatches=sortedMatches(matches).filter(m=>m.season===season);
  let cumulative=0,minSeen=null,maxComeback=0,soloWins=0,maxDominance=0,dominanceTotal=0,dominanceGames=0;
  const scores=[];
  for(const match of seasonMatches){
    const rows=played(match),result=rows.find(r=>r.playerId===pid);if(!result)continue;
    const score=num(result.score),opponents=rows.filter(r=>r.playerId!==pid),oppAvg=opponents.length?mean(opponents.map(r=>num(r.score))):0,dominance=score-oppAvg;
    scores.push(score);cumulative+=score;
    if(minSeen!=null)maxComeback=Math.max(maxComeback,cumulative-minSeen);
    minSeen=minSeen==null?cumulative:Math.min(minSeen,cumulative);
    if(score>=0&&opponents.length&&opponents.every(r=>num(r.score)<0))soloWins++;
    maxDominance=Math.max(maxDominance,dominance);dominanceTotal+=dominance;dominanceGames++;
  }
  return {maxComeback,soloWins,maxDominance,averageDominance:dominanceGames?dominanceTotal/dominanceGames:0,range:scores.length?Math.max(...scores)-Math.min(...scores):0};
}
function computePower(players,matches){
  const latestSeason=[...new Set(matches.map(m=>m.season))].sort((a,b)=>seasonNumber(a)-seasonNumber(b)).at(-1);
  let rows=players.map(p=>{
    const recent=recentEntries(matches,p.playerId,5),w=weightedRecent(recent);
    const seasonEntries=recentEntries(matches.filter(m=>m.season===latestSeason),p.playerId,999);
    const seasonScores=seasonEntries.map(x=>x.score),seasonTotal=sum(seasonScores),seasonGames=seasonScores.length;
    const season={id:latestSeason||'—',games:seasonGames,total:seasonTotal,average:mean(seasonScores),positiveRate:seasonGames?seasonEntries.filter(x=>x.score>=0).length/seasonGames:0,mvps:seasonEntries.filter(x=>x.isMvp).length,bgr:sum(seasonScores.map(bgrValue)),best:seasonGames?Math.max(...seasonScores):null,worst:seasonGames?Math.min(...seasonScores):null,volatility:std(seasonScores)};
    const seasonStyle=seasonStyleMetrics(matches,p.playerId,latestSeason);
    return {playerId:p.playerId,player:p.name,recent,weightedScore:w.score,recentPositive:w.positive,recentMvp:w.mvp,recentBgr:w.bgr,trend:slope(recent.map(x=>x.score)),vsSeason:w.score-season.average,recentTotal:sum(recent.map(x=>x.score)),recentAverage:mean(recent.map(x=>x.score)),recentStd:std(recent.map(x=>x.score)),seasonAverage:season.average,season,seasonStyle,latest:recent.at(-1)||null};
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
function statusLabel(r){if(r.recent.length<3)return '🕒 样本不足';const last3=r.recent.slice(-3).map(x=>x.score);if(r.latest?.isMvp&&r.powerIndex>=55)return '👑 MVP状态';if(last3.length===3&&last3.every(x=>x>=0))return '🎯 连续正分';if(last3.length===3&&last3[0]<last3[1]&&last3[1]<last3[2])return r.powerIndex>=45?'🚀 强势上升':'📈 回暖中';if(last3.length===3&&last3[0]>last3[1]&&last3[1]>last3[2])return r.powerIndex>=55?'🎢 高开低走':'📉 状态下滑';if(r.recent.filter(x=>x.score>=50).length>=2)return '⚡ 爆发模式';if(r.recentStd>=35)return '🌊 表现起伏';if(r.powerIndex>=85)return '🔥 炙手可热';if(r.powerIndex>=70)return '🔥 手感火热';if(r.powerIndex>=55)return '✅ 状态稳定';if(r.powerIndex>=45)return '➖ 状态平平';if(r.powerIndex>=30)return '🌧 状态低迷';return '🧊 深陷低谷';}
function archetypes(rows){
  const norm=getter=>{const vals=rows.map(r=>num(getter(r))),lo=Math.min(...vals),hi=Math.max(...vals);return r=>eq(hi,lo)?.5:(num(getter(r))-lo)/(hi-lo);};
  const nTotal=norm(r=>r.season.total),nAvg=norm(r=>r.season.average),nPos=norm(r=>r.season.positiveRate),nMvp=norm(r=>r.season.mvps),nBgr=norm(r=>r.season.bgr),nBest=norm(r=>r.season.best??0),nVol=norm(r=>r.season.volatility),nComeback=norm(r=>r.seasonStyle?.maxComeback||0),nSolo=norm(r=>r.seasonStyle?.soloWins||0),nDom=norm(r=>r.seasonStyle?.maxDominance||0),nRange=norm(r=>r.seasonStyle?.range||0);
  return Object.fromEntries(rows.map(r=>{
    const dims=Object.values(r.seasonPerformance?.dimensionScores||{}).map(Number).filter(Number.isFinite),avgDim=dims.length?mean(dims):50,spread=dims.length?Math.max(...dims)-Math.min(...dims):50,balance=Math.max(0,1-spread/100);
    const scores={
      '全能型':(avgDim/100)*.62+balance*.38,
      '稳健型':(1-nVol(r))*.62+nPos(r)*.38,
      '爆发型':nBgr(r)*.55+nBest(r)*.45,
      '进攻型':nTotal(r)*.38+nAvg(r)*.27+nMvp(r)*.35,
      '韧性型':nComeback(r)*.78+nPos(r)*.22,
      '统治型':nMvp(r)*.35+nSolo(r)*.30+nDom(r)*.35,
      '波动型':nVol(r)*.62+nRange(r)*.38
    };
    const type=Object.entries(scores).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN'))[0]?.[0]||'全能型';
    return [r.playerId,type];
  }));
}
function seasonAssessment(r){
  const s=r.season||{}, perf=r.seasonPerformance||{};
  if(!s.games)return {label:'赛季样本不足',summary:`${r.player}在当前赛季暂无有效参赛记录。`,outlook:'需要更多正式比赛后才能形成完整的赛季定位。'};
  let label=perf.ratingLabel||'中游竞争者';
  if(perf.rank===1)label=`${perf.ratingLabel||'高水平赛季'} · 赛季综合第1`;
  else if(perf.rank===2)label=`${perf.ratingLabel||'高水平赛季'} · 争冠集团`;
  const dims=perf.dimensionScores||{};
  const weak=Object.entries({得分表现:dims.scoring,比赛质量:dims.quality,MVP影响力:dims.mvpImpact,爆发能力:dims.bigStage,稳定性:dims.stability}).filter(([,v])=>Number.isFinite(Number(v))).sort((a,b)=>a[1]-b[1])[0];
  const strong=Object.entries({得分表现:dims.scoring,比赛质量:dims.quality,MVP影响力:dims.mvpImpact,爆发能力:dims.bigStage,稳定性:dims.stability}).filter(([,v])=>Number.isFinite(Number(v))).sort((a,b)=>b[1]-a[1])[0];
  const summary=`${s.id}已出战${s.games}场，当前赛季OVR ${perf.rating??'—'}，联盟第${perf.rank||'—'}。累计${s.total>=0?'+':''}${s.total}分，场均${s.average.toFixed(2)}分，正分率${(s.positiveRate*100).toFixed(1)}%，取得${s.mvps}次MVP，BGR指数${s.bgr}。${strong?`五维中${strong[0]}最突出（${Number(strong[1]).toFixed(1)}）。`:''}`;
  const outlook=weak?`当前最需要提升的是${weak[0]}（${Number(weak[1]).toFixed(1)}）；赛季OVR只跟随${s.id}数据变化，不受历史赛季成绩影响。`:'继续积累当前赛季正式比赛样本。';
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
  if(c.honorRank<=2&&c.officialHonorCount>0)strengths.push(`官方荣誉排名第${c.honorRank}`);
  if(c.total<0)risks.push('历季累计积分仍为负，长期稳定输出不足');
  if(c.positiveRate<.5)risks.push(`生涯正分率${(c.positiveRate*100).toFixed(1)}%，低于五成`);
  if(c.volatility>=35)risks.push(`生涯波动指数${c.volatility.toFixed(1)}，比赛上下限差距较大`);
  if(!risks.length)risks.push('长期数据结构较均衡，主要观察能否继续抬高个人峰值');
  const best=c.bestSeason;
  const summary=`${c.seasonRange}共出战${c.games}场，累计${c.total>=0?'+':''}${c.total}分，场均${c.average.toFixed(2)}分，正分率${(c.positiveRate*100).toFixed(1)}%，取得${c.mvps}次MVP、BGR ${c.bgr}，获得${c.officialHonorCount}次官方荣誉（总冠军${c.titles}次、年度MVP${c.mvAwards}次）。`;
  const evaluation=`${r.player}的MSL生涯定位为“${c.ratingLabel}”，综合评分${c.overallRating}，联盟排名第${c.overallRank}。${c.trend}${best?`，其中${best.season}以${best.rating}分成为目前评分最高的单赛季。`:''}${strengths.length?`长期优势主要体现在${strengths.slice(0,3).join('、')}。`:''}`;
  const outlook=c.overallRank<=2?'已经进入联盟长期核心层，后续重点是把高水平赛季转化为更多总冠军与年度最有价值牌手荣誉。':c.total>=0?'具备进入长期核心层的基础，提升MVP效率与高分场次将明显拉高综合评分。':'目前仍处于生涯追赶阶段，优先目标是改善累计积分、正分率与赛季稳定性。';
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
  if(r.recent.filter(x=>x.score>=50).length)strengths.push(`出现${r.recent.filter(x=>x.score>=50).length}场爆发`);
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
  const seasonRatingSystem=buildCurrentSeasonRatings(players,matches),seasonRatingBy=Object.fromEntries(seasonRatingSystem.rows.map(x=>[x.playerId,x]));
  let rows=current.map(r=>{const prev=prevBy[r.playerId];return {...r,career:careerBy[r.playerId],seasonPerformance:seasonRatingBy[r.playerId]||null,movement:prev?prev.rank-r.rank:0,indexChange:prev?r.powerIndex-prev.powerIndex:0};});
  const types=archetypes(rows);rows=rows.map(r=>({...r,label:statusLabel(r),archetype:types[r.playerId]}));rows=rows.map(r=>({...r,report:reportFor(r,rows)}));
  const hottest=rows[0],coldest=rows.at(-1),riser=[...rows].sort((a,b)=>b.movement-a.movement||b.indexChange-a.indexChange)[0],volatile=[...rows].sort((a,b)=>b.recentStd-a.recentStd)[0],overall=[...rows].sort((a,b)=>b.career.overallRating-a.career.overallRating||a.playerId.localeCompare(b.playerId))[0];
  const latest=sortedMatches(matches).at(-1);let gameRecap=null;
  if(latest){const pp=played(latest).sort((a,b)=>num(b.score)-num(a.score)),top=pp[0],second=pp[1],bottom=pp.at(-1);gameRecap={title:`${top?.player||'本场赢家'}领跑最新一轮，${bottom?.player||'末位牌手'}承压`,meta:`${latest.season} 第${latest.round}局 · ${latest.date} · ${latest.venue||'未填写场地'}`,body:`${top?.player||'—'}以${top?`${num(top.score)>=0?'+':''}${num(top.score)}`:'—'}取得全场最高分${top?.isMvp?'并拿下MVP':''}，领先第二名${top&&second?num(top.score)-num(second.score):0}分；全场最大分差${top&&bottom?num(top.score)-num(bottom.score):0}分。`,scores:pp.map(x=>({player:x.player,score:num(x.score),isMvp:!!x.isMvp}))};}
  const storylines=[`🔥 当前最火热：${hottest.player}，状态指数${hottest.powerIndex}。`,`🧊 当前最低迷：${coldest.player}，状态指数${coldest.powerIndex}。`,`🏅 生涯综合评分最高：${overall.player}，OVR ${overall.career.overallRating}。`,`📈 行情上升最快：${riser.player}，${riser.movement>0?`实力榜上升${riser.movement}位`:`指数变化${riser.indexChange>=0?'+':''}${riser.indexChange}`}。`,`🌊 近期波动最大：${volatile.player}，波动指数${volatile.recentStd.toFixed(1)}。`];
  return {rankings:rows,storylines,gameRecap,currentSeasonRating:seasonRatingSystem,methodology:`状态指数：最近5场加权净分35% + 正分率20% + MVP15% + BGR10% + 走势10% + 相对当前赛季表现10%。${seasonRatingSystem.methodology} 生涯综合评分（OVR）：S1至当前全部赛季累计积分25% + 生涯场均20% + 生涯正分率15% + MVP率15% + 场均BGR10% + 官方荣誉15%。近期、赛季、生涯三套评价互相独立，均不改变官方积分和荣誉。`};
}
