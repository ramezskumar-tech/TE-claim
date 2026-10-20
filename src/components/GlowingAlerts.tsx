import React from 'react';
import { NotificationItem, UserSession } from '../types/claim';
import { AlertTriangle, CheckCircle2, Send, Info, X } from 'lucide-react';

interface GlowingAlertsProps {
  notifications: NotificationItem[];
  currentUser: UserSession;
  claimMonthOnlyName: string;
  onDismiss: (id: string) => void;
}

export const GlowingAlerts: React.FC<GlowingAlertsProps> = ({
  notifications,
  currentUser,
  claimMonthOnlyName,
  onDismiss,
}) => {
  // Filter notifications relevant to current user
  const relevant = notifications.filter((n) => {
    if (!n.active) return false;
    if (n.targetRole !== currentUser.role) return false;
    if (currentUser.role === 'BLOCK' && n.targetBlockId && n.targetBlockId !== currentUser.blockId) return false;
    if (currentUser.role === 'SCHOOL' && n.targetUdiseCode && n.targetUdiseCode !== currentUser.udiseCode) return false;
    return true;
  });

  if (relevant.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {relevant.map((notif) => {
        const isReturn = notif.type === 'RETURN';
        const isApproval = notif.type === 'APPROVAL' || notif.type === 'FINAL_SANCTION';
        const isResubmit = notif.type === 'RESUBMISSION';

        let glowClasses = 'border-slate-300 bg-white text-slate-800 shadow-sm';
        let icon = <Info className="w-5 h-5 text-blue-600 shrink-0" />;

        if (isReturn) {
          glowClasses = 'border-amber-400 bg-amber-50/90 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-300';
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />;
        } else if (isApproval) {
          glowClasses = 'border-emerald-400 bg-emerald-50/90 text-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-300';
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
        } else if (isResubmit) {
          glowClasses = 'border-blue-400 bg-blue-50/90 text-blue-950 shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-blue-300';
          icon = <Send className="w-5 h-5 text-blue-600 shrink-0" />;
        }

        return (
          <div
            key={notif.id}
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 transition-all duration-300 ${glowClasses}`}
          >
            <div className="flex items-start gap-3">
              {icon}
              <div>
                <div className="font-semibold text-sm tracking-tight">{notif.title}</div>
                <div className="text-xs mt-0.5 opacity-90 leading-relaxed font-normal">
                  {notif.message}
                </div>
                <div className="text-[10px] opacity-70 mt-1 font-mono tabular-nums">
                  Received: {notif.createdAt} · Target Month: {notif.claimMonth}
                </div>
              </div>
            </div>

            <button
              onClick={() => onDismiss(notif.id)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
