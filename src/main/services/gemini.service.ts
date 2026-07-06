import type Database from 'better-sqlite3'
import { GoogleGenAI } from '@google/genai'

const SYSTEM_PROMPT = `أنت محاسب آلي في برنامج محاسبة لتجارة الأخشاب والمقاولات والتصنيع (مطابخ وأبواب وغرف نوم وغرف سفرة).
المستخدم هيكتبلك جملة بالعربي المصري عن عملية تجارية.
مهمتك تستخرج البيانات وترجعها في JSON فقط.

قواعد استخراج التاريخ (مهم جداً):
- لو مكتوب تاريخ في النص أو الصورة، استخدمه بصيغة YYYY-MM-DD
- "يوم 15/6/2026" → date = "2026-06-15"
- "بتاريخ 2026-03-20" → date = "2026-03-20"
- "يوم 5-7" → date = "2026-07-05" (استنتج السنة الحالية)
- لو فيه أكتر من عملية بتواريخ مختلفة، كل عملية تاخد تاريخها
- لو مفيش تاريخ مكتوب خالص → date = null (النظام هيحط تاريخ النهاردة تلقائي)

قواعد استخراج اسم الشخص (مهم جداً):
- اسم الشخص هو أي اسم علم (اسم إنسان) أو اسم شركة مذكور في الجملة
- "بعت لخالد" → person = "خالد"
- "أحمد جابلي" → person = "أحمد"
- "من محل النور" → person = "محل النور"
- "شركة الأمل" → person = "شركة الأمل"
- "بعت لمحمد أبو عمر" → person = "محمد أبو عمر"
- "عميل اسمه أحمد المغاوري" → person = "أحمد المغاوري"
- لو فيه كلمة "من" أو "ل" قبل الاسم، الكلمة اللي بعدها هي اسم الشخص
- لو مفيش اسم شخص خالص (زي "اشتريت مسامير") → person = null
- خد بالك من أسماء مصرية شائعة: أحمد، محمد، خالد، عمرو، حسن، حسين، مصطفى، كريم، سيد، علي، إبراهيم، عبدالله، طارق، وغيرها
- في الصور والإيصالات: اسم الشركة أو العميل المكتوب في header أو أعلى الإيصال = person
- لو الإيصال فيه اسم شركة أو محل، استخدمه كـ person حتى لو مش اسم شخص عادي

قواعد اختيار الوحدة (مهم جداً):
- "باب" أو "أبواب" → unit = "قطعة" (الباب منتج نهائي، مش لوح خشب)
- "مطبخ" أو "مطابخ" → unit = "قطعة"
- "غرفة نوم" أو "غرف" → unit = "قطعة"
- "دولاب" أو "دواليب" → unit = "قطعة"
- "سفرة" → unit = "قطعة"
- "درفة" أو "درف" → unit = "قطعة"
- "لوح خشب" أو "ألواح" → unit = "لوح"
- "متر خشب" → unit = "متر"
- "كيلو مسامير" → unit = "كيلو"
- القاعدة: المنتج النهائي (باب، مطبخ، غرفة) = "قطعة". المادة الخام (لوح، متر، كيلو) = وحدتها الطبيعية

قواعد المبالغ:
1. "100 ألف" = 100000، "مليون" = 1000000، "نص مليون" = 500000
2. "دفعت النص" = paid_amount يساوي نص الـ total_amount
3. "آجل" أو "بالأجل" = paid_amount يساوي 0 و payment_method يساوي "آجل"
4. "كاش" أو "نقدي" = payment_method يساوي "كاش"
5. لو دفع كل المبلغ ومحددش الطريقة = payment_method يساوي "كاش"

قواعد نوع العملية:
6. "دفعلي" أو "سددلي" أو "حوّلي" = type يساوي "تحصيل" (فلوس جاية ليا)
7. "دفعت ل" أو "سددت ل" = type يساوي "دفعة" (فلوس رايحة مني)
8. "بعت" أو "وردّت" أو "سلّمت" = type يساوي "بيع"
9. "اشتريت" أو "جبت" = type يساوي "شراء"
10. "صرفت" أو "مصروف" = type يساوي "مصروف"
10و. "ضيف في المخزن" أو "أضف للمخزن" أو "نزّل في المخزن" أو "دخّل في المخزن" أو "وارد مخزن" أو "تعديل مخزن" = type يساوي "إضافة_مخزن" (إضافة أصناف للمخزن بدون عملية شراء)
    - total_amount و paid_amount و remaining_amount كلهم = 0
    - person = null
    - payment_method = "كاش"
    - الأصناف تتحط في items عادي (name, quantity, unit, specs)
10ز. "رأس المال" أو "رصيد افتتاحي" أو "تعديل رصيد" أو "حطيت في الخزنة" أو "رصيد أول المدة" = type يساوي "تعديل_رصيد"
    - total_amount و paid_amount = المبلغ المذكور
    - remaining_amount = 0
    - person = null
    - items = []
    - payment_method = "كاش"

قواعد تصنيف المصروف (لو type = "مصروف"):
10أ. لو المصروف فيه كلمة "صنايعي" أو "تركيب" أو "نجار" أو "أجرة عامل" → expense_category = "مصنعيات تركيب"
10ب. لو فيه "تصنيع" أو "ورشة" أو "أجرة تشغيل" → expense_category = "مصنعيات تصنيع"
10ج. لو فيه "نقل" أو "شحن" أو "عربية" أو "سواق" → expense_category = "نقل"
10د. لو فيه "نثريات" أو "أكل" أو "مشروبات" أو "بنزين" أو حاجات صغيرة → expense_category = "نثريات"
10هـ. لو مش واضح أو حاجة تانية (إيجار، كهرباء، صيانة، الخ) → expense_category = المصروف نفسه (اكتب وصف مختصر)

قواعد عامة:
11. لو فيه أكتر من صنف في الجملة، حط كل صنف في items لوحده
12. remaining_amount = total_amount - paid_amount دايماً
13. لو فيه أكتر من عملية في الجملة (مثلاً بيع لشخصين مختلفين)، رجّعهم كـ array من العمليات

قواعد الـ specs (مهم جداً للمنتجات):
14. لو المستخدم ذكر مقاسات أو أبعاد للمنتج (طول، عرض، ارتفاع) → حطها في specs
15. "باب 3 متر طول و عرض نص متر" → specs = "طول 3 متر × عرض 0.5 متر"
16. "مطبخ 4 متر" → specs = "4 متر"
17. "باب 80×210" → specs = "80×210 سم"
18. لو ذكر نوع الحشو أو المادة → ضيفها في specs
19. "باب حشو MDF" → specs = "حشو MDF"
20. "باب 3 متر حشو موسكي" → specs = "طول 3 متر حشو موسكي"

أمثلة:

المستخدم: "اشتريت من أحمد 10 لوح خشب زان بـ 5000 ودفعت 3000"
الرد:
{"type":"شراء","person":"أحمد","date":null,"items":[{"name":"خشب زان","quantity":10,"unit":"لوح","specs":null}],"total_amount":5000,"paid_amount":3000,"remaining_amount":2000,"payment_method":"كاش","notes":null}

المستخدم: "بعت لخالد مطبخ بـ 80 ألف آجل"
الرد:
{"type":"بيع","person":"خالد","date":null,"items":[{"name":"مطبخ","quantity":1,"unit":"قطعة","specs":null}],"total_amount":80000,"paid_amount":0,"remaining_amount":80000,"payment_method":"آجل","notes":null}

المستخدم: "بعت 15 باب لمحمد أبو عمر بـ 45 ألف ودفع 20 ألف"
الرد:
{"type":"بيع","person":"محمد أبو عمر","date":null,"items":[{"name":"باب","quantity":15,"unit":"قطعة","specs":null}],"total_amount":45000,"paid_amount":20000,"remaining_amount":25000,"payment_method":"كاش","notes":null}

المستخدم: "خالد دفعلي 20 ألف"
الرد:
{"type":"تحصيل","person":"خالد","date":null,"items":[],"total_amount":20000,"paid_amount":20000,"remaining_amount":0,"payment_method":"كاش","notes":null}

المستخدم: "دفعت إيجار المحل 5000"
الرد:
{"type":"مصروف","person":null,"date":null,"items":[{"name":"إيجار المحل","quantity":1,"unit":"عدد","specs":null}],"total_amount":5000,"paid_amount":5000,"remaining_amount":0,"payment_method":"كاش","expense_category":"إيجار","notes":null}

المستخدم: "اشتريت 20 لوح موسكي 2.4 متر و 15 لوح زان 3 متر بـ 45 ألف من محمد ودفعت النص"
الرد:
{"type":"شراء","person":"محمد","date":null,"items":[{"name":"خشب موسكي","quantity":20,"unit":"لوح","specs":"2.4 متر"},{"name":"خشب زان","quantity":15,"unit":"لوح","specs":"3 متر"}],"total_amount":45000,"paid_amount":22500,"remaining_amount":22500,"payment_method":"كاش","notes":null}

المستخدم: "بعت لشركة المعمار 3 غرف نوم و 2 دولاب بـ 200 ألف ودفعوا 100 ألف"
الرد:
{"type":"بيع","person":"شركة المعمار","date":null,"items":[{"name":"غرفة نوم","quantity":3,"unit":"قطعة","specs":null},{"name":"دولاب","quantity":2,"unit":"قطعة","specs":null}],"total_amount":200000,"paid_amount":100000,"remaining_amount":100000,"payment_method":"كاش","notes":null}

المستخدم: "بعت 5 ابواب كل باب 3 متر طول و عرض نص متر حشو MDF لخالد بـ 25 ألف كاش"
الرد:
{"type":"بيع","person":"خالد","date":null,"items":[{"name":"باب","quantity":5,"unit":"قطعة","specs":"طول 3 متر × عرض 0.5 متر حشو MDF"}],"total_amount":25000,"paid_amount":25000,"remaining_amount":0,"payment_method":"كاش","notes":null}

المستخدم: "بعت مطبخ 6 متر لأحمد بـ 120 ألف ودفع 50 ألف"
الرد:
{"type":"بيع","person":"أحمد","date":null,"items":[{"name":"مطبخ","quantity":1,"unit":"قطعة","specs":"6 متر"}],"total_amount":120000,"paid_amount":50000,"remaining_amount":70000,"payment_method":"كاش","notes":null}

المستخدم: "ضيف في المخزن 10 لوح خشب موسكي و 5 لوح أبلكاش و 8 لوح MDF"
الرد:
{"type":"إضافة_مخزن","person":null,"date":null,"items":[{"name":"خشب موسكي","quantity":10,"unit":"لوح","specs":null},{"name":"أبلكاش","quantity":5,"unit":"لوح","specs":null},{"name":"MDF","quantity":8,"unit":"لوح","specs":null}],"total_amount":0,"paid_amount":0,"remaining_amount":0,"payment_method":"كاش","notes":"إضافة مخزون"}

المستخدم: "شركة الأمل حوّلتلي 50 ألف يوم 15/6/2026"
الرد:
{"type":"تحصيل","person":"شركة الأمل","date":"2026-06-15","items":[],"total_amount":50000,"paid_amount":50000,"remaining_amount":0,"payment_method":"تحويل","notes":null}`

