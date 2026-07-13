import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, Folder, RefreshCw } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/LoadingSkeleton';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';

export function Projects() {
  const navigate = useNavigate();
  const { projects, loading, error, fetchProjects, createProject, deleteProject, retryProvisioning } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!projectName.trim()) {
      setFormError('Project name is required');
      return;
    }
    
    if (projectName.trim().length < 3) {
      setFormError('Project name must be at least 3 characters');
      return;
    }

    setActionLoading(true);
    try {
      await createProject(projectName.trim());
      setProjectName('');
      setIsDrawerOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project? This will permanently remove all associated databases, keys, and settings.')) {
      try {
        await deleteProject(id);
      } catch (err) {
        alert(err.message || 'Failed to delete project');
      }
    }
  };

  const handleRetry = async (id, e) => {
    e.stopPropagation();
    try {
      await retryProvisioning(id);
    } catch (err) {
      alert(err.message || 'Failed to retry provisioning');
    }
  };

  // Filter projects by search term
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.refId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && projects.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Projects</h1>
          <p className="text-sm text-slate-500">Loading your platforms workspaces...</p>
        </div>
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <UniversalCRUDLayout
      title="Projects"
      description="Manage all your isolated database and backend projects."
      toolbarActions={
        <Button onClick={() => { setFormError(''); setIsDrawerOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      }
      searchProps={{
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        placeholder: "Search projects..."
      }}
      hasData={filteredProjects.length > 0}
      emptyState={
        error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
            <p className="font-semibold">Error Loading Projects</p>
            <p className="mt-1 text-sm">{error}</p>
            <Button variant="outline" onClick={fetchProjects} className="mt-4 border-red-300 dark:border-red-800">Retry</Button>
          </div>
        ) : (
          <EmptyState
            icon={Folder}
            title="No projects found"
            description="Create your first project to provision a secure database, authentication schema, and storage buckets."
            actionText="New Project"
            onAction={() => { setFormError(''); setIsDrawerOpen(true); }}
          />
        )
      }
      table={
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Project Name</th>
              <th className="px-6 py-4 font-semibold">Reference ID (refId)</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Created At</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
            {filteredProjects.map((project) => (
              <tr 
                key={project.id} 
                className="hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                  {project.name}
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">
                  {project.refId}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                    project.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : project.status === 'provisioning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                  }`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  {new Date(project.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {project.status === 'error' && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        title="Retry Provisioning"
                        onClick={(e) => handleRetry(project.id, e)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={(e) => handleDelete(project.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      modals={
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Create New Project"
        >
          <form onSubmit={handleCreateProject} className="space-y-6 mt-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  setFormError('');
                }}
                placeholder="e.g. Production Core DB"
                className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white text-slate-900"
              />
              <p className="mt-2 text-xs text-slate-500">
                This name maps to your dedicated MySQL database cluster and JWT authentication schema.
              </p>
              {formError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={actionLoading}>
                Create Project
              </Button>
            </div>
          </form>
        </Drawer>
      }
    />
  );
}
