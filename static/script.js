/* ================================================================
   Event Management System — Frontend Logic
   ================================================================ */

const API = ""; // same origin

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.section;
    showSection(target);
  });
});

function showSection(name) {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.add("hidden"));
  document.getElementById(`section-${name}`).classList.remove("hidden");

  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector(`.nav-btn[data-section="${name}"]`)
    .classList.add("active");

  if (name === "dashboard") loadDashboard();
  if (name === "events") loadEvents();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function loadDashboard() {
  try {
    const [statsRes, eventsRes] = await Promise.all([
      fetch(`${API}/api/stats`),
      fetch(`${API}/api/events`),
    ]);
    const stats = await statsRes.json();
    const events = await eventsRes.json();

    document.getElementById("stat-total").textContent = stats.total_events;
    document.getElementById("stat-upcoming").textContent =
      stats.upcoming_events;
    document.getElementById("stat-participants").textContent =
      stats.total_participants;

    const recentGrid = document.getElementById("recent-events-grid");
    const recent = events.slice(0, 6);
    if (recent.length === 0) {
      recentGrid.innerHTML =
        '<p class="empty-state">No events yet. Create your first event!</p>';
    } else {
      recentGrid.innerHTML = recent.map((e) => eventCardHTML(e)).join("");
    }
  } catch (err) {
    showToast("Failed to load dashboard", "error");
  }
}

// ---------------------------------------------------------------------------
// Events List & Search
// ---------------------------------------------------------------------------

let searchTimeout = null;
document.getElementById("search-input").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadEvents(e.target.value), 300);
});

async function loadEvents(search = "") {
  try {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`${API}/api/events${q}`);
    const events = await res.json();
    const grid = document.getElementById("events-grid");

    if (events.length === 0) {
      grid.innerHTML = '<p class="empty-state">No events found.</p>';
    } else {
      grid.innerHTML = events.map((e) => eventCardHTML(e)).join("");
    }
  } catch (err) {
    showToast("Failed to load events", "error");
  }
}

// ---------------------------------------------------------------------------
// Event Card HTML Builder
// ---------------------------------------------------------------------------

function eventCardHTML(event) {
  const dateStr = formatDate(event.date);
  const timeStr = formatTime(event.time);
  const spotsLeft = event.max_participants - (event.participant_count || 0);

  return `
    <div class="event-card">
        <div class="event-card__header">
            <h3 class="event-card__title">${escapeHTML(event.name)}</h3>
            <span class="event-card__category">${escapeHTML(event.category)}</span>
        </div>
        <p class="event-card__desc">${escapeHTML(event.description || "No description provided.")}</p>
        <div class="event-card__meta">
            <span class="event-card__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${dateStr}
            </span>
            <span class="event-card__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${timeStr}
            </span>
            <span class="event-card__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ${escapeHTML(event.location)}
            </span>
            <span class="event-card__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ${event.participant_count || 0}/${event.max_participants} (${spotsLeft} left)
            </span>
        </div>
        <div class="event-card__footer">
            <button class="btn btn--success btn--sm" onclick="openRegister(${event.id}, '${escapeHTML(event.name).replace(/'/g, "\\'")}')">Register</button>
            <button class="btn btn--accent btn--sm" onclick="openParticipants(${event.id}, '${escapeHTML(event.name).replace(/'/g, "\\'")}')">Participants</button>
            <button class="btn btn--ghost btn--sm" onclick="editEvent(${event.id})">Edit</button>
            <button class="btn btn--danger btn--sm" onclick="deleteEvent(${event.id})">Delete</button>
        </div>
    </div>
    `;
}

// ---------------------------------------------------------------------------
// Create / Update Event
// ---------------------------------------------------------------------------

