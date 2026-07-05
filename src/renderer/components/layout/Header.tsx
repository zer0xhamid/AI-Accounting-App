import { useState, useRef } from 'react'
import { Mic, Camera, PenLine, Sparkles, Loader2, Send, MicOff, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AIReviewPanel from '../ai/AIReviewPanel'
import { useAppStore } from '../../store/appStore'

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

export default function Header() {
  const navigate = useNavigate()
  const addToast = useAppStore((s) => s.addToast)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiResults, setAiResults] = useState<AIResult[] | null>(null)
  const [originalText, setOriginalText] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  const handleSubmit = async () => {
    const text = inputText.trim()
    if (!text || isProcessing) return

    setIsProcessing(true)
    try {
      const result = await window.api.ai.parseText(text) as {
        success: boolean
        data?: AIResult[]
        error?: string
      }

      if (result.success && result.data?.length) {
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
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const result = await window.api.ai.parseImage(base64) as {
          success: boolean
          data?: AIResult[]
          error?: string
        }

        if (result.success && result.data?.length) {
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setIsRecording(false)

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlob.size < 1000) {
          addToast('التسجيل قصير جداً. حاول مرة أخرى.', 'error')
          return
        }

        setIsProcessing(true)
        try {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64 = reader.result as string
            const result = await window.api.ai.parseAudio(base64) as {
              success: boolean
              data?: AIResult[]
              error?: string
            }

            if (result.success && result.data?.length) {
              setOriginalText('[تسجيل صوتي]')
              setAiResults(result.data)
            } else {
              addToast(result.error || 'فشل في تحليل الصوت', 'error')
            }
            setIsProcessing(false)
          }
          reader.readAsDataURL(audioBlob)
        } catch {
          addToast('خطأ في معالجة الصوت', 'error')
          setIsProcessing(false)
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      addToast('لا يمكن الوصول للميكروفون. تأكد من السماح بالوصول.', 'error')
    }
  }

  const handleCloseReview = () => {
    setAiResults(null)
    setOriginalText('')
  }

  const handleAllSaved = () => {
    setAiResults(null)
    setOriginalText('')
    setInputText('')
    addToast('تم حفظ كل العمليات بنجاح!', 'success')
    navigate('/transactions')
  }

  return (
    <>
      <header style={styles.header}>
        <div style={styles.inputContainer}>
          <div style={{
            ...styles.smartInput,
            ...(isProcessing ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.15)' } : {}),
            ...(isRecording ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)' } : {}),
          }}>
            {isProcessing ? (
              <Loader2 size={18} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
            ) : (
              <Sparkles size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            )}
            <input
              ref={inputRef}
              type="text"
              placeholder="اكتب عملية... مثال: اشتريت خشب زان 10 لوح بـ 5000 من أحمد"
              style={styles.input}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
            />
            <div style={styles.inputActions}>
              {inputText.trim() && (
                <button
                  style={{ ...styles.iconBtn, color: 'var(--accent)' }}
                  title="إرسال"
                  onClick={handleSubmit}
                  disabled={isProcessing}
                >
                  <Send size={18} />
                </button>
              )}
              <button
                style={{ ...styles.iconBtn, color: isRecording ? 'var(--danger)' : 'var(--text-muted)' }}
                title={isRecording ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
                onClick={handleVoice}
                disabled={isProcessing}
              >
                {isRecording ? <Square size={16} /> : <Mic size={18} />}
              </button>
              <button
                style={styles.iconBtn}
                title="صورة فاتورة"
                onClick={handleImageClick}
                disabled={isProcessing}
              >
                <Camera size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />
            </div>
          </div>
        </div>

        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate('/transactions/new')}>
          <PenLine size={16} />
          إدخال يدوي
        </button>
      </header>

      {aiResults && (
        <AIReviewPanel
          results={aiResults}
          originalText={originalText}
          onClose={handleCloseReview}
          onAllSaved={handleAllSaved}
        />
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 'var(--header-height)',
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    borderBottom: '1px solid var(--border-color)',
    background: 'linear-gradient(90deg, var(--bg-secondary) 0%, rgba(99, 102, 241, 0.03) 100%)',
    flexShrink: 0,
  },
  inputContainer: {
    flex: 1,
  },
  smartInput: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    height: 46,
    background: 'var(--bg-glass)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    transition: 'all 0.2s ease',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontFamily: "'Cairo', sans-serif",
    fontSize: 14,
    outline: 'none',
  },
  inputActions: {
    display: 'flex',
    gap: 4,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
}
