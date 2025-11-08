import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from './middleware/auth.js';
import notesRouter from './routes/notes.js';

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'noterverse', time: new Date().toISOString() });
});

// All routes below require a valid Google ID token
app.use(authMiddleware(prisma));
app.use('/notes', notesRouter(prisma));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});


