import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, X, Check, Package, Sparkles, Loader2 } from 'lucide-react'
import type { BomTemplate, BomTemplateItem } from '../../../shared/types'
import { useAppStore } from '../../store/appStore'

interface BomItemForm {
  material_name: string
  material_unit: string
  quantity: number
  notes: string
}

export default function BomSection() {
  const addToast = useAppStore((s) => s.addToast)
  const [templates, setTemplates] = useState<BomTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<BomItemForm[]>([{ material_name: '', material_unit: 'لوح', quantity: 1, notes: '' }])
  const [showAiInput, setShowAiInput] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const loadTemplates = async () => {
    const list = await window.api.bom.list() as BomTemplate[]
    setTemplates(list)
  }

  useEffect(() => { loadTemplates() }, [])

  const resetForm = () => {
    setName('')
    setNotes('')
    setItems([{ material_name: '', material_unit: 'لوح', quantity: 1, notes: '' }])
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = async (id: number) => {
    const tmpl = await window.api.bom.get(id) as BomTemplate
    setEditingId(id)
    setName(tmpl.name)
    setNotes(tmpl.notes || '')
    setItems(tmpl.items?.length ? tmpl.items.map((i) => ({
      material_name: i.material_name,
      material_unit: i.material_unit,
      quantity: i.quantity,
      notes: i.notes || '',
    })) : [{ material_name: '', material_unit: 'لوح', quantity: 1, notes: '' }])
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const validItems = items.filter((i) => i.material_name.trim())
    if (validItems.length === 0) {
      addToast('أضف مادة خام واحدة على الأقل', 'error')
      return
    }

    const data = {
      name: name.trim(),
      notes: notes.trim() || null,
      items: validItems.map((i) => ({
        material_name: i.material_name.trim(),
        material_unit: i.material_unit,
        quantity: i.quantity,
        notes: i.notes.trim() || null,
      })),
    }

    if (editingId) {
      await window.api.bom.update(editingId, data)
      addToast('تم تعديل الوصفة', 'success')
    } else {
      await window.api.bom.create(data)
      addToast('تم إنشاء الوصفة', 'success')
    }
    resetForm()
    loadTemplates()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('حذف هذه الوصفة؟')) return
    await window.api.bom.delete(id)
    addToast('تم حذف الوصفة', 'info')
    loadTemplates()
  }

  const updateItem = (index: number, field: keyof BomItemForm, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const result = await window.api.ai.generateBom(aiPrompt.trim()) as {
        success: boolean
        data?: { name: string; notes: string; items: { material_name: string; material_unit: string; quantity: number; notes: string | null }[] }
        error?: string
      }
      if (result.success && result.data) {
        setName(result.data.name)
        setNotes(result.data.notes || '')
        setItems(result.data.items.map(i => ({
          material_name: i.material_name,
          material_unit: i.material_unit,
          quantity: i.quantity,
          notes: i.notes || '',
        })))
        setShowAiInput(false)
        setAiPrompt('')
        setShowForm(true)
        addToast('تم إنشاء الوصفة — راجعها وعدّل لو محتاج', 'success')
      } else {
        addToast(result.error || 'فشل إنشاء الوصفة', 'error')
      }
    } catch {
      addToast('خطأ في الاتصال بالـ AI', 'error')
    }
    setAiLoading(false)
  }

  const units = ['لوح', 'متر', 'قطعة', 'عدد', 'كيلو', 'متر مربع', 'متر مكعب']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          وصفات المنتجات — اربط المنتج بالمواد الخام اللي بيستهلكها. عند البيع، الكميات تتخصم تلقائياً.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setShowAiInput(!showAiInput); setAiPrompt('') }} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            <Sparkles size={16} /> وصفة بالذكاء الاصطناعي
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus size={16} /> وصفة جديدة
          </button>
        </div>
      </div>

      {showAiInput && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Sparkles size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="اوصف المنتج... مثال: باب 80 سم، مطبخ 4 متر، دولاب غرفة نوم..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleAiGenerate()}
            disabled={aiLoading}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={handleAiGenerate}
            disabled={!aiPrompt.trim() || aiLoading}
            style={{ flexShrink: 0 }}
          >
            {aiLoading ? <><Loader2 size={14} className="spin" /> جاري التحليل...</> : 'إنشاء'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setShowAiInput(false); setAiPrompt('') }}
            style={{ flexShrink: 0, padding: '8px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {templates.length === 0 && !showForm ? (
        <div className="glass-card">
          <div className="empty-state">
            <Package size={48} style={{ opacity: 0.4 }} />
            <p>لا توجد وصفات</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              أنشئ وصفة لربط المنتج النهائي بالمواد الخام المستخدمة
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700 }}>{tmpl.name}</h4>
                  {tmpl.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{tmpl.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} onClick={() => handleEdit(tmpl.id)}><Pencil size={14} /></button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }} onClick={() => handleDelete(tmpl.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {tmpl.items && tmpl.items.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>المكونات:</p>
                  {tmpl.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: i < tmpl.items!.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                      <span>{item.material_name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{item.quantity} {item.material_unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BOM Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-lg)' }} className="animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editingId ? 'تعديل وصفة' : 'وصفة جديدة'}</h3>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>اسم المنتج</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مطبخ 3 متر، باب غرفة..." />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>ملاحظات (اختياري)</label>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي ملاحظات..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>المواد الخام</label>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setItems([...items, { material_name: '', material_unit: 'لوح', quantity: 1, notes: '' }])}>
                  <Plus size={12} /> إضافة مادة
                </button>
              </div>

              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input className="input" style={{ flex: 2 }} placeholder="اسم المادة" value={item.material_name} onChange={(e) => updateItem(i, 'material_name', e.target.value)} />
                  <input className="input" style={{ flex: 0.7 }} type="number" placeholder="الكمية" value={item.quantity || ''} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} min="0" step="0.1" />
                  <select className="select" style={{ flex: 0.8 }} value={item.material_unit} onChange={(e) => updateItem(i, 'material_unit', e.target.value)}>
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {items.length > 1 && (
                    <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, flexShrink: 0 }} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border-color)', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
                  <Check size={14} /> {editingId ? 'حفظ التعديلات' : 'إنشاء الوصفة'}
                </button>
                <button className="btn btn-ghost" onClick={resetForm}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
