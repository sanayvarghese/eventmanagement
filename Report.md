# Event Management System — DBMS Mini Project Report

---

## 1. Project Overview

The **Event Management System** is a full-stack web application that allows users to create, manage, and register for events. It provides a clean dashboard with statistics, full CRUD operations on events, participant registration with validation, and a search feature. The project is built as a single-page application served by a Python backend with an SQLite database.

---

## 2. Technologies Used

| Layer        | Technology        | Purpose                                                    |
| ------------ | ----------------- | ---------------------------------------------------------- |
| **Frontend** | HTML5             | Page structure and semantic markup                         |
| **Frontend** | CSS3              | Styling, responsive layout, animations                     |
| **Frontend** | JavaScript (ES6+) | Dynamic DOM rendering, API calls, interactivity            |
| **Backend**  | Python 3          | Server-side logic and REST API                             |
| **Backend**  | Flask             | Lightweight web framework for routing and request handling |
| **Backend**  | Flask-CORS        | Cross-Origin Resource Sharing support                      |
| **Database** | SQLite3           | Lightweight relational database (file-based)               |

---

## 3. Features Implemented

1. **Create Event** — Add new events with name, description, date, time, location, category, and max participants
2. **Update Event** — Edit existing event details
3. **Delete Event** — Remove events along with all associated registrations (CASCADE)
4. **View Events** — Browse all events in a card-based grid layout
5. **Register for Event** — Participants can register with name, email, and phone (with duplicate and capacity checks)
6. **View Participants** — View all registered participants for an event
7. **Search Events** — Search events by name, location, description, or category

---

## 4. Database Schema

### ER Diagram (Textual)

```
+-------------------+          +---------------------+
|      events       |          |    participants      |
+-------------------+          +---------------------+
| id (PK)           |◄────────┐| id (PK)             |
| name              |         │| event_id (FK)       |
| description       |         │| name                |
| date              |         │| email               |
| time              |         │| phone               |
| location          |         │| registered_at       |
| category          |         └+---------------------+
| max_participants  |
| created_at        |
+-------------------+
```

**Relationship:** One event can have many participants (1:N). Deleting an event cascades to delete all its participants.

---

## 5. SQL Queries

### 5.1 Table Creation

```sql
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    max_participants INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

### 5.2 Insert Event

```sql
INSERT INTO events (name, description, date, time, location, category, max_participants)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

### 5.3 Select All Events with Participant Count

```sql
SELECT e.*,
       (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
FROM events e
ORDER BY e.date ASC, e.time ASC;
```

### 5.4 Search Events

```sql
SELECT e.*,
       (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
FROM events e
WHERE e.name LIKE ? OR e.description LIKE ? OR e.location LIKE ? OR e.category LIKE ?
ORDER BY e.date ASC, e.time ASC;
```

### 5.5 Update Event

```sql
UPDATE events
SET name = ?, description = ?, date = ?, time = ?, location = ?, category = ?, max_participants = ?
WHERE id = ?;
```

### 5.6 Delete Event

```sql
DELETE FROM events WHERE id = ?;
```

### 5.7 Register Participant

```sql
INSERT INTO participants (event_id, name, email, phone)
VALUES (?, ?, ?, ?);
```

### 5.8 Check Capacity Before Registration

```sql
SELECT COUNT(*) as cnt FROM participants WHERE event_id = ?;
```

### 5.9 Check Duplicate Registration

```sql
SELECT id FROM participants WHERE event_id = ? AND email = ?;
```

### 5.10 View Participants for an Event

```sql
SELECT * FROM participants WHERE event_id = ? ORDER BY registered_at DESC;
```

### 5.11 Dashboard Statistics

```sql
SELECT COUNT(*) as total FROM events;
SELECT COUNT(*) as upcoming FROM events WHERE date >= date('now');
SELECT COUNT(*) as total FROM participants;
```

---

## 6. Backend Code (Python — Flask)

### 6.1 `database.py` — Database Initialization

```python
import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'events.db')


def get_db():
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database with the schema."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            location TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            max_participants INTEGER DEFAULT 100,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
    ''')

    conn.commit()
    conn.close()
    print("Database initialized successfully.")


if __name__ == '__main__':
    init_db()
```

