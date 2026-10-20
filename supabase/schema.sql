-- =========================================================================================
-- SAMAGRA SHIKSHA - VELLORE DISTRICT | SCHOOL EDUCATION DEPARTMENT, TAMIL NADU
-- SUPABASE POSTGRESQL DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Scheme: Transport and Escort Facility for Elementary & Secondary School Students
-- =========================================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('SCHOOL', 'BLOCK', 'DISTRICT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE claim_status_enum AS ENUM (
      'NOT_SUBMITTED',
      'SUBMITTED_BY_SCHOOL',
      'PENDING_BLOCK_VERIFICATION',
      'BLOCK_APPROVED',
      'BLOCK_REJECTED',
      'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT',
      'PENDING_DISTRICT_VERIFICATION',
      'DISTRICT_REJECTED',
      'CORRECTION_REQUIRED',
      'RESUBMITTED_BY_BLOCK',
      'DISTRICT_APPROVED',
      'FINAL_DISTRICT_APPROVAL',
      'MONTHLY_CYCLE_CLOSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Blocks Master Table
CREATE TABLE IF NOT EXISTS public.blocks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    beo_officer_name TEXT NOT NULL,
    email TEXT,
    total_schools INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Schools Master Table
CREATE TABLE IF NOT EXISTS public.schools (
    udise_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    block_id TEXT REFERENCES public.blocks(id) ON DELETE CASCADE,
    block_name TEXT NOT NULL,
    category TEXT NOT NULL,
    headmaster_name TEXT NOT NULL,
    phone TEXT,
    eligible_students INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Users Table (for School, Block, and District Logins)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'SCHOOL', 'BLOCK', 'DISTRICT'
    name TEXT NOT NULL,
    udise_code TEXT,
    block_id TEXT,
    school_name TEXT,
    block_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial master login accounts into public.users
INSERT INTO public.users (username, password, role, name, udise_code, block_id, school_name, block_name)
VALUES
  -- Schools
  ('33040100101', '1234', 'SCHOOL', 'GHS Sathuvachari', '33040100101', 'BLK_VELLORE_URBAN', 'GHS Sathuvachari', 'Vellore Urban'),
  ('33040100102', '1234', 'SCHOOL', 'GGHSS Saidapet', '33040100102', 'BLK_VELLORE_URBAN', 'GGHSS Saidapet', 'Vellore Urban'),
  ('33040200101', '1234', 'SCHOOL', 'GHS Katpadi', '33040200101', 'BLK_KATPADI', 'GHS Katpadi', 'Katpadi'),
  ('33040300101', '1234', 'SCHOOL', 'GHS Anaicut', '33040300101', 'BLK_ANAICUT', 'GHS Anaicut', 'Anaicut'),

  -- Blocks
  ('BLK_VELLORE_URBAN', '1234', 'BLOCK', 'BEO Vellore Urban', NULL, 'BLK_VELLORE_URBAN', NULL, 'Vellore Urban'),
  ('BLK_KATPADI', '1234', 'BLOCK', 'BEO Katpadi', NULL, 'BLK_KATPADI', NULL, 'Katpadi'),
  ('BLK_ANAICUT', '1234', 'BLOCK', 'BEO Anaicut', NULL, 'BLK_ANAICUT', NULL, 'Anaicut'),

  -- District Office
  ('DIST_VELLORE_01', '1234', 'DISTRICT', 'CEO / DPC Office, Vellore', NULL, NULL, NULL, NULL)
ON CONFLICT (username) DO NOTHING;

-- 5. User Profiles Table (Synced with Supabase Auth or Google Apps Script)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id TEXT UNIQUE,
    full_name TEXT NOT NULL,
    role user_role_enum NOT NULL,
    block_id TEXT REFERENCES public.blocks(id),
    udise_code TEXT REFERENCES public.schools(udise_code),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Monthly Claims Table
CREATE TABLE IF NOT EXISTS public.monthly_claims (
    id TEXT PRIMARY KEY, -- e.g. "CLM_SCH_33040100101_2026-09"
    udise_code TEXT NOT NULL REFERENCES public.schools(udise_code) ON DELETE CASCADE,
    school_name TEXT NOT NULL,
    block_id TEXT NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
    block_name TEXT NOT NULL,
    claim_month_key TEXT NOT NULL, -- e.g. "2026-09"
    claim_month_name TEXT NOT NULL, -- e.g. "September 2026"
    calculation_period TEXT NOT NULL, -- e.g. "01/09/2026 to 30/09/2026"
    total_students INTEGER NOT NULL DEFAULT 0,
    total_claim_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status claim_status_enum NOT NULL DEFAULT 'SUBMITTED_BY_SCHOOL',
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Block Level Verification Details
    block_verified_by_user_id TEXT,
    block_verified_by_name TEXT,
    block_verified_at TIMESTAMPTZ,
    block_decision TEXT,
    block_remarks TEXT,

    -- District Level Verification Details
    district_verified_by_user_id TEXT,
    district_verified_by_name TEXT,
    district_verified_at TIMESTAMPTZ,
    district_decision TEXT,
    district_remarks TEXT,

    -- Final Sanction
    sanction_order_no TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate school submission for same month key
    CONSTRAINT unique_school_month_claim UNIQUE (udise_code, claim_month_key)
);

-- 6. Claim Student Beneficiary Line Items
CREATE TABLE IF NOT EXISTS public.claim_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id TEXT NOT NULL REFERENCES public.monthly_claims(id) ON DELETE CASCADE,
    udise_code TEXT NOT NULL,
    emis_number TEXT NOT NULL,
    student_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Transport', 'Escort')),
    working_days_in_month INTEGER NOT NULL,
    days_attended INTEGER NOT NULL,
    rate_per_day NUMERIC(8, 2) NOT NULL,
    total_claim_amount NUMERIC(10, 2) NOT NULL,
    service_provider_name TEXT NOT NULL,
    beneficiary_account_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Block-Level Consolidated Submissions
CREATE TABLE IF NOT EXISTS public.block_claims (
    id TEXT PRIMARY KEY, -- e.g. "CLM_BLK_VELLORE_URBAN_2026-09"
    block_id TEXT NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
    block_name TEXT NOT NULL,
    claim_month_key TEXT NOT NULL,
    claim_month_name TEXT NOT NULL,
    calculation_period TEXT NOT NULL,
    total_schools_count INTEGER NOT NULL,
    submitted_schools_count INTEGER NOT NULL,
    total_students_count INTEGER NOT NULL,
    total_claim_amount NUMERIC(14, 2) NOT NULL,
    status claim_status_enum NOT NULL DEFAULT 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT',
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    rejection_remarks TEXT,
    resubmission_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_block_month_claim UNIQUE (block_id, claim_month_key)
);

-- 8. Permanent Audit Log (Never Deleted)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role user_role_enum NOT NULL,
    school_or_block_name TEXT NOT NULL,
    claim_month TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT
);

-- 9. Row Level Security (RLS) Policies
ALTER TABLE public.monthly_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated system operations
CREATE POLICY "Public read for demo and service role" ON public.monthly_claims FOR SELECT USING (true);
CREATE POLICY "Public insert for school submissions" ON public.monthly_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for verification actions" ON public.monthly_claims FOR UPDATE USING (true);

CREATE POLICY "Public read for claim students" ON public.claim_students FOR SELECT USING (true);
CREATE POLICY "Public insert for claim students" ON public.claim_students FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read for block claims" ON public.block_claims FOR SELECT USING (true);
CREATE POLICY "Public write for block claims" ON public.block_claims FOR ALL USING (true);

CREATE POLICY "Audit logs immutable read" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Audit logs append-only insert" ON public.audit_logs FOR INSERT WITH CHECK (true);
-- Note: No UPDATE or DELETE policy on audit_logs to preserve historical integrity!

-- 10. Initial Seed for Vellore Educational Blocks
INSERT INTO public.blocks (id, code, name, beo_officer_name, email, total_schools)
VALUES
    ('BLK_VELLORE_URBAN', '330401', 'Vellore Urban', 'S. Shanmugam (BEO)', 'beo.velloreurban@tnschools.gov.in', 4),
    ('BLK_VELLORE_RURAL', '330402', 'Vellore Rural', 'M. Kavitha (BEO)', 'beo.vellorerural@tnschools.gov.in', 3),
    ('BLK_KATPADI', '330403', 'Katpadi', 'R. Venkatesan (BEO)', 'beo.katpadi@tnschools.gov.in', 3),
    ('BLK_ANAICUT', '330404', 'Anaicut', 'P. Anandhan (BEO)', 'beo.anaicut@tnschools.gov.in', 3),
    ('BLK_GUDIYATHAM', '330405', 'Gudiyatham', 'D. Senthamarai (BEO)', 'beo.gudiyatham@tnschools.gov.in', 3),
    ('BLK_KANIYAMBADI', '330406', 'Kaniyambadi', 'G. Murugan (BEO)', 'beo.kaniyambadi@tnschools.gov.in', 2),
    ('BLK_PERNAMBUT', '330407', 'Pernambut', 'K. Syed Ahmed (BEO)', 'beo.pernambut@tnschools.gov.in', 2)
ON CONFLICT (id) DO NOTHING;
