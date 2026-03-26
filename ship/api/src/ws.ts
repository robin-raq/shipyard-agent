import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { parse } from "url";

interface Client {
  ws: WebSocket;
  documentId: string;
  userId?: string;
  username?: string;
}

interface Message {
  type: string;
  documentId?: string;
  userId?: string;
  username?: string;
  content?: any;
  delta?: any;
  cursor?: any;
  timestamp?: number;
}

// Store active connections grouped by document ID
const documentRooms = new Map<string, Set<Client>>();

/**
 * Setup WebSocket server for real-time document collaboration
 * @param server - HTTP server instance
 */
export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: "/ws"
  });

  wss.on("connection", (ws: WebSocket, request) => {
    const { query } = parse(request.url || "", true);
    const documentId = query.documentId as string;
    const userId = query.userId as string;
    const username = query.username as string;

    if (!documentId) {
      ws.close(1008, "Document ID is required");
      return;
    }

    const client: Client = {
      ws,
      documentId,
      userId,
      username: username || "Anonymous"
    };

    // Add client to document room
    if (!documentRooms.has(documentId)) {
      documentRooms.set(documentId, new Set());
    }
    documentRooms.get(documentId)!.add(client);

    console.log(`Client ${username || userId || 'anonymous'} joined document ${documentId}`);
    console.log(`Active clients in document ${documentId}: ${documentRooms.get(documentId)!.size}`);

    // Notify other clients in the room about new user
    broadcastToDocument(documentId, {
      type: "user-joined",
      userId,
      username: client.username,
      timestamp: Date.now()
    }, client);

    // Send current active users to the new client
    const activeUsers = Array.from(documentRooms.get(documentId)!)
      .filter(c => c !== client)
      .map(c => ({
        userId: c.userId,
        username: c.username
      }));

    sendToClient(client, {
      type: "active-users",
      users: activeUsers,
      timestamp: Date.now()
    });

    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        handleMessage(client, message);
      } catch (error) {
        console.error("Error parsing message:", error);
        sendToClient(client, {
          type: "error",
          content: "Invalid message format"
        });
      }
    });

    // Handle client disconnect
    ws.on("close", () => {
      handleDisconnect(client);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error(`WebSocket error for client in document ${documentId}:`, error);
      handleDisconnect(client);
    });

    // Send acknowledgment
    sendToClient(client, {
      type: "connected",
      documentId,
      timestamp: Date.now()
    });
  });

  console.log("WebSocket server initialized on path /ws");

  return wss;
}

/**
 * Handle incoming messages from clients
 */
function handleMessage(client: Client, message: Message): void {
  const { type, documentId } = message;

  // Validate document ID matches
  if (documentId && documentId !== client.documentId) {
    sendToClient(client, {
      type: "error",
      content: "Document ID mismatch"
    });
    return;
  }

  switch (type) {
    case "document-change":
      // Broadcast document changes (operational transforms/deltas)
      broadcastToDocument(client.documentId, {
        type: "document-change",
        userId: client.userId,
        username: client.username,
        delta: message.delta,
        timestamp: Date.now()
      }, client);
      break;

    case "cursor-move":
      // Broadcast cursor position updates
      broadcastToDocument(client.documentId, {
        type: "cursor-move",
        userId: client.userId,
        username: client.username,
        cursor: message.cursor,
        timestamp: Date.now()
      }, client);
      break;

    case "selection-change":
      // Broadcast text selection changes
      broadcastToDocument(client.documentId, {
        type: "selection-change",
        userId: client.userId,
        username: client.username,
        content: message.content,
        timestamp: Date.now()
      }, client);
      break;

    case "typing-start":
      // Notify others that user is typing
      broadcastToDocument(client.documentId, {
        type: "typing-start",
        userId: client.userId,
        username: client.username,
        timestamp: Date.now()
      }, client);
      break;

    case "typing-stop":
      // Notify others that user stopped typing
      broadcastToDocument(client.documentId, {
        type: "typing-stop",
        userId: client.userId,
        username: client.username,
        timestamp: Date.now()
      }, client);
      break;

    case "ping":
      // Respond to ping with pong
      sendToClient(client, {
        type: "pong",
        timestamp: Date.now()
      });
      break;

    default:
      console.warn(`Unknown message type: ${type}`);
      sendToClient(client, {
        type: "error",
        content: `Unknown message type: ${type}`
      });
  }
}

/**
 * Handle client disconnect
 */
function handleDisconnect(client: Client): void {
  const room = documentRooms.get(client.documentId);
  if (room) {
    room.delete(client);
    
    console.log(`Client ${client.username || client.userId || 'anonymous'} left document ${client.documentId}`);
    console.log(`Active clients in document ${client.documentId}: ${room.size}`);

    // Notify other clients
    broadcastToDocument(client.documentId, {
      type: "user-left",
      userId: client.userId,
      username: client.username,
      timestamp: Date.now()
    });

    // Clean up empty rooms
    if (room.size === 0) {
      documentRooms.delete(client.documentId);
      console.log(`Document room ${client.documentId} cleaned up`);
    }
  }
}

/**
 * Send message to a specific client
 */
function sendToClient(client: Client, message: Message): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("Error sending message to client:", error);
    }
  }
}

/**
 * Broadcast message to all clients in a document room
 * @param documentId - Document ID
 * @param message - Message to broadcast
 * @param excludeClient - Optional client to exclude from broadcast
 */
function broadcastToDocument(
  documentId: string, 
  message: Message, 
  excludeClient?: Client
): void {
  const room = documentRooms.get(documentId);
  if (!room) return;

  room.forEach((client) => {
    if (client !== excludeClient) {
      sendToClient(client, message);
    }
  });
}

/**
 * Get active clients count for a document
 */
export function getDocumentClientsCount(documentId: string): number {
  return documentRooms.get(documentId)?.size || 0;
}

/**
 * Get all active document IDs
 */
export function getActiveDocuments(): string[] {
  return Array.from(documentRooms.keys());
}

/**
 * Broadcast message to all connected clients across all documents
 */
export function broadcastToAll(message: Message): void {
  documentRooms.forEach((room) => {
    room.forEach((client) => {
      sendToClient(client, message);
    });
  });
}
