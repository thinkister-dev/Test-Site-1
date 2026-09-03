"use strict";

document.addEventListener("DOMContentLoaded", () => {
	const demoButton = document.querySelector("#demo-button");
	const resetButton = document.querySelector("#reset-button");
	const themeButton = document.querySelector("#theme-button");
	const previewCard = document.querySelector("#preview-card");
	const statusText = document.querySelector("#status-text");
	const statusTime = document.querySelector("#status-time");
	const eventCount = document.querySelector("#event-count");
	const stateEvents = document.querySelector("#state-events");
	const stateClass = document.querySelector("#state-class");
	const stateTheme = document.querySelector("#state-theme");
	const stateDatabase = document.querySelector("#state-database");
	const signupForm = document.querySelector("#signup-form");
	const formStatus = document.querySelector("#form-status");
	const userCount = document.querySelector("#user-count");
	const savedUser = document.querySelector("#saved-user");
	const backendStatus = document.querySelector("#backend-status");
	const previewTitle = document.querySelector("#preview-title");
	const previewCopy = document.querySelector("#preview-copy");
	const localUsersKey = "web-stack-lab-users";
	let events = 0;
	const apiAvailable = window.location.protocol === "http:" || window.location.protocol === "https:";
	let firebaseDatabase = null;

	function setupFirebase() {
		const config = window.firebaseConfig || {};
		if (!window.firebase || !config.apiKey || !config.databaseURL) return;
		try {
			const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
			firebaseDatabase = app.database();
			backendStatus.innerHTML = "<i></i> FIREBASE READY";
			backendStatus.classList.add("connected");
		} catch (error) {
			firebaseDatabase = null;
		}
	}

	function readLocalUsers() {
		try {
			const users = JSON.parse(localStorage.getItem(localUsersKey) || "[]");
			return Array.isArray(users) ? users : [];
		} catch (error) {
			return [];
		}
	}

	function saveLocalUser(user) {
		const users = readLocalUsers().filter((savedUser) => savedUser.email !== user.email);
		users.push(user);
		localStorage.setItem(localUsersKey, JSON.stringify(users));
	}

	async function saveFirebaseUser(user) {
		if (!firebaseDatabase) return false;
		await firebaseDatabase.ref(`users/${user.id}`).set(user);
		return true;
	}

	async function sendEvent(type, message) {
		if (!apiAvailable) return;
		try {
			const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, message, occurredAt: new Date().toISOString() }) });
			if (!response.ok) throw new Error("Event request failed");
			backendStatus.innerHTML = "<i></i> API CONNECTED";
			backendStatus.classList.add("connected");
			loadDatabaseSummary();
		} catch (error) {
			backendStatus.innerHTML = "<i></i> API OFFLINE";
			backendStatus.classList.remove("connected");
		}
	}

	async function loadDatabaseSummary() {
		if (!apiAvailable) return;
		try {
			const response = await fetch("/api/events");
			if (!response.ok) throw new Error("Database request failed");
			const data = await response.json();
			stateDatabase.textContent = `${data.total} saved`;
		} catch (error) {
			stateDatabase.textContent = "unavailable";
		}
	}

	async function loadUsers() {
		const localUsers = readLocalUsers();
		if (localUsers.length) {
			userCount.textContent = `${localUsers.length} USERS`;
			renderSavedUser(localUsers.at(-1));
		}
		if (!apiAvailable) return;
		try {
			const response = await fetch("/api/users");
			if (!response.ok) throw new Error("Users request failed");
			const data = await response.json();
			userCount.textContent = `${data.total} USERS`;
			stateDatabase.textContent = `${data.total} users`;
			if (data.latest) renderSavedUser(data.latest);
		} catch (error) {
			userCount.textContent = "UNAVAILABLE";
		}
	}

	function renderSavedUser(user) {
		savedUser.innerHTML = `<span class="user-avatar">${user.name.charAt(0).toUpperCase()}</span><div><strong>${user.name}</strong><p>${user.email} · saved ${new Date(user.createdAt).toLocaleTimeString([], { hour12: false })}</p></div>`;
	}

	async function checkBackend() {
		if (!apiAvailable) return;
		try {
			const response = await fetch("/api/health");
			if (!response.ok) throw new Error("Health request failed");
			backendStatus.innerHTML = "<i></i> API CONNECTED";
			backendStatus.classList.add("connected");
		} catch (error) {
			backendStatus.innerHTML = "<i></i> API OFFLINE";
		}
	}

	function updateMonitor(message) {
		events += 1;
		const now = new Date();
		statusText.textContent = message;
		statusTime.textContent = now.toLocaleTimeString([], { hour12: false });
		eventCount.textContent = `EVENTS ${String(events).padStart(3, "0")}`;
		stateEvents.textContent = events;
	}

	demoButton.addEventListener("click", () => {
		const popped = previewCard.classList.toggle("popped");
		stateClass.textContent = popped ? "popped" : "default";
		previewTitle.textContent = popped ? "State changed." : "A thoughtful button";
		previewCopy.textContent = popped ? "JavaScript toggled a class. CSS received it and changed the visual output." : "This card is HTML. Its mood is CSS. Its update is JavaScript.";
		demoButton.innerHTML = popped ? "Restore output <span>↗</span>" : "Run interaction <span>↗</span>";
		const message = popped ? "click event → class added → UI updated" : "click event → class removed → UI restored";
		updateMonitor(message);
		sendEvent("component-toggle", message);
	});

	themeButton.addEventListener("click", () => {
		const night = document.body.classList.toggle("night");
		themeButton.setAttribute("aria-pressed", String(night));
		stateTheme.textContent = night ? "night" : "daylight";
		themeButton.firstChild.textContent = night ? "Return to daylight " : "Switch mood ";
		const message = night ? "theme toggle → body class changed" : "theme toggle → original theme restored";
		updateMonitor(message);
		sendEvent("theme-toggle", message);
	});

	resetButton.addEventListener("click", () => {
		previewCard.classList.remove("popped");
		stateClass.textContent = "default";
		previewTitle.textContent = "A thoughtful button";
		previewCopy.textContent = "This card is HTML. Its mood is CSS. Its update is JavaScript.";
		demoButton.innerHTML = "Run interaction <span>↗</span>";
		const message = "reset event → component returned to default";
		updateMonitor(message);
		sendEvent("playground-reset", message);
	});

	signupForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const formData = new FormData(signupForm);
		const user = { name: formData.get("name"), email: formData.get("email") };
		formStatus.textContent = "Sending user to the backend...";
		formStatus.className = "form-status pending";
		let savedUser;
		try {
			if (!apiAvailable) throw new Error("Local mode");
			const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user) });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Could not save user");
			savedUser = result.user;
		} catch (error) {
			if (error.message === "That email is already saved") throw error;
			savedUser = { id: `local_${Date.now()}`, ...user, createdAt: new Date().toISOString() };
		}
		try {
			saveLocalUser(savedUser);
			let firebaseSaved = false;
			try {
				firebaseSaved = await saveFirebaseUser(savedUser);
			} catch (firebaseError) {
				firebaseSaved = false;
			}
			formStatus.textContent = firebaseSaved ? `Saved ${savedUser.name} locally and to Firebase` : `Saved ${savedUser.name} locally`;
			formStatus.className = "form-status success";
			renderSavedUser(savedUser);
			signupForm.reset();
			loadUsers();
		} catch (error) {
			formStatus.textContent = error.message;
			formStatus.className = "form-status error";
		}
	});

	setupFirebase();
	checkBackend();
	loadDatabaseSummary();
	loadUsers();
});