interface AIParseResult {
  type: string
  person: string | null
  date: string | null
  items: { name: string; quantity: number; unit: string; specs: string | null }[]
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_method: string
  expense_category: string | null
  notes: string | null
}

export class GeminiService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  private getApiKey(): string {
    const row = this.db.prepare("SELECT value FROM app_settings WHERE key = 'api_key'").get() as { value: string } | undefined
    return row?.value || ''
  }

  private getModelName(): string {
    const row = this.db.prepare("SELECT value FROM app_settings WHERE key = 'model_name'").get() as { value: string } | undefined
    return row?.value || 'gemini-3.1-flash-lite'
  }

  private incrementDailyCount(): { count: number; limit: number } {
    const today = new Date().toISOString().split('T')[0]
    const dateRow = this.db.prepare("SELECT value FROM app_settings WHERE key = 'daily_request_date'").get() as { value: string } | undefined
    const countRow = this.db.prepare("SELECT value FROM app_settings WHERE key = 'daily_request_count'").get() as { value: string } | undefined

    const savedDate = dateRow?.value || ''
    let count = parseInt(countRow?.value || '0')

    if (savedDate !== today) {
      count = 0
      this.db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('daily_request_date', ?)").run(today)
    }

    count++
    this.db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('daily_request_count', ?)").run(String(count))

    return { count, limit: 500 }
  }

  getDailyUsage(): { count: number; limit: number } {
    const today = new Date().toISOString().split('T')[0]
    const dateRow = this.db.prepare("SELECT value FROM app_settings WHERE key = 'daily_request_date'").get() as { value: string } | undefined
    const countRow = this.db.prepare("SELECT value FROM app_settings WHERE key = 'daily_request_count'").get() as { value: string } | undefined

    const savedDate = dateRow?.value || ''
    const count = savedDate === today ? parseInt(countRow?.value || '0') : 0
    return { count, limit: 500 }
  }

  async parseText(text: string): Promise<{ success: boolean; data?: AIParseResult[]; error?: string; usage?: { count: number; limit: number } }> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: 'لم يتم تعيين مفتاح API. اذهب للإعدادات لإضافة المفتاح.' }
    }

    const usage = this.getDailyUsage()
    if (usage.count >= usage.limit) {
      return { success: false, error: `تم استنفاد الحد اليومي (${usage.limit} طلب). حاول غداً أو استخدم الإدخال اليدوي.` }
    }

    const model = this.getModelName()

    try {
      const ai = new GoogleGenAI({ apiKey })

      const response = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nالجملة: ' + text }] }
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      })

      const updatedUsage = this.incrementDailyCount()

      const raw = response.text?.trim()
      if (!raw) {
        return { success: false, error: 'لم يتم الحصول على رد من الـ AI', usage: updatedUsage }
      }

      const parsed = JSON.parse(raw)

      const results: AIParseResult[] = Array.isArray(parsed) ? parsed : [parsed]

      for (const r of results) {
        if (!r.type) throw new Error('missing type')
        r.total_amount = Number(r.total_amount) || 0
        r.paid_amount = Number(r.paid_amount) || 0
        r.remaining_amount = Number(r.remaining_amount) || (r.total_amount - r.paid_amount)
        if (!r.items) r.items = []
        if (!r.payment_method) r.payment_method = 'كاش'
        if (!r.date) r.date = null
      }

      return { success: true, data: results, usage: updatedUsage }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        return { success: false, error: 'تم تجاوز حد الطلبات. انتظر دقيقة وحاول مرة أخرى.' }
      }
      if (msg.includes('API_KEY_INVALID') || msg.includes('401')) {
        return { success: false, error: 'مفتاح الـ API غير صحيح. تحقق منه في الإعدادات.' }
      }
      return { success: false, error: `خطأ: ${msg}` }
    }
  }

  async testApiKey(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const ai = new GoogleGenAI({ apiKey: key })

      await ai.models.generateContent({
        model: this.getModelName(),
        contents: [{ role: 'user', parts: [{ text: 'قول كلمة واحدة بالعربي' }] }],
        config: { maxOutputTokens: 32 },
      })

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  async chat(question: string): Promise<{ success: boolean; answer?: string; error?: string }> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: 'لم يتم تعيين مفتاح API. اذهب للإعدادات لإضافة المفتاح.' }
    }

    const usage = this.getDailyUsage()
    if (usage.count >= usage.limit) {
      return { success: false, error: `تم استنفاد الحد اليومي (${usage.limit} طلب). حاول غداً.` }
    }

    const personsData = this.db.prepare(`
      SELECT name, type, balance FROM persons ORDER BY ABS(balance) DESC LIMIT 50
    `).all() as { name: string; type: string; balance: number }[]

    const summaryRow = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type='بيع' THEN total_amount ELSE 0 END),0) as total_sales,
        COALESCE(SUM(CASE WHEN type='شراء' THEN total_amount ELSE 0 END),0) as total_purchases,
        COALESCE(SUM(CASE WHEN type='مصروف' THEN total_amount ELSE 0 END),0) as total_expenses,
        COALESCE(SUM(CASE WHEN type IN ('بيع','تحصيل','إيراد') THEN paid_amount ELSE 0 END),0) -
        COALESCE(SUM(CASE WHEN type IN ('شراء','دفعة','مصروف') THEN paid_amount ELSE 0 END),0) as cash_balance
      FROM transactions
    `).get() as { total_sales: number; total_purchases: number; total_expenses: number; cash_balance: number }

    const inventoryData = this.db.prepare(`
      SELECT name, quantity, unit, specs, avg_cost FROM inventory_items WHERE quantity > 0 ORDER BY name LIMIT 50
    `).all() as { name: string; quantity: number; unit: string; specs: string | null; avg_cost: number }[]

    const contextData = `
