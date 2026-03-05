from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db, init_db
import os

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# ---------------------------------------------------------------------------
# Serve frontend
# ---------------------------------------------------------------------------

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


# ---------------------------------------------------------------------------
# EVENT ENDPOINTS
# ---------------------------------------------------------------------------

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

    # Check existence
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


# ---------------------------------------------------------------------------
# PARTICIPANT / REGISTRATION ENDPOINTS
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# STATS ENDPOINT
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
