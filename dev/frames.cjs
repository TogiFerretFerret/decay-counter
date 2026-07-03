/*
 * Shared simulated-frame generator (CommonJS). Used by both the live mock
 * server (mock-tosu.js) and the fixture generator (gen-fixtures.cjs).
 * Produces tosu v2-shaped objects for a given scene + progress.
 */
const MAP = {
	artist: "Camellia",
	title: "Ghost feat. Nanahira",
	version: "Haunting",
	mapper: "Sotarks",
	checksum: "mockmd5",
	id: 1337,
	set: 420,
	mp3Length: 214000,
	maxCombo: 1487,
	total: 1512,
	stars: 6.83,
	bpm: 174,
	ar: 9.5,
	cs: 4.0,
	od: 9.0,
	hp: 5.0,
};

/* deterministic strain-ish curves so the graph has something to draw */
const GRAPH_N = 200;
const STRAIN_X = Array.from({ length: GRAPH_N }, (_, i) => i);
const STRAIN_AIM = Array.from({ length: GRAPH_N }, (_, i) => {
	const t = i / GRAPH_N;
	const kiai = t > 0.55 && t < 0.72 ? 2.6 : 0;
	return Math.max(0, 2.2 + 1.4 * Math.sin(t * Math.PI * 6) + 1.1 * Math.sin(t * Math.PI * 13 + 1) + kiai + t * 1.1);
});
const STRAIN_SPEED = Array.from({ length: GRAPH_N }, (_, i) => {
	const t = i / GRAPH_N;
	const burst = t > 0.3 && t < 0.45 ? 1.8 : 0;
	return Math.max(0, 1.8 + 1.0 * Math.sin(t * Math.PI * 9 + 2) + burst);
});

function accuracy(n3, n1, n5, n0) {
	const total = n3 + n1 + n5 + n0;
	if (!total) return 100;
	return ((300 * n3 + 100 * n1 + 50 * n5) / (300 * total)) * 100;
}
function rankFor(acc, misses) {
	if (acc === 100) return "X";
	if (acc >= 99 && misses === 0) return "SH";
	if (acc >= 93.17) return "S";
	if (acc >= 90) return "A";
	if (acc >= 80) return "B";
	if (acc >= 70) return "C";
	return "D";
}

