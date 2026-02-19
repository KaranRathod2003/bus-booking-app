import { Router } from 'express';
import { getTicket } from '../services/bookingService.js';

const router = Router();

// GET /api/tickets/:pnr
router.get('/:pnr', async (req, res) => {
  try {
    const result = await getTicket(req.params.pnr);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
