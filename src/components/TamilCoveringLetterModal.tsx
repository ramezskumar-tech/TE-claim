import React from 'react';
import { MaterialIcon } from './MaterialIcon';
import {
  SchoolTamilCoveringLetterData,
  BlockTamilCoveringLetterData,
  generateSchoolTamilCoveringLetterHtml,
  generateBlockTamilCoveringLetterHtml,
  printTamilCoveringLetter,
  downloadTamilCoveringLetterPdf,
} from '../utils/tamilCoveringLetter';

export interface TamilCoveringLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'school' | 'block';
  schoolData?: SchoolTamilCoveringLetterData;
  blockData?: BlockTamilCoveringLetterData;
}

export const TamilCoveringLetterModal: React.FC<TamilCoveringLetterModalProps> = ({
  isOpen,
  onClose,
  type,
  schoolData,
  blockData,
}) => {
  if (!isOpen) return null;

  const title =
    type === 'school'
      ? `முன்னனுப்பு கடிதம் - ${schoolData?.schoolName || 'பள்ளி'} - ${schoolData?.monthName || ''}`
      : `ஒன்றிய முன்னனுப்பு கடிதம் - ${blockData?.blockName || 'ஒன்றியம்'} - ${blockData?.monthName || ''}`;

  const htmlContent =
    type === 'school' && schoolData
      ? generateSchoolTamilCoveringLetterHtml(schoolData)
      : blockData
      ? generateBlockTamilCoveringLetterHtml(blockData)
      : '<p>விவரங்கள் கிடைக்கவில்லை</p>';

  const handlePrint = async () => {
    await printTamilCoveringLetter(title, htmlContent);
  };

  const handleDownload = async () => {
    const filename =
      type === 'school'
        ? `Covering_Letter_${(schoolData?.schoolName || 'School').replace(/\s+/g, '_')}_${(schoolData?.monthName || 'Month').replace(/\s+/g, '_')}`
        : `Block_Covering_Letter_${(blockData?.blockName || 'Block').replace(/\s+/g, '_')}_${(blockData?.monthName || 'Month').replace(/\s+/g, '_')}`;
    
    // Trigger direct print / save to PDF for full Tamil rendering fidelity
    await printTamilCoveringLetter(title, htmlContent);
    // Also save standalone document
    await downloadTamilCoveringLetterPdf(title, htmlContent, filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold uppercase tracking-wider">
                Official Government Document
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {type === 'school' ? 'பள்ளி முன்னனுப்பு கடிதம்' : 'ஒன்றிய முன்னனுப்பு கடிதம்'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1">
              முன்னனுப்பு கடிதம் (Tamil Covering Letter)
            </h3>
          </div>

          {/* Action Buttons: Print, Download PDF, Close */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-full font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Print official Tamil covering letter"
            >
              <MaterialIcon name="print" className="text-sm" />
              <span>Print Letter</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-full font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Download or save as PDF"
            >
              <MaterialIcon name="download" className="text-sm" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <MaterialIcon name="close" className="text-base" />
            </button>
          </div>
        </div>

        {/* Info Strip */}
        <div className="bg-white px-6 py-2.5 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between shrink-0">
          <div>
            தானியங்கி அதிகாரப்பூர்வ முன்னனுப்பு கடித முன்னோட்டம் (Official Automated Tamil Letter Preview)
          </div>
          <div className="font-mono text-[11px] text-slate-500 hidden sm:block">
            A4 Portrait · Approved Official Format
          </div>
        </div>

        {/* Paper-like Scrollable Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/60">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-300 max-w-3xl mx-auto overflow-hidden">
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        </div>

        {/* Footer Bar */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500">
            அனைத்து விவரங்களும் கணினியால் தானாக நிரப்பப்பட்டுள்ளன (All details automatically pulled from database).
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all cursor-pointer flex items-center gap-1"
            >
              <MaterialIcon name="print" className="text-xs text-slate-700" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
