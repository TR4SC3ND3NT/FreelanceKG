import type { Server as SocketServer } from 'socket.io';

let ioInstance: SocketServer | null = null;

export const setSocketServer = (io: SocketServer) => {
  ioInstance = io;
};

export const emitToUser = (userId: string, event: string, payload: unknown): boolean => {
  if (!ioInstance) {
    return false;
  }

  ioInstance.to(`user:${userId}`).emit(event, payload);
  return true;
};

export const emitToRoom = (room: string, event: string, payload: unknown): boolean => {
  if (!ioInstance) {
    return false;
  }

  ioInstance.to(room).emit(event, payload);
  return true;
};