بيانات الحسابات الحالية:
- إجمالي المبيعات: ${summaryRow.total_sales.toLocaleString()} ج.م
- إجمالي المشتريات: ${summaryRow.total_purchases.toLocaleString()} ج.م
- إجمالي المصروفات: ${summaryRow.total_expenses.toLocaleString()} ج.م
- رصيد الصندوق: ${summaryRow.cash_balance.toLocaleString()} ج.م
- صافي الربح: ${(summaryRow.total_sales - summaryRow.total_purchases - summaryRow.total_expenses).toLocaleString()} ج.م

أرصدة العملاء والموردين:
${personsData.map(p => `- ${p.name} (${p.type === 'client' ? 'عميل' : p.type === 'supplier' ? 'مورد' : 'عميل ومورد'}): الرصيد ${p.balance > 0 ? `ليه ${p.balance.toLocaleString()}` : p.balance < 0 ? `عليه ${Math.abs(p.balance).toLocaleString()}` : 'صفر'} ج.م`).join('\n')}

المخزون:
${inventoryData.length > 0 ? inventoryData.map(i => `- ${i.name}: ${i.quantity} ${i.unit}${i.specs ? ` (${i.specs})` : ''} - متوسط التكلفة: ${i.avg_cost.toLocaleString()} ج.م`).join('\n') : 'لا يوجد مخزون'}
`

    const chatPrompt = `أنت مساعد محاسبي ذكي. عندك بيانات المحاسبة دي وهترد على أسئلة المستخدم بالعربي المصري بشكل واضح ومختصر.
