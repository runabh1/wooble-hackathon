import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * Custom hook for Socket.IO connection management
 * 
 * Handles:
 * - Connection/disconnection lifecycle
 * - Auto-reconnection with state sync
 * - Connection status tracking
 * - Event emission with acknowledgments
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | disconnected | reconnecting
  const [queueState, setQueueState] = useState({
    currentToken: null,
    queue: [],
    stats: {
      totalInQueue: 0,
      completedToday: 0,
      skippedToday: 0,
      nextTokenNumber: 1,
      avgConsultationTime: 300,
      emaConsultationTime: null,
      totalConsultationsRecorded: 0,
      waitTimeSource: 'default',
      canUndo: false,
      date: new Date().toISOString().split('T')[0]
    }
  });
  const [lastEvent, setLastEvent] = useState(null); // For triggering animations

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log('[Socket] Reconnecting... attempt:', attempt);
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      setConnectionStatus('connected');
      setIsConnected(true);
    });

    socket.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error.message);
      setConnectionStatus('disconnected');
    });

    // Queue state events
    socket.on('queue:state', (state) => {
      console.log('[Socket] Full state received');
      setQueueState(state);
      setLastEvent({ type: 'state', timestamp: Date.now() });
    });

    socket.on('queue:updated', (state) => {
      console.log('[Socket] Queue updated');
      setQueueState(state);
      setLastEvent({ type: 'updated', timestamp: Date.now() });
    });

    socket.on('token:called', (data) => {
      console.log('[Socket] Token called:', data.justCalled?.token);
      setQueueState({
        currentToken: data.currentToken,
        queue: data.queue,
        stats: data.stats
      });
      setLastEvent({ type: 'called', patient: data.justCalled, timestamp: Date.now() });
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  // Emit functions with acknowledgment support
  const addPatient = useCallback((name) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('patient:add', { name }, (response) => {
        if (response.success) resolve(response.entry);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const callNext = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('token:callNext', {}, (response) => {
        if (response.success) resolve(response.patient);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const completeConsultation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('token:complete', {}, (response) => {
        if (response.success) resolve(response.completed);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const skipCurrent = useCallback((moveToEnd = false) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('token:skip', { moveToEnd }, (response) => {
        if (response.success) resolve(response.skipped);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const removePatient = useCallback((tokenNumber) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('patient:remove', { tokenNumber }, (response) => {
        if (response.success) resolve(response.removed);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const undo = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('queue:undo', {}, (response) => {
        if (response.success) resolve(response.undone);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const setAvgTime = useCallback((minutes) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) return reject(new Error('Not connected'));
      socketRef.current.emit('settings:avgTime', { minutes }, (response) => {
        if (response.success) resolve();
        else reject(new Error(response.error));
      });
    });
  }, []);

  return {
    isConnected,
    connectionStatus,
    queueState,
    lastEvent,
    addPatient,
    callNext,
    completeConsultation,
    skipCurrent,
    removePatient,
    undo,
    setAvgTime,
  };
}
