import Database from 'better-sqlite3'
import { IPC } from '../../shared/ipc-channels'
import type { TransactionFilters } from '../../shared/types'
import { GeminiService } from '../services/gemini.service'

function trackInventory(
  db: Database.Database,
  txnId: number | bigint,
  date: string,
  type: string,
  items: { name: string; quantity: number; unit: string; specs: string | null; unit_price: number | null; total_price: number | null }[]
) {
  if (!['شراء', 'بيع'].includes(type) || !items?.length) return

  const findItem = db.prepare('SELECT id, quantity, avg_cost FROM inventory_items WHERE name = ? AND unit = ?')
  const createItem = db.prepare('INSERT INTO inventory_items (name, unit, specs, quantity, avg_cost) VALUES (?, ?, ?, 0, 0)')
  const updateItem = db.prepare('UPDATE inventory_items SET quantity = ?, avg_cost = ?, updated_at = datetime(\'now\') WHERE id = ?')
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (inventory_item_id, transaction_id, type, quantity, unit_cost, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  for (const item of items) {
    if (!item.name.trim()) continue

    let inv = findItem.get(item.name, item.unit) as { id: number; quantity: number; avg_cost: number } | undefined
    if (!inv) {
      const r = createItem.run(item.name, item.unit, item.specs)
      inv = { id: Number(r.lastInsertRowid), quantity: 0, avg_cost: 0 }
    }

    const unitCost = item.unit_price ?? (item.total_price && item.quantity ? item.total_price / item.quantity : null)

    if (type === 'شراء') {
      const newQty = inv.quantity + item.quantity
      const newAvg = unitCost
        ? ((inv.avg_cost * inv.quantity) + (unitCost * item.quantity)) / newQty
        : inv.avg_cost
      updateItem.run(newQty, newAvg, inv.id)
      insertMovement.run(inv.id, txnId, 'in', item.quantity, unitCost, date)
    } else {
      const newQty = Math.max(0, inv.quantity - item.quantity)
      updateItem.run(newQty, inv.avg_cost, inv.id)
      insertMovement.run(inv.id, txnId, 'out', item.quantity, unitCost, date)
    }
  }
}

function deductBomMaterials(
  db: Database.Database,
  txnId: number | bigint,
  date: string,
  templateId: number,
  soldQuantity: number = 1
) {
  const bomItems = db.prepare('SELECT * FROM bom_template_items WHERE template_id = ?').all(templateId) as {
    material_name: string; material_unit: string; quantity: number
  }[]

  const findItem = db.prepare('SELECT id, quantity, avg_cost FROM inventory_items WHERE name = ? AND unit = ?')
  const findItemLike = db.prepare('SELECT id, quantity, avg_cost, name, unit FROM inventory_items WHERE name LIKE ?')
  const updateItem = db.prepare('UPDATE inventory_items SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?')
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (inventory_item_id, transaction_id, type, quantity, unit_cost, date, notes)
    VALUES (?, ?, 'out', ?, ?, ?, 'خصم تلقائي - وصفة منتج')
  `)

  for (const bom of bomItems) {
    const totalNeeded = bom.quantity * soldQuantity
    let inv = findItem.get(bom.material_name, bom.material_unit) as { id: number; quantity: number; avg_cost: number } | undefined

    if (!inv) {
      inv = findItemLike.get(`%${bom.material_name}%`) as { id: number; quantity: number; avg_cost: number } | undefined
    }

    if (!inv) continue

    const newQty = Math.max(0, inv.quantity - totalNeeded)
    updateItem.run(newQty, inv.id)
    insertMovement.run(inv.id, txnId, totalNeeded, inv.avg_cost, date)
  }
}

function smartDeductInventory(
  db: Database.Database,
  txnId: number | bigint,
  date: string,
  soldItems: { name: string; quantity: number; unit: string }[]
): Set<number> {
  const matched = new Set<number>()

  const allBom = db.prepare(`
    SELECT bt.id, bt.name, bti.material_name, bti.material_unit, bti.quantity
    FROM bom_templates bt
    JOIN bom_template_items bti ON bti.template_id = bt.id
  `).all() as { id: number; name: string; material_name: string; material_unit: string; quantity: number }[]

  if (allBom.length === 0) return matched

  const templateNames = [...new Set(allBom.map(b => b.id))].map(id => {
    const first = allBom.find(b => b.id === id)!
    return { id, name: first.name }
  })

  for (let i = 0; i < soldItems.length; i++) {
    const soldItem = soldItems[i]
    const itemName = soldItem.name

    const match = templateNames.find(t =>
      t.name === itemName ||
      t.name.includes(itemName) ||
      itemName.includes(t.name)
    )

    if (match) {
      deductBomMaterials(db, txnId, date, match.id, soldItem.quantity)
      matched.add(i)
    }
  }

  return matched
}

function reverseInventory(db: Database.Database, txnId: number) {
  const movements = db.prepare('SELECT * FROM inventory_movements WHERE transaction_id = ?').all(txnId) as {
    id: number; inventory_item_id: number; type: string; quantity: number; unit_cost: number | null
  }[]

  for (const m of movements) {
    const inv = db.prepare('SELECT id, quantity, avg_cost FROM inventory_items WHERE id = ?').get(m.inventory_item_id) as { id: number; quantity: number; avg_cost: number } | undefined
    if (!inv) continue

    if (m.type === 'in') {
      const newQty = Math.max(0, inv.quantity - m.quantity)
      db.prepare('UPDATE inventory_items SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, inv.id)
    } else {
      const newQty = inv.quantity + m.quantity
      db.prepare('UPDATE inventory_items SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, inv.id)
    }
  }

  db.prepare('DELETE FROM inventory_movements WHERE transaction_id = ?').run(txnId)
}

async function aiDeductInventory(
  db: Database.Database,
  gemini: GeminiService,
  txnId: number | bigint,
  date: string,
  soldItems: { name: string; quantity: number; unit: string; specs: string | null }[]
): Promise<boolean> {
  const inventoryRows = db.prepare(
    "SELECT name, quantity, unit, specs FROM inventory_items WHERE quantity > 0"
  ).all() as { name: string; quantity: number; unit: string; specs: string | null }[]

  if (inventoryRows.length === 0) return false

  const deductions = await gemini.calculateDeductions(soldItems, inventoryRows)
  if (deductions.length === 0) return false

  const findItem = db.prepare('SELECT id, quantity, avg_cost FROM inventory_items WHERE name = ? AND unit = ?')
  const findItemLike = db.prepare('SELECT id, quantity, avg_cost, name, unit FROM inventory_items WHERE name LIKE ? AND unit = ?')
  const updateItem = db.prepare("UPDATE inventory_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (inventory_item_id, transaction_id, type, quantity, unit_cost, date, notes)
    VALUES (?, ?, 'out', ?, ?, ?, 'خصم ذكي - AI')
  `)

  for (const d of deductions) {
    let inv = findItem.get(d.material_name, d.unit) as { id: number; quantity: number; avg_cost: number } | undefined
    if (!inv) {
      inv = findItemLike.get(`%${d.material_name}%`, d.unit) as { id: number; quantity: number; avg_cost: number } | undefined
    }
    if (!inv || inv.quantity <= 0) continue

    const deductQty = Math.min(d.quantity, inv.quantity)
    const newQty = inv.quantity - deductQty
    updateItem.run(newQty, inv.id)
    insertMovement.run(inv.id, txnId, deductQty, inv.avg_cost, date)
  }

  return true
}

