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
    const av = num(a.value);
    const bv = num(b.value);
    if (!eq(av, bv)) return direction === "asc" ? av - bv : bv - av;
    return String(a.createdAt || "9999").localeCompare(String(b.createdAt || "9999")) ||
      String(a.playerId || "").localeCompare(String(b.playerId || "")) ||
      String(a.season || "").localeCompare(String(b.season || ""), undefined, { numeric: true });
  });
  let rank = 0;
  let previous = null;
  return filtered.map((candidate, index) => {
    if (previous == null || !eq(candidate.value, previous)) rank = index + 1;
    previous = candidate.value;
    return { ...candidate, rank };
  });
}

function makeRecord({ id, section, name, recordType, rule, unit, direction = "desc", candidates = [], requirePositive = false, forcePlus = false }) {
  let ranking = rankCandidates(candidates, direction);
  if (requirePositive && (!ranking.length || num(ranking[0].value) <= 0)) ranking = [];
  const holders = ranking.filter(candidate => candidate.rank === 1);
  const value = holders.length ? holders[0].value : null;
  return {
    id,
    section,
    name,
    recordType,
    rule,
    unit,
    direction,
    forcePlus,
    holders: holders.map(candidate => ({ playerId: candidate.playerId, player: candidate.player, season: candidate.season, createdAt: candidate.createdAt })),
    holderNames: holders.map(candidate => candidate.player),
    value,
    displayValue: displayNumber(value, unit, forcePlus),
    createdAt: holders.length ? [...holders].map(candidate => candidate.createdAt).filter(Boolean).sort()[0] || "—" : "—",
    ranking,
    evidence: holders.flatMap(holder => holder.evidence || [])
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
    ? nonNegative[0].playerId
    : null;
  const soloLoserId = negative.length === 1 && rows.every(result => result.playerId === negative[0].playerId || num(result.score) >= 0)
    ? negative[0].playerId
    : null;
  const metrics = Object.fromEntries(rows.map(result => {
    const opponents = rows.filter(other => other.playerId !== result.playerId);
    const opponentAverage = opponents.length ? mean(opponents.map(other => other.score)) : 0;
    const dominanceMargin = num(result.score) - opponentAverage;
    return [result.playerId, {
      isSoloWin: result.playerId === soloWinnerId,
      isSoloLoss: result.playerId === soloLoserId,
      isBigWin: opponents.length > 0 && dominanceMargin >= 100,
      isBigStage: num(result.score) >= 50,
      opponentAverage,
      dominanceMargin
    }];
  }));
  return { rows, metrics };
}

function filterMatches(matches, type) {
  if (type === "four") return sortedMatches(matches).filter(match => match.matchType === "四人局");
  if (type === "five") return sortedMatches(matches).filter(match => match.matchType === "五人局");
  return sortedMatches(matches);
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
      isBigStage: !!flags.isBigStage,
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

function historicalRecords(players, matches) {
  const schedules = playerSchedule(players, matches);
  const allEvents = Object.values(schedules).flat().filter(item => !item.absent);
  const singleCandidates = predicate => allEvents.filter(predicate).map(item => ({
    playerId: item.playerId,
    player: item.player,
    value: item.score,
    createdAt: item.match.date,
    season: item.match.season,
    matchId: item.match.matchId,
    matchType: item.match.matchType,
    evidence: [matchEvidence(item.match, item.result, {
      dominanceMargin: item.dominanceMargin,
      opponentAverage: item.opponentAverage
    })]
  }));

  const dominanceCandidates = allEvents.map(item => ({
    playerId: item.playerId,
    player: item.player,
    value: item.dominanceMargin,
    createdAt: item.match.date,
    season: item.match.season,
    matchId: item.match.matchId,
    matchType: item.match.matchType,
    evidence: [matchEvidence(item.match, item.result, {
      dominanceMargin: item.dominanceMargin,
      opponentAverage: item.opponentAverage
    })]
  }));

  const stageMap = {};
  const stageDefinitions = {
    positive: item => item.score >= 0,
    negative: item => item.score < 0,
    mvp: item => item.isMvp,
    solo: item => item.isSoloWin,
    bigwin: item => item.isBigWin,
    bigstage: item => item.isBigStage
  };
  for (const [key, predicate] of Object.entries(stageDefinitions)) {
    stageMap[key] = Object.values(schedules).flatMap(schedule => buildStages(schedule, predicate, { ignoreAbsent: true }));
  }
  stageMap.participation = Object.values(schedules).flatMap(schedule => buildStages(schedule, () => true, { ignoreAbsent: false }));

  const lengthCandidates = key => stageMap[key].map(stage => ({ ...stage, value: stage.length }));
  const pointCandidates = key => stageMap[key].map(stage => ({ ...stage, value: stage.points }));

  return [
    makeRecord({ id:"HIST_SINGLE_LOW", section:"historical", name:"单场最低积分", recordType:"单场记录", rule:"所有正式比赛中实际参赛牌手的最低单场积分。", unit:"分", direction:"asc", candidates:singleCandidates(() => true) }),
    makeRecord({ id:"HIST_MVP_HIGH", section:"historical", name:"单场MVP最高积分", recordType:"单场记录", rule:"所有获得MVP的正式比赛中，MVP牌手的最高单场积分。", unit:"分", direction:"desc", candidates:singleCandidates(item => item.isMvp) }),
    makeRecord({ id:"HIST_MVP_LOW", section:"historical", name:"单场MVP最低积分", recordType:"单场记录", rule:"所有获得MVP的正式比赛中，MVP牌手的最低单场积分。", unit:"分", direction:"asc", candidates:singleCandidates(item => item.isMvp) }),
    makeRecord({ id:"HIST_SOLO_HIGH", section:"historical", name:"单场独赢最高积分", recordType:"单场记录", rule:"独赢场次中牌手的最高单场积分；独赢要求本人积分≥0且其他实际参赛牌手均＜0。", unit:"分", direction:"desc", candidates:singleCandidates(item => item.isSoloWin) }),
    makeRecord({ id:"HIST_SOLO_LOW", section:"historical", name:"单场独赢最低积分", recordType:"单场记录", rule:"独赢场次中牌手的最低单场积分。", unit:"分", direction:"asc", candidates:singleCandidates(item => item.isSoloWin) }),
    makeRecord({ id:"HIST_BIGWIN_HIGH", section:"historical", name:"单场大胜最高积分", recordType:"单场记录", rule:"大胜场次中牌手的最高单场积分；大胜要求本人积分减其他实际参赛牌手平均积分≥100。", unit:"分", direction:"desc", candidates:singleCandidates(item => item.isBigWin) }),
    makeRecord({ id:"HIST_BIGWIN_LOW", section:"historical", name:"单场大胜最低积分", recordType:"单场记录", rule:"大胜场次中牌手的最低单场积分。", unit:"分", direction:"asc", candidates:singleCandidates(item => item.isBigWin) }),
    makeRecord({ id:"HIST_MAX_LEAD", section:"historical", name:"单场最大领先分差", recordType:"单场记录", rule:"单场本人积分－同场其他实际参赛牌手平均积分，取历史最高值。", unit:"分", direction:"desc", forcePlus:true, candidates:dominanceCandidates }),

    makeRecord({ id:"HIST_POS_STREAK", section:"historical", name:"最长连续正分场次", recordType:"连续记录", rule:"按个人实际参赛序列统计得分≥0的最长连续场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("positive") }),
    makeRecord({ id:"HIST_NEG_STREAK", section:"historical", name:"最长连续负分场次", recordType:"连续记录", rule:"按个人实际参赛序列统计得分＜0的最长连续场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("negative") }),
    makeRecord({ id:"HIST_POS_STAGE_POINTS", section:"historical", name:"最长连续正分阶段积分", recordType:"连续记录", rule:"所有连续正分阶段中累计积分最高的一段；详情同时展示阶段长度和逐场过程。", unit:"分", candidates:pointCandidates("positive") }),
    makeRecord({ id:"HIST_NEG_STAGE_POINTS", section:"historical", name:"最长连续负分阶段积分", recordType:"连续记录", rule:"所有连续负分阶段中累计积分最低的一段；详情同时展示阶段长度和逐场过程。", unit:"分", direction:"asc", candidates:pointCandidates("negative") }),
    makeRecord({ id:"HIST_MVP_STREAK", section:"historical", name:"最长连续MVP场次", recordType:"连续记录", rule:"按个人实际参赛序列统计连续获得MVP的最长场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("mvp") }),
    makeRecord({ id:"HIST_MVP_STAGE_POINTS", section:"historical", name:"最长连续MVP阶段积分", recordType:"连续记录", rule:"所有连续MVP阶段中累计积分最高的一段。", unit:"分", candidates:pointCandidates("mvp") }),
    makeRecord({ id:"HIST_SOLO_STREAK", section:"historical", name:"最长连续独赢场次", recordType:"连续记录", rule:"按个人实际参赛序列统计连续独赢的最长场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("solo") }),
    makeRecord({ id:"HIST_SOLO_STAGE_POINTS", section:"historical", name:"最长连续独赢阶段积分", recordType:"连续记录", rule:"所有连续独赢阶段中累计积分最高的一段。", unit:"分", candidates:pointCandidates("solo") }),
    makeRecord({ id:"HIST_BIGWIN_STREAK", section:"historical", name:"最长连续大胜场次", recordType:"连续记录", rule:"按个人实际参赛序列统计连续大胜的最长场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("bigwin") }),
    makeRecord({ id:"HIST_BIGWIN_STAGE_POINTS", section:"historical", name:"最长连续大胜阶段积分", recordType:"连续记录", rule:"所有连续大胜阶段中累计积分最高的一段。", unit:"分", candidates:pointCandidates("bigwin") }),
    makeRecord({ id:"HIST_BIG_STAGE_STREAK", section:"historical", name:"最长连续大场面场次", recordType:"连续记录", rule:"按个人实际参赛序列统计单场积分≥50的最长连续场次；缺席不增加也不中断。", unit:"场", candidates:lengthCandidates("bigstage") }),
    makeRecord({ id:"HIST_BIG_STAGE_POINTS", section:"historical", name:"最长连续大场面阶段积分", recordType:"连续记录", rule:"所有连续大场面阶段中累计积分最高的一段。", unit:"分", candidates:pointCandidates("bigstage") }),
    makeRecord({ id:"HIST_PARTICIPATION_STREAK", section:"historical", name:"最长连续参赛场次", recordType:"连续记录", rule:"连续出席正式比赛的最长场次；缺席会中断。", unit:"场", candidates:lengthCandidates("participation") })
  ];
}

function seasonCandidateRows(players, matches) {
  const seasons = [...new Set(matches.map(match => match.season))].filter(Boolean).sort((a, b) => seasonNumber(a) - seasonNumber(b));
  const rows = [];
  for (const season of seasons) {
    const seasonMatches = matches.filter(match => match.season === season);
    const schedules = playerSchedule(players, seasonMatches);
    const playerRows = [];

    for (const player of players.filter(item => seasonNumber(item.joinSeason) <= seasonNumber(season))) {
      const schedule = schedules[player.playerId] || [];
      const entries = schedule.filter(item => !item.absent);
      if (!entries.length) continue;
      const positive = entries.filter(item => item.score >= 0);
      const negative = entries.filter(item => item.score < 0);
      const mvp = entries.filter(item => item.isMvp);
      const solo = entries.filter(item => item.isSoloWin);
      const bigwin = entries.filter(item => item.isBigWin);
      const stages = {
        positive: buildStages(schedule, item => item.score >= 0),
        negative: buildStages(schedule, item => item.score < 0),
        mvp: buildStages(schedule, item => item.isMvp),
        solo: buildStages(schedule, item => item.isSoloWin),
        bigwin: buildStages(schedule, item => item.isBigWin),
        bigstage: buildStages(schedule, item => item.isBigStage)
      };
      const longest = key => Math.max(0, ...stages[key].map(stage => stage.length));
      const maxPoints = key => Math.max(0, ...stages[key].map(stage => stage.points));
      const minPoints = key => Math.min(0, ...stages[key].map(stage => stage.points));
      const lastDate = entries.at(-1).match.date;
      const evidence = entries.map(item => matchEvidence(item.match, item.result, {
        dominanceMargin: item.dominanceMargin,
        opponentAverage: item.opponentAverage
      }));
      playerRows.push({
        playerId: player.playerId,
        player: player.name,
        season,
        createdAt: lastDate,
        evidence,
        games: entries.length,
        total: sum(entries.map(item => item.score)),
        average: mean(entries.map(item => item.score)),
        positiveCount: positive.length,
        negativeCount: negative.length,
        positiveTotal: sum(positive.map(item => item.score)),
        negativeTotal: sum(negative.map(item => item.score)),
        mvpCount: mvp.length,
        mvpTotal: sum(mvp.map(item => item.score)),
        soloCount: solo.length,
        soloTotal: sum(solo.map(item => item.score)),
        bigWinCount: bigwin.length,
        bigWinTotal: sum(bigwin.map(item => item.score)),
        positiveStreak: longest("positive"),
        negativeStreak: longest("negative"),
        positiveStagePoints: maxPoints("positive"),
        negativeStagePoints: minPoints("negative"),
        mvpStreak: longest("mvp"),
        mvpStagePoints: maxPoints("mvp"),
        soloStreak: longest("solo"),
        soloStagePoints: maxPoints("solo"),
        bigWinStreak: longest("bigwin"),
        bigWinStagePoints: maxPoints("bigwin"),
        bigStageStreak: longest("bigstage"),
        bigStagePoints: maxPoints("bigstage")
      });
    }

    for (const row of playerRows) {
      const opponents = playerRows.filter(other => other.playerId !== row.playerId);
      row.seasonLead = row.total - (opponents.length ? mean(opponents.map(other => other.total)) : 0);
    }
    rows.push(...playerRows);
  }
  return rows;
}

function seasonRecords(players, matches) {
  const rows = seasonCandidateRows(players, matches);
  const candidates = (key, eligibility = () => true) => rows.filter(eligibility).map(row => ({ ...row, value: row[key] }));
  const countRecord = (config, key) => makeRecord({ ...config, section:"season", recordType:"赛季记录", unit:"场", candidates:candidates(key), requirePositive:true });
  const pointsRecord = (config, key, direction = "desc", eligibility = () => true) => makeRecord({ ...config, section:"season", recordType:"赛季记录", unit:"分", direction, candidates:candidates(key, eligibility) });

  return [
    pointsRecord({ id:"SEASON_TOTAL_HIGH", name:"赛季最高累计积分", rule:"以牌手单赛季最终累计积分为候选，取历史最高值。" }, "total"),
    pointsRecord({ id:"SEASON_TOTAL_LOW", name:"赛季最低累计积分", rule:"以牌手单赛季最终累计积分为候选，取历史最低值。" }, "total", "asc"),
    makeRecord({ id:"SEASON_AVG_HIGH", section:"season", name:"赛季最高场均积分", recordType:"赛季记录", rule:"单赛季总积分÷实际参赛场次，取历史最高值。", unit:"分/场", candidates:candidates("average") }),
    makeRecord({ id:"SEASON_AVG_LOW", section:"season", name:"赛季最低场均积分", recordType:"赛季记录", rule:"单赛季总积分÷实际参赛场次，取历史最低值。", unit:"分/场", direction:"asc", candidates:candidates("average") }),
    countRecord({ id:"SEASON_POS_COUNT", name:"赛季最多正分场次", rule:"单赛季得分≥0的场次最多。" }, "positiveCount"),
    countRecord({ id:"SEASON_NEG_COUNT", name:"赛季最多负分场次", rule:"单赛季得分＜0的场次最多。" }, "negativeCount"),
    pointsRecord({ id:"SEASON_POS_TOTAL_HIGH", name:"赛季正分场次最高累计积分", rule:"只累计单赛季正分场次积分，取历史最高值。" }, "positiveTotal", "desc", row => row.positiveCount > 0),
    pointsRecord({ id:"SEASON_NEG_TOTAL_HIGH", name:"赛季负分场次最高累计积分", rule:"只累计单赛季负分场次积分，取数值最高者。" }, "negativeTotal", "desc", row => row.negativeCount > 0),
    pointsRecord({ id:"SEASON_POS_TOTAL_LOW", name:"赛季正分场次最低累计积分", rule:"只累计单赛季正分场次积分，取数值最低者。" }, "positiveTotal", "asc", row => row.positiveCount > 0),
    pointsRecord({ id:"SEASON_NEG_TOTAL_LOW", name:"赛季负分场次最低累计积分", rule:"只累计单赛季负分场次积分，取数值最低者。" }, "negativeTotal", "asc", row => row.negativeCount > 0),
    countRecord({ id:"SEASON_MVP_COUNT", name:"赛季最多MVP场次", rule:"单赛季获得MVP的场次最多。" }, "mvpCount"),
    pointsRecord({ id:"SEASON_MVP_TOTAL_HIGH", name:"赛季MVP场次最高累计积分", rule:"只累计获得MVP的场次积分，取历史最高值。" }, "mvpTotal", "desc", row => row.mvpCount > 0),
    pointsRecord({ id:"SEASON_MVP_TOTAL_LOW", name:"赛季MVP场次最低累计积分", rule:"只累计获得MVP的场次积分，取历史最低值。" }, "mvpTotal", "asc", row => row.mvpCount > 0),
    countRecord({ id:"SEASON_SOLO_COUNT", name:"赛季最多独赢场次", rule:"单赛季独赢场次最多。" }, "soloCount"),
    pointsRecord({ id:"SEASON_SOLO_TOTAL_HIGH", name:"赛季独赢场次最高累计积分", rule:"只累计单赛季独赢场次积分，取历史最高值。" }, "soloTotal", "desc", row => row.soloCount > 0),
    pointsRecord({ id:"SEASON_SOLO_TOTAL_LOW", name:"赛季独赢场次最低累计积分", rule:"只累计单赛季独赢场次积分，取历史最低值。" }, "soloTotal", "asc", row => row.soloCount > 0),
    countRecord({ id:"SEASON_BIGWIN_COUNT", name:"赛季最多大胜场次", rule:"单赛季大胜场次最多；大胜要求本人积分减其他牌手平均积分≥100。" }, "bigWinCount"),
    pointsRecord({ id:"SEASON_BIGWIN_TOTAL_HIGH", name:"赛季大胜场次最高累计积分", rule:"只累计单赛季大胜场次的本人积分，取历史最高值。" }, "bigWinTotal", "desc", row => row.bigWinCount > 0),
    pointsRecord({ id:"SEASON_BIGWIN_TOTAL_LOW", name:"赛季大胜场次最低累计积分", rule:"只累计单赛季大胜场次的本人积分，取历史最低值。" }, "bigWinTotal", "asc", row => row.bigWinCount > 0),
    countRecord({ id:"SEASON_POS_STREAK", name:"赛季最长连续正分场次", rule:"单赛季个人实际参赛序列中最长连续正分场次。" }, "positiveStreak"),
    countRecord({ id:"SEASON_NEG_STREAK", name:"赛季最长连续负分场次", rule:"单赛季个人实际参赛序列中最长连续负分场次。" }, "negativeStreak"),
    pointsRecord({ id:"SEASON_POS_STAGE_POINTS", name:"赛季最长连续正分阶段积分", rule:"单赛季连续正分阶段累计积分最高值。" }, "positiveStagePoints"),
    pointsRecord({ id:"SEASON_NEG_STAGE_POINTS", name:"赛季最长连续负分阶段积分", rule:"单赛季连续负分阶段累计积分最低值。" }, "negativeStagePoints", "asc"),
    countRecord({ id:"SEASON_MVP_STREAK", name:"赛季最长连续MVP场次", rule:"单赛季最长连续MVP场次。" }, "mvpStreak"),
    pointsRecord({ id:"SEASON_MVP_STAGE_POINTS", name:"赛季最长连续MVP阶段积分", rule:"单赛季连续MVP阶段累计积分最高值。" }, "mvpStagePoints", "desc", row => row.mvpCount > 0),
    countRecord({ id:"SEASON_SOLO_STREAK", name:"赛季最长连续独赢场次", rule:"单赛季最长连续独赢场次。" }, "soloStreak"),
    pointsRecord({ id:"SEASON_SOLO_STAGE_POINTS", name:"赛季最长连续独赢阶段积分", rule:"单赛季连续独赢阶段累计积分最高值。" }, "soloStagePoints", "desc", row => row.soloCount > 0),
    countRecord({ id:"SEASON_BIGWIN_STREAK", name:"赛季最长连续大胜场次", rule:"单赛季最长连续大胜场次。" }, "bigWinStreak"),
    pointsRecord({ id:"SEASON_BIGWIN_STAGE_POINTS", name:"赛季最长连续大胜阶段积分", rule:"单赛季连续大胜阶段累计积分最高值。" }, "bigWinStagePoints", "desc", row => row.bigWinCount > 0),
    countRecord({ id:"SEASON_BIG_STAGE_STREAK", name:"赛季最长连续大场面场次", rule:"单赛季最长连续50+场次。" }, "bigStageStreak"),
    pointsRecord({ id:"SEASON_BIG_STAGE_POINTS", name:"赛季最长连续大场面阶段积分", rule:"单赛季连续50+阶段累计积分最高值。" }, "bigStagePoints", "desc", row => row.bigStageStreak > 0),
    makeRecord({ id:"SEASON_MAX_LEAD", section:"season", name:"赛季最大领先分差", recordType:"赛季记录", rule:"赛季本人最终积分－同赛季其他实际参赛牌手最终积分平均值。", unit:"分", forcePlus:true, candidates:candidates("seasonLead") })
  ];
}

function careerRows(players, matches) {
  const schedules = playerSchedule(players, matches);
  return players.map(player => {
    const entries = (schedules[player.playerId] || []).filter(item => !item.absent);
    const positive = entries.filter(item => item.score >= 0);
    const negative = entries.filter(item => item.score < 0);
    const mvp = entries.filter(item => item.isMvp);
    const soloWins = entries.filter(item => item.isSoloWin);
    const soloLosses = entries.filter(item => item.isSoloLoss);
    const bigWins = entries.filter(item => item.isBigWin);
    const latest = entries.at(-1);
    const baseEvidence = items => items.map(item => matchEvidence(item.match, item.result, {
      dominanceMargin: item.dominanceMargin,
      opponentAverage: item.opponentAverage
    }));
    return {
      playerId: player.playerId,
      player: player.name,
      createdAt: latest?.match.date || "—",
      season: "CAREER",
      evidence: baseEvidence(entries),
      total: sum(entries.map(item => item.score)),
      mvpCount: mvp.length,
      mvpTotal: sum(mvp.map(item => item.score)),
      mvpEvidence: baseEvidence(mvp),
      positiveCount: positive.length,
      positiveTotal: sum(positive.map(item => item.score)),
      positiveEvidence: baseEvidence(positive),
      negativeCount: negative.length,
      negativeEvidence: baseEvidence(negative),
      soloWinCount: soloWins.length,
      soloLossCount: soloLosses.length,
      soloWinTotal: sum(soloWins.map(item => item.score)),
      soloLossTotal: sum(soloLosses.map(item => item.score)),
      soloWinEvidence: baseEvidence(soloWins),
      soloLossEvidence: baseEvidence(soloLosses),
      bigWinCount: bigWins.length,
      bigWinTotal: sum(bigWins.map(item => item.score)),
      bigWinEvidence: baseEvidence(bigWins),
      over50: entries.filter(item => item.score >= 50).length,
      over60: entries.filter(item => item.score >= 60).length,
      over70: entries.filter(item => item.score >= 70).length,
      over80: entries.filter(item => item.score >= 80).length,
      over90: entries.filter(item => item.score >= 90).length,
      over100: entries.filter(item => item.score >= 100).length
    };
  });
}

function careerRecords(players, matches) {
  const rows = careerRows(players, matches);
  const candidates = (key, evidenceKey = "evidence", eligibility = () => true) => rows.filter(eligibility).map(row => {
    const evidence = row[evidenceKey] || row.evidence || [];
    return {
      ...row,
      value: row[key],
      evidence,
      createdAt: evidence.at(-1)?.date || row.createdAt
    };
  });
  const countRecord = (id, name, rule, key, evidenceKey = "evidence") => makeRecord({ id, section:"career", name, recordType:"生涯记录", rule, unit:"场", candidates:candidates(key, evidenceKey), requirePositive:true });
  const pointsRecord = (id, name, rule, key, direction = "desc", evidenceKey = "evidence", eligibility = () => true) => makeRecord({ id, section:"career", name, recordType:"生涯记录", rule, unit:"分", direction, candidates:candidates(key, evidenceKey, eligibility) });
  return [
    pointsRecord("CAREER_TOTAL", "生涯最高总积分", "S1至当前全部正式比赛累计积分最高。", "total"),
    countRecord("CAREER_MVP_COUNT", "生涯MVP场次", "生涯获得MVP的场次最多。", "mvpCount", "mvpEvidence"),
    pointsRecord("CAREER_MVP_TOTAL", "生涯MVP场次总积分", "生涯所有MVP场次的本人积分累计最高。", "mvpTotal", "desc", "mvpEvidence", row => row.mvpCount > 0),
    countRecord("CAREER_POS_COUNT", "生涯正分场次", "生涯得分≥0的场次最多。", "positiveCount", "positiveEvidence"),
    pointsRecord("CAREER_POS_TOTAL", "生涯正分场次总积分", "生涯所有正分场次的本人积分累计最高。", "positiveTotal", "desc", "positiveEvidence", row => row.positiveCount > 0),
    countRecord("CAREER_NEG_COUNT", "生涯负分场次", "生涯得分＜0的场次最多。", "negativeCount", "negativeEvidence"),
    countRecord("CAREER_SOLO_WIN_COUNT", "生涯独赢场次", "生涯独赢场次最多。", "soloWinCount", "soloWinEvidence"),
    countRecord("CAREER_SOLO_LOSS_COUNT", "生涯独输场次", "独输指本人＜0且其他实际参赛牌手均≥0；统计生涯独输场次最多。", "soloLossCount", "soloLossEvidence"),
    pointsRecord("CAREER_SOLO_WIN_TOTAL", "生涯独赢场次总积分", "生涯所有独赢场次的本人积分累计最高。", "soloWinTotal", "desc", "soloWinEvidence", row => row.soloWinCount > 0),
    pointsRecord("CAREER_SOLO_LOSS_TOTAL", "生涯独输场次总积分", "生涯所有独输场次的本人积分累计最低。", "soloLossTotal", "asc", "soloLossEvidence", row => row.soloLossCount > 0),
    countRecord("CAREER_BIGWIN_COUNT", "生涯大胜场次", "生涯大胜场次最多。", "bigWinCount", "bigWinEvidence"),
    pointsRecord("CAREER_BIGWIN_TOTAL", "生涯大胜场次总积分", "生涯所有大胜场次的本人积分累计最高。", "bigWinTotal", "desc", "bigWinEvidence", row => row.bigWinCount > 0),
    countRecord("CAREER_50", "生涯单场50+场次", "生涯单场积分≥50的累计场次；高分场次同时计入所有更低门槛。", "over50"),
    countRecord("CAREER_60", "生涯单场60+场次", "生涯单场积分≥60的累计场次。", "over60"),
    countRecord("CAREER_70", "生涯单场70+场次", "生涯单场积分≥70的累计场次。", "over70"),
    countRecord("CAREER_80", "生涯单场80+场次", "生涯单场积分≥80的累计场次。", "over80"),
    countRecord("CAREER_90", "生涯单场90+场次", "生涯单场积分≥90的累计场次。", "over90"),
    countRecord("CAREER_100", "生涯单场100+场次", "生涯单场积分≥100的累计场次。", "over100")
  ];
}

function buildView(players, matches, type) {
  const selectedMatches = filterMatches(matches, type);
  return {
    historical: historicalRecords(players, selectedMatches),
    season: seasonRecords(players, selectedMatches),
    career: careerRecords(players, selectedMatches)
  };
}

export function buildRecordCenter(players, matches) {
  return {
    generatedAt: new Date().toISOString(),
    views: {
      all: buildView(players, matches, "all"),
      four: buildView(players, matches, "four"),
      five: buildView(players, matches, "five")
    },
    methodology: "记录中心全部由正式比赛数据实时重算。历史记录按单场或连续阶段比较；赛季记录以牌手＋赛季为候选；生涯记录使用S1至当前全部正式比赛。记录允许并列保持，不影响官方荣誉评选。"
  };
}
