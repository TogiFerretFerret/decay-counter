/*
 * Dependency-free strain/difficulty graph on a <canvas>.
 * Combines tosu's performance.graph difficulty channels into one curve,
 * lightly smooths + normalizes it, and fills it. The portion up to the song's
 * current progress is drawn bright (with a stroke); the rest stays dim — so the
 * graph doubles as the progress bar.
 */
const CHANNELS = new Set([
	"aim", "aimNoSliders", "speed", "flashlight", "strains",
	"movement", "color", "rhythm", "stamina",
]);

export function makeGraph(canvas) {
	const ctx = canvas.getContext("2d");
	let cssW = 0, cssH = 0;
	let points = null; // normalized Float32Array in [0,1]
	let color = "#7cc4ff";
	let color2 = "#c4a6ff";
	let prog = 0;

	function resize() {
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		cssW = rect.width || 500;
		cssH = rect.height || 34;
		canvas.width = Math.round(cssW * dpr);
		canvas.height = Math.round(cssH * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();

	function setColor(hex, hex2) {
		if (hex) color = hex.trim();
		if (hex2) color2 = hex2.trim();
		render();
	}

	// horizontal blue -> purple gradient at a given alpha
	function grad(alpha) {
		const g = ctx.createLinearGradient(0, 0, cssW, 0);
		g.addColorStop(0, rgba(color, alpha));
		g.addColorStop(1, rgba(color2, alpha));
		return g;
	}

	function setData(series, len) {
		const n = len || (series?.[0]?.data.length ?? 0);
		if (!n) {
			points = null;
			return render();
		}
		const data = new Float64Array(n);
		for (const s of series) {
			if (!CHANNELS.has(s.name)) continue;
			for (let i = 0; i < n && i < s.data.length; i++) data[i] += s.data[i];
		}
		const sm = smooth(data, Math.max(1, Math.round(n / 55)));
		let max = 0;
		for (const v of sm) if (v > max) max = v;
		max = max || 1;
		points = Float32Array.from(sm, (v) => Math.max(0, v) / max);
		render();
	}

	function setProgress(p) {
		prog = Math.max(0, Math.min(1, p));
		render();
	}

	function areaPath() {
		const n = points.length;
		const p = new Path2D();
		p.moveTo(0, cssH);
		for (let i = 0; i < n; i++) p.lineTo(px(i, n), py(points[i]));
		p.lineTo(cssW, cssH);
		p.closePath();
		return p;
	}
	function linePath() {
		const n = points.length;
		const p = new Path2D();
		p.moveTo(px(0, n), py(points[0]));
		for (let i = 1; i < n; i++) p.lineTo(px(i, n), py(points[i]));
		return p;
	}
	const px = (i, n) => (i / (n - 1)) * cssW;
	const py = (v) => cssH - v * (cssH - 3) - 1.5;

	function render() {
		ctx.clearRect(0, 0, cssW, cssH);
		if (!points || !points.length) return;
		const area = areaPath();

		// dim full curve
		ctx.fillStyle = grad(0.15);
		ctx.fill(area);

		// bright played portion, clipped to progress
		const clipX = prog * cssW;
		if (clipX > 0.5) {
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, clipX, cssH);
			ctx.clip();
			ctx.fillStyle = grad(0.42);
			ctx.fill(area);
			ctx.strokeStyle = grad(0.95);
			ctx.lineWidth = 1.5;
			ctx.lineJoin = "round";
			ctx.stroke(linePath());
			ctx.restore();

			// leading edge line
			ctx.strokeStyle = rgba(color2, 0.9);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(clipX, 0);
			ctx.lineTo(clipX, cssH);
			ctx.stroke();
		}
	}

	return { setData, setProgress, setColor, resize, render };
}

function smooth(data, radius) {
	if (radius <= 1) return data;
	const n = data.length;
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const lo = Math.max(0, i - radius);
		const hi = Math.min(n - 1, i + radius);
		let sum = 0;
		for (let j = lo; j <= hi; j++) sum += data[j];
		out[i] = sum / (hi - lo + 1);
	}
	return out;
}

function rgba(hex, alpha) {
	if (hex.startsWith("rgb")) return hex;
	let h = hex.replace("#", "");
	if (h.length === 3) h = h.split("").map((c) => c + c).join("");
	const n = parseInt(h, 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
