import TosuSocket from "./socket.js";
import { makeGraph } from "./graph.js";
import { hitJudgementsAdd, hitJudgementsClear } from "./hit-judgements.js";
// Odometer + CountUp are loaded as classic scripts before this module (window globals),
// exactly as BTMC's counter does — so pp/bpm roll and hit counts tick identically.

const $ = (id) => document.getElementById(id);
const app = $("app");

/* ---------- element refs ---------- */
const el = {
	bg: $("bg"),
	title: $("title"),
	titleWrap: $("title-wrap"),
	artist: $("artist"),
	diff: $("diff"),
	mapper: $("mapper"),
	mods: $("mods"),
	srBadge: $("sr-badge"),
	rank: $("rank"),
	h100: $("h100"),
	h50: $("h50"),
	h0: $("h0"),
	hj: $("hit-judgements"),
	urWrap: $("ur-wrap"),
	avatar: $("avatar"),
	avatarInitial: $("avatar-initial"),
	pname: $("pname"),
	prank: $("prank"),
	ppp: $("ppp"),
	session: $("session"),
	sessGain: $("sess-gain"),
	sessPlays: $("sess-plays"),
	tagline: $("tagline"),
};

let sessionBasePP = null; // pp total at session start; session gain = current - base

/* strain graph */
const graph = makeGraph($("graph"));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const refreshGraphColors = () => graph.setColor(cssVar("--accent"), cssVar("--accent-2"));
refreshGraphColors();

/* ---------- numbers: processed exactly like BTMC (Odometer roll + CountUp) ---------- */
const mockScene = new URLSearchParams(location.search).get("mockScene");
const SNAP = !!mockScene; // instant updates for deterministic dev screenshots
const ODO_DUR = SNAP ? 1 : undefined; // undefined => Odometer default (2000ms), exactly like BTMC
const CU_DUR = SNAP ? 0.001 : 0.5; // seconds; BTMC uses 0.5 for hit counts

// pp values + bpm roll on odometers (BTMC drives ppCurrent / ppFC / bpm the same way)
new Odometer({ el: $("pp"), value: 0, duration: ODO_DUR });
new Odometer({ el: $("ppmax"), value: 0, duration: ODO_DUR });
new Odometer({ el: $("ppfc"), value: 0, duration: ODO_DUR });
new Odometer({ el: $("bpm"), value: 0, duration: ODO_DUR });

const cuOpts = { useEasing: true, useGrouping: true, separator: " ", decimal: "." };
const cu = {
	h100: new CountUp("h100", 0, 0, 0, CU_DUR, cuOpts),
	h50: new CountUp("h50", 0, 0, 0, CU_DUR, cuOpts),
	h0: new CountUp("h0", 0, 0, 0, CU_DUR, cuOpts),
	combo: new CountUp("combo", 0, 0, 0, CU_DUR, cuOpts),
};

const num = {
	pp: $("pp"), ppmax: $("ppmax"), ppfc: $("ppfc"), bpm: $("bpm"),
	sr: $("sr"), acc: $("acc"), ur: $("ur"),
	ar: $("ar"), cs: $("cs"), od: $("od"), hp: $("hp"),
};
const round2 = (v) => Math.round(v * 100) / 100;
// odometers animate by observing innerHTML changes — BTMC's exact mechanism
const setOdo = (elm, key, v) => {
	const r = Math.round(v);
	if (changed(key, r)) elm.innerHTML = String(r);
};

/* ---------- user settings (defaults mirror settings.json) ---------- */
const settings = {
	ShowBackground: true,
	ShowUR: true,
	UseSSPP: false,
	DimOnPause: true,
};

/* ---------- change cache ---------- */
const cache = {};
const changed = (key, val) => {
	if (cache[key] === val) return false;
	cache[key] = val;
	return true;
};

const socket = new TosuSocket();

