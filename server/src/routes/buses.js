import { Router } from 'express';
import { readJSON } from '../services/fileStore.js';

const router = Router();

// GET /api/buses?routeId=R&date=D
router.get('/', async (req, res) => {
  try {
    const { routeId } = req.query;
    if (!routeId) {
      return res.status(400).json({ error: 'routeId is required' });
    }

    const buses = await readJSON('buses.json');
    const operators = await readJSON('operators.json');

    const filtered = buses
      .filter((b) => b.routeId === routeId)
      .map((bus) => {
        const operator = operators.find((o) => o.id === bus.operatorId);
        return {
          id: bus.id,
          name: bus.name,
          type: bus.type,
          departure: bus.departure,
          arrival: bus.arrival,
          price: bus.price,
          totalSeats: bus.seats.length,
          operator: operator || null,
        };
      });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buses/:busId — get a single bus by ID
router.get('/:busId', async (req, res) => {
  try {
    const { busId } = req.params;
    const buses = await readJSON('buses.json');
    const operators = await readJSON('operators.json');
    const bus = buses.find((b) => b.id === busId);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    const operator = operators.find((o) => o.id === bus.operatorId);
    res.json({
      id: bus.id,
      name: bus.name,
      type: bus.type,
      departure: bus.departure,
      arrival: bus.arrival,
      price: bus.price,
      routeId: bus.routeId,
      totalSeats: bus.seats.length,
      operator: operator || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
