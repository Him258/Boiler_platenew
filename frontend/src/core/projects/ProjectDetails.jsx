import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/Button';
import { Copy, Eye, EyeOff, Check, ArrowLeft, Database, Key, Server, Terminal } from 'lucide-react';

export function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentProject, loading, error, fetchProjectDetails } = useProjects();
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (id) {
      fetchProjectDetails(id);
    }
  }, [id, fetchProjectDetails]);

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  if (loading && !currentProject) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-3 text-slate-500">Loading project credentials...</span>
      </div>
    );
  }

  if (error || !currentProject) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => navigate('/projects')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          <p className="font-semibold">Error Loading Project</p>
          <p className="mt-1 text-sm">{error || 'Project not found.'}</p>
          <Button onClick={() => fetchProjectDetails(id)} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  const { database, apiKeys } = currentProject;
  const anonKey = apiKeys.find(k => k.keyType === 'anon')?.keyToken || '';
  const serviceKey = apiKeys.find(k => k.keyType === 'service_role')?.keyToken || '';

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{currentProject.name}</h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
              {currentProject.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Project Reference ID: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">{currentProject.refId}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Database Connection Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Database className="h-5 w-5 text-slate-500" />
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">Database Connection</h3>
                <p className="text-xs text-slate-500">Credentials to connect directly to your project's MySQL database schema.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Host */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block">Host</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={database.host}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-sm w-full font-mono text-slate-800 dark:text-slate-300"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(database.host, 'host')}>
                      {copiedField === 'host' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Port */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block">Port</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={database.port}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-sm w-full font-mono text-slate-800 dark:text-slate-300"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(database.port.toString(), 'port')}>
                      {copiedField === 'port' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Database Name */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block">Database Name</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={database.name}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-sm w-full font-mono text-slate-800 dark:text-slate-300"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(database.name, 'dbname')}>
                      {copiedField === 'dbname' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block">Username</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={database.username}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-sm w-full font-mono text-slate-800 dark:text-slate-300"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(database.username, 'user')}>
                      {copiedField === 'user' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-medium text-slate-500 block">Password</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    readOnly
                    value={database.password || ''}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-sm w-full font-mono text-slate-800 dark:text-slate-300"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(database.password || '', 'pwd')}>
                    {copiedField === 'pwd' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Key className="h-5 w-5 text-slate-500" />
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">Project API Keys</h3>
                <p className="text-xs text-slate-500">JWT-signed keys used to authenticate requests made to your project REST/Auth APIs.</p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {/* Anon Key */}
              <div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">anon (Public Key)</span>
                    <p className="text-xs text-slate-500">Safe to use in client-side applications (browsers/apps).</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(anonKey, 'anon')}>
                    {copiedField === 'anon' ? (
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>
                    )}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={anonKey}
                  rows={3}
                  className="mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs w-full font-mono text-slate-600 dark:text-slate-400 focus:outline-none resize-none"
                />
              </div>

              {/* Service Key */}
              <div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">service_role (Secret Admin Key)</span>
                    <p className="text-xs text-red-500 font-medium">⚠️ NEVER expose this key in client-side code. Safe for server-side use only.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(serviceKey, 'service')}>
                    {copiedField === 'service' ? (
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>
                    )}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={serviceKey}
                  rows={3}
                  className="mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs w-full font-mono text-slate-600 dark:text-slate-400 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Connection URI / SDK Preview */}
        <div className="space-y-6">
          {/* Connection String */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Server className="h-5 w-5 text-slate-500" />
              <h3 className="font-semibold text-slate-950 dark:text-white">Connection URI</h3>
            </div>
            <div className="mt-4">
              <span className="text-xs text-slate-500 block">MySQL Connection URL</span>
              <div className="mt-2 flex bg-slate-900 text-slate-200 p-3 rounded font-mono text-xs overflow-x-auto relative group">
                <code className="pr-8">
                  {`mysql://${database.username}:****@${database.host}:${database.port}/${database.name}`}
                </code>
                <button 
                  onClick={() => copyToClipboard(`mysql://${database.username}:${database.password}@${database.host}:${database.port}/${database.name}`, 'uri')}
                  className="absolute right-2 top-2 p-1 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                >
                  {copiedField === 'uri' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Quickstart SDK */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Terminal className="h-5 w-5 text-slate-500" />
              <h3 className="font-semibold text-slate-950 dark:text-white">Client SDK Setup</h3>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <span className="text-xs text-slate-500 block">1. Install package</span>
                <code className="mt-1 block bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-xs">
                  npm install @kiaan/kiaan-js
                </code>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">2. Initialize Client</span>
                <pre className="mt-1 bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-[10px] overflow-x-auto">
{`import { createClient } from '@kiaan/kiaan-js'

const kiaan = createClient(
  'https://${currentProject.refId}.kiaan.dev',
  '${anonKey.substring(0, 15)}...'
)`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
