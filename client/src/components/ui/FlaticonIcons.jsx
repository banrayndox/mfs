import React from 'react';

/**
 * Filled RGB / Flaticon-style Icons with rich color fills, highlights, and crisp outlines.
 * Styled after the user-provided reference icon (green banknotes with fills and clean outlines).
 */

// 1. Send Money: Vivid blue & emerald paper airplane with money/currency trail
export function SendMoneyColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background trail / motion */}
      <path d="M6 38C12 36 20 30 24 24" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" />
      <path d="M10 42C18 41 24 35 28 28" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
      {/* Back wing shadow */}
      <polygon points="12,24 42,8 26,40 22,28" fill="#1D4ED8" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Main airplane body */}
      <polygon points="12,24 42,8 24,26" fill="#60A5FA" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Top light wing */}
      <polygon points="42,8 24,26 26,40" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Small floating gold coin */}
      <circle cx="10" cy="14" r="5" fill="#FBBF24" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="10" cy="14" r="3" fill="#FDE68A" />
      <text x="10" y="16.5" fontSize="5" fontWeight="bold" textAnchor="middle" fill="#78350F">৳</text>
    </svg>
  );
}

// 2. Mobile Recharge: Indigo & cyan smartphone with signal antenna & lightning charge
export function RechargeColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Phone Body */}
      <rect x="12" y="6" width="24" height="36" rx="5" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
      {/* Phone Screen */}
      <rect x="15" y="11" width="18" height="25" rx="2" fill="#93C5FD" stroke="#0F172A" strokeWidth="1.5" />
      {/* Speaker and Home Bar */}
      <line x1="21" y1="8.5" x2="27" y2="8.5" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="39" r="1.5" fill="#FFFFFF" />
      {/* Energy Bolt */}
      <polygon points="25,14 18,24 23,24 22,33 30,22 25,22" fill="#FACC15" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Signal Waves */}
      <path d="M38 12C41 15 41 21 38 24" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <path d="M41 9C45 13 45 23 41 27" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 3. Cash Out: EXACT match to user's uploaded green banknote image
export function CashOutColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Back Tilted Banknote */}
      <g transform="rotate(-25 24 24)">
        <rect x="10" y="8" width="28" height="16" rx="2" fill="#4ADE80" stroke="#0F172A" strokeWidth="2" />
        <rect x="12" y="10" width="24" height="12" rx="1" fill="none" stroke="#15803D" strokeWidth="1" strokeDasharray="2 1.5" />
        <circle cx="24" cy="16" r="3.5" fill="#86EFAC" stroke="#0F172A" strokeWidth="1.5" />
      </g>
      {/* Front Horizontal Banknote */}
      <rect x="6" y="20" width="36" height="20" rx="3" fill="#22C55E" stroke="#0F172A" strokeWidth="2.5" />
      {/* Inner Decorative Border */}
      <rect x="9" y="23" width="30" height="14" rx="1.5" fill="none" stroke="#14532D" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Center Currency Circle */}
      <circle cx="24" cy="30" r="5" fill="#BBF7D0" stroke="#0F172A" strokeWidth="2" />
      <text x="24" y="33.5" fontSize="8" fontWeight="bold" textAnchor="middle" fill="#0F172A">৳</text>
      {/* Corner Security Marks */}
      <circle cx="12" cy="26" r="1" fill="#0F172A" />
      <circle cx="12" cy="34" r="1" fill="#0F172A" />
      <circle cx="36" cy="26" r="1" fill="#0F172A" />
      <circle cx="36" cy="34" r="1" fill="#0F172A" />
    </svg>
  );
}

