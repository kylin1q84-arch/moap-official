// Source IDs remain the database identity. Only these reviewed pairs are folded
// into one official match in the in-memory archive.
export const OFFICIAL_SPLIT_SESSIONS = Object.freeze([
  {firstHalfId:"MSL0042",secondHalfId:"MSL0043",expectedSeason:"S2",expectedDate:"2025-10-04",matrixEvidence:"unrecorded"},
  {firstHalfId:"MSL0074",secondHalfId:"MSL0075",expectedSeason:"S3",expectedDate:"2026-10-05",matrixEvidence:"required"}
]);

const sourceOrdinal = id => {
  const match = /^MSL(\d{4,})$/.exec(String(id || ""));
  return match ? Number(match[1]) : NaN;
};
const cloneRow = row => ({...row});
const participantIds = rows => rows.filter(row => !row.is_absent && row.score != null)
  .map(row => String(row.player_id)).sort();
const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
const check = (condition, message) => {if (!condition) throw new Error(message);};

function resultMap(rows, sourceId) {
  const byPlayer = new Map();
  for (const row of rows) {
    const playerId = String(row.player_id || "");
    check(playerId && !byPlayer.has(playerId), `${sourceId}: duplicate or missing result player`);
    byPlayer.set(playerId, row);
  }
  check(byPlayer.size > 0, `${sourceId}: no result rows`);
  return byPlayer;
}

function directionalMap(rows, sourceId, participants, byPlayer) {
  const cells = new Map();
  const active = new Set(participants);
  for (const row of rows) {
    const from = String(row.from_player_id || ""), to = String(row.to_player_id || "");
    const points = Number(row.points), key = `${from}|${to}`;
    check(active.has(from) && active.has(to) && from !== to && Number.isInteger(points) && !cells.has(key),
      `${sourceId}: invalid or duplicate directional cell ${key}`);
    cells.set(key, points);
  }
  const expected = participants.length * (participants.length - 1);
  check(cells.size === expected, `${sourceId}: matrix incomplete (${cells.size}/${expected})`);
  for (const from of participants) {
    const outgoing = participants.filter(to => to !== from).reduce((sum, to) => sum + cells.get(`${from}|${to}`), 0);
    check(outgoing === Number(byPlayer.get(from).score), `${sourceId}: outgoing total mismatch for ${from}`);
  }
  return cells;
}

