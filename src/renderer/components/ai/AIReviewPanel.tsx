import { useState, useEffect, useRef } from 'react'
import { Check, X, ChevronLeft, ChevronRight, AlertCircle, Loader2, SaveAll } from 'lucide-react'
import TransactionForm from '../forms/TransactionForm'
import type { FormData } from '../forms/TransactionForm'
import type { Person } from '../../../shared/types'
import { useAppStore } from '../../store/appStore'

interface AIResult {
  type: string
  person: string | null
  date?: string | null
  items: { name: string; quantity: number; unit: string; specs: string | null }[]
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_method: string
  expense_category?: string | null
  notes: string | null
}

interface Props {
  results: AIResult[]
  originalText: string
  onClose: () => void
  onAllSaved: () => void
  imageData?: string | null
}

export default function AIReviewPanel({ results, originalText, onClose, onAllSaved, imageData }: Props) {
  const addToast = useAppStore((s) => s.addToast)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const resolvedPersonsRef = useRef<Record<string, Person | null>>({})
  const [, forceUpdate] = useState(0)

  const current = results[currentIndex]
  if (!current) return null

  const resolvePerson = async (name: string | null, txnType: string): Promise<Person | null> => {
    if (!name) return null

    if (resolvedPersonsRef.current[name] !== undefined) return resolvedPersonsRef.current[name]

    const searchResults = await window.api.persons.search(name) as Person[]
    const exact = searchResults.find((p) =>
      p.name === name || p.name.includes(name) || name.includes(p.name)
    )

    if (exact) {
      resolvedPersonsRef.current[name] = exact
      return exact
    }

    const personType = (txnType === 'بيع' || txnType === 'تحصيل') ? 'client'
      : (txnType === 'شراء' || txnType === 'دفعة') ? 'supplier'
      : txnType === 'مصروف' ? 'contractor'
      : 'both'

    const id = await window.api.persons.create({
      name,
      type: personType,
      phone: null,
      notes: null,
    }) as number

    const newPerson: Person = {
      id, name, type: personType, phone: null, notes: null,
      balance: 0, created_at: '', updated_at: '',
    }
    resolvedPersonsRef.current[name] = newPerson
    return newPerson
  }

  const buildInitialData = (): Partial<FormData> => {
    const resolvedPerson = current.person ? resolvedPersonsRef.current[current.person] ?? null : null
    return {
      date: current.date || new Date().toISOString().split('T')[0],
      type: current.type,
      person: resolvedPerson,
      items: current.items.length > 0
        ? current.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            specs: i.specs || '',
          }))
        : [{ name: '', quantity: 1, unit: 'قطعة', specs: '' }],
      total_amount: current.total_amount,
      paid_amount: current.paid_amount,
      payment_method: current.payment_method,
      expense_category: current.type === 'مصروف' ? (current.expense_category || '') : '',
      notes: current.notes || '',
      input_method: 'ai_text',
      original_text: originalText,
      ai_raw_response: JSON.stringify(current),
    }
  }

  const saveOneResult = async (result: AIResult, index: number) => {
    if (result.type === 'إضافة_مخزن') {
      const items = (result.items || []).filter((i) => i.name.trim() && i.quantity > 0)
      if (items.length > 0) {
        await window.api.inventory.addStock(items.map((i) => ({
          name: i.name, quantity: i.quantity, unit: i.unit, specs: i.specs || null,
        })))
      }
      setSavedSet((prev) => new Set(prev).add(index))
      return
    }

    const person = await resolvePerson(result.person, result.type)

    await window.api.transactions.create({
      date: result.date || new Date().toISOString().split('T')[0],
      type: result.type,
      person_id: person?.id ?? null,
      total_amount: result.total_amount,
      paid_amount: result.paid_amount,
      remaining_amount: result.total_amount - result.paid_amount,
      payment_method: result.payment_method,
      expense_category: result.type === 'مصروف' ? (result.expense_category || null) : null,
      input_method: 'ai_text',
      original_text: originalText,
      ai_raw_response: JSON.stringify(result),
      notes: result.notes || null,
      items: (result.items || [])
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          specs: i.specs || null,
          unit_price: null,
          total_price: null,
        })),
      bom_template_id: null,
      bom_selections: [],
    })

    setSavedSet((prev) => new Set(prev).add(index))
  }

  const handleSaveAll = async () => {
    if (unsavedCount > 1 && !confirm(`حفظ ${unsavedCount} عملية بدون مراجعة فردية؟`)) return
    setIsSavingAll(true)
    try {
      let count = 0
      for (let i = 0; i < results.length; i++) {
        if (savedSet.has(i)) continue
        await saveOneResult(results[i], i)
        count++
      }
      addToast(`تم حفظ ${count} عملية بنجاح!`, 'success')
      onAllSaved()
    } catch (err) {
      addToast('حدث خطأ أثناء الحفظ', 'error')
      console.error(err)
    } finally {
      setIsSavingAll(false)
    }
  }

  const handleSave = async (data: FormData) => {
    setIsSaving(true)
    try {
      if (data.type === 'إضافة_مخزن') {
        const items = data.items.filter((i) => i.name.trim() && i.quantity > 0)
        if (items.length > 0) {
          await window.api.inventory.addStock(items.map((i) => ({
            name: i.name, quantity: i.quantity, unit: i.unit, specs: i.specs || null,
          })))
        }
        setSavedSet((prev) => new Set(prev).add(currentIndex))
        addToast(`تم إضافة ${items.length} صنف للمخزن`, 'success')
        const unsavedIndex = results.findIndex((_, i) => i > currentIndex && !savedSet.has(i))
        if (unsavedIndex !== -1) navigateTo(unsavedIndex)
        else if (savedSet.size + 1 >= results.length) onAllSaved()
        setIsSaving(false)
        return
      }

      let person = data.person
      if (!person && current.person) {
        person = await resolvePerson(current.person, current.type)
      }

      await window.api.transactions.create({
        date: data.date,
        type: data.type,
        person_id: person?.id ?? null,
        total_amount: data.total_amount,
        paid_amount: data.paid_amount,
        remaining_amount: data.total_amount - data.paid_amount,
        payment_method: data.payment_method,
        expense_category: data.type === 'مصروف' ? (data.expense_category || null) : null,
        input_method: 'ai_text',
        original_text: originalText,
        ai_raw_response: JSON.stringify(current),
        notes: data.notes || null,
        items: data.items
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            specs: i.specs || null,
            unit_price: null,
            total_price: null,
          })),
        bom_template_id: data.bom_template_id || null,
        bom_selections: data.bom_selections || [],
      })

      setSavedSet((prev) => new Set(prev).add(currentIndex))
      addToast(`تم حفظ العملية ${savedSet.size + 1}/${results.length}`, 'success')

      const unsavedIndex = results.findIndex((_, i) => i > currentIndex && !savedSet.has(i))
      if (unsavedIndex !== -1) {
        navigateTo(unsavedIndex)
      } else if (savedSet.size + 1 >= results.length) {
        onAllSaved()
      } else {
        const firstUnsaved = results.findIndex((_, i) => !savedSet.has(i) && i !== currentIndex)
        if (firstUnsaved !== -1) navigateTo(firstUnsaved)
        else onAllSaved()
      }
    } catch (err) {
      addToast('حدث خطأ أثناء الحفظ', 'error')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const [personReady, setPersonReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      setPersonReady(false)
      if (current.person) {
        await resolvePerson(current.person, current.type)
      }
      setPersonReady(true)
      forceUpdate((n) => n + 1)
    }
    init()
  }, [currentIndex])

  const navigateTo = (index: number) => {
    setPersonReady(false)
    setCurrentIndex(index)
  }

  const unsavedCount = results.length - savedSet.size

  return (
    <div style={styles.overlay}>
      <div style={styles.panel} className="animate-fadeIn">
        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <AlertCircle size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600 }}>مراجعة نتيجة الذكاء الاصطناعي</span>
            {results.length > 1 && (
              <span style={styles.counter}>
                العملية {currentIndex + 1} من {results.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {results.length > 1 && (
              <button
                className="btn btn-primary"
                onClick={handleSaveAll}
                disabled={isSavingAll || isSaving || unsavedCount === 0}
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                {isSavingAll ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <SaveAll size={14} />}
                حفظ الكل ({unsavedCount})
              </button>
            )}
            <button onClick={onClose} style={styles.closeBtn}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={styles.originalText}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>النص الأصلي:</span>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>{originalText}</p>
        </div>

        {imageData && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-glass)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginBottom: 8 }}>الصورة المرفقة:</span>
            <img
              src={imageData}
              alt="صورة الفاتورة"
              style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', objectFit: 'contain' }}
            />
          </div>
        )}

        {results.length > 1 && (
          <div style={styles.navigation}>
            <button
              className="btn btn-ghost"
              onClick={() => navigateTo(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              style={{ fontSize: 12 }}
            >
              <ChevronRight size={14} /> السابقة
            </button>
            <div style={styles.dots}>
              {results.map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.dot,
                    background: savedSet.has(i) ? 'var(--success)' : i === currentIndex ? 'var(--accent)' : 'var(--border-color)',
                  }}
                />
              ))}
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => navigateTo(Math.min(results.length - 1, currentIndex + 1))}
              disabled={currentIndex >= results.length - 1}
              style={{ fontSize: 12 }}
            >
              التالية <ChevronLeft size={14} />
            </button>
          </div>
        )}

        {savedSet.has(currentIndex) && (
          <div style={{ padding: '8px 24px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-color)' }}>
            <Check size={16} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>تم حفظ هذه العملية</span>
          </div>
        )}

        <div style={styles.formArea}>
          {!personReady ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
              <p>جاري البحث عن العميل...</p>
            </div>
          ) : (
            <TransactionForm
              key={`${currentIndex}-${personReady}`}
              initialData={buildInitialData()}
              onSave={handleSave}
              onCancel={onClose}
              isLoading={isSaving || isSavingAll}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-glass)',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border-color)',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  counter: {
    fontSize: 12,
    color: 'var(--accent)',
    background: 'var(--bg-active)',
    padding: '2px 10px',
    borderRadius: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
  },
  originalText: {
    padding: '12px 24px',
    background: 'var(--bg-glass)',
    borderBottom: '1px solid var(--border-color)',
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border-color)',
  },
  dots: {
    display: 'flex',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'all 0.2s',
  },
  formArea: {
    padding: 24,
  },
}
