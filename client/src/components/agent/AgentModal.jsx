import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  IoCloseOutline,
  IoMicOutline,
  IoMic,
  IoSend,
  IoSparklesOutline,
  IoCheckmarkCircle,
  IoAlertCircleOutline,
  IoLockClosedOutline,
  IoShieldCheckmarkOutline,
  IoBookmarkOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { AiCopilotColorIcon } from '../ui/FlaticonIcons.jsx';
import { useSystemStore } from '../../stores/systemStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function AgentModal({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const { isMockAi } = useSystemStore();
  const { user, setUser } = useAuthStore();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');

  // Memory view & history states
  const [showMemoryView, setShowMemoryView] = useState(false);
  const [memoryData, setMemoryData] = useState(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [clearingChat, setClearingChat] = useState(false);

  // Active PendingAction confirmation state
  const [activePendingAction, setActivePendingAction] = useState(null);
  const [stepUpPin, setStepUpPin] = useState('');
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch conversation history from server
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('guardian_token');
      const res = await axios.get('/api/copilot/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.data?.history && res.data.history.length > 0) {
        const mapped = res.data.history.map((m) => ({
          id: m.id || `hist-${Math.random()}`,
          sender: m.sender === 'user' ? 'user' : 'agent',
          text: m.text,
          pendingAction: m.pendingAction,
          clientAction: m.clientAction,
        }));
        setMessages(mapped);
      } else {
        setMessages([
          {
            id: 'm-welcome',
            sender: 'agent',
            text:
              i18n.language === 'bn'
                ? 'আসসালামু আলাইকুম! আমি আপনার এআই কপাইলট (AI Copilot)।\nটাকা পাঠানো, মোবাইল রিচার্জ, বিল পেমেন্ট, ক্যাশ আউট, সঞ্চয় পরিকল্পনা, বিল ভাগাভাগি বা শিডিউল পেমেন্টের মতো যেকোনো কাজ করতে আমাকে বলুন।'
                : 'Hello! I am your AI Copilot.\nYou can ask me to send money, recharge mobile, pay bills, cash out, create savings goals, split group bills, or schedule payments safely.',
          },
        ]);
      }
    } catch (err) {
      // Fallback welcome message
      setMessages([
        {
          id: 'm-welcome-fallback',
          sender: 'agent',
          text:
            i18n.language === 'bn'
              ? 'আসসালামু আলাইকুম! আমি আপনার এআই কপাইলট (AI Copilot)। আমি আপনাকে কীভাবে সাহায্য করতে পারি?'
              : 'Hello! I am your AI Copilot. How can I help you today?',
        },
      ]);
    }
  };

  const fetchMemory = async () => {
    setLoadingMemory(true);
    try {
      const token = localStorage.getItem('guardian_token');
      const res = await axios.get('/api/copilot/memory', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.data?.success) {
        setMemoryData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMemory(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm(i18n.language === 'bn' ? 'আপনি কি চ্যাট ইতিহাস মুছে ফেলতে চান?' : 'Clear conversation history?')) {
      return;
    }
    setClearingChat(true);
    try {
      const token = localStorage.getItem('guardian_token');
      await axios.delete('/api/copilot/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setMessages([
        {
          id: `m-cleared-${Date.now()}`,
          sender: 'agent',
          text:
            i18n.language === 'bn'
              ? 'চ্যাট হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে। আমি আপনাকে কীভাবে সাহায্য করতে পারি?'
              : 'Conversation history cleared. How can I help you today?',
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setClearingChat(false);
    }
  };

  const handleAddFact = async (e) => {
    e.preventDefault();
    if (!newFactText.trim()) return;
    try {
      const token = localStorage.getItem('guardian_token');
      await axios.post(
        '/api/copilot/memory',
        { fact: newFactText.trim() },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setNewFactText('');
      fetchMemory();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFact = async (id) => {
    try {
      const token = localStorage.getItem('guardian_token');
      await axios.delete(`/api/copilot/memory/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      fetchMemory();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllMemory = async () => {
    if (!window.confirm(i18n.language === 'bn' ? 'সংরক্ষিত সব তথ্য ও মেমোরি মুছে ফেলতে চান?' : 'Clear all memory and remembered notes?')) {
      return;
    }
    try {
      const token = localStorage.getItem('guardian_token');
      await axios.delete('/api/copilot/memory', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      fetchMemory();
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize and load conversation history on open
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setSpeechError('');
      setConfirmError('');
      setActivePendingAction(null);
      setShowMemoryView(false);
    }
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activePendingAction, showMemoryView]);

  // Web Speech API Voice Recognition setup
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        i18n.language === 'bn'
          ? 'এই ব্রাউজারে ভয়েস রিকগনিশন সমর্থিত নয়। অনুগ্রহ করে লিখে পাঠান।'
          : 'Speech recognition is not supported in this browser. Please type your command.'
      );
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = i18n.language === 'bn' ? 'bn-BD' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError('');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setSpeechError('Microphone access denied or unavailable.');
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg = { id: `u-${Date.now()}`, sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setSpeechError('');

    try {
      const token = localStorage.getItem('guardian_token');
      const res = await axios.post(
        '/api/copilot/message',
        {
          message: query,
          language: i18n.language,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const agentMsg = {
        id: `a-${Date.now()}`,
        sender: 'agent',
        text: res.data.reply,
        pendingAction: res.data.pendingAction,
        savingsPlan: res.data.savingsPlan,
        spendingSummary: res.data.spendingSummary,
        comparison: res.data.comparison,
        microSavings: res.data.microSavings,
        reminders: res.data.reminders,
        knowledgeDoc: res.data.knowledgeDoc,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // Check for App Control triggers (logout, navigate, open modal)
      if (res.data.clientAction) {
        const { type, path, modal, subview, prefill } = res.data.clientAction;
        if (type === 'logout') {
          setTimeout(() => {
            localStorage.removeItem('guardian_token');
            delete axios.defaults.headers.common['Authorization'];
            useAuthStore.getState().logout();
            onClose();
          }, 1000);
        } else if (type === 'navigate' && path) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mfs:navigate', { detail: { path, subview } }));
            onClose();
          }, 800);
        } else if (type === 'open_modal' && modal) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mfs:open_modal', { detail: { modal, prefill } }));
            onClose();
          }, 700);
        }
      }

      if (res.data.pendingAction) {
        setActivePendingAction(res.data.pendingAction);
        setStepUpPin('');
        setConfirmError('');
      } else {
        setActivePendingAction(null);
      }
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'agent',
        text: err.response?.data?.message || 'কমান্ড প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Execute PendingAction with Canonical Action Hash & Step-Up PIN (T2)
  const handleConfirmPendingAction = async (e) => {
    e.preventDefault();
    if (!activePendingAction || stepUpPin.length !== 4) return;

    setConfirmingAction(true);
    setConfirmError('');

    try {
      const canonicalHash = activePendingAction.actionHash || activePendingAction.actionId;

      // 1. Obtain Step-Up Token bound to canonical action hash
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin: stepUpPin,
        actionHash: canonicalHash,
      });

      const token = stepUpRes.data.stepUpToken;

      // 2. Confirm and Execute Pending Action with Anti-Replay Token
      const confirmRes = await axios.post(
        '/api/copilot/confirm',
        { actionId: activePendingAction.actionId },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': canonicalHash,
          },
        }
      );

      // Refresh balance
      try {
        const meRes = await axios.get('/api/auth/me');
        if (meRes.data?.wallet) {
          setUser({ ...user, balancePoisha: meRes.data.wallet.balancePoisha });
        }
      } catch (e) {}

      // Add success message
      const serverMsg =
        i18n.language === 'bn'
          ? (confirmRes.data?.messageBn || confirmRes.data?.message)
          : (confirmRes.data?.message || confirmRes.data?.messageBn);

      setMessages((prev) => [
        ...prev,
        {
          id: `done-${Date.now()}`,
          sender: 'agent',
          text:
            serverMsg ||
            (i18n.language === 'bn'
              ? `✅ সফলভাবে সম্পন্ন হয়েছে! অ্যাকশন: ${activePendingAction.preview?.title || 'অনুমোদিত'}`
              : `✅ Successfully executed! Action: ${activePendingAction.preview?.title || 'Approved'}`),
        },
      ]);

      setActivePendingAction(null);
      setStepUpPin('');
    } catch (err) {
      setConfirmError(err.response?.data?.message || 'অনুমোদন ব্যর্থ হয়েছে। পিন যাচাই করুন।');
    } finally {
      setConfirmingAction(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[85vh] max-h-[700px] border border-slate-200 dark:border-slate-800 overflow-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-brand-yellow dark:bg-slate-800 border-b border-yellow-300 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <AiCopilotColorIcon className="w-9 h-9 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  AI Copilot
                </h3>
                {isMockAi ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Mock Mode
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    Live
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-400">
                {i18n.language === 'bn' ? 'দ্বিভাষিক নিরাপদ আর্থিক অপারেটিং সহকারী' : 'Bilingual Safe Financial Operating Layer'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const nextState = !showMemoryView;
                setShowMemoryView(nextState);
                if (nextState) fetchMemory();
              }}
              className={`p-1.5 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold px-2.5 ${
                showMemoryView
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200'
              }`}
              title={i18n.language === 'bn' ? 'সংরক্ষিত মেমোরি ও তথ্য' : 'Copilot Memory'}
            >
              <IoBookmarkOutline className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden xs:inline">{i18n.language === 'bn' ? 'মেমোরি' : 'Memory'}</span>
            </button>

            <button
              onClick={handleClearChat}
              disabled={clearingChat || messages.length <= 1}
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-300 disabled:opacity-30"
              title={i18n.language === 'bn' ? 'চ্যাট হিস্ট্রি মুছুন' : 'Clear Chat'}
              aria-label="Clear Chat"
            >
              <IoTrashOutline className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Close Agent modal"
            >
              <IoCloseOutline className="w-6 h-6 text-slate-800 dark:text-slate-200" />
            </button>
          </div>
        </div>

        {showMemoryView ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>🧠</span> {i18n.language === 'bn' ? 'স্মৃতি ও পছন্দসমূহ (Copilot Memory)' : 'Copilot Memory'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {i18n.language === 'bn'
                    ? 'কপাইলট লেনদেন ও বিল পেমেন্ট সহজ করতে এই তথ্যগুলো মনে রাখে।'
                    : 'Personal context remembered by Copilot to automate actions.'}
                </p>
              </div>
              <button
                onClick={() => setShowMemoryView(false)}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                {i18n.language === 'bn' ? 'চ্যাটে ফিরুন' : 'Back to Chat'}
              </button>
            </div>

            {/* Form to add new fact */}
            <form onSubmit={handleAddFact} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                {i18n.language === 'bn' ? 'নতুন কোনো তথ্য মনে রাখতে বলুন:' : 'Add a fact for Copilot to remember:'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFactText}
                  onChange={(e) => setNewFactText(e.target.value)}
                  placeholder={i18n.language === 'bn' ? 'যেমন: করিম আমার ভাই, ডেসকো হিসাব ৪৪২১০৯' : 'e.g. Karim is my brother, DESCO 442109'}
                  className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
                <button
                  type="submit"
                  disabled={!newFactText.trim()}
                  className="px-3 py-1.5 bg-brand-yellow text-slate-900 font-semibold text-xs rounded-xl disabled:opacity-40 hover:bg-brand-yellow-hover transition-colors"
                >
                  {i18n.language === 'bn' ? 'সংরক্ষণ' : 'Save'}
                </button>
              </div>
            </form>

            {loadingMemory ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {i18n.language === 'bn' ? 'মেমোরি লোড হচ্ছে...' : 'Loading memories...'}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Contact Aliases */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                    <span>👥 {i18n.language === 'bn' ? 'পরিচিত ব্যক্তিবর্গ (Aliases)' : 'Contact Aliases'}</span>
                    <span className="text-[10px] font-normal text-slate-500">{memoryData?.contactAliases?.length || 0}</span>
                  </div>
                  {(!memoryData?.contactAliases || memoryData.contactAliases.length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic">
                      {i18n.language === 'bn' ? 'কোনো কন্টাক্ট সংরক্ষিত নেই (বলুন: "রাকিব আমার ভাই")' : 'No aliases saved (say: "Rakib is my brother")'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {memoryData.contactAliases.map((a, idx) => (
                        <div key={a._id || idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white capitalize">{a.relationship || a.alias}</span>
                            <span className="text-slate-500 dark:text-slate-400 ml-1.5">→ {a.name} {a.phone && `(${a.phone})`}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteFact(a._id)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Delete alias"
                          >
                            <IoTrashOutline className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Utility Accounts */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                    <span>⚡ {i18n.language === 'bn' ? 'ইউটিলিটি বিলের অ্যাকাউন্ট' : 'Utility Bill Accounts'}</span>
                    <span className="text-[10px] font-normal text-slate-500">{memoryData?.utilityAccounts?.length || 0}</span>
                  </div>
                  {(!memoryData?.utilityAccounts || memoryData.utilityAccounts.length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic">
                      {i18n.language === 'bn' ? 'কোনো বিলের অ্যাকাউন্ট সংরক্ষিত নেই' : 'No utility accounts saved'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {memoryData.utilityAccounts.map((u, idx) => (
                        <div key={u._id || idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white uppercase">{u.billerId}</span>
                            <span className="text-slate-500 dark:text-slate-400 ml-1.5">Acc: {u.accountNo}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteFact(u._id)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Delete utility"
                          >
                            <IoTrashOutline className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Financial Goals & Notes */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                    <span>🎯 {i18n.language === 'bn' ? 'সক্রিয় লক্ষ্য ও নোট' : 'Goals & Notes'}</span>
                    <span className="text-[10px] font-normal text-slate-500">{((memoryData?.financialGoals?.length || 0) + (memoryData?.contextNotes?.length || 0))}</span>
                  </div>
                  <div className="space-y-1.5">
                    {memoryData?.financialGoals?.map((g, idx) => (
                      <div key={g._id || idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{g.title}</span>
                          <span className="text-amber-600 dark:text-amber-400 ml-1.5">৳{(g.targetPoisha / 100).toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                    {memoryData?.contextNotes?.map((n, idx) => (
                      <div key={n._id || idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-slate-700 dark:text-slate-300">{n.fact}</span>
                        <button
                          onClick={() => handleDeleteFact(n._id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Delete note"
                        >
                          <IoTrashOutline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {(!memoryData?.financialGoals?.length && !memoryData?.contextNotes?.length) && (
                      <p className="text-[11px] text-slate-400 italic">
                        {i18n.language === 'bn' ? 'কোনো লক্ষ্য বা নোট নেই' : 'No goals or notes saved'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Clear All Memory Button */}
                <div className="pt-2 text-center">
                  <button
                    onClick={handleClearAllMemory}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
                  >
                    🗑️ {i18n.language === 'bn' ? 'সংরক্ষিত সব তথ্য মুছে ফেলুন (Clear All)' : 'Clear All Memory'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Message Thread */
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 bg-slate-50 dark:bg-slate-950 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-start gap-2 max-w-[85%]">
                {msg.sender === 'agent' && (
                  <AiCopilotColorIcon className="w-7 h-7 shrink-0 mt-0.5" />
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-brand-blue text-white rounded-br-none shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none shadow-soft border border-slate-100 dark:border-slate-700/60 whitespace-pre-line'
                  }`}
                >
                  {msg.text}

                  {/* Inline Savings Plan Card */}
                  {msg.savingsPlan && (
                    <div className="mt-2.5 bg-gradient-to-r from-amber-500/10 to-blue-500/10 dark:bg-slate-900/90 rounded-xl p-3 border border-amber-300/40 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>🎯 {msg.savingsPlan.title}</span>
                        <span className="text-amber-600 dark:text-amber-400">
                          ৳{((msg.savingsPlan.targetAmountPoisha || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-yellow h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, msg.savingsPlan.targetAmountPoisha > 0 ? (msg.savingsPlan.currentAmountPoisha / msg.savingsPlan.targetAmountPoisha) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>{i18n.language === 'bn' ? 'জমাকৃত' : 'Saved'}: ৳{((msg.savingsPlan.currentAmountPoisha || 0) / 100).toFixed(2)}</span>
                        <span>
                          {msg.savingsPlan.targetAmountPoisha > 0
                            ? `${((msg.savingsPlan.currentAmountPoisha / msg.savingsPlan.targetAmountPoisha) * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('mfs:open_modal', { detail: { modal: 'savings' } }));
                          onClose();
                        }}
                        className="w-full mt-1 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-brand-blue dark:text-brand-yellow hover:bg-slate-200"
                      >
                        {i18n.language === 'bn' ? 'সঞ্চয় পরিচালনা করুন (Manage Goal)' : 'Manage Goal'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Structured Confirmation Card for PendingAction */}
          {activePendingAction && (
            <div className="bg-white dark:bg-slate-800 border-2 border-brand-yellow rounded-2xl p-3.5 shadow-md space-y-2.5 my-2">
              <div className="flex items-center gap-2 text-brand-blue dark:text-brand-yellow font-bold text-xs">
                <IoSparklesOutline className="w-4 h-4" />
                <span>{activePendingAction.preview?.title || 'অনুমোদন প্রয়োজন (Confirmation Required)'}</span>
              </div>

              {/* Guardian Risk Review Warning */}
              {activePendingAction.riskDecision?.isSuspicious ? (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                    <IoAlertCircleOutline className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{i18n.language === 'bn' ? 'গার্ডিয়ান সতর্কতা (অস্বাভাবিক সংকেত)' : 'Guardian Review (Unusual signals detected)'}</span>
                  </div>
                  <ul className="text-[11px] text-amber-800 dark:text-amber-300 list-disc list-inside space-y-0.5 pt-0.5">
                    {activePendingAction.riskDecision.reasons?.map((r, idx) => (
                      <li key={idx}>{i18n.language === 'bn' ? r.bn : r.en}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400 font-semibold pt-1">
                    {i18n.language === 'bn' ? 'অনুগ্রহ করে সতর্কতার সাথে তথ্য পর্যালোচনা করে আপনার পিন দিয়ে নিশ্চিত করুন।' : 'Please review carefully before confirming with your PIN.'}
                  </p>
                </div>
              ) : (
                <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-900/50">
                  <IoCheckmarkCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{i18n.language === 'bn' ? 'গার্ডিয়ান যাচাইকৃত: স্বাভাবিক লেনদেন প্যাটার্ন' : 'Guardian Verified: Normal transaction pattern'}</span>
                </div>
              )}

              {/* Transaction Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-xl text-xs space-y-1">
                {activePendingAction.preview?.recipientLabel && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>প্রাপক (Recipient):</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {activePendingAction.preview.recipientLabel}
                    </span>
                  </div>
                )}
                {activePendingAction.preview?.amountPoisha !== undefined && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>পরিমাণ (Amount):</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ৳{(activePendingAction.preview.amountPoisha / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {activePendingAction.preview?.feePoisha !== undefined && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>সার্ভিস চার্জ (Fee):</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ৳{(activePendingAction.preview.feePoisha / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {activePendingAction.preview?.totalPoisha !== undefined && (
                  <div className="flex justify-between text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1 font-bold">
                    <span>সর্বমোট কর্তন (Total):</span>
                    <span>৳{(activePendingAction.preview.totalPoisha / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {confirmError && (
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold flex items-center gap-1">
                  <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
                  <span>{confirmError}</span>
                </div>
              )}

              {/* PIN input for confirmation */}
              <form onSubmit={handleConfirmPendingAction} className="flex gap-2 items-center pt-1">
                <div className="relative flex-1">
                  <input
                    type="password"
                    maxLength={4}
                    value={stepUpPin}
                    onChange={(e) => setStepUpPin(e.target.value)}
                    placeholder="৪-সংখ্যার পিন (PIN)"
                    required
                    className="w-full px-3 py-1.5 pl-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                  <IoLockClosedOutline className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                <button
                  type="submit"
                  disabled={confirmingAction || stepUpPin.length !== 4}
                  className="px-4 py-1.5 rounded-xl bg-brand-yellow text-slate-900 text-xs font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-xs"
                >
                  {confirmingAction ? '...' : 'নিশ্চিত করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `cancel-${Date.now()}`,
                        sender: 'agent',
                        text: i18n.language === 'bn' ? '❌ লেনদেনটি বাতিল করা হয়েছে।' : '❌ Transaction cancelled by user.',
                      },
                    ]);
                    setActivePendingAction(null);
                    setStepUpPin('');
                    setConfirmError('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  বাতিল
                </button>
              </form>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
              <span className="w-2 h-2 rounded-full bg-brand-yellow animate-ping"></span>
              <span>এআই প্রসেসিং হচ্ছে...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Speech Error alert */}
      {speechError && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] border-t border-amber-200 dark:border-amber-800 flex justify-between items-center">
          <span>{speechError}</span>
          <button onClick={() => setSpeechError('')} className="font-bold underline ml-2">বন্ধ</button>
        </div>
      )}

      {/* Quick Suggestion Chips - Displayed in two lines */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 text-[11px]">
        {/* Line 1: Core Financial Actions */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'টাকা পাঠাতে চাই' : 'I want to send money')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            💸 {i18n.language === 'bn' ? 'টাকা পাঠানো' : 'Send Money'}
          </button>
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'মোবাইল রিচার্জ করতে চাই' : 'I want to recharge mobile')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            📱 {i18n.language === 'bn' ? 'মোবাইল রিচার্জ' : 'Mobile Recharge'}
          </button>
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'বিদ্যুৎ বিল দিতে চাই' : 'I want to pay electricity bill')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            ⚡ {i18n.language === 'bn' ? 'বিল পরিশোধ' : 'Pay Bill'}
          </button>
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'ক্যাশ আউট করতে চাই' : 'I want to cash out')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            🏧 {i18n.language === 'bn' ? 'ক্যাশ আউট' : 'Cash Out'}
          </button>
        </div>

        {/* Line 2: Smart Financial Management & Automation */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'বন্ধুদের সাথে বিল ভাগ করো' : 'Split bill with friends')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            👥 {i18n.language === 'bn' ? 'বিল ভাগাভাগি' : 'Split Bill'}
          </button>
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'নতুন সঞ্চয় লক্ষ্য তৈরি করো' : 'Create a new savings goal')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            🎯 {i18n.language === 'bn' ? 'সঞ্চয় লক্ষ্য' : 'Savings Goal'}
          </button>
          <button
            onClick={() => handleSendMessage(i18n.language === 'bn' ? 'মাসিক পেমেন্ট শিডিউল করো' : 'Schedule a monthly payment')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            📅 {i18n.language === 'bn' ? 'অটো শিডিউল' : 'Auto Schedule'}
          </button>
          {user?.accountType === 'CHILD' ? (
            <button
              onClick={() => handleSendMessage(i18n.language === 'bn' ? 'আমার দৈনিক খরচের লিমিট কত?' : 'What is my daily spending limit?')}
              className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              📊 {i18n.language === 'bn' ? 'দৈনিক লিমিট' : 'Daily Limit'}
            </button>
          ) : (
            <button
              onClick={() => handleSendMessage(i18n.language === 'bn' ? 'গার্ডিয়ান মোড কন্ট্রোল দেখাও' : 'Show Guardian Mode controls')}
              className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              🛡️ {i18n.language === 'bn' ? 'গার্ডিয়ান মোড' : 'Guardian Mode'}
            </button>
          )}
        </div>
      </div>

        {/* Input Bar */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          {/* Voice Input Button */}
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-full transition-all ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={isListening ? 'শোনা হচ্ছে... থামুন' : 'ভয়েস কমান্ড বলুন (Web Speech API)'}
            aria-label="Voice input"
          >
            {isListening ? <IoMic className="w-5 h-5 text-white" /> : <IoMicOutline className="w-5 h-5 text-brand-blue dark:text-brand-yellow" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isListening
                ? (i18n.language === 'bn' ? 'শুনছি... বলুন...' : 'Listening... Speak now...')
                : (i18n.language === 'bn'
                    ? 'লিখুন বা বলুন (যেমন: সুমিকে ৫০০ পাঠাও)...'
                    : 'Type or speak a command (e.g., send 500)...')
            }
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue dark:focus:ring-brand-yellow"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || loading}
            className="p-2.5 rounded-full bg-brand-yellow text-slate-900 hover:bg-brand-yellow-hover disabled:opacity-40 transition-all shadow-sm"
            aria-label="Send message"
          >
            <IoSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgentModal;
