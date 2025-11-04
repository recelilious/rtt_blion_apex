import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { insertEntry, readEntries, reserveUniqueCode } from './leaderboard.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/leaderboard', async (_req: Request, res: Response) => {
  try {
    const entries = await readEntries();
    res.json(entries);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to read leaderboard' });
  }
});

app.post('/api/submit', async (req: Request, res: Response) => {
  try {
    const { reactionTime, info, code } = req.body || {};
    if (typeof reactionTime !== 'number') {
      return res.status(400).json({ error: 'reactionTime must be a number' });
    }
    const { entry, leaderboard } = await insertEntry(
      reactionTime,
      typeof info === 'string' ? info : undefined,
      typeof code === 'string' ? code : undefined
    );
    res.json({ rank: entry.rank, code: entry.code, entry, leaderboard });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Failed to submit' });
  }
});

app.get('/api/new-code', async (_req: Request, res: Response) => {
  try {
    const code = await reserveUniqueCode();
    res.json({ code });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to allocate code' });
  }
});

// Serve frontend in production
const frontendDist = path.resolve(process.cwd(), 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