/* ================= settings channel ================= */
export function applySettings(m) {
	if (!m || typeof m !== "object") return;

	if (m.AccentColor) {
		setVar("--accent", m.AccentColor);
		refreshGraphColors();
	}
	if (m.AccentColor2) {
		setVar("--accent-2", m.AccentColor2);
		refreshGraphColors();
	}
	if (m.GoodColor) setVar("--good", m.GoodColor);
	if (m.OkColor) setVar("--ok", m.OkColor);
	if (m.BadColor) setVar("--bad", m.BadColor);

	if (m.ShowBackground != null) settings.ShowBackground = truthy(m.ShowBackground);
	if (m.ShowUR != null) {
		settings.ShowUR = truthy(m.ShowUR);
		el.urWrap.style.display = settings.ShowUR ? "" : "none";
	}
	if (m.UseSSPP != null) settings.UseSSPP = truthy(m.UseSSPP);
	if (m.DimOnPause != null) settings.DimOnPause = truthy(m.DimOnPause);

	if (m.Tagline != null) {
		el.tagline.textContent = m.Tagline;
		el.tagline.style.display = m.Tagline ? "" : "none";
	}
	if (m.ShowIdentity != null)
		document.querySelector(".identity").style.display = truthy(m.ShowIdentity) ? "" : "none";
	if (m.ShowSession != null) el.session.style.display = truthy(m.ShowSession) ? "flex" : "none";
}

const setVar = (k, v) => document.documentElement.style.setProperty(k, v);
const truthy = (v) => v === true || v === "true" || v === 1;

