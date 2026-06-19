-- Migration 001: Initial PostgreSQL schema
-- Converted from Cloudflare D1 (SQLite) to PostgreSQL

BEGIN;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. tenants (created first since other tables reference tenant_id)
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    subscription_status TEXT DEFAULT 'trial',
    subscription_plan TEXT DEFAULT 'basic',
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    company_type TEXT DEFAULT 'PJ',
    cnpj TEXT,
    email TEXT,
    verification_code TEXT,
    verification_code_expires TIMESTAMPTZ
);

-- 2. admins
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id INTEGER DEFAULT 1
);

-- 4. homes
CREATE TABLE homes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id INTEGER DEFAULT 1
);

-- 5. employees
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    document TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    work_schedule TEXT,
    ctps_numero TEXT,
    ctps_serie TEXT,
    admission_date DATE,
    saturday_schedule TEXT,
    weekly_rest TEXT,
    hours_per_day TEXT DEFAULT '8:48:00',
    tenant_id INTEGER DEFAULT 1
);

-- 6. categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    parent_id INTEGER,
    tenant_id INTEGER DEFAULT 1
);

-- 7. companies
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id INTEGER DEFAULT 1
);

-- 8. transactions
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    home_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    employee_id INTEGER,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    description TEXT,
    notes TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE,
    payment_date DATE,
    company_id INTEGER,
    tenant_id INTEGER DEFAULT 1
);

-- 9. pix_keys
CREATE TABLE pix_keys (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    key_type TEXT NOT NULL,
    key_value TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id INTEGER DEFAULT 1
);

-- 10. attachments
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. timesheets
CREATE TABLE timesheets (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'OPEN',
    total_worked TEXT,
    total_expected TEXT,
    total_overtime TEXT,
    notes TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id INTEGER DEFAULT 1,
    UNIQUE (employee_id, month, year)
);

-- 12. timesheet_entries
CREATE TABLE timesheet_entries (
    id SERIAL PRIMARY KEY,
    timesheet_id INTEGER NOT NULL,
    day INTEGER NOT NULL,
    entry1 TEXT,
    exit1 TEXT,
    entry2 TEXT,
    exit2 TEXT,
    hours_worked TEXT,
    hours_expected TEXT,
    overtime TEXT,
    observation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (timesheet_id, day)
);

-- 13. verification_requests
CREATE TABLE verification_requests (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Transaction indexes
CREATE INDEX idx_transactions_date ON transactions (date);
CREATE INDEX idx_transactions_home_id ON transactions (home_id);
CREATE INDEX idx_transactions_category_id ON transactions (category_id);
CREATE INDEX idx_transactions_employee_id ON transactions (employee_id);
CREATE INDEX idx_transactions_type_status ON transactions (type, status);

-- Pix keys index
CREATE INDEX idx_pix_keys_employee ON pix_keys (employee_id);

-- Attachments index
CREATE INDEX idx_attachments_transaction_id ON attachments (transaction_id);

-- Timesheet entries index
CREATE INDEX idx_timesheet_entries_timesheet ON timesheet_entries (timesheet_id);

-- Tenant isolation indexes
CREATE INDEX idx_users_tenant_id ON users (tenant_id);
CREATE INDEX idx_homes_tenant_id ON homes (tenant_id);
CREATE INDEX idx_employees_tenant_id ON employees (tenant_id);
CREATE INDEX idx_categories_tenant_id ON categories (tenant_id);
CREATE INDEX idx_transactions_tenant_id ON transactions (tenant_id);
CREATE INDEX idx_pix_keys_tenant_id ON pix_keys (tenant_id);
CREATE INDEX idx_companies_tenant_id ON companies (tenant_id);
CREATE INDEX idx_timesheets_tenant_id ON timesheets (tenant_id);

COMMIT;