// 4. Pay Bill: Invoice / receipt paper with electricity flash & barcode
export function PayBillColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Paper Receipt Body */}
      <path
        d="M10 7C10 5.89543 10.8954 5 12 5H36C37.1046 5 38 5.89543 38 7V43L34 40L30 43L26 40L22 43L18 40L14 43L10 40V7Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2"
      />
      {/* Top Receipt Header Bar */}
      <rect x="13" y="8" width="22" height="4" rx="1" fill="#6366F1" />
      {/* Bill text lines */}
      <line x1="14" y1="16" x2="26" y2="16" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="21" x2="22" y2="21" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      {/* Electricity Lightning Badge */}
      <circle cx="30" cy="26" r="8" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      <polygon points="31,20 26,26 29.5,26 28.5,32 34,25 30.5,25" fill="#F59E0B" stroke="#0F172A" strokeWidth="1" strokeLinejoin="round" />
      {/* Barcode bottom */}
      <line x1="14" y1="35" x2="16" y2="35" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="35" x2="20" y2="35" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="35" x2="26" y2="35" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 5. Add Money: Purple & blue wallet with incoming gold coin & green plus
export function AddMoneyColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Bank Card / Cash behind */}
      <rect x="10" y="8" width="28" height="16" rx="3" fill="#34D399" stroke="#0F172A" strokeWidth="2" />
      {/* Wallet Body */}
      <rect x="6" y="16" width="36" height="24" rx="4" fill="#8B5CF6" stroke="#0F172A" strokeWidth="2" />
      <path d="M6 22H42" stroke="#6D28D9" strokeWidth="2" />
      {/* Wallet Flap */}
      <path d="M30 24H38C39.6569 24 41 25.3431 41 27V31C41 32.6569 39.6569 34 38 34H30V24Z" fill="#A78BFA" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="34" cy="29" r="2" fill="#FBBF24" stroke="#0F172A" strokeWidth="1" />
      {/* Emerald Plus Badge */}
      <circle cx="16" cy="30" r="6" fill="#10B981" stroke="#0F172A" strokeWidth="1.5" />
      <line x1="16" y1="27" x2="16" y2="33" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <line x1="13" y1="30" x2="19" y2="30" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 6. Savings: Golden vault safe with dial & gold coin
export function SavingsColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Vault Outer Box */}
      <rect x="7" y="9" width="34" height="32" rx="5" fill="#0D9488" stroke="#0F172A" strokeWidth="2.5" />
      {/* Safe Door Inner */}
      <rect x="12" y="14" width="24" height="22" rx="3" fill="#14B8A6" stroke="#0F172A" strokeWidth="1.5" />
      {/* Vault Dial */}
      <circle cx="24" cy="25" r="6.5" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" />
      <circle cx="24" cy="25" r="3.5" fill="#FDE68A" stroke="#0F172A" strokeWidth="1.5" />
      <line x1="24" y1="18.5" x2="24" y2="20.5" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="29.5" x2="24" y2="31.5" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="18.5" y1="25" x2="20.5" y2="25" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="29.5" y1="25" x2="31.5" y2="25" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      {/* Safe Hinges */}
      <rect x="33" y="17" width="2.5" height="4" rx="1" fill="#FBBF24" stroke="#0F172A" strokeWidth="1" />
      <rect x="33" y="29" width="2.5" height="4" rx="1" fill="#FBBF24" stroke="#0F172A" strokeWidth="1" />
    </svg>
  );
}

// 7. Request Money: Coral/Peach open hand receiving green money note
export function RequestMoneyColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Floating Banknote Above */}
      <rect x="14" y="6" width="24" height="14" rx="2" fill="#34D399" stroke="#0F172A" strokeWidth="2" />
      <circle cx="26" cy="13" r="3" fill="#A7F3D0" stroke="#0F172A" strokeWidth="1" />
      <text x="26" y="15.5" fontSize="5" fontWeight="bold" textAnchor="middle" fill="#0F172A">৳</text>
      {/* Downward Arrow */}
      <path d="M26 19V25M23 22L26 25L29 22" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Open Hand */}
      <path
        d="M6 34C6 34 11 31 16 31C20 31 24 33 28 33C33 33 40 28 41 29C42 30 42 32 39 34L30 41H14L6 34Z"
        fill="#FB7185"
        stroke="#0F172A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Thumb */}
      <path d="M16 31C16 28 18 26 21 26C23 26 25 28 25 31" fill="#FDA4AF" stroke="#0F172A" strokeWidth="1.5" />
    </svg>
  );
}

