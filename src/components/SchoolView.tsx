import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import { SchoolClaimRecord, StudentClaimItem, UserSession, AppointedVehicleItem, AppointedEscortItem, SmcBankDetails } from '../types/claim';
import { DynamicCycleInfo, formatCurrencyINR } from '../utils/dateCycle';
import { calculateStudentClaimAmount, calculateAttendancePercentage } from '../utils/claimCalculation';
import { claimStore } from '../services/claimStore';
import { VELLORE_SCHOOLS, SAMPLE_STUDENTS_TEMPLATES } from '../data/initialData';
import { 
  fetchSchoolMasterData, 
  fetchSchoolStudentsMaster, 
  updateStudentMasterData,
  uploadUsagePhotoToSupabaseStorage,
  uploadStudentPhotoToStorage,
  uploadProofToSupabaseStorage
} from '../services/supabaseClient';
import {
  printStudentWiseClaimSheet,
  downloadStudentWiseClaimPdf,
  printClaimReceiptSheet,
  downloadClaimReceiptPdf,
  downloadOfficialClaimLandscapePdf,
  downloadClaimCsv
} from '../utils/printHelper';
import { 
  School, 
  CheckCircle2, 
  Eye, 
  AlertCircle, 
  FileText, 
  Printer, 
  Bell, 
  Clock, 
  Users, 
  ArrowRight, 
  Sparkles, 
  Plus, 
  Trash2, 
  CalendarDays,
  Calendar,
  Building, 
  Hash, 
  Download, 
  Bus, 
  UserCheck, 
  Camera, 
  Pencil, 
  Save, 
  X, 
  Send,
  ArrowLeft,
  Check,
  FileUp,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  CheckCheck,
  FileSpreadsheet,
  Landmark,
  Upload
} from 'lucide-react';
import { MaterialIcon } from './MaterialIcon';
import { TamilCoveringLetterModal } from './TamilCoveringLetterModal';

interface UploadedAttendancePage {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  pageNumber: number;
}

interface UsagePhotoItem {
  id: string;
  name: string;
  dataUrl: string;
  storageUrl?: string;
  file?: File;
  uploadedAt: string;
}

