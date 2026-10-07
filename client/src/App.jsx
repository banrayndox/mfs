import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FrameWrapper } from './components/layout/FrameWrapper.jsx';
import { RealtimeToastBanner } from './components/ui/RealtimeToastBanner.jsx';
import { BrandMark } from './components/ui/BrandMark.jsx';

import { Header } from './components/layout/Header.jsx';
import { BottomNav } from './components/layout/BottomNav.jsx';
import { Home } from './pages/Home.jsx';
import { Account } from './pages/Account.jsx';
import { History } from './pages/History.jsx';
import { More } from './pages/More.jsx';

// Modals
import { AgentModal } from './components/agent/AgentModal.jsx';
import { SendMoneyModal } from './components/modals/SendMoneyModal.jsx';
import { CashOutModal } from './components/modals/CashOutModal.jsx';
import { AuthModal } from './components/modals/AuthModal.jsx';
import { AgentDashboardModal } from './components/modals/AgentDashboardModal.jsx';
import { RechargeModal } from './components/modals/RechargeModal.jsx';
import { PayBillModal } from './components/modals/PayBillModal.jsx';
import { AddMoneyModal } from './components/modals/AddMoneyModal.jsx';
import { SavingsModal } from './components/modals/SavingsModal.jsx';
import { RequestMoneyModal } from './components/modals/RequestMoneyModal.jsx';
import { CheckMessageModal } from './components/modals/CheckMessageModal.jsx';
import { GuardianModal } from './components/modals/GuardianModal.jsx';
import { ScheduledRulesModal } from './components/modals/ScheduledRulesModal.jsx';
import { NotificationsModal } from './components/modals/NotificationsModal.jsx';
import { ChangePinModal } from './components/modals/ChangePinModal.jsx';

import { GuestAuthScreen } from './components/auth/GuestAuthScreen.jsx';

// Stores
import { useThemeStore } from './stores/themeStore.js';
import { useSystemStore } from './stores/systemStore.js';
import { useAuthStore } from './stores/authStore.js';
import { useSocket } from './hooks/useSocket.js';

