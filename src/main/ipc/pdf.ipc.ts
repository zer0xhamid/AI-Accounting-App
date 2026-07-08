import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFileSync } from 'fs'
import { IPC } from '../../shared/ipc-channels'

export function registerPDFHandlers(): void {
  ipcMain.handle(IPC.PDF_GENERATE, async (_e, type: string, data: unknown) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    const htmlContent = buildPDFHtml(type, data as Record<string, unknown>)

    const pdfWin = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    })

    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    })

    pdfWin.close()

    const titleMap: Record<string, string> = {
      'income': 'قائمة_الدخل',
      'balance': 'الميزانية_العمومية',
      'account': 'كشف_حساب',
      'inventory': 'تقرير_المخزن',
      'receipt': 'إيصال',
      'invoice': 'فاتورة',
    }

    const txnFileNames: Record<string, string> = {
      'بيع': 'فاتورة_بيع', 'شراء': 'فاتورة_شراء',
      'تحصيل': 'إيصال_تحصيل', 'دفعة': 'إيصال_دفع',
      'مصروف': 'إيصال_مصروف', 'إيراد': 'إيصال_إيراد',
    }
    const d = data as Record<string, unknown>
    const txnType = (d.txn_type as string) || ''
    const fileName = txnFileNames[txnType] || titleMap[type] || 'تقرير'

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'حفظ PDF',
      defaultPath: `${fileName}_${new Date().toISOString().split('T')[0]}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    if (!filePath) return { success: false, error: 'تم الإلغاء' }

    writeFileSync(filePath, pdfData)
    return { success: true, path: filePath }
  })
}

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    direction: rtl; background: white; color: #1a237e;
    width: 100%; padding: 24px 28px;
  }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 8px;
  }
  .brand { font-size: 26px; font-weight: 800; color: #1a237e; letter-spacing: 1px; }
  .brand-en { font-size: 18px; font-weight: 700; color: #1a237e; font-style: italic; }
  .info-row {
    display: flex; justify-content: space-between; font-size: 13px;
    margin-bottom: 5px; gap: 20px;
  }
  .info-row span { color: #1a237e; }
  .info-row .dots { flex: 1; border-bottom: 1px dotted #1a237e; margin: 0 4px; min-width: 30px; }
  .info-row .val { font-weight: 600; min-width: 60px; }
  .doc-title {
    text-align: center; font-size: 20px; font-weight: 800;
    color: #1a237e; margin: 14px 0 10px; letter-spacing: 2px;
  }
  table {
    width: 100%; border-collapse: collapse;
    border: 2px solid #1a237e; margin-bottom: 12px;
  }
  th {
    background: white; padding: 8px 6px; text-align: center;
    font-size: 13px; font-weight: 700; color: #1a237e;
    border: 2px solid #1a237e;
  }
  td {
    padding: 6px 8px; text-align: center; font-size: 13px;
    border: 1px solid #1a237e; height: 26px;
  }
  td:first-child { text-align: right; padding-right: 10px; }
  .row-data { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #c5cae9; }
  .row-total { border-top: 2px solid #1a237e; margin-top: 6px; padding-top: 8px; font-size: 15px; font-weight: 700; color: #1a237e; }
  .summary-box { border: 2px solid #1a237e; border-radius: 4px; padding: 12px 16px; margin: 10px 0; }
  .summary-big { text-align: center; font-size: 24px; font-weight: 800; color: #1a237e; margin: 12px 0; }
  .summary-big.green { color: #2e7d32; }
  .summary-big.red { color: #c62828; }
  .footer-sigs {
    display: flex; justify-content: space-between;
    font-size: 14px; font-weight: 700; color: #1a237e;
    margin-top: 24px;
  }
  .footer-sigs .sig { display: flex; align-items: center; gap: 6px; }
  .footer-sigs .dots-line { width: 120px; border-bottom: 1px dotted #1a237e; }
`

