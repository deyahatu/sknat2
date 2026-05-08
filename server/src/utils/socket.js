let io = null;
export function setIO(ioInstance) { io = ioInstance; }
export function getIO() { return io; }
export function emitToUser(userId, event, data) {
  if (io) io.to(`user_${userId}`).emit(event, data);
}