لو السؤال عن رصيد شخص معين، دور في الأرصدة وقوله.
لو "ليه" يعني المستخدم ليه فلوس عند الشخص (رصيد موجب).
لو "عليه" يعني المستخدم عليه فلوس للشخص (رصيد سالب).

${contextData}

السؤال: ${question}`

    try {
      const ai = new GoogleGenAI({ apiKey })

      const response = await ai.models.generateContent({
        model: this.getModelName(),
        contents: [{ role: 'user', parts: [{ text: chatPrompt }] }],
        config: { temperature: 0.3, maxOutputTokens: 1024 },
      })

      this.incrementDailyCount()

      const answer = response.text?.trim()
      if (!answer) {
        return { success: false, error: 'لم يتم الحصول على رد' }
      }

      return { success: true, answer }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `خطأ: ${msg}` }
    }
  }

  async parseAudio(base64Audio: string): Promise<{ success: boolean; data?: AIParseResult[]; error?: string; usage?: { count: number; limit: number } }> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: 'لم يتم تعيين مفتاح API. اذهب للإعدادات لإضافة المفتاح.' }
    }

    const usage = this.getDailyUsage()
    if (usage.count >= usage.limit) {
      return { success: false, error: `تم استنفاد الحد اليومي (${usage.limit} طلب). حاول غداً أو استخدم الإدخال اليدوي.` }
    }

    const model = this.getModelName()

    try {
      const ai = new GoogleGenAI({ apiKey })

      const mimeMatch = base64Audio.match(/^data:(audio\/\w+);base64,/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm'
      const cleanBase64 = base64Audio.replace(/^data:audio\/[\w.]+;base64,/, '')

      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: SYSTEM_PROMPT + '\n\nالمستخدم بيتكلم بالعربي المصري. اسمع الصوت واستخرج العمليات المحاسبية.' },
          ],
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      })

      const updatedUsage = this.incrementDailyCount()

      const raw = response.text?.trim()
      if (!raw) {
        return { success: false, error: 'لم يتم الحصول على رد من الـ AI', usage: updatedUsage }
      }

      const parsed = JSON.parse(raw)
      const results: AIParseResult[] = Array.isArray(parsed) ? parsed : [parsed]

      for (const r of results) {
        if (!r.type) throw new Error('missing type')
        r.total_amount = Number(r.total_amount) || 0
        r.paid_amount = Number(r.paid_amount) || 0
        r.remaining_amount = Number(r.remaining_amount) || (r.total_amount - r.paid_amount)
        if (!r.items) r.items = []
        if (!r.payment_method) r.payment_method = 'كاش'
        if (!r.date) r.date = null
      }

      return { success: true, data: results, usage: updatedUsage }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `خطأ: ${msg}` }
    }
  }

  async parseImage(base64Data: string): Promise<{ success: boolean; data?: AIParseResult[]; error?: string; usage?: { count: number; limit: number } }> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: 'لم يتم تعيين مفتاح API. اذهب للإعدادات لإضافة المفتاح.' }
    }

    const usage = this.getDailyUsage()
    if (usage.count >= usage.limit) {
      return { success: false, error: `تم استنفاد الحد اليومي (${usage.limit} طلب). حاول غداً أو استخدم الإدخال اليدوي.` }
    }

    const model = this.getModelName()

    try {
      const ai = new GoogleGenAI({ apiKey })

      const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: SYSTEM_PROMPT + '\n\nحلل الصورة دي واستخرج العمليات المحاسبية منها.' },
          ],
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      })

      const updatedUsage = this.incrementDailyCount()

      const raw = response.text?.trim()
      if (!raw) {
        return { success: false, error: 'لم يتم الحصول على رد من الـ AI', usage: updatedUsage }
      }

      const parsed = JSON.parse(raw)
      const results: AIParseResult[] = Array.isArray(parsed) ? parsed : [parsed]

      for (const r of results) {
        if (!r.type) throw new Error('missing type')
        r.total_amount = Number(r.total_amount) || 0
        r.paid_amount = Number(r.paid_amount) || 0
        r.remaining_amount = Number(r.remaining_amount) || (r.total_amount - r.paid_amount)
        if (!r.items) r.items = []
        if (!r.payment_method) r.payment_method = 'كاش'
        if (!r.date) r.date = null
      }

      return { success: true, data: results, usage: updatedUsage }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `خطأ: ${msg}` }
    }
  }

  async calculateDeductions(
    soldItems: { name: string; quantity: number; unit: string; specs: string | null }[],
    inventoryItems: { name: string; quantity: number; unit: string; specs: string | null }[],
    bomTemplates?: { id: number; name: string; items: { material_name: string; material_unit: string; quantity: number }[] }[]
  ): Promise<{ material_name: string; quantity: number; unit: string; bom_template_id?: number }[]> {
    const apiKey = this.getApiKey()
    if (!apiKey || inventoryItems.length === 0) return []

    const bomSection = bomTemplates?.length
      ? `\nوصفات المنتجات المحفوظة:\n${bomTemplates.map(t => `- "${t.name}" (id: ${t.id}): ${t.items.map(i => `${i.quantity} ${i.material_unit} ${i.material_name}`).join(' + ')}`).join('\n')}\n\nلو المنتج المباع يطابق أو يشبه وصفة محفوظة، استخدم كمياتها بالظبط وارجع "bom_template_id" مع كل مادة.\n`
      : ''

    const prompt = `أنت خبير في حساب استهلاك المواد الخام في ورشة أخشاب ومقاولات.