// 8. Guardian Mode: Royal blue & gold shield with padlock & emerald star
export function GuardianColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shield Body */}
      <path
        d="M24 4L39 9V20C39 31 29 39 24 43C19 39 9 31 9 20V9L24 4Z"
        fill="#2563EB"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Inner Shield Accent */}
      <path
        d="M24 7L36 11V20C36 29 28 36 24 39.5C20 36 12 29 12 20V11L24 7Z"
        fill="#3B82F6"
      />
      {/* Golden Center Crest */}
      <circle cx="24" cy="22" r="7.5" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" />
      {/* Lock Shackle & Body */}
      <rect x="20.5" y="21" width="7" height="6" rx="1.5" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M22 21V19C22 17.8954 22.8954 17 24 17C25.1046 17 26 17.8954 26 19V21" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 9. Check Message (Scam/Spam AI Detector): Speech bubble with magnifying glass & shield
export function CheckMessageColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Chat Bubble */}
      <path
        d="M8 12C8 8.68629 10.6863 6 14 6H34C37.3137 6 40 8.68629 40 12V26C40 29.3137 37.3137 32 34 32H20L11 39V32H14C10.6863 32 8 29.3137 8 26V12Z"
        fill="#38BDF8"
        stroke="#0F172A"
        strokeWidth="2.5"
      />
      {/* Text lines in chat */}
      <line x1="14" y1="14" x2="28" y2="14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="14" y1="20" x2="24" y2="20" stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round" />
      {/* Magnifying Glass badge */}
      <circle cx="32" cy="28" r="7" fill="#FBBF24" stroke="#0F172A" strokeWidth="2" />
      <circle cx="32" cy="28" r="4.5" fill="#FEF9C3" />
      <line x1="37" y1="33" x2="42" y2="38" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      {/* Shield check inside glass */}
      <path d="M30 28L31.5 29.5L34 26.5" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 10. Reminders: Retro alarm clock in crimson red & gold
export function RemindersColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Clock Bells */}
      <path d="M9 14L15 8" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M39 14L33 8" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M8 17C6 14 8 10 12 10" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 17C42 14 40 10 36 10" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      {/* Clock Feet */}
      <line x1="14" y1="41" x2="10" y2="45" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <line x1="34" y1="41" x2="38" y2="45" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      {/* Clock Body */}
      <circle cx="24" cy="27" r="16" fill="#EF4444" stroke="#0F172A" strokeWidth="2.5" />
      {/* Inner Face */}
      <circle cx="24" cy="27" r="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
      {/* Hands */}
      <circle cx="24" cy="27" r="2" fill="#0F172A" />
      <line x1="24" y1="27" x2="24" y2="19" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="27" x2="30" y2="27" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 11. Scheduled Rules: Calendar with cyclical sync arrows
export function ScheduledRulesColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Calendar Base */}
      <rect x="8" y="10" width="32" height="32" rx="4" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      {/* Header Banner */}
      <path d="M8 14C8 11.7909 9.79086 10 12 10H36C38.2091 10 40 11.7909 40 14V17H8V14Z" fill="#10B981" stroke="#0F172A" strokeWidth="2" />
      {/* Binder Rings */}
      <rect x="14" y="6" width="3" height="7" rx="1.5" fill="#FBBF24" stroke="#0F172A" strokeWidth="1.5" />
      <rect x="31" y="6" width="3" height="7" rx="1.5" fill="#FBBF24" stroke="#0F172A" strokeWidth="1.5" />
      {/* Repeating Circular Sync Arrow in calendar */}
      <circle cx="24" cy="29" r="6" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="25 6" />
      <polygon points="28,24 28,29 23,29" fill="#3B82F6" stroke="#0F172A" strokeWidth="1" />
    </svg>
  );
}

