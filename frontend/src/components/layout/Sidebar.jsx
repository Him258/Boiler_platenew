import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { 
  LayoutDashboard, Users, Settings, Building2, ShieldCheck, 
  CreditCard, Bell, FileBox, ActivitySquare, Bot, MessageSquare, 
  BarChart3, Database, ChevronDown, ChevronRight, Component, AlertTriangle,
  Folder
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export const navigation = [
  // Step 1: Dashboard — First thing after login
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: Folder },

  // Step 2: Multi Tenant — Setup organizations/companies first
  { 
    name: 'Multi Tenant', icon: Database,
    children: [
      { name: 'Tenants', href: '/multitenant/tenants' },
      { name: 'Domains', href: '/multitenant/domains' },
      { name: 'Branding', href: '/multitenant/branding' },
    ]
  },

  // Step 3: Access Control — Users → Roles → Permissions
  { 
    name: 'Access Control', icon: Users,
    children: [
      { name: 'Users',       href: '/access/users' },
      { name: 'Roles',       href: '/access/roles' },
      { name: 'Permissions', href: '/access/permissions' },
    ]
  },

  // Step 4: Organization — Structure under each tenant
  { 
    name: 'Tenant Structure', icon: Building2,
    children: [
      { name: 'Organizations', href: '/organization' },
      { name: 'Branches', href: '/organization/branches' },
      { name: 'Departments', href: '/organization/departments' },
      { name: 'Teams', href: '/organization/teams' },
    ]
  },

  // Step 5: Identity — Security & session management
  { 
    name: 'Identity', icon: ShieldCheck,
    children: [
      { name: 'Authentication', href: '/identity/auth' },
      { name: 'Sessions', href: '/identity/sessions' },
      { name: 'Devices', href: '/identity/devices' },
      { name: 'Login History', href: '/identity/logins' },
    ]
  },

  // Step 6: Subscription — Monetization & plans
  { 
    name: 'Subscription', icon: CreditCard,
    children: [
      { name: 'Plans', href: '/subscription/plans' },
      { name: 'Features', href: '/subscription/features' },
      { name: 'Coupons', href: '/subscription/coupons' },
      { name: 'Billing', href: '/subscription/billing' },
      { name: 'Invoices', href: '/subscription/invoices' },
    ]
  },

  // Step 7: Notifications — Communication channels & templates
  { 
    name: 'Notifications', icon: Bell,
    children: [
      { name: 'Templates', href: '/notifications/email-templates' },
      { name: 'Logs', href: '/notifications/logs' },
    ]
  },

  // Step 8: Storage — File management
  { 
    name: 'Storage', icon: FileBox,
    children: [
      { name: 'Files', href: '/storage/files' },
      { name: 'Media', href: '/storage/media' },
    ]
  },

  // Step 9: AI Platform — Intelligence engine
  { 
    name: 'AI Platform', icon: Bot,
    children: [
      { name: 'Providers', href: '/ai/providers' },
      { name: 'Prompt Library', href: '/ai/templates' },
      { name: 'Knowledge Base', href: '/ai/knowledge' },
    ]
  },

  // Step 10: Workflow — Automation engine
  { 
    name: 'Workflow', icon: ActivitySquare,
    children: [
      { name: 'Workflows', href: '/workflow/builder' },
      { name: 'Automations', href: '/workflow/automations' },
    ]
  },

  // Step 11: API — External integrations
  { 
    name: 'API', icon: Database,
    children: [
      { name: 'API Keys', href: '/api/keys' },
      { name: 'Webhooks', href: '/api/webhooks' },
    ]
  },

  // Step 12: Reports & Analytics
  { 
    name: 'Reports', icon: BarChart3,
    children: [
      { name: 'Report Builder', href: '/reports/builder' },
    ]
  },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },

  // Step 13: Settings
  { name: 'Settings', href: '/settings', icon: Settings },

  // Step 14: System — Admin tools & logs
  { 
    name: 'System', icon: Settings,
    children: [
      { name: 'Audit', href: '/system/audit' },
    ]
  },

  // Step 15: Super Admin — Highest level control
  { name: 'Super Admin', href: '/superadmin', icon: ShieldCheck },
]

const rolePermissions = {
  'Super Admin': ['Dashboard', 'Projects', 'Identity', 'Tenant Structure', 'Access Control', 'Multi Tenant', 'Subscription', 'Notifications', 'Storage', 'AI Platform', 'Workflow', 'Reports', 'API', 'Settings', 'Analytics', 'System', 'Super Admin'],
  'Sales Agent': ['Dashboard', 'Settings'],
  'Support Staff': ['Dashboard', 'Storage', 'Settings']
}

function NavItem({ item, isActive, onLinkClick }) {
  const [open, setOpen] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <div className="flex items-center">
            <item.icon className="mr-3 h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-primary" />
            {item.name}
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary" />
          )}
        </button>
        {open && (
          <div className="mt-1 space-y-1 pl-10">
            {item.children.map((child) => (
              <Link
                key={child.name}
                to={child.href}
                onClick={onLinkClick}
                className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-white"
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      to={item.href}
      onClick={onLinkClick}
      className={`
        group flex items-center rounded-md px-3 py-2 text-sm font-medium
        ${isActive 
          ? 'bg-slate-100 text-primary dark:bg-slate-800 dark:text-white' 
          : 'text-slate-700 hover:bg-slate-50 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }
      `}
    >
      <item.icon
        className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`}
        aria-hidden="true"
      />
      {item.name}
    </Link>
  )
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen }) {
  const location = useLocation()
  const { user } = useAuth()
  
  const userRole = user?.role || 'Super Admin'
  const permittedMenus = rolePermissions[userRole] || rolePermissions['Super Admin']

  const filteredNavigation = navigation.filter(item => permittedMenus.includes(item.name))

  const handleLinkClick = () => {
    if (setMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }

  const SidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-6 dark:border-slate-800">
        <span className="text-xl font-bold tracking-tight text-primary">Kiaan Core</span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-3 py-4">
          {filteredNavigation.map((item) => (
            <div key={item.name}>
              <NavItem 
                item={item} 
                isActive={location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))}
                onLinkClick={handleLinkClick}
              />
            </div>
          ))}
        </nav>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/80 transition-opacity backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex w-full max-w-xs flex-1 transform transition-transform duration-300 ease-in-out">
            <div className="absolute right-0 top-0 -mr-12 pt-4">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full w-64 flex-col border-r bg-white dark:bg-slate-950 dark:border-slate-800">
        {SidebarContent}
      </div>
    </>
  )
}

