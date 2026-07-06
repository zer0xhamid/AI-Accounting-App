import { useState, useEffect } from 'react'
import { Settings, Key, Database, Info, Check, Loader2, Eye, EyeOff, Download, Upload, Trash2, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface BackupFile {
  name: string
  path: string
  size: number
  date: string
}

interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: { version?: string; percent?: number; message?: string }
}

export default function SettingsPage() {
  const addToast = useAppStore((s) => s.addToast)

  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [modelName, setModelName] = useState('gemini-3.1-flash-lite')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [usage, setUsage] = useState<{ count: number; limit: number }>({ count: 0, limit: 500 })
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })

  useEffect(() => {
    const load = async () => {
      const settings = await window.api.settings.getAll() as Record<string, string>
      if (settings.api_key) setApiKey(settings.api_key)
      if (settings.model_name) setModelName(settings.model_name)
      const u = await window.api.ai.dailyUsage() as { count: number; limit: number }
      setUsage(u)
      const bkps = await window.api.backup.list() as BackupFile[]
      setBackups(bkps)
    }
    load()

    const cleanup = window.api.updater.onStatus((data: unknown) => {
      const { status, info } = data as { status: string; info?: unknown }
      setUpdateStatus({ status: status as UpdateStatus['status'], info: info as UpdateStatus['info'] })
    })
    return () => { cleanup }
  }, [])

  const handleSaveKey = async () => {
    setIsSaving(true)
    try {
      await window.api.settings.set('api_key', apiKey.trim())
      addToast('تم حفظ مفتاح الـ API', 'success')
    } catch {
      addToast('خطأ في حفظ المفتاح', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestKey = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      await window.api.settings.set('api_key', apiKey.trim())
      const result = await window.api.ai.testKey(apiKey.trim()) as { success: boolean; error?: string }
      if (result.success) {
        setTestResult('success')
        addToast('المفتاح شغال!', 'success')
      } else {
        setTestResult('error')
        addToast(result.error || 'المفتاح غير صحيح', 'error')
      }
    } catch {
      setTestResult('error')
      addToast('فشل في تجربة المفتاح', 'error')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveModel = async () => {
    await window.api.settings.set('model_name', modelName)
    addToast('تم حفظ الموديل', 'success')
  }

  const handleCreateBackup = async () => {
    setIsBackingUp(true)
    try {
      const result = await window.api.backup.create() as { success: boolean; name?: string; error?: string }
      if (result.success) {
        addToast(`تم إنشاء نسخة احتياطية: ${result.name}`, 'success')
        const bkps = await window.api.backup.list() as BackupFile[]
        setBackups(bkps)
      } else {
        addToast(result.error || 'فشل في إنشاء النسخة', 'error')
      }
    } catch {
      addToast('خطأ في إنشاء النسخة الاحتياطية', 'error')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestoreBackup = async (backup: BackupFile) => {
    if (!confirm(`هل أنت متأكد من استعادة النسخة ${backup.name}؟\nسيتم استبدال البيانات الحالية.`)) return

    try {
      const result = await window.api.backup.restore(backup.path) as { success: boolean; needsRestart?: boolean; error?: string }
      if (result.success) {
        addToast('تم استعادة النسخة. أعد تشغيل البرنامج.', 'success')
      } else {
        addToast(result.error || 'فشل في الاستعادة', 'error')
      }
    } catch {
      addToast('خطأ في استعادة النسخة', 'error')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleCheckUpdate = async () => {
    setUpdateStatus({ status: 'checking' })
    const result = await window.api.updater.check() as { success: boolean; version?: string; error?: string }
    if (!result.success) {
      setUpdateStatus({ status: 'error', info: { message: result.error } })
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdateStatus({ status: 'downloading', info: { percent: 0 } })
    await window.api.updater.download()
  }

  const handleInstallUpdate = () => {
    window.api.updater.install()
  }

  const getUpdateStatusText = () => {
    switch (updateStatus.status) {
      case 'checking': return 'جاري البحث عن تحديثات...'
      case 'available': return `يوجد تحديث جديد: ${updateStatus.info?.version || ''}`
      case 'not-available': return 'البرنامج محدث لآخر إصدار'
      case 'downloading': return `جاري التحميل... ${Math.round(updateStatus.info?.percent || 0)}%`
      case 'downloaded': return 'التحديث جاهز للتثبيت'
      case 'error': return `خطأ: ${updateStatus.info?.message || 'فشل في البحث عن تحديثات'}`
      default: return 'اضغط للبحث عن تحديثات'
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2 className="page-title">الإعدادات</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>
        {/* API Key */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Key size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>مفتاح الـ API</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                placeholder="أدخل مفتاح Gemini API"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null) }}
                style={{ paddingLeft: 40 }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button className="btn btn-primary" onClick={handleSaveKey} disabled={isSaving || !apiKey.trim()}>
              {isSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
              حفظ
            </button>
            <button className="btn btn-ghost" onClick={handleTestKey} disabled={isTesting || !apiKey.trim()}>
              {isTesting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              تجربة
            </button>
          </div>
          {testResult && (
            <p style={{
              fontSize: 13, marginTop: 8,
              color: testResult === 'success' ? 'var(--success)' : 'var(--danger)',
            }}>
              {testResult === 'success' ? 'المفتاح شغال بنجاح' : 'المفتاح غير صحيح'}
            </p>
          )}
        </div>

        {/* Model */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>الموديل</h3>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select
              className="select"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (500 طلب/يوم)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash</option>
              <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
            </select>
            <button className="btn btn-ghost" onClick={handleSaveModel}>حفظ</button>
          </div>
        </div>

        {/* Usage Counter */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Info size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>استهلاك اليوم</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              flex: 1, height: 8, background: 'var(--bg-glass)', borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (usage.count / usage.limit) * 100)}%`,
                background: usage.count > usage.limit * 0.8 ? 'var(--danger)' : 'var(--accent)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {usage.count} / {usage.limit}
            </span>
          </div>
        </div>

        {/* Backup */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Database size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>النسخ الاحتياطي</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleCreateBackup} disabled={isBackingUp}>
              {isBackingUp ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              إنشاء نسخة احتياطية
            </button>
          </div>

          {backups.length > 0 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>النسخ الموجودة:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {backups.map((b) => (
                  <div key={b.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: 'var(--bg-glass)', borderRadius: 8,
                    border: '1px solid var(--border-color)',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(b.date).toLocaleString('ar-EG')} — {formatSize(b.size)}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => handleRestoreBackup(b)}
                    >
                      <Upload size={12} /> استعادة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Updates */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <RefreshCw size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>التحديثات</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {updateStatus.status === 'idle' || updateStatus.status === 'not-available' || updateStatus.status === 'error' ? (
              <button className="btn btn-primary" onClick={handleCheckUpdate}>
                <RefreshCw size={14} /> البحث عن تحديثات
              </button>
            ) : updateStatus.status === 'checking' ? (
              <button className="btn btn-primary" disabled>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جاري البحث...
              </button>
            ) : updateStatus.status === 'available' ? (
              <button className="btn btn-success" onClick={handleDownloadUpdate}>
                <Download size={14} /> تحميل التحديث
              </button>
            ) : updateStatus.status === 'downloading' ? (
              <button className="btn btn-primary" disabled>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جاري التحميل...
              </button>
            ) : updateStatus.status === 'downloaded' ? (
              <button className="btn btn-success" onClick={handleInstallUpdate}>
                <Check size={14} /> تثبيت وإعادة تشغيل
              </button>
            ) : null}
          </div>
          <p style={{
            fontSize: 13,
            color: updateStatus.status === 'error' ? 'var(--danger)'
              : updateStatus.status === 'available' || updateStatus.status === 'downloaded' ? 'var(--success)'
              : 'var(--text-secondary)',
          }}>
            {getUpdateStatusText()}
          </p>
          {updateStatus.status === 'downloading' && (
            <div style={{
              marginTop: 8, height: 6, background: 'var(--bg-glass)',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${updateStatus.info?.percent || 0}%`,
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>

        {/* About */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Info size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>عن البرنامج</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            المحاسب الذكي - نظام محاسبة بالذكاء الاصطناعي
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            الإصدار 1.0.0
          </p>
        </div>
      </div>
    </div>
  )
}
