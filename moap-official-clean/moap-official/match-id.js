// Canonical IDs are applied at the public-read boundary, before any joins.
export function canonicalMatchId(value) {
  const suffix = String(value ?? "").match(/(\d+)$/u);
  if (!suffix) throw new Error("Match source ID has no numeric suffix");
  const ordinal = Number(suffix[1]);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw new Error("Invalid match source ordinal");
  return `MOAP${String(ordinal).padStart(4, "0")}`;
}

const REFERENCE_KEYS = new Set(["match_id", "matchId", "source_match_id", "sourceMatchId", "firstHalfId", "secondHalfId", "primarySourceMatchId"]);
function canonicalizeReferences(value) {
  if (Array.isArray(value)) return value.map(canonicalizeReferences);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, REFERENCE_KEYS.has(key) && item != null ? canonicalMatchId(item) : canonicalizeReferences(item)
  ]));
}

export function canonicalizeMatchIds(db) {
  const canonical = canonicalizeReferences(db);
  canonical.matches = (canonical.matches || []).map(match => ({...match, id:canonicalMatchId(match.id)}));
  const ids = canonical.matches.map(match => match.id);
  if (new Set(ids).size !== ids.length) throw new Error("Canonical match IDs collide");
  return canonical;
}