export function App() {
  useSocket();
  const [activeTab, setActiveTab] = useState('home');
  const [authChecked, setAuthChecked] = useState(false);

  // Modal states
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [sendParams, setSendParams] = useState({ recipient: '', amount: '' });
  const [isCashOutOpen, setIsCashOutOpen] = useState(false);
  const [cashOutParams, setCashOutParams] = useState({ agentPhone: '', amount: '' });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAgentDashboardOpen, setIsAgentDashboardOpen] = useState(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [rechargeParams, setRechargeParams] = useState({ phone: '', operator: '', amount: '' });
  const [isPayBillOpen, setIsPayBillOpen] = useState(false);
  const [payBillParams, setPayBillParams] = useState({ biller: 'DPDC', amount: '' });
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [isSavingsOpen, setIsSavingsOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestMode, setRequestMode] = useState('individual');
  const [requestParams, setRequestParams] = useState({ phone: '', amount: '', description: '' });
  const [isCheckMessageOpen, setIsCheckMessageOpen] = useState(false);
  const [isGuardianOpen, setIsGuardianOpen] = useState(false);
  const [guardianParams, setGuardianParams] = useState({ childPhone: '', childName: '', dailyLimit: '' });
  const [isScheduledRulesOpen, setIsScheduledRulesOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  const { initTheme } = useThemeStore();
  const { setMockAi } = useSystemStore();
  const { user, setUser, logout } = useAuthStore();

  // Global Copilot app-control event listeners
  useEffect(() => {
    const handleNav = (e) => {
      const { path } = e.detail || {};
      if (path === '/history') setActiveTab('history');
      else if (path === '/account') setActiveTab('account');
      else if (path === '/more') setActiveTab('more');
      else if (path === '/home' || path === '/') setActiveTab('home');

      if (e.detail?.subview === 'savings') {
        setIsSavingsOpen(true);
      } else if (e.detail?.subview === 'guardian' || path === '/guardian') {
        setIsGuardianOpen(true);
      }
    };

    const handleOpenModal = (e) => {
      const { modal, prefill = {} } = e.detail || {};
      if (modal === 'change_pin') {
        setIsChangePinOpen(true);
      } else if (modal === 'savings') {
        setIsSavingsOpen(true);
      } else if (modal === 'send' || modal === 'send_money') {
        setSendParams({
          recipient: prefill.recipient || '',
          amount: prefill.amount ? String(prefill.amount) : '',
        });
        setIsSendOpen(true);
      } else if (modal === 'recharge' || modal === 'mobile_recharge') {
        setRechargeParams({
          phone: prefill.phone || '',
          operator: prefill.operator || '',
          amount: prefill.amount ? String(prefill.amount) : '',
        });
        setIsRechargeOpen(true);
      } else if (modal === 'cashout' || modal === 'cash_out') {
        setCashOutParams({
          agentPhone: prefill.agentPhone || '',
          amount: prefill.amount ? String(prefill.amount) : '',
        });
        setIsCashOutOpen(true);
      } else if (modal === 'paybill' || modal === 'pay_bill') {
        setPayBillParams({
          biller: prefill.biller || 'DPDC',
          amount: prefill.amount ? String(prefill.amount) : '',
        });
        setIsPayBillOpen(true);
      } else if (modal === 'guardian' || modal === 'guardian_mode') {
        setGuardianParams({
          childPhone: prefill.childPhone || '',
          childName: prefill.childName || '',
          dailyLimit: prefill.dailyLimit ? String(prefill.dailyLimit) : '',
        });
        setIsGuardianOpen(true);
      } else if (modal === 'request' || modal === 'request_money') {
        setRequestMode('individual');
        setRequestParams({
          phone: prefill.fromPhone || prefill.phone || '',
          amount: prefill.amount ? String(prefill.amount) : '',
          description: prefill.note || prefill.description || '',
        });
        setIsRequestOpen(true);
      } else if (modal === 'group_bill' || modal === 'group_split') {
        setRequestMode('group');
        setIsRequestOpen(true);
      } else if (modal === 'check_message') {
        setIsCheckMessageOpen(true);
      } else if (modal === 'rules' || modal === 'scheduled') {
        setIsScheduledRulesOpen(true);
      } else if (modal === 'add_money') {
        setIsAddMoneyOpen(true);
      }
    };

    window.addEventListener('mfs:navigate', handleNav);
    window.addEventListener('mfs:open_modal', handleOpenModal);
    return () => {
      window.removeEventListener('mfs:navigate', handleNav);
      window.removeEventListener('mfs:open_modal', handleOpenModal);
    };
  }, []);

  const fetchUserProfile = async () => {
    const token = localStorage.getItem('guardian_token');

    if (!token) {
      logout();
      setAuthChecked(true);
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      const res = await axios.get('/api/auth/me');
      setUser({
        ...res.data.user,
        balancePoisha: res.data.wallet.balancePoisha,
      });
    } catch (e) {
      // If token expired or invalid, clear and return to guest mode
      localStorage.removeItem('guardian_token');
      delete axios.defaults.headers.common['Authorization'];
      logout();
    } finally {
      setAuthChecked(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('guardian_token');
    delete axios.defaults.headers.common['Authorization'];
    logout();
    if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
      window.history.replaceState({}, '', '/');
    }
  };

  useEffect(() => {
    initTheme();
    fetchUserProfile();

    // Query backend health to check mock vs live AI mode
    axios
      .get('/api/health')
      .then((res) => {
        if (res.data?.ai?.mockMode !== undefined) {
          setMockAi(res.data.ai.mockMode);
        }
      })
      .catch(() => {
        setMockAi(true);
      });
  }, [initTheme, setMockAi]);

  // Handle Home 4-column services
  const handleSelectService = (serviceId) => {
    switch (serviceId) {
      case 'send':
      case 'transfer':
        setIsSendOpen(true);
        break;
      case 'recharge':
        setIsRechargeOpen(true);
        break;
      case 'cashout':
        setIsCashOutOpen(true);
        break;
      case 'paybill':
        setPayBillParams({ biller: 'DPDC', amount: '' });
        setIsPayBillOpen(true);
        break;
      case 'paybill_dpdc':
        setPayBillParams({ biller: 'DPDC', amount: '1450' });
        setIsPayBillOpen(true);
        break;
      case 'addmoney':
        setIsAddMoneyOpen(true);
        break;
      case 'savings':
        setIsSavingsOpen(true);
        break;
      case 'request':
        setRequestMode('individual');
        setIsRequestOpen(true);
        break;
      case 'payment':
        setPayBillParams({ biller: 'DESCO', amount: '' });
        setIsPayBillOpen(true);
        break;
      case 'agent_dashboard':
        setIsAgentDashboardOpen(true);
        break;
      default:
        console.log('Selected service:', serviceId);
    }
  };

  // Handle Safety & AI items
  const handleSelectSafety = (safetyId) => {
    switch (safetyId) {
      case 'guardian':
        if (user?.accountType !== 'CHILD') {
          setIsGuardianOpen(true);
        }
        break;
      case 'checkMessage':
        setIsCheckMessageOpen(true);
        break;
      case 'reminders':
      case 'scheduledRules':
        setIsScheduledRulesOpen(true);
        break;
      case 'aiAssistant':
        setIsAgentOpen(true);
        break;
      case 'groupBill':
        setRequestMode('group');
        setIsRequestOpen(true);
        break;
      default:
        console.log('Selected safety item:', safetyId);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Home
            onSelectService={handleSelectService}
            onSelectSafety={handleSelectSafety}
            onOpenAgent={() => setIsAgentOpen(true)}
          />
        );
      case 'account':
        return <Account onOpenAuth={() => setIsAuthOpen(true)} onLogout={handleLogout} />;
      case 'history':
        return <History />;
      case 'more':
        return (
          <More
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenAgentDashboard={() => setIsAgentDashboardOpen(true)}
            onLogout={handleLogout}
          />
        );
      default:
        return <Home onOpenAgent={() => setIsAgentOpen(true)} />;
    }
  };

  if (!authChecked) {
    return (
      <FrameWrapper>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <BrandMark size="lg" showWordmark={true} className="animate-pulse mb-4" />
          <p className="text-xs font-bold text-slate-400">Upay powered by AI</p>
        </div>
      </FrameWrapper>
    );
  }

  // GUEST MODE: If unauthenticated, render ONLY GuestAuthScreen inside FrameWrapper
  if (!user) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/' && window.location.pathname !== '/login') {
      window.history.replaceState({}, '', '/');
    }
    return (
      <FrameWrapper>
        <GuestAuthScreen onLoginSuccess={fetchUserProfile} />
      </FrameWrapper>
    );
  }

  return (
    <FrameWrapper>
      {/* Global Realtime Toast Banner */}
      <RealtimeToastBanner />

      {/* Header with brand mark, balance pill, notifications, quick switch & logout */}
      <Header
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAgentDashboard={() => setIsAgentDashboardOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col">{renderActiveTab()}</main>

      {/* Bottom Navigation with 5 tabs and elevated circular AI agent button */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenAgent={() => setIsAgentOpen(true)}
      />

      {/* 1. AI Assistant Copilot Modal */}
      <AgentModal isOpen={isAgentOpen} onClose={() => setIsAgentOpen(false)} />

      {/* 2. Send Money Modal */}
      <SendMoneyModal
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        onSuccess={fetchUserProfile}
        initialRecipient={sendParams.recipient}
        initialAmount={sendParams.amount}
      />

      {/* 3. Cash Out Modal */}
      <CashOutModal
        isOpen={isCashOutOpen}
        onClose={() => setIsCashOutOpen(false)}
        onSuccess={fetchUserProfile}
        initialAgentPhone={cashOutParams.agentPhone}
        initialAmount={cashOutParams.amount}
      />

      {/* 4. Mobile Recharge Modal */}
      <RechargeModal
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
        onSuccess={fetchUserProfile}
        initialPhone={rechargeParams.phone}
        initialOperator={rechargeParams.operator}
        initialAmount={rechargeParams.amount}
      />

      {/* 5. Pay Bill Modal */}
      <PayBillModal
        isOpen={isPayBillOpen}
        onClose={() => setIsPayBillOpen(false)}
        onSuccess={fetchUserProfile}
        initialBiller={payBillParams.biller}
        initialAmount={payBillParams.amount}
      />

      {/* 6. Add Money Modal */}
      <AddMoneyModal
        isOpen={isAddMoneyOpen}
        onClose={() => setIsAddMoneyOpen(false)}
        onSuccess={fetchUserProfile}
      />

      {/* 7. Savings Modal */}
      <SavingsModal
        isOpen={isSavingsOpen}
        onClose={() => setIsSavingsOpen(false)}
      />

      {/* 8. Request Money & Group Split Modal */}
      <RequestMoneyModal
        isOpen={isRequestOpen}
        onClose={() => setIsRequestOpen(false)}
        defaultMode={requestMode}
        onSuccess={fetchUserProfile}
        initialPhone={requestParams.phone}
        initialAmount={requestParams.amount}
        initialDescription={requestParams.description}
      />

      {/* 9. Check Message (Scam Shield) Modal */}
      <CheckMessageModal
        isOpen={isCheckMessageOpen}
        onClose={() => setIsCheckMessageOpen(false)}
      />

      {/* 10. Guardian Mode Modal */}
      <GuardianModal
        isOpen={isGuardianOpen}
        onClose={() => setIsGuardianOpen(false)}
        initialChildPhone={guardianParams.childPhone}
        initialChildName={guardianParams.childName}
        initialDailyLimit={guardianParams.dailyLimit}
      />

      {/* 11. Scheduled & Conditional Rules Modal */}
      <ScheduledRulesModal
        isOpen={isScheduledRulesOpen}
        onClose={() => setIsScheduledRulesOpen(false)}
      />

      {/* 12. Auth & Switch Account Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* 13. Agent Dashboard Modal */}
      <AgentDashboardModal
        isOpen={isAgentDashboardOpen}
        onClose={() => setIsAgentDashboardOpen(false)}
      />

      {/* 14. Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* 15. Change PIN Modal */}
      <ChangePinModal
        isOpen={isChangePinOpen}
        onClose={() => setIsChangePinOpen(false)}
      />
    </FrameWrapper>
  );
}

export default App;
