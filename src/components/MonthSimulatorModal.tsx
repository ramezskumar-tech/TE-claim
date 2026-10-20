import React from 'react';
import { claimStore } from '../services/claimStore';
import { DynamicCycleInfo } from '../utils/dateCycle';
import { Calendar, Clock, RotateCcw, X } from 'lucide-react';

interface MonthSimulatorModalProps {
  isOpen: boolean;
  cycleInfo: DynamicCycleInfo;
  onClose: () => void;
  onRefresh: () => void;
}

export const MonthSimulatorModal: React.FC<MonthSimulatorModalProps> = ({
  isOpen,
  cycleInfo,
  onClose,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const currentOffset = claimStore.getState().monthOffset;

  const handleSelectOffset = (offset: number) => {
    claimStore.setMonthOffset(offset);
    onRefresh();
  };

  const simulationOptions = [
    { label: 'Simulate Month -3', offset: -3 },
    { label: 'Simulate Month -2', offset: -2 },
    { label: 'Simulate Month -1', offset: -1 },
    { label: 'Real Current Date (Default)', offset: 0 },
    { label: 'Simulate Next Month (+1)', offset: 1 },
    { label: 'Simulate Month (+2)', offset: 2 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Dynamic Month Cycle Simulator</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 text-base font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            All claim months, calculation periods, deadlines, and notifications are computed dynamically from the date. Use this tool to test any month transition without modifying code.
          </p>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
            <div className="text-slate-500 font-medium">Currently Active:</div>
            <div className="text-sm font-bold text-emerald-950 font-mono">
              Claim Month: {cycleInfo.claimMonthName}
            </div>
            <div className="text-[11px] text-emerald-800">
              Calculation Period: {cycleInfo.calculationPeriodString}
            </div>
            <div className="text-[11px] text-emerald-700">
              Submission Window: {cycleInfo.submissionMonthName}
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              Shift Simulated Calendar Date:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {simulationOptions.map((opt) => (
                <button
                  key={opt.offset}
                  onClick={() => handleSelectOffset(opt.offset)}
                  className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition-colors flex items-center justify-between ${
                    currentOffset === opt.offset
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  {currentOffset === opt.offset && <span className="text-[10px]">● Active</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button
            onClick={() => handleSelectOffset(0)}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Real Today
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
