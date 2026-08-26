import { Socket } from 'socket.io';
import admin from 'firebase-admin';

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    socket.data.user = { uid: `guest_${socket.id}`, name: 'Guest', isGuest: true };
    next();
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.user = {
      uid: decoded.uid,
      name: decoded.name ?? 'Player',
      photoURL: decoded.picture ?? '',
      isGuest: false,
    };
    next();
  } catch (error) {
    next(new Error('INVALID_TOKEN'));
  }
};
