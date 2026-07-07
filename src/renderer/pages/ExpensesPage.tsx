import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, Hammer, Truck, Coffee, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import type { Transaction, ExpenseSummary } from '../../shared/types'
import { useAppStore } from '../store/appStore'

const categoryIcons: Record<string, typeof Coffee> = {
  'نثريات': Coffee,
  'مصنعيات تركيب': Hammer,
  'مصنعيات تصنيع': Hammer,
  'نقل': Truck,
  'أخرى': MoreHorizontal,
}

const categoryColors: Record<string, { color: string; bg: string }> = {
  'نثريات': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  'مصنعيات تركيب': { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  'مصنعيات تصنيع': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  'نقل': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  'أخرى': { color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
}

export default function ExpensesPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const [summary, setSummary] = useState<ExpenseSummary[]>([])
  const [expenses, setExpenses] = useState<Transaction[]>([])
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [quickDesc, setQuickDesc] = useState('')
  const [quickAmount, setQuickAmount] = useState('')
  const [quickCategory, setQuickCategory] = useState('نثريات')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggleSelect = (id: number, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === expenses.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(expenses.map((t) => t.id)))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} مصروف؟`)) return
    await window.api.transactions.bulkDelete(Array.from(selectedIds))
    addToast(`تم حذف ${selectedIds.size} مصروف`, 'info')
    setSelectedIds(new Set())
    loadData()
  }

  const loadData = async () => {
    const summaryData = await window.api.reports.expensesSummary(dateFrom || undefined, dateTo || undefined) as ExpenseSummary[]
    setSummary(summaryData)

    const txns = await window.api.transactions.list({
      type: 'مصروف',
      expense_category: filter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }) as Transaction[]
    setExpenses(txns)
  }

  useEffect(() => { loadData() }, [filter, dateFrom, dateTo])

  const totalExpenses = summary.reduce((s, c) => s + c.total, 0)

  const handleQuickSave = async () => {
    if (!quickDesc.trim() || !quickAmount) return
    setIsSaving(true)
    try {
      await window.api.transactions.create({
        date: new Date().toISOString().split('T')[0],
        type: 'مصروف',
        person_id: null,
        total_amount: parseFloat(quickAmount),
        paid_amount: parseFloat(quickAmount),
        remaining_amount: 0,
        payment_method: 'كاش',
        expense_category: quickCategory,
        input_method: 'manual',
        original_text: null,
        ai_raw_response: null,
        notes: quickDesc.trim(),
        items: [{ name: quickDesc.trim(), quantity: 1, unit: 'عدد', specs: null, unit_price: parseFloat(quickAmount), total_price: parseFloat(quickAmount) }],
        bom_template_id: null,
      })
      addToast('تم حفظ المصروف', 'success')
      setQuickDesc('')
      setQuickAmount('')
      setShowForm(false)
      loadData()
    } catch {
      addToast('خطأ في الحفظ', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('حذف هذا المصروف؟')) return
    await window.api.transactions.delete(id)
    addToast('تم الحذف', 'info')
    loadData()
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 className="page-title">
          <Banknote size={28} style={{ color: 'var(--warning)', marginLeft: 12, verticalAlign: 'middle' }} />
          المصروفات
        </h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> إضافة مصروف سريع
        </button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>البيان</label>
              <input className="input" placeholder="مثال: شاي وسكر، مسامير..." value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>المبلغ</label>
              <input className="input" type="number" placeholder="0" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>التصنيف</label>
              <select className="select" value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)}>
                <option value="نثريات">نثريات</option>
                <option value="مصنعيات تركيب">مصنعيات تركيب</option>
                <option value="مصنعيات تصنيع">مصنعيات تصنيع</option>
                <option value="نقل">نقل</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <button className="btn btn-success" onClick={handleQuickSave} disabled={isSaving} style={{ height: 46 }}>
              {isSaving ? '...' : 'حفظ'}
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(summary.length + 1, 6)}, 1fr)`, gap: 16, marginBottom: 28 }}>
        <div className="glass-card stat-card" style={{ cursor: 'pointer', border: !filter ? '1px solid var(--warning)' : undefined }} onClick={() => setFilter('')}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Banknote size={20} />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{totalExpenses.toLocaleString()}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي المصروفات</p>
        </div>
        {summary.map((s) => {
          const Icon = categoryIcons[s.category] || MoreHorizontal
          const colors = categoryColors[s.category] || categoryColors['أخرى']
          return (
            <div key={s.category} className="glass-card stat-card" style={{ cursor: 'pointer', border: filter === s.category ? `1px solid ${colors.color}` : undefined }} onClick={() => setFilter(filter === s.category ? '' : s.category)}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.bg, color: colors.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={20} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{s.total.toLocaleString()}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.category} ({s.count})</p>
            </div>
          )
        })}
      </div>

      {/* Date filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ maxWidth: 180 }} />
        <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ maxWidth: 180 }} />
        {(dateFrom || dateTo) && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setDateFrom(''); setDateTo('') }}>مسح الفلتر</button>
        )}
      </div>

      {/* Expenses Table */}
      {expenses.length === 0 ? (
        <div className="glass-card"><div className="empty-state"><p>لا توجد مصروفات</p></div></div>
      ) : (
        <>
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} محدد</span>
            <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleBulkDelete}>
              <Trash2 size={14} /> حذف المحدد
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setSelectedIds(new Set())}>إلغاء التحديد</button>
          </div>
        )}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={expenses.length > 0 && selectedIds.size === expenses.length} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                </th>
                <th>التاريخ</th>
                <th>التصنيف</th>
                <th>البيان</th>
                <th>المبلغ</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/transactions/${t.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={(e) => toggleSelect(t.id, e)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  </td>
                  <td>{t.date}</td>
                  <td>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 8, background: (categoryColors[t.expense_category || ''] || categoryColors['أخرى']).bg, color: (categoryColors[t.expense_category || ''] || categoryColors['أخرى']).color }}>
                      {t.expense_category || 'أخرى'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{t.items?.map(i => i.name).join('، ') || t.notes || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{t.total_amount.toLocaleString()} ج.م</td>
                  <td>
                    <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }} onClick={(e) => handleDelete(t.id, e)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
