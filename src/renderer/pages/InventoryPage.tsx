import { useState, useEffect } from 'react'
import { Package, Search, Plus, X, ArrowDown, ArrowUp, AlertTriangle, Trash2, Pencil, Check, ListTree } from 'lucide-react'
import type { InventoryItem, InventoryMovement } from '../../shared/types'
import { useAppStore } from '../store/appStore'
import BomSection from '../components/inventory/BomSection'

export default function InventoryPage() {
  const addToast = useAppStore((s) => s.addToast)
  const [activeTab, setActiveTab] = useState<'inventory' | 'bom'>('inventory')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [newItem, setNewItem] = useState({ name: '', unit: 'قطعة', specs: '', category_id: '', min_quantity: 0, notes: '' })
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const loadData = async () => {
    const all = await window.api.inventory.list() as InventoryItem[]
    setItems(all)
    const cats = await window.api.inventory.categories() as { id: number; name: string }[]
    setCategories(cats)
  }

  useEffect(() => { loadData() }, [])

  const filtered = items.filter((item) => {
    if (search && !item.name.includes(search) && !(item.specs || '').includes(search)) return false
    if (categoryFilter && String(item.category_id) !== categoryFilter) return false
    return true
  })

  const handleSelectItem = async (item: InventoryItem) => {
    setSelectedItem(item)
    const mvs = await window.api.inventory.movements(item.id) as InventoryMovement[]
    setMovements(mvs)
  }

  const handleAddItem = async () => {
    if (!newItem.name.trim()) return
    await window.api.inventory.create({
      name: newItem.name.trim(),
      unit: newItem.unit,
      specs: newItem.specs || null,
      category_id: newItem.category_id ? parseInt(newItem.category_id) : null,
      min_quantity: newItem.min_quantity,
      notes: newItem.notes || null,
    })
    addToast('تم إضافة الصنف', 'success')
    setShowAddForm(false)
    setNewItem({ name: '', unit: 'قطعة', specs: '', category_id: '', min_quantity: 0, notes: '' })
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
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((i) => i.id)))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} صنف؟`)) return
    await window.api.inventory.bulkDelete(Array.from(selectedIds))
    addToast(`تم حذف ${selectedIds.size} صنف`, 'info')
    setSelectedIds(new Set())
    loadData()
  }

  const handleDeleteItem = async (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return
    await window.api.inventory.delete(id)
    addToast(`تم حذف ${name}`, 'info')
    if (selectedItem?.id === id) setSelectedItem(null)
    loadData()
  }

  const handleEditStart = (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setNewItem({
      name: item.name,
      unit: item.unit,
      specs: item.specs || '',
      category_id: item.category_id ? String(item.category_id) : '',
      min_quantity: item.min_quantity,
      notes: item.notes || '',
    })
  }

  const handleEditSave = async () => {
    if (!editingItem || !newItem.name.trim()) return
    await window.api.inventory.update(editingItem.id, {
      name: newItem.name.trim(),
      unit: newItem.unit,
      specs: newItem.specs || null,
      category_id: newItem.category_id ? parseInt(newItem.category_id) : null,
      min_quantity: newItem.min_quantity,
      notes: newItem.notes || null,
    })
    addToast('تم تعديل الصنف', 'success')
    setEditingItem(null)
    setNewItem({ name: '', unit: 'قطعة', specs: '', category_id: '', min_quantity: 0, notes: '' })
    loadData()
  }

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0)
  const lowStockCount = items.filter((i) => i.min_quantity > 0 && i.quantity <= i.min_quantity).length

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2 className="page-title">المخزن</h2>
        {activeTab === 'inventory' && (
          <button className="btn btn-primary" onClick={() => { setEditingItem(null); setNewItem({ name: '', unit: 'قطعة', specs: '', category_id: '', min_quantity: 0, notes: '' }); setShowAddForm(true) }}>
            <Plus size={16} /> إضافة صنف
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => setActiveTab('inventory')} style={{ padding: '10px 24px', fontSize: 14, fontWeight: activeTab === 'inventory' ? 700 : 500, color: activeTab === 'inventory' ? 'var(--accent)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: activeTab === 'inventory' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Cairo', sans-serif" }}>
          <Package size={16} /> المخزن
        </button>
        <button onClick={() => setActiveTab('bom')} style={{ padding: '10px 24px', fontSize: 14, fontWeight: activeTab === 'bom' ? 700 : 500, color: activeTab === 'bom' ? 'var(--accent)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: activeTab === 'bom' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Cairo', sans-serif" }}>
          <ListTree size={16} /> وصفات المنتجات
        </button>
      </div>

      {activeTab === 'bom' && <BomSection />}

      {activeTab === 'inventory' && <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>عدد الأصناف</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{items.length}</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>إجمالي الكميات</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{totalQuantity.toLocaleString()}</p>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>أصناف منخفضة</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: lowStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {lowStockCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingRight: 36 }}
            placeholder="بحث بالاسم أو المواصفات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select"
          style={{ width: 180 }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">كل الفئات</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Items Table */}
      {filtered.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <Package size={48} style={{ opacity: 0.4 }} />
            <p>{items.length === 0 ? 'المخزن فارغ' : 'لا توجد نتائج'}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              سيتم تحديث المخزن تلقائياً عند تسجيل عمليات شراء وبيع
            </p>
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
                  <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                </th>
                <th>الصنف</th>
                <th>الفئة</th>
                <th>الكمية</th>
                <th>الوحدة</th>
                <th>المواصفات</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity
                return (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSelectItem(item)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={(e) => toggleSelect(item.id, e)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {isLow && <AlertTriangle size={14} style={{ color: 'var(--warning)', marginLeft: 6, verticalAlign: 'middle' }} />}
                      {item.name}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.category_name || '-'}</td>
                    <td style={{ fontWeight: 600, color: isLow ? 'var(--warning)' : 'var(--text-primary)' }}>
                      {item.quantity.toLocaleString()}
                    </td>
                    <td>{item.unit}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.specs || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} onClick={(e) => handleEditStart(item, e)} title="تعديل"><Pencil size={15} /></button>
                        <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }} onClick={(e) => handleDeleteItem(item.id, item.name, e)} title="حذف"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <div style={modalStyles.overlay} onClick={() => setSelectedItem(null)}>
          <div style={modalStyles.panel} className="animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{selectedItem.name}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={(e) => { handleDeleteItem(selectedItem.id, selectedItem.name, e); setSelectedItem(null) }}>
                  <Trash2 size={13} /> حذف
                </button>
                <button onClick={() => setSelectedItem(null)} style={modalStyles.closeBtn}><X size={18} /></button>
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>الكمية الحالية</p>
                <p style={{ fontSize: 22, fontWeight: 700 }}>{selectedItem.quantity.toLocaleString()} {selectedItem.unit}</p>
              </div>

              {selectedItem.specs && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>المواصفات: {selectedItem.specs}</p>
              )}

              <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>سجل الحركات</h4>
              {movements.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>لا توجد حركات</p>
              ) : (
                <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>النوع</th>
                        <th>الكمية</th>
                        <th>ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td>{m.date}</td>
                          <td>
                            {m.type === 'in' ? (
                              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ArrowDown size={14} /> وارد
                              </span>
                            ) : (
                              <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ArrowUp size={14} /> صادر
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.quantity.toLocaleString()}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {(showAddForm || editingItem) && (
        <div style={modalStyles.overlay} onClick={() => { setShowAddForm(false); setEditingItem(null) }}>
          <div style={{ ...modalStyles.panel, maxWidth: 500 }} className="animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editingItem ? 'تعديل صنف' : 'إضافة صنف جديد'}</h3>
              <button onClick={() => { setShowAddForm(false); setEditingItem(null) }} style={modalStyles.closeBtn}><X size={18} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={formLabel}>اسم الصنف</label>
                <input className="input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="مثال: خشب زان" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={formLabel}>الوحدة</label>
                  <select className="select" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                    {['لوح', 'متر', 'قطعة', 'عدد', 'كيلو', 'طن', 'متر مربع', 'متر مكعب'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={formLabel}>الفئة</label>
                  <select className="select" value={newItem.category_id} onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })}>
                    <option value="">بدون فئة</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={formLabel}>الحد الأدنى للكمية</label>
                <input className="input" type="number" value={newItem.min_quantity || ''} onChange={(e) => setNewItem({ ...newItem, min_quantity: parseFloat(e.target.value) || 0 })} placeholder="0" min="0" />
              </div>
              <div>
                <label style={formLabel}>المواصفات (اختياري)</label>
                <input className="input" value={newItem.specs} onChange={(e) => setNewItem({ ...newItem, specs: e.target.value })} placeholder="مثال: 2.4 متر" />
              </div>
              <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                {editingItem ? (
                  <button className="btn btn-primary" onClick={handleEditSave} disabled={!newItem.name.trim()}>
                    <Check size={14} /> حفظ التعديلات
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleAddItem} disabled={!newItem.name.trim()}>
                    <Plus size={14} /> إضافة
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => { setShowAddForm(false); setEditingItem(null) }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}

const formLabel: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
  },
  panel: {
    width: '100%', maxWidth: 700, maxHeight: '85vh', overflowY: 'auto',
    background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-lg)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px', borderBottom: '1px solid var(--border-color)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
  },
}