interface SchoolViewProps {
  currentUser: UserSession;
  cycleInfo: DynamicCycleInfo;
  activeSubTab?: 'home' | 'claim_action';
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const SchoolView: React.FC<SchoolViewProps> = ({
  currentUser,
  cycleInfo,
  activeSubTab = 'home',
  onRefresh,
  onNavigateTab,
}) => {
  const udiseCode = currentUser.udiseCode || '33040100101';
  
  // School Master Data state
  const defaultMeta = VELLORE_SCHOOLS.find(s => s.udiseCode === udiseCode) || {
    udiseCode,
    name: currentUser.schoolName || 'Government High School',
    blockId: currentUser.blockId || 'BLK_VELLORE_URBAN',
    blockName: currentUser.blockName || 'Vellore Urban',
    category: 'Government School',
    headmasterName: currentUser.name,
    phone: '9443210000',
    defaultBeneficiaries: 4,
  };

  const [schoolData, setSchoolData] = useState({
    udiseCode: defaultMeta.udiseCode,
    schoolName: defaultMeta.name,
    blockName: defaultMeta.blockName,
  });

  // Fetch from Supabase School Master table
  useEffect(() => {
    let isMounted = true;
    async function loadMaster() {
      const data = await fetchSchoolMasterData(udiseCode);
      if (isMounted && data) {
        setSchoolData({
          udiseCode: data.udiseCode,
          schoolName: data.name,
          blockName: data.blockName,
        });
      }
    }
    loadMaster();
    return () => { isMounted = false; };
  }, [udiseCode]);

  const existingClaim = claimStore.getSchoolClaimForCurrentMonth(udiseCode);

  // Month names
  const now = new Date();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthName = prevMonthDate.toLocaleString('default', { month: 'long' });

  // Working days state for previous month (start 0 embedded, no auto-fill)
  const [totalWorkingDays, setTotalWorkingDays] = useState<number>(
    existingClaim ? (existingClaim.students[0]?.workingDaysInMonth || 0) : 0
  );

  // Student details fetch states
  const [isFetchingStudents, setIsFetchingStudents] = useState<boolean>(false);
  const [studentsLoaded, setStudentsLoaded] = useState<boolean>(!!existingClaim);

  // Student rows
  const [studentRows, setStudentRows] = useState<StudentClaimItem[]>([]);
  const [submittedByName, setSubmittedByName] = useState<string>(currentUser.name);
  const [submissionSuccessMsg, setSubmissionSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set of students whose claim has been saved (Claim button replaced by Green Tick + Blue Pencil)
  const [savedStudentIds, setSavedStudentIds] = useState<Set<string>>(new Set());

  // Post-submission states
  const [isClaimSubmitted, setIsClaimSubmitted] = useState<boolean>(!!existingClaim);
  const [isEditModeAfterSubmit, setIsEditModeAfterSubmit] = useState<boolean>(false);
  const [showUncompletedIndicators, setShowUncompletedIndicators] = useState<boolean>(false);
  const [successToast2Sec, setSuccessToast2Sec] = useState<string | null>(null);
  const [uncompletedAlertMsg, setUncompletedAlertMsg] = useState<string | null>(null);

  // Modals & Zoom state
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [viewReadOnlyModal, setViewReadOnlyModal] = useState<boolean>(false);

  // Clicked student for Zoom-In details card
  const [selectedStudent, setSelectedStudent] = useState<StudentClaimItem | null>(null);
  const [isZoomingOut, setIsZoomingOut] = useState<boolean>(false);
  const [availedDaysInput, setAvailedDaysInput] = useState<string>('');
  const [validationAlertMsg, setValidationAlertMsg] = useState<string | null>(null);

  const [isEditingMasterDetails, setIsEditingMasterDetails] = useState<boolean>(false);
  const [editedStudentForm, setEditedStudentForm] = useState<Partial<StudentClaimItem>>({});
  const [isSavingMaster, setIsSavingMaster] = useState<boolean>(false);
  const [masterSaveNotice, setMasterSaveNotice] = useState<string | null>(null);

  // Hidden file input ref for photo capture
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload Document Section States (Attendance copy images & merged PDF)
  const [attendancePages, setAttendancePages] = useState<UploadedAttendancePage[]>([]);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [mergedPdfBlob, setMergedPdfBlob] = useState<Blob | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState<boolean>(false);
  const [duplicateAlertMsg, setDuplicateAlertMsg] = useState<string | null>(null);
  const [viewPdfModal, setViewPdfModal] = useState<boolean>(false);

  // Second Field: Transport/Escort Usage photos states (Max 4 photos)
  const [usagePhotos, setUsagePhotos] = useState<UsagePhotoItem[]>([]);
  const [viewingUsagePhoto, setViewingUsagePhoto] = useState<string | null>(null);
  const [editingUsagePhotoId, setEditingUsagePhotoId] = useState<string | null>(null);
  const [isUsagePhotosSaved, setIsUsagePhotosSaved] = useState<boolean>(false);
  const [isSavingUsagePhotos, setIsSavingUsagePhotos] = useState<boolean>(false);
  const [usageSaveSuccessToast, setUsageSaveSuccessToast] = useState<string | null>(null);
  const [usageAlertMsg, setUsageAlertMsg] = useState<string | null>(null);

  // Section 5: Claim Verification States & Modals
  const [viewStudentWiseClaimModal, setViewStudentWiseClaimModal] = useState<boolean>(false);
  const [showCoveringLetterModal, setShowCoveringLetterModal] = useState<boolean>(false);
  const [isClaimVerified, setIsClaimVerified] = useState<boolean>(existingClaim?.isClaimVerified ?? false);
  const [verifySuccessToast, setVerifySuccessToast] = useState<string | null>(null);

  // Section 9: HM Declaration & Forward to Block Workflow States
  const [hmDeclarationAccepted, setHmDeclarationAccepted] = useState<boolean>(existingClaim?.hmDeclarationCompleted ?? false);
  const [isForwardedToBlock, setIsForwardedToBlock] = useState<boolean>(existingClaim?.isForwardedToBlock ?? false);
  const [forwardAlertMsg, setForwardAlertMsg] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState<boolean>(false);

  // Section 6: Appointed Transport & Escort details states (start 0 embedded, no auto-fill)
  const [vehicleCount, setVehicleCount] = useState<number>(existingClaim?.appointedVehicles?.length || 0);
  const [vehicles, setVehicles] = useState<AppointedVehicleItem[]>(existingClaim?.appointedVehicles || []);

  const [escortCount, setEscortCount] = useState<number>(existingClaim?.appointedEscorts?.length || 0);
  const [escorts, setEscorts] = useState<AppointedEscortItem[]>(existingClaim?.appointedEscorts || []);

  const [isAppointedFrozen, setIsAppointedFrozen] = useState<boolean>(false);
  const [appointedSaveSuccessToast, setAppointedSaveSuccessToast] = useState<boolean>(false);

  // Dynamic handlers for vehicle count & details
  const handleVehicleCountChange = (valStr: string) => {
    if (isAppointedFrozen) return;
    const cleanStr = valStr.replace(/\D/g, '');
    const num = cleanStr === '' ? 0 : parseInt(cleanStr, 10);
    const clamped = Math.max(0, Math.min(20, num));
    setVehicleCount(clamped);

    setVehicles(prev => {
      if (prev.length < clamped) {
        const toAdd: AppointedVehicleItem[] = [];
        for (let i = prev.length; i < clamped; i++) {
          toAdd.push({
            id: `VEH_${udiseCode}_${Date.now()}_${i + 1}`,
            vehicleNo: '',
            driverName: '',
            contactNumber: '',
          });
        }
        return [...prev, ...toAdd];
      } else if (prev.length > clamped) {
        return prev.slice(0, clamped);
      }
      return prev;
    });
  };

  const handleUpdateVehicle = (index: number, field: keyof AppointedVehicleItem, value: string) => {
    if (isAppointedFrozen) return;
    setVehicles(prev => prev.map((v, i) => {
      if (i === index) {
        if (field === 'contactNumber') {
          return { ...v, contactNumber: value.replace(/\D/g, '').slice(0, 10) };
        }
        return { ...v, [field]: value };
      }
      return v;
    }));
  };

  // Dynamic handlers for escort count & details
  const handleEscortCountChange = (valStr: string) => {
    if (isAppointedFrozen) return;
    const cleanStr = valStr.replace(/\D/g, '');
    const num = cleanStr === '' ? 0 : parseInt(cleanStr, 10);
    const clamped = Math.max(0, Math.min(30, num));
    setEscortCount(clamped);

    setEscorts(prev => {
      if (prev.length < clamped) {
        const toAdd: AppointedEscortItem[] = [];
        for (let i = prev.length; i < clamped; i++) {
          toAdd.push({
            id: `ESC_${udiseCode}_${Date.now()}_${i + 1}`,
            escortName: '',
            roleOrRelation: 'Parent / Escort Guide',
            contactNumber: '',
          });
        }
        return [...prev, ...toAdd];
      } else if (prev.length > clamped) {
        return prev.slice(0, clamped);
      }
      return prev;
    });
  };

  const handleUpdateEscort = (index: number, field: keyof AppointedEscortItem, value: string) => {
    if (isAppointedFrozen) return;
    setEscorts(prev => prev.map((e, i) => {
      if (i === index) {
        if (field === 'contactNumber') {
          return { ...e, contactNumber: value.replace(/\D/g, '').slice(0, 10) };
        }
        return { ...e, [field]: value };
      }
      return e;
    }));
  };

  // Save & Freeze appointed details
  const handleSaveAppointed = () => {
    setIsAppointedFrozen(true);
    setAppointedSaveSuccessToast(true);
    setTimeout(() => {
      setAppointedSaveSuccessToast(false);
    }, 1000); // exactly 1 second as requested
  };

  // Edit appointed details
  const handleEditAppointed = () => {
    setIsAppointedFrozen(false);
  };

  // SMC Approval & Resolution States (Persistent across monthly claims)
  const smcFileInputRef = useRef<HTMLInputElement>(null);
  const [smcResolutionDoc, setSmcResolutionDoc] = useState<{
    url: string;
    name: string;
    type: 'pdf' | 'image';
    size: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(`smc_resolution_${udiseCode}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [viewingSmcResolution, setViewingSmcResolution] = useState<boolean>(false);

  // SMC Bank Details States (Cleared by default, no auto-fill)
  const [smcBankDetails, setSmcBankDetails] = useState<{
    accountHolderName: string;
    branch: string;
    ifscCode: string;
    accountNumber: string;
  }>(() => {
    try {
      const saved = localStorage.getItem(`smc_bank_${udiseCode}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      accountHolderName: '',
      branch: '',
      ifscCode: '',
      accountNumber: '',
    };
  });

  const [isSmcFrozen, setIsSmcFrozen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`smc_bank_${udiseCode}`);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      if (!parsed.accountNumber || !parsed.accountNumber.trim()) return false;
      const frozenState = localStorage.getItem(`smc_frozen_${udiseCode}`);
      return frozenState !== null ? frozenState === 'true' : false;
    } catch {
      return false;
    }
  });

  const [smcSaveSuccessToast, setSmcSaveSuccessToast] = useState<boolean>(false);
  const [showClaimTableUnderPrint, setShowClaimTableUnderPrint] = useState<boolean>(false);

  // Upload SMC resolution handler (accepts pdf or image)
  const handleSmcResolutionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSmcFrozen) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/');

    if (!isPdf && !isImg) {
      alert('Please upload a valid PDF or Image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const docData = {
        url: reader.result as string,
        name: file.name,
        type: (isPdf ? 'pdf' : 'image') as 'pdf' | 'image',
        size: file.size,
      };
      setSmcResolutionDoc(docData);
      try {
        localStorage.setItem(`smc_resolution_${udiseCode}`, JSON.stringify(docData));
      } catch (err) {
        console.warn('localStorage save warning:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save SMC Bank Details & freeze
  const handleSaveSmc = () => {
    setIsSmcFrozen(true);
    try {
      localStorage.setItem(`smc_bank_${udiseCode}`, JSON.stringify(smcBankDetails));
      localStorage.setItem(`smc_frozen_${udiseCode}`, 'true');
      if (smcResolutionDoc) {
        localStorage.setItem(`smc_resolution_${udiseCode}`, JSON.stringify(smcResolutionDoc));
      }
    } catch (err) {
      console.warn('localStorage save warning:', err);
    }
    setSmcSaveSuccessToast(true);
    setTimeout(() => {
      setSmcSaveSuccessToast(false);
    }, 1000); // 1-second message as requested
  };

  // Edit SMC Bank Details
  const handleEditSmc = () => {
    setIsSmcFrozen(false);
    try {
      localStorage.setItem(`smc_frozen_${udiseCode}`, 'false');
    } catch (err) {
      console.warn('localStorage save warning:', err);
    }
  };

  // Handler for Edit button in Claim Verification section:
  // Enables editing on working days and student details, scrolls up to working days section
  const handleEditFromVerification = () => {
    setIsEditModeAfterSubmit(true);
    setIsClaimVerified(false);
    const target = document.getElementById('working-days-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handler for Verify button in Claim Verification section:
  // Shows "Verified successfully" with tick mark for 2 seconds then moves to next step
  const handleVerifyClaim = () => {
    setIsClaimVerified(true);
    claimStore.updateSchoolClaimWorkflowStatus(udiseCode, { isClaimVerified: true });
    setVerifySuccessToast('Verified successfully');
    setTimeout(() => {
      setVerifySuccessToast(null);
      const nextStep = document.getElementById('appointed-details-section');
      if (nextStep) {
        nextStep.scrollIntoView({ behavior: 'smooth' });
      }
    }, 2000);
  };

  // PDF Viewer Zoom Scale (Fix for Google Chrome native document rendering)
  const [pdfViewerZoom, setPdfViewerZoom] = useState<number>(100);

  // Hidden inputs for camera capture & gallery image upload
  const attendanceCameraInputRef = useRef<HTMLInputElement>(null);
  const attendanceGalleryInputRef = useRef<HTMLInputElement>(null);
  const usageCameraInputRef = useRef<HTMLInputElement>(null);
  const usageGalleryInputRef = useRef<HTMLInputElement>(null);
  const replaceUsagePhotoInputRef = useRef<HTMLInputElement>(null);

  // Load or reset uploaded documents & usage photos on cycle change
  useEffect(() => {
    setAttendancePages([]);
    setMergedPdfUrl(null);
    setMergedPdfBlob(null);

    const currentClaims = claimStore.getState().schoolClaims;
    const existingClaim = currentClaims.find(
      (c) => c.udiseCode === schoolData.udiseCode && c.claimMonthKey === cycleInfo.claimMonthKey
    );
    if (existingClaim?.usagePhotos && existingClaim.usagePhotos.length > 0) {
      setUsagePhotos(
        existingClaim.usagePhotos.map((p) => ({
          id: p.id,
          name: p.name,
          dataUrl: p.dataUrl,
          storageUrl: p.storageUrl,
          uploadedAt: p.uploadedAt,
        }))
      );
      setIsUsagePhotosSaved(true);
    } else {
      const draftKey = `usage_photos_${schoolData.udiseCode}_${cycleInfo.claimMonthKey}`;
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsagePhotos(parsed);
            setIsUsagePhotosSaved(true);
            return;
          }
        }
      } catch (e) {}
      setUsagePhotos([]);
      setIsUsagePhotosSaved(false);
    }
  }, [cycleInfo.claimMonthKey, schoolData.udiseCode]);

  // Handle adding usage photos with strict limit of 4 photos and duplicate prevention
  const handleAddUsagePhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUsageAlertMsg(null);

    const availableSlots = 4 - usagePhotos.length;
    if (availableSlots <= 0) {
      setUsageAlertMsg('Maximum 4 usage photos allowed. Please delete or edit an existing photo.');
      setTimeout(() => setUsageAlertMsg(null), 3500);
      return;
    }

    const fileList = Array.from(files).slice(0, availableSlots);

    for (const file of fileList) {
      const isDuplicate = usagePhotos.some(
        (p) => p.name.toLowerCase() === file.name.toLowerCase()
      );
      if (isDuplicate) {
        setUsageAlertMsg(`Duplicate photo detected! "${file.name}" has already been added.`);
        setTimeout(() => setUsageAlertMsg(null), 3500);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUsagePhotos((prev) => {
          if (prev.length >= 4) return prev;
          const isContentDuplicate = prev.some((p) => p.dataUrl === dataUrl);
          if (isContentDuplicate) {
            setUsageAlertMsg('Duplicate photo detected! This photo is already added.');
            setTimeout(() => setUsageAlertMsg(null), 3500);
            return prev;
          }
          const newItem: UsagePhotoItem = {
            id: `USAGE_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            dataUrl,
            file,
            uploadedAt: new Date().toLocaleTimeString(),
          };
          return [...prev, newItem];
        });
        setIsUsagePhotosSaved(false); // Enable Save button
      };
      reader.readAsDataURL(file);
    }
  };

  // Replace an existing usage photo
  const handleReplaceUsagePhoto = (files: FileList | null) => {
    if (!files || files.length === 0 || !editingUsagePhotoId) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUsagePhotos((prev) =>
        prev.map((p) =>
          p.id === editingUsagePhotoId
            ? { ...p, name: file.name, dataUrl, file, uploadedAt: new Date().toLocaleTimeString() }
            : p
        )
      );
      setEditingUsagePhotoId(null);
      setIsUsagePhotosSaved(false); // Enable Save button again
    };
    reader.readAsDataURL(file);
  };

  // Delete an existing usage photo
  const handleDeleteUsagePhoto = (id: string) => {
    setUsagePhotos((prev) => prev.filter((p) => p.id !== id));
    setIsUsagePhotosSaved(false); // Enable Save button again
  };

  // Save Usage Photos with school name in specific folder in Supabase storage
  const handleSaveUsagePhotos = async () => {
    if (usagePhotos.length === 0) {
      setUsageAlertMsg('Please upload at least one transport/escort usage photo to save.');
      setTimeout(() => setUsageAlertMsg(null), 3000);
      return;
    }

    // Immediately disappear save button
    setIsUsagePhotosSaved(true);

    // And the message ‘ saved successfully ‘ appears immediately
    setUsageSaveSuccessToast('saved successfully');

    // After two seconds this message disappears
    setTimeout(() => {
      setUsageSaveSuccessToast(null);
    }, 2000);

    // Save in Supabase storage: folder specific to school name
    for (const photo of usagePhotos) {
      if (photo.file) {
        uploadUsagePhotoToSupabaseStorage(schoolData.schoolName, photo.file, photo.name);
      }
    }

    // Persist in claimStore
    claimStore.saveUsagePhotos(
      schoolData.udiseCode,
      cycleInfo.claimMonthKey,
      usagePhotos.map((p) => ({
        id: p.id,
        name: p.name,
        dataUrl: p.dataUrl,
        storageUrl: p.storageUrl,
        uploadedAt: p.uploadedAt,
      }))
    );
  };

  // Handle adding photos/documents with strict duplicate detection
  const handleAddAttendanceFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDuplicateAlertMsg(null);

    const fileList = Array.from(files);

    for (const file of fileList) {
      // 1. Check duplicate by filename and exact byte size
      const isDuplicateMeta = attendancePages.some(
        (p) => p.name.toLowerCase() === file.name.toLowerCase() && p.size === file.size
      );

      if (isDuplicateMeta) {
        setDuplicateAlertMsg(`Duplicate photo detected! "${file.name}" has already been added.`);
        setTimeout(() => setDuplicateAlertMsg(null), 3500);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        setAttendancePages((prev) => {
          // 2. Check duplicate by dataUrl content
          const isContentDuplicate = prev.some((p) => p.dataUrl === dataUrl);
          if (isContentDuplicate) {
            setDuplicateAlertMsg('Duplicate photo detected! This document has already been added.');
            setTimeout(() => setDuplicateAlertMsg(null), 3500);
            return prev;
          }

          const newPage: UploadedAttendancePage = {
            id: `PAGE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            dataUrl,
            pageNumber: prev.length + 1,
          };
          return [...prev, newPage];
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert attached images to a single merged PDF in ascending order
  const handleConvertPdf = async () => {
    if (attendancePages.length === 0) return;
    setIsConvertingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Automatically sort in ascending order (Page 1, Page 2, Page 3...)
      const sorted = [...attendancePages].sort((a, b) => a.pageNumber - b.pageNumber);

      for (let i = 0; i < sorted.length; i++) {
        if (i > 0) doc.addPage();
        const page = sorted[i];

        // Official Government Header on each page
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        doc.text(`Samagra Shiksha - ${schoolData.schoolName} (${schoolData.udiseCode})`, 12, 10);
        doc.text(`Students Attendance Copy · ${previousMonthName} · Page ${i + 1} of ${sorted.length}`, pageWidth - 12, 10, { align: 'right' });
        doc.setDrawColor(210, 210, 210);
        doc.line(12, 12, pageWidth - 12, 12);

        // Scaled image to fit cleanly on A4
        doc.addImage(page.dataUrl, 'JPEG', 12, 15, pageWidth - 24, pageHeight - 27, undefined, 'FAST');
      }

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setMergedPdfBlob(pdfBlob);
      setMergedPdfUrl(pdfUrl);
      setIsConvertingPdf(false);

      // Asynchronously upload merged attendance PDF to Supabase storage bucket 'attendance_documents'
      uploadProofToSupabaseStorage(pdfBlob, `Attendance_${schoolData.udiseCode}_${previousMonthName}.pdf`).catch((e) => {
        console.warn('Notice uploading attendance document to Supabase storage:', e);
      });
      // Raw separate images disappear and convert button automatically hides
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setIsConvertingPdf(false);
    }
  };

  // Download the merged PDF
  const handleDownloadPdf = () => {
    if (!mergedPdfBlob && !mergedPdfUrl) return;
    const link = document.createElement('a');
    link.href = mergedPdfUrl || '';
    link.download = `Attendance_Copy_${schoolData.udiseCode}_${previousMonthName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Replace PDF: user clicks pencil icon -> camera icon and convert PDF button enable again
  const handleReplacePdf = () => {
    setMergedPdfUrl(null);
    setMergedPdfBlob(null);
  };

  const handleRemoveAttendancePage = (pageId: string) => {
    setAttendancePages((prev) => {
      const filtered = prev.filter((p) => p.id !== pageId);
      // Re-index page numbers in ascending order
      return filtered.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });
  };

  // Initialize student rows if existing claim is present, or auto-fetch from Supabase master table
  useEffect(() => {
    if (existingClaim && existingClaim.students && existingClaim.students.length > 0) {
      setStudentRows(existingClaim.students);
      setStudentsLoaded(true);
      setSavedStudentIds(new Set(existingClaim.students.map(s => s.id)));
    } else if (udiseCode) {
      // Auto-load master students from Supabase database
      fetchSchoolStudentsMaster(udiseCode, totalWorkingDays).then(fetchedStudents => {
        if (fetchedStudents && fetchedStudents.length > 0) {
          setStudentRows(fetchedStudents);
          setStudentsLoaded(true);
          if (existingClaim) {
            existingClaim.students = fetchedStudents;
            setSavedStudentIds(new Set(fetchedStudents.map(s => s.id)));
          }
        }
      }).catch(() => {});
    }
  }, [existingClaim, udiseCode, totalWorkingDays]);

  // Handler: Click "Fetch Students" button -> Gemini spinner loads -> pull master data -> button disappears
  const handleFetchStudents = async () => {
    setIsFetchingStudents(true);
    try {
      const fetchedStudents = await fetchSchoolStudentsMaster(udiseCode, totalWorkingDays);
      setTimeout(() => {
        setStudentRows(fetchedStudents);
        setIsFetchingStudents(false);
        setStudentsLoaded(true);
      }, 750);
    } catch (err) {
      setIsFetchingStudents(false);
      setStudentsLoaded(true);
    }
  };

  // Sync working days change (allow 0 as initial embedded value)
  const handleWorkingDaysChange = (newDays: number) => {
    const val = Math.max(0, Math.min(31, isNaN(newDays) ? 0 : newDays));
    setTotalWorkingDays(val);
    setStudentRows(prevRows => prevRows.map(row => {
      const attended = Math.min(row.daysAttended, val);
      return {
        ...row,
        workingDaysInMonth: val,
        daysAttended: attended,
        totalClaimAmount: calculateStudentClaimAmount(attended, val),
      };
    }));
  };

  // Open Claim Details Modal for a student with zoom in effect
  const handleOpenStudentClaim = (student: StudentClaimItem) => {
    setSelectedStudent(student);
    setIsZoomingOut(false);
    // Embedded 0 if not previously entered, no auto-fill
    setAvailedDaysInput(String(student.daysAttended || 0));
    setValidationAlertMsg(null);
    setEditedStudentForm({
      studentName: student.studentName,
      emisNumber: student.emisNumber,
      grade: student.grade,
      fatherName: student.fatherName || '',
      habitationName: student.habitationName || '',
      contactNumber: student.contactNumber || '',
    });
    setIsEditingMasterDetails(false);
    setMasterSaveNotice(null);
  };

  // Photo upload / change handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedStudent) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const photoDataUrl = reader.result as string;

      // 1. Update local student rows immediately for snappy UI
      setStudentRows(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, photoUrl: photoDataUrl } : s));
      setSelectedStudent(prev => prev ? { ...prev, photoUrl: photoDataUrl } : null);

      // 2. Upload to Supabase storage bucket 'student_photos'
      let finalPhotoUrl = photoDataUrl;
      try {
        const uploadRes = await uploadStudentPhotoToStorage(file, `${selectedStudent.emisNumber || selectedStudent.id}.jpg`);
        if (uploadRes.success && uploadRes.publicUrl) {
          finalPhotoUrl = uploadRes.publicUrl;
          // Update with remote public URL
          setStudentRows(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, photoUrl: finalPhotoUrl } : s));
          setSelectedStudent(prev => prev ? { ...prev, photoUrl: finalPhotoUrl } : null);
        }
      } catch (err) {
        console.warn('Notice uploading student photo to Supabase storage:', err);
      }

      // 3. Save in Supabase master table (last column: photo_url)
      await updateStudentMasterData(selectedStudent.id, { photoUrl: finalPhotoUrl });

      setMasterSaveNotice('Photo updated and saved to Supabase master database.');
      setTimeout(() => setMasterSaveNotice(null), 3000);
    };

    reader.readAsDataURL(file);
  };

  // Save modified student master details to Supabase
  const handleSaveMasterDetails = async () => {
    if (!selectedStudent) return;
    setIsSavingMaster(true);

    const updates = {
      studentName: editedStudentForm.studentName || selectedStudent.studentName,
      emisNumber: editedStudentForm.emisNumber || selectedStudent.emisNumber,
      grade: editedStudentForm.grade || selectedStudent.grade,
      fatherName: editedStudentForm.fatherName || '',
      habitationName: editedStudentForm.habitationName || '',
      contactNumber: editedStudentForm.contactNumber || '',
    };

    // Update in Supabase
    await updateStudentMasterData(selectedStudent.id, updates);

    // Update locally in student rows
    setStudentRows(prev => prev.map(s => {
      if (s.id === selectedStudent.id) {
        return {
          ...s,
          ...updates,
        };
      }
      return s;
    }));

    setSelectedStudent(prev => prev ? {
      ...prev,
      ...updates,
    } : null);

    setIsSavingMaster(false);
    setIsEditingMasterDetails(false);
    setMasterSaveNotice('Student details updated and synced to Supabase master database.');
    setTimeout(() => setMasterSaveNotice(null), 3000);
  };

  // Click SAVE Button inside student zoom card: Validates availed days, saves, zooms out, replaces Claim with Green Tick & Blue Pencil
  const handleSaveStudentAvailedDays = () => {
    if (!selectedStudent) return;

    const daysNum = parseInt(availedDaysInput, 10);

    if (totalWorkingDays <= 0) {
      setValidationAlertMsg('Please first enter Total number of School working days in Section 2 above.');
      setTimeout(() => setValidationAlertMsg(null), 3000);
      return;
    }

    // Validation: automatically validate from total number of working days
    if (isNaN(daysNum) || daysNum < 0 || daysNum > totalWorkingDays) {
      setValidationAlertMsg(`Invalid availed days! Must be between 0 and total working days (${totalWorkingDays} days).`);
      setTimeout(() => setValidationAlertMsg(null), 3000);
      return;
    }

    // Valid: save student details (availed days) using policy calculation
    const newAmount = calculateStudentClaimAmount(daysNum, totalWorkingDays);
    setStudentRows(prev => prev.map(s => {
      if (s.id === selectedStudent.id) {
        return {
          ...s,
          daysAttended: daysNum,
          totalClaimAmount: newAmount,
        };
      }
      return s;
    }));

    // Mark as saved for this student
    setSavedStudentIds(prev => new Set([...prev, selectedStudent.id]));

    // Student details card zooms out and disappears, restoring blurred list
    setIsZoomingOut(true);
    setTimeout(() => {
      setSelectedStudent(null);
      setIsZoomingOut(false);
    }, 200);
  };

  // Click BACK Button inside student zoom card: Does not save availed days, zooms out and restores blurred list
  const handleBackFromStudentCard = () => {
    setIsZoomingOut(true);
    setTimeout(() => {
      setSelectedStudent(null);
      setIsZoomingOut(false);
    }, 200);
  };

  const handleAddStudentRow = (category: 'Transport' | 'Escort') => {
    if (existingClaim) {
      setShowDuplicateModal(true);
      return;
    }
    const newIndex = studentRows.length + 1;
    const rate = category === 'Escort' ? 40 : 30;
    const newStudent: StudentClaimItem = {
      id: `STU_${udiseCode}_${Date.now()}`,
      studentName: 'New Student',
      emisNumber: `${udiseCode}${String(newIndex).padStart(3, '0')}`,
      grade: '9 Std - A section',
      category: category,
      workingDaysInMonth: totalWorkingDays,
      daysAttended: 0, // embedded 0, no auto-fill
      ratePerDay: rate,
      totalClaimAmount: 0,
      serviceProviderName: category === 'Escort' ? 'Parent / Escort Helper' : 'Van Transport Facilitator',
      fatherName: '',
      habitationName: '',
      contactNumber: '',
      photoUrl: '',
    };
    setStudentRows([...studentRows, newStudent]);
    handleOpenStudentClaim(newStudent);
  };

  const handleRemoveStudent = (id: string) => {
    if (existingClaim) {
      setShowDuplicateModal(true);
      return;
    }
    setStudentRows(studentRows.filter(s => s.id !== id));
    if (selectedStudent?.id === id) setSelectedStudent(null);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setUncompletedAlertMsg(null);

    if (existingClaim && !isEditModeAfterSubmit) {
      setShowDuplicateModal(true);
      return;
    }

    if (studentRows.length === 0) {
      setErrorMsg('Please click "Fetch students" or add student beneficiaries to submit.');
      return;
    }

    // CHECK: All students details are fully completed and had green colour tick mark then only work submit button
    const uncompletedList = studentRows.filter(s => !savedStudentIds.has(s.id));
    if (uncompletedList.length > 0) {
      setShowUncompletedIndicators(true);
      setUncompletedAlertMsg(`All students details are fully completed and had green colour tick mark then only work submit button. Please complete ${uncompletedList.length} remaining student(s).`);
      setTimeout(() => setUncompletedAlertMsg(null), 3500);
      return;
    }

    for (const r of studentRows) {
      if (!r.studentName.trim()) {
        setErrorMsg('Please enter student name for all rows.');
        return;
      }
      if (r.daysAttended <= 0) {
        setErrorMsg(`Days attended for ${r.studentName} must be greater than zero.`);
        return;
      }
      if (r.daysAttended > r.workingDaysInMonth) {
        setErrorMsg(`Days attended cannot exceed working days (${r.workingDaysInMonth}) for ${r.studentName}.`);
        return;
      }
    }

    const result = claimStore.submitSchoolClaim(
      udiseCode,
      studentRows,
      submittedByName || currentUser.name,
      vehicles,
      escorts,
      undefined,
      isEditModeAfterSubmit,
      {
        isClaimSubmitted: true,
        isClaimVerified: true,
        hmDeclarationCompleted: true,
        isForwardedToBlock: true,
      }
    );

    // Immediately hide submit claim button, pencil icon disappears, all students details are freezed
    setIsClaimSubmitted(true);
    setIsClaimVerified(true);
    setHmDeclarationAccepted(true);
    setIsForwardedToBlock(true);
    setIsEditModeAfterSubmit(false);
    setShowUncompletedIndicators(false);

    // Shows a message "your claim submitted successfully" with tick mark
    // after 2 seconds this is automatically disappear then immediately appear an edit button
    setSuccessToast2Sec('your claim submitted successfully');
    setTimeout(() => {
      setSuccessToast2Sec(null);
    }, 2000);

    // Force cross-tab and live store sync
    claimStore.syncFromSupabase().catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }

    onRefresh();
  };

  // Categorize students
  const transportStudents = studentRows.filter(s => s.category === 'Transport');
  const escortStudents = studentRows.filter(s => s.category === 'Escort');

  const totalTransportAmount = transportStudents.reduce((sum, s) => sum + s.totalClaimAmount, 0);
  const totalEscortAmount = escortStudents.reduce((sum, s) => sum + s.totalClaimAmount, 0);
  const grandTotalAmount = totalTransportAmount + totalEscortAmount;

  // Facility presence flags: if school has only Transport, only Transport field appears. If only Escort, only Escort field appears.
  const hasTransportFacility = transportStudents.length > 0;
  const hasEscortFacility = escortStudents.length > 0;
  const showTransportSection = hasTransportFacility || (!hasTransportFacility && !hasEscortFacility);
  const showEscortSection = hasEscortFacility || (!hasTransportFacility && !hasEscortFacility);

  const isDistrictApproved = existingClaim && (
    existingClaim.status === 'DISTRICT_APPROVED' ||
    existingClaim.status === 'FINAL_DISTRICT_APPROVAL'
  );

  return (
    <div className="space-y-6 relative">
      {/* Hidden File Input for Student Passport Photo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="user"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Hidden File Input for SMC Resolution Document (PDF or JPEG Image) */}
      <input
        type="file"
        ref={smcFileInputRef}
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/*,.pdf,.jpg,.jpeg,.png"
        onChange={handleSmcResolutionUpload}
        className="hidden"
      />

      {/* 2-Second Temporary "your claim submitted successfully" Toast with Tick Mark */}
      {successToast2Sec && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-emerald-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="tracking-wide">{successToast2Sec}</span>
          </div>
        </div>
      )}

      {/* 2-Second Temporary "Verified successfully" Toast with Tick Mark */}
      {verifySuccessToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-emerald-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="tracking-wide capitalize">{verifySuccessToast}</span>
          </div>
        </div>
      )}

      {/* Uncompleted Submission Alert Popup Message */}
      {uncompletedAlertMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200 max-w-lg">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-red-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="tracking-wide">{uncompletedAlertMsg}</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ZOOM-IN / ZOOM-OUT STUDENT DETAILS CARD MODAL            */}
      {/* ======================================================== */}
      {selectedStudent && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md transition-opacity duration-200 ${
            isZoomingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* Validation Alert Popup */}
          {validationAlertMsg && (
            <div className="fixed top-8 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-red-500/50 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-red-500/30">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="tracking-wide">{validationAlertMsg}</span>
              </div>
            </div>
          )}

          <div 
            className={`relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 ease-out ${
              isZoomingOut ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            
            {/* Modal Header Bar */}
            <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xs">
                  <MaterialIcon name="badge" className="text-lg text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      Student Claim Profile &amp; Beneficiary Card
                    </h3>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${
                      selectedStudent.category === 'Transport'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                    }`}>
                      {selectedStudent.category} Facility
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Samagra Shiksha TN · Transport and Escort Claim Management
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBackFromStudentCard}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/15"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification message */}
            {masterSaveNotice && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold flex items-center gap-2 animate-in fade-in shadow-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{masterSaveNotice}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* TOP ROW: Photo (Left) & Student Master Details (Right) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
                
                {/* LEFT: Elevated Passport Photo Box */}
                <div className="sm:col-span-5 flex flex-col items-center">
                  <div className="relative group w-38 sm:w-40 h-50 sm:h-52 rounded-2xl overflow-hidden border-2 border-indigo-200/80 bg-gradient-to-b from-slate-100 to-slate-200 shadow-md flex items-center justify-center ring-4 ring-indigo-50/50">
                    {/* Official badge in top corner */}
                    <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded bg-slate-900/60 backdrop-blur-xs text-[9px] font-mono font-bold text-white uppercase tracking-wider">
                      TN-EMIS
                    </div>

                    {selectedStudent.photoUrl ? (
                      <>
                        <img
                          src={selectedStudent.photoUrl}
                          alt={selectedStudent.studentName}
                          className="w-full h-full object-cover object-center select-none"
                        />
                        {/* Blue colour pencil icon on hover */}
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 cursor-pointer backdrop-blur-2xs text-white"
                          title="Click to view and update photo"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                            <Pencil className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Update Photo</span>
                        </div>
                      </>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-slate-200/70 transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-white group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-600 flex items-center justify-center mb-2 shadow-xs transition-colors border border-slate-200">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Add Photo</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">Camera / Gallery</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 mt-2 text-center tracking-wide">
                    Official Passport Photo · 3.5×4.5 cm
                  </span>
                </div>

                {/* RIGHT: Student Details (Aligned Key-Value Layout) */}
                <div className="sm:col-span-7">
                  {!isEditingMasterDetails ? (
                    <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Student Profile Information
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingMasterDetails(true)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <MaterialIcon name="edit" className="text-xs" />
                          <span>Edit</span>
                        </button>
                      </div>

                      {/* Clean Aligned 2-Column Key-Value List */}
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">student Name</span>
                          <span className="text-slate-400 font-bold">:</span>
                          <span className="font-bold text-slate-900 text-sm sm:text-base">{selectedStudent.studentName}</span>
                        </div>

                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">Class &amp; section</span>
                          <span className="text-slate-400 font-bold">:</span>
                          <span className="font-bold text-slate-900">{selectedStudent.grade}</span>
                        </div>

                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">EMIS Number</span>
                          <span className="text-slate-400 font-bold">:</span>
                          <span className="font-mono font-bold text-slate-800">{selectedStudent.emisNumber}</span>
                        </div>

                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">Facility Type</span>
                          <span className="text-slate-400 font-bold">:</span>
                          <span className="font-semibold text-emerald-800">{selectedStudent.category} Facility</span>
                        </div>

                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">Father Name</span>
                          <span className="text-slate-400 font-bold">:</span>
                          {selectedStudent.fatherName ? (
                            <span className="font-semibold text-slate-900">{selectedStudent.fatherName}</span>
                          ) : (
                            <span className="text-amber-600 font-medium italic cursor-pointer underline text-xs" onClick={() => setIsEditingMasterDetails(true)}>
                              + Add Father Name
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">Habitation Name</span>
                          <span className="text-slate-400 font-bold">:</span>
                          {selectedStudent.habitationName ? (
                            <span className="font-semibold text-slate-900">{selectedStudent.habitationName}</span>
                          ) : (
                            <span className="text-amber-600 font-medium italic cursor-pointer underline text-xs" onClick={() => setIsEditingMasterDetails(true)}>
                              + Add Habitation
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-[130px_14px_1fr] items-baseline">
                          <span className="font-semibold text-slate-600">Contact Number</span>
                          <span className="text-slate-400 font-bold">:</span>
                          {selectedStudent.contactNumber ? (
                            <span className="font-mono font-semibold text-slate-900">{selectedStudent.contactNumber}</span>
                          ) : (
                            <span className="text-amber-600 font-medium italic cursor-pointer underline text-xs" onClick={() => setIsEditingMasterDetails(true)}>
                              + Add Contact Number
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Inline Editing Mode */
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                        <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">Edit Master Data</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingMasterDetails(false)}
                          className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student Name</label>
                        <input
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          value={editedStudentForm.studentName || ''}
                          onChange={(e) => setEditedStudentForm({ ...editedStudentForm, studentName: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">EMIS No</label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-form-type="other"
                            value={editedStudentForm.emisNumber || ''}
                            onChange={(e) => setEditedStudentForm({ ...editedStudentForm, emisNumber: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Class</label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-form-type="other"
                            value={editedStudentForm.grade || ''}
                            onChange={(e) => setEditedStudentForm({ ...editedStudentForm, grade: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Father Name</label>
                        <input
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          value={editedStudentForm.fatherName || ''}
                          onChange={(e) => setEditedStudentForm({ ...editedStudentForm, fatherName: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                          placeholder="Enter father name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Habitation Name</label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-form-type="other"
                            value={editedStudentForm.habitationName || ''}
                            onChange={(e) => setEditedStudentForm({ ...editedStudentForm, habitationName: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            placeholder="Village / Ward"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Number</label>
                          <input
                            type="tel"
                            maxLength={10}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-form-type="other"
                            value={editedStudentForm.contactNumber || ''}
                            onChange={(e) => setEditedStudentForm({ ...editedStudentForm, contactNumber: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            placeholder="10-digit mobile"
                          />
                        </div>
                      </div>

                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          disabled={isSavingMaster}
                          onClick={handleSaveMasterDetails}
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          <MaterialIcon name="save" className="text-xs" />
                          <span>{isSavingMaster ? 'Saving to Supabase...' : 'Save to Master'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* ======================================================== */}
              {/* FACILITY AVAILED DAYS CLAIM CALCULATOR                   */}
              {/* ======================================================== */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 shadow-2xs space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-[160px_14px_1fr] items-center gap-1 sm:gap-0 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-700">Days Availed ({previousMonthName})</span>
                  <span className="text-slate-400 font-bold hidden sm:inline">:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={(parseInt(availedDaysInput, 10) || 0) <= 0}
                      onClick={() => {
                        const cur = parseInt(availedDaysInput, 10) || 0;
                        if (cur > 0) setAvailedDaysInput(String(cur - 1));
                      }}
                      className="w-8 h-8 rounded-lg bg-white hover:bg-emerald-100 active:scale-90 disabled:opacity-40 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-base shadow-2xs transition-all cursor-pointer"
                      title="Decrease 1 day"
                    >
                      −
                    </button>

                    <input
                      id="availed-days-input"
                      type="number"
                      min={0}
                      max={totalWorkingDays || 31}
                      required
                      autoComplete="off"
                      autoCorrect="off"
                      name="availed_days_noautofill"
                      disabled={!!existingClaim && !isEditModeAfterSubmit}
                      value={availedDaysInput}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setAvailedDaysInput('0');
                          return;
                        }
                        const cleaned = raw.replace(/^0+(?=\d)/, '');
                        const num = parseInt(cleaned, 10);
                        if (!isNaN(num) && totalWorkingDays > 0 && num > totalWorkingDays) {
                          setAvailedDaysInput(String(totalWorkingDays));
                        } else {
                          setAvailedDaysInput(cleaned);
                        }
                      }}
                      className="w-16 py-1 text-center font-mono font-bold text-base text-slate-900 bg-white border border-emerald-400 rounded-lg shadow-inner focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="0"
                    />

                    <button
                      type="button"
                      disabled={totalWorkingDays > 0 && (parseInt(availedDaysInput, 10) || 0) >= totalWorkingDays}
                      onClick={() => {
                        const cur = parseInt(availedDaysInput, 10) || 0;
                        if (totalWorkingDays > 0 && cur < totalWorkingDays) {
                          setAvailedDaysInput(String(cur + 1));
                        } else if (totalWorkingDays === 0) {
                          setAvailedDaysInput(String(cur + 1));
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-white hover:bg-emerald-100 active:scale-90 disabled:opacity-40 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-base shadow-2xs transition-all cursor-pointer"
                      title="Increase 1 day"
                    >
                      +
                    </button>

                    <span className="text-xs font-semibold text-slate-600 font-mono">
                      / {totalWorkingDays} Working Days
                    </span>

                    <button
                      type="button"
                      onClick={() => setAvailedDaysInput(String(totalWorkingDays))}
                      className="ml-auto px-2.5 py-1 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs cursor-pointer active:scale-95 transition-all"
                    >
                      Full Month
                    </button>
                  </div>
                </div>

                {/* Calculation breakdown */}
                {(() => {
                  const inputDays = parseInt(availedDaysInput, 10) || 0;
                  const calculatedAmount = calculateStudentClaimAmount(inputDays, totalWorkingDays);
                  const attendancePct = totalWorkingDays > 0 ? ((inputDays / totalWorkingDays) * 100).toFixed(1) : '0';
                  const isAbove75 = Number(attendancePct) >= 75;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-[160px_14px_1fr] items-center gap-1 sm:gap-0 text-xs sm:text-sm pt-2.5 border-t border-emerald-200/80">
                      <span className="font-semibold text-slate-700">Calculated Claim Amount</span>
                      <span className="text-slate-400 font-bold hidden sm:inline">:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="font-mono text-emerald-900 text-base font-extrabold">
                          ₹{calculatedAmount.toLocaleString('en-IN')}
                        </strong>
                        <span className="text-[11px] font-semibold text-slate-600">
                          ({attendancePct}% Attendance · {inputDays <= 0 ? '₹0' : isAbove75 ? 'Flat ₹600 Rate' : `Pro-rata`})
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* MODAL FOOTER ACTIONS: BACK & SAVE */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                  Ensure working days match school physical attendance registers.
                </span>

                <div className="flex items-center gap-3 ml-auto">
                  {/* Back Button */}
                  <button
                    type="button"
                    onClick={handleBackFromStudentCard}
                    className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <MaterialIcon name="arrow_back" className="text-sm" />
                    <span>Back</span>
                  </button>

                  {/* Save Button */}
                  <button
                    type="button"
                    disabled={!!existingClaim && !isEditModeAfterSubmit}
                    onClick={handleSaveStudentAvailedDays}
                    className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <MaterialIcon name="save" className="text-sm" />
                    <span>Save Claim Details</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* DUPLICATE SUBMISSION MODAL */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Claim Already Submitted</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                <strong className="font-semibold text-slate-800">{cycleInfo.claimMonthOnlyName} month salary claim already submitted.</strong> Do you want to view the previously submitted details?
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    setViewReadOnlyModal(true);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MaterialIcon name="visibility" className="text-sm" />
                  <span>View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW READ-ONLY SUBMITTED CLAIM MODAL */}
      {viewReadOnlyModal && existingClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  Submitted Claim: {existingClaim.schoolName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  UDISE: <span className="font-mono tabular-nums">{existingClaim.udiseCode}</span> · Block: {existingClaim.blockName} · Month: {existingClaim.claimMonthName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printClaimReceiptSheet(existingClaim)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-full hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Print official claim receipt"
                >
                  <MaterialIcon name="print" className="text-sm text-slate-600" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadClaimReceiptPdf(existingClaim)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Download receipt as PDF file"
                >
                  <MaterialIcon name="download" className="text-sm" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewReadOnlyModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                  title="Close"
                >
                  <MaterialIcon name="close" className="text-sm" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-500 font-medium">Submission Status</div>
                  <div className="font-bold text-emerald-700 mt-0.5">{existingClaim.status.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Submitted By</div>
                  <div className="font-bold text-slate-800 mt-0.5">{existingClaim.submittedBy}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Submission Date/Time</div>
                  <div className="font-bold text-slate-800 mt-0.5 tabular-nums">{existingClaim.submissionDateTime}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Calculation Period</div>
                  <div className="font-bold text-slate-800 mt-0.5">{existingClaim.calculationPeriod}</div>
                </div>
              </div>

              {/* Table with perfect alignment, content fit, rounded corner cells & light row colours */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden p-2.5 bg-slate-50/50">
                <table className="w-full text-xs text-left border-separate border-spacing-y-1">
                  <thead className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10 first:rounded-l-lg last:rounded-r-lg align-middle text-slate-800 border-y border-slate-200">#</th>
                      <th className="py-2.5 px-3 text-left first:rounded-l-lg last:rounded-r-lg align-middle text-slate-800 border-y border-slate-200">Student Name</th>
                      <th className="py-2.5 px-3 text-center first:rounded-l-lg last:rounded-r-lg align-middle text-slate-800 border-y border-slate-200">EMIS ID</th>
                      <th className="py-2.5 px-3 text-center first:rounded-l-lg last:rounded-r-lg align-middle text-slate-800 border-y border-slate-200">Class</th>
                      <th className="py-2.5 px-3 text-center first:rounded-l-lg last:rounded-r-lg align-middle text-slate-800 border-y border-slate-200">Facility</th>
                      <th className="py-2.5 px-3 text-right first:rounded-l-lg last:rounded-r-lg whitespace-nowrap align-middle text-slate-800 border-y border-slate-200">Working Days</th>
                      <th className="py-2.5 px-3 text-right first:rounded-l-lg last:rounded-r-lg whitespace-nowrap align-middle text-slate-800 border-y border-slate-200">Days Attended</th>
                      <th className="py-2.5 px-3 text-right first:rounded-l-lg last:rounded-r-lg whitespace-nowrap align-middle text-slate-800 border-y border-slate-200">Rate/Day</th>
                      <th className="py-2.5 px-3 text-right first:rounded-l-lg last:rounded-r-lg whitespace-nowrap align-middle text-slate-800 border-y border-slate-200">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingClaim.students.map((st, i) => (
                      <tr key={st.id} className={i % 2 === 0 ? 'bg-white hover:bg-slate-50/90 transition-colors' : 'bg-slate-50/70 hover:bg-slate-100/80 transition-colors'}>
                        <td className="py-2 px-3 text-center font-mono text-slate-400 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r align-middle">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">{st.studentName}</td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">{st.emisNumber}</td>
                        <td className="py-2 px-3 text-center text-slate-700 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">{st.grade}</td>
                        <td className="py-2 px-3 text-center text-slate-700 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">{st.category}</td>
                        <td className="py-2 px-3 text-right font-mono first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">{st.workingDaysInMonth}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">{st.daysAttended}</td>
                        <td className="py-2 px-3 text-right font-mono first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">₹{st.ratePerDay}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 first:rounded-l-lg last:rounded-r-lg border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap align-middle">₹{st.totalClaimAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 text-slate-900 font-bold">
                      <td colSpan={8} className="py-2.5 px-3 text-right uppercase first:rounded-l-lg last:rounded-r-lg border-y border-slate-300 first:border-l last:border-r align-middle text-slate-800">Total Sanctioned / Claimed:</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm font-extrabold first:rounded-l-lg last:rounded-r-lg border-y border-slate-300 first:border-l last:border-r whitespace-nowrap align-middle">{formatCurrencyINR(existingClaim.totalClaimAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewReadOnlyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <MaterialIcon name="close" className="text-xs" />
                <span>Close View</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: HOME PAGE VIEW (NOTIFICATIONS & DASHBOARD)        */}
      {/* ======================================================== */}
      {activeSubTab === 'home' ? (
        <div className="bg-[#fffdfa]/90 backdrop-blur-2xl border border-orange-100/70 rounded-3xl shadow-[0_16px_36px_-8px_rgba(249,115,22,0.05),0_6px_16px_-4px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(255,255,255,1)] overflow-hidden divide-y-2 divide-slate-100 animate-in fade-in duration-300">
          
          {/* School Header Profile */}
          <div className="p-6 sm:p-7 space-y-4">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                1
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                School Information &amp; Status
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <School className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{schoolData.schoolName}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                    <span>UDISE: <strong className="font-mono text-slate-900 tabular-nums">{schoolData.udiseCode}</strong></span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>Block: <strong className="text-slate-900">{schoolData.blockName}</strong></span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>Headmaster: {defaultMeta.headmasterName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {existingClaim ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Submitted for {cycleInfo.claimMonthOnlyName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewReadOnlyModal(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-full border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <MaterialIcon name="visibility" className="text-sm" />
                      <span>View Claim</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab ? onNavigateTab('archive') : null}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-full border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="View Previous Month District Approved Claims"
                    >
                      <MaterialIcon name="calendar_month" className="text-sm text-purple-600" />
                      <span>Previous Month Claim</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateTab ? onNavigateTab('archive') : null}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-full border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="View Previous Month District Approved Claims"
                    >
                      <MaterialIcon name="calendar_month" className="text-sm text-purple-600" />
                      <span>Previous Month Claim</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab ? onNavigateTab('claim_action') : null}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-md hover:from-purple-600 hover:to-indigo-600 transition-all cursor-pointer"
                    >
                      <span>Proceed to Claim Entry Form</span>
                      <MaterialIcon name="arrow_forward" className="text-sm" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 1: NOTIFICATIONS PANEL */}
          <div className="p-6 sm:p-7 bg-slate-50/40 space-y-4">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                2
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Notifications &amp; Cycle Alerts
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>

            <div className="flex items-center justify-between mb-4 border-b border-slate-200/80 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-600 animate-bounce" />
                <span>Department Circulars &amp; Timeline</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Cycle: {previousMonthName}
              </span>
            </div>

            <div className="space-y-3">
              {!existingClaim && (
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start gap-3 shadow-xs animate-in fade-in">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-amber-900">
                        Monthly Claim Submission Required
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      After last day of the month: Transport / escort claim should be submission to block admin for the month of <strong>{previousMonthName}</strong>.
                    </p>
                    <div className="mt-2.5">
                      <button
                        onClick={() => onNavigateTab ? onNavigateTab('claim_action') : null}
                        className="px-3.5 py-1 text-xs font-semibold rounded-full bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <span>Open Claim Entry Form</span>
                        <MaterialIcon name="arrow_forward" className="text-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {existingClaim && (
                <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-start gap-3 shadow-xs animate-in fade-in">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-emerald-900">
                        Claim Successfully Submitted
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">
                        Forwarded to BEO
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      Claim submitted by school user time and date: <strong className="font-mono text-emerald-950">{existingClaim.submissionDateTime}</strong> by <strong>{existingClaim.submittedBy}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {isDistrictApproved && (
                <div className="p-4 rounded-2xl bg-emerald-100/90 border border-emerald-400 flex items-start gap-3 shadow-md animate-in fade-in">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-emerald-950">
                        Claim Approval Granted by District
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-700 px-2 py-0.5 rounded-full shadow-2xs">
                        Sanctioned
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                      District CEO / DPC Office has verified and approved the monthly claim. Total approved sanction amount: <strong className="font-mono font-bold text-emerald-950">{formatCurrencyINR(existingClaim.totalClaimAmount)}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: SCHOOL DASHBOARD */}
          <div className="p-6 sm:p-7 space-y-6">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                3
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                School Claim Metrics &amp; Audit Summary
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  School Claim Dashboard · {previousMonthName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Summary of students and amounts claimed in previous claim month
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                UDISE: {schoolData.udiseCode}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Students Claimed</span>
                  <MaterialIcon name="groups" className="text-xl text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {existingClaim ? existingClaim.totalStudents : defaultMeta.defaultBeneficiaries}
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">Beneficiaries</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Eligible Elementary &amp; Secondary students
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Amount Claimed by School</span>
                  <MaterialIcon name="description" className="text-xl text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {existingClaim ? formatCurrencyINR(existingClaim.totalClaimAmount) : formatCurrencyINR(defaultMeta.defaultBeneficiaries * totalWorkingDays * 30)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Submitted for {previousMonthName} attendance
                </div>
              </div>

              <div className={`p-4 rounded-2xl border shadow-xs ${
                isDistrictApproved ? 'bg-emerald-50/80 border-emerald-300' : 'bg-amber-50/80 border-amber-300'
              }`}>
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="text-xs font-medium">Approved Amount by District</span>
                  {isDistrictApproved ? (
                    <MaterialIcon name="check_circle" className="text-xl text-emerald-600" />
                  ) : (
                    <MaterialIcon name="schedule" className="text-xl text-amber-600" />
                  )}
                </div>
                
                {isDistrictApproved ? (
                  <>
                    <div className="text-2xl font-bold text-emerald-800 font-mono tabular-nums">
                      {formatCurrencyINR(existingClaim!.totalClaimAmount)}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                      <MaterialIcon name="auto_awesome" className="text-sm" />
                      <span>Sanction Approved by District Office</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base sm:text-lg font-bold text-amber-800 tracking-tight leading-tight mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                      <span>waiting for district approval</span>
                    </div>
                    <div className="text-[11px] text-amber-700 mt-1">
                      Claim under verification by Block / District
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* ======================================================== */
        /* TAB 2: CLAIM ENTRY FORM PAGE                             */
        /* ======================================================== */
        <div className="bg-[#fffdfa]/90 backdrop-blur-2xl border border-orange-100/70 rounded-3xl shadow-[0_16px_36px_-8px_rgba(249,115,22,0.05),0_6px_16px_-4px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(255,255,255,1)] overflow-hidden divide-y-2 divide-slate-100 animate-in fade-in duration-300">
          
          {/* SECTION 1: SCHOOL DETAILS SECTION */}
          <div className="p-6 sm:p-8 space-y-4">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                1
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                School Information
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>

            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                UDISE &amp; Institutional Profile
              </h3>
              <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Fetched from Supabase Master
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  UDISE Code
                </label>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 select-all">
                  {schoolData.udiseCode}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  School Name
                </label>
                <div className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={schoolData.schoolName}>
                  {schoolData.schoolName}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Block Name
                </label>
                <div className="text-xs sm:text-sm font-bold text-purple-800">
                  {schoolData.blockName}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: WORKING DAYS SECTION */}
          <div id="working-days-section" className="p-6 sm:p-8 space-y-4 bg-slate-50/40">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                2
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Total Working Days
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <label htmlFor="working-days-input" className="text-xs sm:text-sm font-bold text-slate-900 leading-snug cursor-pointer">
                    Total number of School working days in the month of {previousMonthName} :
                  </label>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    id="working-days-input"
                    type="number"
                    min={0}
                    max={31}
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    name="school_working_days_noautofill"
                    disabled={!!existingClaim && !isEditModeAfterSubmit}
                    value={totalWorkingDays === 0 ? '' : totalWorkingDays}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === '') {
                        handleWorkingDaysChange(0);
                        return;
                      }
                      const v = parseInt(raw, 10);
                      handleWorkingDaysChange(isNaN(v) ? 0 : Math.min(31, Math.max(0, v)));
                    }}
                    className="w-20 px-3 py-1.5 text-sm font-mono font-bold text-center text-slate-900 bg-white border border-purple-300 rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="text-xs font-semibold text-purple-800">Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: STUDENT DETAILS SECTION                       */}
          {/* ======================================================== */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                3
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Student Details
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Beneficiary Students Master List
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click the <strong>Claim</strong> button on any student to open the passport photo &amp; master profile card
                </p>
              </div>

              {/* Fetch Students Button with Gemini Spinner */}
              {!studentsLoaded && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isFetchingStudents}
                    onClick={handleFetchStudents}
                    className="px-5 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all duration-200 shadow-md shadow-emerald-900/25 flex items-center gap-2 cursor-pointer disabled:opacity-80"
                  >
                    <MaterialIcon name="download" className="text-base" />
                    <span>Fetch Students</span>
                  </button>

                  {isFetchingStudents && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 animate-in fade-in">
                      <div 
                        className="w-5 h-5 rounded-full animate-spin border-2 border-transparent"
                        style={{
                          background: 'conic-gradient(from 0deg, #4285F4, #9B72CB, #D96570, #10B981, #4285F4)',
                          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff 0)',
                          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff 0)',
                        }}
                      />
                      <span className="text-[11px] text-slate-500">Pulling from Supabase Master...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {submissionSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{submissionSuccessMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!studentsLoaded && !isFetchingStudents && (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-3xl space-y-3">
                <h4 className="text-sm font-bold text-slate-800">
                  Ready to Load Beneficiary Students
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click <strong>Fetch Students</strong> to load the verified student beneficiaries master list for {schoolData.schoolName}.
                </p>
              </div>
            )}

            {/* When Students Data Loaded */}
            {studentsLoaded && (
              <form onSubmit={handleSubmitClaim} className="space-y-6">
                
                {/* ---------------------------------------------------- */}
                {/* SUB-SECTION 1: WHO AVAIL TRANSPORT FACILITIES        */}
                {/* ---------------------------------------------------- */}
                {showTransportSection && (
                  <div className="border border-emerald-200/80 rounded-3xl overflow-hidden bg-white shadow-xs">
                    <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-50 to-teal-50/50 border-b border-emerald-200/80 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-emerald-950 uppercase tracking-wide">
                          Who avail transport facilities
                        </h4>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          {transportStudents.length} Beneficiaries · Subtotal: {formatCurrencyINR(totalTransportAmount)}
                        </p>
                      </div>
                      
                      {!existingClaim && (
                        <button
                          type="button"
                          onClick={() => handleAddStudentRow('Transport')}
                          className="px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-300 hover:border-emerald-400 shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <MaterialIcon name="add" className="text-sm" />
                          <span>Add Transport Student</span>
                        </button>
                      )}
                    </div>

                    {transportStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No students registered for transport facility in this school.
                      </div>
                    ) : (
                      /* Two Columns Student Details List - Simple but Stylish Cards */
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {transportStudents.map((st) => {
                          const isClaimSaved = savedStudentIds.has(st.id);
                          return (
                            <div
                              key={st.id}
                              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group ${
                                isClaimSaved
                                  ? 'border-emerald-200 bg-emerald-50/25 hover:border-emerald-300'
                                  : 'border-slate-200/90 hover:border-indigo-300 bg-white hover:bg-slate-50/40'
                              }`}
                            >
                              {/* Left: Passport Photo + Aligned Student Details */}
                              <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                <div 
                                  onClick={() => handleOpenStudentClaim(st)}
                                  className="w-12 h-15 sm:w-13 sm:h-16 rounded-xl border border-slate-300 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer shadow-2xs hover:ring-2 hover:ring-indigo-400/40 transition-all"
                                  title="Click to view student profile card"
                                >
                                  {st.photoUrl ? (
                                    <img src={st.photoUrl} alt={st.studentName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                      <Camera className="w-4 h-4" />
                                      <span className="text-[9px] font-medium mt-0.5">Photo</span>
                                    </div>
                                  )}
                                </div>

                                {/* Perfectly aligned key-value pair */}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-xs sm:text-sm">
                                    <span className="font-semibold text-slate-600">student Name</span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    <span className="font-bold text-slate-900 truncate tracking-tight">{st.studentName}</span>
                                  </div>

                                  <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-xs">
                                    <span className="font-semibold text-slate-600">Class &amp; section</span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    <span className="font-semibold text-slate-800">{st.grade}</span>
                                  </div>

                                  <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-[11px]">
                                    <span className="font-medium text-slate-500">EMIS Number</span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    <span className="font-mono text-slate-700 font-semibold">{st.emisNumber}</span>
                                  </div>

                                  {isClaimSaved && (
                                    <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-[11px]">
                                      <span className="font-medium text-slate-500">Claim Details</span>
                                      <span className="text-slate-400 font-bold">:</span>
                                      <span className="font-bold text-emerald-700 font-mono">
                                        {st.daysAttended} Days · ₹{st.totalClaimAmount}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right Side: Claim button OR Green Check with Edit */}
                              <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                {isClaimSaved ? (
                                  <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                                    <div 
                                      className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1 shadow-2xs"
                                      title="Claim details saved"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>₹{st.totalClaimAmount}</span>
                                    </div>
                                    {(!isClaimSubmitted || isEditModeAfterSubmit) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStudentClaim(st)}
                                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Edit availed days"
                                      >
                                        <MaterialIcon name="edit" className="text-xs" />
                                        <span>Edit</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStudentClaim(st)}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <MaterialIcon name="payments" className="text-xs" />
                                    <span>Claim</span>
                                  </button>
                                )}

                                {!existingClaim && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStudent(st.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 cursor-pointer transition-colors"
                                    title="Remove student"
                                  >
                                    <MaterialIcon name="delete" className="text-sm" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* SUB-SECTION 2: WHO AVAIL ESCORT FACILITIES           */}
                {/* ---------------------------------------------------- */}
                {showEscortSection && (
                  <div className="border border-blue-200/80 rounded-3xl overflow-hidden bg-white shadow-xs">
                    <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-200/80 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-blue-950 uppercase tracking-wide">
                          Who avail escort facilities
                        </h4>
                        <p className="text-[11px] text-blue-700 font-medium">
                          {escortStudents.length} Beneficiaries · Subtotal: {formatCurrencyINR(totalEscortAmount)}
                        </p>
                      </div>
                      
                      {!existingClaim && (
                        <button
                          type="button"
                          onClick={() => handleAddStudentRow('Escort')}
                          className="px-3 py-1 rounded-full text-xs font-semibold text-blue-800 hover:text-blue-950 bg-white border border-blue-300 hover:border-blue-400 shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <MaterialIcon name="add" className="text-sm" />
                          <span>Add Escort Student</span>
                        </button>
                      )}
                    </div>

                    {escortStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No students registered for escort facility in this school.
                      </div>
                    ) : (
                      /* Two Columns Student Details List - Simple but Stylish Cards */
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {escortStudents.map((st) => {
                          const isClaimSaved = savedStudentIds.has(st.id);
                          return (
                            <div
                              key={st.id}
                              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group ${
                                isClaimSaved
                                  ? 'border-blue-200 bg-blue-50/25 hover:border-blue-300'
                                  : 'border-slate-200/90 hover:border-indigo-300 bg-white hover:bg-slate-50/40'
                              }`}
                            >
                              {/* Left: Passport Photo + Aligned Student Details */}
                              <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                <div 
                                  onClick={() => handleOpenStudentClaim(st)}
                                  className="w-12 h-15 sm:w-13 sm:h-16 rounded-xl border border-slate-300 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer shadow-2xs hover:ring-2 hover:ring-indigo-400/40 transition-all"
                                  title="Click to view student profile card"
                                >
                                  {st.photoUrl ? (
                                    <img src={st.photoUrl} alt={st.studentName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                      <Camera className="w-4 h-4" />
                                      <span className="text-[9px] font-medium mt-0.5">Photo</span>
                                    </div>
                                  )}
                                </div>

                                {/* Perfectly aligned key-value pair */}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-xs sm:text-sm">
                                    <span className="font-semibold text-slate-600">student Name</span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    <span className="font-bold text-slate-900 truncate tracking-tight">{st.studentName}</span>
                                  </div>

                                  <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-xs">
                                    <span className="font-semibold text-slate-600">Class &amp; section</span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    <span className="font-semibold text-slate-800">{st.grade}</span>
                                  </div>

                                  <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-[11px]">
                                    <span className="font-medium text-slate-500">EMIS Number</span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    <span className="font-mono text-slate-700 font-semibold">{st.emisNumber}</span>
                                  </div>

                                  {isClaimSaved && (
                                    <div className="grid grid-cols-[108px_12px_1fr] items-baseline text-[11px]">
                                      <span className="font-medium text-slate-500">Claim Details</span>
                                      <span className="text-slate-400 font-bold">:</span>
                                      <span className="font-bold text-blue-700 font-mono">
                                        {st.daysAttended} Days · ₹{st.totalClaimAmount}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right Side: Claim button OR Green Check with Edit */}
                              <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                {isClaimSaved ? (
                                  <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                                    <div 
                                      className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1 shadow-2xs"
                                      title="Claim details saved"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>₹{st.totalClaimAmount}</span>
                                    </div>
                                    {(!isClaimSubmitted || isEditModeAfterSubmit) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStudentClaim(st)}
                                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Edit availed days"
                                      >
                                        <MaterialIcon name="edit" className="text-xs" />
                                        <span>Edit</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStudentClaim(st)}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <MaterialIcon name="payments" className="text-xs" />
                                    <span>Claim</span>
                                  </button>
                                )}

                                {!existingClaim && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStudent(st.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 cursor-pointer transition-colors"
                                    title="Remove student"
                                  >
                                    <MaterialIcon name="delete" className="text-sm" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ======================================================== */}
                {/* BELOW SECTION OF STUDENT DETAILS IN RIGHT SIDE:          */}
                {/* SUBMIT CLAIM BUTTON OR EDIT BUTTON WITH MATERIAL ICON    */}
                {/* ======================================================== */}
                <div className="p-4 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Consolidated Claim ({previousMonthName})
                    </span>
                    <div className="text-xl font-bold text-white font-mono mt-0.5">
                      {formatCurrencyINR(grandTotalAmount)}
                      <span className="text-xs font-normal text-emerald-400 ml-2">
                        ({studentRows.length} Total: {transportStudents.length} Transport + {escortStudents.length} Escort)
                      </span>
                    </div>
                  </div>

                  {/* Right side: Submit claim button OR Edit button */}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                      <div className="text-[11px] text-slate-400">Headmaster Signatory</div>
                      <div className="text-xs font-semibold text-white">{submittedByName || currentUser.name}</div>
                    </div>

                    {/* When claim is submitted and not in edit mode: Submit button is hidden and Edit button appears */}
                    {isClaimSubmitted && !isEditModeAfterSubmit ? (
                      <button
                        type="button"
                        onClick={() => setIsEditModeAfterSubmit(true)}
                        className="px-7 py-2.5 rounded-full font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-950/30 flex items-center gap-2 cursor-pointer transition-all duration-200 border border-blue-400/30"
                      >
                        <MaterialIcon name="edit" className="text-base" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="px-7 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 active:scale-95 shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-all duration-200 border border-emerald-400/30"
                      >
                        <MaterialIcon name="send" className="text-base" />
                        <span>Submit claim</span>
                      </button>
                    )}
                  </div>
                </div>

              </form>
            )}

          </div>

          {/* ======================================================== */}
          {/* SECTION 4: UPLOAD DOCUMENT SECTION                       */}
          {/* ======================================================== */}
          <div id="upload-document-section" className="p-6 sm:p-8 space-y-8 bg-slate-50/20">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                4
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Upload Documents &amp; Photos
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            {/* Hidden Inputs for Attendance Camera & Gallery Upload */}
            <input
              type="file"
              ref={attendanceCameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                handleAddAttendanceFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <input
              type="file"
              ref={attendanceGalleryInputRef}
              multiple
              accept="image/*"
              onChange={(e) => {
                handleAddAttendanceFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            {/* Duplicate Photo Detection Alert Popup */}
            {duplicateAlertMsg && (
              <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200 max-w-md">
                <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-red-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-red-500/30">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="tracking-wide">{duplicateAlertMsg}</span>
                </div>
              </div>
            )}

            {/* Section Header */}
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Attendance Registers &amp; Supporting Documents
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attach attendance copies, convert to merged PDF in ascending order, view and download
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                Cycle: {previousMonthName}
              </span>
            </div>

            {/* Field 1: Students attendance copy ( no.of days availed the facilities) */}
            <div className="space-y-3">
              <label className="block text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                Students attendance copy ( no.of days availed the facilities) :
              </label>

              {/* WHEN PDF IS NOT YET GENERATED: Camera, + icon, and Convert PDF Button */}
              {!mergedPdfUrl ? (
                <div className="space-y-4">
                  
                  {/* Toolbar: Camera Icon, + Icon, and Convert PDF Button */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Camera icon button */}
                    <button
                      type="button"
                      onClick={() => attendanceCameraInputRef.current?.click()}
                      className="px-4 py-2 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-2xs border border-slate-200"
                      title="Take photo using mobile camera"
                    >
                      <MaterialIcon name="photo_camera" className="text-base" />
                      <span>Take Photo</span>
                    </button>

                    {/* + Icon button for adding more photos or gallery images */}
                    <button
                      type="button"
                      onClick={() => attendanceGalleryInputRef.current?.click()}
                      className="px-4 py-2 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-2xs border border-slate-200"
                      title="Add images from gallery or files"
                    >
                      <MaterialIcon name="collections" className="text-base" />
                      <span>Add Images</span>
                    </button>

                    {/* Right near to this: Convert PDF button */}
                    <button
                      type="button"
                      disabled={attendancePages.length === 0 || isConvertingPdf}
                      onClick={handleConvertPdf}
                      className="px-5 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-rose-500 active:scale-95 shadow-md shadow-red-950/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MaterialIcon name="picture_as_pdf" className="text-base" />
                      <span>{isConvertingPdf ? 'Merging PDF in Order...' : 'Convert PDF'}</span>
                    </button>
                  </div>

                  {/* Attached Images Preview Grid (Disappears when converted to PDF) */}
                  {attendancePages.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
                        <span>Attached Pages (Merged in Ascending Order): {attendancePages.length} Pages</span>
                        <span className="text-[11px] text-slate-400">Click Convert PDF to merge</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {attendancePages.map((page, idx) => (
                          <div 
                            key={page.id}
                            className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 shadow-2xs aspect-[3/4]"
                          >
                            <img 
                              src={page.dataUrl} 
                              alt={`Page ${idx + 1}`} 
                              className="w-full h-full object-cover"
                            />
                            
                            {/* Page Number Badge */}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                              Page {idx + 1}
                            </span>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveAttendancePage(page.id)}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer"
                              title="Remove page"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-2">
                      <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600">
                        No attendance copies attached yet
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Take photo using mobile camera or click + to add pages from your gallery
                      </p>
                    </div>
                  )}

                </div>
              ) : (
                /* WHEN PDF CONVERSION IS COMPLETED: Convert PDF button hides, raw images disappear, unified PDF card appears */
                <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-300 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
                  
                  {/* Left: PDF Info */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-red-950/20">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          Attendance_Copy_{schoolData.udiseCode}_{previousMonthName}.pdf
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Merged PDF
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {attendancePages.length} Pages merged in ascending order · Saved automatically for claim verification
                      </p>
                    </div>
                  </div>

                  {/* Right: View Icon, Download Icon, and Pencil Icon to Replace */}
                  <div className="flex items-center gap-2 shrink-0">
                    
                    {/* View Icon */}
                    <button
                      type="button"
                      onClick={() => setViewPdfModal(true)}
                      className="px-3.5 py-2 rounded-full font-bold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="View PDF"
                    >
                      <MaterialIcon name="visibility" className="text-base text-emerald-600" />
                      <span>View</span>
                    </button>

                    {/* Download Icon */}
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="px-3.5 py-2 rounded-full font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Download PDF"
                    >
                      <MaterialIcon name="download" className="text-base" />
                      <span>Download</span>
                    </button>

                    {/* Pencil Icon to Replace this PDF */}
                    <button
                      type="button"
                      onClick={handleReplacePdf}
                      className="w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                      title="Replace PDF (Re-enables camera & convert PDF button)"
                    >
                      <MaterialIcon name="edit" className="text-base" />
                    </button>

                  </div>

                </div>
              )}

            </div>

            {/* Divider between Field 1 and Field 2 */}
            <hr className="border-slate-200/80 my-5" />

            {/* ======================================================== */}
            {/* FIELD 2: UPLOADING TRANSPORT/ESCORT USAGE PHOTOS         */}
            {/* ======================================================== */}
            <div className="space-y-4">
              
              {/* Hidden Inputs for Usage Photos */}
              <input
                type="file"
                ref={usageCameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  handleAddUsagePhotos(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <input
                type="file"
                ref={usageGalleryInputRef}
                multiple
                accept="image/*"
                onChange={(e) => {
                  handleAddUsagePhotos(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <input
                type="file"
                ref={replaceUsagePhotoInputRef}
                accept="image/*"
                onChange={(e) => {
                  handleReplaceUsagePhoto(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />

              {/* Usage Photos Alert Message */}
              {usageAlertMsg && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{usageAlertMsg}</span>
                </div>
              )}

              {/* Field Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    Uploading transport/escort Usage photos :
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Upload up to 4 real-time photos of students availing transport / escort facility
                  </span>
                </div>

                {/* Upload action buttons: Camera icon & + icon (Max 4 photos) */}
                <div className="flex items-center gap-2">
                  {/* Camera icon button */}
                  <button
                    type="button"
                    disabled={usagePhotos.length >= 4}
                    onClick={() => usageCameraInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Take photo using mobile camera"
                  >
                    <MaterialIcon name="photo_camera" className="text-sm text-emerald-600" />
                    <span>Take Photo</span>
                  </button>

                  {/* + Icon button for adding another photo */}
                  <button
                    type="button"
                    disabled={usagePhotos.length >= 4}
                    onClick={() => usageGalleryInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Add another photo from gallery (max 4)"
                  >
                    <MaterialIcon name="collections" className="text-sm text-blue-600" />
                    <span>Add Photo</span>
                  </button>

                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    {usagePhotos.length} / 4
                  </span>
                </div>
              </div>

              {/* Photos Grid (Up to 4 photos) */}
              {usagePhotos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {usagePhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-white shadow-xs hover:border-emerald-400 transition-all flex flex-col"
                    >
                      {/* Photo Thumbnail */}
                      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                        <img
                          src={photo.dataUrl}
                          alt={`Usage Photo ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                          Photo {index + 1}
                        </span>
                      </div>

                      {/* Photo Footer: Destination Folder Indicator & Action Icons */}
                      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-[11px] font-semibold text-slate-800 truncate" title={photo.name}>
                            {photo.name}
                          </p>
                          <p className="text-[10px] text-emerald-700 truncate font-mono" title={`Supabase Storage: schools/${schoolData.schoolName}/usage_photos/`}>
                            schools/{schoolData.schoolName.substring(0, 14)}...
                          </p>
                        </div>

                        {/* Actions: View, Edit, Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* View Icon */}
                          <button
                            type="button"
                            onClick={() => setViewingUsagePhoto(photo.dataUrl)}
                            className="w-7 h-7 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-emerald-700 border border-slate-200 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                            title="View full-size photo"
                          >
                            <MaterialIcon name="visibility" className="text-xs" />
                          </button>

                          {/* Edit / Replace Icon */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUsagePhotoId(photo.id);
                              replaceUsagePhotoInputRef.current?.click();
                            }}
                            className="w-7 h-7 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                            title="Edit / Replace photo"
                          >
                            <MaterialIcon name="edit" className="text-xs" />
                          </button>

                          {/* Delete Icon */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUsagePhoto(photo.id)}
                            className="w-7 h-7 rounded-full bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                            title="Delete photo"
                          >
                            <MaterialIcon name="delete" className="text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Inline + Icon Slot for uploading another photo (up to maximum 4 photos) */}
                  {usagePhotos.length < 4 && (
                    <div
                      onClick={() => usageGalleryInputRef.current?.click()}
                      className="group aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-2xs p-4"
                      title="Click + icon to add another photo"
                    >
                      <div className="w-10 h-10 rounded-full bg-white group-hover:bg-emerald-100 text-slate-500 group-hover:text-emerald-700 border border-slate-200 group-hover:border-emerald-300 flex items-center justify-center transition-all shadow-2xs group-hover:scale-110">
                        <MaterialIcon name="add" className="text-lg" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-800">
                          Add Another Photo
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ({usagePhotos.length + 1} of 4)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/60 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white text-emerald-600 border border-slate-200 shadow-2xs flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      No transport/escort usage photos uploaded yet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Click the camera icon to take photos or the + icon to add images (maximum 4 photos)
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => usageCameraInputRef.current?.click()}
                      className="px-4 py-2 rounded-full font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Take photo using mobile camera or upload image"
                    >
                      <MaterialIcon name="photo_camera" className="text-sm" />
                      <span>Take Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => usageGalleryInputRef.current?.click()}
                      className="px-4 py-2 rounded-full font-bold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 active:scale-95 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Add image from gallery (max 4)"
                    >
                      <MaterialIcon name="collections" className="text-sm" />
                      <span>Add Photo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BELOW THIS IN RIGHT SIDE: SAVE BUTTON / 2-SECOND 'SAVED SUCCESSFULLY' MESSAGE */}
              <div className="pt-2 flex items-center justify-end min-h-[44px]">
                {/* 2-Second Temporary 'saved successfully' message */}
                {usageSaveSuccessToast ? (
                  <div className="px-5 py-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs shadow-xs flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                    <MaterialIcon name="check_circle" className="text-base text-emerald-600" />
                    <span>saved successfully</span>
                  </div>
                ) : (
                  /* Save Button: Visible when photos exist and not yet saved */
                  !isUsagePhotosSaved && usagePhotos.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveUsagePhotos}
                      className="px-6 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <MaterialIcon name="save" className="text-base" />
                      <span>Save Photos</span>
                    </button>
                  )
                )}
              </div>

            </div>

          </div>

          {/* ======================================================== */}
          {/* SECTION 5: CLAIM VERIFICATION SECTION                    */}
          {/* ======================================================== */}
          <div id="claim-verification-section" className="p-6 sm:p-8 space-y-6">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                5
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Claim Verification
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            {/* Section Header */}
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Consolidated Audit &amp; Calculation Summary
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidated verification table &amp; student-wise claim audit format for {previousMonthName}
                </p>
              </div>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                isClaimVerified 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {isClaimVerified ? 'Claim Verified' : 'Verification Pending'}
              </span>
            </div>

            {/* Consolidated Table with Perfect Alignment, Round Corners, Content Fit & Light Row Colors */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-separate border-spacing-y-1.5">
                <thead>
                  <tr className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs">
                    <th className="py-3 px-4 text-left first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/90 first:border-l last:border-r align-middle text-slate-800">
                      Head
                    </th>
                    <th className="py-3 px-4 text-center whitespace-nowrap first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/90 first:border-l last:border-r align-middle w-40 text-slate-800">
                      Students (sanctioned)
                    </th>
                    <th className="py-3 px-4 text-center whitespace-nowrap first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/90 first:border-l last:border-r align-middle w-44 text-slate-800">
                      Students (claimed)
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/90 first:border-l last:border-r align-middle text-slate-800">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="font-medium text-slate-800">
                  {/* Row 1: Transport (Light Row Background) */}
                  {showTransportSection && (
                    <tr className="bg-white hover:bg-slate-50/90 transition-colors shadow-2xs">
                      <td className="py-3.5 px-4 font-bold text-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle">
                        <span className="text-sm font-bold text-slate-900">Transport</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 text-sm first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle whitespace-nowrap">
                        {transportStudents.length}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-extrabold text-blue-900 text-sm first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle whitespace-nowrap">
                        {transportStudents.filter(s => s.daysAttended > 0).length}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-sm sm:text-base first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle whitespace-nowrap">
                        ₹{transportStudents.filter(s => s.daysAttended > 0).reduce((sum, s) => sum + calculateStudentClaimAmount(s.daysAttended, totalWorkingDays), 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}

                  {/* Row 2: Escort (Light Row Background) */}
                  {showEscortSection && (
                    <tr className="bg-slate-50/70 hover:bg-slate-100/80 transition-colors shadow-2xs">
                      <td className="py-3.5 px-4 font-bold text-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle">
                        <span className="text-sm font-bold text-slate-900">Escort</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 text-sm first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle whitespace-nowrap">
                        {escortStudents.length}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-extrabold text-blue-900 text-sm first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle whitespace-nowrap">
                        {escortStudents.filter(s => s.daysAttended > 0).length}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-sm sm:text-base first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle whitespace-nowrap">
                        ₹{escortStudents.filter(s => s.daysAttended > 0).reduce((sum, s) => sum + calculateStudentClaimAmount(s.daysAttended, totalWorkingDays), 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}

                  {/* Summary / Total Row (Light Summary Styling) */}
                  <tr className="bg-slate-100 text-slate-900 hover:bg-slate-200/70 transition-colors shadow-2xs font-extrabold border-t-2 border-slate-300">
                    <td className="py-3.5 px-4 uppercase font-extrabold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle text-slate-900">
                      Total
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap text-slate-900">
                      {studentRows.length}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-extrabold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap text-slate-900">
                      {studentRows.filter(s => s.daysAttended > 0).length}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-base sm:text-lg first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap text-emerald-800">
                      ₹{grandTotalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Field: View Claim for the month of (current month) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  View Claim for the month of {currentMonthName} :
                </span>
              </div>

              {/* View Icon Button to open student wise claim format */}
              <button
                type="button"
                onClick={() => setViewStudentWiseClaimModal(true)}
                className="px-4 py-2 rounded-full font-bold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                title="View student wise claim table format"
              >
                <MaterialIcon name="visibility" className="text-base text-emerald-600" />
                <span>View Student Wise Claim</span>
              </button>
            </div>

            {/* Action buttons on the right side: Edit button & Verify button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              {/* Edit button: Goes to previous section (working days & student details enabled) */}
              <button
                type="button"
                onClick={handleEditFromVerification}
                className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-200"
              >
                <MaterialIcon name="edit" className="text-sm text-blue-600" />
                <span>Edit</span>
              </button>

              {/* Verify button */}
              <button
                type="button"
                onClick={handleVerifyClaim}
                className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
              >
                <MaterialIcon name="verified" className="text-base" />
                <span>Verify</span>
              </button>
            </div>

          </div>

          {/* ======================================================== */}
          {/* SECTION: DETAILS OF THOSE APPOINTED FOR TRANSPORT / ESCORT */}
          {/* ======================================================== */}
          <div id="appointed-details-section" className="p-6 sm:p-8 space-y-6 bg-slate-50/30">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                6
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Details of Those Appointed for Transport / Escort
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            {/* Section Header */}
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Conveyance Personnel &amp; Route Assets
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register vehicles, drivers, and escort facilitators allocated for student conveyance
                </p>
              </div>

              {/* Category / Mode Display & Selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200 text-xs font-semibold">
                <span className="text-[10px] uppercase font-bold text-slate-500 px-2">Mode:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  (transportStudents.length > 0 && escortStudents.length > 0)
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : transportStudents.length > 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {(transportStudents.length > 0 && escortStudents.length > 0)
                    ? 'Transport & Escort (Both)'
                    : transportStudents.length > 0
                    ? 'Transport Only'
                    : escortStudents.length > 0
                    ? 'Escort Only'
                    : 'Transport & Escort (Both)'}
                </span>
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* SUBSECTION 1: TRANSPORT APPOINTED (IF TRANSPORT MODE)    */}
            {/* -------------------------------------------------------- */}
            {showTransportSection && (
              <div className="border border-emerald-200/80 rounded-2xl p-5 bg-white shadow-xs space-y-4">
                
                {/* Field: How many vehicles are being used for this service */}
                <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                      <Bus className="w-4 h-4" />
                    </div>
                    <label htmlFor="vehicle-count-input" className="text-xs sm:text-sm font-bold text-slate-900 leading-snug cursor-pointer">
                      How many vehicles are being used for this service :
                    </label>
                  </div>

                  {/* Input box (number only) right near to this field */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id="vehicle-count-input"
                      type="number"
                      min={0}
                      max={20}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-form-type="other"
                      name="vehicle_count_noautofill"
                      disabled={isAppointedFrozen}
                      value={vehicleCount === 0 ? '' : vehicleCount}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleVehicleCountChange(e.target.value)}
                      className="w-20 px-3 py-1.5 text-sm font-mono font-bold text-center text-slate-900 bg-white border border-emerald-400 rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-300"
                    />
                    <span className="text-xs font-semibold text-emerald-800">
                      Vehicles
                    </span>
                  </div>
                </div>

                {/* Automatically created vehicle detail rows */}
                {vehicles.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Transport Vehicle &amp; Driver Details ({vehicles.length} Rows)</span>
                      {isAppointedFrozen && (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Frozen / Saved
                        </span>
                      )}
                    </div>

                    {vehicles.map((veh, idx) => (
                      <div
                        key={veh.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isAppointedFrozen
                            ? 'bg-slate-50/80 border-slate-200'
                            : 'bg-white border-slate-200 hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          {/* Row Indicator */}
                          <div className="md:col-span-1 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className="hidden sm:inline">Row</span>
                          </div>

                          {/* Vehicle No: */}
                          <div className="md:col-span-4 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Vehicle No:
                            </label>
                            <input
                              type="text"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              disabled={isAppointedFrozen}
                              value={veh.vehicleNo}
                              onChange={(e) => handleUpdateVehicle(idx, 'vehicleNo', e.target.value)}
                              placeholder="e.g. TN 23 AB 1234"
                              className="w-full px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </div>

                          {/* Driver Name: */}
                          <div className="md:col-span-4 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Driver Name:
                            </label>
                            <input
                              type="text"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              disabled={isAppointedFrozen}
                              value={veh.driverName}
                              onChange={(e) => handleUpdateVehicle(idx, 'driverName', e.target.value)}
                              placeholder="Driver full name"
                              className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </div>

                          {/* Contact number: (10 digit number only) */}
                          <div className="md:col-span-3 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Contact number:
                            </label>
                            <input
                              type="tel"
                              maxLength={10}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              disabled={isAppointedFrozen}
                              value={veh.contactNumber}
                              onChange={(e) => handleUpdateVehicle(idx, 'contactNumber', e.target.value)}
                              placeholder="10-digit number"
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500 border border-dashed border-slate-200">
                    Enter the number of vehicles above to generate vehicle &amp; driver detail rows.
                  </div>
                )}

              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* SUBSECTION 2: ESCORT APPOINTED (IF ESCORT MODE)          */}
            {/* -------------------------------------------------------- */}
            {showEscortSection && (
              <div className="border border-blue-200/80 rounded-2xl p-5 bg-white shadow-xs space-y-4">
                
                {/* Field: How many number of Escorts (appointed) are being used for this service */}
                <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <label htmlFor="escort-count-input" className="text-xs sm:text-sm font-bold text-slate-900 leading-snug cursor-pointer">
                      How many number of Escorts (appointed) are being used for this service :
                    </label>
                  </div>

                  {/* Input box (number only) right near to this field */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id="escort-count-input"
                      type="number"
                      min={0}
                      max={30}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-form-type="other"
                      name="escort_count_noautofill"
                      disabled={isAppointedFrozen}
                      value={escortCount === 0 ? '' : escortCount}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleEscortCountChange(e.target.value)}
                      className="w-20 px-3 py-1.5 text-sm font-mono font-bold text-center text-slate-900 bg-white border border-blue-400 rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-300"
                    />
                    <span className="text-xs font-semibold text-blue-800">
                      Escorts
                    </span>
                  </div>
                </div>

                {/* Automatically created escort detail rows */}
                {escorts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Escort Personnel Details ({escorts.length} Rows)</span>
                      {isAppointedFrozen && (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Frozen / Saved
                        </span>
                      )}
                    </div>

                    {escorts.map((esc, idx) => (
                      <div
                        key={esc.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isAppointedFrozen
                            ? 'bg-slate-50/80 border-slate-200'
                            : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          {/* Row Indicator */}
                          <div className="md:col-span-1 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className="hidden sm:inline">Row</span>
                          </div>

                          {/* Escort Name: */}
                          <div className="md:col-span-4 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Escort Name:
                            </label>
                            <input
                              type="text"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              disabled={isAppointedFrozen}
                              value={esc.escortName}
                              onChange={(e) => handleUpdateEscort(idx, 'escortName', e.target.value)}
                              placeholder="Escort full name"
                              className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </div>

                          {/* Role / Designation: */}
                          <div className="md:col-span-4 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Relation / Role:
                            </label>
                            <input
                              type="text"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              disabled={isAppointedFrozen}
                              value={esc.roleOrRelation}
                              onChange={(e) => handleUpdateEscort(idx, 'roleOrRelation', e.target.value)}
                              placeholder="e.g. Parent / Escort Guide / Ayah"
                              className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </div>

                          {/* Contact number: (10 digit number only) */}
                          <div className="md:col-span-3 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Contact number:
                            </label>
                            <input
                              type="tel"
                              maxLength={10}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              disabled={isAppointedFrozen}
                              value={esc.contactNumber}
                              onChange={(e) => handleUpdateEscort(idx, 'contactNumber', e.target.value)}
                              placeholder="10-digit number"
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500 border border-dashed border-slate-200">
                    Enter the number of escorts above to generate escort details rows.
                  </div>
                )}

              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* RIGHT SIDE CORNER: SAVE & EDIT BUTTON WITH 1S TOAST       */}
            {/* -------------------------------------------------------- */}
            <div className="pt-2 flex items-center justify-end">
              {/* 1-Second 'saved successfully' message */}
              {appointedSaveSuccessToast ? (
                <div className="px-5 py-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs shadow-xs flex items-center gap-2 animate-in fade-in duration-150">
                  <span className="text-base text-emerald-600 font-extrabold">✓</span>
                  <span>saved successfully</span>
                </div>
              ) : isAppointedFrozen ? (
                /* Edit button appears in place of save button */
                <button
                  type="button"
                  onClick={handleEditAppointed}
                  className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-950/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <MaterialIcon name="edit" className="text-sm" />
                  <span>Edit</span>
                </button>
              ) : (
                /* Save button: saves, freezes, disappears -> 'saved successfully' for 1s -> Edit button */
                <button
                  type="button"
                  onClick={handleSaveAppointed}
                  className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <MaterialIcon name="save" className="text-base" />
                  <span>Save</span>
                </button>
              )}
            </div>

          </div>

          {/* ======================================================== */}
          {/* SECTION 7: SMC APPROVAL                                  */}
          {/* ======================================================== */}
          <div id="smc-approval-section" className="p-6 sm:p-8 space-y-5 bg-slate-50/30">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                7
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                SMC Approval
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            {/* Header */}
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Resolution Minutes &amp; Sanction Order
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  School Management Committee (SMC) statutory meeting resolution approving transport &amp; escort facility
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  smcResolutionDoc
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {smcResolutionDoc ? 'Resolution Uploaded' : 'Upload Pending'}
                </span>
              </div>
            </div>

            {/* Field: upload SMC resolution (pdf or image) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                    Upload SMC resolution (pdf or image)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Resolution passed by SMC committee for current academic cycle ({cycleInfo.claimMonthName})
                  </span>
                </div>
              </div>

              {/* Upload & View Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {smcResolutionDoc ? (
                  <div className="flex items-center gap-2">
                    {/* View Icon to uploaded SMC resolution pdf */}
                    <button
                      type="button"
                      onClick={() => setViewingSmcResolution(true)}
                      className="px-3.5 py-2 rounded-full font-bold text-xs text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="View uploaded SMC resolution"
                    >
                      <MaterialIcon name="visibility" className="text-base text-emerald-700" />
                      <span>View Resolution</span>
                    </button>

                    {/* Change / Replace Resolution File if not frozen */}
                    {!isSmcFrozen && (
                      <button
                        type="button"
                        onClick={() => smcFileInputRef.current?.click()}
                        className="px-3 py-2 rounded-full font-semibold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                        title="Upload different file"
                      >
                        <MaterialIcon name="edit" className="text-sm text-blue-600" />
                        <span>Change</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSmcFrozen}
                    onClick={() => smcFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-full font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <MaterialIcon name="upload_file" className="text-base" />
                    <span>Upload Resolution (PDF / Image)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Uploaded File Info Pill */}
            {smcResolutionDoc && (
              <div className="flex items-center justify-between px-4 py-2 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono uppercase font-bold text-[10px] bg-emerald-200 px-1.5 py-0.5 rounded">
                    {smcResolutionDoc.type}
                  </span>
                  <span className="font-semibold truncate">{smcResolutionDoc.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingSmcResolution(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 underline cursor-pointer shrink-0 ml-2"
                >
                  <MaterialIcon name="visibility" className="text-xs" />
                  <span>Preview</span>
                </button>
              </div>
            )}

          </div>

          {/* ======================================================== */}
          {/* SECTION 8: SMC BANK DETAILS                              */}
          {/* ======================================================== */}
          <div id="smc-bank-details-section" className="p-6 sm:p-8 space-y-6">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                8
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                SMC Bank Details
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            {/* Header */}
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Disbursement Account &amp; Direct Benefit Transfer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official bank account of School Management Committee for direct fund disbursement (Maintained across monthly claims)
                </p>
              </div>

              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                isSmcFrozen
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {isSmcFrozen ? 'Bank Details Frozen' : 'Editable'}
              </span>
            </div>

            {/* Bank Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Account Holder Name: */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Account Holder Name:
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  disabled={isSmcFrozen}
                  value={smcBankDetails.accountHolderName}
                  onChange={(e) => setSmcBankDetails({ ...smcBankDetails, accountHolderName: e.target.value })}
                  placeholder="e.g. SMC GHSS KATPADI"
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              {/* Branch: */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Branch:
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  disabled={isSmcFrozen}
                  value={smcBankDetails.branch}
                  onChange={(e) => setSmcBankDetails({ ...smcBankDetails, branch: e.target.value })}
                  placeholder="e.g. Katpadi Main Branch"
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              {/* IFC code: / IFSC code: */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  IFSC code:
                </label>
                <input
                  type="text"
                  maxLength={11}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  disabled={isSmcFrozen}
                  value={smcBankDetails.ifscCode}
                  onChange={(e) => setSmcBankDetails({ ...smcBankDetails, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              {/* Account Number: */}
              <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Account Number:
                </label>
                <input
                  type="text"
                  maxLength={18}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  disabled={isSmcFrozen}
                  value={smcBankDetails.accountNumber}
                  onChange={(e) => setSmcBankDetails({ ...smcBankDetails, accountNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g. 39482019485"
                  className="w-full sm:w-1/2 px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

            </div>

            {/* Bottom Right: Save & Edit Button Flow with 1-Second Message */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                {isSmcFrozen
                  ? 'Bank details are locked and automatically maintained in every monthly claim.'
                  : 'Click Save to lock details for monthly submission.'}
              </span>

              <div>
                {/* 1-second 'saved successfully' message */}
                {smcSaveSuccessToast ? (
                  <div className="px-5 py-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs shadow-xs flex items-center gap-2 animate-in fade-in duration-150">
                    <span className="text-base text-emerald-600 font-extrabold">✓</span>
                    <span>saved successfully</span>
                  </div>
                ) : isSmcFrozen ? (
                  /* Edit button appears in place of save button */
                  <button
                    type="button"
                    onClick={handleEditSmc}
                    className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-950/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MaterialIcon name="edit" className="text-sm" />
                    <span>Edit</span>
                  </button>
                ) : (
                  /* Save button: saves, freezes, disappears -> 'saved successfully' for 1s -> Edit button */
                  <button
                    type="button"
                    onClick={handleSaveSmc}
                    className="px-6 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MaterialIcon name="lock" className="text-base" />
                    <span>Save</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* SECTION 9: HEADMASTER DECLARATION & FORWARD TO BRC SUPERVISOR */}
          {/* ======================================================== */}
          <div 
            id="next-claim-step" 
            className="p-6 sm:p-8 space-y-6 bg-slate-50/50"
          >
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                9
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Headmaster Declaration &amp; Submission
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Institutional Undertaking &amp; Final Transmission</span>
                    {isClaimVerified && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Verification Passed
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Final transmission of transport &amp; escort claims to BRC Supervisor
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Total Amount: ₹{studentRows.filter(s => s.daysAttended > 0).reduce((sum, s) => sum + calculateStudentClaimAmount(s.daysAttended, totalWorkingDays), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Alert Message for Missing Forwarding Prerequisites */}
            {forwardAlertMsg && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
                <span>{forwardAlertMsg}</span>
              </div>
            )}

            {/* Unified Statutory Headmaster Declaration & Electronic Certification (Single Suitable Block) */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/40 border-2 border-purple-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Statutory Headmaster Declaration &amp; Electronic Certification
                  </h4>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border self-start sm:self-auto ${
                  hmDeclarationAccepted
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {hmDeclarationAccepted ? 'Electronically Certified' : 'Certification Pending'}
                </span>
              </div>

              {/* Single Comprehensive Declaration with Integrated Interactive Checkbox */}
              <label className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                hmDeclarationAccepted
                  ? 'bg-purple-50/60 border-purple-300 ring-2 ring-purple-500/20'
                  : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/20'
              }`}>
                <input
                  type="checkbox"
                  checked={hmDeclarationAccepted}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHmDeclarationAccepted(checked);
                    claimStore.updateSchoolClaimWorkflowStatus(udiseCode, { hmDeclarationCompleted: checked });
                  }}
                  className="mt-1 w-5 h-5 text-purple-700 rounded-md border-slate-300 focus:ring-purple-500 cursor-pointer shrink-0"
                />
                <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                  <p>
                    I, <strong className="text-slate-900 font-bold">{submittedByName || defaultMeta.headmasterName || currentUser.name}</strong>, Headmaster / In-Charge of <strong className="text-slate-900 font-bold">{schoolData.schoolName} (UDISE: {schoolData.udiseCode})</strong>, hereby solemnly certify and declare that the transport and escort claim details for the month of <strong className="text-slate-900 font-bold">{previousMonthName}</strong> submitted herein have been thoroughly verified against original physical student attendance registers, route logs, and expenditure vouchers under Samagra Shiksha norms.
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    All beneficiary students listed herein are eligible under official government guidelines, the availed attendance days are genuine and accurate, and no duplicate or dual claim has been lodged across any other school or facility.
                  </p>
                </div>
              </label>

              {/* Signatory & Official Verification Metadata */}
              <div className="pt-3 border-t border-purple-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Headmaster:</span>
                  <strong className="text-slate-900 font-bold">{submittedByName || defaultMeta.headmasterName || currentUser.name}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">School / UDISE:</span>
                  <strong className="text-slate-800 font-mono font-bold">{schoolData.udiseCode}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Certification Date:</span>
                  <strong className="text-slate-900 font-mono font-bold">{new Date().toLocaleDateString('en-IN')}</strong>
                </div>
              </div>
            </div>

            {/* Action Row: Forward to BRC Supervisor (No duplicate print buttons; printing is in Section 10) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 font-medium">
                {hmDeclarationAccepted ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <MaterialIcon name="verified" className="text-sm text-emerald-600" />
                    <span>Headmaster certification complete. Ready for transmission to BRC Supervisor.</span>
                  </span>
                ) : (
                  <span>Please check the electronic certification above to enable forwarding to Block Admin.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isForwardedToBlock ? (
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2 rounded-full font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                      <MaterialIcon name="check_circle" className="text-base text-emerald-600" />
                      <span>Forwarded to Block Admin Portal</span>
                    </div>

                    <button
                      type="button"
                      disabled={isForwarding}
                      onClick={() => {
                        const res = claimStore.forwardSchoolClaimToBlock(
                          udiseCode,
                          submittedByName || currentUser.name,
                          vehicles,
                          escorts,
                          {
                            accountHolderName: smcBankDetails.accountHolderName,
                            branch: smcBankDetails.branch,
                            ifscCode: smcBankDetails.ifscCode,
                            accountNumber: smcBankDetails.accountNumber,
                            resolutionDocUrl: smcResolutionDoc?.url,
                            resolutionDocName: smcResolutionDoc?.name,
                            resolutionDocType: smcResolutionDoc?.type,
                            isSaved: isSmcFrozen,
                          }
                        );
                        if (res.success) {
                          setSuccessToast2Sec('Updated claim re-forwarded to Block Admin successfully');
                          setTimeout(() => setSuccessToast2Sec(null), 2500);
                          onRefresh();
                        }
                      }}
                      className="px-4 py-2 rounded-full font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Update and re-forward claim"
                    >
                      <MaterialIcon name="send" className="text-sm" />
                      <span>Re-Forward</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isForwarding}
                      onClick={() => {
                        if (!isClaimSubmitted) {
                          setForwardAlertMsg('Cannot forward to Block Admin: Please complete Submit Claim in Section 3 first.');
                          setTimeout(() => setForwardAlertMsg(null), 4000);
                          const sec3 = document.getElementById('student-details-section') || document.querySelector('form');
                          if (sec3) sec3.scrollIntoView({ behavior: 'smooth' });
                          return;
                        }
                        if (!isClaimVerified) {
                          setForwardAlertMsg('Cannot forward to Block Admin: Please complete Claim Verification in Section 5 first.');
                          setTimeout(() => setForwardAlertMsg(null), 4000);
                          const sec5 = document.getElementById('claim-verification-section');
                          if (sec5) sec5.scrollIntoView({ behavior: 'smooth' });
                          return;
                        }
                        if (!hmDeclarationAccepted) {
                          setForwardAlertMsg('Cannot forward to Block Admin: Please check the Headmaster Electronic Certification box above.');
                          setTimeout(() => setForwardAlertMsg(null), 4000);
                          return;
                        }

                        setIsForwarding(true);
                        const res = claimStore.forwardSchoolClaimToBlock(
                          udiseCode,
                          submittedByName || currentUser.name,
                          vehicles,
                          escorts,
                          {
                            accountHolderName: smcBankDetails.accountHolderName,
                            branch: smcBankDetails.branch,
                            ifscCode: smcBankDetails.ifscCode,
                            accountNumber: smcBankDetails.accountNumber,
                            resolutionDocUrl: smcResolutionDoc?.url,
                            resolutionDocName: smcResolutionDoc?.name,
                            resolutionDocType: smcResolutionDoc?.type,
                            isSaved: isSmcFrozen,
                          }
                        );
                        setIsForwarding(false);

                        if (res.success) {
                          setIsForwardedToBlock(true);
                          setSuccessToast2Sec('Claim forwarded to Block Admin Portal (BRC Supervisor) successfully');
                          setTimeout(() => setSuccessToast2Sec(null), 3000);
                          onRefresh();
                        } else {
                          setForwardAlertMsg(res.message);
                          setTimeout(() => setForwardAlertMsg(null), 4000);
                        }
                      }}
                      className={`px-6 py-2.5 rounded-full font-bold text-xs text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                        isClaimSubmitted && isClaimVerified && hmDeclarationAccepted
                          ? 'bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 hover:from-purple-600 hover:to-indigo-500 shadow-purple-950/20 active:scale-95'
                          : 'bg-slate-400 hover:bg-slate-500 shadow-slate-900/10'
                      }`}
                      title={
                        isClaimSubmitted && isClaimVerified && hmDeclarationAccepted
                          ? 'Ready to forward claim to BRC supervisor'
                          : 'Complete all 3 mandatory steps (Entry, Verification, HM Declaration) to forward'
                      }
                    >
                      <MaterialIcon name="send" className="text-base" />
                      <span>Forward to BRC Supervisor</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* SECTION 10: PRINT CLAIM & COVERING LETTER (LAST SECTION)  */}
          {/* ======================================================== */}
          <div id="print-claim-section" className="p-6 sm:p-8 space-y-6">
            {/* Section Separation Line with 3D Effect, Serial Number & Section Name */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/90 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.95)]">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-mono font-bold text-sm shadow-[0_2px_5px_rgba(109,40,217,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-purple-400/30 shrink-0">
                10
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Print Claim &amp; covering letter
              </h2>
              <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-purple-500 via-indigo-300 to-transparent shadow-[0_1px_2px_rgba(147,51,234,0.12)]" />
            </div>
            
            {/* Header with Title & Action Buttons */}
            <div className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Physical Certification &amp; Export Center
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official statutory claim format and Tamil covering letter with Headmaster certification for monthly disbursement
                </p>
              </div>

              {/* Action Buttons: View, Print, Covering Letter & Download CSV */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {/* View / Toggle Claim Sheet */}
                <button
                  type="button"
                  onClick={() => setShowClaimTableUnderPrint(prev => !prev)}
                  className="px-4 py-2.5 rounded-full font-bold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 active:scale-95 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="View or hide the claim sheet on this page"
                >
                  <MaterialIcon name="visibility" className="text-base text-purple-600" />
                  <span>{showClaimTableUnderPrint ? 'Hide Claim Sheet' : 'View Claim Sheet'}</span>
                </button>

                {/* Automatic Tamil Covering Letter Button */}
                <button
                  type="button"
                  onClick={() => setShowCoveringLetterModal(true)}
                  className="px-4 py-2.5 rounded-full font-bold text-xs text-indigo-950 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 active:scale-95 transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
                  title="Automatic Tamil Covering Letter for monthly Transport and Escort claim"
                >
                  <MaterialIcon name="description" className="text-base text-indigo-700" />
                  <span>Covering Letter</span>
                </button>

                {/* Print button (Downloads A4 Landscape PDF claim format with declaration & stamp) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowClaimTableUnderPrint(true);
                    downloadOfficialClaimLandscapePdf({
                      schoolName: schoolData.schoolName,
                      udiseCode: schoolData.udiseCode,
                      blockName: schoolData.blockName,
                      monthName: currentMonthName,
                      totalWorkingDays,
                      students: studentRows,
                      hmName: submittedByName || defaultMeta.headmasterName || currentUser.name
                    });
                  }}
                  className="px-4 py-2.5 rounded-full font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  title="Download and print official claim format as PDF"
                >
                  <MaterialIcon name="print" className="text-base text-emerald-400" />
                  <span>Print / Download PDF</span>
                </button>

                {/* Right side of print button: Download CSV file button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowClaimTableUnderPrint(true);
                    downloadClaimCsv({
                      schoolName: schoolData.schoolName,
                      udiseCode: schoolData.udiseCode,
                      blockName: schoolData.blockName,
                      monthName: currentMonthName,
                      totalWorkingDays,
                      students: studentRows
                    });
                  }}
                  className="px-4 py-2.5 rounded-full font-bold text-xs text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 active:scale-95 transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
                  title="Download claim format as CSV spreadsheet"
                >
                  <MaterialIcon name="table_view" className="text-base text-emerald-700" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>

            {/* Document Status Strip: Clean overview without repeating action buttons */}
            {!showClaimTableUnderPrint && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-2xs shrink-0 text-[11px] font-mono uppercase">
                    DOC
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Official Monthly Claim &amp; Tamil Covering Letter Available
                    </h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Use the action bar above to preview the statutory claim sheet, generate the official Tamil covering letter, or download PDF / CSV files.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClaimTableUnderPrint(true)}
                  className="px-4 py-2 rounded-full font-bold text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  View In-Page Statement
                </button>
              </div>
            )}

            {/* In-page preview of the Landscape Claim Format Table: Only appears when Print/Download button is clicked */}
            {showClaimTableUnderPrint && (
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4 animate-in fade-in zoom-in-98 duration-200">
                
                {/* Document Headings */}
                <div className="text-center space-y-1 pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Samagra Shiksha, Vellore District
                  </h4>
                  <div className="text-xs font-bold text-emerald-700">
                    Transport and Escort facility - Claim for the month of {currentMonthName}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    Block name : <strong className="text-slate-800">{schoolData.blockName}</strong> , School name: <strong className="text-slate-800">{schoolData.schoolName}</strong> (UDISE: {schoolData.udiseCode})
                  </div>
                </div>

                {/* 13-Column Table with Perfect Alignment, Round Corner Cells, Content Fit & Light Row Colors */}
                <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs bg-slate-50/30 p-2.5">
                  <table className="w-full text-xs sm:text-sm text-left border-separate border-spacing-y-1.5">
                    <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs">
                      <tr>
                        <th className="py-3 px-3 text-center w-12 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Sl.no</th>
                        <th className="py-3 px-3 text-left min-w-[150px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Student name</th>
                        <th className="py-3 px-3 text-center min-w-[125px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">EMIS number</th>
                        <th className="py-3 px-3 text-center min-w-[95px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Class &amp; section</th>
                        <th className="py-3 px-2.5 text-center min-w-[80px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Gender</th>
                        <th className="py-3 px-2.5 text-center min-w-[85px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Community</th>
                        <th className="py-3 px-2.5 text-center min-w-[80px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Religion</th>
                        <th className="py-3 px-3 text-left min-w-[130px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Panchayat Name</th>
                        <th className="py-3 px-3 text-left min-w-[130px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Habitation Name</th>
                        <th className="py-3 px-2.5 text-center w-28 whitespace-normal leading-tight first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">
                          Total school working days
                        </th>
                        <th className="py-3 px-2.5 text-center w-32 whitespace-normal leading-tight first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">
                          Days facility availed by student
                        </th>
                        <th className="py-3 px-3 text-center w-28 whitespace-normal leading-tight first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">
                          Mode (Transport/Escort)
                        </th>
                        <th className="py-3 px-3 text-right min-w-[110px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Claim amount</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium text-slate-800">
                      {studentRows.length > 0 ? (
                        studentRows.map((st, idx) => {
                          const amount = calculateStudentClaimAmount(st.daysAttended, totalWorkingDays);
                          return (
                            <tr key={st.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90 transition-colors shadow-2xs' : 'bg-slate-50/70 hover:bg-slate-100/80 transition-colors shadow-2xs'}>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900 leading-snug break-words align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.studentName}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700 align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.emisNumber}
                              </td>
                              <td className="py-3 px-3 text-center text-slate-700 font-semibold align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.grade}
                              </td>
                              <td className="py-3 px-2.5 text-center text-slate-700 align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.gender || (idx % 2 === 0 ? 'Male' : 'Female')}
                              </td>
                              <td className="py-3 px-2.5 text-center text-slate-700 font-mono font-semibold align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.community || (idx % 3 === 0 ? 'BC' : idx % 3 === 1 ? 'MBC' : 'SC')}
                              </td>
                              <td className="py-3 px-2.5 text-center text-slate-700 align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.religion || 'Hindu'}
                              </td>
                              <td className="py-3 px-3 text-slate-700 break-words leading-snug align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.panchayatName || `${schoolData.blockName} Panchayat`}
                              </td>
                              <td className="py-3 px-3 text-slate-700 break-words leading-snug align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.habitationName || 'Habitation'}
                              </td>
                              <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-800 align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {totalWorkingDays}
                              </td>
                              <td className="py-3 px-2.5 text-center font-mono font-extrabold text-blue-900 text-sm align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                {st.daysAttended}
                              </td>
                              <td className="py-3 px-3 text-center align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  st.category === 'Transport'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {st.category}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 text-sm sm:text-base align-middle first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r whitespace-nowrap">
                                ₹{amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={13} className="py-6 text-center text-slate-400 first:rounded-l-xl last:rounded-r-xl border border-slate-200">
                            No students loaded for this school.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {/* End Row: Grand Total (Light Summary Row) */}
                    <tfoot>
                      <tr className="bg-slate-100 text-slate-900 font-bold text-xs shadow-2xs border-t-2 border-slate-300">
                        <td colSpan={9} className="py-3.5 px-3 uppercase font-extrabold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle text-slate-900">
                          Grand Total ({studentRows.filter(s => s.daysAttended > 0).length} Claimed / {studentRows.length} Sanctioned Beneficiaries)
                        </td>
                        <td className="py-3.5 px-2.5 text-center font-mono first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap text-slate-800">
                          {totalWorkingDays} Days
                        </td>
                        <td className="py-3.5 px-2.5 text-center font-mono font-bold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap text-slate-800">
                          {studentRows.reduce((sum, s) => sum + s.daysAttended, 0)} Days
                        </td>
                        <td className="py-3.5 px-3 text-center first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle text-slate-500">
                          —
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-base font-extrabold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap text-emerald-800">
                          ₹{studentRows.reduce((sum, s) => sum + calculateStudentClaimAmount(s.daysAttended, totalWorkingDays), 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Bottom Row: Declaration on Left & Stamp on Right Corner */}
                <div className="pt-2 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  
                  {/* Declaration of Headmaster / Headmistress */}
                  <div className="flex-1 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    <div className="font-bold text-slate-800">
                      Declaration of Headmaster / Headmistress
                    </div>
                    <p className="text-[11px]">
                      Certified that the student beneficiaries listed above have availed Transport / Escort facilities for the stated number of days during the claim period as per physical attendance registers and vehicle/escort logs. All claim amounts have been calculated strictly in compliance with Samagra Shiksha norms (&ge;75% attendance = ₹600 flat; &lt;75% = pro-rata). All particulars verified and found correct.
                    </p>
                  </div>

                  {/* Right Corner: Stamp as Headmaster / Headmistress, login school name */}
                  <div className="w-full md:w-64 p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1 shrink-0">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      School Seal &amp; Authority Stamp
                    </div>
                    <div className="text-xs font-bold text-slate-800 pt-3">
                      Headmaster / Headmistress
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600">
                      {schoolData.schoolName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Date: {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* ======================================================== */}
          {/* VIEW USAGE PHOTO MODAL (FULL SIZE)                       */}
          {/* ======================================================== */}
          {viewingUsagePhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
              <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-200 flex flex-col">
                <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Transport / Escort Usage Photo Preview</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingUsagePhoto(null)}
                    className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 max-h-[80vh] overflow-auto flex items-center justify-center bg-black/40">
                  <img
                    src={viewingUsagePhoto}
                    alt="Usage Photo High-Res"
                    className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-2xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW PDF MODAL (FIXED FOR GOOGLE CHROME EMBED BLOCK)     */}
          {/* ======================================================== */}
          {viewPdfModal && mergedPdfUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-full max-w-4xl h-[90vh] bg-white rounded-3xl shadow-2xl border border-white/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                
                {/* Header Toolbar */}
                <div className="px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-red-600 text-white shadow-2xs">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Attendance Copy Document Preview
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {schoolData.schoolName} ({schoolData.udiseCode}) · {attendancePages.length} Pages in Ascending Order
                      </p>
                    </div>
                  </div>

                  {/* Zoom Controls & Action Buttons */}
                  <div className="flex items-center gap-2">
                    
                    {/* Zoom In / Out controls */}
                    <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-full px-2 py-0.5 shadow-2xs text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setPdfViewerZoom((z) => Math.max(50, z - 15))}
                        className="p-1 hover:text-emerald-600 cursor-pointer"
                        title="Zoom out"
                      >
                        <MaterialIcon name="zoom_out" className="text-sm" />
                      </button>
                      <span className="px-2 font-bold text-slate-700">{pdfViewerZoom}%</span>
                      <button
                        type="button"
                        onClick={() => setPdfViewerZoom((z) => Math.min(180, z + 15))}
                        className="p-1 hover:text-emerald-600 cursor-pointer"
                        title="Zoom in"
                      >
                        <MaterialIcon name="zoom_in" className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfViewerZoom(100)}
                        className="p-1 hover:text-slate-900 text-slate-400 cursor-pointer ml-1"
                        title="Reset 100%"
                      >
                        <MaterialIcon name="restart_alt" className="text-sm" />
                      </button>
                    </div>

                    {/* Download PDF button */}
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <MaterialIcon name="download" className="text-sm" />
                      <span>Download PDF</span>
                    </button>

                    {/* Open in New Window Link */}
                    <a
                      href={mergedPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 flex items-center gap-1 shadow-2xs"
                      title="Open direct file in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden md:inline">Open in Tab</span>
                    </a>

                    {/* Close button */}
                    <button
                      type="button"
                      onClick={() => setViewPdfModal(false)}
                      className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body: Native Multi-Page Document Deck (Guaranteed to work in Google Chrome without block) */}
                <div className="flex-1 bg-slate-200/80 p-4 sm:p-6 overflow-y-auto space-y-6 flex flex-col items-center">
                  {attendancePages.map((page, index) => (
                    <div
                      key={page.id}
                      className="bg-white rounded-2xl shadow-xl border border-slate-300/80 overflow-hidden transition-all duration-150 flex flex-col"
                      style={{ width: `${Math.min(100, Math.max(40, pdfViewerZoom))}%`, maxWidth: '780px' }}
                    >
                      {/* Document Page Header Strip */}
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1 text-slate-700">
                          <FileText className="w-3.5 h-3.5 text-red-600" />
                          <span>Page {index + 1} of {attendancePages.length}</span>
                        </span>
                        <span className="font-mono text-emerald-800">
                          {schoolData.schoolName} · {previousMonthName}
                        </span>
                      </div>

                      {/* Document Page Content Sheet */}
                      <div className="p-3 bg-white flex items-center justify-center">
                        <img
                          src={page.dataUrl}
                          alt={`Attendance Copy Page ${index + 1}`}
                          className="w-full h-auto object-contain rounded-lg select-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STUDENT-WISE CLAIM FORMAT MODAL (NON-EDITABLE TABLE)     */}
          {/* ======================================================== */}
          {viewStudentWiseClaimModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Student-Wise Claim Format · Month of {currentMonthName}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Non-Editable Format
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        {schoolData.schoolName} ({schoolData.udiseCode}) · Block: {schoolData.blockName} · Attendance: {totalWorkingDays} Working Days
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Print Table Button */}
                    <button
                      type="button"
                      onClick={() => printStudentWiseClaimSheet({
                        schoolName: schoolData.schoolName,
                        udiseCode: schoolData.udiseCode,
                        blockName: schoolData.blockName,
                        monthName: currentMonthName,
                        totalWorkingDays,
                        students: studentRows,
                        hmName: submittedByName || defaultMeta.headmasterName || currentUser.name
                      })}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print student-wise claim sheet"
                    >
                      <MaterialIcon name="print" className="text-sm text-slate-700" />
                      <span>Print Sheet</span>
                    </button>

                    {/* Download PDF Button */}
                    <button
                      type="button"
                      onClick={() => downloadStudentWiseClaimPdf({
                        schoolName: schoolData.schoolName,
                        udiseCode: schoolData.udiseCode,
                        blockName: schoolData.blockName,
                        monthName: currentMonthName,
                        totalWorkingDays,
                        students: studentRows,
                        hmName: submittedByName || defaultMeta.headmasterName || currentUser.name
                      })}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download as PDF file"
                    >
                      <MaterialIcon name="download" className="text-sm" />
                      <span>Download PDF</span>
                    </button>

                    {/* Close (X) Button */}
                    <button
                      type="button"
                      onClick={() => setViewStudentWiseClaimModal(false)}
                      className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer ml-1"
                      title="Close"
                    >
                      <MaterialIcon name="close" className="text-sm" />
                    </button>
                  </div>
                </div>

                {/* Non-Editable Student-Wise Claim Table with Perfect Alignment, Round Corner Cells, Content Fit & Light Row Colors */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs bg-slate-50/30 p-2.5">
                    <table className="w-full text-xs sm:text-sm text-left border-separate border-spacing-y-1.5">
                      <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs">
                        <tr>
                          <th className="py-3 px-3 text-center w-14 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Serial number</th>
                          <th className="py-3 px-3 text-center w-32 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">EMIS number</th>
                          <th className="py-3 px-3 text-left min-w-[160px] first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Student Name</th>
                          <th className="py-3 px-3 text-center w-28 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">Class &amp; section</th>
                          <th className="py-3 px-3 text-center w-36 whitespace-normal leading-tight first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">
                            Facility availed (Transport/Escort)
                          </th>
                          <th className="py-3 px-3 text-center w-36 whitespace-normal leading-tight first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">
                            Days availed in current month
                          </th>
                          <th className="py-3 px-3 text-right w-36 whitespace-normal leading-tight first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 first:border-l last:border-r align-middle text-slate-800">
                            Amount claimed for ({currentMonthName})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="font-medium text-slate-800">
                        {studentRows.length > 0 ? (
                          studentRows.map((st, idx) => {
                            const amount = calculateStudentClaimAmount(st.daysAttended, totalWorkingDays);
                            const attendancePct = totalWorkingDays > 0 ? Math.round((st.daysAttended / totalWorkingDays) * 100) : 0;
                            return (
                              <tr key={st.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90 transition-colors shadow-2xs' : 'bg-slate-50/70 hover:bg-slate-100/80 transition-colors shadow-2xs'}>
                                {/* Serial number */}
                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  {idx + 1}
                                </td>

                                {/* EMIS number */}
                                <td className="py-3 px-3 font-mono font-semibold text-slate-700 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  {st.emisNumber}
                                </td>

                                {/* Student Name */}
                                <td className="py-3 px-3 font-bold text-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {st.photoUrl ? (
                                      <img
                                        src={st.photoUrl}
                                        alt={st.studentName}
                                        className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                        {st.studentName.charAt(0)}
                                      </div>
                                    )}
                                    <span>{st.studentName}</span>
                                  </div>
                                </td>

                                {/* class & section */}
                                <td className="py-3 px-3 text-slate-700 font-medium first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  {st.grade}
                                </td>

                                {/* Name of the facility availed */}
                                <td className="py-3 px-3 text-center first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    st.category === 'Transport'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {st.category}
                                  </span>
                                </td>

                                {/* Number of days availed this facility in the current month */}
                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  <span>{st.daysAttended} Days</span>
                                  <span className="block text-[10px] font-normal text-slate-400">
                                    ({attendancePct}% Attendance)
                                  </span>
                                </td>

                                {/* Amount claimed for the month of (current month) */}
                                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm first:rounded-l-xl last:rounded-r-xl border-y border-slate-200/70 first:border-l last:border-r align-middle whitespace-nowrap">
                                  ₹{amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 first:rounded-l-xl last:rounded-r-xl border border-slate-200">
                              No student records available to display.
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {/* Total Footer Row */}
                      <tfoot>
                        <tr className="bg-slate-100 text-slate-900 font-bold text-xs shadow-2xs border-t-2 border-slate-300">
                          <td colSpan={5} className="py-3.5 px-4 text-slate-900 uppercase font-extrabold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle">
                            Total ({studentRows.filter(s => s.daysAttended > 0).length} Claimed / {studentRows.length} Sanctioned)
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-800 first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap">
                            {studentRows.reduce((sum, s) => sum + s.daysAttended, 0)} Total Availed Days
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-emerald-800 text-sm font-extrabold first:rounded-l-xl last:rounded-r-xl border-y border-slate-300 first:border-l last:border-r align-middle whitespace-nowrap">
                            ₹{studentRows.reduce((sum, s) => sum + calculateStudentClaimAmount(s.daysAttended, totalWorkingDays), 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Summary Metric Note */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-700">Norms Calculation: </span>
                      <span>Attendance &ge;75% gives ₹600 flat per student; below 75% is (600 / {totalWorkingDays}) &times; Availed Days rounded to nearest whole rupee.</span>
                    </div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] shrink-0">
                      Non-Editable Format Verified
                    </span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Verified for {schoolData.schoolName} ({schoolData.udiseCode})
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewStudentWiseClaimModal(false)}
                    className="px-5 py-2 rounded-full font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-colors cursor-pointer"
                  >
                    Close Format
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW SMC RESOLUTION MODAL (PREVIEW PDF OR IMAGE)         */}
          {/* ======================================================== */}
          {viewingSmcResolution && smcResolutionDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
              <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/80 flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>SMC Resolution Document · {smcResolutionDoc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={smcResolutionDoc.url}
                      download={smcResolutionDoc.name}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setViewingSmcResolution(false)}
                      className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
                  {smcResolutionDoc.type === 'pdf' ? (
                    <iframe
                      src={smcResolutionDoc.url}
                      title="SMC Resolution PDF Preview"
                      className="w-full h-[70vh] rounded-xl border border-slate-300 shadow-inner bg-white"
                    />
                  ) : (
                    <img
                      src={smcResolutionDoc.url}
                      alt="SMC Resolution Preview"
                      className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-xl"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Official Tamil Covering Letter Modal for School Login */}
          <TamilCoveringLetterModal
            isOpen={showCoveringLetterModal}
            onClose={() => setShowCoveringLetterModal(false)}
            type="school"
            schoolData={{
              schoolName: schoolData.schoolName,
              udiseCode: schoolData.udiseCode,
              blockName: schoolData.blockName,
              headmasterName: submittedByName || defaultMeta.headmasterName || currentUser.name,
              monthName: currentMonthName,
              calculationPeriod: cycleInfo.calculationPeriodString,
              totalWorkingDays: totalWorkingDays,
              totalStudents: studentRows.length,
              transportStudentsCount: studentRows.filter(s => s.category === 'Transport').length,
              escortStudentsCount: studentRows.filter(s => s.category === 'Escort').length,
              transportAmount: studentRows.filter(s => s.category === 'Transport').reduce((acc, s) => acc + s.totalClaimAmount, 0),
              escortAmount: studentRows.filter(s => s.category === 'Escort').reduce((acc, s) => acc + s.totalClaimAmount, 0),
              totalClaimAmount: studentRows.reduce((acc, s) => acc + s.totalClaimAmount, 0),
              submissionDateTime: existingClaim?.submissionDateTime || new Date().toLocaleString('en-IN'),
              accountHolderName: smcBankDetails.accountHolderName,
              accountNumber: smcBankDetails.accountNumber,
              bankName: 'Indian Bank',
              branch: smcBankDetails.branch,
              ifscCode: smcBankDetails.ifscCode,
            }}
          />

        </div>
      )}
    </div>
  );
};