/* ================= live game data ================= */
export function applyFrame({ state, game, beatmap, play, performance, resultsScreen, directPath, folders, profile, session }) {
	const mode =
		state.name === "play" ? "play" : state.name === "resultScreen" ? "result" : "menu";

	/* -------- state class + pause -------- */
	if (changed("mode", mode)) {
		app.classList.remove("state-menu", "state-play", "state-result");
		app.classList.add(`state-${mode}`);
	}
	const paused = settings.DimOnPause && (game?.paused || game?.focused === false) && mode === "play";
	if (changed("paused", paused)) app.classList.toggle("paused", paused);

	/* -------- player identity + session -------- */
	if (profile) {
		if (changed("pname", profile.name)) el.pname.textContent = profile.name || "—";
		if (changed("prank", profile.globalRank))
			el.prank.textContent = profile.globalRank ? "#" + profile.globalRank.toLocaleString() : "#—";
		if (changed("ptotal", Math.round(profile.pp)))
			el.ppp.textContent = Math.round(profile.pp).toLocaleString() + "pp";

		if (changed("pid", profile.id) && profile.id) {
			el.avatarInitial.textContent = (profile.name || "?").charAt(0).toUpperCase();
			el.avatar.classList.remove("loaded");
			const url = `https://a.ppy.sh/${profile.id}`;
			const im = new Image();
			im.onload = () => {
				el.avatar.style.backgroundImage = `url("${url}")`;
				el.avatar.classList.add("loaded");
			};
			im.onerror = () => {
				el.avatar.style.backgroundImage = "";
				el.avatar.classList.remove("loaded"); // fall back to gradient + initial
			};
			im.src = url;
		}

		if (sessionBasePP == null && profile.pp > 0) sessionBasePP = profile.pp;
		const gain = Math.max(0, Math.round(profile.pp - (sessionBasePP ?? profile.pp)));
		if (changed("sgain", gain)) el.sessGain.innerHTML = `+${gain.toLocaleString()}<i>pp</i>`;
	}
	if (session && changed("splays", session.playCount))
		el.sessPlays.innerHTML = `${session.playCount}<i>plays</i>`;

	/* -------- map identity -------- */
	const mapKey = beatmap.checksum || beatmap.id;
	const newMap = changed("mapKey", mapKey);
	if (newMap) {
		el.hj.textContent = ""; // clear instantly — animated clear would race same-frame adds
		cache.hjCleared = true;
		cache.sbCount = 0;
	}

	if (changed("title", beatmap.title)) {
		el.title.textContent = beatmap.title;
		requestAnimationFrame(() => fitMarquee());
	}
	if (changed("artist", beatmap.artist)) el.artist.textContent = beatmap.artist;
	if (changed("diffmap", `${beatmap.version}|${beatmap.mapper}`)) {
		el.diff.textContent = `[${beatmap.version}]`;
		el.mapper.textContent = `Mapped by ${beatmap.mapper}`;
	}

	/* -------- map stats -------- */
	const st = beatmap.stats;
	if (changed("sr", round2(st.stars.total))) num.sr.textContent = st.stars.total.toFixed(2);
	if (changed("srColor", Math.round(st.stars.total * 100))) {
		const c = diffColour(st.stars.total);
		el.srBadge.style.background = c;
		el.srBadge.style.color = luminance(c) > 0.6 ? "#14151c" : "#fff";
	}
	setOdo(num.bpm, "bpm", st.bpm.realtime);
	statWithMods(num.ar, "ar", st.ar);
	statWithMods(num.cs, "cs", st.cs);
	statWithMods(num.od, "od", st.od);
	statWithMods(num.hp, "hp", st.hp);

	/* -------- mods -------- */
	if (changed("mods", play.mods?.name || "")) {
		renderMods(cache.mods);
	}

	/* -------- background -------- */
	if (settings.ShowBackground && directPath?.beatmapBackground && newMap) {
		const rel = directPath.beatmapBackground.replace(folders?.songs ?? "", "");
		const url = socket.fileURL(rel.replace(/^[\\/]/, ""));
		el.bg.classList.remove("show");
		const img = new Image();
		img.onload = () => {
			el.bg.style.backgroundImage = `url("${url}")`;
			el.bg.classList.add("show");
		};
		img.src = url;
	} else if (!settings.ShowBackground) {
		el.bg.classList.remove("show");
	}

	/* -------- kiai pulse -------- */
	if (changed("kiai", beatmap.isKiai) && beatmap.isKiai && mode === "play") {
		app.classList.remove("kiai");
		void app.offsetWidth; // restart animation
		app.classList.add("kiai");
	}

	/* -------- performance / judgements -------- */
	const hits = mode === "result" ? resultsScreen.hits : play.hits;
	const ssPP = performance.accuracy["100"];

	// curr / max-now / if-fc  (see gameplay.ts semantics)
	let big, ppMax, ppFc, acc, combo, rank, ur;
	if (mode === "menu") {
		big = ssPP; // what the map is worth (SS)
		ppMax = ssPP;
		ppFc = settings.UseSSPP ? ssPP : play.pp.fc;
		acc = 100;
		combo = 0;
		rank = "SS";
		ur = 0;
	} else if (mode === "result") {
		big = resultsScreen.pp.current;
		ppMax = resultsScreen.pp.current; // maxAchievable not provided on result
		ppFc = settings.UseSSPP ? ssPP : resultsScreen.pp.fc;
		acc = resultsScreen.accuracy;
		combo = resultsScreen.maxCombo;
		rank = resultsScreen.rank;
		ur = play.unstableRate;
	} else {
		big = play.pp.current;
		ppMax = play.pp.maxAchievable;
		ppFc = settings.UseSSPP ? ssPP : play.pp.fc;
		acc = play.accuracy;
		combo = play.combo.current;
		rank = play.rank.current;
		ur = play.unstableRate;
	}

	setOdo(num.pp, "pp", big);
	setOdo(num.ppmax, "ppmax", ppMax);
	setOdo(num.ppfc, "ppfc", ppFc);
	if (changed("acc", Math.round(acc * 100))) num.acc.textContent = acc.toFixed(2);
	if (changed("combo", Math.round(combo))) cu.combo.update(Math.round(combo));

	// hit counts + graph judgement markers (BTMC-style)
	const livePct = Math.max(0, Math.min(100, (beatmap.time.live / (beatmap.time.mp3Length || 1)) * 100));
	const sbCount = hits.sliderBreaks ?? 0;
	const isSliderBreak = (cache.sbCount ?? 0) !== sbCount;

	if (changed("h100", hits["100"])) {
		cu.h100.update(hits["100"]);
		if (mode === "play" && hits["100"] > 0) {
			cache.sbCount = sbCount;
			hitJudgementsAdd(el.hj, "100", livePct, isSliderBreak);
		}
	}
	if (changed("h50", hits["50"])) {
		cu.h50.update(hits["50"]);
		if (mode === "play" && hits["50"] > 0) {
			cache.sbCount = sbCount;
			hitJudgementsAdd(el.hj, "50", livePct, isSliderBreak);
		}
	}
	if (changed("h0", hits["0"])) {
		cu.h0.update(hits["0"]);
		if (mode === "play" && hits["0"] > 0) {
			cache.sbCount = sbCount;
			hitJudgementsAdd(el.hj, "x", livePct, isSliderBreak);
		}
	}

	// clear markers on a fresh attempt (all counts back to 0 while playing)
	if (mode === "play" && hits["100"] === 0 && hits["50"] === 0 && hits["0"] === 0) {
		if (!cache.hjCleared) {
			hitJudgementsClear(el.hj);
			cache.hjCleared = true;
			cache.sbCount = 0;
		}
	} else if (hits["100"] || hits["50"] || hits["0"]) {
		cache.hjCleared = false;
	}

	if (changed("ur", Math.round(ur))) num.ur.textContent = String(Math.round(ur));

	if (changed("rank", rank)) {
		const norm = normRank(rank);
		el.rank.textContent = norm;
		el.rank.dataset.rank = norm;
	}

	/* -------- strain graph + progress -------- */
	if (newMap || changed("graphLen", performance.graph?.xaxis?.length ?? 0)) {
		graph.setData(performance.graph.series, performance.graph.xaxis.length);
	}
	const len = beatmap.time.mp3Length || 1;
	const frac = mode === "result" ? 1 : mode === "menu" ? 0 : beatmap.time.live / len;
	if (changed("frac", Math.round(frac * 500))) graph.setProgress(frac);
}