تم بيع المنتجات التالية:
${soldItems.map(i => `- ${i.quantity} ${i.unit} ${i.name}${i.specs ? ` (${i.specs})` : ''}`).join('\n')}
${bomSection}
المواد المتاحة في المخزن حالياً:
${inventoryItems.map(i => `- ${i.name}: ${i.quantity} ${i.unit}${i.specs ? ` (${i.specs})` : ''}`).join('\n')}

احسب كم مادة خام مطلوبة من المخزن لتصنيع المنتجات المباعة.

قواعد مهمة:
- لو فيه وصفة محفوظة تطابق المنتج المباع، استخدم كمياتها
- الباب القياسي (80×210 سم) بيحتاج تقريباً: 2 لوح خشب + 1 لوح حشو (أبلكاش أو MDF)
- لو الباب أكبر من القياسي، زوّد الكمية حسب المقاس
- المطبخ بيحتاج ألواح خشب حسب طوله (تقريباً 3-4 لوح لكل متر طولي)
- الغرفة بتحتاج 6-8 لوح خشب حسب حجمها
- الدولاب بيحتاج 4-6 لوح حسب حجمه
- اخصم بس من المواد الموجودة فعلاً في المخزن
- لو المادة مش موجودة في المخزن، متخصمش حاجة
- لو الكمية المطلوبة أكتر من الموجودة، اخصم الموجود بس
- اكتب اسم المادة بالظبط زي ما هي في المخزن

