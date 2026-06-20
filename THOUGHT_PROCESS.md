# 🧠 Thought Process Sheet — Queue Cure '26

## Problem Understanding

India's 1.5 million clinics rely on paper token slips. The core problems:
1. **Patients** have zero visibility into when they'll be called
2. **Receptionists** manage everything from memory — error-prone
3. **No live sync** — patients don't know when to return from a break

Our solution: A two-screen real-time system where the receptionist manages the queue and a waiting room display shows live token updates via WebSockets.

---

## Architecture Decisions

### Why Socket.IO over raw WebSockets?
- **Auto-reconnection** with exponential backoff — critical for unstable clinic WiFi
- **Acknowledgment callbacks** — client knows if action succeeded
- **Transport fallback** — falls back to HTTP long-polling if WebSocket fails
- **Room support** — can segment receptionist vs. patient events (future-ready)
- This is why live sync works reliably (40% of evaluation)

### Why Server as Single Source of Truth?
- All queue mutations go through the server
- Clients never modify state directly — they REQUEST changes
- Server validates, applies, then BROADCASTS to all connected clients
- This eliminates race conditions when multiple receptionists are connected
- Even if a client crashes, the queue state survives on the server

### Why SQLite over PostgreSQL/MongoDB?
- **Zero configuration** — no database server to install or manage
- Perfect for a clinic's needs (single-server, low concurrency)
- Persistent consultation history survives server restarts
- WAL mode for concurrent reads while writing
- Keeps the demo deployment simple (single `npm start`)

### Why EMA over Simple Average for Wait Times?
- A doctor might spend 15 minutes on one complex case, then 3 minutes on simple ones
- **Simple average** would be skewed by the outlier for a long time
- **EMA (Exponential Moving Average)** with α = 0.333 means recent consultations have 3x more weight
- If the doctor was averaging 10 min but starts doing 5 min cases, EMA adapts within 3-4 patients
- We also compute standard deviation for confidence intervals → patients see "5-8 min" not just "6 min"

---

## Concurrency & Edge Cases

### Race Condition: Two Receptionists Click "Call Next" Simultaneously
**Problem:** Both try to call the same patient → double-call
**Solution:** Queue mutations are synchronous JavaScript. Node.js event loop processes one `token:callNext` at a time. The second call gets the NEXT patient, not the same one. Server broadcasts the correct state to both clients.

### Edge Case: Network Disconnection Mid-Operation
**Problem:** Receptionist clicks "Add Patient" but loses connection before acknowledgment
**Solution:** 
- Socket.IO has acknowledgment callbacks — if the client doesn't receive ack, it knows the action might have failed
- On reconnect, server sends full `queue:state` event — client is always eventually consistent
- Connection indicator shows "Offline" immediately, auto-retries

### Edge Case: Browser Tab Refresh
**Problem:** Receptionist refreshes the page — what happens to the queue?
**Solution:** Queue state lives on the server, not the client. On reconnect, `queue:state` event sends the full current state. Nothing is lost.

### Edge Case: Calling Next While Patient Is Being Served
**Problem:** Receptionist clicks "Call Next" without completing current patient
**Solution:** We auto-complete the current patient's consultation (recording actual duration), then call the next. Duration is captured and fed into the EMA calculator. This is a common real-world scenario — the receptionist sees the patient leave and immediately calls the next one.

### Edge Case: Empty Queue
**Problem:** Receptionist clicks "Call Next" when no one is waiting
**Solution:** 
- Button is visually disabled (greyed out, cursor: not-allowed)
- Server returns error via callback: "Queue is empty"
- Toast notification informs the receptionist
- Patient display shows calming "No patients waiting" state

### Edge Case: Day Rollover (Midnight)
**Problem:** Clinic doesn't restart the system at midnight
**Solution:** `_checkDayRollover()` runs before every operation. If the date has changed:
- Queue is cleared
- Token counter resets to 1
- Stats reset
- Wait time calculator re-bootstraps from historical data

### Edge Case: Undo After Destructive Action
**Problem:** Receptionist accidentally removes a patient or calls wrong next
**Solution:** 
- Last 20 actions stored in history stack
- Ctrl+Z shortcut or Undo button reverses the last action
- Only reversible actions are stored (add → remove, call → put back)
- Undo broadcasts state update to all clients

### Edge Case: Stale Wait Time Estimates
**Problem:** At the start of the day, no consultation data exists
**Solution:** Fallback chain:
1. Today's completed consultation EMA → most accurate
2. Manual time set by receptionist → informed guess
3. Last 7 days historical data → bootstrap from past
4. Default 5 minutes → only when literally no data exists

As consultations complete, real data automatically replaces estimates.

---

## UI/UX Decisions

### Receptionist Screen
- **Keyboard shortcuts** (Enter, Ctrl+N, Ctrl+Z) → Receptionists are FAST typists, mouse slows them down
- **Auto-focus on name input** after adding → no extra clicks needed
- **Confirmation dialog ONLY for destructive actions** (remove patient) → fast operations shouldn't be gated
- **Large "Call Next" button with pulse animation** → the most used action should be the most visible
- **Toast notifications** → non-blocking feedback, doesn't interrupt workflow

### Patient Display Screen
- **Giant token number (11rem)** → readable from 20 feet away in a waiting room
- **Flip digit animation** → dramatic, attention-grabbing when token changes
- **Bell ring animation + 3-tone chime** → patients notice even if not looking
- **Flash overlay on token change** → peripheral vision catches the brightness change
- **Floating particles** → calming ambient effect for stressed patients
- **Live clock** → patients can track real time
- **Estimated wait range** → "5-8 min" is more honest than "6 min"

---

## What I Would Add With More Time

1. **Doctor's panel** — Doctor marks "available" to trigger next call
2. **SMS notifications** — Patient gets SMS when their token is 2 away
3. **Multi-doctor support** — Multiple queues for different specialists
4. **Priority queue** — Emergency patients skip the line
5. **Analytics dashboard** — Peak hours, average wait trends, patient flow
6. **QR code check-in** — Patient scans QR to join queue remotely
7. **PWA support** — Install on clinic tablet as a native-like app

---

## Performance Considerations

- **State updates are O(n)** where n = queue length (need to recalculate wait times for all)
- For 200+ patients, this is < 1ms — no performance concern
- Socket.IO broadcasts to all clients simultaneously (not sequential)
- SQLite WAL mode handles concurrent reads without blocking
- Frontend uses React keys for efficient DOM diffing on queue list
- CSS animations are GPU-accelerated (transform, opacity) — no layout thrashing
