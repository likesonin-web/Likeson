// middleware/cronAuth.js
export default function cronAuth(req, res, next) {
  const token = req.headers['x-cron-token'];
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(403).json({ message: 'Forbidden: Invalid cron token' });
  }
  next();
}
