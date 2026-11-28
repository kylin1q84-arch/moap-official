const collator = new Intl.Collator("zh-CN", { numeric: true });
const PHASES = Object.freeze({
  total: "累计积分",
  average: "场均积分变化",
  mvps: "MVP 累计次数",
});

function compareMatchOrder(a, b) {
  return collator.compare(a.date, b.date)
    || collator.compare(a.season, b.season)
    || collator.compare(a.round, b.round)
    || collator.compare(a.matchId, b.matchId);
}

function beforeJoin(season, player) {
  const seasonNumber = /^S(\d+)$/i.exec(season)?.[1];
  const joined = /^S(\d+)$/i.exec(player.joinSeason)?.[1];
  return seasonNumber != null && joined != null && Number(seasonNumber) < Number(joined);
}

// Build a comparison-only index of the normalized archive. Source rows are read-only.
export function preparePlayerComparison({ players, matches, goat, seasons = [] }) {
  const roster = new Map(players.map(({ playerId, name, joinSeason }) =>
    [playerId, { playerId, name, joinSeason }]));
  const seasonIds = [...new Set([...seasons.map(season => season.id), ...matches.map(match => match.season)])]
    .filter(Boolean).sort(collator.compare);
  const indexedMatches = matches.slice().sort(compareMatchOrder).map(({ matchId, date, round, season, matchType, results }) => {
    const scores = new Map();
    for (const { playerId, score, isAbsent, isMvp } of results) {
      const player = roster.get(playerId);
      if (!player || isAbsent || !Number.isFinite(score) || beforeJoin(season, player) || scores.has(playerId)) continue;
      scores.set(playerId, { score, isMvp: isMvp === true });
    }
    return { matchId, date, round, season, matchType, scores };
  });
  const goatByPlayer = new Map(goat.map(({ playerId, goatIndex, rank }) => [playerId, { goatIndex, rank }]));
  return { roster, seasonIds, matches: indexedMatches, goatByPlayer };
}

function summarize(played) {
  let total = 0, mvps = 0, nonNegative = 0, streak = 0, longest = 0;
  let best = null, worst = null;
  for (const { score, isMvp } of played) {
    total += score;
    if (isMvp) mvps++;
    if (score >= 0) {
      nonNegative++;
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 0;
    }
    best = best === null ? score : Math.max(best, score);
    worst = worst === null ? score : Math.min(worst, score);
  }
  const games = played.length;
  return {
    total, mvps, best, worst, games, longest,
    average: games ? total / games : null,
    mvpRate: games ? mvps / games : null,
    nonNegativeRate: games ? nonNegative / games : null,
  };
}

function seasonPerformance(matches, playerId, player, season) {
  const played = matches.flatMap(match => {
    const result = match.scores.get(playerId);
    return result ? [{ ...result, matchType: match.matchType }] : [];
  });
  return {
    ...summarize(played),
    four: summarize(played.filter(row => row.matchType === "四人局")),
    five: summarize(played.filter(row => row.matchType === "五人局")),
    beforeJoin: beforeJoin(season, player),
  };
}

function careerTrajectory(matches, ids) {
  const a = { total: 0, games: 0, mvps: 0 };
  const b = { total: 0, games: 0, mvps: 0 };
  function point(running, result) {
    if (result) {
      running.total += result.score;
      running.games++;
      if (result.isMvp) running.mvps++;
    }
    return {
      total: running.games ? running.total : null,
      average: running.games ? running.total / running.games : null,
      mvps: running.games ? running.mvps : null,
      score: result?.score ?? null,
    };
  }
  return matches.flatMap(({ scores, matchId, date, round, season }) => {
    const aResult = scores.get(ids[0]);
    const bResult = scores.get(ids[1]);
    if (!aResult && !bResult) return [];
    return [{ matchId, date, round, season, a: point(a, aResult), b: point(b, bResult) }];
  });
}