export function validateSplitSession(config, db, sourceById) {
  const {firstHalfId, secondHalfId, expectedSeason, expectedDate, matrixEvidence} = config;
  try {
    const first = sourceById.get(firstHalfId), second = sourceById.get(secondHalfId);
    check(first && second, `${firstHalfId}/${secondHalfId}: missing source match`);
    check(db.matches.filter(row => row.id === firstHalfId).length === 1 &&
      db.matches.filter(row => row.id === secondHalfId).length === 1,
      `${firstHalfId}/${secondHalfId}: source IDs must each exist exactly once`);
    check(sourceOrdinal(secondHalfId) === sourceOrdinal(firstHalfId) + 1,
      `${firstHalfId}/${secondHalfId}: source order is not adjacent`);
    check(first.match_date === expectedDate && second.match_date === expectedDate,
      `${firstHalfId}/${secondHalfId}: date mismatch`);
    check(first.season_id === expectedSeason && second.season_id === expectedSeason,
      `${firstHalfId}/${secondHalfId}: season mismatch`);
    check(first.match_type === second.match_type, `${firstHalfId}/${secondHalfId}: match type mismatch`);

    const firstRows = db.results.filter(row => row.match_id === firstHalfId).map(cloneRow);
    const secondRows = db.results.filter(row => row.match_id === secondHalfId).map(cloneRow);
    const firstByPlayer = resultMap(firstRows, firstHalfId);
    const secondByPlayer = resultMap(secondRows, secondHalfId);
    const firstRoster = [...firstByPlayer.keys()].sort(), secondRoster = [...secondByPlayer.keys()].sort();
    check(sameIds(firstRoster, secondRoster), `${firstHalfId}/${secondHalfId}: result rosters differ`);
    const firstActive = participantIds(firstRows), secondActive = participantIds(secondRows);
    check(firstActive.length > 0 && sameIds(firstActive, secondActive),
      `${firstHalfId}/${secondHalfId}: effective participant sets differ`);
    for (const id of firstRoster) {
      const firstResult = firstByPlayer.get(id), secondResult = secondByPlayer.get(id);
      check(!!firstResult.is_absent === !!secondResult.is_absent,
        `${firstHalfId}/${secondHalfId}: absence status differs for ${id}`);
      if (!firstResult.is_absent) check(Number.isFinite(Number(firstResult.score)) && Number.isFinite(Number(secondResult.score)),
        `${firstHalfId}/${secondHalfId}: invalid score for ${id}`);
    }

    const firstCells = db.matchups.filter(row => row.match_id === firstHalfId).map(cloneRow);
    const secondCells = db.matchups.filter(row => row.match_id === secondHalfId).map(cloneRow);
    check((firstCells.length === 0) === (secondCells.length === 0),
      `${firstHalfId}/${secondHalfId}: only one half has matchup evidence`);
    check(firstCells.length > 0 || matrixEvidence === "unrecorded",
      `${firstHalfId}/${secondHalfId}: required matchup evidence is missing`);
    const firstDirections = firstCells.length ? directionalMap(firstCells, firstHalfId, firstActive, firstByPlayer) : null;
    const secondDirections = secondCells.length ? directionalMap(secondCells, secondHalfId, firstActive, secondByPlayer) : null;

    const combinedResults = firstRoster.map(id => {
      const firstResult = firstByPlayer.get(id), secondResult = secondByPlayer.get(id);
      const isAbsent = !!firstResult.is_absent;
      return {...firstResult, player_id:id, score:isAbsent ? null : Number(firstResult.score) + Number(secondResult.score),
        is_absent:isAbsent, is_mvp:false};
    });
    const played = combinedResults.filter(row => !row.is_absent && row.score != null);
    check(played.reduce((sum, row) => sum + Number(row.score), 0) === 0,
      `${firstHalfId}/${secondHalfId}: combined scores do not total zero`);
    const highest = Math.max(...played.map(row => Number(row.score)));
    const winners = played.filter(row => Number(row.score) === highest);
    check(winners.length === 1, `${firstHalfId}/${secondHalfId}: combined MVP is tied`);
    winners[0].is_mvp = true;

    const combinedMatchups = [];
    if (firstDirections) {
      for (const from of firstActive) for (const to of firstActive) {
        if (from === to) continue;
        combinedMatchups.push({from_player_id:from, to_player_id:to,
          points:firstDirections.get(`${from}|${to}`) + secondDirections.get(`${from}|${to}`)});
      }
      for (const from of firstActive) {
        const outgoing = combinedMatchups.filter(row => row.from_player_id === from)
          .reduce((sum, row) => sum + row.points, 0);
        check(outgoing === Number(combinedResults.find(row => row.player_id === from).score),
          `${firstHalfId}/${secondHalfId}: combined outgoing total mismatch for ${from}`);
      }
    }
    return {valid:true, first, second, results:combinedResults, matchups:combinedMatchups,
      segments:[
        {segment_key:"first_half",segment_label:"上半场",segment_order:1,sourceMatchId:firstHalfId,
          sourceVenue:first.venue,sourceRound:first.round,results:firstRows,matchups:firstCells},
        {segment_key:"second_half",segment_label:"下半场",segment_order:2,sourceMatchId:secondHalfId,
          sourceVenue:second.venue,sourceRound:second.round,results:secondRows,matchups:secondCells}
      ],matrixRecorded:!!firstDirections,mvpPlayerId:winners[0].player_id};
  } catch (error) {
    return {valid:false, reason:error.message};
  }
}

export function assignOfficialMatchIds(groups) {
  const sourceToOfficialMatchId = {};
  const matches = [], results = [], matchups = [], segments = [];
  groups.forEach((group, index) => {
    const officialId = `MSL${String(index + 1).padStart(4, "0")}`;
    const sourceMatchIds = group.sources.map(row => row.id);
    sourceMatchIds.forEach(id => {sourceToOfficialMatchId[id] = officialId;});
    matches.push({...group.primary, id:officialId, sourceMatchIds,
      primarySourceMatchId:group.primary.id, sourceOrdinalStart:sourceOrdinal(group.primary.id),
      sourceRounds:group.sources.map(row => row.round), isSplitSession:group.sources.length > 1});
    for (const row of group.results) results.push({...row, match_id:officialId,
      id:group.sources.length > 1 ? `${officialId}:runtime:${row.player_id}` : row.id});
    for (const row of group.matchups) matchups.push({...row, match_id:officialId,
      id:group.sources.length > 1 ? `${officialId}:runtime:${row.from_player_id}:${row.to_player_id}` : row.id});
    for (const segment of group.segments || []) segments.push({...segment, match_id:officialId});
  });
  return {matches, results, matchups, segments, sourceToOfficialMatchId};
}

export function assignOfficialRounds(matches) {
  const roundsBySeason = new Map();
  return matches.map(match => {
    const round = (roundsBySeason.get(match.season_id) || 0) + 1;
    roundsBySeason.set(match.season_id, round);
    return {...match, round};
  });
}

