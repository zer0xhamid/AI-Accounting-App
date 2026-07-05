export interface Transaction {
  id: number
  date: string
  type: 'شراء' | 'بيع' | 'دفعة' | 'تحصيل' | 'مصروف' | 'إيراد'
  person_id: number | null
  person_name?: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_method: 'كاش' | 'تحويل' | 'آجل' | 'شيك'
  expense_category: string | null
  input_method: 'ai_text' | 'ai_voice' | 'ai_image' | 'manual'
  original_text: string | null
  ai_raw_response: string | null
  notes: string | null
  created_at: string
  updated_at: string
  items?: TransactionItem[]
  bom_template_id?: number | null
}

export interface TransactionItem {
  id: number
  transaction_id: number
  inventory_item_id: number | null
  name: string
  quantity: number
  unit: string
  specs: string | null
  unit_price: number | null
  total_price: number | null
}

export interface Person {
  id: number
  name: string
  type: 'client' | 'supplier' | 'both' | 'contractor'
  phone: string | null
  notes: string | null
  balance: number
  created_at: string
  updated_at: string
}

export interface Account {
  id: number
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parent_id: number | null
  is_system: number
  balance: number
}

export interface InventoryItem {
  id: number
  category_id: number | null
  category_name?: string
  name: string
  unit: string
  specs: string | null
  quantity: number
  avg_cost: number
  min_quantity: number
  notes: string | null
}

export interface InventoryMovement {
  id: number
  inventory_item_id: number
  transaction_id: number | null
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  unit_cost: number | null
  date: string
  notes: string | null
}

export interface JournalEntry {
  id: number
  transaction_id: number
  account_id: number
  account_name?: string
  debit: number
  credit: number
  description: string | null
}

export interface AIParseResult {
  type: string
  person: string | null
  items: {
    name: string
    quantity: number
    unit: string
    specs: string | null
  }[]
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_method: string
  notes: string | null
}

export interface TransactionFilters {
  type?: string
  person_id?: number
  date_from?: string
  date_to?: string
  search?: string
  expense_category?: string
  limit?: number
  offset?: number
}

export interface BomTemplate {
  id: number
  name: string
  notes: string | null
  created_at: string
  items?: BomTemplateItem[]
}

export interface BomTemplateItem {
  id: number
  template_id: number
  material_name: string
  material_unit: string
  quantity: number
  notes: string | null
}

export interface ReceivableSummary {
  person_id: number
  person_name: string
  total_revenue: number
  total_collected: number
  outstanding: number
}

export interface PayableSummary {
  person_id: number
  person_name: string
  total_purchases: number
  total_paid: number
  outstanding: number
}

export interface ExpenseSummary {
  category: string
  total: number
  count: number
}
