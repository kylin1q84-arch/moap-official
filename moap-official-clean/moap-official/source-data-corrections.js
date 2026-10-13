// Source-only corrections run after the public Supabase read and before the
// official-match normalization layer. They never write back to Supabase.
const MATCH_CORRECTIONS = Object.freeze({
  MSL0076: Object.freeze({
    matchDate: "2026-10-12",
    originalSeason: "S4",
    originalRound: 1,
    seasonId: "S3",
    round: 28
  })
});

export function correctSourceData(db) {
  return {
    ...db,
    matches: db.matches.map(match => {
      const correction = MATCH_CORRECTIONS[match.id];
      if (!correction || match.match_date !== correction.matchDate) return match;
      if (match.season_id === correction.seasonId && Number(match.round) === correction.round) return match;
      if (match.season_id !== correction.originalSeason || Number(match.round) !== correction.originalRound) return match;
      return {...match, season_id: correction.seasonId, round: correction.round};
    })
  };
}