### 6.2 `app.py` — Flask REST API Server

```python
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db, init_db
import os

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)


# Serve frontend
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


# --- EVENT ENDPOINTS ---

@app.route('/api/events', methods=['POST'])
def create_event():
    """Create a new event."""
    data = request.get_json()
    required = ['name', 'date', 'time', 'location']
    for field in required:
        if field not in data or not data[field]:
            return jsonify({'error': f'"{field}" is required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO events (name, description, date, time, location, category, max_participants)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (
            data['name'],
            data.get('description', ''),
            data['date'],
            data['time'],
            data['location'],
            data.get('category', 'General'),
            data.get('max_participants', 100),
        ),
    )
    conn.commit()
    event_id = cursor.lastrowid
    conn.close()
    return jsonify({'message': 'Event created successfully', 'id': event_id}), 201


@app.route('/api/events', methods=['GET'])
def get_events():
    """List all events. Supports ?search= query parameter."""
    search = request.args.get('search', '').strip()
    conn = get_db()
    cursor = conn.cursor()

    if search:
        query = '''SELECT e.*,
                          (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
                   FROM events e
                   WHERE e.name LIKE ? OR e.description LIKE ? OR e.location LIKE ? OR e.category LIKE ?
                   ORDER BY e.date ASC, e.time ASC'''
        like = f'%{search}%'
        cursor.execute(query, (like, like, like, like))
    else:
        query = '''SELECT e.*,
                          (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
                   FROM events e
                   ORDER BY e.date ASC, e.time ASC'''
        cursor.execute(query)

    events = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(events)


@app.route('/api/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    """Get a single event by ID."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        '''SELECT e.*,
                  (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
           FROM events e WHERE e.id = ?''',
        (event_id,),
    )
    event = cursor.fetchone()
    conn.close()
    if event is None:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify(dict(event))


@app.route('/api/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    """Update an existing event."""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT id FROM events WHERE id = ?', (event_id,))
    if cursor.fetchone() is None:
        conn.close()
        return jsonify({'error': 'Event not found'}), 404

    cursor.execute(
        '''UPDATE events
           SET name = ?, description = ?, date = ?, time = ?, location = ?, category = ?, max_participants = ?
           WHERE id = ?''',
        (
            data.get('name', ''),
            data.get('description', ''),
            data.get('date', ''),
            data.get('time', ''),
            data.get('location', ''),
            data.get('category', 'General'),
            data.get('max_participants', 100),
            event_id,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Event updated successfully'})


@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    """Delete an event and all associated participants."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM events WHERE id = ?', (event_id,))
    if cursor.fetchone() is None:
        conn.close()
        return jsonify({'error': 'Event not found'}), 404

    cursor.execute('DELETE FROM events WHERE id = ?', (event_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Event deleted successfully'})


# --- PARTICIPANT / REGISTRATION ENDPOINTS ---

@app.route('/api/events/<int:event_id>/register', methods=['POST'])
def register_participant(event_id):
    """Register a participant for an event."""
    data = request.get_json()
    required = ['name', 'email']
    for field in required:
        if field not in data or not data[field]:
            return jsonify({'error': f'"{field}" is required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Check event exists
    cursor.execute('SELECT id, max_participants FROM events WHERE id = ?', (event_id,))
    event = cursor.fetchone()
    if event is None:
        conn.close()
        return jsonify({'error': 'Event not found'}), 404

    # Check capacity
    cursor.execute('SELECT COUNT(*) as cnt FROM participants WHERE event_id = ?', (event_id,))
    count = cursor.fetchone()['cnt']
    if count >= event['max_participants']:
        conn.close()
        return jsonify({'error': 'Event is at full capacity'}), 400

    # Check duplicate email
    cursor.execute('SELECT id FROM participants WHERE event_id = ? AND email = ?', (event_id, data['email']))
    if cursor.fetchone() is not None:
        conn.close()
        return jsonify({'error': 'This email is already registered for this event'}), 400

    cursor.execute(
        '''INSERT INTO participants (event_id, name, email, phone)
           VALUES (?, ?, ?, ?)''',
        (event_id, data['name'], data['email'], data.get('phone', '')),
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Registered successfully'}), 201


@app.route('/api/events/<int:event_id>/participants', methods=['GET'])
def get_participants(event_id):
    """Get all participants for an event."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT id FROM events WHERE id = ?', (event_id,))
    if cursor.fetchone() is None:
        conn.close()
        return jsonify({'error': 'Event not found'}), 404

    cursor.execute('SELECT * FROM participants WHERE event_id = ? ORDER BY registered_at DESC', (event_id,))
    participants = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(participants)


# --- STATS ENDPOINT ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Return dashboard statistics."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as total FROM events')
    total_events = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as upcoming FROM events WHERE date >= date('now')")
    upcoming_events = cursor.fetchone()['upcoming']

    cursor.execute('SELECT COUNT(*) as total FROM participants')
    total_participants = cursor.fetchone()['total']

    conn.close()
    return jsonify({
        'total_events': total_events,
        'upcoming_events': upcoming_events,
        'total_participants': total_participants,
    })


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
```