function wrapHtml(title: string, dateStr: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body>
  <div class="header">
    <div><div class="brand">فلوريندا</div></div>
    <div style="text-align:left"><div class="brand-en">Florinda</div></div>
  </div>
  <div class="info-row">
    <div style="display:flex;align-items:center">
      <span>التاريخ :</span><span class="dots"></span><span class="val">${dateStr}</span>
    </div>
  </div>
  <div class="doc-title">${title}</div>
  ${bodyHtml}
  <div class="footer-sigs">
    <div class="sig"><span>المهندس</span><div class="dots-line"></div></div>
    <div class="sig"><span>مسئول الشركة</span><div class="dots-line"></div></div>
  </div>
</body>
</html>`
}

function buildPDFHtml(type: string, data: Record<string, unknown>): string {
  const today = new Date().toLocaleDateString('ar-EG')

  if (type === 'income') {
    const d = data as { sales: number; other_income: number; cogs: number; expenses: number; gross_profit: number; net_profit: number; expense_breakdown: { category: string; total: number }[] }
    const revenue = (d.sales || 0) + (d.other_income || 0)
    const body = `
      <div class="summary-box">
        <div class="row-data"><span style="font-weight:700">إيرادات المبيعات</span><span>${(d.sales || 0).toLocaleString()} ج.م</span></div>
        ${(d.other_income || 0) > 0 ? `<div class="row-data"><span>إيرادات أخرى</span><span>${d.other_income.toLocaleString()} ج.م</span></div>` : ''}
        <div class="row-data row-total"><span>إجمالي الإيرادات</span><span>${revenue.toLocaleString()} ج.م</span></div>
      </div>
      <div class="summary-box">
        <div class="row-data"><span>تكلفة البضاعة المباعة</span><span>${(d.cogs || 0).toLocaleString()} ج.م</span></div>
        <div class="row-data" style="border-bottom:2px solid #1a237e;padding-bottom:8px"><span style="font-weight:700;color:#2e7d32">مجمل الربح</span><span style="font-weight:700">${(d.gross_profit || 0).toLocaleString()} ج.م</span></div>
        ${(d.expense_breakdown || []).map((e: { category: string; total: number }) => `<div class="row-data"><span>${e.category || 'مصروفات أخرى'}</span><span>${(e.total || 0).toLocaleString()} ج.م</span></div>`).join('')}
        <div class="row-data row-total"><span>إجمالي المصروفات</span><span>${(d.expenses || 0).toLocaleString()} ج.م</span></div>
      </div>
      <div class="summary-big ${(d.net_profit || 0) >= 0 ? 'green' : 'red'}">صافي ${(d.net_profit || 0) >= 0 ? 'الربح' : 'الخسارة'}: ${Math.abs(d.net_profit || 0).toLocaleString()} ج.م</div>
    `
    return wrapHtml('قائمة الدخل', today, body)

  } else if (type === 'balance') {
    const d = data as { assets: { cash: number; receivables: number; inventory: number; total: number }; liabilities: { payables: number; total: number }; equity: number }
    const body = `
      <div class="summary-box">
        <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:8px;border-bottom:2px solid #1a237e;padding-bottom:6px">الأصول</div>
        <div class="row-data"><span>الصندوق (كاش)</span><span>${(d.assets?.cash || 0).toLocaleString()} ج.م</span></div>
        <div class="row-data"><span>المدينون (العملاء)</span><span>${(d.assets?.receivables || 0).toLocaleString()} ج.م</span></div>
        <div class="row-data"><span>المخزون</span><span>${(d.assets?.inventory || 0).toLocaleString()} ج.م</span></div>
        <div class="row-data row-total"><span>إجمالي الأصول</span><span>${(d.assets?.total || 0).toLocaleString()} ج.م</span></div>
      </div>
      <div class="summary-box">
        <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:8px;border-bottom:2px solid #1a237e;padding-bottom:6px">الالتزامات</div>
        <div class="row-data"><span>الدائنون (الموردين)</span><span>${(d.liabilities?.payables || 0).toLocaleString()} ج.م</span></div>
        <div class="row-data row-total"><span>إجمالي الالتزامات</span><span>${(d.liabilities?.total || 0).toLocaleString()} ج.م</span></div>
      </div>
      <div class="summary-big green">حقوق الملكية: ${(d.equity || 0).toLocaleString()} ج.م</div>
    `
    return wrapHtml('الميزانية العمومية', today, body)

  } else if (type === 'account') {
    const d = data as { person: { name: string; balance: number }; rows: { date: string; type: string; description: string; total_amount: number; paid_amount: number; remaining_amount: number; runningBalance: number }[] }
    const body = `
      <div class="info-row">
        <div style="display:flex;align-items:center">
          <span>الحساب :</span><span class="dots"></span><span class="val">${d.person?.name || ''}</span>
        </div>
      </div>
      <table>
        <thead><tr><th>التاريخ</th><th>العملية</th><th>البيان</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الرصيد</th></tr></thead>
        <tbody>
          ${(d.rows || []).map((r) => `
            <tr>
              <td>${r.date}</td><td>${r.type}</td><td>${r.description || '-'}</td>
              <td>${(r.total_amount || 0).toLocaleString()}</td>
              <td>${(r.paid_amount || 0) > 0 ? r.paid_amount.toLocaleString() : '-'}</td>
              <td>${(r.remaining_amount || 0) > 0 ? r.remaining_amount.toLocaleString() : '-'}</td>
              <td style="font-weight:600">${Math.abs(r.runningBalance).toLocaleString()} ${r.runningBalance > 0 ? 'عليه' : r.runningBalance < 0 ? 'له' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="summary-big ${(d.person?.balance || 0) >= 0 ? 'green' : 'red'}">الرصيد: ${Math.abs(d.person?.balance || 0).toLocaleString()} ج.م ${(d.person?.balance || 0) > 0 ? 'عليه' : (d.person?.balance || 0) < 0 ? 'له' : ''}</div>
    `
    return wrapHtml('كشف حساب', today, body)

  } else if (type === 'receipt' || type === 'invoice') {
    const d = data as {
      date: string; person_name: string; company?: string; location?: string
      txn_type?: string
      items: { name: string; count: number; pieces: number; unit_price: number; total: number }[]
      grand_total: number
    }
    const txnType = d.txn_type || (type === 'receipt' ? 'بيع' : 'شراء')

    const docTitleMap: Record<string, string> = {
      'بيع': 'فاتورة بيع', 'شراء': 'فاتورة شراء',
      'تحصيل': 'إيصال تحصيل', 'دفعة': 'إيصال دفع',
      'مصروف': 'إيصال مصروف', 'إيراد': 'إيصال إيراد',
    }
    const personLabelMap: Record<string, string> = {
      'بيع': 'المستلم', 'شراء': 'المورد',
      'تحصيل': 'من', 'دفعة': 'إلى',
      'مصروف': 'البيان', 'إيراد': 'من',
    }
    const title = docTitleMap[txnType] || 'إيصال'
    const personLabel = personLabelMap[txnType] || 'الاسم'
    const countHeader = txnType === 'شراء' ? 'التكعيب' : 'العدد'
    const emptyRows = Math.max(0, 12 - (d.items?.length || 0))

    const body = `
      <div class="info-row">
        <div style="display:flex;align-items:center">
          <span>${personLabel} :</span><span class="dots"></span><span class="val">${d.person_name || ''}</span>
        </div>
        <div style="display:flex;align-items:center">
          <span>الموقع :</span><span class="dots"></span><span class="val">${d.location || ''}</span>
        </div>
      </div>
      <div class="info-row">
        <div style="display:flex;align-items:center">
          <span>الشركة :</span><span class="dots"></span><span class="val">${d.company || ''}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:35%">البيــان</th>
            <th style="width:13%">${countHeader}</th>
            <th style="width:13%">عدد القطع</th>
            <th style="width:17%">سعر الوحدة</th>
            <th style="width:17%">الاجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${(d.items || []).map(item => `
            <tr>
              <td style="text-align:right;padding-right:10px">${item.name}</td>
              <td>${item.count || ''}</td>
              <td>${item.pieces || ''}</td>
              <td>${item.unit_price ? item.unit_price.toLocaleString() : ''}</td>
              <td>${item.total ? item.total.toLocaleString() : ''}</td>
            </tr>
          `).join('')}
          ${Array(emptyRows).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}
        </tbody>
      </table>
      ${d.grand_total ? `<div style="text-align:left;font-size:16px;font-weight:800;color:#1a237e;padding:8px 12px;border-top:3px solid #1a237e">الإجمالي: ${d.grand_total.toLocaleString()} ج.م</div>` : ''}
    `
    return wrapHtml(title, d.date || today, body)
  }

  return wrapHtml('تقرير', today, '<p>لا توجد بيانات</p>')
}
