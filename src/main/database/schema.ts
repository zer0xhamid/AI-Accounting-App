import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const currentVersion = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
  const version = currentVersion?.v ?? 0

  if (version < 1) {
    db.exec(migration001)
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1)
  }

  if (version < 2) {
    db.exec(migration002)
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(2)
  }

  if (version < 3) {
    seedBomPresets(db)
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(3)
  }
}

const migration001 = `
-- Settings & Auth
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL,
  parent_id INTEGER REFERENCES accounts(id),
  is_system INTEGER NOT NULL DEFAULT 0,
  balance   REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Persons
CREATE TABLE IF NOT EXISTS persons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'both',
  phone      TEXT,
  notes      TEXT,
  balance    REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  date             TEXT NOT NULL DEFAULT (date('now')),
  type             TEXT NOT NULL,
  person_id        INTEGER REFERENCES persons(id),
  total_amount     REAL NOT NULL DEFAULT 0,
  paid_amount      REAL NOT NULL DEFAULT 0,
  remaining_amount REAL NOT NULL DEFAULT 0,
  payment_method   TEXT NOT NULL DEFAULT 'كاش',
  input_method     TEXT NOT NULL DEFAULT 'manual',
  original_text    TEXT,
  ai_raw_response  TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_person ON transactions(person_id);

-- Transaction Items
CREATE TABLE IF NOT EXISTS transaction_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id    INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  inventory_item_id INTEGER REFERENCES inventory_items(id),
  name              TEXT NOT NULL,
  quantity          REAL NOT NULL DEFAULT 1,
  unit              TEXT NOT NULL DEFAULT 'قطعة',
  specs             TEXT,
  unit_price        REAL,
  total_price       REAL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON transaction_items(transaction_id);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id     INTEGER NOT NULL REFERENCES accounts(id),
  debit          REAL NOT NULL DEFAULT 0,
  credit         REAL NOT NULL DEFAULT 0,
  description    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journal_txn ON journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_journal_account ON journal_entries(account_id);

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES inventory_categories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES inventory_categories(id),
  name         TEXT NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'قطعة',
  specs        TEXT,
  quantity     REAL NOT NULL DEFAULT 0,
  avg_cost     REAL NOT NULL DEFAULT 0,
  min_quantity REAL NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category_id);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  transaction_id    INTEGER REFERENCES transactions(id),
  type              TEXT NOT NULL,
  quantity          REAL NOT NULL,
  unit_cost         REAL,
  date              TEXT NOT NULL DEFAULT (date('now')),
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_item ON inventory_movements(inventory_item_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  client_id   INTEGER REFERENCES persons(id),
  total_value REAL NOT NULL DEFAULT 0,
  total_costs REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed Default Chart of Accounts
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_system) VALUES
  ('1000', 'الأصول', 'asset', NULL, 1),
  ('1100', 'الصندوق (كاش)', 'asset', 1, 1),
  ('1200', 'البنك', 'asset', 1, 1),
  ('1300', 'العملاء (مدينون)', 'asset', 1, 1),
  ('1400', 'المخزون', 'asset', 1, 1),
  ('2000', 'الالتزامات', 'liability', NULL, 1),
  ('2100', 'الموردون (دائنون)', 'liability', 6, 1),
  ('3000', 'حقوق الملكية', 'equity', NULL, 1),
  ('3100', 'رأس المال', 'equity', 8, 1),
  ('4000', 'الإيرادات', 'revenue', NULL, 1),
  ('4100', 'إيرادات المبيعات', 'revenue', 10, 1),
  ('4200', 'إيرادات المقاولات', 'revenue', 10, 1),
  ('5000', 'المصروفات', 'expense', NULL, 1),
  ('5100', 'تكلفة البضاعة المباعة', 'expense', 13, 1),
  ('5200', 'الإيجار', 'expense', 13, 1),
  ('5300', 'الكهرباء والمياه', 'expense', 13, 1),
  ('5400', 'الرواتب', 'expense', 13, 1),
  ('5500', 'مصروفات نقل', 'expense', 13, 1),
  ('5600', 'مصروفات متنوعة', 'expense', 13, 1);

-- Seed Default Inventory Categories
INSERT OR IGNORE INTO inventory_categories (name) VALUES
  ('خشب'),
  ('مشتقات خشب'),
  ('مطابخ'),
  ('أبواب'),
  ('مقاولات');

-- Seed Default Settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('api_key', ''),
  ('model_name', 'gemini-3.1-flash-lite'),
  ('app_version', '1.0.0'),
  ('daily_request_count', '0'),
  ('daily_request_date', '');
`