function frame(scene, prog) {
	const inPlay = scene === "play";
	const inResult = scene === "result";
	const p = inPlay ? prog : inResult ? 1 : 0;

	const objectsHit = Math.round(p * MAP.total);
	const h100 = Math.round(p * 13);
	const h50 = Math.round(p * 2);
	const h0 = Math.round(p * 3);
	const h300 = Math.max(0, objectsHit - h100 - h50 - h0);
	const acc = accuracy(h300, h100, h50, h0);
	const rank = rankFor(acc, h0);
	const comboMax = Math.round(MAP.maxCombo * (inResult ? 0.71 : Math.min(1, p * 1.1)));
	const comboCur = inPlay ? Math.round(comboMax * 0.55) : comboMax;
	const ppCur = Math.round(p * 486);
	const stateName = scene === "menu" ? "menu" : scene === "result" ? "resultScreen" : "play";

	const hits = {
		"0": h0, "50": h50, "100": h100, "300": h300,
		geki: 0, katu: 0, sliderBreaks: Math.round(p * 4),
		sliderEndHits: 0, smallTickHits: 0, largeTickHits: 0,
	};

	return {
		game: { focused: true, paused: false },
		client: "stable",
		server: "mock",
		state: { number: 0, name: stateName },
		session: { playTime: 5_400_000, playCount: 27 },
		profile: {
			userStatus: { number: 0, name: "idle" },
			banchoStatus: { number: 0, name: "" },
			id: 15262479,
			name: "IsThatDecay",
			mode: { number: 0, name: "osu" },
			rankedScore: 18_400_000_000,
			level: 101,
			accuracy: 98.72,
			pp: 8423,
			playCount: 45210,
			globalRank: 12345,
			countryCode: { number: 0, name: "US" },
			backgroundColour: "",
			matchmaking: null,
		},
		beatmap: {
			isKiai: inPlay && p > 0.3 && p < 0.5,
			isBreak: false,
			isConvert: false,
			time: {
				live: Math.round(p * MAP.mp3Length),
				firstObject: 1200,
				lastObject: MAP.mp3Length - 3000,
				mp3Length: MAP.mp3Length,
			},
			status: { number: 1, name: "ranked" },
			checksum: MAP.checksum,
			id: MAP.id,
			set: MAP.set,
			mode: { number: 0, name: "osu" },
			artist: MAP.artist,
			artistUnicode: MAP.artist,
			title: MAP.title,
			titleUnicode: MAP.title,
			mapper: MAP.mapper,
			version: MAP.version,
			source: "",
			tags: "",
			stats: {
				stars: { live: MAP.stars, total: MAP.stars },
				ar: { original: 9.0, converted: MAP.ar },
				cs: { original: MAP.cs, converted: MAP.cs },
				od: { original: 8.0, converted: MAP.od },
				hp: { original: MAP.hp, converted: MAP.hp },
				bpm: { realtime: MAP.bpm, common: MAP.bpm, min: MAP.bpm, max: MAP.bpm },
				objects: { circles: 900, sliders: 600, spinners: 12, holds: 0, total: MAP.total },
				maxCombo: MAP.maxCombo,
			},
		},
		play: {
			failed: false,
			playerName: "IsThatDecay",
			mode: { number: 0, name: "osu" },
			score: Math.round(p * 8_400_000),
			accuracy: acc,
			healthBar: { normal: 200, smooth: 200 },
			hits,
			hitErrorArray: [],
			combo: { current: comboCur, max: comboMax },
			mods: { checksum: "", number: 72, name: "HDDT", array: [], rate: 1.5 },
			rank: { current: rank, maxThisPlay: rank },
			pp: {
				current: ppCur,
				fc: 512,
				maxAchieved: ppCur,
				maxAchievable: Math.round(ppCur + (512 - ppCur) * 0.72),
				detailed: {
					current: { aim: ppCur * 0.55, speed: ppCur * 0.3, accuracy: ppCur * 0.15, difficulty: 0, flashlight: 0, total: ppCur },
					fc: { aim: 280, speed: 150, accuracy: 82, difficulty: 0, flashlight: 0, total: 512 },
				},
			},
			unstableRate: 132.4,
		},
		leaderboard: [],
		performance: {
			accuracy: { "90": 210, "91": 240, "92": 270, "93": 300, "94": 340, "95": 385, "96": 430, "97": 490, "98": 545, "99": 595, "100": 648 },
			graph: {
				series: [
					{ name: "aim", data: STRAIN_AIM },
					{ name: "speed", data: STRAIN_SPEED },
				],
				xaxis: STRAIN_X,
			},
		},
		resultsScreen: {
			scoreId: 1,
			playerName: "IsThatDecay",
			mode: { number: 0, name: "osu" },
			score: Math.round(p * 8_400_000),
			accuracy: acc,
			name: "",
			hits: { ...hits },
			mods: { checksum: "", number: 72, name: "HDDT", array: [], rate: 1.5 },
			maxCombo: comboMax,
			rank,
			pp: { current: ppCur, fc: 512 },
			createdAt: "2026-07-03T00:00:00Z",
		},
		folders: { game: "C:/osu", skin: "", songs: "C:/Songs/", beatmap: "C:/Songs/decay" },
		files: { beatmap: "map.osu", background: "bg.svg", audio: "audio.mp3" },
		directPath: {
			beatmapFile: "C:/Songs/decay/map.osu",
			beatmapBackground: "C:/Songs/decay/bg.svg",
			beatmapAudio: "C:/Songs/decay/audio.mp3",
			beatmapFolder: "C:/Songs/decay",
			skinFolder: "",
		},
		tourney: undefined,
	};
}

module.exports = { frame, MAP };
