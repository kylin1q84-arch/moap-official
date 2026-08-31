const EPS = 1e-9;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = values => values.reduce((total, value) => total + num(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const eq = (a, b) => Math.abs(num(a) - num(b)) <= EPS;
const seasonNumber = value => Number(String(value || "").replace(/\D/g, "")) || 0;

function sortedMatches(matches) {
  return [...(matches || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) ||
    num(a.round) - num(b.round) ||
    String(a.matchId).localeCompare(String(b.matchId))
  );
}

function played(match) {
  return (match.results || []).filter(result => !result.isAbsent && result.score != null);
}

function resultFor(match, playerId) {
  return (match.results || []).find(result => result.playerId === playerId);
}

function displayNumber(value, unit, forcePlus = false) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  const decimals = Number.isInteger(number) ? 0 : 2;
  const prefix = forcePlus && number > 0 ? "+" : "";
  if (unit === "分/场") return `${prefix}${number.toFixed(2)} 分/场`;
  if (unit === "%") return `${(number * 100).toFixed(2)}%`;
  return `${prefix}${number.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function rankCandidates(candidates, direction = "desc") {
  const filtered = candidates.filter(candidate => candidate && Number.isFinite(Number(candidate.value)));
  filtered.sort((a, b) => {
    const av = num(a.value), bv = num(b.value);
    if (!eq(av, bv)) return direction === "asc" ? av - bv : bv - av;
    return String(a.createdAt || "9999").localeCompare(String(b.createdAt || "9999")) ||
      String(a.playerId || "").localeCompare(String(b.playerId || ""));
  });
  let rank = 0, previous = null;
  return filtered.map((candidate, index) => {
    if (previous == null || !eq(candidate.value, previous)) rank = index + 1;
    previous = candidate.value;
    return { ...candidate, rank };
  });
}

function makeRecord({ id, section, name, rule, unit, direction = "desc", candidates = [], requirePositive = false, forcePlus = false }) {
  let ranking = rankCandidates(candidates, direction);
  if (requirePositive && (!ranking.length || num(ranking[0].value) <= 0)) ranking = [];
  const holderCandidates = ranking.filter(candidate => candidate.rank === 1);
  const holderMap = new Map();
  for (const candidate of holderCandidates) {
    const existing = holderMap.get(candidate.playerId);
    if (!existing || String(candidate.createdAt || "9999").localeCompare(String(existing.createdAt || "9999")) < 0) holderMap.set(candidate.playerId, candidate);
  }
  const holders = [...holderMap.values()];
  const value = holderCandidates.length ? holderCandidates[0].value : null;
  return {
    id, section, name, rule, unit, direction, forcePlus,
    holders: holders.map(candidate => ({
      playerId: candidate.playerId,
      player: candidate.player,
      season: candidate.season,
      createdAt: candidate.createdAt,
      evidence: candidate.evidence || []
    })),
    holderNames: [...new Set(holders.map(candidate => candidate.player))],
    value,
    displayValue: displayNumber(value, unit, forcePlus),
    createdAt: holderCandidates.length ? holderCandidates.map(candidate => candidate.createdAt).filter(Boolean).sort()[0] || "—" : "—",
    ranking,
    evidence: holderCandidates.flatMap(holder => holder.evidence || [])
  };
}

function matchEvidence(match, result, extra = {}) {
  return {
    matchId: match.matchId,
    season: match.season,
    round: match.round,
    date: match.date,
    matchType: match.matchType,
    venue: match.venue || "未填写场地",
    playerId: result.playerId,
    player: result.player,
    score: num(result.score),
    isMvp: !!result.isMvp,
    ...extra
  };
}

function classifyMatch(match) {
  const rows = played(match);
  const nonNegative = rows.filter(result => num(result.score) >= 0);
  const negative = rows.filter(result => num(result.score) < 0);
  const soloWinnerId = nonNegative.length === 1 && rows.every(result => result.playerId === nonNegative[0].playerId || num(result.score) < 0)
    ? nonNegative[0].playerId : null;
  const soloLoserId = negative.length === 1 && rows.every(result => result.playerId === negative[0].playerId || num(result.score) >= 0)
    ? negative[0].playerId : null;
  const metrics = Object.fromEntries(rows.map(result => {
    const opponents = rows.filter(other => other.playerId !== result.playerId);
    const opponentAverage = opponents.length ? mean(opponents.map(other => other.score)) : 0;
    const dominanceMargin = num(result.score) - opponentAverage;
    return [result.playerId, {
      isSoloWin: result.playerId === soloWinnerId,
      isSoloLoss: result.playerId === soloLoserId,
      isBigWin: opponents.length > 0 && dominanceMargin >= 100,
      isExplosion: num(result.score) >= 50,
      opponentAverage,
      dominanceMargin
    }];
  }));
  return { rows, metrics };
}

function selectMatches(matches, { season = "all", type = "all" } = {}) {
  return sortedMatches(matches).filter(match => {
    if (season !== "all" && match.season !== season) return false;
    if (type === "four" && match.matchType !== "四人局") return false;
    if (type === "five" && match.matchType !== "五人局") return false;
    return true;
  });
}

function playerSchedule(players, matches) {
  const classified = new Map(matches.map(match => [match.matchId, classifyMatch(match)]));
  return Object.fromEntries(players.map(player => [player.playerId, matches.map(match => {
    const result = resultFor(match, player.playerId);
    const absent = !result || result.isAbsent || result.score == null;
    const flags = absent ? {} : classified.get(match.matchId)?.metrics?.[player.playerId] || {};
    return {
      playerId: player.playerId,
      player: player.name,
      match,
      result,
      absent,
      score: absent ? null : num(result.score),
      isMvp: !!(!absent && result.isMvp),
      isSoloWin: !!flags.isSoloWin,
      isSoloLoss: !!flags.isSoloLoss,
      isBigWin: !!flags.isBigWin,
      isExplosion: !!flags.isExplosion,
      dominanceMargin: num(flags.dominanceMargin),
      opponentAverage: num(flags.opponentAverage)
    };
  })]));
}

function buildStages(schedule, predicate, { ignoreAbsent = true } = {}) {
  const stages = [];
  let current = [];
  const close = () => {
    if (!current.length) return;
    stages.push({
      playerId: current[0].playerId,
      player: current[0].player,
      value: current.length,
      length: current.length,
      points: sum(current.map(item => item.score)),
      startDate: current[0].match.date,
      endDate: current[current.length - 1].match.date,
      createdAt: current[current.length - 1].match.date,
      season: current[0].match.season,
      evidence: current.map(item => matchEvidence(item.match, item.result, {
        dominanceMargin: item.dominanceMargin,
        opponentAverage: item.opponentAverage
      }))
    });
    current = [];
  };
  for (const item of schedule) {
    if (item.absent && ignoreAbsent) continue;
    if (!item.absent && predicate(item)) current.push(item);
    else close();
  }
  close();
  return stages;
}

function singleRecords(players, matches) {
  const schedules = playerSchedule(players, matches);
  const events = Object.values(schedules).flat().filter(item => !item.absent);
  const candidates = predicate => events.filter(predicate).map(item => ({
    playerId: item.playerId,
    player: item.player,
    value: item.score,
    createdAt: item.match.date,
    season: item.match.season,
    matchId: item.match.matchId,
    matchType: item.match.matchType,
    evidence: [matchEvidence(item.match, item.result, { dominanceMargin: item.dominanceMargin, opponentAverage: item.opponentAverage })]
  }));
  const dominance = events.map(item => ({
    playerId: item.playerId,
    player: item.player,
    value: item.dominanceMargin,
    createdAt: item.match.date,
    season: item.match.season,
    matchId: item.match.matchId,
    matchType: item.match.matchType,
    evidence: [matchEvidence(item.match, item.result, { dominanceMargin: item.dominanceMargin, opponentAverage: item.opponentAverage })]
  }));
  return [
    makeRecord({ id:"HIST_SINGLE_HIGH", section:"single", name:"单场最高积分", rule:"所选范围内实际参赛牌手的最高单场积分。", unit:"分", candidates:candidates(() => true) }),
    makeRecord({ id:"HIST_SINGLE_LOW", section:"single", name:"单场最低积分", rule:"所选范围内实际参赛牌手的最低单场积分。", unit:"分", direction:"asc", candidates:candidates(() => true) }),
    makeRecord({ id:"HIST_MVP_HIGH", section:"single", name:"单场MVP最高积分", rule:"获得MVP的比赛中，MVP牌手的最高单场积分。", unit:"分", candidates:candidates(item => item.isMvp) }),
    makeRecord({ id:"HIST_MVP_LOW", section:"single", name:"单场MVP最低积分", rule:"获得MVP的比赛中，MVP牌手的最低单场积分。", unit:"分", direction:"asc", candidates:candidates(item => item.isMvp) }),
    makeRecord({ id:"HIST_SOLO_HIGH", section:"single", name:"单场独赢最高积分", rule:"独赢场次中的最高积分；独赢要求本人积分≥0且其他实际参赛牌手均＜0。", unit:"分", candidates:candidates(item => item.isSoloWin) }),
    makeRecord({ id:"HIST_SOLO_LOW", section:"single", name:"单场独赢最低积分", rule:"独赢场次中的最低积分。", unit:"分", direction:"asc", candidates:candidates(item => item.isSoloWin) }),
    makeRecord({ id:"HIST_MAX_LEAD", section:"single", name:"单场最大领先分差", rule:"单场本人积分－同场其他实际参赛牌手平均积分，取最高值。", unit:"分", forcePlus:true, candidates:dominance })
  ];
}

function continuousRecords(players, matches) {
  const schedules = playerSchedule(players, matches);
  const stageDefinitions = {
    positive: item => item.score >= 0,
    negative: item => item.score < 0,
    mvp: item => item.isMvp,
    solo: item => item.isSoloWin,
    explosion: item => item.isExplosion
  };
  const stages = {};
  for (const [key, predicate] of Object.entries(stageDefinitions)) {
    stages[key] = Object.values(schedules).flatMap(schedule => buildStages(schedule, predicate, { ignoreAbsent: true }));
  }
  stages.participation = Object.values(schedules).flatMap(schedule => buildStages(schedule, () => true, { ignoreAbsent: false }));
  const lengthCandidates = key => stages[key].map(stage => ({ ...stage, value: stage.length }));
  const pointCandidates = key => stages[key].map(stage => ({ ...stage, value: stage.points }));
  return [
    makeRecord({ id:"HIST_POS_STREAK", section:"continuous", name:"最长连续正分场次", rule:"按个人实际参赛序列统计得分≥0的最长连续场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("positive") }),
    makeRecord({ id:"HIST_NEG_STREAK", section:"continuous", name:"最长连续负分场次", rule:"按个人实际参赛序列统计得分＜0的最长连续场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("negative") }),
    makeRecord({ id:"HIST_POS_STAGE_POINTS", section:"continuous", name:"最长连续正分阶段积分", rule:"所有连续正分阶段中累计积分最高的一段；详情同时展示阶段长度和逐场过程。", unit:"分", candidates:pointCandidates("positive") }),
    makeRecord({ id:"HIST_NEG_STAGE_POINTS", section:"continuous", name:"最长连续负分阶段积分", rule:"所有连续负分阶段中累计积分最低的一段；详情同时展示阶段长度和逐场过程。", unit:"分", direction:"asc", candidates:pointCandidates("negative") }),
    makeRecord({ id:"HIST_MVP_STREAK", section:"continuous", name:"最长连续MVP场次", rule:"按个人实际参赛序列统计连续获得MVP的最长场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("mvp") }),
    makeRecord({ id:"HIST_MVP_STAGE_POINTS", section:"continuous", name:"最长连续MVP阶段积分", rule:"所有连续MVP阶段中累计积分最高的一段。", unit:"分", candidates:pointCandidates("mvp") }),
    makeRecord({ id:"HIST_SOLO_STREAK", section:"continuous", name:"最长连续独赢场次", rule:"按个人实际参赛序列统计连续独赢的最长场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("solo") }),
    makeRecord({ id:"HIST_SOLO_STAGE_POINTS", section:"continuous", name:"最长连续独赢阶段积分", rule:"所有连续独赢阶段中累计积分最高的一段。", unit:"分", candidates:pointCandidates("solo") }),
    makeRecord({ id:"HIST_BIG_STAGE_STREAK", section:"continuous", name:"最长连续爆发场次", rule:"按个人实际参赛序列统计单场积分≥50的最长连续场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("explosion") }),
    makeRecord({ id:"HIST_BIG_STAGE_POINTS", section:"continuous", name:"最长连续爆发阶段积分", rule:"所有连续爆发阶段中累计积分最高的一段；爆发定义为单场积分≥50。", unit:"分", candidates:pointCandidates("explosion") }),
    makeRecord({ id:"HIST_PARTICIPATION_STREAK", section:"continuous", name:"最长连续参赛场次", rule:"连续出席正式比赛的最长场次；缺席会中断。", unit:"场", candidates:lengthCandidates("participation") })
  ];
}

function buildRecordView(players, matches, season, type) {
  const selected = selectMatches(matches, { season, type });
  return {
    single: singleRecords(players, selected),
    continuous: continuousRecords(players, selected)
  };
}

function rankedRows(rows, comparator, sameRank) {
  const sorted = [...rows].sort(comparator);
  let rank = 0, previous = null;
  return sorted.map((row, index) => {
    if (previous == null || !sameRank(row, previous)) rank = index + 1;
    previous = row;
    return { ...row, rank };
  });
}

function summaryRows(players, matches, season, type) {
  const selected = selectMatches(matches, { season, type });
  const schedules = playerSchedule(players, selected);
  return players.map(player => {
    const entries = (schedules[player.playerId] || []).filter(item => !item.absent);
    if (!entries.length) return null;
    const mvp = entries.filter(item => item.isMvp);
    const positive = entries.filter(item => item.score >= 0);
    const negative = entries.filter(item => item.score < 0);
    const soloWin = entries.filter(item => item.isSoloWin);
    const soloLoss = entries.filter(item => item.isSoloLoss);
    const explosion = entries.filter(item => item.score >= 50);
    const make = items => ({
      count: items.length,
      points: sum(items.map(item => item.score)),
      average: mean(items.map(item => item.score)),
      rate: entries.length ? items.length / entries.length : 0
    });
    let cumulative = 0;
    const cumulativeSeries = entries.map(item => (cumulative += item.score));
    const bins = { over50:0, over60:0, over70:0, over80:0, over90:0, over100:0 };
    for (const item of explosion) {
      const score = item.score;
      if (score >= 100) bins.over100 += 1;
      else if (score >= 90) bins.over90 += 1;
      else if (score >= 80) bins.over80 += 1;
      else if (score >= 70) bins.over70 += 1;
      else if (score >= 60) bins.over60 += 1;
      else bins.over50 += 1;
    }
    return {
      playerId: player.playerId,
      player: player.name,
      games: entries.length,
      total: sum(entries.map(item => item.score)),
      average: mean(entries.map(item => item.score)),
      cumulativeHigh: cumulativeSeries.length ? Math.max(...cumulativeSeries) : null,
      cumulativeLow: cumulativeSeries.length ? Math.min(...cumulativeSeries) : null,
      best: entries.length ? Math.max(...entries.map(item => item.score)) : null,
      worst: entries.length ? Math.min(...entries.map(item => item.score)) : null,
      mvp: make(mvp),
      positive: make(positive),
      negative: make(negative),
      soloWin: make(soloWin),
      soloLoss: make(soloLoss),
      explosion: make(explosion),
      explosionBins: bins,
      entries
    };
  }).filter(Boolean);
}

export function buildDataLeaderboard(players, matches, { season = "all", type = "all", metric = "points" } = {}) {
  const rows = summaryRows(players, matches, season, type);
  const cmpText = (a, b) => String(a.playerId).localeCompare(String(b.playerId));
  let comparator, sameRank;
  if (metric === "mvp") {
    comparator = (a,b)=>b.mvp.count-a.mvp.count || b.mvp.rate-a.mvp.rate || b.mvp.points-a.mvp.points || cmpText(a,b);
    sameRank = (a,b)=>a.mvp.count===b.mvp.count && eq(a.mvp.rate,b.mvp.rate) && eq(a.mvp.points,b.mvp.points);
  } else if (metric === "positive") {
    comparator = (a,b)=>b.positive.count-a.positive.count || b.positive.rate-a.positive.rate || b.positive.points-a.positive.points || cmpText(a,b);
    sameRank = (a,b)=>a.positive.count===b.positive.count && eq(a.positive.rate,b.positive.rate) && eq(a.positive.points,b.positive.points);
  } else if (metric === "negative") {
    comparator = (a,b)=>b.negative.count-a.negative.count || b.negative.rate-a.negative.rate || a.negative.points-b.negative.points || cmpText(a,b);
    sameRank = (a,b)=>a.negative.count===b.negative.count && eq(a.negative.rate,b.negative.rate) && eq(a.negative.points,b.negative.points);
  } else if (metric === "soloWin") {
    comparator = (a,b)=>b.soloWin.count-a.soloWin.count || b.soloWin.rate-a.soloWin.rate || b.soloWin.points-a.soloWin.points || cmpText(a,b);
    sameRank = (a,b)=>a.soloWin.count===b.soloWin.count && eq(a.soloWin.rate,b.soloWin.rate) && eq(a.soloWin.points,b.soloWin.points);
  } else if (metric === "soloLoss") {
    comparator = (a,b)=>b.soloLoss.count-a.soloLoss.count || b.soloLoss.rate-a.soloLoss.rate || a.soloLoss.points-b.soloLoss.points || cmpText(a,b);
    sameRank = (a,b)=>a.soloLoss.count===b.soloLoss.count && eq(a.soloLoss.rate,b.soloLoss.rate) && eq(a.soloLoss.points,b.soloLoss.points);
  } else if (metric === "explosion" || metric === "explosionTier") {
    comparator = (a,b)=>b.explosion.count-a.explosion.count || b.explosion.points-a.explosion.points || b.explosion.average-a.explosion.average || cmpText(a,b);
    sameRank = (a,b)=>a.explosion.count===b.explosion.count && eq(a.explosion.points,b.explosion.points) && eq(a.explosion.average,b.explosion.average);
  } else {
    comparator = (a,b)=>b.total-a.total || b.average-a.average || cmpText(a,b);
    sameRank = (a,b)=>eq(a.total,b.total) && eq(a.average,b.average);
  }
  return rankedRows(rows, comparator, sameRank);
}

export function buildExplosionLeaderboard(players, matches, { season = "all", type = "all" } = {}) {
  const selected = selectMatches(matches, { season, type });
  const schedules = playerSchedule(players, selected);
  const rows = players.map(player => {
    const entries = (schedules[player.playerId] || []).filter(item => !item.absent);
    if (!entries.length) return null;
    const explosions = entries.filter(item => item.score >= 50);
    const bins = { over50:0, over60:0, over70:0, over80:0, over90:0, over100:0 };
    for (const item of explosions) {
      const score = item.score;
      if (score >= 100) bins.over100 += 1;
      else if (score >= 90) bins.over90 += 1;
      else if (score >= 80) bins.over80 += 1;
      else if (score >= 70) bins.over70 += 1;
      else if (score >= 60) bins.over60 += 1;
      else bins.over50 += 1;
    }
    return {
      playerId: player.playerId,
      player: player.name,
      games: entries.length,
      explosionCount: explosions.length,
      explosionPoints: sum(explosions.map(item => item.score)),
      explosionAverage: mean(explosions.map(item => item.score)),
      explosionRate: entries.length ? explosions.length / entries.length : 0,
      ...bins
    };
  }).filter(Boolean);
  return rankedRows(rows,
    (a,b)=>b.explosionCount-a.explosionCount || b.explosionPoints-a.explosionPoints || b.explosionAverage-a.explosionAverage || String(a.playerId).localeCompare(String(b.playerId)),
    (a,b)=>a.explosionCount===b.explosionCount && eq(a.explosionPoints,b.explosionPoints) && eq(a.explosionAverage,b.explosionAverage)
  );
}

export function buildRecordCenter(players, matches) {
  const availableSeasons = [...new Set((matches || []).map(match => match.season).filter(Boolean))].sort((a,b)=>seasonNumber(a)-seasonNumber(b));
  const seasonKeys = ["all", ...availableSeasons];
  const views = {};
  for (const season of seasonKeys) {
    views[season] = {
      all: buildRecordView(players, matches, season, "all"),
      four: buildRecordView(players, matches, season, "four"),
      five: buildRecordView(players, matches, season, "five")
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    seasons: availableSeasons,
    views,
    methodology: "记录中心由正式比赛数据实时重算。单场记录只比较单场表现；连续记录按所选赛季与比赛类型内的个人实际参赛序列计算，缺席在表现连续记录中不增加也不中断，在连续参赛记录中会中断。爆发定义为单场积分≥50。记录允许并列保持。"
  };
}
