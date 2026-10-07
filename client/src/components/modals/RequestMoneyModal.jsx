import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  IoCloseOutline,
  IoHandRightOutline,
  IoPeopleOutline,
  IoLockClosedOutline,
  IoCheckmarkCircleOutline,
  IoHourglassOutline,
  IoRefreshOutline,
  IoAddOutline,
  IoTrashOutline,
  IoCheckmarkCircle,
  IoAlertCircleOutline,
} from 'react-icons/io5';
import {
  GroupBillColorIcon,
  RequestMoneyColorIcon,
  StorefrontColorIcon,
  CashOutColorIcon,
  ProfileColorIcon,
  CheckmarkSuccessColorIcon,
} from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function RequestMoneyModal({
  isOpen,
  onClose,
  defaultMode = 'individual',
  onSuccess,
  initialPhone = '',
  initialAmount = '',
  initialDescription = '',
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [tab, setTab] = useState(defaultMode); // 'individual' | 'group' | 'incoming'

  // Individual mode state
  const [targetPhone, setTargetPhone] = useState(initialPhone || '');
  const [targetValidation, setTargetValidation] = useState({ status: 'idle', name: '', message: '' });

  // Common amount & description
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [description, setDescription] = useState(initialDescription || '');

  // Group mode state: Destination
  const [destType, setDestType] = useState('merchant'); // 'merchant' | 'agent' | 'person'
  const [destPhone, setDestPhone] = useState('');
  const [destValidation, setDestValidation] = useState({ status: 'idle', name: '', message: '' });

  // Group mode state: Members & Split
  const [members, setMembers] = useState([
    { id: 1, phone: '', percent: '50', amount: '', validation: { status: 'idle', name: '', message: '' } },
    { id: 2, phone: '', percent: '50', amount: '', validation: { status: 'idle', name: '', message: '' } },
  ]);
  const [splitMethod, setSplitMethod] = useState('equal'); // 'equal' | 'percent' | 'manual'

  // Incoming requests & UI states
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Payment state
  const [payingRequestId, setPayingRequestId] = useState(null);
  const [pin, setPin] = useState('');
  const [payingLoading, setPayingLoading] = useState(false);

  const lookupTimeoutRef = useRef({});

  useEffect(() => {
    if (isOpen) {
      setTab(defaultMode);
      setSuccessMsg('');
      setError('');
      setPayingRequestId(null);
      setPin('');
      if (initialPhone) setTargetPhone(initialPhone);
      if (initialAmount) setAmount(String(initialAmount));
      if (initialDescription) setDescription(initialDescription);
      fetchRequests();
    }
  }, [isOpen, defaultMode, initialPhone, initialAmount, initialDescription]);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/requests');
      setIncomingRequests(res.data.requests || []);
    } catch (e) {
      console.error('Failed to fetch money requests', e);
    }
  };

  // Realtime Socket.IO group bill updates
  useEffect(() => {
    const handleGroupBillUpdate = (event) => {
      const updatedReq = event.detail;
      if (!updatedReq) return;
      setIncomingRequests((prev) => {
        const index = prev.findIndex((r) => r._id === updatedReq._id);
        if (index === -1) {
          return [updatedReq, ...prev];
        }
        const next = [...prev];
        next[index] = updatedReq;
        return next;
      });
    };

    window.addEventListener('mfs:group_bill:update', handleGroupBillUpdate);
    return () => {
      window.removeEventListener('mfs:group_bill:update', handleGroupBillUpdate);
    };
  }, []);

  // Helper for lookup pre-validation
  const checkAccount = async (phone, callback) => {
    const clean = phone.trim().replace(/^(\+88)/, '');
    if (!clean) {
      callback({ status: 'idle', name: '', message: '' });
      return;
    }
    if (clean.length < 11) {
      callback({ status: 'idle', name: '', message: '' });
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(clean)) {
      callback({
        status: 'invalid',
        name: '',
        message: i18n.language === 'bn' ? 'অবৈধ মোবাইল নম্বর' : 'Invalid mobile number',
      });
      return;
    }

    callback({ status: 'checking', name: '', message: i18n.language === 'bn' ? 'যাচাই হচ্ছে...' : 'Checking...' });

    try {
      const res = await axios.get(`/api/wallet/lookup-recipient/${clean}`);
      if (res.data?.success && res.data.recipient) {
        callback({
          status: 'valid',
          name: res.data.recipient.name,
          message: i18n.language === 'bn' ? 'নিবন্ধিত অ্যাকাউন্ট' : 'Registered Account',
        });
      } else {
        callback({
          status: 'unregistered',
          name: '',
          message: i18n.language === 'bn' ? 'অ্যাকাউন্ট পাওয়া যায়নি' : 'Account not registered',
        });
      }
    } catch (err) {
      callback({
        status: 'unregistered',
        name: '',
        message: i18n.language === 'bn' ? 'অ্যাকাউন্ট পাওয়া যায়নি' : 'Account not registered',
      });
    }
  };

  // Handle Target Phone (Individual)
  const handleTargetPhoneChange = (val) => {
    setTargetPhone(val);
    clearTimeout(lookupTimeoutRef.current['individual']);
    lookupTimeoutRef.current['individual'] = setTimeout(() => {
      checkAccount(val, setTargetValidation);
    }, 400);
  };

  // Handle Destination Phone (Group)
  const handleDestPhoneChange = (val) => {
    setDestPhone(val);
    clearTimeout(lookupTimeoutRef.current['dest']);
    lookupTimeoutRef.current['dest'] = setTimeout(() => {
      checkAccount(val, setDestValidation);
    }, 400);
  };

  // Member Management
  const handleAddMember = () => {
    setMembers((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        phone: '',
        percent: '',
        amount: '',
        validation: { status: 'idle', name: '', message: '' },
      },
    ]);
  };

  const handleRemoveMember = (id) => {
    if (members.length <= 1) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMemberPhoneChange = (id, val) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, phone: val } : m))
    );

    clearTimeout(lookupTimeoutRef.current[id]);
    lookupTimeoutRef.current[id] = setTimeout(() => {
      checkAccount(val, (validation) => {
        setMembers((prev) =>
          prev.map((m) => (m.id === id ? { ...m, validation } : m))
        );
      });
    }, 400);
  };

  const handleMemberPercentChange = (id, val) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, percent: val } : m))
    );
  };

  const handleMemberAmountChange = (id, val) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, amount: val } : m))
    );
  };

  if (!isOpen) return null;

  const bdtAmount = parseFloat(amount) || 0;

  // Calculation summaries for split preview
  const memberCount = Math.max(1, members.length);
  const equalPerPerson = bdtAmount > 0 ? (bdtAmount / memberCount).toFixed(2) : '0.00';

  const sumPercent = members.reduce((sum, m) => sum + (parseFloat(m.percent) || 0), 0);
  const sumFixed = members.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  // Form submission
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (bdtAmount <= 0) {
        throw new Error(i18n.language === 'bn' ? 'সঠিক টাকার পরিমাণ দিন' : 'Valid amount required');
      }

      let participants = [];

      if (tab === 'individual') {
        const cleanTarget = targetPhone.trim().replace(/^(\+88)/, '');
        if (!/^01[3-9]\d{8}$/.test(cleanTarget)) {
          throw new Error(i18n.language === 'bn' ? 'সঠিক ১১-সংখ্যার প্রাপক মোবাইল নম্বর দিন' : 'Valid 11-digit mobile required');
        }
        participants = [{ phone: cleanTarget, name: targetValidation.name || cleanTarget, amountPoisha: Math.round(bdtAmount * 100) }];

        await axios.post('/api/requests', {
          kind: 'individual',
          splitType: 'single',
          totalAmountPoisha: Math.round(bdtAmount * 100),
          participants,
          description: description.trim() || 'টাকার অনুরোধ',
        });

        setSuccessMsg(
          i18n.language === 'bn'
            ? `${targetPhone}-এর কাছে ৳${bdtAmount} টাকার অনুরোধ পাঠানো হয়েছে!`
            : `Money request of ৳${bdtAmount} sent to ${targetPhone}!`
        );
      } else {
        // Group Bill Validation
        const cleanDest = destPhone.trim().replace(/^(\+88)/, '');
        if (!/^01[3-9]\d{8}$/.test(cleanDest)) {
          throw new Error(i18n.language === 'bn' ? 'পেমেন্ট গন্তব্যের সঠিক ১১-সংখ্যার নম্বর দিন' : 'Valid 11-digit destination number required');
        }

        if (members.length === 0) {
          throw new Error(i18n.language === 'bn' ? 'কমপক্ষে একজন সদস্য প্রয়োজন' : 'At least one member required');
        }

        // Validate each member phone format
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          const cleanM = m.phone.trim().replace(/^(\+88)/, '');
          if (!/^01[3-9]\d{8}$/.test(cleanM)) {
            throw new Error(
              i18n.language === 'bn'
                ? `সদস্য ${i + 1}-এর মোবাইল নম্বর অবৈধ (${m.phone || 'খালি'})`
                : `Member ${i + 1} phone number is invalid (${m.phone || 'empty'})`
            );
          }
        }

        // Split Mode Validation & Participant Mapping
        if (splitMethod === 'percent') {
          if (Math.round(sumPercent) !== 100) {
            throw new Error(
              i18n.language === 'bn'
                ? `শতকরা হারের যোগফল ১০০% হতে হবে (বর্তমান: ${sumPercent}%)`
                : `Sum of percentages must equal 100% (currently: ${sumPercent}%)`
            );
          }
          participants = members.map((m) => {
            const p = parseFloat(m.percent) || 0;
            const share = Math.round((bdtAmount * p * 100) / 100);
            return {
              phone: m.phone.trim().replace(/^(\+88)/, ''),
              name: m.validation.name || m.phone,
              amountPoisha: share,
            };
          });
        } else if (splitMethod === 'manual') {
          if (Math.abs(sumFixed - bdtAmount) > 0.01) {
            throw new Error(
              i18n.language === 'bn'
                ? `সদস্যদের পরিমাণের যোগফল (৳${sumFixed}) মোট বিলের (৳${bdtAmount}) সমান হতে হবে`
                : `Sum of member amounts (৳${sumFixed}) must equal total bill (৳${bdtAmount})`
            );
          }
          participants = members.map((m) => ({
            phone: m.phone.trim().replace(/^(\+88)/, ''),
            name: m.validation.name || m.phone,
            amountPoisha: Math.round((parseFloat(m.amount) || 0) * 100),
          }));
        } else {
          // Equal split
          const sharePoisha = Math.round((bdtAmount * 100) / members.length);
          participants = members.map((m) => ({
            phone: m.phone.trim().replace(/^(\+88)/, ''),
            name: m.validation.name || m.phone,
            amountPoisha: sharePoisha,
          }));
        }

        const destLabel =
          destType === 'merchant'
            ? (i18n.language === 'bn' ? 'মার্চেন্ট' : 'Merchant')
            : destType === 'agent'
            ? (i18n.language === 'bn' ? 'এজেন্ট' : 'Agent')
            : (i18n.language === 'bn' ? 'ব্যক্তি' : 'Person');

        const destInfo = `${destLabel}: ${destValidation.name ? `${destValidation.name} - ` : ''}${cleanDest}`;

        await axios.post('/api/requests', {
          kind: 'group',
          splitType: splitMethod,
          totalAmountPoisha: Math.round(bdtAmount * 100),
          participants,
          merchantName: destInfo,
          description: description.trim() || (i18n.language === 'bn' ? 'গ্রুপ বিল স্প্লিট' : 'Group Bill Split'),
        });

        setSuccessMsg(
          i18n.language === 'bn'
            ? `৳${bdtAmount} টাকার গ্রুপ বিল সফলভাবে তৈরি হয়েছে!`
            : `Group Bill of ৳${bdtAmount} created successfully!`
        );
      }

      setAmount('');
      setDescription('');
      setTargetPhone('');
      setTargetValidation({ status: 'idle', name: '', message: '' });
      setDestPhone('');
      setDestValidation({ status: 'idle', name: '', message: '' });
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  // Pay share handler
  const handlePayShare = async (requestId) => {
    if (!/^\d{4}$/.test(pin)) {
      setError(i18n.language === 'bn' ? 'সঠিক ৪-সংখ্যার পিন নম্বর দিন' : 'Enter 4-digit PIN');
      return;
    }

    setPayingLoading(true);
    setError('');

    try {
      const stepRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash: `pay-request-${requestId}`,
      });

      const res = await axios.post(
        `/api/requests/${requestId}/pay`,
        {},
        {
          headers: {
            'x-step-up-token': stepRes.data.stepUpToken,
            'x-action-hash': `pay-request-${requestId}`,
          },
        }
      );

      setSuccessMsg(
        i18n.language === 'bn'
          ? `৳${(res.data.paidPoisha / 100).toFixed(2)} সফলভাবে পরিশোধিত হয়েছে!`
          : `৳${(res.data.paidPoisha / 100).toFixed(2)} paid successfully!`
      );
      setPayingRequestId(null);
      setPin('');
      fetchRequests();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'পেমেন্ট ব্যর্থ হয়েছে।');
    } finally {
      setPayingLoading(false);
    }
  };

  const cleanUserPhone = user?.phone?.trim()?.replace(/^(\+88)/, '') || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in select-none">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-modal p-4 sm:p-5 border border-slate-100 dark:border-slate-800 space-y-3.5 max-h-[90vh] flex flex-col no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {tab === 'group' ? (
              <GroupBillColorIcon className="w-8 h-8 shrink-0" />
            ) : (
              <RequestMoneyColorIcon className="w-8 h-8 shrink-0" />
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {tab === 'group'
                  ? (i18n.language === 'bn' ? 'গ্রুপ বিল স্প্লিট' : 'Group Bill Split')
                  : tab === 'incoming'
                  ? (i18n.language === 'bn' ? 'পেন্ডিং অনুরোধ তালিকা' : 'Pending Requests')
                  : (i18n.language === 'bn' ? 'টাকার অনুরোধ' : 'Request Money')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {i18n.language === 'bn'
                  ? 'বিল স্প্লিট করুন বা টাকা পরিশোধের অনুরোধ পাঠান'
                  : 'Split bills with groups or request money'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <IoCloseOutline className="w-6 h-6" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab('group');
              setSuccessMsg('');
              setError('');
              setPayingRequestId(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              tab === 'group'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {i18n.language === 'bn' ? 'গ্রুপ স্প্লিট' : 'Group Split'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('individual');
              setSuccessMsg('');
              setError('');
              setPayingRequestId(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              tab === 'individual'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {i18n.language === 'bn' ? 'একক রিকোয়েস্ট' : 'Single Request'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('incoming');
              setSuccessMsg('');
              setError('');
              setPayingRequestId(null);
              fetchRequests();
            }}
            className={`flex-1 py-2 rounded-xl transition-all relative ${
              tab === 'incoming'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {i18n.language === 'bn' ? 'পেন্ডিং' : 'Pending'} ({incomingRequests.length})
          </button>
        </div>

        {/* Feedback alerts */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900 shrink-0">
            <CheckmarkSuccessColorIcon className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 text-xs font-medium border border-rose-200 dark:border-rose-900 shrink-0 flex items-center gap-1.5">
            <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body content (scrollable with hidden scrollbar) */}
        <div
          className="flex-1 overflow-y-auto space-y-3 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tab === 'incoming' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {i18n.language === 'bn' ? `সর্বমোট ${incomingRequests.length} টি অনুরোধ` : `Total ${incomingRequests.length} requests`}
                </span>
                <button
                  type="button"
                  onClick={fetchRequests}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Reload"
                >
                  <IoRefreshOutline className="w-4 h-4" />
                </button>
              </div>

              {incomingRequests.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <IoHourglassOutline className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {i18n.language === 'bn' ? 'কোনো পেন্ডিং রিকোয়েস্ট নেই' : 'No pending requests'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {i18n.language === 'bn' ? 'গ্রুপ স্প্লিট বা নতুন রিকোয়েস্ট তৈরি করতে পাশের ট্যাবে যান।' : 'Switch tabs to create a group split or send a request.'}
                  </p>
                </div>
              ) : (
                incomingRequests.map((req) => {
                  const myParticipant = req.participants?.find(
                    (p) =>
                      (p.userId && p.userId.toString() === user?._id?.toString()) ||
                      p.phone === cleanUserPhone
                  );
                  const canPay =
                    req.status === 'open' &&
                    myParticipant &&
                    myParticipant.status === 'pending';

                  return (
                    <div
                      key={req._id}
                      className="p-3.5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-yellow/20 text-brand-blue dark:text-brand-yellow uppercase">
                              {req.kind === 'group' ? (i18n.language === 'bn' ? 'গ্রুপ স্প্লিট' : 'Group Split') : (i18n.language === 'bn' ? 'একক রিকোয়েস্ট' : 'Single')}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                req.status === 'closed'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {req.status === 'closed' ? (i18n.language === 'bn' ? 'সম্পন্ন' : 'Closed') : (i18n.language === 'bn' ? 'চলমান' : 'Open')}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                            {req.description || 'বিলের অংশীদারি'}
                          </p>
                          {req.merchantName && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              {req.merchantName}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                            ৳{(req.totalAmount / 100).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {i18n.language === 'bn' ? 'বাকি: ' : 'Rem: '}৳{(req.remainingAmount / 100).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Participant list preview */}
                      {req.participants && req.participants.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                          <div className="grid grid-cols-1 gap-1">
                            {req.participants.map((p, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800"
                              >
                                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                  {p.name || p.phone} {p.phone === cleanUserPhone ? '(আপনি)' : ''}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[11px]">
                                    ৳{(p.requestedAmount / 100).toFixed(2)}
                                  </span>
                                  {p.status === 'paid' ? (
                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                                      <IoCheckmarkCircleOutline className="w-3 h-3" />
                                      {i18n.language === 'bn' ? 'পরিশোধিত' : 'Paid'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-amber-600">
                                      {i18n.language === 'bn' ? 'বকেয়া' : 'Pending'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action to Pay Share */}
                      {canPay && (
                        <div className="pt-2">
                          {payingRequestId === req._id ? (
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-brand-yellow space-y-2">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {i18n.language === 'bn'
                                  ? `আপনার শেয়ার ৳${(myParticipant.requestedAmount / 100).toFixed(2)} পরিশোধ করতে ৪-সংখ্যার পিন দিন:`
                                  : `Enter 4-digit PIN to pay your share of ৳${(myParticipant.requestedAmount / 100).toFixed(2)}:`}
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  autoComplete="one-time-code"
                                  name="split-pay-pin"
                                  data-lpignore="true"
                                  data-1p-ignore="true"
                                  maxLength={4}
                                  value={pin}
                                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                  placeholder="PIN"
                                  className="w-20 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono tracking-widest text-center text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handlePayShare(req._id)}
                                  disabled={payingLoading || pin.length !== 4}
                                  className="flex-1 py-1.5 px-3 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-blue font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50 transition-all"
                                >
                                  <IoLockClosedOutline className="w-3.5 h-3.5" />
                                  <span>{payingLoading ? '...' : (i18n.language === 'bn' ? 'নিশ্চিত করুন' : 'Confirm')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayingRequestId(null);
                                    setPin('');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 text-xs"
                                >
                                  {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPayingRequestId(req._id);
                                setPin('');
                                setError('');
                              }}
                              className="w-full py-2 rounded-2xl bg-brand-yellow hover:bg-brand-yellow/90 text-brand-blue font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-soft"
                            >
                              <IoHandRightOutline className="w-4 h-4" />
                              <span>
                                {i18n.language === 'bn'
                                  ? `আমার শেয়ার পরিশোধ করুন (৳${(myParticipant.requestedAmount / 100).toFixed(2)})`
                                  : `Pay My Share (৳${(myParticipant.requestedAmount / 100).toFixed(2)})`}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : tab === 'individual' ? (
            /* Single Money Request Form */
            <form onSubmit={handleCreateRequest} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {i18n.language === 'bn' ? 'প্রাপকের মোবাইল নম্বর (Recipient Phone)' : 'Recipient Phone Number'}
                </label>
                <input
                  type="tel"
                  maxLength={11}
                  value={targetPhone}
                  onChange={(e) => handleTargetPhoneChange(e.target.value)}
                  placeholder="017XXXXXXXX"
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-brand-blue"
                />
                {/* Validation badge */}
                {targetValidation.status === 'valid' && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <IoCheckmarkCircle className="w-3.5 h-3.5" />
                    <span>{targetValidation.name} • {targetValidation.message}</span>
                  </p>
                )}
                {targetValidation.status === 'unregistered' && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <IoAlertCircleOutline className="w-3.5 h-3.5" />
                    <span>{targetValidation.message}</span>
                  </p>
                )}
                {targetValidation.status === 'invalid' && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <IoAlertCircleOutline className="w-3.5 h-3.5" />
                    <span>{targetValidation.message}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {i18n.language === 'bn' ? 'টাকার পরিমাণ (Amount in BDT)' : 'Amount (BDT)'}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {i18n.language === 'bn' ? 'বিবরণ / কারণ (Description / Note)' : 'Description / Note'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={i18n.language === 'bn' ? 'যেমন: খাবার খরচ, বই কেনা' : 'e.g. Lunch, Book purchase'}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-brand-blue"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !amount || !targetPhone}
                className="w-full py-3 rounded-2xl bg-brand-yellow hover:bg-brand-yellow/90 text-brand-blue font-bold transition-all shadow-soft disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
              >
                <IoHandRightOutline className="w-4 h-4" />
                <span>{loading ? 'প্রক্রিয়াধীন...' : (i18n.language === 'bn' ? 'টাকার অনুরোধ পাঠান' : 'Send Request')}</span>
              </button>
            </form>
          ) : (
            /* Overhauled Group Bill Form */
            <form onSubmit={handleCreateRequest} className="space-y-4">
              {/* STEP 1: Where will the payment go? */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-white block">
                  {i18n.language === 'bn' ? 'কোথায় টাকা যাবে?' : 'Where will the payment go?'}
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDestType('merchant')}
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      destType === 'merchant'
                        ? 'bg-brand-yellow text-slate-900 border-yellow-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <StorefrontColorIcon className="w-5 h-5" />
                    <span className="text-[10px] text-center leading-tight">
                      {i18n.language === 'bn' ? 'দোকান / মার্চেন্ট' : 'Merchant'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestType('agent')}
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      destType === 'agent'
                        ? 'bg-brand-yellow text-slate-900 border-yellow-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <CashOutColorIcon className="w-5 h-5" />
                    <span className="text-[10px] text-center leading-tight">
                      {i18n.language === 'bn' ? 'এজেন্ট' : 'Agent'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestType('person')}
                    className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      destType === 'person'
                        ? 'bg-brand-yellow text-slate-900 border-yellow-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <ProfileColorIcon className="w-5 h-5" />
                    <span className="text-[10px] text-center leading-tight">
                      {i18n.language === 'bn' ? 'ব্যক্তি / সেন্ড মানি' : 'Person'}
                    </span>
                  </button>
                </div>

                {/* STEP 2: Destination Number Input */}
                <div className="pt-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {destType === 'merchant'
                      ? (i18n.language === 'bn' ? 'মার্চেন্ট নম্বর (Merchant Number)' : 'Merchant Number')
                      : destType === 'agent'
                      ? (i18n.language === 'bn' ? 'এজেন্ট নম্বর (Agent Number)' : 'Agent Number')
                      : (i18n.language === 'bn' ? 'প্রাপক ব্যক্তি নম্বর (Recipient Number)' : 'Recipient Number')}
                  </label>
                  <input
                    type="tel"
                    maxLength={11}
                    value={destPhone}
                    onChange={(e) => handleDestPhoneChange(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-brand-blue"
                  />
                  {/* Status indicator */}
                  {destValidation.status === 'valid' && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <IoCheckmarkCircle className="w-3.5 h-3.5" />
                      <span>✓ {destValidation.message}: {destValidation.name}</span>
                    </p>
                  )}
                  {destValidation.status === 'unregistered' && (
                    <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                      <IoAlertCircleOutline className="w-3.5 h-3.5" />
                      <span>✕ {destValidation.message}</span>
                    </p>
                  )}
                  {destValidation.status === 'invalid' && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <IoAlertCircleOutline className="w-3.5 h-3.5" />
                      <span>✕ {destValidation.message}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* STEP 3: Total Amount */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {i18n.language === 'bn' ? 'সর্বমোট পরিমাণ (Total Amount in BDT)' : 'Total Amount (BDT)'}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  min="1"
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-brand-blue"
                />
              </div>

              {/* STEP 4: Group Members (Individual rows, no comma-separated input) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {i18n.language === 'bn' ? 'গ্রুপ সদস্যবৃন্দ (Group Members)' : 'Group Members'}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {members.length} {i18n.language === 'bn' ? 'জন' : 'members'}
                  </span>
                </div>

                <div className="space-y-2">
                  {members.map((member, idx) => (
                    <div
                      key={member.id}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {i18n.language === 'bn' ? `সদস্য ${idx + 1}` : `Member ${idx + 1}`}
                        </span>
                        {members.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove member"
                          >
                            <IoTrashOutline className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            type="tel"
                            maxLength={11}
                            value={member.phone}
                            onChange={(e) => handleMemberPhoneChange(member.id, e.target.value)}
                            placeholder="01XXXXXXXXX"
                            required
                            className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-brand-blue"
                          />
                        </div>

                        {splitMethod === 'percent' && (
                          <div className="w-20">
                            <input
                              type="number"
                              value={member.percent}
                              onChange={(e) => handleMemberPercentChange(member.id, e.target.value)}
                              placeholder="%"
                              min="0"
                              max="100"
                              required
                              className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs text-center font-bold"
                            />
                          </div>
                        )}

                        {splitMethod === 'manual' && (
                          <div className="w-24">
                            <input
                              type="number"
                              value={member.amount}
                              onChange={(e) => handleMemberAmountChange(member.id, e.target.value)}
                              placeholder="৳"
                              min="1"
                              required
                              className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs text-center font-bold"
                            />
                          </div>
                        )}
                      </div>

                      {/* Live member lookup badge */}
                      {member.validation?.status === 'valid' && (
                        <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <IoCheckmarkCircle className="w-3 h-3" />
                          <span>✓ {member.validation.name} ({i18n.language === 'bn' ? 'নিবন্ধিত' : 'Registered'})</span>
                        </p>
                      )}
                      {member.validation?.status === 'unregistered' && (
                        <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                          <IoAlertCircleOutline className="w-3 h-3" />
                          <span>✕ {member.validation.message}</span>
                        </p>
                      )}
                      {member.validation?.status === 'invalid' && (
                        <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                          <IoAlertCircleOutline className="w-3 h-3" />
                          <span>✕ {member.validation.message}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* + Add More Button */}
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-dashed border-slate-300 dark:border-slate-600"
                >
                  <IoAddOutline className="w-4 h-4" />
                  <span>{i18n.language === 'bn' ? '+ আরো সদস্য যোগ করুন' : '+ Add More'}</span>
                </button>
              </div>

              {/* STEP 5: Split Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {i18n.language === 'bn' ? 'স্প্লিট পদ্ধতি' : 'Split Method'}
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSplitMethod('equal')}
                    className={`flex-1 py-1.5 rounded-xl transition-all ${
                      splitMethod === 'equal'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                        : 'text-slate-500'
                    }`}
                  >
                    {i18n.language === 'bn' ? 'সমান ভাগ' : 'Equal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMethod('percent')}
                    className={`flex-1 py-1.5 rounded-xl transition-all ${
                      splitMethod === 'percent'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                        : 'text-slate-500'
                    }`}
                  >
                    {i18n.language === 'bn' ? 'শতাংশ (%)' : 'Percentage'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMethod('manual')}
                    className={`flex-1 py-1.5 rounded-xl transition-all ${
                      splitMethod === 'manual'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                        : 'text-slate-500'
                    }`}
                  >
                    {i18n.language === 'bn' ? 'নির্দিষ্ট (৳)' : 'Fixed Amount'}
                  </button>
                </div>

                {splitMethod === 'percent' && (
                  <p className={`text-[11px] font-semibold ${Math.round(sumPercent) === 100 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {i18n.language === 'bn' ? `মোট শতকরা: ${sumPercent}% / ১০০%` : `Total percentage: ${sumPercent}% / 100%`}
                  </p>
                )}

                {splitMethod === 'manual' && (
                  <p className={`text-[11px] font-semibold ${Math.abs(sumFixed - bdtAmount) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {i18n.language === 'bn' ? `মোট যোগফল: ৳${sumFixed} / ৳${bdtAmount}` : `Total sum: ৳${sumFixed} / ৳${bdtAmount}`}
                  </p>
                )}
              </div>

              {/* STEP 6: Contribution Breakdown Preview */}
              {bdtAmount > 0 && (
                <div className="p-3 bg-amber-50/70 dark:bg-slate-800/80 rounded-2xl border border-amber-200 dark:border-slate-700 text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-800 dark:text-white border-b border-amber-200/60 dark:border-slate-700 pb-1">
                    <span>{i18n.language === 'bn' ? 'গ্রুপ বিল হিসেব:' : 'Group Bill:'}</span>
                    <span>৳{bdtAmount.toFixed(2)}</span>
                  </div>

                  <div className="space-y-1 pt-0.5">
                    {members.map((m, idx) => {
                      let shareVal = '0.00';
                      if (splitMethod === 'equal') shareVal = equalPerPerson;
                      else if (splitMethod === 'percent') shareVal = ((bdtAmount * (parseFloat(m.percent) || 0)) / 100).toFixed(2);
                      else shareVal = (parseFloat(m.amount) || 0).toFixed(2);

                      return (
                        <div key={m.id} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-mono">
                            {m.validation?.name ? `${m.validation.name} (${m.phone || `সদস্য ${idx + 1}`})` : (m.phone || `সদস্য ${idx + 1}`)}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ৳{shareVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-1.5 border-t border-amber-200/60 dark:border-slate-700 text-[10px] text-slate-500">
                    <span className="font-semibold">{i18n.language === 'bn' ? 'টাকা জমা হবে: ' : 'Payment goes to: '}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {destType === 'merchant' ? 'দোকান' : destType === 'agent' ? 'এজেন্ট' : 'ব্যক্তি'}: {destValidation.name ? `${destValidation.name} • ` : ''}{destPhone || '—'}
                    </span>
                  </div>
                </div>
              )}

              {/* Description Input */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {i18n.language === 'bn' ? 'বিবরণ / কারণ' : 'Description / Note'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={i18n.language === 'bn' ? 'যেমন: রেস্তোরাঁ ডিনার, ফ্ল্যাট ভাড়া, পিকনিক' : 'e.g. Dinner, Flat rent, Tour'}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-brand-blue"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !amount || !destPhone || members.some((m) => !m.phone)}
                className="w-full py-3.5 rounded-2xl bg-brand-yellow hover:bg-brand-yellow/90 text-brand-blue font-bold transition-all shadow-soft disabled:opacity-50 text-xs flex items-center justify-center gap-2"
              >
                <IoPeopleOutline className="w-4 h-4" />
                <span>
                  {loading
                    ? (i18n.language === 'bn' ? 'প্রক্রিয়াধীন...' : 'Processing...')
                    : (i18n.language === 'bn' ? 'গ্রুপ বিল তৈরি করুন' : 'Create Group Bill')}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default RequestMoneyModal;