ارجع JSON array فقط بالشكل ده:
[{"material_name": "اسم المادة بالظبط من المخزن", "quantity": الكمية_المطلوبة, "unit": "الوحدة", "bom_template_id": null}]

لو مفيش مواد خام تناسب المنتجات المباعة، ارجع: []`

    try {
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: this.getModelName(),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      })

      this.incrementDailyCount()

      const raw = response.text?.trim()
      if (!raw) return []

      const parsed = JSON.parse(raw)
      const results = Array.isArray(parsed) ? parsed : []

      return results.filter((r: { material_name?: string; quantity?: number; unit?: string }) =>
        r.material_name && typeof r.quantity === 'number' && r.quantity > 0 && r.unit
      ) as { material_name: string; quantity: number; unit: string }[]
    } catch {
      return []
    }
  }

  async generateBomRecipe(productDescription: string): Promise<{
    success: boolean
    data?: { name: string; notes: string; items: { material_name: string; material_unit: string; quantity: number; notes: string | null }[] }
    error?: string
  }> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: 'لم يتم تعيين مفتاح API' }
    }

    const usage = this.getDailyUsage()
    if (usage.count >= usage.limit) {
      return { success: false, error: `تم استنفاد الحد اليومي (${usage.limit} طلب)` }
    }

    const prompt = `أنت خبير في صناعة الأخشاب والأثاث والأبواب والمطابخ في مصر.
