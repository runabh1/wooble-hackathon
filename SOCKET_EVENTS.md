# 🔌 Socket Event Diagram — Queue Cure

This document describes all WebSocket (Socket.IO) events used in Queue Cure for real-time communication between the frontend clients and the backend server.

---

## Connection Flow

```
Client (Receptionist/Patient Display)          Server
  │                                              │
  │──────── connect ──────────────────────────►  │
  │                                              │ (registers client)
  │◄──────── queue:state ────────────────────── │ (sends full state)
  │                                              │
  │              ... live session ...             │
  │                                              │
  │──────── disconnect ───────────────────────► │
  │                                              │ (cleans up)
  │                                              │
  │──────── reconnect ────────────────────────► │
  │◄──────── queue:state ────────────────────── │ (full state re-sync)
```

---

## Event Reference

### 1. `queue:state` — Full State Sync

**Direction:** Server → Client  
**When:** On initial connection, reconnection, or manual refresh request  
**Purpose:** Provides complete queue state so client can render from scratch

```json
{
  "currentToken": {
    "token": 5,
    "name": "Rahul Sharma",
    "addedAt": "2026-06-21T10:30:00.000Z",
    "calledAt": "2026-06-21T10:45:00.000Z"
  },
  "queue": [
    {
      "token": 6,
      "name": "Priya Patel",
      "addedAt": "2026-06-21T10:32:00.000Z",
      "position": 1,
      "tokensAhead": 0,
      "estimatedWait": {
        "estimatedSeconds": 420,
        "confidenceLow": 300,
        "confidenceHigh": 540,
        "source": "real_data",
        "basedOnConsultations": 4,
        "currentEMA": 420
      }
    }
  ],
  "stats": {
    "totalInQueue": 3,
    "completedToday": 4,
    "skippedToday": 1,
    "nextTokenNumber": 9,
    "avgConsultationTime": 450,
    "emaConsultationTime": 420,
    "minConsultationTime": 300,
    "maxConsultationTime": 600,
    "totalConsultationsRecorded": 4,
    "waitTimeSource": "real_data",
    "canUndo": true,
    "date": "2026-06-21"
  }
}
```

---

### 2. `patient:add` — Add Patient to Queue

**Direction:** Client → Server  
**Acknowledgment:** Yes (callback with result)

```json
// Request
{ "name": "Amit Kumar" }

// Success Response (via callback)
{ "success": true, "entry": { "token": 9, "name": "Amit Kumar", "addedAt": "..." } }

// Error Response (via callback)
{ "success": false, "error": "Patient name is required" }
```

**Server broadcasts:** `queue:updated` to all clients

---

### 3. `token:callNext` — Call Next Patient

**Direction:** Client → Server  
**Acknowledgment:** Yes

```json
// Request
{}

// Success Response
{ "success": true, "patient": { "token": 6, "name": "Priya Patel", "calledAt": "..." } }

// Error Response
{ "success": false, "error": "Queue is empty" }
```

**Server broadcasts:** `token:called` to all clients (includes `justCalled` field for animation)

---

### 4. `token:called` — Token Was Called (Broadcast)

**Direction:** Server → All Clients  
**When:** A new patient is called  
**Purpose:** Triggers animation on patient display, updates all screens

```json
{
  "currentToken": { "token": 6, "name": "Priya Patel", "calledAt": "..." },
  "queue": [ /* updated queue */ ],
  "stats": { /* updated stats */ },
  "justCalled": { "token": 6, "name": "Priya Patel", "calledAt": "..." }
}
```

---

### 5. `queue:updated` — Queue State Changed (Broadcast)

**Direction:** Server → All Clients  
**When:** Any queue mutation (add, complete, skip, remove, undo, settings change)

```json
{
  "currentToken": { /* ... */ },
  "queue": [ /* ... */ ],
  "stats": { /* ... */ }
}
```

---

### 6. `token:complete` — Complete Consultation

**Direction:** Client → Server  
**Acknowledgment:** Yes

```json
// Request
{}

// Success Response
{ 
  "success": true, 
  "completed": { 
    "token": 5, 
    "name": "Rahul Sharma", 
    "durationSeconds": 423.5,
    "completedAt": "..."
  } 
}
```

**Server action:** Records duration, updates EMA wait time calculator  
**Server broadcasts:** `queue:updated`

---

### 7. `token:skip` — Skip Current Patient

**Direction:** Client → Server  

```json
// Request
{ "moveToEnd": true }  // true = re-queue at end, false = remove entirely

// Success Response
{ "success": true, "skipped": { "token": 5, "name": "Rahul Sharma" } }
```

**Server broadcasts:** `queue:updated`

---

### 8. `patient:remove` — Remove Patient from Queue

**Direction:** Client → Server  

```json
// Request
{ "tokenNumber": 7 }

// Success Response
{ "success": true, "removed": { "token": 7, "name": "Sita Devi" } }
```

**Server broadcasts:** `queue:updated`

---

### 9. `queue:undo` — Undo Last Action

**Direction:** Client → Server  

```json
// Request
{}

// Success Response
{ "success": true, "undone": { "undone": "add", "patient": { "token": 9, "name": "Amit Kumar" } } }

// Error Response
{ "success": false, "error": "Nothing to undo" }
```

**Server broadcasts:** `queue:updated`

---

### 10. `settings:avgTime` — Set Average Consultation Time

**Direction:** Client → Server  

```json
// Request
{ "minutes": 7 }

// Success Response
{ "success": true }
```

**Server broadcasts:** `queue:updated` (wait times recalculated)

---

### 11. `queue:requestState` — Request Full State Refresh

**Direction:** Client → Server  
**Server responds:** `queue:state` (to requesting client only)

---

## Sequence Diagrams

### Adding a Patient
```
Receptionist           Server              Patient Display
    │                    │                       │
    │─ patient:add ──►  │                       │
    │                    │── queue:updated ────► │
    │◄─ queue:updated ──│                       │
    │◄─ callback ───────│                       │
```

### Calling Next Patient
```
Receptionist           Server              Patient Display
    │                    │                       │
    │─ token:callNext ►  │                       │
    │                    │ (auto-completes       │
    │                    │  previous patient)    │
    │                    │── token:called ─────► │
    │◄─ token:called ───│      (triggers        │
    │◄─ callback ───────│       animation)      │
```

### Reconnection
```
Client                 Server
  │                      │
  │── disconnect ──────► │
  │     (network lost)   │
  │                      │
  │── reconnect ───────► │
  │                      │ (full state sync)
  │◄── queue:state ──────│
  │     (catches up)     │
```

---

## Error Handling

All client → server events use Socket.IO acknowledgment callbacks:

```javascript
socket.emit('patient:add', { name: 'John' }, (response) => {
  if (response.success) {
    // Handle success
  } else {
    // response.error contains error message
  }
});
```

This ensures the client always knows whether an action succeeded or failed, even under network instability.

---

## Connection Health

- **Ping interval:** 10 seconds
- **Ping timeout:** 5 seconds
- **Reconnection:** Automatic with exponential backoff (1s → 5s max)
- **Max reconnection attempts:** Unlimited
- **Transport:** WebSocket with polling fallback
