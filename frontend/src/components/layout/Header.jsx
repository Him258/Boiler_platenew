import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { Bell, Search, UserCircle, ChevronDown, Plus, LogOut, Settings, User, Menu, Globe } from "lucide-react"
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"
import { Button } from "@/components/ui/Button"
import { NotificationDrawer } from "./NotificationDrawer"
import { useAuth } from "@/contexts/AuthContext"
import { initialBranches } from "@/core/organization/Branches"

export function Header({ setMobileMenuOpen }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4 sm:px-6 dark:bg-slate-950 dark:border-slate-800">
        <div className="flex flex-1 items-center space-x-2 sm:space-x-4">
          <button
            type="button"
            className="md:hidden -ml-2 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 rounded-md"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <Dropdown
            align="left"
            trigger={
              <button className="flex items-center space-x-1 sm:space-x-2 rounded-md hover:bg-slate-50 px-1 sm:px-2 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white dark:hover:bg-slate-900">
                <span className="truncate max-w-[100px] sm:max-w-none">Kiaan Technologies</span>
                <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
              </button>
            }
          >
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenants</div>
            <DropdownItem onClick={() => navigate('/multitenant/tenants')}>Kiaan Technologies</DropdownItem>
            <DropdownItem onClick={() => navigate('/multitenant/tenants')}>Acme Corp</DropdownItem>
            <div className="border-t border-slate-100 my-1 dark:border-slate-800"></div>
            <DropdownItem icon={Plus} onClick={() => navigate('/multitenant/tenants')}>Create Tenant</DropdownItem>
          </Dropdown>

          <Dropdown
            align="left"
            trigger={
              <button className="hidden sm:flex items-center space-x-2 rounded-md hover:bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                <span>Delhi Branch</span>
                <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
              </button>
            }
          >
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Branches</div>
            {initialBranches.map(branch => (
              <DropdownItem key={branch.id} onClick={() => navigate('/organization/branches')}>{branch.c1}</DropdownItem>
            ))}
            <div className="border-t border-slate-100 my-1 dark:border-slate-800"></div>
            <DropdownItem icon={Plus} onClick={() => navigate('/organization/branches')}>Create Branch</DropdownItem>
          </Dropdown>

          <div className="w-full max-w-sm relative hidden lg:block ml-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <div 
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-4 flex items-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors dark:text-white"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            >
              Search... <span className="ml-auto text-xs font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border dark:border-slate-700">Ctrl K</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Dropdown
            trigger={
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Plus className="mr-2 h-4 w-4" /> Quick Action
              </Button>
            }
          >
            <DropdownItem onClick={() => navigate('/access/users')}>Create User</DropdownItem>
            <DropdownItem onClick={() => navigate('/access/roles')}>Create Role</DropdownItem>
            <DropdownItem onClick={() => navigate('/multitenant/tenants')}>Create Tenant</DropdownItem>
          </Dropdown>

          <Dropdown
            trigger={
              <button className="flex items-center space-x-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                <Globe className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline-block">EN</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            }
          >
            <DropdownItem>English</DropdownItem>
            <DropdownItem>Hindi (हिंदी)</DropdownItem>
            <DropdownItem>Arabic (العربية)</DropdownItem>
          </Dropdown>

          <button 
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
          >
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950"></span>
            <Bell className="h-5 w-5" />
          </button>

          <Dropdown
            trigger={
              <button className="flex items-center space-x-2 rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <UserCircle className="h-8 w-8 text-slate-400" />
              </button>
            }
          >
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name || 'Guest'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'Not logged in'}</p>
              {user?.role && <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">{user.role}</span>}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800"></div>
            <DropdownItem icon={User} onClick={() => navigate('/settings')}>My Profile</DropdownItem>
            <DropdownItem icon={Settings} onClick={() => navigate('/settings')}>Preferences</DropdownItem>
            <div className="border-t border-slate-100 dark:border-slate-800"></div>
            <DropdownItem icon={LogOut} onClick={handleLogout}>Logout</DropdownItem>
          </Dropdown>
        </div>
      </header>

      <NotificationDrawer open={notificationsOpen} setOpen={setNotificationsOpen} />
    </>
  )
}

