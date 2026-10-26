// Source-only corrections run after the public Supabase read and before the
// official-match normalization layer. They never write back to Supabase.
const MATCH_CORRECTIONS = Object.freeze({
  MOAP0076: Object.freeze({
    matchDate: "2026-10-12",
    originalSeason: "S4",
    originalRound: 1,
    seasonId: "S3",
    round: 28
  })
});

// MOAP0077 is the raw source record. After two official split-session merges,
// it is displayed throughout MOAP as official match MOAP0075 (2026-10-23).
const VENUE_CORRECTIONS = Object.freeze({
  MOAP0077: Object.freeze({
    matchDate: "2026-10-23",
    venue: "胡小鸭共享棋牌室（华美空间店）"
  })
});

export function correctSourceData(db) {
  return {
    ...db,
    matches: db.matches.map(match => {
      const venueFix = VENUE_CORRECTIONS[match.id];
      const fixedMatch = venueFix && match.match_date === venueFix.matchDate
        ? {...match, venue:venueFix.venue}
        : match;
      const correction = MATCH_CORRECTIONS[match.id];
      if (!correction || match.match_date !== correction.matchDate) return fixedMatch;
      if (match.season_id === correction.seasonId && Number(match.round) === correction.round) return fixedMatch;
      if (match.season_id !== correction.originalSeason || Number(match.round) !== correction.originalRound) return fixedMatch;
      return {...fixedMatch, season_id:correction.seasonId, round:correction.round};
    })
  };
}
