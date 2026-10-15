export const PEAK_MATCH_RULES = Object.freeze([{season:"S1",round:5,format:"split_long"}]);

export function matchFormatKey(match) {
  if (match?.isSplitSession) return "split_long";
  return PEAK_MATCH_RULES.find(rule => rule.season === match?.season && rule.round === Number(match?.round))?.format || "regular";
}
export function isPeakMatch(match) { return matchFormatKey(match) === "split_long"; }
export function matchFormatLabel(match) { return isPeakMatch(match) ? "巅峰赛" : "常规局"; }
export function filterMatchesByFormat(matches=[],format="all") {
  return format==="all" ? matches : matches.filter(match=>matchFormatKey(match)===format);
}
