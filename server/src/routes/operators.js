import { Router } from 'express';
import { readJSON } from '../services/fileStore.js';

const router = Router();

// GET /api/operators
router.get('/', async (req, res) => {
  try {
    const operators = await readJSON('operators.json');
    res.json(operators);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
