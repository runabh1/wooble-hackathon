# 🏥 Queue Cure — Real-Time Clinic Queue Management

> **Queue Cure '26** — Replacing paper token slips with real-time, live-synced digital queue management for India's 1.5 million clinics.

76% of India's clinics still run on paper token slips and shouting. Patients wait 2–3 hours with zero visibility. Queue Cure fixes this with a two-screen real-time system powered by WebSockets.

---

## 🎯 What It Does

### Screen 1 — Receptionist Dashboard
- ➕ Add patients to queue instantly
- 📢 Call next patient with one click
- ⏱️ Set average consultation time
- ✓ Complete / ⏭ Skip / ↻ Re-queue patients
- ↩ Undo last action (safety net)
- ⌨️ Keyboard shortcuts (Enter, Ctrl+N, Ctrl+Z)
- 📊 Live stats — patients seen, avg time, queue length

### Screen 2 — Patient Waiting Room Display
- 🔔 Giant token number with animated transitions
- 📋 Full queue preview with names
- ⏳ Estimated wait time per patient (from real data!)
- 🔊 Audio notification on token change
- 📺 Optimized for TV/large display in waiting room

### Live Sync
- Both screens update **instantly** when "Call Next" is clicked
- No page refresh needed — powered by WebSockets (Socket.IO)
- Auto-reconnection with full state sync

---

## 🏗️ Architecture

```
┌──────────────────┐     WebSocket      ┌──────────────────┐
│   Receptionist   │◄──────────────────►│                  │
│    Dashboard     │                    │   Node.js +      │
│   (React SPA)    │                    │   Express +      │
└──────────────────┘                    │   Socket.IO      │
                                        │   Server         │
┌──────────────────┐     WebSocket      │                  │
│  Patient Waiting │◄──────────────────►│   Queue Engine   │
│   Room Display   │                    │   + SQLite DB    │
│   (React SPA)    │                    │                  │
└──────────────────┘                    └──────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite | Fast dev, component reuse |
| Styling | Vanilla CSS | Full control, premium dark UI |
| Real-time | Socket.IO | Auto-reconnect, rooms, fallback to polling |
| Backend | Node.js + Express | Lightweight, event-driven |
| Database | SQLite (better-sqlite3) | Zero config, persistent consultation history |
| Font | Inter (Google Fonts) | Clean, professional medical feel |

---

## 🚀 Getting Started
FRONTEND DEPLOYED AT :https://wooble-hackathon.vercel.app/
BACKEND DEPLOYED AT  :https://wooble-hackathon.onrender.com
### Prerequisites
- Node.js 18+ installed
- npm 9+

### Installation & Running

```bash
# 1. Clone the repo
git clone <repo-url>
cd queue-cure

# 2. Install backend dependencies
cd backend
npm install

# 3. Start the backend server
npm run dev
# Server runs on http://localhost:3001

# 4. In a NEW terminal, install frontend dependencies
cd frontend
npm install

# 5. Start the frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### Usage

1. Open **http://localhost:5173** — Home page with navigation
2. Click **Receptionist** → Opens the queue management dashboard
3. Click **Patient Display** (or open `/display` in a new tab/window)
4. Add patients on the receptionist screen → Watch them appear instantly on the patient display
5. Click "Call Next" → Token number updates on both screens in real-time

**Pro Tip:** Open both screens side by side for the full demo experience!

---

## ⏱️ Wait Time Calculation — How It Works

We do **NOT** use hardcoded wait times. Instead, we use **Exponential Moving Average (EMA)** computed from real consultation durations:

```
EMA = α × current_duration + (1 - α) × previous_EMA
where α = 2 / (N + 1), N = 5 (recent consultations weighted more)

estimated_wait = tokens_ahead × EMA
confidence_range = estimated_wait ± (std_deviation × tokens_ahead × 0.8)
```

### Why EMA over Simple Average?
- **Adapts quickly**: If the doctor speeds up or slows down, EMA adjusts faster
- **Recency bias**: Recent consultations matter more than ones from 2 hours ago
- **Confidence intervals**: We show a range (e.g., "5–8 min") instead of a single number

### Data Sources (in priority order):
1. **Real consultation data** — from completed consultations today
2. **Manual setting** — receptionist can set avg time
3. **Historical data** — bootstraps from last 7 days on startup
4. **Default** — 5 minutes (only when no data available at all)

---

## 🔌 Socket Events

See [SOCKET_EVENTS.md](./SOCKET_EVENTS.md) for the full socket event diagram and payload documentation.

### Key Events:
| Event | Direction | Description |
|-------|-----------|-------------|
| `queue:state` | Server → Client | Full state sync (on connect/reconnect) |
| `patient:add` | Client → Server | Add new patient to queue |
| `token:callNext` | Client → Server | Call next patient |
| `token:called` | Server → All | Broadcast: token was called |
| `queue:updated` | Server → All | Broadcast: queue state changed |
| `token:complete` | Client → Server | Mark consultation complete |
| `queue:undo` | Client → Server | Undo last action |

---

## 🧠 Edge Cases & Concurrency Handling

| Scenario | How We Handle It |
|----------|-----------------|
| Empty queue + "Call Next" | Button disabled, graceful error message |
| Multiple receptionists | Server is single source of truth, no race conditions |
| Browser refresh/tab close | State lives on server, full sync on reconnect |
| Network failure | Connection indicator shows "Offline", auto-retry |
| Calling next while patient is being served | Auto-completes current, records duration |
| Midnight rollover | Queue auto-resets, token numbers restart at 1 |
| Duplicate patient names | Allowed (not everyone has unique names), warning shown |
| Undo after calling next | Puts patient back at front of queue |
| Very long queue (200+) | No artificial limits, tested for performance |

---

## 📁 Project Structure

```
queue-cure/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express + Socket.IO server
│   │   ├── queueEngine.js         # Core queue logic & state management
│   │   ├── waitTimeCalculator.js   # EMA-based wait time estimation
│   │   ├── db.js                   # SQLite database layer
│   │   └── socketHandlers.js       # Socket.IO event handlers
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Router & home page
│   │   ├── main.jsx                # Entry point
│   │   ├── index.css               # Design system (CSS custom properties)
│   │   ├── pages/
│   │   │   ├── ReceptionistDashboard.jsx
│   │   │   └── PatientWaitingRoom.jsx
│   │   ├── components/
│   │   │   ├── AddPatientForm.jsx
│   │   │   ├── QueueList.jsx
│   │   │   ├── CurrentTokenDisplay.jsx
│   │   │   ├── StatsPanel.jsx
│   │   │   └── ConnectionStatus.jsx
│   │   ├── hooks/
│   │   │   └── useSocket.js        # Socket.IO React hook
│   │   └── utils/
│   │       └── formatTime.js       # Time formatting utilities
│   ├── vite.config.js
│   └── package.json
├── README.md
└── SOCKET_EVENTS.md
```

---

## 📄 License

Built for Queue Cure '26 Hackathon on Wooble.
