import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Search, Printer } from 'lucide-react'
import type { Transaction } from '../../shared/types'
import { useAppStore } from '../store/appStore'

const typeLabels: Record<string, { label: string; className: string }> = {
  'شراء': { label: 'شراء', className: 'badge-buy' },
  'بيع': { label: 'بيع', className: 'badge-sell' },
  'دفعة': { label: 'دفعة', className: 'badge-payment' },
  'تحصيل': { label: 'تحصيل', className: 'badge-collection' },
  'مصروف': { label: 'مصروف', className: 'badge-expense' },
  'إيراد': { label: 'إيراد', className: 'badge-sell' },
  'تعديل_رصيد': { label: 'تعديل رصيد', className: 'badge-payment' },
}

export default function TransactionsPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const loadData = async () => {
    const filters: Record<string, unknown> = {}
    if (search) filters.search = search
    if (typeFilter) filters.type = typeFilter
    const txns = await window.api.transactions.list(filters) as Transaction[]
    setTransactions(txns)
  }

  useEffect(() => { loadData() }, [search, typeFilter])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('هل أنت متأكد من حذف هذه العملية؟')) return
    await window.api.transactions.delete(id)
    addToast('تم حذف العملية', 'info')
    loadData()
  }

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
    if (selectedIds.size === transactions.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(transactions.map((t) => t.id)))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} عملية؟`)) return
    await window.api.transactions.bulkDelete(Array.from(selectedIds))
    addToast(`تم حذف ${selectedIds.size} عملية`, 'info')
    setSelectedIds(new Set())
    loadData()
  }

  const handlePrint = async (t: Transaction, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const items = (t.items && t.items.length > 0)
        ? t.items.map((i) => {
            const itemTotal = i.total_price || (i.unit_price ? i.unit_price * i.quantity : null)
            return {
              name: i.name,
              count: i.quantity,
              pieces: i.quantity,
              unit_price: i.unit_price || (itemTotal ? itemTotal / Math.max(1, i.quantity) : null),
              total: itemTotal || 0,
            }
          })
        : [{ name: t.notes || t.type, count: 1, pieces: 1, unit_price: t.total_amount, total: t.total_amount }]

      const result = await window.api.pdf.generate('receipt', {
        date: t.date,
        txn_type: t.type,
        person_name: t.person_name || '',
        company: '',
        location: '',
        items,
        grand_total: t.total_amount,
      }) as { success: boolean; error?: string }
      if (result.success) addToast('تم حفظ الـ PDF', 'success')
      else if (result.error !== 'تم الإلغاء') addToast(result.error || 'فشل', 'error')
    } catch {
      addToast('خطأ في إنشاء PDF', 'error')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2 className="page-title">العمليات</h2>
        <button className="btn btn-primary" onClick={() => navigate('/transactions/new')}>
          <Plus size={16} /> عملية جديدة
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingRight: 36 }}
            placeholder="بحث بالاسم أو الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select"
          style={{ width: 160 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">كل الأنواع</option>
          <option value="شراء">شراء</option>
          <option value="بيع">بيع</option>
          <option value="دفعة">دفعة</option>
          <option value="تحصيل">تحصيل</option>
          <option value="مصروف">مصروف</option>
          <option value="إيراد">إيراد</option>
          <option value="تعديل_رصيد">تعديل رصيد</option>
        </select>
      </div>

      {transactions.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <p>لا توجد عمليات</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/transactions/new')}>
              <Plus size={16} /> إضافة عملية
            </button>
          </div>
        </div>
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
                  <input type="checkbox" checked={transactions.length > 0 && selectedIds.size === transactions.length} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                </th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الطرف</th>
                <th>الأصناف</th>
                <th>المبلغ</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>الدفع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/transactions/${t.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={(e) => toggleSelect(t.id, e)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  </td>
                  <td>{t.date}</td>
                  <td>
                    <span className={`badge ${typeLabels[t.type]?.className || ''}`}>
                      {typeLabels[t.type]?.label || t.type}
                    </span>
                  </td>
                  <td>{t.person_name || '-'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {t.items?.map((i) => i.name).join('، ') || '-'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{t.total_amount.toLocaleString()}</td>
                  <td>{t.paid_amount.toLocaleString()}</td>
                  <td style={{ color: t.remaining_amount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {t.remaining_amount.toLocaleString()}
                  </td>
                  <td>{t.payment_method}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                          onClick={(e) => handlePrint(t, e)}
                          title="طباعة وصل"
                        >
                          <Printer size={15} />
                        </button>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                        onClick={(e) => handleDelete(t.id, e)}
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
