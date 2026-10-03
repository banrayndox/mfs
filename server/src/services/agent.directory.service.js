import { User, Wallet, Transaction } from '../models/index.js';

/**
 * List all active agents for customer cash-out picker.
 */
export async function listActiveAgents() {
  const agentUsers = await User.find({
    accountType: 'AGENT',
    status: 'active',
    'agentProfile.status': 'active',
  }).select('name phone agentProfile createdAt');

  const agentsWithBalance = await Promise.all(
    agentUsers.map(async (agent) => {
      const wallet = await Wallet.findOne({ userId: agent._id, type: 'agent' });
      return {
        agentId: agent.agentProfile?.agentId || `AGT-${agent.phone.slice(-4)}`,
        userId: agent._id.toString(),
        name: agent.agentProfile?.businessName || agent.name,
        phone: agent.phone,
        location: agent.agentProfile?.location || 'Dhaka',
        address: agent.agentProfile?.address || 'Dhaka, Bangladesh',
        status: agent.agentProfile?.status || 'active',
        availableBalance: wallet ? wallet.balance : 0,
        createdAt: agent.createdAt,
      };
    })
  );

  return agentsWithBalance;
}

/**
 * Get single agent profile by agentId or userId.
 */
export async function getAgentById(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim().replace(/^(\+88)/, '');

  let query;
  if (clean.startsWith('AGT-')) {
    query = { 'agentProfile.agentId': clean };
  } else if (/^01[3-9]\d{8}$/.test(clean)) {
    query = { phone: clean };
  } else if (clean.length === 24) {
    query = { _id: clean };
  } else {
    query = { 'agentProfile.agentId': clean };
  }

  const agent = await User.findOne({
    ...query,
    accountType: 'AGENT',
    status: 'active',
  });
  if (!agent) return null;

  const wallet = await Wallet.findOne({ userId: agent._id, type: 'agent' });
  return {
    agentId: agent.agentProfile?.agentId || `AGT-${agent.phone.slice(-4)}`,
    userId: agent._id.toString(),
    name: agent.agentProfile?.businessName || agent.name,
    businessName: agent.agentProfile?.businessName || agent.name,
    phone: agent.phone,
    location: agent.agentProfile?.location || 'Dhaka',
    status: agent.agentProfile?.status || 'active',
    availableBalance: wallet ? wallet.balance : 0,
  };
}

/**
 * Get dashboard analytics for an agent.
 */
export async function getAgentDashboard(agentUserId) {
  const agent = await User.findOne({ _id: agentUserId, accountType: 'AGENT' });
  if (!agent) {
    throw new Error('Agent account not found.');
  }

  const wallet = await Wallet.findOne({ userId: agent._id, type: 'agent' });

  // Today's cash-out settlement records
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayCashOuts = await Transaction.find({
    recipientUserId: agent._id,
    type: 'cash_out',
    status: 'settled',
    createdAt: { $gte: startOfDay },
  })
    .sort({ createdAt: -1 })
    .populate('senderUserId', 'name phone');

  const totalVolumeToday = todayCashOuts.reduce((acc, t) => acc + t.amount, 0);

  // All recent settlement records
  const recentTransactions = await Transaction.find({
    recipientUserId: agent._id,
    type: 'cash_out',
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('senderUserId', 'name phone');

  return {
    agentId: agent.agentProfile?.agentId,
    businessName: agent.agentProfile?.businessName || agent.name,
    phone: agent.phone,
    location: agent.agentProfile?.location,
    status: agent.agentProfile?.status,
    walletBalancePoisha: wallet ? wallet.balance : 0,
    todayStats: {
      count: todayCashOuts.length,
      volumePoisha: totalVolumeToday,
    },
    todayTransactions: todayCashOuts.map((t) => ({
      txnId: t._id,
      customerName: t.senderUserId?.name || 'Customer',
      customerPhone: t.senderUserId?.phone || 'Unknown',
      amountPoisha: t.amount,
      createdAt: t.createdAt,
    })),
    recentHistory: recentTransactions.map((t) => ({
      txnId: t._id,
      customerName: t.senderUserId?.name || 'Customer',
      customerPhone: t.senderUserId?.phone || 'Unknown',
      amountPoisha: t.amount,
      status: t.status,
      createdAt: t.createdAt,
    })),
  };
}

export default {
  listActiveAgents,
  getAgentById,
  getAgentDashboard,
};