function normalizationChecks(matches, results, matchups, issues) {
  const ids = matches.map(match => match.id);
  const idErrors = ids.filter((id, index) => id !== `MSL${String(index + 1).padStart(4, "0")}`);
  const roundErrors = [];
  const roundsBySeason = new Map();
  for (const match of matches) {
    const expected = (roundsBySeason.get(match.season_id) || 0) + 1;
    if (match.round !== expected) roundErrors.push(`${match.id}: ${match.round}/${expected}`);
    roundsBySeason.set(match.season_id, expected);
  }
  const known = new Set(ids);
  const refs = [...results, ...matchups].filter(row => !known.has(row.match_id)).map(row => row.match_id);
  const make = (id, item, details) => ({id,item,found:details.length,target:"0",result:details.length?"FAIL":"PASS",
    evidence:"Official Match Normalization",details:details.slice(0,8)});
  return [
    make("ON001","正式比赛编号连续",idErrors),
    make("ON002","正式比赛编号唯一",ids.filter((id,index) => ids.indexOf(id) !== index)),
    make("ON003","正式赛季轮次连续",roundErrors),
    make("ON004","正式成绩与对位外键有效",refs),
    make("ON005","上下半场合并校验",issues)
  ];
}

export function normalizeOfficialMatchArchive(db) {
  const rawMatches = Array.isArray(db.matches) ? db.matches : [];
  const sourceResults = Array.isArray(db.results) ? db.results : [];
  const sourceMatchups = Array.isArray(db.matchups) ? db.matchups : [];
  const sourceDb = {...db, results:sourceResults, matchups:sourceMatchups};
  const ordered = [...rawMatches].sort((a,b) => sourceOrdinal(a.id) - sourceOrdinal(b.id));
  const issues = [];
  const ids = ordered.map(row => row.id);
  for (const id of ids) if (!Number.isSafeInteger(sourceOrdinal(id))) issues.push(`invalid source ID: ${id}`);
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) issues.push(`duplicate source ID: ${id}`);
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index].match_date < ordered[index-1].match_date)
      issues.push(`source dates out of order: ${ordered[index-1].id} → ${ordered[index].id}`);
  }
  const sourceById = new Map(ordered.map(row => [row.id,row]));
  const sourceIds = new Set(ids);
  for (const row of [...sourceResults,...sourceMatchups]) {
    if (!sourceIds.has(row.match_id)) issues.push(`orphan source evidence: ${row.match_id}`);
  }
  const splitByFirst = new Map(), consumedSecond = new Set();
  for (const config of OFFICIAL_SPLIT_SESSIONS) {
    // A future deployment may legitimately predate a configured pair.
    if (!sourceById.has(config.firstHalfId) && !sourceById.has(config.secondHalfId)) continue;
    const validated = validateSplitSession(config, sourceDb, sourceById);
    if (!validated.valid) {issues.push(validated.reason); continue;}
    splitByFirst.set(config.firstHalfId, validated);
    consumedSecond.add(config.secondHalfId);
  }
  const groups = [];
  for (const source of ordered) {
    if (consumedSecond.has(source.id)) continue;
    const split = splitByFirst.get(source.id);
    groups.push(split
      ? {primary:split.first,sources:[split.first,split.second],results:split.results,
          matchups:split.matchups,segments:split.segments}
      : {primary:source,sources:[source],results:sourceResults.filter(row => row.match_id === source.id),
          matchups:sourceMatchups.filter(row => row.match_id === source.id),segments:[]});
  }
  const assigned = assignOfficialMatchIds(groups);
  assigned.matches = assignOfficialRounds(assigned.matches);
  const maxSourceOrdinal = Math.max(0,...ordered.map(row => sourceOrdinal(row.id)).filter(Number.isFinite));
  const nextSourceRoundBySeason = {};
  for (const row of ordered) nextSourceRoundBySeason[row.season_id] =
    Math.max(nextSourceRoundBySeason[row.season_id] || 0, Number(row.round) || 0);
  for (const season of Object.keys(nextSourceRoundBySeason)) nextSourceRoundBySeason[season]++;
  const rawSourceContext = {maxSourceOrdinal,
    nextSourceMatchId:`MSL${String(maxSourceOrdinal + 1).padStart(4, "0")}`,
    nextSourceRoundBySeason};
  const checks = normalizationChecks(assigned.matches,assigned.results,assigned.matchups,issues);
  return {db:{...db,matches:assigned.matches,results:assigned.results,matchups:assigned.matchups},
    segments:assigned.segments,sourceToOfficialMatchId:assigned.sourceToOfficialMatchId,
    rawSourceContext,issues,checks};
}

