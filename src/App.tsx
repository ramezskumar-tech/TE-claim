/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { claimStore, DEFAULT_USERS } from './services/claimStore';
import { Navbar } from './components/Navbar';
import { GlowingAlerts } from './components/GlowingAlerts';
import { SchoolView } from './components/SchoolView';
import { BlockView } from './components/BlockView';
import { DistrictView } from './components/DistrictView';
import { AuditLogView } from './components/AuditLogView';
import { ArchiveView } from './components/ArchiveView';
import { GasSupabaseViewer } from './components/GasSupabaseViewer';
import { MonthSimulatorModal } from './components/MonthSimulatorModal';
import { SignInCard } from './components/SignInCard';
import { TamilNaduLogo } from './components/TamilNaduLogo';
import { UserSession } from './types/claim';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [storeState, setStoreState] = useState(claimStore.getState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    claimStore.syncFromSupabase().catch(() => {});
    const unsubscribe = claimStore.subscribe(() => {
      setStoreState({ ...claimStore.getState() });
    });
    return unsubscribe;
  }, []);

  const handleRefresh = () => {
    setStoreState({ ...claimStore.getState() });
  };

  const handleUserChange = (newUser: UserSession) => {
    claimStore.setCurrentUser(newUser);
    if (newUser.role === 'SCHOOL' && activeTab === 'verification') {
      setActiveTab('dashboard');
    }
  };

  const handleLoginSuccess = (user: UserSession) => {
    claimStore.setCurrentUser(user);
    claimStore.syncFromSupabase().catch(() => {});
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      setIsLoggingOut(false);
      setIsLoggedIn(false);
    }, 2000);
  };

  const handleResetData = () => {
    if (window.confirm('Clear local cache and re-fetch real data from Supabase?')) {
      claimStore.resetAllDataToDefault();
      claimStore.syncFromSupabase().catch(() => {});
    }
  };

  const { currentUser, currentCycle, notifications } = storeState;

  // Render Sign In Card if not logged in
  if (!isLoggedIn) {
    return (
      <div 
        className="min-h-screen flex flex-col font-sans relative selection:bg-emerald-500 selection:text-white"
        style={{
          backgroundImage: "url('https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/bg_te.png'), url('/bg_te.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Centered Sign In Card without Header */}
        <div className="min-h-screen flex items-center justify-center p-4">
          <SignInCard onSignInSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`min-h-screen flex flex-col font-sans relative selection:bg-emerald-500 selection:text-white transition-all duration-300 ${
          isLoggingOut ? 'filter blur-md pointer-events-none select-none brightness-90' : ''
        } ${
          currentUser.role === 'SCHOOL' ? 'bg-[#fffdf9]/30 backdrop-blur-xs' : ''
        }`}
        style={{
          backgroundImage: "url('https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/app_background.png'), url('/app_background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* 3-Zone Top Navigation Contract */}
        <Navbar
          currentUser={currentUser}
          cycleInfo={currentCycle}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onUserChange={handleUserChange}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          onResetData={handleResetData}
          onLogout={handleLogout}
        />

        {/* Main Content Viewport with Windows 11 Acrylic Ambience */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Dynamic Status-Based Glowing Notifications */}
          <GlowingAlerts
            notifications={notifications}
            currentUser={currentUser}
            claimMonthOnlyName={currentCycle.claimMonthOnlyName}
            onDismiss={(id) => claimStore.dismissNotification(id)}
          />

        {/* View Router */}
        {activeTab === 'audit' ? (
          <AuditLogView />
        ) : activeTab === 'archive' ? (
          <ArchiveView currentUser={currentUser} cycleInfo={currentCycle} />
        ) : activeTab === 'code' ? (
          <GasSupabaseViewer />
        ) : currentUser.role === 'SCHOOL' ? (
          <SchoolView
            currentUser={currentUser}
            cycleInfo={currentCycle}
            activeSubTab={activeTab === 'claim_action' ? 'claim_action' : 'home'}
            onRefresh={handleRefresh}
            onNavigateTab={setActiveTab}
          />
        ) : currentUser.role === 'BLOCK' ? (
          <BlockView
            currentUser={currentUser}
            cycleInfo={currentCycle}
            activeSubTab={activeTab === 'verification' ? 'verification' : 'dashboard'}
            onNavigateTab={setActiveTab}
            onRefresh={handleRefresh}
          />
        ) : (
          <DistrictView
            currentUser={currentUser}
            cycleInfo={currentCycle}
            activeSubTab={activeTab === 'verification' ? 'verification' : 'dashboard'}
            onNavigateTab={setActiveTab}
            onRefresh={handleRefresh}
          />
        )}
      </main>

      {/* Dynamic Month Cycle Simulator Modal */}
      <MonthSimulatorModal
        isOpen={isSimulatorOpen}
        cycleInfo={currentCycle}
        onClose={() => setIsSimulatorOpen(false)}
        onRefresh={handleRefresh}
      />

      {/* Official Department Quiet Windows 11 Glass Footer */}
      <footer className="border-t border-white/10 bg-slate-950/70 backdrop-blur-xl py-4 mt-auto text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Samagra Shiksha, Vellore District</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>Department of School Education, Tamil Nadu</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-emerald-400 font-medium">
              Active Cycle: {currentCycle.claimMonthName}
            </span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <button
              onClick={() => setActiveTab('code')}
              className="text-emerald-300 hover:text-white font-semibold transition-colors"
            >
              GAS &amp; Supabase Integration Files
            </button>
          </div>
        </div>
      </footer>
    </div>

    {/* Full-Screen Blur Overlay & Centered Logout Message (Disappears after 2 seconds) */}
    {isLoggingOut && (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-200 p-4 select-none">
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 max-w-sm sm:max-w-md w-full text-center shadow-2xl border border-white/80 transform animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 stroke-[2.5]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">
            You are logged out successfully
          </h2>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Redirecting to Sign in...</span>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
