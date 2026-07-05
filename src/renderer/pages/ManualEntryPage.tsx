import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TransactionForm from '../components/forms/TransactionForm'
import type { FormData } from '../components/forms/TransactionForm'
import { useAppStore } from '../store/appStore'
import type { Transaction, Person } from '../../shared/types'

export default function ManualEntryPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const addToast = useAppStore((s) => s.addToast)
  const [isLoading, setIsLoading] = useState(false)
  const [initialData, setInitialData] = useState<Partial<FormData> | undefined>(undefined)
  const [ready, setReady] = useState(!id)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const t = await window.api.transactions.get(parseInt(id)) as Transaction | null
      if (!t) {
        addToast('العملية غير موجودة', 'error')
        navigate('/transactions')
        return
      }
      let person: Person | null = null
      if (t.person_id) {
        person = await window.api.persons.get(t.person_id) as Person | null
      }
      setInitialData({
        date: t.date,
        type: t.type,
        person,
        items: t.items?.length
          ? t.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, specs: i.specs || '' }))
          : [{ name: '', quantity: 1, unit: 'قطعة', specs: '' }],
        total_amount: t.total_amount,
        paid_amount: t.paid_amount,
        payment_method: t.payment_method,
        expense_category: t.expense_category || '',
        notes: t.notes || '',
        input_method: t.input_method,
        original_text: t.original_text,
        ai_raw_response: t.ai_raw_response,
        bom_template_id: null,
      })
      setReady(true)
    }
    load()
  }, [id])

  const handleSave = async (data: FormData) => {
    setIsLoading(true)
    try {
      if (data.type === 'إضافة_مخزن') {
        const items = data.items.filter((i) => i.name.trim() && i.quantity > 0)
        if (items.length > 0) {
          await window.api.inventory.addStock(items.map((i) => ({
            name: i.name, quantity: i.quantity, unit: i.unit, specs: i.specs || null,
          })))
        }
        addToast(`تم إضافة ${items.length} صنف للمخزن`, 'success')
        navigate('/inventory')
        return
      }

      const payload = {
        date: data.date,
        type: data.type,
        person_id: data.person?.id ?? null,
        total_amount: data.total_amount,
        paid_amount: data.paid_amount,
        remaining_amount: data.total_amount - data.paid_amount,
        payment_method: data.payment_method,
        expense_category: data.type === 'مصروف' ? (data.expense_category || null) : null,
        input_method: data.input_method,
        original_text: data.original_text,
        ai_raw_response: data.ai_raw_response,
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
      }

      if (id) {
        await window.api.transactions.update(parseInt(id), payload)
        addToast('تم تعديل العملية بنجاح', 'success')
      } else {
        await window.api.transactions.create(payload)
        addToast('تم حفظ العملية بنجاح', 'success')
      }
      navigate('/transactions')
    } catch (err) {
      addToast('حدث خطأ أثناء الحفظ', 'error')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!ready) return <div>جاري التحميل...</div>

  return (
    <div className="animate-fadeIn">
      <h2 className="page-title" style={{ marginBottom: 24 }}>
        {id ? 'تعديل العملية' : 'إدخال عملية يدوي'}
      </h2>
      <TransactionForm
        key={id || 'new'}
        initialData={initialData}
        onSave={handleSave}
        onCancel={() => navigate(-1)}
        isLoading={isLoading}
      />
    </div>
  )
}
