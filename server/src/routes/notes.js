import { Router } from 'express';
import { getUserKey, encryptNoteContent, decryptNoteContent } from '../crypto.js';

export default function notesRouter(prisma) {
  const router = Router();

  // Create note
  router.post('/', async (req, res) => {
    try {
      const { title, content, tags = [] } = req.body || {};
      const key = getUserKey(req.user.googleSub);
      const enc = encryptNoteContent(content || '', key);

      const note = await prisma.note.create({
        data: {
          userId: req.user.id,
          title: title || '',
          iv: enc.iv,
          authTag: enc.authTag,
          ciphertext: enc.ciphertext,
          tags: {
            connectOrCreate: (tags || []).map((t) => ({
              where: { userId_name: { userId: req.user.id, name: t } },
              create: { name: t, userId: req.user.id }
            }))
          }
        },
        include: { tags: true }
      });

      res.json({ id: note.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create note' });
    }
  });

  // Get notes (optional q search and tags filter)
  router.get('/', async (req, res) => {
    try {
      const q = (req.query.q || '').toString().trim();
      const tag = (req.query.tag || '').toString().trim();

      const where = { userId: req.user.id };
      if (tag) {
        where.tags = { some: { name: tag, userId: req.user.id } };
      }

      const notes = await prisma.note.findMany({
        where,
        include: { tags: true },
        orderBy: { updatedAt: 'desc' }
      });

      const key = getUserKey(req.user.googleSub);
      const result = notes
        .map((n) => ({
          id: n.id,
          title: n.title,
          content: (() => {
            try { return decryptNoteContent({ iv: n.iv, authTag: n.authTag, ciphertext: n.ciphertext }, key); } catch { return ''; }
          })(),
          tags: n.tags.map((t) => t.name),
          updatedAt: n.updatedAt
        }))
        .filter((n) => !q || (n.title?.toLowerCase().includes(q.toLowerCase()) || n.content?.toLowerCase().includes(q.toLowerCase())));

      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  // Update note
  router.put('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { title, content, tags = [] } = req.body || {};
      const key = getUserKey(req.user.googleSub);
      const enc = encryptNoteContent(content || '', key);

      // Ensure ownership
      const existing = await prisma.note.findFirst({ where: { id, userId: req.user.id } });
      if (!existing) return res.status(404).json({ error: 'Not found' });

      await prisma.note.update({
        where: { id },
        data: {
          title: title ?? existing.title,
          iv: enc.iv,
          authTag: enc.authTag,
          ciphertext: enc.ciphertext,
          tags: {
            set: [],
            connectOrCreate: (tags || []).map((t) => ({
              where: { userId_name: { userId: req.user.id, name: t } },
              create: { name: t, userId: req.user.id }
            }))
          }
        }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update note' });
    }
  });

  // Delete note
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      // Ensure ownership
      const existing = await prisma.note.findFirst({ where: { id, userId: req.user.id } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      await prisma.note.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete note' });
    }
  });

  // List tags
  router.get('/tags/list', async (req, res) => {
    try {
      const tags = await prisma.tag.findMany({ where: { userId: req.user.id }, orderBy: { name: 'asc' } });
      res.json(tags.map((t) => t.name));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to list tags' });
    }
  });

  return router;
}


