import { X } from 'lucide-react'

interface ItemData {
  name: string
  quantity: number
  unit: string
  specs: string
}

interface Props {
  item: ItemData
  onChange: (item: ItemData) => void
  onRemove: () => void
  canRemove: boolean
}

const units = ['لوح', 'متر', 'قطعة', 'عدد', 'كيلو', 'طن', 'متر مربع', 'متر مكعب']

export default function ItemRow({ item, onChange, onRemove, canRemove }: Props) {
  const update = (field: keyof ItemData, value: string | number) => {
    onChange({ ...item, [field]: value })
  }

  return (
    <div style={styles.row}>
      <div style={{ flex: 2 }}>
        <input
          className="input"
          value={item.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="اسم الصنف"
        />
      </div>
      <div style={{ flex: 1 }}>
        <input
          className="input"
          type="number"
          value={item.quantity || ''}
          onChange={(e) => update('quantity', parseFloat(e.target.value) || 0)}
          placeholder="الكمية"
          min="0"
          step="0.5"
        />
      </div>
      <div style={{ flex: 1 }}>
        <select
          className="select"
          value={item.unit}
          onChange={(e) => update('unit', e.target.value)}
        >
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1.5 }}>
        <input
          className="input"
          value={item.specs}
          onChange={(e) => update('specs', e.target.value)}
          placeholder="المواصفات (اختياري)"
        />
      </div>
      {canRemove && (
        <button
          onClick={onRemove}
          style={styles.removeBtn}
          title="حذف الصنف"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--danger)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}