document.getElementById("event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("edit-event-id").value;

  const payload = {
    name: document.getElementById("event-name").value.trim(),
    description: document.getElementById("event-description").value.trim(),
    date: document.getElementById("event-date").value,
    time: document.getElementById("event-time").value,
    location: document.getElementById("event-location").value.trim(),
    category: document.getElementById("event-category").value,
    max_participants:
      parseInt(document.getElementById("event-max").value) || 100,
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`${API}/api/events/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${API}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Something went wrong", "error");
      return;
    }

    showToast(editId ? "Event updated!" : "Event created!", "success");
    resetForm();
    showSection("events");
  } catch (err) {
    showToast("Network error", "error");
  }
});

async function editEvent(id) {
  try {
    const res = await fetch(`${API}/api/events/${id}`);
    const event = await res.json();

    document.getElementById("edit-event-id").value = event.id;
    document.getElementById("event-name").value = event.name;
    document.getElementById("event-description").value =
      event.description || "";
    document.getElementById("event-date").value = event.date;
    document.getElementById("event-time").value = event.time;
    document.getElementById("event-location").value = event.location;
    document.getElementById("event-category").value = event.category;
    document.getElementById("event-max").value = event.max_participants;

    document.getElementById("form-title").textContent = "Edit Event";
    document.getElementById("btn-submit-event").innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Update Event`;
    document.getElementById("btn-cancel-edit").style.display = "inline-flex";

    showSection("create");
  } catch (err) {
    showToast("Failed to load event details", "error");
  }
}

async function deleteEvent(id) {
  if (
    !confirm(
      "Are you sure you want to delete this event? All registrations will also be removed.",
    )
  )
    return;

  try {
    const res = await fetch(`${API}/api/events/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Failed to delete", "error");
      return;
    }
    showToast("Event deleted", "info");
    loadEvents(document.getElementById("search-input").value);
    loadDashboard();
  } catch (err) {
    showToast("Network error", "error");
  }
}

function cancelEdit() {
  resetForm();
}

function resetForm() {
  document.getElementById("event-form").reset();
  document.getElementById("edit-event-id").value = "";
  document.getElementById("form-title").textContent = "Create New Event";
  document.getElementById("btn-submit-event").innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create Event`;
  document.getElementById("btn-cancel-edit").style.display = "none";
}

// ---------------------------------------------------------------------------
// Registration Modal
// ---------------------------------------------------------------------------

function openRegister(eventId, eventName) {
  document.getElementById("register-event-id").value = eventId;
  document.getElementById("register-event-name").textContent = eventName;
  document.getElementById("register-form").reset();
  document.getElementById("modal-register").classList.remove("hidden");
}

document
  .getElementById("register-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const eventId = document.getElementById("register-event-id").value;

    const payload = {
      name: document.getElementById("reg-name").value.trim(),
      email: document.getElementById("reg-email").value.trim(),
      phone: document.getElementById("reg-phone").value.trim(),
    };

    try {
      const res = await fetch(`${API}/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Registration failed", "error");
        return;
      }
      showToast("Registered successfully!", "success");
      closeModal("modal-register");
      loadEvents(document.getElementById("search-input").value);
      loadDashboard();
    } catch (err) {
      showToast("Network error", "error");
    }
  });

// ---------------------------------------------------------------------------
// Participants Modal
// ---------------------------------------------------------------------------

const avatarColors = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

async function openParticipants(eventId, eventName) {
  document.getElementById("participants-event-name").textContent = eventName;
  const list = document.getElementById("participants-list");
  list.innerHTML = '<p class="empty-state">Loading...</p>';
  document.getElementById("modal-participants").classList.remove("hidden");

  try {
    const res = await fetch(`${API}/api/events/${eventId}/participants`);
    const participants = await res.json();

    if (participants.length === 0) {
      list.innerHTML =
        '<p class="empty-state">No participants registered yet.</p>';
    } else {
      list.innerHTML = participants
        .map((p, i) => {
          const initials = p.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          const color = avatarColors[i % avatarColors.length];
          return `
                <div class="participant-row">
                    <div class="participant-avatar" style="background: ${color}">${initials}</div>
                    <div class="participant-info">
                        <strong>${escapeHTML(p.name)}</strong>
                        <span>${escapeHTML(p.email)}${p.phone ? " · " + escapeHTML(p.phone) : ""}</span>
                    </div>
                </div>`;
        })
        .join("");
    }
  } catch (err) {
    list.innerHTML = '<p class="empty-state">Failed to load participants.</p>';
  }
}

// ---------------------------------------------------------------------------
// Modal Helpers
// ---------------------------------------------------------------------------

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Close modals on overlay click
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

// ---------------------------------------------------------------------------
// Toast Notifications
// ---------------------------------------------------------------------------

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  try {
    const [h, m] = timeStr.split(":");
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timeStr;
  }
}

// ---------------------------------------------------------------------------
// Initial Load
// ---------------------------------------------------------------------------

loadDashboard();
