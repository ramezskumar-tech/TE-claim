import React, { useState } from 'react';
import { claimStore } from '../services/claimStore';
import { Shield, Search, Filter, History, Download } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const store = claimStore.getState();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const filteredLogs = store.auditLogs.filter((log) => {
    if (roleFilter !== 'ALL' && log.userRole !== roleFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        log.schoolOrBlockName.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.remarks.toLowerCase().includes(q) ||
        log.claimMonth.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCsv = () => {
    const headers = ['Log ID', 'Timestamp', 'User ID', 'User Name', 'Role', 'Entity Name', 'Claim Month', 'Action', 'Previous Status', 'New Status', 'Remarks'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      l.userId,
      `"${l.userName}"`,
      l.userRole,
      `"${l.schoolOrBlockName}"`,
      `"${l.claimMonth}"`,
      l.action,
      l.previousStatus,
      l.newStatus,
      `"${l.remarks.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vellore_Transport_Claim_Audit_Trail_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-bold">
              <History className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Immutable Audit Trail</h2>
              <p className="text-xs text-slate-500">
                Permanent chronological record of every School submission, Block verification, District approval, and rejection. Records are never deleted.
              </p>
            </div>
          </div>

          <button
            onClick={exportCsv}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit CSV
          </button>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-slate-500 font-medium shrink-0">Filter Role:</span>
            <div className="flex items-center p-1 bg-slate-100 rounded-lg">
              {['ALL', 'SCHOOL', 'BLOCK', 'DISTRICT'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                    roleFilter === r ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">User & ID</th>
                <th className="py-3 px-3">Entity / School / Block</th>
                <th className="py-3 px-3">Month</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Status Transition</th>
                <th className="py-3 px-3">Remarks / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.userRole === 'DISTRICT'
                          ? 'bg-purple-100 text-purple-800'
                          : log.userRole === 'BLOCK'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {log.userRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.userId}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{log.schoolOrBlockName}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{log.claimMonth}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-700">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-slate-400 font-mono text-[11px]">{log.previousStatus}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="font-mono text-[11px] font-bold text-slate-800">{log.newStatus}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">{log.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
