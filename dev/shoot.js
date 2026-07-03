#!/usr/bin/env node
/*
 * shoot.js — screenshot a URL via an already-running headless Chromium
 * (launched with --remote-debugging-port=9222). Waits real time for the
 * counter's websocket data to land before capturing. Zero deps (Node 22
 * global fetch + WebSocket).
 *
 *   node dev/shoot.js <url> <out.png> [waitMs]
 */
const fs = require("fs");
const [, , url, out, waitStr] = process.argv;
const wait = Number(waitStr || 2500);
const BASE = "http://127.0.0.1:9222";

async function newTab(target) {
	// modern chromium wants PUT; older allows GET
	for (const method of ["PUT", "GET"]) {
		try {
			const r = await fetch(`${BASE}/json/new?${encodeURIComponent(target)}`, { method });
			if (r.ok) return r.json();
		} catch {}
	}
	throw new Error("could not open tab");
}

(async () => {
	const tab = await newTab(url);
	const ws = new WebSocket(tab.webSocketDebuggerUrl);
	let id = 0;
	let shotId = -1;
	const send = (method, params = {}) => {
		id++;
		ws.send(JSON.stringify({ id, method, params }));
		return id;
	};

	ws.onopen = () => {
		send("Emulation.setDeviceMetricsOverride", {
			width: 500, height: 150, deviceScaleFactor: 2, mobile: false,
		});
		send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
		send("Page.enable");
		send("Page.navigate", { url });
		setTimeout(() => {
			shotId = send("Page.captureScreenshot", { format: "png" });
		}, wait);
	};

	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (m.id === shotId && m.result) {
			fs.writeFileSync(out, Buffer.from(m.result.data, "base64"));
			console.log("saved", out);
			fetch(`${BASE}/json/close/${tab.id}`).finally(() => process.exit(0));
		}
	};
	ws.onerror = (err) => {
		console.error("ws error", err.message || err);
		process.exit(1);
	};
})();
