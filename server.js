"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const root = __dirname;
const dataDirectory = path.join(root, "data");
const databaseFile = path.join(dataDirectory, "events.json");
const usersDatabaseFile = path.join(dataDirectory, "users.json");
const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

fs.mkdirSync(dataDirectory, { recursive: true });
if (!fs.existsSync(databaseFile)) fs.writeFileSync(databaseFile, "[]", "utf8");
if (!fs.existsSync(usersDatabaseFile)) fs.writeFileSync(usersDatabaseFile, "[]", "utf8");

function readEvents() {
	try {
		const savedEvents = JSON.parse(fs.readFileSync(databaseFile, "utf8"));
		return Array.isArray(savedEvents) ? savedEvents : [];
	} catch (error) {
		return [];
	}
}

function saveEvents(events) {
	fs.writeFileSync(databaseFile, JSON.stringify(events, null, 2), "utf8");
}

function readUsers() {
	try {
		const savedUsers = JSON.parse(fs.readFileSync(usersDatabaseFile, "utf8"));
		return Array.isArray(savedUsers) ? savedUsers : [];
	} catch (error) {
		return [];
	}
}

function saveUsers(users) {
	fs.writeFileSync(usersDatabaseFile, JSON.stringify(users, null, 2), "utf8");
}

function sendJson(response, statusCode, payload) {
	response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
	response.end(JSON.stringify(payload));
}

function serveFile(request, response) {
	const requestedPath = request.url === "/" ? "/index.html" : request.url;
	const filePath = path.resolve(root, `.${requestedPath}`);
	if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Not found");
		return;
	}
	const extension = path.extname(filePath);
	response.writeHead(200, { "Content-Type": contentTypes[extension] || "application/octet-stream" });
	fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
	if (request.method === "GET" && request.url === "/api/health") {
		sendJson(response, 200, { ok: true, service: "web-stack-lab", events: readEvents().length, users: readUsers().length, database: "json-file" });
		return;
	}
	if (request.method === "GET" && request.url === "/api/users") {
		const savedUsers = readUsers();
		sendJson(response, 200, { total: savedUsers.length, latest: savedUsers.at(-1) || null });
		return;
	}
	if (request.method === "POST" && request.url === "/api/users") {
		let body = "";
		request.on("data", (chunk) => { body += chunk; if (body.length > 10_000) request.destroy(); });
		request.on("end", () => {
			try {
				const user = JSON.parse(body);
				const name = typeof user.name === "string" ? user.name.trim() : "";
				const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
				if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please provide a valid name and email");
				const savedUsers = readUsers();
				if (savedUsers.some((savedUser) => savedUser.email === email)) { sendJson(response, 409, { ok: false, error: "That email is already saved" }); return; }
				const savedUser = { id: `user_${Date.now()}`, name, email, createdAt: new Date().toISOString() };
				savedUsers.push(savedUser);
				saveUsers(savedUsers);
				sendJson(response, 201, { ok: true, user: savedUser, totalUsers: savedUsers.length });
			} catch (error) {
				sendJson(response, 400, { ok: false, error: error.message || "Expected a valid user payload" });
			}
		});
		return;
	}
	if (request.method === "GET" && request.url === "/api/events") {
		const savedEvents = readEvents();
		sendJson(response, 200, { total: savedEvents.length, latest: savedEvents.slice(-5).reverse() });
		return;
	}
	if (request.method === "POST" && request.url === "/api/events") {
		let body = "";
		request.on("data", (chunk) => { body += chunk; if (body.length > 10_000) request.destroy(); });
		request.on("end", () => {
			try {
				const event = JSON.parse(body);
				if (typeof event.type !== "string" || typeof event.message !== "string") throw new Error("Invalid event");
				const savedEvents = readEvents();
				savedEvents.push({ type: event.type.slice(0, 40), message: event.message.slice(0, 200), occurredAt: event.occurredAt || new Date().toISOString() });
				saveEvents(savedEvents);
				sendJson(response, 201, { ok: true, totalEvents: savedEvents.length });
			} catch (error) {
				sendJson(response, 400, { ok: false, error: "Expected a valid event payload" });
			}
		});
		return;
	}
	if (request.method === "GET") serveFile(request, response);
	else sendJson(response, 405, { ok: false, error: "Method not allowed" });
});

server.listen(port, () => console.log(`Web Stack Lab running at http://localhost:${port}`));
