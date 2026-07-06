import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

const api = {
  transactions: {
    list: (filters?: unknown) => ipcRenderer.invoke(IPC.TRANSACTIONS_LIST, filters),
    get: (id: number) => ipcRenderer.invoke(IPC.TRANSACTIONS_GET, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC.TRANSACTIONS_CREATE, data),
    update: (id: number, data: unknown) => ipcRenderer.invoke(IPC.TRANSACTIONS_UPDATE, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC.TRANSACTIONS_DELETE, id),
    bulkDelete: (ids: number[]) => ipcRenderer.invoke(IPC.TRANSACTIONS_BULK_DELETE, ids),
  },
  persons: {
    list: () => ipcRenderer.invoke(IPC.PERSONS_LIST),
    get: (id: number) => ipcRenderer.invoke(IPC.PERSONS_GET, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC.PERSONS_CREATE, data),
    update: (id: number, data: unknown) => ipcRenderer.invoke(IPC.PERSONS_UPDATE, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC.PERSONS_DELETE, id),
    search: (query: string) => ipcRenderer.invoke(IPC.PERSONS_SEARCH, query),
  },
  inventory: {
    list: () => ipcRenderer.invoke(IPC.INVENTORY_LIST),
    get: (id: number) => ipcRenderer.invoke(IPC.INVENTORY_GET, id),
    movements: (id: number) => ipcRenderer.invoke(IPC.INVENTORY_MOVEMENTS, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC.INVENTORY_CREATE, data),
    update: (id: number, data: unknown) => ipcRenderer.invoke(IPC.INVENTORY_UPDATE, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC.INVENTORY_DELETE, id),
    bulkDelete: (ids: number[]) => ipcRenderer.invoke(IPC.INVENTORY_BULK_DELETE, ids),
    categories: () => ipcRenderer.invoke(IPC.INVENTORY_CATEGORIES),
    addStock: (items: unknown) => ipcRenderer.invoke(IPC.INVENTORY_ADD_STOCK, items),
  },
  reports: {
    balanceSheet: () => ipcRenderer.invoke(IPC.REPORTS_BALANCE_SHEET),
    incomeStatement: (from?: string, to?: string) => ipcRenderer.invoke(IPC.REPORTS_INCOME_STATEMENT, from, to),
    accountStatement: (personId: number) => ipcRenderer.invoke(IPC.REPORTS_ACCOUNT_STATEMENT, personId),
    receivablesSummary: () => ipcRenderer.invoke(IPC.REPORTS_RECEIVABLES_SUMMARY),
    payablesSummary: () => ipcRenderer.invoke(IPC.REPORTS_PAYABLES_SUMMARY),
    expensesSummary: (from?: string, to?: string) => ipcRenderer.invoke(IPC.REPORTS_EXPENSES_SUMMARY, from, to),
    dashboardStats: () => ipcRenderer.invoke(IPC.REPORTS_DASHBOARD_STATS),
  },
  bom: {
    list: () => ipcRenderer.invoke(IPC.BOM_LIST),
    get: (id: number) => ipcRenderer.invoke(IPC.BOM_GET, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC.BOM_CREATE, data),
    update: (id: number, data: unknown) => ipcRenderer.invoke(IPC.BOM_UPDATE, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC.BOM_DELETE, id),
  },
  ai: {
    parseText: (text: string) => ipcRenderer.invoke(IPC.AI_PARSE_TEXT, text),
    parseImage: (base64: string) => ipcRenderer.invoke(IPC.AI_PARSE_IMAGE, base64),
    parseAudio: (base64Audio: string) => ipcRenderer.invoke(IPC.AI_PARSE_AUDIO, base64Audio),
    chat: (question: string) => ipcRenderer.invoke(IPC.AI_CHAT, question),
    testKey: (key: string) => ipcRenderer.invoke(IPC.AI_TEST_KEY, key),
    dailyUsage: () => ipcRenderer.invoke(IPC.AI_DAILY_USAGE),
    generateBom: (description: string) => ipcRenderer.invoke(IPC.AI_GENERATE_BOM, description),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
    getAll: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
  },
  backup: {
    create: () => ipcRenderer.invoke(IPC.BACKUP_CREATE),
    restore: (path: string) => ipcRenderer.invoke(IPC.BACKUP_RESTORE, path),
    list: () => ipcRenderer.invoke(IPC.BACKUP_LIST),
  },
  pdf: {
    generate: (type: string, data: unknown) => ipcRenderer.invoke(IPC.PDF_GENERATE, type, data),
  },
  updater: {
    check: () => ipcRenderer.invoke(IPC.UPDATER_CHECK),
    download: () => ipcRenderer.invoke(IPC.UPDATER_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC.UPDATER_INSTALL),
    onStatus: (callback: (status: unknown) => void) => {
      const handler = (_event: unknown, status: unknown) => callback(status)
      ipcRenderer.on(IPC.UPDATER_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC.UPDATER_STATUS, handler)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
