import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRight, FileDown, Trash2 } from 'lucide-react'
import type { Person, Transaction } from '../../shared/types'
import { useAppStore } from '../store/appStore'

export default function PersonDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const [person, setPerson] = useState<Person | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const p = await window.api.persons.get(parseInt(id)) as Person | null
      setPerson(p)
      const txns = await window.api.transactions.list({ person_id: parseInt(id) }) as Transaction[]
      setTransactions(txns)
    }
    load()
  }, [id])

  if (!person) return <div>جاري التحميل...</div>

  let runningBalance = 0

  const rows = [...transactions].reverse().map((t) => {
    let debit = 0
    let credit = 0

    if (t.type === 'بيع') debit = t.remaining_amount
    else if (t.type === 'شراء') credit = t.remaining_amount
    else if (t.type === 'تحصيل') credit = t.total_amount
    else if (t.type === 'دفعة') debit = t.total_amount

    runningBalance += debit - credit

    return { ...t, debit, credit, runningBalance }
  })

  const handleExportPDF = async () => {
    try {
      const result = await window.api.pdf.generate('account', {
        person,
        rows: rows.map((r) => ({
          date: r.date,
          type: r.type,
          description: r.items?.map((i: { name: string }) => i.name).join('، ') || r.notes || '-',
          debit: r.debit,
          credit: r.credit,
          runningBalance: r.runningBalance,
        })),
      }) as { success: boolean; error?: string }
      if (result.success) {
        addToast('تم حفظ الـ PDF بنجاح', 'success')
      } else if (result.error !== 'تم الإلغاء') {
        addToast(result.error || 'فشل في إنشاء PDF', 'error')
      }
    } catch {
      addToast('خطأ في إنشاء PDF', 'error')
    }
  }

  const handleDeletePerson = async () => {
    if (!person) return
    if (!confirm(`هل أنت متأكد من حذف "${person.name}" وكل عملياته؟`)) return
    await window.api.persons.delete(person.id)
    addToast(`تم حذف ${person.name}`, 'info')
    navigate('/persons')
  }

  return (
    <div className="animate-fadeIn">
      <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={() => navigate('/persons')}>
        <ArrowRight size={16} /> رجوع
      </button>

      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>{person.name}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {person.type === 'client' ? 'عميل' : person.type === 'supplier' ? 'مورد' : 'عميل ومورد'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>الرصيد</p>
              <p style={{
                fontSize: 28, fontWeight: 700,
                color: person.balance > 0 ? 'var(--success)' : person.balance < 0 ? 'var(--danger)' : 'var(--text-muted)',
              }}>
                {Math.abs(person.balance).toLocaleString()} ج.م
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {person.balance > 0 ? 'ليك عنده' : person.balance < 0 ? 'عليك ليه' : 'لا رصيد'}
              </p>
            </div>
            <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleDeletePerson}>
              <Trash2 size={14} /> حذف
            </button>
          </div>
        </div>
        {(() => {
          const totalRevenue = transactions.filter(t => t.type === 'بيع').reduce((s, t) => s + t.total_amount, 0)
          const totalCollected = transactions.filter(t => t.type === 'تحصيل').reduce((s, t) => s + t.total_amount, 0)
          const totalPurchases = transactions.filter(t => t.type === 'شراء').reduce((s, t) => s + t.total_amount, 0)
          const totalPayments = transactions.filter(t => t.type === 'دفعة').reduce((s, t) => s + t.total_amount, 0)
          const showSales = totalRevenue > 0 || totalCollected > 0
          const showPurchases = totalPurchases > 0 || totalPayments > 0
          if (!showSales && !showPurchases) return null
          return (
            <div style={{ display: 'grid', gridTemplateColumns: showSales && showPurchases ? '1fr 1fr' : '1fr', gap: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              {showSales && (
                <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>إجمالي البيع: </span><strong>{totalRevenue.toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>المحصل: </span><strong style={{ color: 'var(--success)' }}>{totalCollected.toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>المتبقي: </span><strong style={{ color: 'var(--warning)' }}>{(totalRevenue - totalCollected - transactions.filter(t => t.type === 'بيع').reduce((s, t) => s + t.paid_amount, 0)).toLocaleString()}</strong></div>
                </div>
              )}
              {showPurchases && (
                <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>إجمالي الشراء: </span><strong>{totalPurchases.toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>المدفوع: </span><strong style={{ color: 'var(--success)' }}>{totalPayments.toLocaleString()}</strong></div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>كشف الحساب</span>
        {rows.length > 0 && (
          <button className="btn btn-ghost" onClick={handleExportPDF}>
            <FileDown size={14} /> تصدير PDF
          </button>
        )}
      </h3>

      {rows.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <p>لا توجد عمليات مع {person.name}</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>العملية</th>
                <th>البيان</th>
                <th>مدين (له)</th>
                <th>دائن (عليه)</th>
                <th>الطريقة</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.type}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {r.items?.map((i) => i.name).join('، ') || r.notes || '-'}
                  </td>
                  <td style={{ color: r.debit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {r.debit > 0 ? r.debit.toLocaleString() : '-'}
                  </td>
                  <td style={{ color: r.credit > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {r.credit > 0 ? r.credit.toLocaleString() : '-'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.payment_method}</td>
                  <td style={{
                    fontWeight: 600,
                    color: r.runningBalance > 0 ? 'var(--success)' : r.runningBalance < 0 ? 'var(--danger)' : 'var(--text-muted)',
                  }}>
                    {Math.abs(r.runningBalance).toLocaleString()}
                    {r.runningBalance > 0 ? ' له' : r.runningBalance < 0 ? ' عليه' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
