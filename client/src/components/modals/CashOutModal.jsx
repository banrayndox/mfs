import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  IoCloseOutline,
  IoCheckmarkCircle,
  IoAlertCircleOutline,
} from 'react-icons/io5';
import { CashOutColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';

export function CashOutModal({ isOpen, onClose, onSuccess }) {
  const { user, setUser } = useAuthStore();
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [manualAgentInput, setManualAgentInput] = useState('');
  const [verifiedAgent, setVerifiedAgent] = useState(null);
  const [agentChecking, setAgentChecking] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAgents([]);
      setSelectedAgentId('');
      setManualAgentInput('');
      setVerifiedAgent(null);
      setAgentError('');
      setAmount('');
      setPin('');
      setError('');
      setSuccessData(null);

      // Fetch active agents from MongoDB directory
      axios
        .get('/api/agents')
        .then((res) => {
          const list = res.data.agents || [];
          setAgents(list);
          if (list.length > 0) {
            setSelectedAgentId(list[0].agentId);
            setVerifiedAgent(list[0]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Handle agent selection from directory list
  const handleSelectAgent = (agent) => {
    setSelectedAgentId(agent.agentId);
    setManualAgentInput('');
    setVerifiedAgent(agent);
    setAgentError('');
  };

  // Handle manual agent phone/agentId entry
  const handleManualAgentLookup = (value) => {
    setManualAgentInput(value);
    setSelectedAgentId('');
    setVerifiedAgent(null);
    const clean = value.trim().replace(/^(\+88)/, '');

    if (clean.length >= 7) {
      setAgentChecking(true);
      setAgentError('');
      axios
        .get(`/api/agents/lookup/${clean}`)
        .then((res) => {
          setVerifiedAgent(res.data.agent);
          setSelectedAgentId(res.data.agent.agentId);
          setAgentError('');
        })
        .catch((err) => {
          setVerifiedAgent(null);
          setAgentError(err.response?.data?.message || 'Invalid agent / Agent account not found');
        })
        .finally(() => {
          setAgentChecking(false);
        });
    } else {
      setAgentError('');
    }
  };

  if (!isOpen) return null;

  const bdtAmount = parseFloat(amount) || 0;
  const fee = Math.round(bdtAmount * 1.5) / 100; // 1.5% fee
  const total = bdtAmount + fee;

  const handleCashOut = async (e) => {
    e.preventDefault();
    setError('');

    const targetIdentifier = selectedAgentId || manualAgentInput.trim();
    if (!targetIdentifier) {
      setError('একটি বৈধ এজেন্ট নির্বাচন বা প্রদান করুন (Please select or enter an agent)');
      return;
    }

    if (agentError) {
      setError(agentError);
      return;
    }

    setLoading(true);

    try {
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash: `cashout-${Math.round(bdtAmount * 100)}`,
      });

      const token = stepUpRes.data.stepUpToken;

      const cashOutRes = await axios.post(
        '/api/wallet/cashout',
        {
          agentIdentifier: targetIdentifier,
          amountPoisha: Math.round(bdtAmount * 100),
          idempotencyKey: `ui-cashout-${Date.now()}`,
        },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': `cashout-${Math.round(bdtAmount * 100)}`,
          },
        }
      );

      setSuccessData(cashOutRes.data.transaction);
      if (user) {
        setUser({ ...user, balancePoisha: user.balancePoisha - Math.round(total * 100) });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Cash out failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <CashOutColorIcon className="w-8 h-8 shrink-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">ক্যাশ আউট (Cash Out)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {successData ? (
          <div className="text-center py-6 space-y-3">
            <CheckmarkSuccessColorIcon className="w-14 h-14 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">ক্যাশ আউট সফল হয়েছে!</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {verifiedAgent?.name || 'এজেন্ট'}-এ ৳{bdtAmount.toFixed(2)} ক্যাশ আউট সম্পন্ন হয়েছে।
            </p>
            <div className="bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl text-xs text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-slate-700">
              💡 ক্যাশ আউট ফি (১.৫%): ৳{fee.toFixed(2)} | মোট কর্তন: ৳{total.toFixed(2)}
            </div>
            <button
              onClick={() => {
                setSuccessData(null);
                onClose();
              }}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover"
            >
              সম্পন্ন (Done)
            </button>
          </div>
        ) : (
          <form onSubmit={handleCashOut} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900 flex items-center gap-1.5">
                <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Agent Directory Picker */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                এজেন্ট নির্বাচন করুন (Select Agent Directory)
              </label>
              {agents.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 text-center border border-dashed border-slate-300 dark:border-slate-700">
                  সিস্টেমে কোনো এজেন্ট নিবন্ধিত নেই। নিজে একটি এজেন্ট অ্যাকাউন্ট নিবন্ধন করুন অথবা নিচে এজেন্টের নম্বর লিখুন।
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {agents.map((agent) => (
                    <label
                      key={agent.agentId}
                      onClick={() => handleSelectAgent(agent)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        selectedAgentId === agent.agentId
                          ? 'border-brand-blue bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="agent"
                          value={agent.agentId}
                          checked={selectedAgentId === agent.agentId}
                          onChange={() => handleSelectAgent(agent)}
                          className="text-brand-blue"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{agent.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{agent.phone} • {agent.location}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                        সক্রিয়
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Agent Entry */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                অথবা এজেন্ট নম্বর / আইডি লিখুন (Or Enter Agent Phone / ID)
              </label>
              <input
                type="text"
                value={manualAgentInput}
                onChange={(e) => handleManualAgentLookup(e.target.value)}
                placeholder="01XXXXXXXXX or AGT-XXXX"
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border text-sm font-mono focus:outline-none focus:ring-2 ${
                  agentError
                    ? 'border-rose-400 focus:ring-rose-400'
                    : verifiedAgent && manualAgentInput
                    ? 'border-emerald-400 focus:ring-emerald-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-brand-blue'
                }`}
              />

              {agentChecking && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  এজেন্ট ডিরেক্টরি যাচাই করা হচ্ছে...
                </p>
              )}
              {verifiedAgent && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold flex items-center gap-1">
                  <IoCheckmarkCircle className="w-3.5 h-3.5" />
                  যাচাইকৃত এজেন্ট: {verifiedAgent.name} ({verifiedAgent.phone})
                </p>
              )}
              {agentError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold flex items-center gap-1">
                  <IoAlertCircleOutline className="w-3.5 h-3.5" />
                  {agentError}
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                ক্যাশ আউট পরিমাণ (Amount in BDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="50"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue font-bold"
              />
            </div>

            {/* Fee summary */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>ক্যাশ আউট চার্জ (1.5% Fee):</span>
                <span>৳{fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1">
                <span>মোট কর্তন (Total Deducted):</span>
                <span>৳{total.toFixed(2)}</span>
              </div>
            </div>

            {/* PIN */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পিন নম্বর (4-Digit PIN)
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                name="cashout-pin"
                id="cashout-txn-pin"
                data-lpignore="true"
                data-1p-ignore="true"
                maxLength={4}
                value={pin}
                disabled={!verifiedAgent || !!agentError}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-center tracking-widest text-lg disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !verifiedAgent || !amount || pin.length !== 4 || !!agentError}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'প্রসেসিং হচ্ছে...' : `৳${total.toFixed(2)} ক্যাশ আউট করুন`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CashOutModal;
