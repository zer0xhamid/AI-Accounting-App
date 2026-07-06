import { useState, useEffect } from 'react'
import { Plus, Save, X, ListTree } from 'lucide-react'
import PersonSelector from './PersonSelector'
import ItemRow from './ItemRow'
import type { Person, BomTemplate } from '../../../shared/types'

interface ItemData {
  name: string
  quantity: number
  unit: string
  specs: string
}

interface FormData {
  date: string
  type: string
  person: Person | null
  items: ItemData[]
  total_amount: number
  paid_amount: number
  payment_method: string
  expense_category: string
  notes: string
  input_method: string
  original_text: string | null
  ai_raw_response: string | null
  bom_template_id: number | null
  bom_selections: { template_id: number; quantity: number }[]
}

interface Props {
  initialData?: Partial<FormData>
  onSave: (data: FormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const transactionTypes = [
  { value: 'شراء', label: 'شراء', color: 'var(--danger)' },
  { value: 'بيع', label: 'بيع', color: 'var(--success)' },
  { value: 'دفعة', label: 'دفعة (دفعت لحد)', color: 'var(--info)' },
  { value: 'تحصيل', label: 'تحصيل (حد دفعلي)', color: 'var(--accent)' },
  { value: 'مصروف', label: 'مصروف', color: 'var(--warning)' },
  { value: 'إيراد', label: 'إيراد', color: 'var(--success)' },
  { value: 'إضافة_مخزن', label: 'إضافة مخزن', color: 'var(--info)' },
  { value: 'تعديل_رصيد', label: 'تعديل رصيد', color: 'var(--text-secondary)' },
]

const paymentMethods = [
  { value: 'كاش', label: 'كاش (نقدي)' },
  { value: 'تحويل', label: 'تحويل بنكي' },
  { value: 'آجل', label: 'آجل' },
  { value: 'شيك', label: 'شيك' },
]

const expenseCategories = [
  { value: 'نثريات', label: 'نثريات' },
  { value: 'مصنعيات تركيب', label: 'مصنعيات تركيب' },
  { value: 'مصنعيات تصنيع', label: 'مصنعيات تصنيع' },
  { value: 'نقل', label: 'نقل' },
  { value: 'أخرى', label: 'أخرى' },
]

const emptyItem: ItemData = { name: '', quantity: 1, unit: 'قطعة', specs: '' }

export default function TransactionForm({ initialData, onSave, onCancel, isLoading }: Props) {
  const [bomTemplates, setBomTemplates] = useState<BomTemplate[]>([])

  useEffect(() => {
    window.api.bom.list().then((list) => setBomTemplates(list as BomTemplate[]))
  }, [])

  const [form, setForm] = useState<FormData>({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    type: initialData?.type || 'شراء',
    person: initialData?.person || null,
    items: initialData?.items?.length ? initialData.items : [{ ...emptyItem }],
    total_amount: initialData?.total_amount || 0,
    paid_amount: initialData?.paid_amount || 0,
    payment_method: initialData?.payment_method || 'كاش',
    expense_category: initialData?.expense_category || '',
    notes: initialData?.notes || '',
    input_method: initialData?.input_method || 'manual',
    original_text: initialData?.original_text || null,
    ai_raw_response: initialData?.ai_raw_response || null,
    bom_template_id: initialData?.bom_template_id || null,
    bom_selections: initialData?.bom_selections || [],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const remaining = form.total_amount - form.paid_amount

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'payment_method' && value === 'آجل') {
        updated.paid_amount = 0
      }
      return updated
    })
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }))
  }

  const updateItem = (index: number, item: ItemData) => {
    setForm((prev) => {
      const items = [...prev.items]
      items[index] = item
      return { ...prev, items }
    })
  }

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!form.type) errs.type = 'اختر نوع العملية'
    if (!['إضافة_مخزن', 'تعديل_رصيد'].includes(form.type) && form.total_amount <= 0) errs.total_amount = 'أدخل المبلغ الإجمالي'
    if (form.type === 'تعديل_رصيد' && form.total_amount === 0) errs.total_amount = 'أدخل مبلغ التعديل'
    if (form.paid_amount < 0) errs.paid_amount = 'المبلغ المدفوع لا يمكن أن يكون سالب'
    if (form.paid_amount > form.total_amount) errs.paid_amount = 'المدفوع أكبر من الإجمالي'

    const needsPerson = ['بيع', 'شراء', 'تحصيل', 'دفعة'].includes(form.type)
    if (needsPerson && !form.person) {
      errs.person = form.type === 'بيع' || form.type === 'تحصيل' ? 'يجب اختيار العميل' : 'يجب اختيار المورد'
    }

    const needsItems = ['شراء', 'بيع', 'إضافة_مخزن'].includes(form.type)
    if (needsItems && form.items.every((i) => !i.name.trim())) {
      errs.items = 'أضف صنف واحد على الأقل'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    await onSave(form)
  }

  const showItems = ['شراء', 'بيع', 'مصروف', 'إضافة_مخزن'].includes(form.type)
  const isInventoryAdd = form.type === 'إضافة_مخزن'
  const isBalanceAdjust = form.type === 'تعديل_رصيد'

  return (
    <div className="glass-card animate-fadeIn" style={{ maxWidth: 800 }}>
      {/* Type Selector */}
      <div style={styles.section}>
        <label style={styles.label}>نوع العملية</label>
        <div style={styles.typeGrid}>
          {transactionTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => updateField('type', t.value)}
              style={{
                ...styles.typeBtn,
                ...(form.type === t.value
                  ? { borderColor: t.color, background: `${t.color}15`, color: t.color }
                  : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {errors.type && <p style={styles.error}>{errors.type}</p>}
      </div>

      {/* Date */}
      <div style={styles.section}>
        <label style={styles.label}>التاريخ</label>
        <input
          className="input"
          type="date"
          value={form.date}
          onChange={(e) => updateField('date', e.target.value)}
        />
      </div>

      {/* Person */}
      {!isInventoryAdd && !isBalanceAdjust && (
      <div style={styles.section}>
        <label style={styles.label}>
          {['شراء', 'دفعة'].includes(form.type) ? 'المورد' : ['بيع', 'تحصيل'].includes(form.type) ? 'العميل' : form.type === 'مصروف' ? 'الورشة/الصنايعي (اختياري)' : 'الطرف (اختياري)'}
        </label>
        <PersonSelector
          selectedPerson={form.person}
          onSelect={(p) => updateField('person', p)}
          transactionType={form.type}
        />
        {errors.person && <p style={styles.error}>{errors.person}</p>}
      </div>
      )}

      {/* Expense Category */}
      {form.type === 'مصروف' && (
        <div style={styles.section}>
          <label style={styles.label}>تصنيف المصروف</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {expenseCategories.map((c) => {
              const isCustom = c.value === 'أخرى'
              const isSelected = isCustom
                ? !expenseCategories.slice(0, -1).some(ec => ec.value === form.expense_category) && form.expense_category !== ''
                : form.expense_category === c.value
              return (
                <button
                  key={c.value}
                  onClick={() => updateField('expense_category', isCustom ? 'أخرى' : c.value)}
                  style={{
                    ...styles.paymentBtn,
                    ...(isSelected
                      ? { borderColor: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }
                      : {}),
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          {(() => {
            const isPredefined = expenseCategories.slice(0, -1).some(c => c.value === form.expense_category)
            const showCustom = !isPredefined && form.expense_category !== ''
            if (!showCustom) return null
            return (
              <input
                className="input"
                style={{ marginTop: 10 }}
                placeholder="اكتب التصنيف..."
                value={form.expense_category === 'أخرى' ? '' : form.expense_category}
                onChange={(e) => updateField('expense_category', e.target.value || 'أخرى')}
                autoFocus
              />
            )
          })()}
        </div>
      )}

      {/* BOM Template Selector (sell only) */}
      {form.type === 'بيع' && bomTemplates.length > 0 && (
        <div style={styles.section}>
          <label style={styles.label}>
            <ListTree size={14} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            وصفات المنتجات (اختياري — لخصم المواد الخام تلقائياً)
          </label>
          {form.bom_selections.map((sel, idx) => {
            const tmpl = bomTemplates.find(t => t.id === sel.template_id)
            return (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select
                  className="select"
                  style={{ flex: 2 }}
                  value={sel.template_id}
                  onChange={(e) => {
                    const newSel = [...form.bom_selections]
                    newSel[idx] = { ...newSel[idx], template_id: parseInt(e.target.value) }
                    updateField('bom_selections', newSel)
                  }}
                >
                  {bomTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input
                  className="input"
                  style={{ flex: 0.6 }}
                  type="number"
                  min="1"
                  value={sel.quantity}
                  onChange={(e) => {
                    const newSel = [...form.bom_selections]
                    newSel[idx] = { ...newSel[idx], quantity: parseInt(e.target.value) || 1 }
                    updateField('bom_selections', newSel)
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>قطعة</span>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                  onClick={() => updateField('bom_selections', form.bom_selections.filter((_, i) => i !== idx))}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => updateField('bom_selections', [...form.bom_selections, { template_id: bomTemplates[0].id, quantity: 1 }])}
          >
            <Plus size={14} /> إضافة وصفة
          </button>
          {form.bom_selections.length > 0 && (
            <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-glass)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>سيتم خصم:</p>
              {form.bom_selections.map((sel, idx) => {
                const tmpl = bomTemplates.find(t => t.id === sel.template_id)
                if (!tmpl?.items?.length) return null
                return (
                  <div key={idx} style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{tmpl.name} × {sel.quantity}: </span>
                    {tmpl.items.map((item, i) => (
                      <span key={i}>{item.material_name} ({(item.quantity * sel.quantity).toFixed(3)} {item.material_unit}){i < tmpl.items!.length - 1 ? '، ' : ''}</span>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      {showItems && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label style={styles.label}>الأصناف</label>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={addItem}>
              <Plus size={14} /> إضافة صنف
            </button>
          </div>
          {/* Items Header */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ flex: 2 }}>الصنف</div>
            <div style={{ flex: 1 }}>الكمية</div>
            <div style={{ flex: 1 }}>الوحدة</div>
            <div style={{ flex: 1.5 }}>المواصفات</div>
            {form.items.length > 1 && <div style={{ width: 32 }}></div>}
          </div>
          {form.items.map((item, i) => (
            <ItemRow
              key={i}
              item={item}
              onChange={(updated) => updateItem(i, updated)}
              onRemove={() => removeItem(i)}
              canRemove={form.items.length > 1}
            />
          ))}
          {errors.items && <p style={styles.error}>{errors.items}</p>}
        </div>
      )}

      {/* Amounts */}
      {!isInventoryAdd && (
      <div style={styles.section}>
        {isBalanceAdjust ? (
          <div>
            <label style={styles.label}>مبلغ التعديل (موجب = إضافة، سالب = خصم)</label>
            <input
              className="input"
              type="number"
              value={form.total_amount || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                updateField('total_amount', val)
                updateField('paid_amount', val)
              }}
              placeholder="0"
            />
            {errors.total_amount && <p style={styles.error}>{errors.total_amount}</p>}
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={styles.label}>المبلغ الإجمالي</label>
            <input
              className="input"
              type="number"
              value={form.total_amount || ''}
              onChange={(e) => updateField('total_amount', parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
            />
            {errors.total_amount && <p style={styles.error}>{errors.total_amount}</p>}
          </div>
          <div>
            <label style={styles.label}>المدفوع</label>
            <input
              className="input"
              type="number"
              value={form.paid_amount || ''}
              onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
              disabled={form.payment_method === 'آجل'}
            />
            {errors.paid_amount && <p style={styles.error}>{errors.paid_amount}</p>}
          </div>
          <div>
            <label style={styles.label}>المتبقي</label>
            <div style={styles.remainingBox}>
              <span style={{ color: remaining > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {remaining.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Payment Method */}
      {!isInventoryAdd && !isBalanceAdjust && (
      <div style={styles.section}>
        <label style={styles.label}>طريقة الدفع</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {paymentMethods.map((m) => (
            <button
              key={m.value}
              onClick={() => updateField('payment_method', m.value)}
              style={{
                ...styles.paymentBtn,
                ...(form.payment_method === m.value
                  ? { borderColor: 'var(--accent)', background: 'var(--bg-active)', color: 'var(--accent)' }
                  : {}),
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Notes */}
      <div style={styles.section}>
        <label style={styles.label}>ملاحظات (اختياري)</label>
        <input
          className="input"
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="أي ملاحظات إضافية..."
        />
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={isLoading}>
          <Save size={16} />
          {isLoading ? 'جاري الحفظ...' : isInventoryAdd ? 'إضافة للمخزن' : isBalanceAdjust ? 'تعديل الرصيد' : 'حفظ العملية'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          <X size={16} />
          إلغاء
        </button>
      </div>
    </div>
  )
}

export type { FormData, ItemData }

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  typeBtn: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: "'Cairo', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  paymentBtn: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: "'Cairo', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  remainingBox: {
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-glass)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 16,
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    gap: 12,
    paddingTop: 16,
    borderTop: '1px solid var(--border-color)',
  },
  error: {
    fontSize: 12,
    color: 'var(--danger)',
    marginTop: 4,
  },
}