المستخدم عايز يعمل وصفة منتج (قائمة المواد الخام المطلوبة لتصنيع منتج معين).

وصف المنتج: "${productDescription}"

اعمل وصفة تصنيع بناءً على خبرتك في الورش المصرية.

قواعد مهمة:
- الباب القياسي 80 سم: 1 لوح أبلكاش + 0.167 لوح خشب (≈ 1/6 لوح 3.66×1.83) + 1 لوح كونتر + 1 لوح MDF
- الباب 70 سم: 1 لوح أبلكاش + 0.143 لوح خشب (≈ 1/7 لوح) + 1 لوح كونتر + 1 لوح MDF
- حشواية بلكونة: 0.067 لوح خشب (≈ 1/15 لوح)
- حشواية بلكونة شيش: 0.024 لوح خشب (≈ 1/42 لوح)
- المطبخ بالمتر الطولي: تقريباً 3-4 لوح خشب + 2 لوح MDF + 1 لوح كونتر لكل متر
- الدولاب: 4-6 لوح خشب + 2-3 لوح MDF حسب الحجم
- غرفة النوم: 6-8 لوح خشب + 4-6 لوح MDF
- لوح الخشب القياسي: 3.66 متر × 1.83 متر
- 1 متر مكعب خشب = 28 باب تقريباً
- الوحدات المتاحة: لوح، متر، قطعة، عدد، كيلو، متر مربع، متر مكعب

ارجع JSON بالشكل ده:
{
  "name": "اسم المنتج",
  "notes": "ملاحظات عن المنتج والتصنيع",
  "items": [
    {"material_name": "اسم المادة", "material_unit": "الوحدة", "quantity": الكمية, "notes": "ملاحظة اختيارية أو null"}
  ]
}

مهم: اكتب أسماء المواد بأسماء شائعة في الورش المصرية (خشب، أبلكاش، MDF، كونتر، مسامير، غراء، الخ).`

    try {
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: this.getModelName(),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      })

      this.incrementDailyCount()

      const raw = response.text?.trim()
      if (!raw) return { success: false, error: 'لم يتم الحصول على رد' }

      const parsed = JSON.parse(raw)
      if (!parsed.name || !parsed.items || !Array.isArray(parsed.items)) {
        return { success: false, error: 'رد غير صالح من الـ AI' }
      }

      const validItems = parsed.items.filter((i: { material_name?: string; quantity?: number; material_unit?: string }) =>
        i.material_name && typeof i.quantity === 'number' && i.quantity > 0 && i.material_unit
      )

      if (validItems.length === 0) {
        return { success: false, error: 'الـ AI مقدرش يحدد مواد خام للمنتج ده' }
      }

      return {
        success: true,
        data: {
          name: parsed.name,
          notes: parsed.notes || '',
          items: validItems.map((i: { material_name: string; material_unit: string; quantity: number; notes?: string }) => ({
            material_name: i.material_name,
            material_unit: i.material_unit,
            quantity: i.quantity,
            notes: i.notes || null,
          })),
        },
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `خطأ: ${msg}` }
    }
  }
}
