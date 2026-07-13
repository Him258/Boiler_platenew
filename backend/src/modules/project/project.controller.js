const projectService = require('./project.service');
const { sendSuccess, sendError } = require('../../core/response');

exports.createProject = async (req, res) => {
  try {
    const { name } = req.body;
    const tenantId = req.user.tenantId;
    const creatorId = req.user.userId;

    const data = await projectService.createProject({ name, tenantId, creatorId });
    return sendSuccess(res, 'Project created successfully', data, null, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    return sendError(res, error.message || 'Failed to create project', 'INTERNAL_ERROR', [], 500);
  }
};

exports.getProjects = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const data = await projectService.getProjectsByTenant(tenantId);
    
    return sendSuccess(res, 'Projects retrieved successfully', data);
  } catch (error) {
    console.error('Error retrieving projects:', error);
    return sendError(res, 'Failed to retrieve projects', 'INTERNAL_ERROR', [], 500);
  }
};

exports.getProject = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const data = await projectService.getProjectById(id);
    
    // Authorization Check: Project must belong to the developer's tenant/organization
    if (data.tenantId !== tenantId) {
      return sendError(res, 'Access denied to this project', 'FORBIDDEN', [], 403);
    }

    return sendSuccess(res, 'Project retrieved successfully', data);
  } catch (error) {
    console.error('Error retrieving project:', error);
    if (error.message === 'Project not found') {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to retrieve project details', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const data = await projectService.getProjectById(id);
    if (data.tenantId !== tenantId) {
      return sendError(res, 'Access denied to delete this project', 'FORBIDDEN', [], 403);
    }

    await projectService.deleteProject(id);
    return sendSuccess(res, 'Project deleted successfully', { id });
  } catch (error) {
    console.error('Error deleting project:', error);
    if (error.message === 'Project not found') {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to delete project', 'INTERNAL_ERROR', [], 500);
  }
};

exports.retryProvisioning = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const project = await projectService.getProjectById(id);
    if (project.tenantId !== tenantId) {
      return sendError(res, 'Access denied to this project', 'FORBIDDEN', [], 403);
    }

    const data = await projectService.retryProvisioning(id);
    return sendSuccess(res, 'Provisioning retry initiated successfully', data);
  } catch (error) {
    console.error('Error retrying provisioning:', error);
    if (error.message === 'Project not found') {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to retry provisioning', 'INTERNAL_ERROR', [], 500);
  }
};

