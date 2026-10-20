import React, { useState } from 'react';
import { UserSession } from '../types/claim';
import { DynamicCycleInfo } from '../utils/dateCycle';
import { DEFAULT_USERS } from '../services/claimStore';
import { TamilNaduLogo } from './TamilNaduLogo';
import { MaterialIcon } from './MaterialIcon';
import { HeaderWaveBackground } from './HeaderWaveBackground';
import { 
  Building2, 
  Shield, 
  School as SchoolIcon
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserSession;
  cycleInfo: DynamicCycleInfo;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUserChange: (user: UserSession) => void;
  onOpenSimulator: () => void;
  onResetData: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  cycleInfo,
  activeTab,
  onTabChange,
  onUserChange,
  onOpenSimulator,
  onResetData,
  onLogout,
}) => {
  // Supabase Tamil Nadu Logo URLs from portal_assets bucket (NM.png)
  const tnLogoUrl = 'https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/NM.png';
  const tnLogoFallback = '/NM.png';

  // Compute previous month, current month and year automatically
  const now = new Date();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthName = prevMonthDate.toLocaleString('default', { month: 'long' });
  const previousMonthYear = prevMonthDate.getFullYear();
  const claimMonthDisplay = `${previousMonthName} ${previousMonthYear}`;

  // Handle Logout
  const handleLogoutClick = () => {
    onLogout();
  };

  // Determine current active role tab mapping
  // Tab 1: 'home' (dashboard)
  // Tab 2: 'claim_action' (school claim entry OR block/district verification)
  // Tab 3: 'view_previous' (archive)
  const isHomeActive = activeTab === 'dashboard';
  const isClaimActive = activeTab === 'claim_action' || activeTab === 'verification';
  const isArchiveActive = activeTab === 'archive';

  return (
    // Frozen Header & Sub-Header Container (Sticky Top)
    <div className="sticky top-0 z-40 w-full shadow-2xl select-none">
      {/* Main Header - Deep Royal Navy with Luminous Cyan/Electric-Blue Waves like attached image */}
      <header className="relative bg-[#020b44] text-white shadow-xl overflow-hidden border-b border-sky-400/25">
        {/* Vector Harmonic Blue Wave Ribbon Background (Matches az.jpg) */}
        <HeaderWaveBackground />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-4">
            
            {/* Left Side: Tamil Nadu Government Logo & Official 3 Titles */}
            <div className="flex items-center gap-3.5 shrink-0">
              <div className="w-13 h-13 sm:w-15 sm:h-15 flex items-center justify-center relative shrink-0">
                {/* Luminous cyan-white glow halo around logo perimeter */}
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-md pointer-events-none" />
                <div className="absolute inset-1 rounded-full bg-white/30 blur-xs pointer-events-none" />
                <TamilNaduLogo className="w-full h-full object-contain select-none relative z-10 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
              </div>

              {/* Three Titles in perfect alignment */}
              <div className="flex flex-col justify-center">
                <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] leading-tight">
                  School Education department
                </h1>
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-sky-200 drop-shadow-xs leading-tight mt-0.5">
                  samagra Shiksha Vellore district
                </h2>
                <h3 className="text-xs sm:text-sm font-medium text-blue-100/90 leading-tight mt-0.5">
                  transport and escort facility - monthly claim - for the month of{' '}
                  <span className="font-extrabold text-amber-300 underline underline-offset-2 decoration-amber-400/60 drop-shadow-xs">
                    {claimMonthDisplay}
                  </span>
                </h3>
              </div>
            </div>

            {/* Right Side: School / Block / District Profile Badge */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-blue-950/65 backdrop-blur-md border border-sky-400/35 shadow-inner">
                <div className="w-9 h-9 rounded-full bg-blue-600/90 border border-sky-300/40 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/30">
                  {currentUser.role === 'SCHOOL' ? (
                    <SchoolIcon className="w-5 h-5 text-sky-100" />
                  ) : currentUser.role === 'BLOCK' ? (
                    <Building2 className="w-5 h-5 text-sky-100" />
                  ) : (
                    <Shield className="w-5 h-5 text-sky-100" />
                  )}
                </div>

                <div className="text-left leading-tight pr-1">
                  {currentUser.role === 'SCHOOL' ? (
                    <>
                      <div className="text-sm sm:text-base font-bold text-white truncate max-w-[190px] sm:max-w-[240px]">
                        {currentUser.schoolName || currentUser.name || 'PUPS MELARASAMBUT'}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-sky-200 truncate max-w-[190px] sm:max-w-[240px]">
                        {currentUser.blockName ? `${currentUser.blockName} Block` : 'ANAICUT Block'}
                      </div>
                    </>
                  ) : currentUser.role === 'BLOCK' ? (
                    <>
                      <div className="text-sm sm:text-base font-bold text-white truncate max-w-[190px] sm:max-w-[240px]">
                        {currentUser.blockName || currentUser.name || 'ANAICUT'}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-sky-200">
                        Vellore district
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm sm:text-base font-bold text-white">
                        DPO, Vellore district
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-sky-200">
                        Chief Educational Office
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Reset Data */}
              <button
                onClick={onResetData}
                title="Reset Demo Data"
                className="p-2 text-sky-200 hover:text-white bg-blue-950/60 hover:bg-blue-900/80 backdrop-blur-md border border-sky-400/30 rounded-full transition-all shadow-xs cursor-pointer"
              >
                <MaterialIcon name="refresh" className="text-base" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Sub-Header Bar (Frozen with Header): Milk White with Glassmorphism for School, Royal Deep Blue for Others */}
      <div className={`backdrop-blur-2xl border-b shadow-md transition-all duration-300 px-4 sm:px-6 lg:px-8 ${
        currentUser.role === 'SCHOOL'
          ? 'bg-[#fffdf9]/90 border-orange-200/70 text-slate-800 shadow-slate-200/40'
          : 'bg-[#020b42]/95 border-sky-500/30 text-sky-100 shadow-md shadow-blue-950/40'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 py-2">
          
          {/* Left Position: Bold Admin Portal Name based on user */}
          <div className={`flex items-center gap-2.5 shrink-0 ${
            currentUser.role === 'SCHOOL'
              ? 'px-3.5 py-1.5 rounded-2xl bg-white/85 backdrop-blur-md border border-orange-200/80 shadow-xs'
              : ''
          }`}>
            <span className={`w-3 h-3 rounded-full animate-pulse shrink-0 ${
              currentUser.role === 'SCHOOL'
                ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]'
                : 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]'
            }`} />
            <h2 className={`text-sm sm:text-base tracking-wide whitespace-nowrap drop-shadow-xs ${
              currentUser.role === 'SCHOOL'
                ? 'text-orange-500 font-black'
                : 'text-white font-extrabold'
            }`}>
              {currentUser.role === 'SCHOOL'
                ? 'School admin portal'
                : currentUser.role === 'BLOCK'
                ? 'Block admin portal'
                : 'District admin portal'}
            </h2>
          </div>

          {/* Same Row Navigation Bar: Three Tabs with Underline Enlarge/Minimize Animation */}
          <nav className="flex items-center gap-2 sm:gap-5 overflow-x-auto no-scrollbar">
            
            {/* Tab 1: Home */}
            <button
              onClick={() => onTabChange('dashboard')}
              className="group relative py-2.5 px-3.5 text-sm sm:text-base font-bold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer"
            >
              <MaterialIcon name="home" className={`text-base transition-colors ${
                currentUser.role === 'SCHOOL'
                  ? isHomeActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500'
                  : isHomeActive ? 'text-sky-300' : 'text-sky-300/70 group-hover:text-white'
              }`} />
              <span className={
                currentUser.role === 'SCHOOL'
                  ? isHomeActive ? 'text-orange-600 font-extrabold' : 'text-slate-700 group-hover:text-orange-600'
                  : isHomeActive ? 'text-white font-extrabold' : 'text-sky-200/85 group-hover:text-white'
              }>
                Home
              </span>

              {/* Underline Enlarge / Minimize Animation */}
              <span
                className={`absolute bottom-0 left-0 w-full h-[3px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isHomeActive
                    ? currentUser.role === 'SCHOOL'
                      ? 'scale-x-100 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]'
                      : 'scale-x-100 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]'
                    : currentUser.role === 'SCHOOL'
                      ? 'scale-x-0 group-hover:scale-x-100 bg-orange-400/80'
                      : 'scale-x-0 group-hover:scale-x-100 bg-sky-400/80'
                }`}
                style={{ transformOrigin: 'center' }}
              />
            </button>

            {/* Tab 2: Claim Entry Form (School) OR Verification (Block/District) */}
            <button
              onClick={() => onTabChange(currentUser.role === 'SCHOOL' ? 'claim_action' : 'verification')}
              className="group relative py-2.5 px-3.5 text-sm sm:text-base font-bold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer"
            >
              <MaterialIcon name="assignment" className={`text-base transition-colors ${
                currentUser.role === 'SCHOOL'
                  ? isClaimActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500'
                  : isClaimActive ? 'text-sky-300' : 'text-sky-300/70 group-hover:text-white'
              }`} />
              <span className={
                currentUser.role === 'SCHOOL'
                  ? isClaimActive ? 'text-orange-600 font-extrabold' : 'text-slate-700 group-hover:text-orange-600'
                  : isClaimActive ? 'text-white font-extrabold' : 'text-sky-200/85 group-hover:text-white'
              }>
                {currentUser.role === 'SCHOOL'
                  ? 'Claim Entry Form'
                  : `Transport / Escort Claim verification for the month of ${previousMonthName}`}
              </span>

              {/* Underline Enlarge / Minimize Animation */}
              <span
                className={`absolute bottom-0 left-0 w-full h-[3px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isClaimActive
                    ? currentUser.role === 'SCHOOL'
                      ? 'scale-x-100 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]'
                      : 'scale-x-100 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]'
                    : currentUser.role === 'SCHOOL'
                      ? 'scale-x-0 group-hover:scale-x-100 bg-orange-400/80'
                      : 'scale-x-0 group-hover:scale-x-100 bg-sky-400/80'
                }`}
                style={{ transformOrigin: 'center' }}
              />
            </button>

            {/* Tab 3: Previous month claim */}
            <button
              onClick={() => onTabChange('archive')}
              className="group relative py-2.5 px-3.5 text-sm sm:text-base font-bold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer"
            >
              <MaterialIcon name="history" className={`text-base transition-colors ${
                currentUser.role === 'SCHOOL'
                  ? isArchiveActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500'
                  : isArchiveActive ? 'text-sky-300' : 'text-sky-300/70 group-hover:text-white'
              }`} />
              <span className={
                currentUser.role === 'SCHOOL'
                  ? isArchiveActive ? 'text-orange-600 font-extrabold' : 'text-slate-700 group-hover:text-orange-600'
                  : isArchiveActive ? 'text-white font-extrabold' : 'text-sky-200/85 group-hover:text-white'
              }>
                Previous month claim
              </span>

              {/* Underline Enlarge / Minimize Animation */}
              <span
                className={`absolute bottom-0 left-0 w-full h-[3px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isArchiveActive
                    ? currentUser.role === 'SCHOOL'
                      ? 'scale-x-100 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]'
                      : 'scale-x-100 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]'
                    : currentUser.role === 'SCHOOL'
                      ? 'scale-x-0 group-hover:scale-x-100 bg-orange-400/80'
                      : 'scale-x-0 group-hover:scale-x-100 bg-sky-400/80'
                }`}
                style={{ transformOrigin: 'center' }}
              />
            </button>

          </nav>

          {/* Right Side: Ruby Red Logout Button with Material Icon */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLogoutClick}
              className="px-4 py-2 rounded-full font-bold text-sm text-white bg-gradient-to-r from-rose-700 via-red-600 to-rose-800 hover:from-rose-600 hover:to-red-700 active:scale-95 transition-all duration-200 shadow-md shadow-red-950/40 flex items-center gap-2 border border-rose-400/30 cursor-pointer"
              title="Logout from system"
            >
              <MaterialIcon name="logout" className="text-base" />
              <span>Logout</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
