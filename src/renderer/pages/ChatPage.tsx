import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, User, MessageSquareText } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface Message {
  id: number
  role: 'user' | 'ai'
  text: string
}

const suggestions = [
  'ليا عند مين فلوس؟',
  'إيه أكتر صنف اتباع؟',
  'إيه رصيد الصندوق؟',
  'كام صافي الربح؟',
  'إيه اللي في المخزن؟',
  'عليا لمين فلوس؟',
]

let msgId = 0

export default function ChatPage() {
  const addToast = useAppStore((s) => s.addToast)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = { id: ++msgId, role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const result = await window.api.ai.chat(text.trim()) as { success: boolean; answer?: string; error?: string }

      if (result.success && result.answer) {
        setMessages((prev) => [...prev, { id: ++msgId, role: 'ai', text: result.answer! }])
      } else {
        setMessages((prev) => [...prev, { id: ++msgId, role: 'ai', text: result.error || 'حصل خطأ في الرد' }])
      }
    } catch {
      addToast('خطأ في الاتصال بالذكاء الاصطناعي', 'error')
      setMessages((prev) => [...prev, { id: ++msgId, role: 'ai', text: 'حصل خطأ في الاتصال. تأكد من مفتاح الـ API.' }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="animate-fadeIn" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h2 className="page-title">اسأل الذكاء الاصطناعي</h2>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <MessageSquareText size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>اسأل أي سؤال عن حساباتك</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '6px 14px' }}
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 8px' }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  display: 'flex', gap: 12,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'user' ? 'var(--bg-active)' : 'rgba(16,185,129,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {msg.role === 'user' ? <User size={16} style={{ color: 'var(--accent)' }} /> : <Sparkles size={16} style={{ color: 'var(--success)' }} />}
                  </div>
                  <div style={{
                    maxWidth: '75%', padding: '12px 16px', borderRadius: 12,
                    background: msg.role === 'user' ? 'var(--bg-active)' : 'var(--bg-glass)',
                    border: '1px solid', borderColor: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'var(--border-color)',
                    fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(16,185,129,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Loader2 size={16} style={{ color: 'var(--success)', animation: 'spin 1s linear infinite' }} />
                  </div>
                  <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
                    fontSize: 13, color: 'var(--text-muted)',
                  }}>
                    جاري التفكير...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              ref={inputRef}
              className="input"
              placeholder="اكتب سؤالك هنا..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className="btn btn-primary"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
