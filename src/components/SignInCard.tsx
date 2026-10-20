import React, { useState, useEffect, useRef } from 'react';
import { UserSession } from '../types/claim';
import { authenticateUserFromSupabase } from '../services/supabaseClient';
import { TamilNaduLogo } from './TamilNaduLogo';
import { MovingBorderLines } from './MovingBorderLines';
import { MaterialIcon } from './MaterialIcon';

interface SignInCardProps {
  onSignInSuccess: (user: UserSession) => void;
}

export const SignInCard: React.FC<SignInCardProps> = ({ onSignInSuccess }) => {
  // Ref for login card container (for animated moving edge lines)
  const cardRef = useRef<HTMLDivElement>(null);

  // Form State - Empty initially with no auto-fill
  const [userType, setUserType] = useState<'School' | 'Block' | 'District'>('School');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Focus tracking for floating label animation
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Loading & Popup Message State
  const [isLoading, setIsLoading] = useState(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);

  // Ref for dropdown outside click handling
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Background asset URLs from Supabase portal_assets bucket (bck.png / xcv.jpg)
  const supabaseCardBg = 'https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/bck.png';
  const supabaseCardBgAlt = 'https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/xcv.jpg';
  const [activeCardBg, setActiveCardBg] = useState<string>(supabaseCardBg);

  useEffect(() => {
    // Verify primary Supabase URL (bck.png), fall back to xcv.jpg or local asset
    const img = new Image();
    img.src = supabaseCardBg;
    img.onload = () => setActiveCardBg(supabaseCardBg);
    img.onerror = () => {
      const altImg = new Image();
      altImg.src = supabaseCardBgAlt;
      altImg.onload = () => setActiveCardBg(supabaseCardBgAlt);
      altImg.onerror = () => setActiveCardBg('/bck.png');
    };
  }, []);

  // Generate dynamic 5-character captcha code without auto-filling input
  const generateCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setCaptchaInput('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectUserType = (type: 'School' | 'Block' | 'District') => {
    setUserType(type);
    setIsDropdownOpen(false);
    setPopupMessage(null);
  };

  // Sign in verification with Supabase users table
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setPopupMessage(null);

    // 1. Check Captcha (user must type and match captcha code)
    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setPopupMessage('enter correct captcha');
      setTimeout(() => {
        setPopupMessage(null);
        generateCaptcha();
      }, 2000);
      return;
    }

    // 2. Validate that username and password are entered
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setPopupMessage('Please check username and password');
      setTimeout(() => {
        setPopupMessage(null);
      }, 2000);
      return;
    }

    // 3. Immediately 'Sign in' text disappears & circular spinner loads inside button
    setIsLoading(true);

    try {
      // Pull and check user from Supabase database `portal_users` table
      // Strictly verifying userType, username, and password!
      const authResult = await authenticateUserFromSupabase(cleanUsername, cleanPassword, userType);

      if (authResult.success && authResult.user) {
        // Sign in details are correct!
        // Immediately shows a message 'You are welcome to Transport / Escort claim portal'
        setShowWelcomeMessage(true);

        // After one second automatically disappear, then immediately fetch school/block/district admin page
        setTimeout(() => {
          setShowWelcomeMessage(false);
          setIsLoading(false);
          onSignInSuccess(authResult.user);
        }, 1000);
      } else {
        // Sign in details are NOT correct
        setIsLoading(false);
        setPopupMessage('Please check username and password');

        // After two seconds this popup message disappears then immediately Sign in fields are enabled
        setTimeout(() => {
          setPopupMessage(null);
        }, 2000);
      }
    } catch (err) {
      setIsLoading(false);
      setPopupMessage('Please check username and password');
      setTimeout(() => {
        setPopupMessage(null);
      }, 2000);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 relative">
      {/* 2-Second Temporary Popup Notification Modal/Banner */}
      {popupMessage && (
        <div className="fixed top-8 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-red-500/50 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-red-500/30">
            <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">!</span>
            <span className="tracking-wide">{popupMessage}</span>
          </div>
        </div>
      )}

      {/* 1-Second 'You are welcome' Success Splash Screen */}
      {showWelcomeMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 max-w-md mx-4 text-center shadow-2xl border border-emerald-500/40 transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner text-2xl font-bold">
              ✓
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5">
              Welcome Back!
            </h2>
            <p className="text-sm font-semibold text-emerald-800 tracking-wide">
              You are welcome to Transport / Escort claim portal
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Opening {userType} Admin Workspace...</span>
            </div>
          </div>
        </div>
      )}

      {/* Outer Card Wrapper with Light Soft 3D Shadow & Animated Moving Border Lines */}
      <div className="relative w-full max-w-4xl">
        {/* Soft, delicate light ambient glow for 3D elevation (clean & gentle, no dark shadow) */}
        <div className="absolute -inset-3 rounded-[2.6rem] bg-indigo-500/10 blur-2xl opacity-60 -z-10 transform translate-y-3 pointer-events-none" />
        <div className="absolute -inset-1 rounded-[2.2rem] bg-slate-300/25 blur-md opacity-50 -z-10 transform translate-y-1.5 pointer-events-none" />

        {/* Moving thin lines along card edge: gradient blue -> orange -> red, length half of breadth, clockwise pursuit */}
        <MovingBorderLines cardRef={cardRef} />

        {/* Outer Card: Clean rectangular box with rounded corners, light 3D shadow & crisp border */}
        <div
          ref={cardRef}
          className="w-full rounded-3xl overflow-hidden shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,1)] ring-1 ring-slate-200/80 border border-white/80 flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-300 ease-out bg-white"
        >
          {/* Background Layer: Authentic torn paper texture split 1/2 green on left and 1/2 white on right */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden bg-white">
            {/* Desktop: torn paper texture aligned so green occupies left 1/2 and pure white occupies right 1/2 */}
            <div
              className="hidden md:block absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url('${activeCardBg}')`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'left center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            {/* Mobile: top section green torn paper texture */}
            <div
              className="md:hidden absolute top-0 left-0 right-0 h-[280px] pointer-events-none"
              style={{
                backgroundImage: `url('${activeCardBg}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'left top',
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>

          {/* Left Side Panel (1/2 of card: Green side with Logo & Portal Title over torn-paper texture) */}
          <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center text-center relative z-10 shrink-0">
            {/* Tamil Nadu Government Logo with white glowing background near around logo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 mb-3.5 flex items-center justify-center relative">
              {/* White glowing halo concentrated near around the logo */}
              <div className="absolute -inset-2.5 sm:-inset-3 rounded-full bg-white/70 blur-lg pointer-events-none" />
              <div className="absolute -inset-1 rounded-full bg-white/90 blur-md pointer-events-none" />

              {/* White circular background disc with radiant white glow near around the logo */}
              <div className="w-full h-full rounded-full bg-white p-2.5 sm:p-3 flex items-center justify-center relative z-10 shadow-[0_0_22px_8px_rgba(255,255,255,0.95),0_0_40px_14px_rgba(255,255,255,0.8),inset_0_0_10px_rgba(255,255,255,1),0_4px_12px_rgba(0,0,0,0.15)] border-2 border-white ring-2 ring-white/90">
                <TamilNaduLogo glow={false} className="w-full h-full object-contain select-none relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]" />
              </div>
            </div>

            <h2 className="text-sm sm:text-base font-extrabold text-yellow-300 tracking-wide leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              Transport &amp; Escort claim portal
            </h2>
            {/* Small decorative accent line under Transport and Escort claim portal */}
            <div className="w-14 sm:w-16 h-0.5 bg-white/85 rounded-full mx-auto my-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" />
            <h3 className="text-xs sm:text-sm font-bold text-emerald-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              Samagra Shiksha
            </h3>
            <h4 className="text-[11px] sm:text-xs font-bold text-white/95 mt-1 tracking-wider uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              Vellore District
            </h4>
          </div>

          {/* Right Side Panel (1/2 of card: Pure white space covering input boxes) */}
          <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center relative z-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-500 text-center tracking-tight mb-8">
              Sign in
            </h1>

            {/* Form with clearly visible round pill inputs & floating labels with 3D effect */}
            <form onSubmit={handleSignIn} className="w-full flex flex-col items-center space-y-6">
              
              {/* 1. User Type Input Box (Dropdown: School, Block, District) */}
              <div 
                ref={dropdownRef}
                className={`w-full max-w-xs sm:max-w-sm md:max-w-md relative ${isDropdownOpen ? 'z-50' : 'z-20'}`}
              >
              <label
                className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                  focusedField === 'userType' || userType || isDropdownOpen
                    ? '-top-3 left-4 text-xs sm:text-sm font-bold text-emerald-800 bg-white px-2.5 rounded-full border border-emerald-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
                    : 'top-3 left-5 text-sm sm:text-base text-slate-500 font-medium'
                }`}
              >
                User type
              </label>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  if (!isLoading) {
                    setIsDropdownOpen(prev => !prev);
                    setFocusedField('userType');
                  }
                }}
                className={`w-full h-12 px-5 rounded-full border border-slate-300/90 hover:border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white shadow-[0_2px_5px_rgba(0,0,0,0.04),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] flex items-center justify-between cursor-pointer text-sm sm:text-base font-bold text-slate-800 transition-all ${
                  isDropdownOpen ? 'border-emerald-600 ring-2 ring-emerald-500/20' : ''
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span>{userType}</span>
                <MaterialIcon
                  name="expand_more"
                  className={`text-xl text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`}
                />
              </button>

              {/* Dropdown Menu - Explicitly layered at z-50 above username input */}
              {isDropdownOpen && (
                <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-1 divide-y divide-slate-100 ring-1 ring-slate-900/5">
                  {(['School', 'Block', 'District'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleSelectUserType(type)}
                      className={`w-full px-5 py-3 text-sm sm:text-base font-semibold text-left flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer ${
                        userType === type ? 'bg-emerald-50/80 text-emerald-700 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <span>{type}</span>
                      {userType === type && <MaterialIcon name="check" className="text-lg text-emerald-600 font-bold" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Username Input Box */}
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md relative z-10">
              <label
                className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                  focusedField === 'username' || username
                    ? '-top-3 left-4 text-xs sm:text-sm font-bold text-emerald-800 bg-white px-2.5 rounded-full border border-emerald-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
                    : 'top-3 left-5 text-sm sm:text-base text-slate-500 font-medium'
                }`}
              >
                Username
              </label>
              <input
                type="text"
                required
                disabled={isLoading}
                maxLength={25}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                name="signin_username_noautofill"
                value={username}
                onFocus={() => {
                  setFocusedField('username');
                  setIsDropdownOpen(false);
                }}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full h-12 px-5 rounded-full border border-slate-300/90 hover:border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white shadow-[0_2px_5px_rgba(0,0,0,0.04),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:shadow-[0_3px_10px_rgba(16,185,129,0.12),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm sm:text-base font-semibold font-mono text-slate-900 outline-none transition-all ${
                  isLoading ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* 3. Password Input Box with View/Hide Icon */}
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md relative z-0">
              <label
                className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                  focusedField === 'password' || password
                    ? '-top-3 left-4 text-xs sm:text-sm font-bold text-emerald-800 bg-white px-2.5 rounded-full border border-emerald-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
                    : 'top-3 left-5 text-sm sm:text-base text-slate-500 font-medium'
                }`}
              >
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isLoading}
                maxLength={25}
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                name="signin_password_noautofill"
                value={password}
                onFocus={() => {
                  setFocusedField('password');
                  setIsDropdownOpen(false);
                }}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full h-12 pl-5 pr-12 rounded-full border border-slate-300/90 hover:border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white shadow-[0_2px_5px_rgba(0,0,0,0.04),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:shadow-[0_3px_10px_rgba(16,185,129,0.12),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm sm:text-base font-semibold font-mono text-slate-900 outline-none transition-all ${
                  isLoading ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'View password'}
              >
                <MaterialIcon
                  name={showPassword ? 'visibility_off' : 'visibility'}
                  className="text-xl"
                />
              </button>
            </div>

            {/* 4. Captcha Field: Input Box on Left Side, Captcha Display on Right Side in Same Row (No cross line) */}
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md flex items-center gap-2.5 relative z-0">
              {/* Left Side: Captcha Input Box */}
              <div className="relative flex-1">
                <label
                  className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                    focusedField === 'captcha' || captchaInput
                      ? '-top-3 left-3 text-xs sm:text-sm font-bold text-emerald-800 bg-white px-2 rounded-full border border-emerald-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
                      : 'top-3 left-4 text-sm sm:text-base text-slate-500 font-medium'
                  }`}
                >
                  Captcha
                </label>
                <input
                  type="text"
                  required
                  disabled={isLoading}
                  maxLength={6}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  name="signin_captcha_noautofill"
                  value={captchaInput}
                  onFocus={() => {
                    setFocusedField('captcha');
                    setIsDropdownOpen(false);
                  }}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  className={`w-full h-12 px-4 rounded-full border border-slate-300/90 hover:border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white shadow-[0_2px_5px_rgba(0,0,0,0.04),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:shadow-[0_3px_10px_rgba(16,185,129,0.12),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm sm:text-base font-mono font-bold uppercase text-slate-900 outline-none transition-all ${
                    isLoading ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Right Side: Captcha Code Display (Clean, No Cross Line) & Refresh Button */}
              <div className="flex items-center justify-between gap-1.5 px-3.5 h-12 rounded-full bg-slate-100/90 border border-slate-300/90 shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] select-none">
                <span className="font-mono font-extrabold tracking-widest text-slate-900 text-base sm:text-lg pl-1">
                  {captchaCode}
                </span>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={generateCaptcha}
                  className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Generate new captcha code"
                >
                  <MaterialIcon name="refresh" className="text-lg" />
                </button>
              </div>
            </div>

            {/* Sign in Button: Gradient violet and pink, round pill, circular spinner on click */}
            <div className="pt-3 pb-2 flex justify-center w-full">
              <button
                type="submit"
                disabled={isLoading}
                className="w-fit min-w-[170px] px-10 py-3 rounded-full font-bold text-sm sm:text-base text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-500 hover:via-purple-500 hover:to-pink-400 hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_6px_20px_rgba(168,85,247,0.38),0_2px_8px_rgba(236,72,153,0.25),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-80"
              >
                {isLoading ? (
                  // Circular spinner loading in sign in button
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <MaterialIcon name="login" className="text-xl" />
                    <span>Sign in</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
);
};