---

## 7. Frontend Code

### 7.1 `index.html` — Main Page Structure

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Event Management System" />
    <title>Event Management System</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <!-- HEADER -->
    <header class="header">
      <div class="header__inner">
        <div class="header__brand">
          <div class="header__logo"><!-- Calendar SVG Icon --></div>
          <h1>Event Manager</h1>
        </div>
        <nav class="header__nav">
          <button class="nav-btn active" data-section="dashboard">
            Dashboard
          </button>
          <button class="nav-btn" data-section="create">Create Event</button>
          <button class="nav-btn" data-section="events">Events</button>
        </nav>
      </div>
    </header>

    <main class="main">
      <!-- DASHBOARD SECTION -->
      <section class="section" id="section-dashboard">
        <h2>Dashboard</h2>
        <div class="stats-grid">
          <div class="stat-card stat-card--primary">
            <span id="stat-total">0</span> Total Events
          </div>
          <div class="stat-card stat-card--accent">
            <span id="stat-upcoming">0</span> Upcoming Events
          </div>
          <div class="stat-card stat-card--success">
            <span id="stat-participants">0</span> Total Participants
          </div>
        </div>
        <div class="events-grid" id="recent-events-grid"></div>
      </section>

      <!-- CREATE EVENT SECTION -->
      <section class="section hidden" id="section-create">
        <h2 id="form-title">Create New Event</h2>
        <form class="form-card" id="event-form">
          <input type="hidden" id="edit-event-id" value="" />
          <input
            type="text"
            id="event-name"
            placeholder="Event Name"
            required
          />
          <select id="event-category">
            <option value="General">General</option>
            <option value="Conference">Conference</option>
            <option value="Workshop">Workshop</option>
            <!-- ... more categories -->
          </select>
          <textarea id="event-description" placeholder="Description"></textarea>
          <input type="date" id="event-date" required />
          <input type="time" id="event-time" required />
          <input
            type="text"
            id="event-location"
            placeholder="Location"
            required
          />
          <input type="number" id="event-max" value="100" min="1" />
          <button type="submit" class="btn btn--primary">Create Event</button>
        </form>
      </section>

      <!-- EVENTS LIST SECTION -->
      <section class="section hidden" id="section-events">
        <h2>All Events</h2>
        <div class="search-bar">
          <input type="text" id="search-input" placeholder="Search events..." />
        </div>
        <div class="events-grid" id="events-grid"></div>
      </section>
    </main>

    <!-- REGISTRATION MODAL -->
    <div class="modal-overlay hidden" id="modal-register">
      <div class="modal">
        <h3>Register for Event</h3>
        <form id="register-form">
          <input type="hidden" id="register-event-id" />
          <input type="text" id="reg-name" placeholder="Full Name" required />
          <input type="email" id="reg-email" placeholder="Email" required />
          <input type="tel" id="reg-phone" placeholder="Phone" />
          <button type="submit" class="btn btn--primary">Register</button>
        </form>
      </div>
    </div>

    <!-- PARTICIPANTS MODAL -->
    <div class="modal-overlay hidden" id="modal-participants">
      <div class="modal modal--wide">
        <h3>Participants</h3>
        <div class="participants-list" id="participants-list"></div>
      </div>
    </div>

    <div class="toast-container" id="toast-container"></div>
    <script src="script.js"></script>
  </body>