export function registerDatabaseHandlers(ipcMain: Electron.IpcMain, db: Database.Database): void {
  const gemini = new GeminiService(db)
  // Transactions
  ipcMain.handle(IPC.TRANSACTIONS_LIST, (_e, filters: TransactionFilters) => {
    let query = `
      SELECT t.*, p.name as person_name
      FROM transactions t
      LEFT JOIN persons p ON t.person_id = p.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (filters?.type) {
      query += ' AND t.type = ?'
      params.push(filters.type)
    }
    if (filters?.person_id) {
      query += ' AND t.person_id = ?'
      params.push(filters.person_id)
    }
    if (filters?.date_from) {
      query += ' AND t.date >= ?'
      params.push(filters.date_from)
    }
    if (filters?.date_to) {
      query += ' AND t.date <= ?'
      params.push(filters.date_to)
    }
    if (filters?.expense_category) {
      query += ' AND t.expense_category = ?'
      params.push(filters.expense_category)
    }
    if (filters?.search) {
      query += ' AND (t.notes LIKE ? OR p.name LIKE ? OR t.original_text LIKE ?)'
      const s = `%${filters.search}%`
      params.push(s, s, s)
    }

    query += ' ORDER BY t.date DESC, t.id DESC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    const transactions = db.prepare(query).all(...params)

    for (const t of transactions as Array<{ id: number; items?: unknown[] }>) {
      t.items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(t.id)
    }

    return transactions
  })

  ipcMain.handle(IPC.TRANSACTIONS_GET, (_e, id: number) => {
    const t = db.prepare(`
      SELECT t.*, p.name as person_name
      FROM transactions t
      LEFT JOIN persons p ON t.person_id = p.id
      WHERE t.id = ?
    `).get(id) as { id: number; items?: unknown[] } | undefined

    if (t) {
      t.items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(t.id)
    }
    return t ?? null
  })

  ipcMain.handle(IPC.TRANSACTIONS_CREATE, async (_e, data: {
    date: string
    type: string
    person_id: number | null
    total_amount: number
    paid_amount: number
    remaining_amount: number
    payment_method: string
    expense_category: string | null
    input_method: string
    original_text: string | null
    ai_raw_response: string | null
    notes: string | null
    items: { name: string; quantity: number; unit: string; specs: string | null; unit_price: number | null; total_price: number | null }[]
    bom_template_id: number | null
    bom_selections?: { template_id: number; quantity: number }[]
  }) => {
    const validItems = (data.items || []).filter(i => i.name.trim())
    if (validItems.length > 0 && data.total_amount > 0) {
      const hasAnyPrice = validItems.some(i => i.unit_price || i.total_price)
      if (!hasAnyPrice) {
        const totalQty = validItems.reduce((s, i) => s + i.quantity, 0)
        if (validItems.length === 1) {
          validItems[0].total_price = data.total_amount
          validItems[0].unit_price = totalQty > 0 ? data.total_amount / totalQty : data.total_amount
        } else {
          const perItem = data.total_amount / validItems.length
          for (const item of validItems) {
            item.total_price = perItem
            item.unit_price = item.quantity > 0 ? perItem / item.quantity : perItem
          }
        }
      }
    }

    const createTransaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO transactions (date, type, person_id, total_amount, paid_amount, remaining_amount, payment_method, expense_category, input_method, original_text, ai_raw_response, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.date, data.type, data.person_id,
        data.total_amount, data.paid_amount, data.remaining_amount,
        data.payment_method, data.expense_category || null, data.input_method,
        data.original_text, data.ai_raw_response, data.notes
      )

      const txnId = result.lastInsertRowid

      if (validItems.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO transaction_items (transaction_id, name, quantity, unit, specs, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        for (const item of validItems) {
          insertItem.run(txnId, item.name, item.quantity, item.unit, item.specs, item.unit_price, item.total_price)
        }
      }

      if (data.person_id) {
        let balanceChange = 0
        if (data.type === 'بيع') balanceChange = data.remaining_amount
        else if (data.type === 'شراء') balanceChange = -data.remaining_amount
        else if (data.type === 'تحصيل') balanceChange = -data.total_amount
        else if (data.type === 'دفعة') balanceChange = data.total_amount

        if (balanceChange !== 0) {
          db.prepare('UPDATE persons SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(balanceChange, data.person_id)
        }
      }

      if (data.type === 'بيع' && data.bom_selections?.length) {
        for (const sel of data.bom_selections) {
          deductBomMaterials(db, txnId, data.date, sel.template_id, sel.quantity)
        }
      } else if (data.type === 'بيع' && data.bom_template_id) {
        const totalQty = validItems.reduce((s, i) => s + i.quantity, 0) || 1
        deductBomMaterials(db, txnId, data.date, data.bom_template_id, totalQty)
      } else if (data.type !== 'بيع') {
        trackInventory(db, txnId, data.date, data.type, validItems)
      }

      return txnId
    })

    const txnId = createTransaction()

    if (data.type === 'بيع' && !data.bom_template_id && !data.bom_selections?.length && validItems.length > 0) {
      const aiWorked = await aiDeductInventory(db, gemini, txnId, data.date, validItems)
      if (!aiWorked) {
        const bomMatched = smartDeductInventory(db, txnId, data.date, validItems)
        const unmatchedItems = validItems.filter((_, i) => !bomMatched.has(i))
        if (unmatchedItems.length > 0) {
          trackInventory(db, txnId, data.date, data.type, unmatchedItems)
        }
      }
    }

    return txnId
  })

  ipcMain.handle(IPC.TRANSACTIONS_UPDATE, async (_e, id: number, data: {
    date: string
    type: string
    person_id: number | null
    total_amount: number
    paid_amount: number
    remaining_amount: number
    payment_method: string
    expense_category: string | null
    notes: string | null
    items: { name: string; quantity: number; unit: string; specs: string | null; unit_price: number | null; total_price: number | null }[]
    bom_template_id: number | null
    bom_selections?: { template_id: number; quantity: number }[]
  }) => {
    const old = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as {
      person_id: number | null; type: string; remaining_amount: number; total_amount: number
    } | undefined
    if (!old) return null

    const validItems = (data.items || []).filter(i => i.name.trim())

    const updateTransaction = db.transaction(() => {
      if (old.person_id) {
        let reversal = 0
        if (old.type === 'بيع') reversal = -old.remaining_amount
        else if (old.type === 'شراء') reversal = old.remaining_amount
        else if (old.type === 'تحصيل') reversal = old.total_amount
        else if (old.type === 'دفعة') reversal = -old.total_amount
        if (reversal !== 0) {
          db.prepare('UPDATE persons SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(reversal, old.person_id)
        }
      }

      reverseInventory(db, id)

      db.prepare(`
        UPDATE transactions SET date=?, type=?, person_id=?, total_amount=?, paid_amount=?, remaining_amount=?, payment_method=?, expense_category=?, notes=?, updated_at=datetime(\'now\')
        WHERE id=?
      `).run(data.date, data.type, data.person_id, data.total_amount, data.paid_amount, data.remaining_amount, data.payment_method, data.expense_category || null, data.notes, id)

      db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(id)
      if (validItems.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO transaction_items (transaction_id, name, quantity, unit, specs, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        for (const item of validItems) {
          insertItem.run(id, item.name, item.quantity, item.unit, item.specs, item.unit_price, item.total_price)
        }
      }

      if (data.person_id) {
        let balanceChange = 0
        if (data.type === 'بيع') balanceChange = data.remaining_amount
        else if (data.type === 'شراء') balanceChange = -data.remaining_amount
        else if (data.type === 'تحصيل') balanceChange = -data.total_amount
        else if (data.type === 'دفعة') balanceChange = data.total_amount
        if (balanceChange !== 0) {
          db.prepare('UPDATE persons SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(balanceChange, data.person_id)
        }
      }

      if (data.type === 'بيع' && data.bom_selections?.length) {
        for (const sel of data.bom_selections) {
          deductBomMaterials(db, id, data.date, sel.template_id, sel.quantity)
        }
      } else if (data.type === 'بيع' && data.bom_template_id) {
        const totalQty = validItems.reduce((s, i) => s + i.quantity, 0) || 1
        deductBomMaterials(db, id, data.date, data.bom_template_id, totalQty)
      } else if (data.type !== 'بيع') {
        trackInventory(db, id, data.date, data.type, validItems)
      }

      return id
    })

    updateTransaction()

    if (data.type === 'بيع' && !data.bom_template_id && !data.bom_selections?.length && validItems.length > 0) {
      const aiWorked = await aiDeductInventory(db, gemini, id, data.date, validItems)
      if (!aiWorked) {
        const bomMatched = smartDeductInventory(db, id, data.date, validItems)
        const unmatchedItems = validItems.filter((_, i) => !bomMatched.has(i))
        if (unmatchedItems.length > 0) {
          trackInventory(db, id, data.date, data.type, unmatchedItems)
        }
      }
    }

    return id
  })

  ipcMain.handle(IPC.TRANSACTIONS_DELETE, (_e, id: number) => {
    const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as {
      person_id: number | null; type: string; remaining_amount: number; total_amount: number
    } | undefined
    if (!t) return false

    const deleteTransaction = db.transaction(() => {
      if (t.person_id) {
        let reversal = 0
        if (t.type === 'بيع') reversal = -t.remaining_amount
        else if (t.type === 'شراء') reversal = t.remaining_amount
        else if (t.type === 'تحصيل') reversal = t.total_amount
        else if (t.type === 'دفعة') reversal = -t.total_amount

        if (reversal !== 0) {
          db.prepare('UPDATE persons SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(reversal, t.person_id)
        }
      }

      reverseInventory(db, id)
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    })

    deleteTransaction()
    return true
  })

  // Persons
  ipcMain.handle(IPC.PERSONS_LIST, () => {
    return db.prepare('SELECT * FROM persons ORDER BY name').all()
  })

  ipcMain.handle(IPC.PERSONS_GET, (_e, id: number) => {
    return db.prepare('SELECT * FROM persons WHERE id = ?').get(id) ?? null
  })

  ipcMain.handle(IPC.PERSONS_CREATE, (_e, data: { name: string; type: string; phone: string | null; notes: string | null }) => {
    const trimmed = data.name.trim()
    const existing = db.prepare('SELECT id FROM persons WHERE TRIM(name) = ?').get(trimmed) as { id: number } | undefined
    if (existing) return existing.id

    const result = db.prepare('INSERT INTO persons (name, type, phone, notes) VALUES (?, ?, ?, ?)')
      .run(trimmed, data.type, data.phone, data.notes)
    return result.lastInsertRowid
  })

  ipcMain.handle(IPC.PERSONS_UPDATE, (_e, id: number, data: { name?: string; type?: string; phone?: string | null; notes?: string | null }) => {
    const fields: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.type !== undefined) { fields.push('type = ?'); params.push(data.type) }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone) }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes) }
    fields.push('updated_at = datetime(\'now\')')
    params.push(id)

    db.prepare(`UPDATE persons SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    return true
  })

  ipcMain.handle(IPC.PERSONS_SEARCH, (_e, query: string) => {
    return db.prepare('SELECT * FROM persons WHERE name LIKE ? ORDER BY name LIMIT 20')
      .all(`%${query}%`)
  })

  ipcMain.handle(IPC.PERSONS_DELETE, (_e, id: number) => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(id)
    if (!person) return false

    const deletePerson = db.transaction(() => {
      const txns = db.prepare('SELECT id, type, person_id, remaining_amount, total_amount FROM transactions WHERE person_id = ?').all(id) as {
        id: number; type: string; person_id: number; remaining_amount: number; total_amount: number
      }[]

      for (const t of txns) {
        reverseInventory(db, t.id)
        db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(t.id)
        db.prepare('DELETE FROM transactions WHERE id = ?').run(t.id)
      }

      db.prepare('DELETE FROM persons WHERE id = ?').run(id)
    })

    deletePerson()
    return true
  })

  // Inventory
  ipcMain.handle(IPC.INVENTORY_LIST, () => {
    return db.prepare(`
      SELECT i.*, c.name as category_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      ORDER BY c.name, i.name
    `).all()
  })

  ipcMain.handle(IPC.INVENTORY_GET, (_e, id: number) => {
    return db.prepare(`
      SELECT i.*, c.name as category_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      WHERE i.id = ?
    `).get(id) ?? null
  })

  ipcMain.handle(IPC.INVENTORY_MOVEMENTS, (_e, itemId: number) => {
    return db.prepare(`
      SELECT m.*, t.type as transaction_type, t.date as txn_date
      FROM inventory_movements m
      LEFT JOIN transactions t ON m.transaction_id = t.id
      WHERE m.inventory_item_id = ?
      ORDER BY m.date DESC, m.id DESC
    `).all(itemId)
  })

  ipcMain.handle(IPC.INVENTORY_CREATE, (_e, data: { name: string; unit: string; specs: string | null; category_id: number | null; min_quantity: number; notes: string | null }) => {
    const result = db.prepare('INSERT INTO inventory_items (name, unit, specs, category_id, min_quantity, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(data.name, data.unit, data.specs, data.category_id, data.min_quantity, data.notes)
    return result.lastInsertRowid
  })

  ipcMain.handle(IPC.INVENTORY_UPDATE, (_e, id: number, data: { name?: string; unit?: string; specs?: string | null; category_id?: number | null; min_quantity?: number; avg_cost?: number; notes?: string | null }) => {
    const fields: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.unit !== undefined) { fields.push('unit = ?'); params.push(data.unit) }
    if (data.specs !== undefined) { fields.push('specs = ?'); params.push(data.specs) }
    if (data.category_id !== undefined) { fields.push('category_id = ?'); params.push(data.category_id) }
    if (data.min_quantity !== undefined) { fields.push('min_quantity = ?'); params.push(data.min_quantity) }
    if (data.avg_cost !== undefined) { fields.push('avg_cost = ?'); params.push(data.avg_cost) }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes) }
    fields.push('updated_at = datetime(\'now\')')
    params.push(id)
    db.prepare(`UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    return true
  })

  ipcMain.handle(IPC.INVENTORY_CATEGORIES, () => {
    return db.prepare('SELECT * FROM inventory_categories ORDER BY name').all()
  })

  ipcMain.handle(IPC.INVENTORY_ADD_STOCK, (_e, items: { name: string; quantity: number; unit: string; specs: string | null }[]) => {
    if (!items?.length) return []

    const findItem = db.prepare('SELECT id, quantity, avg_cost FROM inventory_items WHERE name = ? AND unit = ?')
    const findItemLike = db.prepare('SELECT id, quantity, avg_cost, name, unit FROM inventory_items WHERE name LIKE ? AND unit = ?')
    const createItem = db.prepare('INSERT INTO inventory_items (name, unit, specs, quantity, avg_cost) VALUES (?, ?, ?, 0, 0)')
    const updateItem = db.prepare("UPDATE inventory_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (inventory_item_id, transaction_id, type, quantity, unit_cost, date, notes)
      VALUES (?, NULL, 'in', ?, 0, date('now'), 'إضافة مخزون يدوية')
    `)

    const addStock = db.transaction(() => {
      const results: { name: string; added: number }[] = []
      for (const item of items) {
        if (!item.name?.trim() || !item.quantity || item.quantity <= 0) continue

        let inv = findItem.get(item.name, item.unit) as { id: number; quantity: number; avg_cost: number } | undefined
        if (!inv) {
          const like = findItemLike.get(`%${item.name}%`, item.unit) as { id: number; quantity: number; avg_cost: number } | undefined
          if (like) inv = like
        }

        if (!inv) {
          const result = createItem.run(item.name, item.unit, item.specs)
          inv = { id: Number(result.lastInsertRowid), quantity: 0, avg_cost: 0 }
        }

        const newQty = inv.quantity + item.quantity
        updateItem.run(newQty, inv.id)
        insertMovement.run(inv.id, item.quantity)
        results.push({ name: item.name, added: item.quantity })
      }
      return results
    })

    return addStock()
  })

  ipcMain.handle(IPC.INVENTORY_DELETE, (_e, id: number) => {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id)
    if (!item) return false

    const deleteItem = db.transaction(() => {
      db.prepare('DELETE FROM inventory_movements WHERE inventory_item_id = ?').run(id)
      db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id)
    })

    deleteItem()
    return true
  })

  // Reports
  ipcMain.handle(IPC.REPORTS_BALANCE_SHEET, () => {
    const cashFlow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('بيع','تحصيل','إيراد') THEN paid_amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type IN ('شراء','دفعة','مصروف') THEN paid_amount ELSE 0 END), 0) as cash
      FROM transactions
    `).get() as { cash: number }

    const receivables = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM persons WHERE balance > 0").get() as { total: number }
    const payables = db.prepare("SELECT COALESCE(SUM(ABS(balance)), 0) as total FROM persons WHERE balance < 0").get() as { total: number }
    const inventoryValue = db.prepare("SELECT COALESCE(SUM(quantity * avg_cost), 0) as total FROM inventory_items").get() as { total: number }

    return {
      assets: {
        cash: cashFlow.cash,
        receivables: receivables.total,
        inventory: inventoryValue.total,
        total: cashFlow.cash + receivables.total + inventoryValue.total,
      },
      liabilities: {
        payables: payables.total,
        total: payables.total,
      },
      equity: cashFlow.cash + receivables.total + inventoryValue.total - payables.total,
    }
  })

  ipcMain.handle(IPC.REPORTS_INCOME_STATEMENT, (_e, dateFrom?: string, dateTo?: string) => {
    let where = ''
    const params: unknown[] = []
    if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom) }
    if (dateTo) { where += ' AND date <= ?'; params.push(dateTo) }

    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'بيع' THEN total_amount ELSE 0 END), 0) as sales,
        COALESCE(SUM(CASE WHEN type = 'إيراد' THEN total_amount ELSE 0 END), 0) as other_income,
        COALESCE(SUM(CASE WHEN type = 'شراء' THEN total_amount ELSE 0 END), 0) as cogs,
        COALESCE(SUM(CASE WHEN type = 'مصروف' THEN total_amount ELSE 0 END), 0) as expenses
      FROM transactions WHERE 1=1 ${where}
    `).get(...params) as { sales: number; other_income: number; cogs: number; expenses: number }

    const expenseBreakdown = db.prepare(`
      SELECT COALESCE(expense_category, notes, 'أخرى') as category, SUM(total_amount) as total
      FROM transactions
      WHERE type = 'مصروف' ${where}
      GROUP BY category
      ORDER BY total DESC
    `).all(...params)

    return {
      revenue: row.sales + row.other_income,
      sales: row.sales,
      other_income: row.other_income,
      cogs: row.cogs,
      gross_profit: row.sales - row.cogs,
      expenses: row.expenses,
      expense_breakdown: expenseBreakdown,
      net_profit: row.sales + row.other_income - row.cogs - row.expenses,
    }
  })

  ipcMain.handle(IPC.REPORTS_ACCOUNT_STATEMENT, (_e, personId: number) => {
    const txns = db.prepare(`
      SELECT t.*, p.name as person_name
      FROM transactions t
      LEFT JOIN persons p ON t.person_id = p.id
      WHERE t.person_id = ?
      ORDER BY t.date ASC, t.id ASC
    `).all(personId)

    for (const t of txns as Array<{ id: number; items?: unknown[] }>) {
      t.items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(t.id)
    }

    return txns
  })

  ipcMain.handle(IPC.REPORTS_RECEIVABLES_SUMMARY, () => {
    return db.prepare(`
      SELECT
        p.id as person_id,
        p.name as person_name,
        p.balance as outstanding,
        COALESCE(SUM(CASE WHEN t.type = 'بيع' THEN t.total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN t.type = 'تحصيل' THEN t.total_amount ELSE 0 END), 0) as total_collected
      FROM persons p
      LEFT JOIN transactions t ON t.person_id = p.id
      WHERE p.balance != 0
      GROUP BY p.id
      ORDER BY ABS(p.balance) DESC
    `).all()
  })

  ipcMain.handle(IPC.REPORTS_PAYABLES_SUMMARY, () => {
    return db.prepare(`
      SELECT
        p.id as person_id,
        p.name as person_name,
        ABS(p.balance) as outstanding,
        COALESCE(SUM(CASE WHEN t.type = 'شراء' THEN t.total_amount ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN t.type = 'دفعة' THEN t.total_amount ELSE 0 END), 0) as total_paid
      FROM persons p
      LEFT JOIN transactions t ON t.person_id = p.id
      WHERE p.balance < 0
      GROUP BY p.id
      ORDER BY ABS(p.balance) DESC
    `).all()
  })

  ipcMain.handle(IPC.REPORTS_EXPENSES_SUMMARY, (_e, dateFrom?: string, dateTo?: string) => {
    let where = "WHERE type = 'مصروف'"
    const params: unknown[] = []
    if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom) }
    if (dateTo) { where += ' AND date <= ?'; params.push(dateTo) }

    return db.prepare(`
      SELECT
        COALESCE(expense_category, 'أخرى') as category,
        SUM(total_amount) as total,
        COUNT(*) as count
      FROM transactions
      ${where}
      GROUP BY category
      ORDER BY total DESC
    `).all(...params)
  })

  ipcMain.handle(IPC.REPORTS_DASHBOARD_STATS, () => {
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'بيع' THEN total_amount ELSE 0 END), 0) as sales,
        COALESCE(SUM(CASE WHEN type = 'شراء' THEN total_amount ELSE 0 END), 0) as purchases,
        COALESCE(SUM(CASE WHEN type = 'مصروف' THEN total_amount ELSE 0 END), 0) as expenses,
        COALESCE(SUM(CASE WHEN type IN ('بيع','تحصيل','إيراد') THEN paid_amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type IN ('شراء','دفعة','مصروف') THEN paid_amount ELSE 0 END), 0) as cash
      FROM transactions
    `).get() as { sales: number; purchases: number; expenses: number; cash: number }

    const inventoryValue = db.prepare("SELECT COALESCE(SUM(quantity * avg_cost), 0) as total FROM inventory_items").get() as { total: number }
    const receivables = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM persons WHERE balance > 0").get() as { total: number }

    return {
      sales: row.sales,
      purchases: row.purchases,
      expenses: row.expenses,
      cash: row.cash,
      inventory: inventoryValue.total,
      receivables: receivables.total,
    }
  })

  // BOM Templates
  ipcMain.handle(IPC.BOM_LIST, () => {
    const templates = db.prepare('SELECT * FROM bom_templates ORDER BY name').all() as Array<{ id: number; items?: unknown[] }>
    for (const t of templates) {
      t.items = db.prepare('SELECT * FROM bom_template_items WHERE template_id = ?').all(t.id)
    }
    return templates
  })

  ipcMain.handle(IPC.BOM_GET, (_e, id: number) => {
    const t = db.prepare('SELECT * FROM bom_templates WHERE id = ?').get(id) as { id: number; items?: unknown[] } | undefined
    if (t) {
      t.items = db.prepare('SELECT * FROM bom_template_items WHERE template_id = ?').all(t.id)
    }
    return t ?? null
  })

  ipcMain.handle(IPC.BOM_CREATE, (_e, data: {
    name: string
    notes: string | null
    items: { material_name: string; material_unit: string; quantity: number; notes: string | null }[]
  }) => {
    const create = db.transaction(() => {
      const result = db.prepare('INSERT INTO bom_templates (name, notes) VALUES (?, ?)').run(data.name, data.notes)
      const templateId = result.lastInsertRowid
      if (data.items?.length) {
        const insert = db.prepare('INSERT INTO bom_template_items (template_id, material_name, material_unit, quantity, notes) VALUES (?, ?, ?, ?, ?)')
        for (const item of data.items) {
          insert.run(templateId, item.material_name, item.material_unit, item.quantity, item.notes)
        }
      }
      return templateId
    })
    return create()
  })

  ipcMain.handle(IPC.BOM_UPDATE, (_e, id: number, data: {
    name: string
    notes: string | null
    items: { material_name: string; material_unit: string; quantity: number; notes: string | null }[]
  }) => {
    const update = db.transaction(() => {
      db.prepare('UPDATE bom_templates SET name = ?, notes = ? WHERE id = ?').run(data.name, data.notes, id)
      db.prepare('DELETE FROM bom_template_items WHERE template_id = ?').run(id)
      if (data.items?.length) {
        const insert = db.prepare('INSERT INTO bom_template_items (template_id, material_name, material_unit, quantity, notes) VALUES (?, ?, ?, ?, ?)')
        for (const item of data.items) {
          insert.run(id, item.material_name, item.material_unit, item.quantity, item.notes)
        }
      }
    })
    update()
    return true
  })

  ipcMain.handle(IPC.BOM_DELETE, (_e, id: number) => {
    db.prepare('DELETE FROM bom_templates WHERE id = ?').run(id)
    return true
  })
}
