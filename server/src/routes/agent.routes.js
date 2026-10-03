import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listActiveAgents, getAgentDashboard, getAgentById } from '../services/agent.directory.service.js';

export const agentRouter = express.Router();

// Lookup Agent for Cash Out Validation
agentRouter.get('/lookup/:identifier', async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const agent = await getAgentById(identifier);
    if (!agent) {
      return res.status(404).json({
        code: 'AGENT_NOT_FOUND',
        message: 'Invalid agent / Agent account not found in Guardian MFS.',
      });
    }
    res.json({ success: true, agent });
  } catch (err) {
    next(err);
  }
});

// List Active Agents (Public / Customer access for cash-out picker)
agentRouter.get('/', async (req, res, next) => {
  try {
    const agents = await listActiveAgents();
    res.json({ agents });
  } catch (err) {
    next(err);
  }
});

// Agent Dashboard (Only accessible by authenticated AGENT accounts)
agentRouter.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    if (req.user.accountType !== 'AGENT') {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only registered agent accounts can access the agent dashboard.',
      });
    }

    const dashboard = await getAgentDashboard(req.user._id);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
});

export default agentRouter;
