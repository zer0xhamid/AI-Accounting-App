import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, TrendingUp, TrendingDown, Wallet, FileText, Search, FileDown, Users, Banknote, Truck } from 'lucide-react'
import type { Person, Transaction, ReceivableSummary, PayableSummary, ExpenseSummary } from '../../shared/types'
import { useAppStore } from '../store/appStore'

type Tab = 'income' | 'balance' | 'account' | 'receivables' | 'payables' | 'expenses'

interface IncomeData {
  revenue: number; sales: number; other_income: number
  cogs: number; gross_profit: number; expenses: number
  expense_breakdown: { category: string; total: number }[]
  net_profit: number
}

interface BalanceData {
  assets: { cash: number; receivables: number; inventory: number; total: number }
  liabilities: { payables: number; total: number }
  equity: number
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const [tab, setTab] = useState<Tab>('income')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [income, setIncome] = useState<IncomeData | null>(null)
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null)
  const [personTxns, setPersonTxns] = useState<Transaction[]>([])
  const [personSearch, setPersonSearch] = useState('')
  const [receivables, setReceivables] = useState<ReceivableSummary[]>([])
  const [payables, setPayables] = useState<PayableSummary[]>([])
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary[]>([])
  const [expDateFrom, setExpDateFrom] = useState('')
  const [expDateTo, setExpDateTo] = useState('')

  const loadIncome = async () => {
    const data = await window.api.reports.incomeStatement(dateFrom || undefined, dateTo || undefined) as IncomeData
    setIncome(data)
  }

  const loadBalance = async () => {
    const data = await window.api.reports.balanceSheet() as BalanceData
    setBalance(data)
  }

  const loadPersons = async () => {
    const all = await window.api.persons.list() as Person[]
    setPersons(all)
  }

  const loadAccountStatement = async (personId: number) => {
    setSelectedPersonId(personId)
    const txns = await window.api.reports.accountStatement(personId) as Transaction[]
    setPersonTxns(txns)
  }

  const loadReceivables = async () => {
    const data = await window.api.reports.receivablesSummary() as ReceivableSummary[]
    setReceivables(data)
  }

  const loadPayables = async () => {
    const data = await window.api.reports.payablesSummary() as PayableSummary[]
    setPayables(data)
  }

  const loadExpenses = async () => {
    const data = await window.api.reports.expensesSummary(expDateFrom || undefined, expDateTo || undefined) as ExpenseSummary[]
    setExpenseSummary(data)
  }

  useEffect(() => {
    if (tab === 'income') loadIncome()
    else if (tab === 'balance') loadBalance()
    else if (tab === 'account') loadPersons()
    else if (tab === 'receivables') loadReceivables()
    else if (tab === 'payables') loadPayables()
    else if (tab === 'expenses') loadExpenses()
  }, [tab])

  useEffect(() => { if (tab === 'expenses') loadExpenses() }, [expDateFrom, expDateTo])

  useEffect(() => { if (tab === 'income') loadIncome() }, [dateFrom, dateTo])

  const handleExportPDF = async (pdfType: string, pdfData: unknown) => {
    try {
      const result = await window.api.pdf.generate(pdfType, pdfData) as { success: boolean; error?: string }
      if (result.success) {
        addToast('تم حفظ الـ PDF بنجاح', 'success')
      } else if (result.error !== 'تم الإلغاء') {
        addToast(result.error || 'فشل في إنشاء PDF', 'error')
      }
    } catch {
      addToast('خطأ في إنشاء PDF', 'error')
    }
  }

  const tabs = [
    { key: 'income' as Tab, label: 'قائمة الدخل', icon: TrendingUp },
    { key: 'balance' as Tab, label: 'الميزانية العمومية', icon: Wallet },
    { key: 'receivables' as Tab, label: 'المستحقات', icon: Users },
    { key: 'payables' as Tab, label: 'الموردين', icon: Truck },
    { key: 'expenses' as Tab, label: 'المصروفات', icon: Banknote },
    { key: 'account' as Tab, label: 'كشف حساب', icon: FileText },
  ]

  const filteredPersons = personSearch
    ? persons.filter((p) => p.name.includes(personSearch))
    : persons

  const selectedPerson = persons.find((p) => p.id === selectedPersonId)

  let runningBalance = 0
  const accountRows = personTxns.map((t) => {
    let debit = 0, credit = 0
    if (t.type === 'بيع') debit = t.remaining_amount
    else if (t.type === 'شراء') credit = t.remaining_amount
    else if (t.type === 'تحصيل') credit = t.total_amount
    else if (t.type === 'دفعة') debit = t.total_amount
    runningBalance += debit - credit
    return { ...t, debit, credit, runningBalance }
  })

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2 className="page-title">التقارير</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: 13 }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Income Statement */}
      {tab === 'income' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>من</label>
              <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>إلى</label>
              <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {(dateFrom || dateTo) && (
              <button className="btn btn-ghost" onClick={() => { setDateFrom(''); setDateTo('') }}>إزالة الفلتر</button>
            )}
            {income && (
              <button className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => handleExportPDF('income', income)}>
                <FileDown size={14} /> تصدير PDF
              </button>
            )}
          </div>

          {income && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="glass-card">
                <h3 style={sectionTitle}>الإيرادات</h3>
                <div style={reportRow}>
                  <span>إيرادات المبيعات</span>
                  <span style={{ fontWeight: 700 }}>{income.sales.toLocaleString()} ج.م</span>
                </div>
                {income.other_income > 0 && (
                  <div style={reportRow}>
                    <span>إيرادات أخرى</span>
                    <span style={{ fontWeight: 700 }}>{income.other_income.toLocaleString()} ج.م</span>
                  </div>
                )}
                <div style={{ ...reportRow, ...totalRow }}>
                  <span>إجمالي الإيرادات</span>
                  <span>{income.revenue.toLocaleString()} ج.م</span>
                </div>
              </div>

              <div className="glass-card">
                <h3 style={sectionTitle}>التكاليف والمصروفات</h3>
                <div style={reportRow}>
                  <span>تكلفة البضاعة المباعة</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{income.cogs.toLocaleString()} ج.م</span>
                </div>
                <div style={{ ...reportRow, borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>مجمل الربح</span>
                  <span style={{ fontWeight: 700, color: income.gross_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {income.gross_profit.toLocaleString()} ج.م
                  </span>
                </div>
                {income.expense_breakdown.map((exp, i) => (
                  <div key={i} style={reportRow}>
                    <span style={{ color: 'var(--text-secondary)' }}>{exp.category || 'مصروفات أخرى'}</span>
                    <span>{exp.total.toLocaleString()} ج.م</span>
                  </div>
                ))}
                {income.expenses > 0 && (
                  <div style={{ ...reportRow, ...totalRow }}>
                    <span>إجمالي المصروفات</span>
                    <span>{income.expenses.toLocaleString()} ج.م</span>
                  </div>
                )}
              </div>

              <div className="glass-card" style={{
                borderColor: income.net_profit >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {income.net_profit >= 0 ? <TrendingUp size={24} style={{ color: 'var(--success)' }} /> : <TrendingDown size={24} style={{ color: 'var(--danger)' }} />}
                    <span style={{ fontSize: 18, fontWeight: 700 }}>صافي {income.net_profit >= 0 ? 'الربح' : 'الخسارة'}</span>
                  </div>
                  <span style={{
                    fontSize: 28, fontWeight: 800,
                    color: income.net_profit >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {Math.abs(income.net_profit).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balance Sheet */}
      {tab === 'balance' && balance && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-ghost" onClick={() => handleExportPDF('balance', balance)}>
              <FileDown size={14} /> تصدير PDF
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="glass-card">
            <h3 style={sectionTitle}>الأصول</h3>
            <div style={reportRow}>
              <span>الصندوق (كاش)</span>
              <span style={{ fontWeight: 700 }}>{balance.assets.cash.toLocaleString()} ج.م</span>
            </div>
            <div style={reportRow}>
              <span>المدينون (العملاء)</span>
              <span style={{ fontWeight: 700 }}>{balance.assets.receivables.toLocaleString()} ج.م</span>
            </div>
            <div style={reportRow}>
              <span>المخزون</span>
              <span style={{ fontWeight: 700 }}>{balance.assets.inventory.toLocaleString()} ج.م</span>
            </div>
            <div style={{ ...reportRow, ...totalRow }}>
              <span>إجمالي الأصول</span>
              <span>{balance.assets.total.toLocaleString()} ج.م</span>
            </div>
          </div>

          <div>
            <div className="glass-card" style={{ marginBottom: 20 }}>
              <h3 style={sectionTitle}>الالتزامات</h3>
              <div style={reportRow}>
                <span>الدائنون (الموردين)</span>
                <span style={{ fontWeight: 700 }}>{balance.liabilities.payables.toLocaleString()} ج.م</span>
              </div>
              <div style={{ ...reportRow, ...totalRow }}>
                <span>إجمالي الالتزامات</span>
                <span>{balance.liabilities.total.toLocaleString()} ج.م</span>
              </div>
            </div>

            <div className="glass-card" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
              <h3 style={sectionTitle}>حقوق الملكية</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>صافي حقوق الملكية</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
                  {balance.equity.toLocaleString()} ج.م
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Receivables Summary */}
      {tab === 'receivables' && (
        <div>
          {(() => {
            const totalRevenue = receivables.reduce((s, r) => s + r.total_revenue, 0)
            const totalCollected = receivables.reduce((s, r) => s + r.total_collected, 0)
            const totalOutstanding = receivables.reduce((s, r) => s + r.outstanding, 0)
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي الإيرادات</p>
                  <p style={{ fontSize: 24, fontWeight: 700 }}>{totalRevenue.toLocaleString()} ج.م</p>
                </div>
                <div className="glass-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي المحصل</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{totalCollected.toLocaleString()} ج.م</p>
                </div>
                <div className="glass-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي المستحقات</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{totalOutstanding.toLocaleString()} ج.م</p>
                </div>
              </div>
            )
          })()}

          {receivables.length === 0 ? (
            <div className="glass-card"><div className="empty-state"><p>لا توجد مستحقات</p></div></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>الشركة / العميل</th>
                    <th>إجمالي الإيرادات</th>
                    <th>المحصل</th>
                    <th>المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((r) => (
                    <tr key={r.person_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/persons/${r.person_id}`)}>
                      <td style={{ fontWeight: 600 }}>{r.person_name}</td>
                      <td>{r.total_revenue.toLocaleString()} ج.م</td>
                      <td style={{ color: 'var(--success)' }}>{r.total_collected.toLocaleString()} ج.م</td>
                      <td style={{ fontWeight: 700, color: r.outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        {r.outstanding.toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payables Summary */}
      {tab === 'payables' && (
        <div>
          {(() => {
            const totalPurchases = payables.reduce((s, r) => s + r.total_purchases, 0)
            const totalPaid = payables.reduce((s, r) => s + r.total_paid, 0)
            const totalOutstanding = payables.reduce((s, r) => s + r.outstanding, 0)
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي المشتريات</p>
                  <p style={{ fontSize: 24, fontWeight: 700 }}>{totalPurchases.toLocaleString()} ج.م</p>
                </div>
                <div className="glass-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي المدفوع</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{totalPaid.toLocaleString()} ج.م</p>
                </div>
                <div className="glass-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي المتبقي عليك</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{totalOutstanding.toLocaleString()} ج.م</p>
                </div>
              </div>
            )
          })()}

          {payables.length === 0 ? (
            <div className="glass-card"><div className="empty-state"><p>لا توجد مستحقات للموردين</p></div></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>المورد</th>
                    <th>إجمالي المشتريات</th>
                    <th>المدفوع</th>
                    <th>المتبقي عليك</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((r) => (
                    <tr key={r.person_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/persons/${r.person_id}`)}>
                      <td style={{ fontWeight: 600 }}>{r.person_name}</td>
                      <td>{r.total_purchases.toLocaleString()} ج.م</td>
                      <td style={{ color: 'var(--success)' }}>{r.total_paid.toLocaleString()} ج.م</td>
                      <td style={{ fontWeight: 700, color: r.outstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {r.outstanding.toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Expenses Summary */}
      {tab === 'expenses' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>من</label>
              <input className="input" type="date" value={expDateFrom} onChange={(e) => setExpDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>إلى</label>
              <input className="input" type="date" value={expDateTo} onChange={(e) => setExpDateTo(e.target.value)} />
            </div>
            {(expDateFrom || expDateTo) && (
              <button className="btn btn-ghost" onClick={() => { setExpDateFrom(''); setExpDateTo('') }}>إزالة الفلتر</button>
            )}
          </div>

          {(() => {
            const totalExp = expenseSummary.reduce((s, e) => s + e.total, 0)
            return (
              <div className="glass-card" style={{ padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>إجمالي المصروفات</span>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>{totalExp.toLocaleString()} ج.م</span>
                </div>
              </div>
            )
          })()}

          {expenseSummary.length === 0 ? (
            <div className="glass-card"><div className="empty-state"><p>لا توجد مصروفات</p></div></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>التصنيف</th>
                    <th>عدد العمليات</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseSummary.map((e) => (
                    <tr key={e.category}>
                      <td style={{ fontWeight: 600 }}>{e.category}</td>
                      <td>{e.count}</td>
                      <td style={{ fontWeight: 700 }}>{e.total.toLocaleString()} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Account Statement */}
      {tab === 'account' && (
        <div>
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Person List */}
            <div style={{ width: 280, flexShrink: 0 }}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  style={{ paddingRight: 36 }}
                  placeholder="بحث..."
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
                {filteredPersons.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => loadAccountStatement(p.id)}
                    style={{
                      padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                      background: selectedPersonId === p.id ? 'var(--bg-active)' : 'transparent',
                      border: '1px solid', borderColor: selectedPersonId === p.id ? 'var(--accent)' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</p>
                    <p style={{
                      fontSize: 12,
                      color: p.balance > 0 ? 'var(--success)' : p.balance < 0 ? 'var(--danger)' : 'var(--text-muted)',
                    }}>
                      {p.balance > 0 ? `ليه ${p.balance.toLocaleString()}` : p.balance < 0 ? `عليه ${Math.abs(p.balance).toLocaleString()}` : 'لا رصيد'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Statement */}
            <div style={{ flex: 1 }}>
              {!selectedPersonId ? (
                <div className="glass-card">
                  <div className="empty-state">
                    <FileText size={48} style={{ opacity: 0.4 }} />
                    <p>اختر عميل أو مورد لعرض كشف الحساب</p>
                  </div>
                </div>
              ) : (
                <div>
                  {selectedPerson && (
                    <div className="glass-card" style={{ marginBottom: 16, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{selectedPerson.name}</h3>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {selectedPerson.type === 'client' ? 'عميل' : selectedPerson.type === 'supplier' ? 'مورد' : 'عميل ومورد'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{
                              fontSize: 22, fontWeight: 700,
                              color: selectedPerson.balance > 0 ? 'var(--success)' : selectedPerson.balance < 0 ? 'var(--danger)' : 'var(--text-muted)',
                            }}>
                              {Math.abs(selectedPerson.balance).toLocaleString()} ج.م
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {selectedPerson.balance > 0 ? 'ليك عنده' : selectedPerson.balance < 0 ? 'عليك ليه' : 'لا رصيد'}
                            </p>
                          </div>
                          {accountRows.length > 0 && (
                            <button className="btn btn-ghost" onClick={() => handleExportPDF('account', {
                              person: selectedPerson,
                              rows: accountRows.map((r) => ({
                                date: r.date,
                                type: r.type,
                                description: r.items?.map((i: { name: string }) => i.name).join('، ') || r.notes || '-',
                                debit: r.debit,
                                credit: r.credit,
                                runningBalance: r.runningBalance,
                              })),
                            })}>
                              <FileDown size={14} /> PDF
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {accountRows.length === 0 ? (
                    <div className="glass-card"><div className="empty-state"><p>لا توجد عمليات</p></div></div>
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
                            <th>الرصيد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountRows.map((r) => (
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }
const reportRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 14 }
const totalRow: React.CSSProperties = { borderTop: '2px solid var(--border-glass)', marginTop: 8, paddingTop: 12, fontSize: 16, fontWeight: 700, color: 'var(--accent)' }
