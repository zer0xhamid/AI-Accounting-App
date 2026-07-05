import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  BarChart3,
  MessageSquareText,
  Settings,
  Sparkles,
  Banknote,
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { path: '/ai-input', label: 'الإدخال الذكي', icon: Sparkles },
  { path: '/transactions', label: 'العمليات', icon: Receipt },
  { path: '/persons', label: 'العملاء والموردين', icon: Users },
  { path: '/expenses', label: 'المصروفات', icon: Banknote },
  { path: '/inventory', label: 'المخزن', icon: Package },
  { path: '/reports', label: 'التقارير', icon: BarChart3 },
  { path: '/chat', label: 'اسأل الذكاء', icon: MessageSquareText },
  { path: '/settings', label: 'الإعدادات', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <Sparkles size={24} color="#6366f1" />
        </div>
        <div>
          <h1 style={styles.logoTitle}>المحاسب الذكي</h1>
          <p style={styles.logoSubtitle}>نظام محاسبة بالذكاء الاصطناعي</p>
        </div>
      </div>

      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        <p style={styles.ownerName}>أحمد المغاوري لطيف</p>
        <p style={styles.version}>الإصدار 1.0.0</p>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    height: '100vh',
    background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
    borderLeft: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '24px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(99, 102, 241, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  logoSubtitle: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 10,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  navItemActive: {
    background: 'linear-gradient(90deg, var(--bg-active), rgba(99, 102, 241, 0.08))',
    color: 'var(--accent)',
    fontWeight: 600,
    borderRight: '3px solid var(--accent)',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border-color)',
    textAlign: 'center' as const,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
    marginBottom: 4,
  },
  version: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
  },
}