// 12. Group Bill: Trio of colorful user avatars with shared bill
export function GroupBillColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Left Avatar (Orange) */}
      <circle cx="15" cy="18" r="5" fill="#FB923C" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M7 32C7 27 11 25 15 25C19 25 23 27 23 32" fill="#FDBA74" stroke="#0F172A" strokeWidth="1.5" />
      {/* Right Avatar (Teal) */}
      <circle cx="33" cy="18" r="5" fill="#2DD4BF" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M25 32C25 27 29 25 33 25C37 25 41 27 41 32" fill="#99F6E4" stroke="#0F172A" strokeWidth="1.5" />
      {/* Center Avatar (Royal Blue - elevated) */}
      <circle cx="24" cy="13" r="6" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
      <path d="M14 30C14 24 19 22 24 22C29 22 34 24 34 30" fill="#93C5FD" stroke="#0F172A" strokeWidth="2" />
      {/* Shared Receipt Badge at bottom */}
      <rect x="18" y="32" width="12" height="12" rx="2" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      <line x1="21" y1="36" x2="27" y2="36" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="39" x2="25" y2="39" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 13. Key / PIN: Golden brass key with digital tumbler
export function KeyPinColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="16" cy="20" r="10" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.5" />
      <circle cx="16" cy="20" r="5" fill="#FEF3C7" stroke="#0F172A" strokeWidth="1.5" />
      {/* Key Shaft */}
      <path d="M24 24L38 38L42 34L37 29L39 27L35 23" fill="#FBBF24" stroke="#0F172A" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Key Teeth */}
      <line x1="33" y1="33" x2="36" y2="30" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 14. Language: Earth globe with bilingual speech marks
export function LanguageColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Ocean */}
      <circle cx="24" cy="24" r="17" fill="#0284C7" stroke="#0F172A" strokeWidth="2.5" />
      {/* Continents (Green) */}
      <path d="M12 20C15 22 17 18 20 22C23 26 19 28 22 32C19 35 15 32 12 28C10 25 10 22 12 20Z" fill="#22C55E" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M26 12C30 14 34 11 36 15C38 18 36 21 34 23C31 23 29 19 28 17C27 15 25 14 26 12Z" fill="#22C55E" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M30 30C33 30 36 33 34 36C31 38 29 36 30 30Z" fill="#22C55E" />
      {/* Grid lines */}
      <ellipse cx="24" cy="24" rx="8" ry="17" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
      <line x1="7" y1="24" x2="41" y2="24" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

// 15. Theme: Half brilliant golden sun & half deep indigo moon
export function ThemeColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Full circle divided */}
      <circle cx="24" cy="24" r="16" fill="#FBBF24" stroke="#0F172A" strokeWidth="2.5" />
      {/* Dark Side Moon */}
      <path d="M24 8C32.8366 8 40 15.1634 40 24C40 32.8366 32.8366 40 24 40V8Z" fill="#4338CA" />
      {/* Moon crater & stars */}
      <circle cx="31" cy="18" r="2" fill="#818CF8" />
      <circle cx="33" cy="28" r="2.5" fill="#818CF8" />
      <circle cx="28" cy="33" r="1.5" fill="#818CF8" />
      {/* Sun rays on left */}
      <line x1="4" y1="24" x2="8" y2="24" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      <line x1="9.8" y1="9.8" x2="12.6" y2="12.6" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      <line x1="9.8" y1="38.2" x2="12.6" y2="35.4" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// 16. Biometrics: Fingerprint with glowing cyan scan & security check
export function BiometricsColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Outer Scanner Border */}
      <rect x="8" y="6" width="32" height="36" rx="6" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
      {/* Fingerprint Loops */}
      <path d="M24 16C19.5 16 16 19.5 16 24V28" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 25V24C20 21.8 21.8 20 24 20C26.2 20 28 21.8 28 24V31" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 25V28C24 29 25 30 26 30" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 22C32 20 30 17 27 16.5" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 32C17 34 19 36 24 36C27 36 30 34 32 30" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      {/* Glowing Scan Bar */}
      <line x1="6" y1="24" x2="42" y2="24" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// 17. Switch Account: Dual user cards in purple and amber with exchange arrows
