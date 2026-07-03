#!/usr/bin/env node
/*
 * mock-tosu — a zero-dependency fake tosu server for developing counters
 * without osu! running. Serves the counter's static files and emits simulated
 * v2 game data (menu -> play -> result on a loop) plus a settings channel.
 *
 *   node dev/mock-tosu.js                # animated loop on :24050
 *   PORT=8787 node dev/mock-tosu.js      # different port
 *   SCENE=play PROG=0.6 node dev/mock-tosu.js   # freeze a scene (for screenshots)
 *
 * SCENE ∈ menu | play | result.  PROG ∈ 0..1 (song progress, play scene only).
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { frame } = require("./frames.cjs");

const PORT = Number(process.env.PORT) || 24050;
const ROOT = path.resolve(__dirname, "..");
const SCENE = process.env.SCENE || null; // null => animated loop
const PROG = process.env.PROG != null ? Number(process.env.PROG) : 0.6;

/* ---------- settings defaults (from settings.json) ---------- */
const settingsDefaults = (() => {
	try {
		const arr = JSON.parse(fs.readFileSync(path.join(ROOT, "settings.json"), "utf8"));
		return Object.fromEntries(arr.map((s) => [s.uniqueID, s.value]));
	} catch {
		return {};
	}
})();

/* ================= simulated game data ================= */
/* frame(scene, prog) lives in frames.cjs (shared with the fixture generator) */

/* current scene for the animated loop */
const TL = [
	["menu", 3000],
	["play", 16000],
	["result", 4000],
];
const CYCLE = TL.reduce((a, [, d]) => a + d, 0);
function liveFrame() {
	let t = Date.now() % CYCLE;
	for (const [scene, dur] of TL) {
		if (t < dur) {
			const prog = scene === "play" ? t / dur : scene === "result" ? 1 : 0;
			return frame(scene, prog);
		}
		t -= dur;
	}
	return frame("menu", 0);
}
const nextFrame = () => (SCENE ? frame(SCENE, PROG) : liveFrame());

/* ================= websocket plumbing (hand-rolled) ================= */
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function encodeFrame(str) {
	const payload = Buffer.from(str);
	const len = payload.length;
	let header;
	if (len < 126) header = Buffer.from([0x81, len]);
	else if (len < 65536) {
		header = Buffer.alloc(4);
		header[0] = 0x81;
		header[1] = 126;
		header.writeUInt16BE(len, 2);
	} else {
		header = Buffer.alloc(10);
		header[0] = 0x81;
		header[1] = 127;
		header.writeBigUInt64BE(BigInt(len), 2);
	}
	return Buffer.concat([header, payload]);
}

/* pull complete frames out of a buffer; returns [messages, restBuffer] */
function decodeFrames(buf) {
	const msgs = [];
	let off = 0;
	while (off + 2 <= buf.length) {
		const b1 = buf[off];
		const b2 = buf[off + 1];
		const opcode = b1 & 0x0f;
		const masked = (b2 & 0x80) !== 0;
		let len = b2 & 0x7f;
		let p = off + 2;
		if (len === 126) {
			if (p + 2 > buf.length) break;
			len = buf.readUInt16BE(p);
			p += 2;
		} else if (len === 127) {
			if (p + 8 > buf.length) break;
			len = Number(buf.readBigUInt64BE(p));
			p += 8;
		}
		let mask;
		if (masked) {
			if (p + 4 > buf.length) break;
			mask = buf.slice(p, p + 4);
			p += 4;
		}
		if (p + len > buf.length) break;
		let data = buf.slice(p, p + len);
		if (masked) data = Buffer.from(data.map((byte, i) => byte ^ mask[i % 4]));
		off = p + len;
		msgs.push({ opcode, text: data.toString() });
	}
	return [msgs, buf.slice(off)];
}

/* ================= http + upgrade ================= */
const MIME = {
	".html": "text/html", ".js": "text/javascript", ".css": "text/css",
	".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
	const url = req.url.split("?")[0];

	if (url.startsWith("/files/beatmap/")) {
		res.writeHead(200, { "Content-Type": "image/svg+xml", "Access-Control-Allow-Origin": "*" });
		res.end(BG_SVG);
		return;
	}

	let file = url === "/" ? "/index.html" : url;
	const full = path.join(ROOT, path.normalize(file));
	if (!full.startsWith(ROOT)) return res.writeHead(403).end();

	fs.readFile(full, (err, data) => {
		if (err) return res.writeHead(404).end("not found");
		res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "text/plain" });
		res.end(data);
	});
});

server.on("upgrade", (req, socket) => {
	const key = req.headers["sec-websocket-key"];
	const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
	socket.write(
		"HTTP/1.1 101 Switching Protocols\r\n" +
			"Upgrade: websocket\r\n" +
			"Connection: Upgrade\r\n" +
			`Sec-WebSocket-Accept: ${accept}\r\n\r\n`
	);

	const url = req.url.split("?")[0];
	const send = (obj) => {
		if (!socket.writableEnded) socket.write(encodeFrame(JSON.stringify(obj)));
	};

	if (url === "/websocket/v2") {
		send(nextFrame());
		const iv = setInterval(() => send(nextFrame()), 60);
		socket.on("close", () => clearInterval(iv));
		socket.on("error", () => clearInterval(iv));
	} else if (url === "/websocket/commands") {
		let buf = Buffer.alloc(0);
		socket.on("data", (chunk) => {
			buf = Buffer.concat([buf, chunk]);
			let msgs;
			[msgs, buf] = decodeFrames(buf);
			for (const m of msgs) {
				if (m.opcode === 0x8) return socket.end();
				if (m.text.startsWith("getSettings")) {
					send({ command: "getSettings", message: settingsDefaults });
				}
			}
		});
		socket.on("error", () => {});
	} else {
		socket.end();
	}
});

const BG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3a2f6b"/><stop offset="0.5" stop-color="#7a3b6e"/>
    <stop offset="1" stop-color="#2b4a7a"/></linearGradient></defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <circle cx="200" cy="140" r="180" fill="#ffffff" opacity="0.06"/>
  <circle cx="640" cy="330" r="220" fill="#ffffff" opacity="0.05"/>
</svg>`;

server.listen(PORT, () => {
	console.log(`mock-tosu on http://127.0.0.1:${PORT}  (scene=${SCENE || "loop"})`);
});
