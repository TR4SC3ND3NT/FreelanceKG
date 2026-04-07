// ============================================
// FreelanceKG Socket.io Client
// ============================================

import { io, Socket } from 'socket.io-client';
import { getToken } from './api';
import { SOCKET_URL } from '@/config/runtime';

let socket: Socket | null = null;

export interface SocketMessage {
  id: string;
  type?: 'text' | 'image' | 'file' | 'system';
  orderId: string;
  senderId: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface SocketNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: {
        token: getToken(),
      },
    });

    socket.on('connect', () => undefined);
    socket.on('disconnect', () => undefined);
    socket.on('connect_error', () => undefined);
  }

  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: getToken() };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function joinOrder(orderId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('join-order', orderId);
  }
}

export function leaveOrder(orderId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('leave-order', orderId);
  }
}

export function sendMessage(data: {
  orderId: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  type?: 'text' | 'image' | 'file' | 'system';
}): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('send-message', data);
  }
}

export function sendTyping(orderId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('typing', orderId);
  }
}

export function stopTyping(orderId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('stop-typing', orderId);
  }
}

export function onNewMessage(callback: (message: SocketMessage) => void): void {
  const s = getSocket();
  s.on('new-message', callback);
}

export function offNewMessage(callback?: (message: SocketMessage) => void): void {
  const s = getSocket();
  s.off('new-message', callback);
}

export function onUserTyping(callback: (data: { userId: string; name: string }) => void): void {
  const s = getSocket();
  s.on('user-typing', callback);
}

export function offUserTyping(callback?: (data: { userId: string; name: string }) => void): void {
  const s = getSocket();
  s.off('user-typing', callback);
}

export function onUserStopTyping(callback: () => void): void {
  const s = getSocket();
  s.on('user-stop-typing', callback);
}

export function offUserStopTyping(callback?: () => void): void {
  const s = getSocket();
  s.off('user-stop-typing', callback);
}

export function onUserJoined(callback: (data: { userId: string; name: string }) => void): void {
  const s = getSocket();
  s.on('user-joined', callback);
}

export function offUserJoined(callback?: (data: { userId: string; name: string }) => void): void {
  const s = getSocket();
  s.off('user-joined', callback);
}

export function onUserLeft(callback: (data: { userId: string; name: string }) => void): void {
  const s = getSocket();
  s.on('user-left', callback);
}

export function offUserLeft(callback?: (data: { userId: string; name: string }) => void): void {
  const s = getSocket();
  s.off('user-left', callback);
}

export function onSocketError(callback: (data: { message?: string }) => void): void {
  const s = getSocket();
  s.on('error', callback);
}

export function offSocketError(callback?: (data: { message?: string }) => void): void {
  const s = getSocket();
  s.off('error', callback);
}

export function onNotification(callback: (notification: SocketNotification) => void): void {
  const s = getSocket();
  s.on('notification', callback);
}

export function offNotification(callback?: (notification: SocketNotification) => void): void {
  const s = getSocket();
  s.off('notification', callback);
}

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  joinOrder,
  leaveOrder,
  sendMessage,
  sendTyping,
  stopTyping,
  onNewMessage,
  offNewMessage,
  onUserTyping,
  offUserTyping,
  onUserStopTyping,
  offUserStopTyping,
  onUserJoined,
  offUserJoined,
  onUserLeft,
  offUserLeft,
  onSocketError,
  offSocketError,
  onNotification,
  offNotification,
};
