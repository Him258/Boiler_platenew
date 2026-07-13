import { useState, useCallback } from 'react';
import api from '@/lib/api';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/projects');
      setProjects(response.data.data || []);
    } catch (err) {
      console.error('Fetch projects failed:', err);
      setError(err.response?.data?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjectDetails = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/projects/${id}`);
      setCurrentProject(response.data.data);
      return response.data.data;
    } catch (err) {
      console.error('Fetch project details failed:', err);
      setError(err.response?.data?.message || 'Failed to fetch project details');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (name) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/projects', { name });
      const newProj = response.data.data;
      setProjects((prev) => [newProj, ...prev]);
      return newProj;
    } catch (err) {
      console.error('Create project failed:', err);
      const errMsg = err.response?.data?.message || 'Failed to create project';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProject = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
    } catch (err) {
      console.error('Delete project failed:', err);
      setError(err.response?.data?.message || 'Failed to delete project');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  const retryProvisioning = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/projects/${id}/retry`);
      const updatedProj = response.data.data;
      setProjects((prev) => prev.map((p) => p.id === id ? updatedProj : p));
      return updatedProj;
    } catch (err) {
      console.error('Retry provisioning failed:', err);
      const errMsg = err.response?.data?.message || 'Failed to retry provisioning';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects,
    fetchProjectDetails,
    createProject,
    deleteProject,
    retryProvisioning,
  };
}
