import { useState, useEffect } from 'react'
import type { Person } from '../../../shared/types'

interface Props {
  onSelect: (person: Person | null) => void
  selectedPerson: Person | null
  transactionType?: string
}

export default function PersonSelector({ onSelect, selectedPerson, transactionType }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (selectedPerson) {
      setQuery(selectedPerson.name)
    }
  }, [selectedPerson])

  const handleSearch = async (value: string) => {
    setQuery(value)
    if (value.length >= 1) {
      const persons = await window.api.persons.search(value)
      setResults(persons as Person[])
      setIsOpen(true)
    } else {
      setResults([])
      setIsOpen(false)
      onSelect(null)
    }
  }

  const handleSelect = (person: Person) => {
    onSelect(person)
    setQuery(person.name)
    setIsOpen(false)
  }

  const getAutoType = (): 'client' | 'supplier' | 'both' | 'contractor' => {
    if (transactionType === 'بيع' || transactionType === 'تحصيل') return 'client'
    if (transactionType === 'شراء' || transactionType === 'دفعة') return 'supplier'
    if (transactionType === 'مصروف') return 'contractor'
    return 'both'
  }

  const handleCreate = async () => {
    if (!query.trim()) return
    setIsCreating(true)
    const searchAgain = await window.api.persons.search(query.trim()) as Person[]
    const match = searchAgain.find((p) => p.name === query.trim())
    if (match) {
      onSelect(match)
      setIsOpen(false)
      setIsCreating(false)
      return
    }

    const id = await window.api.persons.create({
      name: query.trim(),
      type: getAutoType(),
      phone: null,
      notes: null,
    })
    const person: Person = {
      id: id as number,
      name: query.trim(),
      type: getAutoType(),
      phone: null,
      notes: null,
      balance: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onSelect(person)
    setIsOpen(false)
    setIsCreating(false)
  }

  const handleBlur = async () => {
    setTimeout(async () => {
      setIsOpen(false)
      const trimmed = query.trim()
      if (!trimmed) return
      if (selectedPerson && selectedPerson.name === trimmed) return

      const freshResults = await window.api.persons.search(trimmed) as Person[]
      const exact = freshResults.find((p) => p.name === trimmed)
      if (exact) {
        handleSelect(exact)
        return
      }
      const fuzzy = freshResults.find((p) => p.name.includes(trimmed) || trimmed.includes(p.name))
      if (fuzzy) {
        handleSelect(fuzzy)
      } else {
        await handleCreate()
      }
    }, 200)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => query.length >= 1 && setIsOpen(true)}
        onBlur={handleBlur}
        placeholder="اكتب اسم العميل أو المورد..."
      />
      {isOpen && (
        <div style={styles.dropdown}>
          {results.length > 0 ? (
            results.map((p) => (
              <div
                key={p.id}
                style={styles.option}
                onMouseDown={() => handleSelect(p)}
              >
                <span>{p.name}</span>
                <span style={styles.balance}>
                  {p.balance > 0 ? `ليه ${p.balance.toLocaleString()}` : p.balance < 0 ? `عليه ${Math.abs(p.balance).toLocaleString()}` : ''}
                </span>
              </div>
            ))
          ) : null}
          <div
            style={{ ...styles.option, color: 'var(--accent)', fontWeight: 600 }}
            onMouseDown={handleCreate}
          >
            {isCreating ? 'جاري الإضافة...' : `+ إضافة "${query}" كجديد`}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    left: 0,
    marginTop: 4,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    maxHeight: 240,
    overflowY: 'auto',
  },
  option: {
    padding: '10px 16px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
    transition: 'background 0.15s',
  },
  balance: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
}