export function SwitchAccountColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* User 1 Badge (Purple) */}
      <circle cx="16" cy="16" r="6" fill="#A855F7" stroke="#0F172A" strokeWidth="2" />
      <path d="M8 30C8 25 11.5 23 16 23C20.5 23 24 25 24 30" fill="#C084FC" stroke="#0F172A" strokeWidth="2" />
      {/* User 2 Badge (Amber) */}
      <circle cx="32" cy="22" r="6" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" />
      <path d="M24 36C24 31 27.5 29 32 29C36.5 29 40 31 40 36" fill="#FCD34D" stroke="#0F172A" strokeWidth="2" />
      {/* Exchange Arrows */}
      <path d="M16 38H28M28 38L24 34M28 38L24 42" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 10H20M20 10L24 6M20 10L24 14" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 18. Profile / ID Card: Vibrant user card with badge
export function ProfileColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="8" y="9" width="32" height="30" rx="4" fill="#0EA5E9" stroke="#0F172A" strokeWidth="2.5" />
      {/* Lanyard Hole */}
      <rect x="21" y="11" width="6" height="2" rx="1" fill="#FFFFFF" />
      {/* User Photo */}
      <circle cx="18" cy="24" r="5" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M13 33C13 30 15 28 18 28C21 28 23 30 23 33" fill="#FCD34D" stroke="#0F172A" strokeWidth="1" />
      {/* Card Info Lines */}
      <line x1="26" y1="21" x2="35" y2="21" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="26" x2="33" y2="26" stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="31" x2="31" y2="31" stroke="#BAE6FD" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 19. KYC Verification: Official National ID with gold ribbon seal
export function KycColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Document */}
      <rect x="7" y="10" width="34" height="28" rx="3" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2.5" />
      {/* Green Header */}
      <path d="M7 13C7 11.3431 8.34315 10 10 10H38C39.6569 10 41 11.3431 41 13V16H7V13Z" fill="#15803D" />
      {/* Chip */}
      <rect x="11" y="20" width="7" height="6" rx="1" fill="#F59E0B" stroke="#0F172A" strokeWidth="1" />
      {/* Details */}
      <line x1="21" y1="21" x2="35" y2="21" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="26" x2="31" y2="26" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      {/* Gold Seal / Ribbon */}
      <circle cx="34" cy="31" r="5" fill="#EAB308" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M32 31L33.5 32.5L36 29.5" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 20. Logout: Crimson exit door with bold arrow
export function LogoutColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Door Frame */}
      <rect x="8" y="8" width="20" height="32" rx="3" fill="#F43F5E" stroke="#0F172A" strokeWidth="2.5" />
      <circle cx="23" cy="24" r="2" fill="#FEF08A" stroke="#0F172A" strokeWidth="1" />
      {/* Exit Arrow */}
      <path d="M22 24H40M40 24L34 18M40 24L34 30" stroke="#E11D48" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 21. FAQ / 24/7 Support: Lifebuoy with luminous question mark badge
export function FaqColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Lifebuoy Body */}
      <circle cx="24" cy="24" r="16" fill="#EF4444" stroke="#0F172A" strokeWidth="2.5" />
      {/* White Stripes */}
      <circle cx="24" cy="24" r="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M12 12L19 19" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M36 12L29 19" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M12 36L19 29" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M36 36L29 29" stroke="#FFFFFF" strokeWidth="4" />
      {/* Center Question Mark */}
      <text x="24" y="27" fontSize="10" fontWeight="900" textAnchor="middle" fill="#0F172A">?</text>
    </svg>
  );
}

