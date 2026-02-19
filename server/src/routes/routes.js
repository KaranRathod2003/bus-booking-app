import { Router } from 'express';
import { readJSON } from '../services/fileStore.js';

const router = Router();

// GET /api/routes/cities - distinct cities for dropdowns
router.get('/cities', async (req, res) => {
  try {
    const routes = await readJSON('routes.json');
    const cities = new Set();
    routes.forEach((r) => {
      cities.add(r.source);
      cities.add(r.destination);
    });
    res.json([...cities].sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes?source=X&destination=Y
router.get('/', async (req, res) => {
  try {
    const { source, destination } = req.query;
    const routes = await readJSON('routes.json');

    let filtered = routes;
    if (source) filtered = filtered.filter((r) => r.source === source);
    if (destination) filtered = filtered.filter((r) => r.destination === destination);

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