export function comparePlayers(index, aId, bId, season = "all") {
  const a = index.roster.get(aId);
  const b = index.roster.get(bId);
  if (!a || !b || aId === bId) return null;

  const career = [a, b].map(({ playerId }) => ({
    ...summarize(index.matches.flatMap(match => match.scores.has(playerId) ? [match.scores.get(playerId)] : [])),
    ...index.goatByPlayer.get(playerId),
  }));
  const shared = { games: 0, aLeads: 0, bLeads: 0, ties: 0, aTotal: 0, bTotal: 0, aMvps: 0, bMvps: 0 };
  for (const match of index.matches) {
    const left = match.scores.get(aId);
    const right = match.scores.get(bId);
    if (!left || !right) continue;
    shared.games++;
    if (left.score > right.score) shared.aLeads++;
    else if (left.score < right.score) shared.bLeads++;
    else shared.ties++;
    shared.aTotal += left.score;
    shared.bTotal += right.score;
    if (left.isMvp) shared.aMvps++;
    if (right.isMvp) shared.bMvps++;
  }
  shared.difference = shared.aTotal - shared.bTotal;

  const selectedSeasons = season === "all" ? index.seasonIds : index.seasonIds.filter(id => id === season);
  const bySeason = selectedSeasons.map(id => {
    const matches = index.matches.filter(match => match.season === id);
    return { id, a: seasonPerformance(matches, aId, a, id), b: seasonPerformance(matches, bId, b, id) };
  });
  const scopedMatches = season === "all" ? index.matches : index.matches.filter(match => match.season === season);
  return { players: [a, b], career, shared, bySeason, trajectory: careerTrajectory(scopedMatches, [aId, bId]) };
}

const number = value => Number.isFinite(value) ? String(value) : "—";
const signed = value => Number.isFinite(value)
  ? `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}` : "—";
const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
const metricRows = [
  ["goatIndex", "GOAT 指数", number],
  ["rank", "历史排名", value => Number.isFinite(value) ? `#${value}` : "—", -1],
  ["total", "累计积分", signed],
  ["average", "场均积分", signed],
  ["games", "参赛场次", number],
  ["mvps", "MVP 次数", number],
  ["mvpRate", "MVP 获得率", pct],
  ["nonNegativeRate", "非负分率", pct],
  ["best", "最高单场积分", signed],
  ["worst", "最低单场积分", signed],
  ["longest", "最长连续非负分", number],
];

function metricComparison([a, b]) {
  return metricRows.map(([key, label, format, direction = 1]) => {
    const left = a[key], right = b[key];
    const comparable = Number.isFinite(left) && Number.isFinite(right)
      && (!["total", "mvps", "longest"].includes(key) || (a.games > 0 && b.games > 0));
    const lead = comparable ? Math.sign((left - right) * direction) : 0;
    const magnitude = Math.max(Math.abs(left), Math.abs(right));
    const gap = comparable ? (magnitude ? Math.abs(left / magnitude - right / magnitude) / 2 : 0) : null;
    return { label, left, right, format, lead, gap };
  });
}

const escape = value => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function renderStrength(rows) {
  return rows.map(({ label, left, right, format, lead, gap }) => {
    const bar = lead ? `<i aria-hidden="true" style="--pc-meter:${(30 + gap * 70).toFixed(2)}%"></i><span class="pc-sr-only">该项领先</span>` : "";
    return `<div class="pc-metric">
      <dt>${label}</dt>
      <dd class="pc-metric-a${lead > 0 ? " pc-lead" : ""}">${format(left)}${lead > 0 ? bar : ""}</dd>
      <dd class="pc-metric-b${lead < 0 ? " pc-lead" : ""}">${format(right)}${lead < 0 ? bar : ""}</dd>
    </div>`;
  }).join("");
}

