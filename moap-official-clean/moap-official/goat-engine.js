const EPS = 1e-9;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = values => values.reduce((total, value) => total + num(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const seasonNumber = value => Number(String(value || "").replace(/\D/g, "")) || 0;
const eq = (a, b) => Math.abs(num(a) - num(b)) <= EPS;

function bgrValue(score) {
  score = num(score);
  return score >= 100 ? 12 : score >= 90 ? 8 : score >= 80 ? 5 : score >= 70 ? 3 : score >= 60 ? 2 : score >= 50 ? 1 : 0;
}

function sortedMatches(matches) {
  return [...(matches || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) ||
    num(a.round) - num(b.round) ||
    String(a.matchId).localeCompare(String(b.matchId))
  );
}

function resultFor(match, playerId) {
  return (match.results || []).find(result => result.playerId === playerId);
}

function minmaxNormalizer(rows, getter) {
  const values = rows.map(getter).map(num);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return row => {
    const value = num(getter(row));
    if (eq(high, low)) return eq(high, 0) ? 0 : 50;
    return (value - low) / (high - low) * 100;
  };
}

function competitionRanks(rows) {
  const sorted = [...rows].sort((a, b) =>
    num(b.goatIndex) - num(a.goatIndex) ||
    num(b.breakdown?.honors?.score) - num(a.breakdown?.honors?.score) ||
    num(b.breakdown?.career?.score) - num(a.breakdown?.career?.score) ||
    String(a.playerId).localeCompare(String(b.playerId))
  );
  let rank = 0;
  let previous = null;
  return sorted.map((row, index) => {
    if (previous == null || !eq(row.goatIndex, previous)) rank = index + 1;
    previous = row.goatIndex;
    return { ...row, rank, winner: rank === 1 ? "CURRENT GOAT" : "" };
  });
}

function honorMetrics(players, honors) {
  return players.map(player => {
    const awards = (honors?.[player.playerId] || []).filter(award => award.honorId === "H001" || award.honorId === "H003");
    const titles = awards.filter(award => award.honorId === "H001").length;
    const mvAwards = awards.filter(award => award.honorId === "H003").length;
    return {
      playerId: player.playerId,
      player: player.name,
      officialHonorCount: awards.length,
      adjustedHonorValue: awards.length,
      titles,
      mvAwards
    };
  });
}
function careerMetrics(players, matches) {
  const ordered = sortedMatches(matches);
  const seasons = [...new Set(ordered.map(match => match.season).filter(Boolean))].sort((a, b) => seasonNumber(a) - seasonNumber(b));
  const seasonRows = {};

  for (const season of seasons) {
    const seasonMatches = ordered.filter(match => match.season === season);
    const rows = players.filter(player => seasonNumber(player.joinSeason) <= seasonNumber(season)).map(player => {
      const entries = seasonMatches.map(match => ({ match, result: resultFor(match, player.playerId) }))
        .filter(item => item.result && !item.result.isAbsent && item.result.score != null)
        .map(item => num(item.result.score));
      return { playerId: player.playerId, games: entries.length, total: sum(entries), average: mean(entries) };
    }).filter(row => row.games > 0);
    const ranked = [...rows].sort((a, b) => b.total - a.total || b.average - a.average || String(a.playerId).localeCompare(String(b.playerId)));
    ranked.forEach((row, index) => {
      const n = ranked.length;
      row.rank = index + 1;
      row.competitiveness = n <= 1 ? 100 : (n - 1 - index) / (n - 1) * 100;
    });
    seasonRows[season] = ranked;
  }

  return players.map(player => {
    const eligibleMatches = ordered.filter(match => seasonNumber(match.season) >= seasonNumber(player.joinSeason));
    const entries = eligibleMatches.map(match => ({ match, result: resultFor(match, player.playerId) }))
      .filter(item => item.result && !item.result.isAbsent && item.result.score != null)
      .map(item => ({ ...item, score: num(item.result.score), isMvp: !!item.result.isMvp }));
    const scores = entries.map(item => item.score);
    const four = entries.filter(item => item.match.matchType === "四人局");
    const five = entries.filter(item => item.match.matchType === "五人局");
    const mvps = entries.filter(item => item.isMvp).length;
    const activeSeasonRows = seasons.map(season => seasonRows[season]?.find(row => row.playerId === player.playerId)).filter(Boolean);
    const activeSeasons = activeSeasonRows.length;
    const eligibleSeasons = seasons.filter(season => seasonNumber(season) >= seasonNumber(player.joinSeason)).length;
    const fourAverage = mean(four.map(item => item.score));
    const fiveAverage = mean(five.map(item => item.score));
    let adaptability = 0;
    if (four.length >= 3 && five.length >= 3) adaptability = Math.max(0, 100 - Math.abs(fourAverage - fiveAverage) * 2);
    else if (four.length && five.length) adaptability = 45;
    else if (four.length || five.length) adaptability = 20;
    return {
      playerId: player.playerId,
      player: player.name,
      games: entries.length,
      scheduled: eligibleMatches.length,
      total: sum(scores),
      average: mean(scores),
      positiveRate: entries.length ? entries.filter(item => item.score >= 0).length / entries.length : 0,
      mvps,
      mvpRate: entries.length ? mvps / entries.length : 0,
      bgr: sum(scores.map(bgrValue)),
      bgrPerGame: entries.length ? sum(scores.map(bgrValue)) / entries.length : 0,
      activeSeasons,
      eligibleSeasons,
      seasonCoverage: eligibleSeasons ? activeSeasons / eligibleSeasons * 100 : 0,
      seasonCompetitiveness: mean(activeSeasonRows.map(row => row.competitiveness)),
      participationRate: eligibleMatches.length ? entries.length / eligibleMatches.length * 100 : 0,
      adaptability,
      fourGames: four.length,
      fiveGames: five.length,
      fourAverage,
      fiveAverage
    };
  });
}

const NEGATIVE_RECORD_IDS = new Set([
  "HIST_SINGLE_LOW", "HIST_MVP_LOW", "HIST_SOLO_LOW",
  "HIST_NEG_STREAK", "HIST_NEG_STAGE_POINTS"
]);

const S_TIER = new Set([
  "HIST_SINGLE_HIGH", "HIST_MVP_STREAK", "HIST_MVP_STAGE_POINTS"
]);
const A_TIER = new Set([
  "HIST_MVP_HIGH", "HIST_SOLO_HIGH", "HIST_MAX_LEAD",
  "HIST_POS_STREAK", "HIST_POS_STAGE_POINTS", "HIST_SOLO_STREAK", "HIST_SOLO_STAGE_POINTS",
  "HIST_BIG_STAGE_STREAK", "HIST_BIG_STAGE_POINTS", "HIST_PARTICIPATION_STREAK"
]);

function recordTier(recordId) {
  if (S_TIER.has(recordId)) return { tier: "S", points: 3 };
  if (A_TIER.has(recordId)) return { tier: "A", points: 2 };
  return { tier: "B", points: 1 };
}

function recordMetrics(players, recordCenter) {
  const byPlayer = Object.fromEntries(players.map(player => [player.playerId, {
    playerId: player.playerId, player: player.name, recordCount: 0, weightedRecords: 0, leadBonus: 0, records: []
  }]));
  const sections = recordCenter?.views?.all?.all || {};
  for (const sectionName of ["single", "continuous"]) {
    for (const record of sections[sectionName] || []) {
      if (NEGATIVE_RECORD_IDS.has(record.id) || record.value == null || !record.holders?.length) continue;
      const tier = recordTier(record.id);
      const uniqueHolder = record.holders.length === 1;
      const second = (record.ranking || []).find(row => row.rank > 1);
      let advantage = 0;
      if (uniqueHolder && second && record.direction !== "asc") {
        const denominator = Math.max(1, Math.abs(num(second.value)));
        advantage = Math.min(1, Math.max(0, (num(record.value) - num(second.value)) / denominator));
      }
      const creditedPlayerIds = [...new Set(record.holders.map(holder => holder.playerId))];
      for (const playerId of creditedPlayerIds) {
        const row = byPlayer[playerId];
        if (!row) continue;
        row.recordCount += 1;
        row.weightedRecords += tier.points;
        row.leadBonus += advantage * tier.points * .25;
        row.records.push({ id: record.id, name: record.name, section: sectionName, tier: tier.tier, value: record.displayValue });
      }
    }
  }
  return players.map(player => {
    const row = byPlayer[player.playerId];
    return { ...row, recordValue: row.weightedRecords + row.leadBonus };
  });
}

function componentLabel(key) {
  return ({ honors: "官方荣誉", career: "生涯表现", records: "历史纪录", longevity: "持续性与适应性" })[key] || key;
}

function goatLabel(row) {
  if (row.rank === 1 && row.goatIndex >= 85) return "MSL历史领跑者";
  if (row.goatIndex >= 85) return "历史级竞争者";
  if (row.goatIndex >= 75) return "冠军级核心";
  if (row.goatIndex >= 65) return "长期核心";
  if (row.goatIndex >= 55) return "稳定竞争者";
  if (row.goatIndex >= 45) return "生涯追赶者";
  return "重建中的牌手";
}

function buildEvaluation(row, allRows) {
  const rankedHonor = [...allRows].sort((a, b) => b.titles - a.titles || b.mvAwards - a.mvAwards || b.officialHonorCount - a.officialHonorCount || a.playerId.localeCompare(b.playerId));
  const honorRank = rankedHonor.findIndex(item => item.titles === row.titles && item.mvAwards === row.mvAwards && item.officialHonorCount === row.officialHonorCount) + 1;
  const rankedTotal = [...allRows].sort((a, b) => b.careerRaw.total - a.careerRaw.total || a.playerId.localeCompare(b.playerId));
  const totalRank = rankedTotal.findIndex(item => item.playerId === row.playerId) + 1;
  const components = Object.entries(row.breakdown).sort((a, b) => (b[1].score / b[1].max) - (a[1].score / a[1].max));
  const strengths = components.slice(0, 2).map(([key, item]) => `${componentLabel(key)} ${item.score.toFixed(1)}/${item.max}`);
  const weakness = components.at(-1);
  const facts = [
    `官方荣誉${row.officialHonorCount}次（总冠军${row.titles}次、年度MVP${row.mvAwards}次），联盟第${honorRank}`,
    `S1至今累计${row.careerRaw.total >= 0 ? "+" : ""}${row.careerRaw.total}分，联盟第${totalRank}`,
    `保持${row.recordRaw.recordCount}项GOAT有效纪录，加权纪录值${row.recordRaw.recordValue.toFixed(2)}`,
    `覆盖${row.careerRaw.activeSeasons}/${row.careerRaw.eligibleSeasons}个可参赛赛季，参赛率${row.careerRaw.participationRate.toFixed(1)}%`
  ];
  const summary = `${row.player}当前GOAT指数${row.goatIndex.toFixed(1)}，排名第${row.rank}，历史定位为“${goatLabel(row)}”。主要支撑来自${strengths.join("与")}。`;
  const outlook = weakness ? `目前最需要补强的是${componentLabel(weakness[0])}（${weakness[1].score.toFixed(1)}/${weakness[1].max}）；后续增加总冠军或年度最有价值牌手荣誉、提升跨赛季稳定性或打破高含金量纪录，都会直接改变GOAT竞争格局。` : "继续积累正式比赛数据。";
  return { label: goatLabel(row), summary, outlook, strengths, facts };
}

export function buildGoatSystem(players, matches, honors = {}, recordCenter = {}, previousRows = []) {
  const honorRows = honorMetrics(players, honors);
  const careerRows = careerMetrics(players, matches);
  const recordRows = recordMetrics(players, recordCenter);
  const honorBy = Object.fromEntries(honorRows.map(row => [row.playerId, row]));
  const careerBy = Object.fromEntries(careerRows.map(row => [row.playerId, row]));
  const recordBy = Object.fromEntries(recordRows.map(row => [row.playerId, row]));

  const merged = players.map(player => ({
    playerId: player.playerId,
    player: player.name,
    ...honorBy[player.playerId],
    careerRaw: careerBy[player.playerId],
    recordRaw: recordBy[player.playerId]
  }));

  const nHonor = minmaxNormalizer(merged, row => row.adjustedHonorValue);
  const nTotal = minmaxNormalizer(merged, row => row.careerRaw.total);
  const nAverage = minmaxNormalizer(merged, row => row.careerRaw.average);
  const nPositive = minmaxNormalizer(merged, row => row.careerRaw.positiveRate);
  const nMvp = minmaxNormalizer(merged, row => row.careerRaw.mvpRate);
  const nBgr = minmaxNormalizer(merged, row => row.careerRaw.bgrPerGame);
  const nRecord = minmaxNormalizer(merged, row => row.recordRaw.recordValue);

  let rows = merged.map(row => {
    const honorsScore = nHonor(row) * .40;
    const careerScore = nTotal(row) * .10 + nAverage(row) * .07 + nPositive(row) * .05 + nMvp(row) * .05 + nBgr(row) * .03;
    const recordsScore = nRecord(row) * .15;
    const longevityScore = row.careerRaw.seasonCoverage * .04 + row.careerRaw.seasonCompetitiveness * .05 + row.careerRaw.participationRate * .03 + row.careerRaw.adaptability * .03;
    const breakdown = {
      honors: { label: "官方荣誉", score: Number(honorsScore.toFixed(2)), max: 40 },
      career: { label: "生涯表现", score: Number(careerScore.toFixed(2)), max: 30 },
      records: { label: "历史纪录", score: Number(recordsScore.toFixed(2)), max: 15 },
      longevity: { label: "持续性与适应性", score: Number(longevityScore.toFixed(2)), max: 15 }
    };
    return {
      ...row,
      breakdown,
      goatIndex: Number(sum(Object.values(breakdown).map(item => item.score)).toFixed(1)),
      mvps: row.careerRaw.mvps
    };
  });

  rows = competitionRanks(rows);
  const previousBy = Object.fromEntries((previousRows || []).map(row => [row.playerId, row]));
  rows = rows.map(row => {
    const previous = previousBy[row.playerId];
    const indexChange = previous ? Number((row.goatIndex - num(previous.goatIndex)).toFixed(1)) : 0;
    const movement = previous ? num(previous.rank) - row.rank : 0;
    let changeReason = "当前为GOAT综合模型首次评级。";
    if (previous) {
      const changes = Object.keys(row.breakdown).map(key => ({ key, delta: row.breakdown[key].score - num(previous.breakdown?.[key]?.score) }))
        .filter(item => Math.abs(item.delta) >= .01)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      if (!changes.length && eq(indexChange, 0)) changeReason = "本轮数据未改变GOAT评分结构，指数与排名保持稳定。";
      else {
        const direction = indexChange > 0 ? "上升" : indexChange < 0 ? "下降" : "保持";
        const drivers = changes.slice(0, 2).map(item => componentLabel(item.key)).join("、") || "其他牌手评分变化";
        changeReason = `本轮GOAT指数${direction}${Math.abs(indexChange).toFixed(1)}分，主要变化来自${drivers}${movement ? `；排名${movement > 0 ? `上升${movement}位` : `下降${Math.abs(movement)}位`}` : "；排名不变"}。`;
      }
    }
    return { ...row, previousIndex: previous?.goatIndex ?? row.goatIndex, previousRank: previous?.rank ?? row.rank, indexChange, movement, changeReason };
  });
  rows = rows.map(row => ({ ...row, evaluation: buildEvaluation(row, rows) }));

  return {
    rows,
    methodology: "GOAT指数满分100：官方荣誉40%＋生涯表现30%＋单场/连续历史纪录15%＋持续性与适应性15%。官方荣誉维度仅统计MSL总冠军与MSL年度最有价值牌手，不读取其他奖项。历史纪录按S/A/B含金量分级，评分由固定数据模型生成，AI只负责解释。"
  };
}

export const GOAT_RECORD_POLICY = {
  negativeRecordIds: [...NEGATIVE_RECORD_IDS],
  sTierIds: [...S_TIER],
  aTierIds: [...A_TIER]
};
