export type CareerStat = {
  player_id: string; player_name: string; games: number; total_score: number;
  average_score: number; positive_rate: number; mvp_count: number; mvp_rate: number;
  best_score: number; worst_score: number; absences: number;
  four_average: number | null; five_average: number | null;
}
export type MatchResult = { player_id: string; player_name: string; score: number | null; is_mvp: boolean; is_absent: boolean }
export type MatchItem = { id: string; season_id: string; round: number; match_date: string; match_type: string; venue: string | null; notes: string | null; results?: MatchResult[] }
