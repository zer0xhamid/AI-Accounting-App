import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Wallet, Package, Trash2, Banknote, Users } from 'lucide-react'
import type { Transaction } from '../../shared/types'
import { useAppStore } from '../store/appStore'

const typeLabels: Record<string, { label: string; className: string }> = {
  'شراء': { label: 'شراء', className: 'badge-buy' },
  'بيع': { label: 'بيع', className: 'badge-sell' },
  'دفعة': { label: 'دفعة', className: 'badge-payment' },
  'تحصيل': { label: 'تحصيل', className: 'badge-collection' },
  'مصروف': { label: 'مصروف', className: 'badge-expense' },
  'إيراد': { label: 'إيراد', className: 'badge-sell' },
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState({ sales: 0, purchases: 0, expenses: 0, cash: 0, inventory: 0, receivables: 0 })

  const loadData = async () => {
    const txns = await window.api.transactions.list({ limit: 10 }) as Transaction[]
    setTransactions(txns)

    const dashStats = await window.api.reports.dashboardStats() as {
      sales: number; purchases: number; expenses: number; cash: number; inventory: number; receivables: number
    }
    setStats(dashStats)
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('هل أنت متأكد من حذف هذه العملية؟')) return
    await window.api.transactions.delete(id)
    addToast('تم حذف العملية', 'info')
    loadData()
  }

  const statCards = [
    { label: 'رصيد الصندوق', value: stats.cash, icon: Wallet, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', type: '' },
    { label: 'إجمالي المبيعات', value: stats.sales, icon: TrendingUp, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', type: 'success' },
    { label: 'إجمالي المصروفات', value: stats.expenses, icon: Banknote, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', type: 'warning' },
    { label: 'المستحقات', value: stats.receivables, icon: Users, color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', type: '' },
    { label: 'إجمالي المشتريات', value: stats.purchases, icon: TrendingDown, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', type: 'danger' },
    { label: 'قيمة المخزون', value: stats.inventory, icon: Package, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', type: '' },
  ]

  return (
    <div className="animate-fadeIn">
      <h2 className="page-title" style={{ marginBottom: 28 }}>لوحة التحكم</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {statCards.map((stat) => (
          <div key={stat.label} className={`glass-card stat-card ${stat.type}`} style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: stat.bg, color: stat.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${stat.bg}`,
              }}>
                <stat.icon size={24} />
              </div>
            </div>
            <p style={{ fontSize: 30, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.5px' }}>
              {stat.value.toLocaleString()}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{stat.label}</p>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ج.م</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>آخر العمليات</h3>
        {transactions.length === 0 ? (
          <div className="glass-card">
            <div className="empty-state">
              <p>لا توجد عمليات بعد</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                ابدأ بكتابة عملية في شريط الإدخال بالأعلى أو استخدم الإدخال اليدوي
              </p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>الطرف</th>
                  <th>المبلغ</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>الدفع</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/transactions/${t.id}`)}>
                    <td>{t.date}</td>
                    <td>
                      <span className={`badge ${typeLabels[t.type]?.className || ''}`}>
                        {typeLabels[t.type]?.label || t.type}
                      </span>
                    </td>
                    <td>{t.person_name || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{t.total_amount.toLocaleString()}</td>
                    <td>{t.paid_amount.toLocaleString()}</td>
                    <td style={{ color: t.remaining_amount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {t.remaining_amount.toLocaleString()}
                    </td>
                    <td>{t.payment_method}</td>
                    <td>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                        onClick={(e) => handleDelete(t.id, e)}
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
