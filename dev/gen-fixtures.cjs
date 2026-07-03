#!/usr/bin/env node
/* Writes dev/fixtures.js (an ES module) with static frames for each scene,
 * so the harness can render synchronously with no network. */
const fs = require("fs");
const path = require("path");
const { frame } = require("./frames.cjs");

const fixtures = {
	menu: frame("menu", 0),
	play: frame("play", 0.62),
	result: frame("result", 1),
	// stepped play (increasing progress) so graph hit-judgement markers spread out
	playSeq: [0.1, 0.22, 0.34, 0.46, 0.58, 0.62].map((p) => frame("play", p)),
};

const out = path.join(__dirname, "fixtures.js");
fs.writeFileSync(out, "export const fixtures = " + JSON.stringify(fixtures, null, "\t") + ";\n");
console.log("wrote", out);