const migration002 = `
-- Add expense category to transactions
ALTER TABLE transactions ADD COLUMN expense_category TEXT;

-- BOM Templates (product recipes)
CREATE TABLE IF NOT EXISTS bom_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- BOM Template Items (raw materials per recipe)
CREATE TABLE IF NOT EXISTS bom_template_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id   INTEGER NOT NULL REFERENCES bom_templates(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_unit TEXT NOT NULL DEFAULT 'قطعة',
  quantity      REAL NOT NULL,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_bom_items_template ON bom_template_items(template_id);

-- New inventory categories
INSERT OR IGNORE INTO inventory_categories (name) VALUES
  ('MDF'),
  ('أبلكاش'),
  ('كونتر'),
  ('خامات أخرى');
`

function seedBomPresets(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM bom_templates').get() as { count: number }
  if (existing.count > 0) return

  const insertTemplate = db.prepare('INSERT INTO bom_templates (name, notes) VALUES (?, ?)')
  const insertItem = db.prepare('INSERT INTO bom_template_items (template_id, material_name, material_unit, quantity, notes) VALUES (?, ?, ?, ?, ?)')

  const presets = [
    {
      name: 'باب 80 سم',
      notes: 'لوح 3.66×1.83 بيطلع 6 أبواب ثمانينات',
      items: [
        { material_name: 'أبلكاش', material_unit: 'لوح', quantity: 1, notes: null },
        { material_name: 'خشب', material_unit: 'لوح', quantity: 0.167, notes: '≈ 1/6 لوح' },
        { material_name: 'كونتر', material_unit: 'لوح', quantity: 1, notes: null },
        { material_name: 'MDF', material_unit: 'لوح', quantity: 1, notes: null },
      ],
    },
    {
      name: 'باب 70 سم',
      notes: 'لوح 3.66×1.83 بيطلع 7 أبواب سبعينات',
      items: [
        { material_name: 'أبلكاش', material_unit: 'لوح', quantity: 1, notes: null },
        { material_name: 'خشب', material_unit: 'لوح', quantity: 0.143, notes: '≈ 1/7 لوح' },
        { material_name: 'كونتر', material_unit: 'لوح', quantity: 1, notes: null },
        { material_name: 'MDF', material_unit: 'لوح', quantity: 1, notes: null },
      ],
    },
    {
      name: 'حشواية بلكونة',
      notes: 'لوح 3.66×1.83 بيطلع 15 حشواية',
      items: [
        { material_name: 'خشب', material_unit: 'لوح', quantity: 0.067, notes: '≈ 1/15 لوح' },
      ],
    },
    {
      name: 'حشواية بلكونة شيش',
      notes: 'لوح 3.66×1.83 بيطلع 42 حشواية شيش',
      items: [
        { material_name: 'خشب', material_unit: 'لوح', quantity: 0.024, notes: '≈ 1/42 لوح' },
      ],
    },
  ]

  for (const preset of presets) {
    const result = insertTemplate.run(preset.name, preset.notes)
    const templateId = result.lastInsertRowid
    for (const item of preset.items) {
      insertItem.run(templateId, item.material_name, item.material_unit, item.quantity, item.notes)
    }
  }
}
