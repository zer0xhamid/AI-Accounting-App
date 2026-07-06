import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Trash2, Pencil, X, Check, Users, Truck, Wrench, Plus } from 'lucide-react'
import type { Person } from '../../shared/types'
import { useAppStore } from '../store/appStore'

type PersonTab = 'all' | 'client' | 'supplier' | 'contractor'

const personTypeLabel: Record<string, string> = {
  client: 'عميل',
  supplier: 'مورد',
  both: 'عميل ومورد',
  contractor: 'ورشة/صنايعي',
}

const personTypeBadge: Record<string, { bg: string; color: string }> = {
  client: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
  supplier: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  both: { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' },
  contractor: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
}

export default function PersonsPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const [persons, setPersons] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<PersonTab>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', type: '', phone: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', type: 'client', phone: '', notes: '' })
  const [isAdding, setIsAdding] = useState(false)

  const loadData = async () => {
    const all = await window.api.persons.list() as Person[]
    setPersons(all)
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`هل أنت متأكد من حذف "${name}" وكل عملياته؟`)) return
    await window.api.persons.delete(id)
    addToast(`تم حذف ${name}`, 'info')
    loadData()
  }

  const handleEditStart = (p: Person, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(p.id)
    setEditForm({ name: p.name, type: p.type, phone: p.phone || '' })
  }

  const handleEditSave = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editForm.name.trim()) return
    await window.api.persons.update(id, {
      name: editForm.name.trim(),
      type: editForm.type,
      phone: editForm.phone || null,
    })
    addToast('تم تعديل البيانات', 'success')
    setEditingId(null)
    loadData()
  }

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
  }

  const handleAdd = async () => {
    if (!addForm.name.trim()) return
    setIsAdding(true)
    try {
      await window.api.persons.create({
        name: addForm.name.trim(),
        type: addForm.type,
        phone: addForm.phone || null,
        notes: addForm.notes || null,
      })
      addToast(`تم إضافة ${addForm.name}`, 'success')
      setAddForm({ name: '', type: 'client', phone: '', notes: '' })
      setShowAddForm(false)
      loadData()
    } catch {
      addToast('حدث خطأ أثناء الإضافة', 'error')
    } finally {
      setIsAdding(false)
    }
  }

  const filteredPersons = persons.filter((p) => {
    if (search && !p.name.includes(search)) return false
    if (activeTab === 'client') return p.type === 'client' || p.type === 'both'
    if (activeTab === 'supplier') return p.type === 'supplier' || p.type === 'both'
    if (activeTab === 'contractor') return p.type === 'contractor'
    return true
  })

  const clients = persons.filter(p => p.type === 'client' || p.type === 'both')
  const suppliers = persons.filter(p => p.type === 'supplier' || p.type === 'both')
  const contractors = persons.filter(p => p.type === 'contractor')
  const totalReceivables = persons.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const totalPayables = persons.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0)
  const contractorsOweYou = contractors.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const youOweContractors = contractors.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0)

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">العملاء والموردين</h2>
        <button className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }} onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={16} /> إضافة شخص
        </button>
      </div>

      {/* Add Person Form */}
      {showAddForm && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>إضافة شخص جديد</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>الاسم *</label>
              <input className="input" placeholder="اسم الشخص..." value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>النوع</label>
              <select className="select" value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}>
                <option value="client">عميل</option>
                <option value="supplier">مورد</option>
                <option value="contractor">ورشة/صنايعي</option>
                <option value="both">عميل ومورد</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>الهاتف</label>
              <input className="input" placeholder="رقم الهاتف..." value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ fontSize: 13, flex: 1 }} onClick={handleAdd} disabled={isAdding || !addForm.name.trim()}>
                {isAdding ? 'جاري الإضافة...' : 'إضافة'}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setShowAddForm(false)}>
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>عدد العملاء</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{clients.length}</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>المستحقات ليك</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{totalReceivables.toLocaleString()} ج.م</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>عدد الموردين</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{suppliers.length}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>المتبقي عليك للموردين</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{totalPayables.toLocaleString()} ج.م</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>الورش والصنايعية</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{contractors.length}</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>عليهم ليك</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{contractorsOweYou.toLocaleString()} ج.م</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>ليهم عندك</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{youOweContractors.toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
        {([
          { key: 'all' as PersonTab, label: `الكل (${persons.length})`, icon: Users },
          { key: 'client' as PersonTab, label: `العملاء (${clients.length})`, icon: Users },
          { key: 'supplier' as PersonTab, label: `الموردين (${suppliers.length})`, icon: Truck },
          { key: 'contractor' as PersonTab, label: `الورش والصنايعية (${contractors.length})`, icon: Wrench },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500,
            color: activeTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
            background: 'none', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: "'Cairo', sans-serif",
          }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingRight: 36 }}
            placeholder="بحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredPersons.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <p>لا يوجد {activeTab === 'contractor' ? 'ورش أو صنايعية' : activeTab === 'supplier' ? 'موردين' : activeTab === 'client' ? 'عملاء' : 'أشخاص'} بعد</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              اضغط "إضافة شخص" لإضافة واحد يدوياً أو سيتم إضافتهم تلقائياً عند تسجيل العمليات
            </p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>الرصيد</th>
                <th>الحالة</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredPersons.map((p) => (
                <tr key={p.id} style={{ cursor: editingId === p.id ? 'default' : 'pointer' }} onClick={() => editingId !== p.id && navigate(`/persons/${p.id}`)}>
                  <td style={{ fontWeight: 600 }}>
                    {editingId === p.id ? (
                      <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.name} onClick={(e) => e.stopPropagation()} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : p.name}
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <select className="select" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.type} onClick={(e) => e.stopPropagation()} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                        <option value="client">عميل</option>
                        <option value="supplier">مورد</option>
                        <option value="contractor">ورشة/صنايعي</option>
                        <option value="both">عميل ومورد</option>
                      </select>
                    ) : (
                      <span className="badge" style={{
                        background: personTypeBadge[p.type]?.bg || personTypeBadge.client.bg,
                        color: personTypeBadge[p.type]?.color || personTypeBadge.client.color,
                      }}>
                        {personTypeLabel[p.type] || p.type}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 15 }}>
                    {Math.abs(p.balance).toLocaleString()} ج.م
                  </td>
                  <td>
                    {p.balance > 0 ? (
                      <span style={{ color: 'var(--success)' }}>ليه عنده {p.balance.toLocaleString()}</span>
                    ) : p.balance < 0 ? (
                      <span style={{ color: 'var(--danger)' }}>عليه ليه {Math.abs(p.balance).toLocaleString()}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>لا رصيد</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {editingId === p.id ? (
                        <>
                          <button style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: 4 }} onClick={(e) => handleEditSave(p.id, e)} title="حفظ"><Check size={15} /></button>
                          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} onClick={handleEditCancel} title="إلغاء"><X size={15} /></button>
                        </>
                      ) : (
                        <>
                          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} onClick={(e) => handleEditStart(p, e)} title="تعديل"><Pencil size={15} /></button>
                          <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }} onClick={(e) => handleDelete(p.id, p.name, e)} title="حذف"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
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
