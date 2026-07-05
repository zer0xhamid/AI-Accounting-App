# AI Accounting App - تفاصيل المشروع

## حالة المشروع: قيد التخطيط

---

## الفكرة
برنامج محاسبي ديسكتوب يعتمد على الذكاء الاصطناعي - المستخدم يكتب جملة عادية بالعربي
والبرنامج يحللها ويسجلها محاسبياً. كل البيانات منظمة ومقروءة بدون AI.

## طبيعة البيزنس
- تجارة أخشاب (شراء وبيع خامات بأنواعها ومقاساتها)
- تصنيع (مطابخ، أبواب، دواليب - تحويل خامات لمنتج نهائي)
- مقاولات (مشاريع كاملة بتكاليفها وإيراداتها)

---

## المتطلبات الوظيفية

### 1. الإدخال الذكي (AI)
- [x] متفق عليه
- [ ] تم التنفيذ
- المستخدم يكتب جملة عادية بالعربي
- الـ AI يحللها ويستخرج: نوع العملية، المبلغ، طريقة الدفع، الكميات، الأصناف، الأشخاص
- يعرض النتيجة في فورم منظم للمراجعة قبل الحفظ

### 2. الإدخال الصوتي
- [x] متفق عليه
- [ ] تم التنفيذ
- المستخدم يتكلم بالعربي بدل ما يكتب
- يتحول لنص ثم يتحلل بالـ AI

### 3. الإدخال بالصورة
- [x] متفق عليه
- [ ] تم التنفيذ
- المستخدم يصور فاتورة أو ورقة
- الـ AI يقرأها (OCR) ويستخرج البيانات

### 4. عمليات متعددة في ريكورد واحد
- [x] متفق عليه
- [ ] تم التنفيذ
- ورقة واحدة فيها مثلاً 5 عمليات بيع لـ 5 أشخاص مختلفين
- كل عملية تتسجل لوحدها في الحسابات

### 5. التعديل اليدوي
- [x] متفق عليه
- [ ] تم التنفيذ
- زرار يفتح فورم يدوي بنفس الحقول
- المستخدم يملا البيانات بإيده بدون AI
- نفس الداتا ونفس الشكل

### 6. سؤال الـ AI (Chat)
- [x] متفق عليه
- [ ] تم التنفيذ
- المستخدم يسأل: "ليا عند عمي أحمد كام؟"
- الـ AI يقرأ من قاعدة البيانات ويرد بالعربي
- يقدر يسأل عن أرصدة، مخزون، أرباح، إلخ

### 7. طباعة PDF
- [x] متفق عليه
- [ ] تم التنفيذ
- طباعة لكل قسم لوحده (مخزن، كشف حساب، تقارير)
- شكل احترافي ومنظم

### 8. القوائم المالية والتقارير
- [x] متفق عليه
- [ ] تم التنفيذ
- ميزانية عمومية
- قائمة أرباح وخسائر
- كشف حساب عميل/مورد
- تقرير المخزون بالتفصيل (أنواع، كميات، مقاسات)

### 9. تتبع المخزون
- [x] متفق عليه
- [ ] تم التنفيذ
- أنواع متعددة (خشب، مشتقات)
- مقاسات ومواصفات (أطوال، سمك)
- وحدات قياس مختلفة (متر، لوح، قطعة)
- خامات + منتجات تامة (مطابخ، أبواب)

### 10. نظام المديونيات (الآجل)
- [x] متفق عليه
- [ ] تم التنفيذ
- بيع آجل: "ليه عند العميل" - رصيد مدين
- شراء آجل: "عليه للمورد" - رصيد دائن
- دفعات جزئية: تحديث الرصيد تلقائياً
- كشف حساب لكل شخص (عميل/مورد) يوضح كل العمليات والرصيد
- إمكانية السؤال: "ليا عند فلان كام" أو "عليا لفلان كام"

---

## المتطلبات التقنية

### القرارات المتفق عليها
- اللغة: عربي فقط
- النظام: ويندوز فقط
- تسجيل دخول: باسوورد - نعم
- باك أب: نعم
- دليل الحسابات: تلقائي
- تغيير API Key: من الإعدادات
- AI API: Google Gemini (Free Tier)
- الموديل الأساسي: gemini-3.1-flash-lite (500 RPD - الأعلى ليميت)
- الموديل الاحتياطي: gemini-3.5-flash أو gemini-3-flash-preview
- API Key (تجريبي - سيتم حذفه): AIzaSyCV-Sbx8Sg4L83S1iwUlCJSuX8OPX8czW0