function renderShared(data, a, b) {
  const items = [
    ["共同参赛", number(data.games)],
    [`${a} · 同场积分领先`, number(data.aLeads)],
    [`${b} · 同场积分领先`, number(data.bLeads)],
    ["同场积分相同", number(data.ties)],
    [`累计积分差 · ${a} − ${b}`, data.games ? signed(data.difference) : "—"],
    [`${a} · 同场 MVP`, number(data.aMvps)],
    [`${b} · 同场 MVP`, number(data.bMvps)],
  ];
  return items.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${value}</dd></div>`).join("");
}

function renderSeasonRows(seasons, names) {
  const fields = (stats, type) => {
    if (stats.beforeJoin || !stats.games) return `<td colspan="6">${stats.beforeJoin ? "尚未加入" : "无有效成绩"}</td>`;
    const formatType = row => row.games ? `${signed(row.total)} / ${signed(row.average)}（${row.games} 场）` : "—";
    return `<td>${signed(stats.total)}</td><td>${signed(stats.average)}</td><td>${stats.mvps}</td>
      <td>${pct(stats.nonNegativeRate)}</td><td>${formatType(stats.four)}</td><td>${formatType(stats.five)}</td>`;
  };
  return seasons.flatMap(({ id, a, b }) => [a, b].map((stats, i) => `<tr>
    ${i === 0 ? `<th scope="rowgroup" rowspan="2">${escape(id)}</th>` : ""}
    <th scope="row">${escape(names[i])}</th>${fields(stats)}
  </tr>`).join("")).map(rows => `<tbody>${rows}</tbody>`).join("")
    || '<tbody><tr><td colspan="8">暂无赛季数据</td></tr></tbody>';
}

function describeGaps(sorted, gap) {
  if (gap == null) return "暂无可比数据";
  return sorted.filter(row => row.gap === gap)
    .map(row => `${row.label}（${row.format(row.left)} / ${row.format(row.right)}）`).join("、");
}

function renderAnalysis(rows, model) {
  const a = model.players[0].name, b = model.players[1].name;
  const gaps = rows.filter(row => row.gap !== null).sort((x, y) => y.gap - x.gap);
  const advantages = direction => rows.filter(row => row.lead === direction).map(row => row.label).join("、") || "暂无领先指标";
  const strengths = [
    [`${a}优势指标`, advantages(1)],
    [`${b}优势指标`, advantages(-1)],
    ["相对差距最大", describeGaps(gaps, gaps[0]?.gap)],
    ["最接近", describeGaps(gaps, gaps.at(-1)?.gap)],
    ...model.career.map((career, i) => [`${model.players[i].name} · 生涯表现`,
      career.games ? `${career.games} 场 · 场均 ${signed(career.average)} · 非负分率 ${pct(career.nonNegativeRate)} · MVP 率 ${pct(career.mvpRate)} · 最长连续非负分 ${career.longest} 场` : "暂无有效参赛记录"]),
  ];
  return strengths.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("");
}

function renderTrajectory(root, rows, names, metric) {
  if (!rows.length) {
    root.innerHTML = '<p class="pc-muted">该赛季两位牌手暂无有效参赛记录。</p>';
    return;
  }
  const width = 900, height = 260, left = 8, right = 883, top = 15, bottom = 235;
  const values = rows.flatMap(row => [row.a[metric], row.b[metric]]).filter(Number.isFinite);
  const rawMin = Math.min(0, ...values), rawMax = Math.max(0, ...values);
  const tickSize = (rawMax - rawMin) / 4 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(tickSize));
  const step = Math.max(metric === "mvps" ? 1 : 0.01,
    ([1, 2, 5, 10].find(size => size * magnitude >= tickSize) ?? 10) * magnitude);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.max(min + step, Math.ceil(rawMax / step) * step);
  const x = i => rows.length === 1 ? (left + right) / 2 : left + (right - left) * i / (rows.length - 1);
  const y = value => bottom - (bottom - top) * (value - min) / (max - min);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  const grid = ticks.map(value => `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/>`).join("");
  const axis = ticks.map(value => `<span style="top:${(100 * y(value) / height).toFixed(2)}%">${Number(value.toFixed(2))}</span>`).join("");
  const line = key => rows.flatMap((row, i) =>
    row[key][metric] === null ? [] : [`${x(i)},${y(row[key][metric])}`]).join(" ");
  root.innerHTML = `<div class="pc-chart-frame"><div class="pc-chart-axis" aria-hidden="true">${axis}</div>
  <svg class="pc-plot" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${PHASES[metric]}：按实际牌局顺序">
    <g class="pc-grid">${grid}</g>
    <polyline class="pc-line pc-a" points="${line("a")}"/><polyline class="pc-line pc-b" points="${line("b")}"/>
    <line class="pc-crosshair" x1="0" x2="0" y1="${top}" y2="${bottom}"/>
    <circle class="pc-dot pc-a" r=".2"/><circle class="pc-dot pc-b" r=".2"/>
  </svg></div>
  <div class="pc-dates"><span>${escape(rows[0].date)}</span><span>${escape(rows.at(-1).date)}</span></div>
  <label class="pc-scrub">${rows.length > 1 ? `选择牌局<input type="range" min="0" max="${rows.length - 1}" step="1" value="${rows.length - 1}">` : ""}</label>
  <div class="pc-chart-readout"><strong></strong><div class="pc-a"></div><div class="pc-b"></div></div>`;
  const svg = root.querySelector("svg"), scrub = root.querySelector("input");
  const cursor = root.querySelector(".pc-crosshair");
  const readout = root.querySelector(".pc-chart-readout");
  let previous = -1;
  function update(i) {
    if (i === previous) return;
    previous = i;
    const row = rows[i], position = x(i);
    const match = `${row.matchId} · ${row.season} 第${row.round}局 · ${row.date}`;
    if (scrub) {
      scrub.value = i;
      scrub.setAttribute("aria-valuetext", match);
    }
    cursor.setAttribute("x1", position);
    cursor.setAttribute("x2", position);
    readout.querySelector("strong").textContent = match;
    for (const [n, key] of ["a", "b"].entries()) {
      const point = row[key], dot = svg.querySelector(`.pc-dot.pc-${key}`);
      dot.style.display = point[metric] === null ? "none" : "";
      if (point[metric] !== null) {
        dot.setAttribute("cx", position);
        dot.setAttribute("cy", y(point[metric]));
      }
      const value = metric === "mvps" ? number(point[metric]) : signed(point[metric]);
      readout.querySelector(`.pc-${key}`).textContent =
        `${names[n]} · ${value} · ${point.score === null ? "本局无有效成绩" : `本局 ${signed(point.score)}`}`;
    }
  }
  update(rows.length - 1);
  scrub?.addEventListener("input", () => update(Number(scrub.value)));
  function selectAt(event) {
    const rect = svg.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * width;
    const slot = Math.round((px - left) / (right - left) * (rows.length - 1));
    update(Math.max(0, Math.min(rows.length - 1, slot)));
  }
  svg.addEventListener("pointermove", event => { if (event.pointerType === "mouse") selectAt(event); });
  svg.addEventListener("click", selectAt);
}

let stylesheet;
function loadStyles() {
  stylesheet ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./player-compare.css?v=1", import.meta.url).href;
    link.onload = resolve;
    link.onerror = () => {
      link.remove();
      stylesheet = undefined;
      reject(new Error("Could not load player-compare.css"));
    };
    document.head.append(link);
  });
  return stylesheet;
}

export async function openPlayerCompare(data, { playerId, sourceLabel, canOpen, returnFocus }) {
  await loadStyles();
  if (!canOpen() || document.querySelector(".player-compare[open]")) return;
  const index = preparePlayerComparison(data);
  const ids = [...index.roster.keys()];
  let aId = index.roster.has(playerId) ? playerId : ids[0];
  let bId = ids.find(id => id !== aId);
  const dialog = document.createElement("dialog");
  dialog.className = "player-compare";
  dialog.setAttribute("aria-labelledby", "pc-title");
  dialog.innerHTML = `<div class="pc-top"><div><p>个人中心 / 牌手对比</p><h2 id="pc-title">双人 VS 实力对决</h2></div>
    <button type="button" class="pc-close" autofocus>关闭比较</button></div>
    <div class="pc-content">
    <p class="pc-source">${escape(sourceLabel)}</p>
    ${ids.length < 2 ? '<p>至少需要两位牌手才能比较。</p>' : `
    <div class="pc-pickers">
      <label class="pc-player pc-a"><span>牌手 A</span><select data-pc="a"></select></label>
      <label class="pc-player pc-b"><span>牌手 B</span><select data-pc="b"></select></label>
      <button type="button" class="pc-swap" aria-label="交换牌手 A 和 B">交换 A / B</button>
    </div>
    <section class="pc-section"><h3>综合实力对比</h3><p class="pc-muted">生涯正式牌局；金色条标出各项领先方。历史排名越靠前、最低单场积分越高，分别视为该项领先。</p>
      <div class="pc-compare-head"><strong class="pc-a" data-pc="name-a"></strong><strong class="pc-b" data-pc="name-b"></strong></div>
      <dl class="pc-strength"></dl>
    </section>
    <section class="pc-section"><div class="pc-section-head"><div><h3>生涯轨迹对比</h3><p class="pc-muted">按牌局时间排列。选择赛季后从该赛季首场有效成绩开始统计。</p></div>
      <div class="pc-filters"><label>对比赛季<select data-pc="season"><option value="all">全部赛季</option>${index.seasonIds.map(id => `<option>${escape(id)}</option>`).join("")}</select></label>
      <label>图表指标<select data-pc="metric">${Object.entries(PHASES).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label></div></div>
      <div class="pc-chart"></div>
    </section>
    <section class="pc-section"><h3>同场对决记录</h3><p class="pc-muted">统计全部赛季双方都有有效成绩的共同牌局。同场积分领先仅表示两人之间的积分比较。</p>
      <dl class="pc-shared"></dl>
    </section>
    <section class="pc-section"><h3>赛季表现对比</h3><p class="pc-muted"><span data-pc="season-label"></span> · 可在生涯轨迹区切换赛季。四人局和五人局按累计／场均积分展示。</p>
      <div class="pc-table-wrap" tabindex="0" role="region" aria-label="赛季表现对比表格"><table><thead><tr>
      ${["赛季", "牌手", "累计积分", "场均积分", "MVP", "非负分率", "四人局", "五人局"].map(label => `<th scope="col">${label}</th>`).join("")}</tr></thead></table></div>
    </section>
    <section class="pc-section"><h3>优势分析</h3><p class="pc-muted">按各项真实数据比较。相对差距为差值绝对值除以双方绝对值最大值的两倍；相同值的差距为零。</p>
      <dl class="pc-analysis"></dl>
    </section>`}
    </div>`;
  dialog.querySelector(".pc-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.stopPropagation();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }, { once: true });

  if (ids.length >= 2) {
    const get = name => dialog.querySelector(`[data-pc="${name}"]`);
    const a = get("a"), b = get("b"), metric = get("metric"), season = get("season");
    const table = dialog.querySelector("table");
    const options = ids.map(id => `<option value="${escape(id)}">${escape(index.roster.get(id).name)}</option>`).join("");
    a.innerHTML = b.innerHTML = options;
    function syncPickers() {
      for (const option of a.options) option.disabled = option.value === bId;
      for (const option of b.options) option.disabled = option.value === aId;
      a.value = aId;
      b.value = bId;
    }
    function renderScoped(model) {
      const names = model.players.map(player => player.name);
      renderTrajectory(dialog.querySelector(".pc-chart"), model.trajectory, names, metric.value);
      get("season-label").textContent = season.selectedOptions[0].textContent;
      for (const body of Array.from(table.tBodies)) body.remove();
      table.insertAdjacentHTML("beforeend", renderSeasonRows(model.bySeason, names));
    }
    function renderAll(model) {
      syncPickers();
      const [nameA, nameB] = model.players.map(player => player.name);
      get("name-a").textContent = nameA;
      get("name-b").textContent = nameB;
      const rows = metricComparison(model.career);
      dialog.querySelector(".pc-strength").innerHTML = renderStrength(rows);
      dialog.querySelector(".pc-shared").innerHTML = renderShared(model.shared, nameA, nameB);
      dialog.querySelector(".pc-analysis").innerHTML = renderAnalysis(rows, model);
      renderScoped(model);
    }
    let model = comparePlayers(index, aId, bId, season.value);
    function updatePair(nextA, nextB) {
      const updated = comparePlayers(index, nextA, nextB, season.value);
      if (!updated) return syncPickers();
      aId = nextA;
      bId = nextB;
      model = updated;
      renderAll(model);
    }
    a.addEventListener("change", () => updatePair(a.value, bId));
    b.addEventListener("change", () => updatePair(aId, b.value));
    dialog.querySelector(".pc-swap").addEventListener("click", () => updatePair(bId, aId));
    season.addEventListener("change", () => {
      model = comparePlayers(index, aId, bId, season.value);
      renderScoped(model);
    });
    metric.addEventListener("change", () => {
      renderTrajectory(dialog.querySelector(".pc-chart"), model.trajectory,
        model.players.map(player => player.name), metric.value);
    });
    renderAll(model);
  }

  document.body.append(dialog);
  try {
    dialog.showModal();
  } catch (error) {
    dialog.remove();
    throw error;
  }
}
