import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { 
  Users, Key, Shield, Mail, Activity, Eye, EyeOff, Check, Copy,
  Search, ShieldAlert, AlertTriangle, Play, Settings, RefreshCw, Trash2, 
  UserX, RotateCcw, Info, Database, Compass, Lock, CheckCircle, ExternalLink
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { StatCard } from '@/components/ui/StatCard';

const PROVIDER_LIST = [
  { id: 'local', name: 'Local Database (Email/Password)' },
  { id: 'google', name: 'Google OAuth' },
  { id: 'github', name: 'GitHub OAuth' },
  { id: 'microsoft', name: 'Microsoft Entra ID' },
  { id: 'discord', name: 'Discord Login' },
  { id: 'apple', name: 'Apple ID' },
  { id: 'twitter', name: 'Twitter/X OAuth' },
  { id: 'linkedin', name: 'LinkedIn Login' }
];

const TEMPLATE_LIST = [
  { id: 'signup_confirmation', name: 'Signup Confirmation' },
  { id: 'magic_link', name: 'Magic Link' },
  { id: 'forgot_password', name: 'Forgot Password' },
  { id: 'invite_user', name: 'Invite User' },
  { id: 'email_change', name: 'Email Change' }
];

export function Authentication() {
  // Project list and selection
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeProject, setActiveProject] = useState(null);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('users');

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Users Tab States
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(10);
  const [usersSearch, setUsersSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Sessions Tab States
  const [sessions, setSessions] = useState([]);

  // Providers Tab States
  const [providers, setProviders] = useState({});
  const [activeProviderId, setActiveProviderId] = useState('local');
  const [providerForm, setProviderForm] = useState({ clientId: '', clientSecret: '', isEnabled: false });

  // Email Templates Tab States
  const [templates, setTemplates] = useState({});
  const [activeTemplateId, setActiveTemplateId] = useState('signup_confirmation');
  const [templateForm, setTemplateForm] = useState({ subject: '', body: '' });

  // JWT Settings Tab States
  const [jwtSettings, setJwtSettings] = useState({
    jwtExpiresIn: 3600,
    jwtRefreshExpiresIn: 604800,
    jwtIssuer: 'kiaan-auth',
    jwtAudience: 'kiaan-users',
    maskedSecret: ''
  });
  const [showRotatedSecret, setShowRotatedSecret] = useState(false);
  const [rotatedSecretText, setRotatedSecretText] = useState('');

  // Audit Logs Tab States
  const [auditLogs, setAuditLogs] = useState([]);

  // UI notifications
  const [copiedField, setCopiedField] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Fetch available projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        const activeProjs = (res.data.data || []).filter(p => p.status === 'active');
        setProjects(activeProjs);

        if (activeProjs.length > 0) {
          const storedId = localStorage.getItem('consoleActiveProjectId');
          const exists = activeProjs.some(p => p.id === storedId);
          const targetId = exists ? storedId : activeProjs[0].id;
          setSelectedProjectId(targetId);
          setActiveProject(activeProjs.find(p => p.id === targetId));
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Failed to fetch projects database.');
      }
    };
    fetchProjects();
  }, []);

  // Sync selected project ID with storage
  const handleProjectChange = (e) => {
    const id = e.target.value;
    setSelectedProjectId(id);
    const proj = projects.find(p => p.id === id);
    setActiveProject(proj);
    localStorage.setItem('consoleActiveProjectId', id);
    setError(null);
  };

  // Helper copy clipboard
  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 2. Fetch specific tab data
  const fetchTabData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      if (activeTab === 'users') {
        const res = await api.get(`/projects/${selectedProjectId}/console/users`, {
          params: { search: usersSearch, page: usersPage, limit: usersLimit }
        });
        setUsers(res.data.data.users || []);
        setTotalUsers(res.data.data.total || 0);
      } else if (activeTab === 'sessions') {
        const res = await api.get(`/projects/${selectedProjectId}/console/sessions`);
        setSessions(res.data.data.sessions || []);
      } else if (activeTab === 'providers') {
        const res = await api.get(`/projects/${selectedProjectId}/console/providers`);
        const data = {};
        (res.data.data.providers || []).forEach(p => {
          data[p.provider] = {
            clientId: p.clientId || '',
            clientSecret: p.clientSecret || '',
            isEnabled: p.isEnabled === 1 || p.isEnabled === true
          };
        });
        setProviders(data);

        // Set active provider details
        const activeDetails = data[activeProviderId] || { clientId: '', clientSecret: '', isEnabled: false };
        setProviderForm(activeDetails);
      } else if (activeTab === 'email-templates') {
        const res = await api.get(`/projects/${selectedProjectId}/console/email-templates`);
        const data = {};
        (res.data.data.templates || []).forEach(t => {
          data[t.templateType] = { subject: t.subject || '', body: t.body || '' };
        });
        setTemplates(data);

        const activeTpl = data[activeTemplateId] || { subject: '', body: '' };
        setTemplateForm(activeTpl);
      } else if (activeTab === 'jwt-settings') {
        const res = await api.get(`/projects/${selectedProjectId}/console/jwt-settings`);
        setJwtSettings({
          jwtExpiresIn: res.data.data.jwtExpiresIn,
          jwtRefreshExpiresIn: res.data.data.jwtRefreshExpiresIn,
          jwtIssuer: res.data.data.jwtIssuer || 'kiaan-auth',
          jwtAudience: res.data.data.jwtAudience || 'kiaan-users',
          maskedSecret: res.data.data.maskedSecret
        });
        setShowRotatedSecret(false);
      } else if (activeTab === 'audit-logs') {
        const res = await api.get(`/projects/${selectedProjectId}/console/audit-logs`);
        setAuditLogs(res.data.data.logs || []);
      }
    } catch (err) {
      console.error(`Fetch ${activeTab} failed:`, err);
      setError(err.response?.data?.error?.message || err.response?.data?.message || `Failed to fetch ${activeTab} data.`);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, activeTab, usersSearch, usersPage, usersLimit, activeProviderId, activeTemplateId]);

  // Refresh tab data when tabs or selected project changes
  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // Handle Search Input in Users
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setUsersPage(1);
    fetchTabData();
  };

  // 3. User operations
  const handleToggleSuspend = async (user) => {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      await api.post(`/projects/${selectedProjectId}/console/users/${user.id}/suspend`, { status: newStatus });
      setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user suspension status.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) {
      try {
        await api.delete(`/projects/${selectedProjectId}/console/users/${userId}`);
        setUsers(users.filter(u => u.id !== userId));
        setTotalUsers(prev => Math.max(0, prev - 1));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete user.');
      }
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${selectedProjectId}/console/users/${selectedUser.id}/reset-password`, { password: newPassword });
      setIsResetOpen(false);
      setNewPassword('');
      alert('Password reset successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  // 4. Session operations
  const handleTerminateSession = async (sessionId) => {
    try {
      await api.delete(`/projects/${selectedProjectId}/console/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to terminate session.');
    }
  };

  const handleTerminateAllSessions = async (userId) => {
    if (window.confirm('Are you sure you want to terminate all sessions for this user?')) {
      try {
        await api.delete(`/projects/${selectedProjectId}/console/sessions/user/${userId}`);
        setSessions(sessions.filter(s => s.userId !== userId));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to terminate user sessions.');
      }
    }
  };

  // 5. Providers operations
  const handleProviderSelect = (provId) => {
    setActiveProviderId(provId);
    const details = providers[provId] || { clientId: '', clientSecret: '', isEnabled: false };
    setProviderForm(details);
  };

  const handleProviderFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProviderForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveProvider = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);
    try {
      await api.post(`/projects/${selectedProjectId}/console/providers`, {
        provider: activeProviderId,
        ...providerForm
      });
      setProviders(prev => ({ ...prev, [activeProviderId]: { ...providerForm } }));
      setSaveSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save provider config.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Email Template operations
  const handleTemplateSelect = (tplId) => {
    setActiveTemplateId(tplId);
    const details = templates[tplId] || { subject: '', body: '' };
    setTemplateForm(details);
  };

  const handleTemplateFormChange = (e) => {
    const { name, value } = e.target;
    setTemplateForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);
    try {
      await api.post(`/projects/${selectedProjectId}/console/email-templates`, {
        templateType: activeTemplateId,
        ...templateForm
      });
      setTemplates(prev => ({ ...prev, [activeTemplateId]: { ...templateForm } }));
      setSaveSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save template.');
    } finally {
      setLoading(false);
    }
  };

  // 7. JWT Settings operations
  const handleJwtSettingsChange = (e) => {
    const { name, value } = e.target;
    setJwtSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveJwtSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);
    try {
      await api.post(`/projects/${selectedProjectId}/console/jwt-settings`, jwtSettings);
      setSaveSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save JWT settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleRotateSecret = async () => {
    if (window.confirm('⚠️ WARNING: Rotating the JWT Secret will instantly invalidate all active user tokens. Users will be required to log in again. Do you want to proceed?')) {
      setLoading(true);
      try {
        const res = await api.post(`/projects/${selectedProjectId}/console/jwt-settings/rotate`);
        setJwtSettings(prev => ({ ...prev, maskedSecret: res.data.data.maskedSecret }));
        alert('JWT Secret rotated successfully.');
      } catch (err) {
        alert('Failed to rotate secret.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Render project details empty state
  if (projects.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center p-6 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl">
        <Database className="h-12 w-12 text-slate-400 mb-4 animate-bounce" />
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">No Active Projects</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">Please create and activate at least one project under the "Projects" tab to configure your authentication settings.</p>
        <Button onClick={() => window.location.href='/projects'} className="mt-4">Go to Projects</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Section: Active Project and Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Authentication Console</h1>
          <p className="text-sm text-slate-500 mt-1">Configure live users, active sessions, and providers for your isolated project.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project:</span>
          <select 
            value={selectedProjectId}
            onChange={handleProjectChange}
            className="rounded-md border border-slate-200 bg-white py-1.5 px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-primary dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Console Hub Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar Navigation */}
        <div className="lg:col-span-1 flex flex-col space-y-1 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl p-3 h-fit shadow-sm">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'sessions', label: 'Sessions', icon: Activity },
            { id: 'providers', label: 'Providers', icon: Shield },
            { id: 'email-templates', label: 'Email Templates', icon: Mail },
            { id: 'jwt-settings', label: 'JWT Settings', icon: Key },
            { id: 'audit-logs', label: 'Audit Logs', icon: Compass }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Content Pane */}
        <div className="lg:col-span-3 space-y-6">
          {/* Global Loading / Error Indicators */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Query Failed</p>
                <p className="mt-0.5 text-xs">{error}</p>
              </div>
            </div>
          )}

          {/* 1. USERS TAB VIEW */}
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Registered Users</h3>
                  <p className="text-xs text-slate-500 mt-1">Users registered inside project database `{activeProject?.dbName || 'isolated_schema'}`.</p>
                </div>
                <form onSubmit={handleSearchSubmit} className="flex w-full md:w-auto gap-2">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search email/id..."
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-xs outline-none bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <Button size="sm" type="submit">Filter</Button>
                </form>
              </div>

              {loading && users.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  Loading user records...
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">No Users Found</p>
                  <p className="text-xs mt-1">Run user registration via SDK/API endpoints to populate this database table.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">User ID</th>
                        <th className="px-6 py-3.5 font-semibold">Email</th>
                        <th className="px-6 py-3.5 font-semibold">Provider</th>
                        <th className="px-6 py-3.5 font-semibold">Role</th>
                        <th className="px-6 py-3.5 font-semibold">Email Verified</th>
                        <th className="px-6 py-3.5 font-semibold">Status</th>
                        <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="px-6 py-4 font-mono text-xs max-w-[100px] truncate" title={u.id}>{u.id}</td>
                          <td className="px-6 py-4 font-medium text-slate-950 dark:text-white">{u.email}</td>
                          <td className="px-6 py-4 text-xs font-semibold capitalize">{u.provider || 'local'}</td>
                          <td className="px-6 py-4 text-xs font-mono">{u.role}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              u.email_confirmed === 1 
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' 
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                            }`}>
                              {u.email_confirmed === 1 ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              u.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => { setSelectedUser(u); setIsDetailsOpen(true); }}
                                title="View Details"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                                onClick={() => { setSelectedUser(u); setIsResetOpen(true); }}
                                title="Reset Password"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`h-8 w-8 p-0 ${u.status === 'suspended' ? 'text-green-600' : 'text-amber-500'}`}
                                onClick={() => handleToggleSuspend(u)}
                                title={u.status === 'suspended' ? 'Unsuspend User' : 'Suspend User'}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteUser(u.id)}
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Pagination control */}
                  <div className="px-6 py-4 border-t dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
                    <span>Total {totalUsers} registered users</span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={usersPage <= 1} 
                        onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
                      >
                        Prev
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={usersPage * usersLimit >= totalUsers} 
                        onClick={() => setUsersPage(prev => prev + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. SESSIONS TAB VIEW */}
          {activeTab === 'sessions' && (
            <div className="bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Active Sessions</h3>
                  <p className="text-xs text-slate-500 mt-1">Dynamic connection token states stored in target project DB.</p>
                </div>
                {sessions.length > 0 && (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 dark:border-red-950" onClick={() => handleTerminateAllSessions(sessions[0].userId)}>
                    Terminate All
                  </Button>
                )}
              </div>

              {loading && sessions.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  Loading session data...
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">No Active Sessions</p>
                  <p className="text-xs mt-1">Sessions will appear here once users authenticate on client applications.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">User</th>
                        <th className="px-6 py-3.5 font-semibold">IP Address</th>
                        <th className="px-6 py-3.5 font-semibold">Browser / OS</th>
                        <th className="px-6 py-3.5 font-semibold">Expires At</th>
                        <th className="px-6 py-3.5 font-semibold">Status</th>
                        <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sessions.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{s.userEmail}</td>
                          <td className="px-6 py-4 font-mono text-xs">{s.ipAddress}</td>
                          <td className="px-6 py-4">
                            <span className="block text-slate-900 dark:text-white font-medium">{s.browser}</span>
                            <span className="block text-xs text-slate-400">{s.device}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">{new Date(s.expiresAt).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              s.status === 'Active' 
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' 
                                : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleTerminateSession(s.id)}
                            >
                              Revoke
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. PROVIDERS TAB VIEW */}
          {activeTab === 'providers' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              {/* Left inner side: Provider List */}
              <div className="md:col-span-1 border-r dark:border-slate-800 p-4 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2 block">Providers</span>
                {PROVIDER_LIST.map(p => {
                  const isEnabled = providers[p.id]?.isEnabled;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProviderSelect(p.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        activeProviderId === p.id 
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white' 
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-800'}`}></span>
                    </button>
                  );
                })}
              </div>

              {/* Right inner side: Details Form */}
              <form onSubmit={handleSaveProvider} className="md:col-span-2 p-6 space-y-6">
                <div className="border-b pb-4 dark:border-slate-800">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {PROVIDER_LIST.find(p => p.id === activeProviderId)?.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Configure client keys for project SSO integrations.</p>
                </div>

                <div className="space-y-4">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between rounded-lg border p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white block">Enable Provider</span>
                      <span className="text-xs text-slate-500">Allow users to authenticate via this provider.</span>
                    </div>
                    <input
                      type="checkbox"
                      name="isEnabled"
                      checked={providerForm.isEnabled}
                      onChange={providerForm.isEnabled || activeProviderId !== 'local' ? handleProviderFormChange : undefined}
                      disabled={activeProviderId === 'local'} // Local auth must always remain enabled
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                    />
                  </div>

                  {activeProviderId !== 'local' && (
                    <>
                      {/* Client ID */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Client ID</label>
                        <input
                          type="text"
                          name="clientId"
                          value={providerForm.clientId}
                          onChange={handleProviderFormChange}
                          placeholder="e.g. 98452-xyz.apps.googleusercontent.com"
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Client Secret */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Client Secret</label>
                        <input
                          type="password"
                          name="clientSecret"
                          value={providerForm.clientSecret}
                          onChange={handleProviderFormChange}
                          placeholder="••••••••••••••••••••••••"
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                {saveSuccess && (
                  <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Configuration saved successfully!</p>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                  <Button type="submit" loading={loading}>Save Config</Button>
                </div>
              </form>
            </div>
          )}

          {/* 4. EMAIL TEMPLATES TAB VIEW */}
          <div className={`${activeTab === 'email-templates' ? '' : 'hidden'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              {/* Template list sidebar */}
              <div className="md:col-span-1 border-r dark:border-slate-800 p-4 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2 block">Templates</span>
                {TEMPLATE_LIST.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTemplateId === t.id 
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white' 
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>

              {/* Editor details */}
              <form onSubmit={handleSaveTemplate} className="md:col-span-2 p-6 space-y-6">
                <div className="border-b pb-4 dark:border-slate-800">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {TEMPLATE_LIST.find(t => t.id === activeTemplateId)?.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Configure automated transactional emails for user workflows.</p>
                </div>

                <div className="space-y-4">
                  {/* Subject Line */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Email Subject</label>
                    <input
                      type="text"
                      name="subject"
                      value={templateForm.subject}
                      onChange={handleTemplateFormChange}
                      placeholder="e.g. Verify your Kiaan Auth account"
                      className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Body HTML Editor */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Email HTML Body</label>
                    <textarea
                      name="body"
                      value={templateForm.body}
                      onChange={handleTemplateFormChange}
                      rows={12}
                      placeholder="<h2>Welcome, {{email}}</h2><p>Click <a href='{{confirmation_url}}'>here</a> to confirm your signup.</p>"
                      className="w-full rounded-md border border-slate-200 p-3 text-xs bg-slate-50 focus:border-primary font-mono dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-y"
                    />
                  </div>
                </div>

                {saveSuccess && (
                  <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Template updated successfully!</p>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                  <Button type="submit" loading={loading}>Save Template</Button>
                </div>
              </form>
            </div>
          </div>

          {/* 5. JWT SETTINGS TAB VIEW */}
          {activeTab === 'jwt-settings' && (
            <form onSubmit={handleSaveJwtSettings} className="bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-6">
              <div className="border-b pb-4 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">JWT Configuration</h3>
                  <p className="text-xs text-slate-500 mt-1">Manage project tokens settings, lifespan, and secrets validation.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={handleRotateSecret}>
                  Rotate Secret
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Masked Secret key */}
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block">Current JWT Secret Key</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={jwtSettings.maskedSecret}
                      className="h-10 w-full bg-slate-50 border border-slate-200 dark:border-slate-800 rounded px-3 text-sm font-mono text-slate-400 dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Token Expire */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Access Token Lifespan (seconds)</label>
                  <input
                    type="number"
                    name="jwtExpiresIn"
                    value={jwtSettings.jwtExpiresIn}
                    onChange={handleJwtSettingsChange}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {/* Refresh Expire */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Refresh Token Lifespan (seconds)</label>
                  <input
                    type="number"
                    name="jwtRefreshExpiresIn"
                    value={jwtSettings.jwtRefreshExpiresIn}
                    onChange={handleJwtSettingsChange}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {/* Issuer */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Token Issuer (iss)</label>
                  <input
                    type="text"
                    name="jwtIssuer"
                    value={jwtSettings.jwtIssuer}
                    onChange={handleJwtSettingsChange}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {/* Audience */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Token Audience (aud)</label>
                  <input
                    type="text"
                    name="jwtAudience"
                    value={jwtSettings.jwtAudience}
                    onChange={handleJwtSettingsChange}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {saveSuccess && (
                <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Token configuration saved successfully!</p>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                <Button type="submit" loading={loading}>Save JWT Settings</Button>
              </div>
            </form>
          )}

          {/* 6. AUDIT LOGS TAB VIEW */}
          {activeTab === 'audit-logs' && (
            <div className="bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Authentication Events</h3>
                  <p className="text-xs text-slate-500 mt-1">Live auth transaction logs from isolated project database.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTabData} loading={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </div>

              {loading && auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  Loading auth logs...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Compass className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">No Events Logged</p>
                  <p className="text-xs mt-1">Signup, login, logout, and token rotation activities will be recorded here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                        <th className="px-6 py-3.5 font-semibold">User Email</th>
                        <th className="px-6 py-3.5 font-semibold">Action</th>
                        <th className="px-6 py-3.5 font-semibold">IP Address</th>
                        <th className="px-6 py-3.5 font-semibold">Device Metadata</th>
                        <th className="px-6 py-3.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {auditLogs.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="px-6 py-4 text-xs text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{l.email || 'guest-user'}</td>
                          <td className="px-6 py-4 font-mono text-xs font-semibold capitalize text-primary">{l.action}</td>
                          <td className="px-6 py-4 font-mono text-xs">{l.ipAddress || 'System'}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">{l.device || 'System Action'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              l.status === 'success' 
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' 
                                : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details Drawer */}
      <Drawer isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="User Details Metadata">
        {selectedUser && (
          <div className="space-y-4 mt-6 text-sm">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">UUID</span>
              <span className="font-mono text-xs bg-slate-50 p-2 border dark:border-slate-800 dark:bg-slate-900 block rounded mt-1 select-all">{selectedUser.id}</span>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Email Address</span>
              <span className="block mt-1 text-base font-semibold text-slate-900 dark:text-white">{selectedUser.email}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Phone</span>
                <span className="block mt-1 font-medium">{selectedUser.phone || 'None'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Provider</span>
                <span className="block mt-1 font-semibold capitalize text-primary">{selectedUser.provider || 'local'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Role Scope</span>
                <span className="block mt-1 font-mono text-xs bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 px-2 py-1 rounded w-fit">{selectedUser.role}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Status</span>
                <span className="block mt-1 font-semibold text-emerald-600 capitalize">{selectedUser.status}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block font-mono">JWT Claims Structure Preview</span>
              <pre className="mt-1.5 p-3 bg-slate-900 text-slate-300 rounded text-[10px] font-mono overflow-x-auto">
{JSON.stringify({
  sub: selectedUser.id,
  email: selectedUser.email,
  role: selectedUser.role,
  projectId: selectedProjectId,
  refId: activeProject?.refId || 'unknown-project'
}, null, 2)}
              </pre>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-4 border-t dark:border-slate-800 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Created At:</span>
                <span>{new Date(selectedUser.created_at || selectedUser.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated At:</span>
                <span>{new Date(selectedUser.updated_at || selectedUser.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Sign In:</span>
                <span>{selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6">
              <Button onClick={() => setIsDetailsOpen(false)}>Close Drawer</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Password Reset Modal */}
      <Drawer isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} title="Force Password Reset">
        {selectedUser && (
          <form onSubmit={handleResetPassword} className="space-y-6 mt-6">
            <div>
              <p className="text-xs text-slate-500">Forcing password update for user `<span className="font-semibold">{selectedUser.email}</span>`.</p>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4">New Secure Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Must be at least 6 characters"
                className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-slate-50 focus:border-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>Cancel</Button>
              <Button type="submit">Update Password</Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
