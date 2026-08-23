import cors from 'cors';
import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './middleware/authMiddleware';
import { registerGameHandlers } from './socket/GameSocketHandler';

if (!admin.apps.length) {
  const hasFirebaseCredentials = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG,
  );

  admin.initializeApp(hasFirebaseCredentials
    ? { credential: admin.credential.applicationDefault() }
    : undefined);
}

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10_000,
  pingInterval: 5_000,
});

io.use(socketAuthMiddleware);

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);
  registerGameHandlers(io, socket);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'get-way-cards-server', uptime: process.uptime() });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ name: 'Get Way Cards server', health: '/health', socket: 'Socket.IO enabled' });
});

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Check http://localhost:${PORT}/health or stop the existing server.`);
    process.exitCode = 1;
    return;
  }
  console.error('Server failed to start:', error);
  process.exitCode = 1;
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Get Way Cards server running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