// 22. AI Copilot / Assistant: Vibrant robot with glowing cyan eyes & antenna
export function AiCopilotColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Antenna */}
      <line x1="24" y1="12" x2="24" y2="6" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="5" r="3" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" />
      {/* Robot Ears */}
      <rect x="5" y="20" width="5" height="10" rx="2" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
      <rect x="38" y="20" width="5" height="10" rx="2" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
      {/* Robot Head Body */}
      <rect x="8" y="12" width="32" height="26" rx="8" fill="#60A5FA" stroke="#0F172A" strokeWidth="2.5" />
      {/* Visor Screen */}
      <rect x="12" y="17" width="24" height="13" rx="4" fill="#0F172A" stroke="#0F172A" strokeWidth="1.5" />
      {/* Glowing Eyes */}
      <circle cx="18" cy="23.5" r="3" fill="#38BDF8" />
      <circle cx="30" cy="23.5" r="3" fill="#38BDF8" />
      <circle cx="19" cy="22.5" r="1" fill="#FFFFFF" />
      <circle cx="31" cy="22.5" r="1" fill="#FFFFFF" />
      {/* Friendly Smile */}
      <path d="M20 33C22 35 26 35 28 33" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      {/* Cheeks */}
      <circle cx="14" cy="32" r="1.5" fill="#F43F5E" />
      <circle cx="34" cy="32" r="1.5" fill="#F43F5E" />
    </svg>
  );
}

// 23. Notification Bell: Radiant golden bell with ringing sound waves
export function NotificationBellColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Sound Waves */}
      <path d="M6 22C4 18 5 13 8 10" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 22C44 18 43 13 40 10" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      {/* Top Loop */}
      <circle cx="24" cy="9" r="3" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" />
      {/* Bell Dome */}
      <path
        d="M24 10C16 10 14 19 14 26C14 29 10 32 10 34C10 36 12 37 15 37H33C36 37 38 36 38 34C38 32 34 29 34 26C34 19 32 10 24 10Z"
        fill="#FBBF24"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Bell Highlight & Shadow */}
      <path d="M19 14C17 17 16 23 16 29" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 34C17 32 31 32 34 34" stroke="#D97706" strokeWidth="2" />
      {/* Bell Clapper */}
      <circle cx="24" cy="40" r="4" fill="#EA580C" stroke="#0F172A" strokeWidth="2" />
      {/* Red Alert Dot on top right */}
      <circle cx="34" cy="11" r="4.5" fill="#EF4444" stroke="#0F172A" strokeWidth="1.5" />
    </svg>
  );
}

// 24. Storefront / Agent Store: Striped awning shop with door & window
export function StorefrontColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Building Body */}
      <rect x="8" y="20" width="32" height="22" rx="2" fill="#F1F5F9" stroke="#0F172A" strokeWidth="2.5" />
      {/* Door */}
      <rect x="13" y="27" width="10" height="15" rx="1.5" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" />
      <circle cx="20" cy="35" r="1" fill="#0F172A" />
      {/* Window */}
      <rect x="26" y="27" width="10" height="9" rx="1.5" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.5" />
      <line x1="31" y1="27" x2="31" y2="36" stroke="#FFFFFF" strokeWidth="1" />
      <line x1="26" y1="31.5" x2="36" y2="31.5" stroke="#FFFFFF" strokeWidth="1" />
      {/* Awning base */}
      <polygon points="6,20 42,20 40,11 8,11" fill="#EA580C" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Awning stripes */}
      <polygon points="12,20 18,20 16.5,11 11.5,11" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      <polygon points="24,20 30,20 28.5,11 23.5,11" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      <polygon points="36,20 41.5,20 39.5,11 35.5,11" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
      {/* Awning Scallops */}
      <path d="M6 20C6 22 9 22 9 20C9 22 12 22 12 20C12 22 15 22 15 20C15 22 18 22 18 20C18 22 21 22 21 20C21 22 24 22 24 20C24 22 27 22 27 20C27 22 30 22 30 20C30 22 33 22 33 20C33 22 36 22 36 20C36 22 39 22 39 20C39 22 42 22 42 20" stroke="#0F172A" strokeWidth="2" fill="#EA580C" />
      {/* Small Agent Sign on roof */}
      <rect x="18" y="5" width="12" height="6" rx="1.5" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.5" />
      <line x1="21" y1="8" x2="27" y2="8" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 25. Checkmark Success: Crisp emerald medal badge with gold star accents
