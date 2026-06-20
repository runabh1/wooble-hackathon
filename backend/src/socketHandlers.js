/**
 * Socket.IO Event Handlers
 * 
 * All real-time communication flows through here.
 * The server is the single source of truth — clients request actions,
 * server processes them, then broadcasts the updated state.
 */

function registerSocketHandlers(io, queueEngine) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Send full state on connection (initial sync / reconnection)
    socket.emit('queue:state', queueEngine.getFullState());

    // --- Patient Addition ---
    socket.on('patient:add', (data, callback) => {
      try {
        const { name } = data;
        const entry = queueEngine.addPatient(name);
        const state = queueEngine.getFullState();

        // Broadcast to ALL connected clients
        io.emit('queue:updated', state);

        // Send acknowledgment to the requesting client
        if (callback) callback({ success: true, entry });

        console.log(`[Queue] Patient added: Token #${entry.token} - ${entry.name}`);
      } catch (error) {
        console.error('[Queue] Add patient error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Call Next Patient ---
    socket.on('token:callNext', (data, callback) => {
      try {
        const calledPatient = queueEngine.callNext();
        
        if (!calledPatient) {
          if (callback) callback({ success: false, error: 'Queue is empty' });
          return;
        }

        const state = queueEngine.getFullState();

        // Broadcast with special event for patient display animation
        io.emit('token:called', {
          ...state,
          justCalled: calledPatient
        });

        if (callback) callback({ success: true, patient: calledPatient });

        console.log(`[Queue] Called next: Token #${calledPatient.token} - ${calledPatient.name}`);
      } catch (error) {
        console.error('[Queue] Call next error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Complete Current Consultation ---
    socket.on('token:complete', (data, callback) => {
      try {
        const completed = queueEngine.completeCurrentConsultation();
        
        if (!completed) {
          if (callback) callback({ success: false, error: 'No active consultation' });
          return;
        }

        const state = queueEngine.getFullState();
        io.emit('queue:updated', state);

        if (callback) callback({ success: true, completed });

        console.log(`[Queue] Completed: Token #${completed.token} (${Math.round(completed.durationSeconds)}s)`);
      } catch (error) {
        console.error('[Queue] Complete error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Skip Current Patient ---
    socket.on('token:skip', (data, callback) => {
      try {
        const moveToEnd = data?.moveToEnd ?? false;
        const skipped = queueEngine.skipCurrent(moveToEnd);
        
        if (!skipped) {
          if (callback) callback({ success: false, error: 'No active consultation to skip' });
          return;
        }

        const state = queueEngine.getFullState();
        io.emit('queue:updated', state);

        if (callback) callback({ success: true, skipped });

        console.log(`[Queue] Skipped: Token #${skipped.token} (${moveToEnd ? 'moved to end' : 'removed'})`);
      } catch (error) {
        console.error('[Queue] Skip error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Remove Patient from Queue ---
    socket.on('patient:remove', (data, callback) => {
      try {
        const { tokenNumber } = data;
        const removed = queueEngine.removeFromQueue(tokenNumber);
        
        if (!removed) {
          if (callback) callback({ success: false, error: 'Patient not found in queue' });
          return;
        }

        const state = queueEngine.getFullState();
        io.emit('queue:updated', state);

        if (callback) callback({ success: true, removed });

        console.log(`[Queue] Removed: Token #${removed.token} - ${removed.name}`);
      } catch (error) {
        console.error('[Queue] Remove error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Undo Last Action ---
    socket.on('queue:undo', (data, callback) => {
      try {
        const result = queueEngine.undo();
        
        if (!result) {
          if (callback) callback({ success: false, error: 'Nothing to undo' });
          return;
        }

        const state = queueEngine.getFullState();
        io.emit('queue:updated', state);

        if (callback) callback({ success: true, undone: result });

        console.log(`[Queue] Undo: ${result.undone} - Token #${result.patient.token}`);
      } catch (error) {
        console.error('[Queue] Undo error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Set Average Consultation Time ---
    socket.on('settings:avgTime', (data, callback) => {
      try {
        const { minutes } = data;
        queueEngine.setAvgConsultationTime(minutes);
        
        const state = queueEngine.getFullState();
        io.emit('queue:updated', state);

        if (callback) callback({ success: true });

        console.log(`[Settings] Avg consultation time set to ${minutes} minutes`);
      } catch (error) {
        console.error('[Settings] Set avg time error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Request Full State (manual refresh) ---
    socket.on('queue:requestState', (data, callback) => {
      const state = queueEngine.getFullState();
      socket.emit('queue:state', state);
      if (callback) callback({ success: true });
    });

    // --- Disconnect ---
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

module.exports = { registerSocketHandlers };