/* ================= wiring ================= */
if (mockScene) {
	// dev screenshot mode: render a static fixture, no live sockets
	import("../dev/fixtures.js")
		.then(({ fixtures }) => {
			if (mockScene === "playseq") {
				// step through increasing progress so graph markers spread out
				fixtures.playSeq.forEach((f, i) => setTimeout(() => applyFrame(f), i * 350));
				return;
			}
			const f = fixtures[mockScene];
			if (f?.profile) sessionBasePP = f.profile.pp - 142; // demo a session gain (if enabled)
			applyFrame(f);
		})
		.catch((e) => console.error("fixtures load failed", e));
} else {
	socket.commands((data) => applySettings(data?.message));
	socket.send("getSettings", encodeURI(window.COUNTER_PATH ?? ""));
	socket.v2(applyFrame);
}

/* ================= helpers ================= */
function statWithMods(node, key, stat) {
	if (!changed(key, `${round2(stat.converted)}|${stat.original}`)) return;
	node.textContent = round2(stat.converted);
	const diff = stat.converted - stat.original;
	node.style.color = diff > 0 ? "var(--bad)" : diff < 0 ? "var(--good)" : "";
}

function renderMods(name) {
	el.mods.innerHTML = "";
	if (!name || name === "NM") return;
	for (let i = 0; i < name.length; i += 2) {
		const span = document.createElement("span");
		span.className = "mod";
		span.textContent = name.slice(i, i + 2);
		el.mods.appendChild(span);
	}
}

function fitMarquee() {
	const overflow = el.title.scrollWidth > el.titleWrap.clientWidth + 2;
	el.titleWrap.classList.toggle("scroll", overflow);
}

function normRank(r) {
	if (!r) return "—";
	const u = r.toUpperCase();
	if (u === "X" || u === "XH" || u === "SS" || u === "SSH") return "SS";
	if (u === "SH") return "S";
	return u;
}

/* osu!-web difficulty spectrum (linear sRGB interpolation, no d3) */
const SPECTRUM = [
	[0.1, "#4290fb"], [1.25, "#4fc0ff"], [2, "#4fffd5"], [2.5, "#7cff4f"],
	[3.3, "#f6f05c"], [4.2, "#ff8068"], [4.9, "#ff4e6f"], [5.8, "#c645b8"],
	[6.7, "#6563de"], [7.7, "#18158e"], [9, "#000000"],
];
function diffColour(sr) {
	if (sr < 0.1) return "#aaaaaa";
	if (sr >= 9) return "#000000";
	for (let i = 1; i < SPECTRUM.length; i++) {
		const [x1, c1] = SPECTRUM[i - 1];
		const [x2, c2] = SPECTRUM[i];
		if (sr <= x2) {
			const p = (sr - x1) / (x2 - x1);
			return mix(c1, c2, p);
		}
	}
	return "#000000";
}
function hexRgb(h) {
	const n = parseInt(h.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, p) {
	const [r1, g1, b1] = hexRgb(a);
	const [r2, g2, b2] = hexRgb(b);
	const r = Math.round(r1 + (r2 - r1) * p);
	const g = Math.round(g1 + (g2 - g1) * p);
	const bl = Math.round(b1 + (b2 - b1) * p);
	return `rgb(${r}, ${g}, ${bl})`;
}
function luminance(color) {
	const m = color.match(/\d+/g).map(Number);
	return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
}
