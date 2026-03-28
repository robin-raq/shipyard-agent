import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketOptions {
  documentId: string;
  userId?: string;
  username?: string;
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface ConnectedUser {
  userId?: string;
  username?: string;
}

export function useWebSocket({ documentId, userId, username, onMessage, onConnect, onDisconnect }: WebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ConnectedUser[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();
    params.set('documentId', documentId);
    if (userId) params.set('userId', userId);
    if (username) params.set('username', username);

    const ws = new WebSocket(`${protocol}//${host}/ws?${params}`);

    ws.onopen = () => {
      setConnected(true);
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'active-users') {
          setActiveUsers(message.users || []);
        } else if (message.type === 'user-joined') {
          setActiveUsers((prev) => [...prev, { userId: message.userId, username: message.username }]);
        } else if (message.type === 'user-left') {
          setActiveUsers((prev) => prev.filter((u) => u.userId !== message.userId));
        }

        onMessage?.(message);
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onDisconnect?.();
      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    wsRef.current = ws;
  }, [documentId, userId, username, onConnect, onDisconnect, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendChange = useCallback((delta: any) => {
    send({ type: 'document-change', documentId, delta });
  }, [send, documentId]);

  const sendCursor = useCallback((cursor: any) => {
    send({ type: 'cursor-move', documentId, cursor });
  }, [send, documentId]);

  return { connected, activeUsers, send, sendChange, sendCursor };
}
