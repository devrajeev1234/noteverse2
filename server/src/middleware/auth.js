import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export function authMiddleware(prisma) {
  return async function (req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        console.log('Auth: Missing token');
        return res.status(401).json({ error: 'Missing Authorization bearer token' });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error('Auth: GOOGLE_CLIENT_ID not set in environment');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      console.log('Auth: Verifying token with client ID:', clientId.substring(0, 20) + '...');
      const ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        console.log('Auth: Token payload missing sub');
        return res.status(401).json({ error: 'Invalid token' });
      }

      const googleSub = payload.sub;
      const email = payload.email || '';
      const name = payload.name || '';
      console.log('Auth: Token verified for user:', email || googleSub);
      
      // Upsert user by Google sub
      const user = await prisma.user.upsert({
        where: { googleSub },
        create: { googleSub, email, name },
        update: { email, name }
      });

      req.user = { id: user.id, googleSub, email, name };
      next();
    } catch (err) {
      console.error('Auth error:', err.message || err);
      if (err.message && err.message.includes('Token used too early')) {
        return res.status(401).json({ error: 'Token not yet valid' });
      }
      if (err.message && err.message.includes('Token used too late')) {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Unauthorized', details: err.message });
    }
  };
}