export function CheckmarkSuccessColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Sparkles */}
      <path d="M8 12L9.5 8L11 12L15 13.5L11 15L9.5 19L8 15L4 13.5L8 12Z" fill="#FBBF24" />
      <path d="M38 34L39 31L40 34L43 35L40 36L39 39L38 36L35 35L38 34Z" fill="#FBBF24" />
      {/* Main Circle */}
      <circle cx="24" cy="24" r="18" fill="#10B981" stroke="#0F172A" strokeWidth="2.5" />
      {/* Inner highlight ring */}
      <circle cx="24" cy="24" r="14" fill="#34D399" />
      {/* Thick White Checkmark */}
      <path
        d="M16 24.5L21.5 30L32 18"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 26. Security Alert: Vivid warning shield with amber exclamation badge
export function SecurityAlertColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shield Body */}
      <path
        d="M24 5L39 10V21C39 31 29 39 24 43C19 39 9 31 9 21V10L24 5Z"
        fill="#EF4444"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Inner Highlight Shield */}
      <path
        d="M24 8L36 12V21C36 29 28 36 24 39.5C20 36 12 29 12 21V12L24 8Z"
        fill="#F87171"
      />
      {/* Warning Exclamation Sign */}
      <circle cx="24" cy="33" r="2.5" fill="#FFFFFF" />
      <path d="M24 16V28" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// 27. Speedometer / Limits & Usage: Crisp arc gauge with colorful segments and pointer needle
export function SpeedometerColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Outer Gauge Arc Base */}
      <path
        d="M8 36C8 27.1634 15.1634 20 24 20C32.8366 20 40 27.1634 40 36"
        stroke="#E2E8F0"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Colored Track Segments: Green -> Yellow -> Red */}
      <path
        d="M8 36C8 30 11.5 24.8 16.5 22"
        stroke="#22C55E"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M17 21.8C21.2 19.8 26.8 19.8 31 21.8"
        stroke="#F59E0B"
        strokeWidth="6"
      />
      <path
        d="M31.5 22C36.5 24.8 40 30 40 36"
        stroke="#EF4444"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Dial Outline */}
      <circle cx="24" cy="36" r="6" fill="#0F172A" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="24" cy="36" r="2.5" fill="#38BDF8" />
      {/* Pointer Needle */}
      <line x1="24" y1="36" x2="31" y2="24" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="36" x2="31" y2="24" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 28. PWA Install Icon: Smartphone with golden download arrow badge
export function PwaInstallColorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="13" y="6" width="22" height="36" rx="4" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
      <rect x="16" y="10" width="16" height="23" rx="2" fill="#DBEAFE" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="24" cy="38" r="1.5" fill="#FFFFFF" />
      <circle cx="34" cy="34" r="9" fill="#FACC15" stroke="#0F172A" strokeWidth="2" />
      <path d="M34 29V37M31 34L34 37L37 34" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default {
  SendMoneyColorIcon,
  RechargeColorIcon,
  CashOutColorIcon,
  PayBillColorIcon,
  AddMoneyColorIcon,
  SavingsColorIcon,
  RequestMoneyColorIcon,
  GuardianColorIcon,
  CheckMessageColorIcon,
  RemindersColorIcon,
  ScheduledRulesColorIcon,
  GroupBillColorIcon,
  KeyPinColorIcon,
  LanguageColorIcon,
  ThemeColorIcon,
  BiometricsColorIcon,
  SwitchAccountColorIcon,
  ProfileColorIcon,
  KycColorIcon,
  LogoutColorIcon,
  FaqColorIcon,
  AiCopilotColorIcon,
  NotificationBellColorIcon,
  StorefrontColorIcon,
  CheckmarkSuccessColorIcon,
  SecurityAlertColorIcon,
  SpeedometerColorIcon,
  PwaInstallColorIcon,
};