</html>
```

### 7.2 `script.js` — Key Frontend Functions

```javascript
// --- Navigation ---
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

// --- Load Dashboard Stats ---
async function loadDashboard() {
  const [statsRes, eventsRes] = await Promise.all([
    fetch("/api/stats"),
    fetch("/api/events"),
  ]);
  const stats = await statsRes.json();
  const events = await eventsRes.json();
  document.getElementById("stat-total").textContent = stats.total_events;
  document.getElementById("stat-upcoming").textContent = stats.upcoming_events;
  document.getElementById("stat-participants").textContent =
    stats.total_participants;
}

// --- Load Events with Search ---
async function loadEvents(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`/api/events${q}`);
  const events = await res.json();
  const grid = document.getElementById("events-grid");
  grid.innerHTML =
    events.length === 0
      ? '<p class="empty-state">No events found.</p>'
      : events.map((e) => eventCardHTML(e)).join("");
}

// --- Create / Update Event ---
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
  const url = editId ? `/api/events/${editId}` : "/api/events";
  const method = editId ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  showToast(editId ? "Event updated!" : "Event created!", "success");
  resetForm();
  showSection("events");
});

// --- Register Participant ---
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
    const res = await fetch(`/api/events/${eventId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showToast("Registered successfully!", "success");
    closeModal("modal-register");
  });

// --- View Participants ---
async function openParticipants(eventId, eventName) {
  const res = await fetch(`/api/events/${eventId}/participants`);
  const participants = await res.json();
  const list = document.getElementById("participants-list");
  list.innerHTML = participants
    .map(
      (p) => `
        <div class="participant-row">
            <div class="participant-avatar">${p.name
              .split(" ")
              .map((w) => w[0])
              .join("")}</div>
            <div class="participant-info">
                <strong>${p.name}</strong>
                <span>${p.email} ${p.phone ? "· " + p.phone : ""}</span>
            </div>
        </div>`,
    )
    .join("");
  document.getElementById("modal-participants").classList.remove("hidden");
}

// --- Delete Event ---
async function deleteEvent(id) {
  if (!confirm("Delete this event?")) return;
  await fetch(`/api/events/${id}`, { method: "DELETE" });
  showToast("Event deleted", "info");
  loadEvents();
}

// --- Toast Notification ---
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
```

---

## 8. API Endpoints Summary

| Method   | Endpoint                        | Description                           |
| -------- | ------------------------------- | ------------------------------------- |
| `GET`    | `/`                             | Serve the frontend HTML page          |
| `POST`   | `/api/events`                   | Create a new event                    |
| `GET`    | `/api/events`                   | List all events (supports `?search=`) |
| `GET`    | `/api/events/<id>`              | Get a single event by ID              |
| `PUT`    | `/api/events/<id>`              | Update an event                       |
| `DELETE` | `/api/events/<id>`              | Delete an event                       |
| `POST`   | `/api/events/<id>/register`     | Register a participant for an event   |
| `GET`    | `/api/events/<id>/participants` | View participants for an event        |
| `GET`    | `/api/stats`                    | Get dashboard statistics              |

---

## 9. How to Run

```bash
# 1. Install dependencies
pip install flask flask-cors

# 2. Start the server
python app.py

# 3. Open in browser
# Visit http://localhost:5000
```

---

## 10. Project Structure

```
event/
├── app.py                  # Flask backend server
├── database.py             # Database schema and helpers
├── events.db               # SQLite database (auto-created)
└── static/
    ├── index.html          # Frontend HTML
    ├── style.css           # CSS styles
    └── script.js           # Frontend JavaScript logic
```

---

## 11. Conclusion

This Event Management System demonstrates the fundamental concepts of database management systems including table creation, foreign key relationships, CRUD operations, subqueries, and aggregate functions. The application provides a practical, user-friendly interface for managing events and registrations, built with a clean separation between the frontend, backend, and database layers.

---
