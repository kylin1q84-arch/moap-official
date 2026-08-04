const EPS = 1e-9;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const seasonNumber = value => Number(String(value || "").replace(/\D/g, "")) || 0;

function played(match) {
  return (match.results || []).filter(result => !result.isAbsent && result.score != null);
}

function makeCheck(id, item, issues, evidence) {
  const details = issues.slice(0, 8);
  return {
    id,
    item,
    found: issues.length,
    target: "0",
    result: issues.length ? "FAIL" : "PASS",
    evidence,
    details
  };
}

export function validateMoapData(players = [], matches = [], matchups = []) {
  const playerIds = new Set(players.map(player => player.playerId));
  const ordered = [...matches].sort((a, b) =>
    seasonNumber(a.season) - seasonNumber(b.season) ||
    num(a.round) - num(b.round) ||
    String(a.date).localeCompare(String(b.date)) ||
    String(a.matchId).localeCompare(String(b.matchId))
  );

  const duplicateMatchIds = [];
  const seenMatchIds = new Set();
  for (const match of matches) {
    if (seenMatchIds.has(match.matchId)) duplicateMatchIds.push(match.matchId);
    seenMatchIds.add(match.matchId);
  }

  const duplicateRounds = [];
  const seenRounds = new Set();
  for (const match of matches) {
    const key = `${match.season}|${match.round}`;
    if (seenRounds.has(key)) duplicateRounds.push(key);
    seenRounds.add(key);
  }

  const invalidParticipants = [];
  const balanceErrors = [];
  const mvpCountErrors = [];
  const mvpScoreErrors = [];
  const resultPlayerErrors = [];
  const duplicateResultPlayers = [];
  const invalidScores = [];

  for (const match of matches) {
    const rows = played(match);
    const expected = match.matchType === "四人局" ? 4 : match.matchType === "五人局" ? 5 : null;
    if (expected == null || rows.length !== expected) invalidParticipants.push(`${match.matchId}：${rows.length}/${expected ?? "未知"}人`);
    const total = rows.reduce((value, result) => value + num(result.score), 0);
    if (Math.abs(total) > EPS) balanceErrors.push(`${match.matchId}：合计${total >= 0 ? "+" : ""}${total}`);
    const mvps = rows.filter(result => result.isMvp);
    if (rows.length) {
      const top = Math.max(...rows.map(result => num(result.score)));
      const topRows = rows.filter(result => num(result.score) === top);
      const markedIds = new Set(mvps.map(result => result.playerId));
      const topIds = new Set(topRows.map(result => result.playerId));
      if (!mvps.length || mvps.length !== topRows.length || [...topIds].some(playerId => !markedIds.has(playerId))) {
        mvpCountErrors.push(`${match.matchId}：最高分${topRows.length}人 / MVP标记${mvps.length}人`);
      }
      for (const mvp of mvps) {
        if (num(mvp.score) !== top) mvpScoreErrors.push(`${match.matchId}：MVP ${mvp.score}，最高${top}`);
      }
    }
    const seenPlayers = new Set();
    for (const result of match.results || []) {
      if (!playerIds.has(result.playerId)) resultPlayerErrors.push(`${match.matchId}：${result.playerId || "缺失PlayerID"}`);
      if (seenPlayers.has(result.playerId)) duplicateResultPlayers.push(`${match.matchId}：${result.playerId}`);
      seenPlayers.add(result.playerId);
      if (!result.isAbsent && !Number.isFinite(Number(result.score))) invalidScores.push(`${match.matchId}：${result.playerId}`);
    }
  }

  const dateOrderErrors = [];
  const bySeason = {};
  for (const match of ordered) (bySeason[match.season] ??= []).push(match);
  for (const [season, seasonMatches] of Object.entries(bySeason)) {
    seasonMatches.sort((a, b) => num(a.round) - num(b.round) || String(a.matchId).localeCompare(String(b.matchId)));
    for (let index = 1; index < seasonMatches.length; index += 1) {
      const previous = seasonMatches[index - 1];
      const current = seasonMatches[index];
      if (String(current.date) < String(previous.date)) dateOrderErrors.push(`${season}第${current.round}局 ${current.date} 早于第${previous.round}局 ${previous.date}`);
    }
  }

  const matchupFormatErrors = [];
  const matchupUnknownMatch = [];
  const matchupByMatch = {};
  const matchById = Object.fromEntries(matches.map(match => [match.matchId, match]));
  for (const row of matchups || []) {
    if (!row.matchId || !playerIds.has(row.fromPlayerId) || !playerIds.has(row.toPlayerId) || row.fromPlayerId === row.toPlayerId || !Number.isInteger(Number(row.points)) || Number(row.points) <= 0) {
      matchupFormatErrors.push(row.id || `${row.matchId || "无场次"}:${row.fromPlayerId || "?"}->${row.toPlayerId || "?"}`);
      continue;
    }
    if (!matchById[row.matchId]) matchupUnknownMatch.push(row.matchId);
    (matchupByMatch[row.matchId] ??= []).push(row);
  }

  const matchupBalanceErrors = [];
  for (const [matchId, rows] of Object.entries(matchupByMatch)) {
    const match = matchById[matchId];
    if (!match) continue;
    const nets = Object.fromEntries(players.map(player => [player.playerId, 0]));
    for (const row of rows) {
      nets[row.fromPlayerId] += num(row.points);
      nets[row.toPlayerId] -= num(row.points);
    }
    for (const result of played(match)) {
      if (num(nets[result.playerId]) !== num(result.score)) matchupBalanceErrors.push(`${matchId}：${result.player || result.playerId} 对位${nets[result.playerId]} / 总分${result.score}`);
    }
  }

  const checks = [
    makeCheck("DV001", "比赛ID唯一性", duplicateMatchIds, "matches.matchId"),
    makeCheck("DV002", "赛季轮次唯一性", duplicateRounds, "season + round"),
    makeCheck("DV003", "四/五人局参赛人数", invalidParticipants, "每场实际参赛人数"),
    makeCheck("DV004", "每场积分合计为0", balanceErrors, "match.results.score"),
    makeCheck("DV005", "MVP标记覆盖全部并列最高分", mvpCountErrors, "最高分牌手全部标记MVP"),
    makeCheck("DV006", "MVP等于当场最高分", mvpScoreErrors, "MVP score = max score"),
    makeCheck("DV007", "成绩牌手合法且不重复", [...resultPlayerErrors, ...duplicateResultPlayers], "match.results.playerId"),
    makeCheck("DV008", "参赛成绩为有效数字", invalidScores, "非缺席成绩不可为空"),
    makeCheck("DV009", "赛季轮次日期顺序", dateOrderErrors, "同赛季后续轮次日期不得倒退"),
    makeCheck("DV010", "精准对位格式合法", [...matchupFormatErrors, ...matchupUnknownMatch], "matchup_transfers"),
    makeCheck("DV011", "精准对位合计对应比赛总分", matchupBalanceErrors, "有对位记录的场次逐人核对")
  ];
  const passCount = checks.filter(check => check.result === "PASS").length;
  return {
    checks,
    healthScore: Math.round(passCount / checks.length * 100),
    warningCount: checks.reduce((total, check) => total + check.found, 0),
    isValid: checks.every(check => check.result === "PASS")
  };
}
