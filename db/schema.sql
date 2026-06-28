-- Drop tables if they exist for clean migrations
DROP TABLE IF EXISTS public.crisp_user_balance_proofs;
DROP TABLE IF EXISTS public.crisp_solvency_reports;

-- Table for historical solvency reports
CREATE TABLE public.crisp_solvency_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_address VARCHAR(56) NOT NULL,
    tx_hash CHAR(64) UNIQUE NOT NULL,
    total_liabilities NUMERIC(20, 7) NOT NULL,
    total_reserves NUMERIC(20, 7) NOT NULL,
    kyc_root CHAR(64) UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table for user inclusion proofs corresponding to each report
CREATE TABLE public.crisp_user_balance_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_root CHAR(64) REFERENCES public.crisp_solvency_reports(kyc_root) ON DELETE CASCADE,
    account_address VARCHAR(56) NOT NULL,
    balance NUMERIC(20, 7) NOT NULL,
    proof_path JSONB NOT NULL,
    UNIQUE (kyc_root, account_address)
);

-- Enable RLS for security
ALTER TABLE public.crisp_solvency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisp_user_balance_proofs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to everyone
CREATE POLICY read_solvency_reports ON public.crisp_solvency_reports FOR SELECT TO public USING (true);
CREATE POLICY read_user_balance_proofs ON public.crisp_user_balance_proofs FOR SELECT TO public USING (true);

-- Allow public inserts for our generator/scripts (in a demo, keys are shared or open for mock client verification)
CREATE POLICY insert_solvency_reports ON public.crisp_solvency_reports FOR INSERT TO public WITH CHECK (true);
CREATE POLICY insert_user_balance_proofs ON public.crisp_user_balance_proofs FOR INSERT TO public WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_crisp_solvency_reports_root ON public.crisp_solvency_reports(kyc_root);
CREATE INDEX idx_crisp_user_balance_proofs_addr ON public.crisp_user_balance_proofs(account_address);
