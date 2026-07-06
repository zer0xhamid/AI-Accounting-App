import { useState, useRef, useEffect } from 'react'
import { Mic, Camera, Sparkles, Loader2, Send, Square, Clock } from 'lucide-react'
import AIReviewPanel from '../components/ai/AIReviewPanel'
import { useAppStore } from '../store/appStore'
import { useNavigate } from 'react-router-dom'
import type { Transaction } from '../../shared/types'

interface AIResult {
  type: string
  person: string | null
  items: { name: string; quantity: number; unit: string; specs: string | null }[]
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_method: string
  notes: string | null
}

const typeLabels: Record<string, { label: string; className: string }> = {
  'شراء': { label: 'شراء', className: 'badge-buy' },
  'بيع': { label: 'بيع', className: 'badge-sell' },
  'دفعة': { label: 'دفعة', className: 'badge-payment' },
  'تحصيل': { label: 'تحصيل', className: 'badge-collection' },
  'مصروف': { label: 'مصروف', className: 'badge-expense' },
  'إيراد': { label: 'إيراد', className: 'badge-sell' },
  'إضافة_مخزن': { label: 'إضافة مخزن', className: 'badge-collection' },
  'تعديل_رصيد': { label: 'تعديل رصيد', className: 'badge-payment' },
}

export default function AIInputPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiResults, setAiResults] = useState<AIResult[] | null>(null)
  const [originalText, setOriginalText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([])
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const txns = await window.api.transactions.list({ limit: 8 }) as Transaction[]
      setRecentTxns(txns.filter((t) => t.input_method === 'ai_text'))
    }
    load()
  }, [aiResults])

  const handleSubmit = async () => {
    const text = inputText.trim()
    if (!text || isProcessing) return

    setIsProcessing(true)
    try {
      const result = await window.api.ai.parseText(text) as {
        success: boolean; data?: AIResult[]; error?: string
      }
      if (result.success && result.data?.length) {
        setCapturedImage(null)
        setOriginalText(text)
        setAiResults(result.data)
      } else {
        addToast(result.error || 'فشل في تحليل النص', 'error')
      }
    } catch {
      addToast('حدث خطأ في الاتصال بالـ AI', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleImageClick = () => fileInputRef.current?.click()

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessing(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const result = await window.api.ai.parseImage(base64) as {
          success: boolean; data?: AIResult[]; error?: string
        }
        if (result.success && result.data?.length) {
          setCapturedImage(base64)
          setOriginalText(`[صورة: ${file.name}]`)
          setAiResults(result.data)
        } else {
          addToast(result.error || 'فشل في تحليل الصورة', 'error')
        }
        setIsProcessing(false)
      }
      reader.readAsDataURL(file)
    } catch {
      addToast('خطأ في قراءة الصورة', 'error')
      setIsProcessing(false)
    }
    e.target.value = ''
  }

  const handleVoice = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setIsRecording(false)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlob.size < 1000) { addToast('التسجيل قصير جداً', 'error'); return }
        setIsProcessing(true)
        try {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64 = reader.result as string
            const result = await window.api.ai.parseAudio(base64) as {
              success: boolean; data?: AIResult[]; error?: string
            }
            if (result.success && result.data?.length) {
              setCapturedImage(null)
              setOriginalText('[تسجيل صوتي]')
              setAiResults(result.data)
            } else {
              addToast(result.error || 'فشل في تحليل الصوت', 'error')
            }
            setIsProcessing(false)
          }
          reader.readAsDataURL(audioBlob)
        } catch { addToast('خطأ في معالجة الصوت', 'error'); setIsProcessing(false) }
      }
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      addToast('لا يمكن الوصول للميكروفون', 'error')
    }
  }

  const handleCloseReview = () => { setAiResults(null); setOriginalText(''); setCapturedImage(null) }
  const handleAllSaved = () => {
    setAiResults(null); setOriginalText(''); setInputText(''); setCapturedImage(null)
    addToast('تم حفظ كل العمليات بنجاح!', 'success')
  }

  const suggestions = [
    'اشتريت من أحمد 10 لوح خشب زان بـ 5000 ودفعت 3000',
    'بعت لخالد مطبخ بـ 80 ألف آجل',
    'دفعت إيجار المحل 5000',
    'خالد دفعلي 20 ألف',
    'ضيف في المخزن 10 لوح خشب و 5 لوح أبلكاش',
  ]

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2 className="page-title">
          <Sparkles size={28} style={{ color: 'var(--accent)', marginLeft: 12, verticalAlign: 'middle' }} />
          الإدخال الذكي
        </h2>
      </div>

      <div style={{ maxWidth: 800 }}>
        <div className="glass-card" style={{ padding: 28 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            اكتب العملية بالعربي وخلي الذكاء الاصطناعي يحللها، أو استخدم الصوت أو صورة الفاتورة
          </p>

          <div style={{
            position: 'relative',
            border: isRecording ? '2px solid var(--danger)' : isProcessing ? '2px solid var(--accent)' : '2px solid var(--border-glass)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-glass)',
            transition: 'all 0.3s ease',
            ...(isRecording ? { boxShadow: '0 0 20px var(--danger-glow)' } : {}),
            ...(isProcessing ? { boxShadow: '0 0 20px var(--accent-glow)' } : {}),
          }}>
            <textarea
              ref={inputRef}
              placeholder="اكتب العملية هنا...&#10;مثال: اشتريت من أحمد 10 لوح خشب زان بـ 5000 ودفعت 3000"
              style={{
                width: '100%', minHeight: 120, padding: 20,
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontFamily: "'Cairo', sans-serif", fontSize: 16, outline: 'none',
                resize: 'vertical', lineHeight: 1.8,
              }}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderTop: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={isRecording ? 'btn btn-danger' : 'btn btn-ghost'}
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={handleVoice}
                  disabled={isProcessing}
                >
                  {isRecording ? <><Square size={14} /> إيقاف</> : <><Mic size={16} /> تسجيل صوتي</>}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={handleImageClick}
                  disabled={isProcessing}
                >
                  <Camera size={16} /> صورة فاتورة
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isProcessing || !inputText.trim()}
                style={{ padding: '8px 24px', fontSize: 14 }}
              >
                {isProcessing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                {isProcessing ? 'جاري التحليل...' : 'تحليل وحفظ'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>أمثلة سريعة:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => setInputText(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {recentTxns.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: 'var(--text-muted)' }} />
              آخر العمليات بالذكاء الاصطناعي
            </h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>النوع</th>
                    <th>الطرف</th>
                    <th>المبلغ</th>
                    <th>الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxns.map((t) => (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/transactions/${t.id}`)}>
                      <td>{t.date}</td>
                      <td>
                        <span className={`badge ${typeLabels[t.type]?.className || ''}`}>
                          {typeLabels[t.type]?.label || t.type}
                        </span>
                      </td>
                      <td>{t.person_name || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{t.total_amount.toLocaleString()}</td>
                      <td>{t.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {aiResults && (
        <AIReviewPanel
          results={aiResults}
          originalText={originalText}
          onClose={handleCloseReview}
          onAllSaved={handleAllSaved}
          imageData={capturedImage}
        />
      )}
    </div>
  )
}
