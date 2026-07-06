/*
 * Lean tosu WebSocket client. Auto-reconnects. No deps.
 * Host derives from the page origin so it works both under real tosu (:24050)
 * and the local mock server (any port).
 */
export default class TosuSocket {
	constructor(host = location.host || "127.0.0.1:24050") {
		this.host = host;
		this._commands = null;
	}

	_connect(path, onMessage) {
		const path_param = encodeURIComponent(window.COUNTER_PATH ?? "");
		const ws = new WebSocket(`ws://${this.host}${path}?l=${path_param}`);

		ws.onmessage = (event) => {
			let data;
			try {
				data = JSON.parse(event.data);
			} catch {
				return;
			}
			if (data?.error != null) return console.error(`[${path}]`, data.error);
			onMessage(data, ws);
		};
		ws.onclose = () => setTimeout(() => this._connect(path, onMessage), 1000);
		ws.onerror = () => ws.close();
		return ws;
	}

	/** live game data (tosu v2 schema) */
	v2(callback) {
		this._connect("/websocket/v2", callback);
		return this;
	}

	/** legacy v1 data (/ws) — hit counts are correct here on lazer where v2 lies */
	v1(callback) {
		this._connect("/ws", callback);
		return this;
	}

	/** overlay settings channel (two-way) */
	commands(callback) {
		this._commands = this._connect("/websocket/commands", callback);
		return this;
	}

	/** send a command on the commands channel, retrying until it's open */
	send(name, payload) {
		const body = typeof payload === "object" ? JSON.stringify(payload) : payload;
		const ws = this._commands;
		if (ws && ws.readyState === WebSocket.OPEN) ws.send(`${name}:${body}`);
		else setTimeout(() => this.send(name, payload), 150);
	}

	/** build a URL to a tosu-served static file (e.g. beatmap background) */
	fileURL(relative) {
		return `http://${this.host}/files/beatmap/${relative}`;
	}
}