### القرارات المقترحة (في انتظار الموافقة)
- واجهة التطبيق: Electron + React
- قاعدة البيانات: SQLite
- الصوت: Gemini native أو Whisper محلي

### نتائج تجربة الـ AI (2026-07-01)
- الموديل: gemini-3.1-flash-lite
- System Prompt: محسّن مع few-shot examples + JSON mode
- النتيجة: 7/7 تستات نجحت (جمل بسيطة ومعقدة)
- التحسينات المطبقة:
  1. response_mime_type: application/json (يجبر JSON صح)
  2. Few-shot examples في الـ system prompt
  3. قواعد واضحة للمبالغ والدفع
- ملاحظات: أسماء الأشخاص ممكن تتقطع ("عمي خالد" → "خالد") - يتعالج بالكود

---

## Workflow - سير العمل

### الإدخال الذكي:
1. المستخدم يكتب/يتكلم/يصور
2. الـ AI يحلل ويستخرج البيانات المنظمة
3. تظهر في فورم للمراجعة
4. المستخدم يوافق أو يعدل
5. تتحفظ في قاعدة البيانات

### الإدخال اليدوي:
1. المستخدم يفتح الفورم اليدوي
2. يملا الحقول بنفسه
3. يحفظ مباشرة في قاعدة البيانات

### سؤال الـ AI:
1. المستخدم يكتب سؤال
2. الـ AI يقرأ من قاعدة البيانات
3. يرد بإجابة واضحة بالعربي

### كل البيانات مقروءة بدون AI:
- كشف حساب أي شخص
- المخزون بالتفصيل
- التقارير والقوائم المالية
- البحث عن أي عملية

---

## سجل التقدم

### 2026-07-01
- [x] مناقشة الفكرة والمتطلبات
- [x] اختيار الـ AI API (Gemini)
- [x] تجربة المفتاح والتأكد من الموديلات المتاحة
- [x] الاتفاق على الـ Workflow
- [x] إنشاء فولدر المشروع وملف التفاصيل
- [x] تجربة الـ AI وتحسين الـ System Prompt (7/7 نجح)
- [x] اختيار الموديل النهائي: gemini-3.1-flash-lite (500 RPD)
- [x] الاتفاق على التقنيات (Electron/React/SQLite)
- [x] بداية التنفيذ - Phase 1

### Phase 1 Progress:
- [x] إنشاء package.json + TypeScript configs
- [x] إنشاء electron-builder.yml
- [x] إنشاء electron.vite.config.ts
- [x] إنشاء src/shared/ (IPC channels + Types)
- [x] إنشاء src/main/index.ts (Electron main process)
- [x] إنشاء src/main/database/ (connection.ts + schema.ts with full schema + auto-seed)
- [x] إنشاء src/main/ipc/ (database.ipc.ts + settings.ipc.ts)
- [x] إنشاء src/preload/index.ts (contextBridge API)
- [x] إنشاء src/renderer/index.html (RTL + Arabic)
- [x] إنشاء src/renderer/main.tsx + App.tsx (React entry + Router)
- [x] إنشاء src/renderer/styles/globals.css (Dark theme + RTL + Glass + Animations)
- [x] إنشاء src/renderer/components/layout/ (Sidebar + Header + MainLayout)
- [x] إنشاء src/renderer/pages/ (Dashboard + Transactions + Inventory + Persons + Reports + Chat + Settings)
- [x] npm install + electron-rebuild
- [x] تشغيل المشروع والتأكد من إنه شغال ✅

### Phase 1: DONE ✅

### Phase 2 Progress:
- [x] TransactionForm component (type, person, items, amounts, payment, date, notes)
- [x] PersonSelector with autocomplete + create-on-the-fly
- [x] ItemRow for multi-item transactions
- [x] ManualEntryPage (creates transactions via IPC)
- [x] Toast notification system (appStore + ToastContainer)
- [x] DashboardPage with real stats and recent transactions table
- [x] TransactionsPage with search, type filter, delete, click-to-edit
- [x] PersonsPage with real data, search, balance display
- [x] PersonDetailPage with account statement (debit/credit/running balance)
- [x] Header manual entry button wired to /transactions/new
- [ ] تجربة وتشغيل Phase 2
