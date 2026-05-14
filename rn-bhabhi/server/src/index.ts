import cors from 'cors';
import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './middleware/authMiddleware';
import { registerGameHandlers } from './socket/GameSocketHandler';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
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
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`Bhabhi Thulla server running on :${PORT}`);
});
