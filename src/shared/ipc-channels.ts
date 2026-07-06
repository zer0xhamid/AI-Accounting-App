export const IPC = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_SET_PASSWORD: 'auth:set-password',
  AUTH_CHECK_EXISTS: 'auth:check-password-exists',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Transactions
  TRANSACTIONS_LIST: 'transactions:list',
  TRANSACTIONS_GET: 'transactions:get',
  TRANSACTIONS_CREATE: 'transactions:create',
  TRANSACTIONS_UPDATE: 'transactions:update',
  TRANSACTIONS_DELETE: 'transactions:delete',
  TRANSACTIONS_BULK_DELETE: 'transactions:bulk-delete',

  // Persons
  PERSONS_LIST: 'persons:list',
  PERSONS_GET: 'persons:get',
  PERSONS_CREATE: 'persons:create',
  PERSONS_UPDATE: 'persons:update',
  PERSONS_DELETE: 'persons:delete',
  PERSONS_SEARCH: 'persons:search',

  // Inventory
  INVENTORY_LIST: 'inventory:list',
  INVENTORY_GET: 'inventory:get',
  INVENTORY_MOVEMENTS: 'inventory:movements',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_BULK_DELETE: 'inventory:bulk-delete',
  INVENTORY_CATEGORIES: 'inventory:categories',
  INVENTORY_ADD_STOCK: 'inventory:add-stock',

  // Reports
  REPORTS_BALANCE_SHEET: 'reports:balance-sheet',
  REPORTS_INCOME_STATEMENT: 'reports:income-statement',
  REPORTS_ACCOUNT_STATEMENT: 'reports:account-statement',
  REPORTS_RECEIVABLES_SUMMARY: 'reports:receivables-summary',
  REPORTS_PAYABLES_SUMMARY: 'reports:payables-summary',
  REPORTS_EXPENSES_SUMMARY: 'reports:expenses-summary',
  REPORTS_DASHBOARD_STATS: 'reports:dashboard-stats',

  // AI
  AI_PARSE_TEXT: 'ai:parse-text',
  AI_PARSE_IMAGE: 'ai:parse-image',
  AI_PARSE_AUDIO: 'ai:parse-audio',
  AI_CHAT: 'ai:chat',
  AI_TEST_KEY: 'ai:test-key',
  AI_DAILY_USAGE: 'ai:daily-usage',
  AI_GENERATE_BOM: 'ai:generate-bom',

  // BOM
  BOM_LIST: 'bom:list',
  BOM_GET: 'bom:get',
  BOM_CREATE: 'bom:create',
  BOM_UPDATE: 'bom:update',
  BOM_DELETE: 'bom:delete',

  // Backup
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_LIST: 'backup:list',

  // PDF
  PDF_GENERATE: 'pdf:generate',

  // Updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_STATUS: 'updater:status',
} as const
