const prisma = require('../config/db');

const parseCondition = (conditionStr, user) => {
  const normalized = conditionStr.trim();
  const match = normalized.match(/^([a-zA-Z0-9_]+)\s*(=|==|!=|<>)\s*(.+)$/);
  if (!match) {
    throw new Error(`Unsupported or invalid condition format: "${conditionStr}"`);
  }
  
  const fieldName = match[1].trim();
  const operator = match[2].trim();
  const rightExpr = match[3].trim();
  
  let rightValue = null;
  if (rightExpr.startsWith('auth.') || rightExpr.startsWith('user.')) {
    const propPath = rightExpr.split('.')[1];
    if (propPath === 'userId') {
      rightValue = user.sub || user.userId || user.id;
    } else {
      rightValue = user[propPath];
    }
  } else {
    if ((rightExpr.startsWith("'") && rightExpr.endsWith("'")) || (rightExpr.startsWith('"') && rightExpr.endsWith('"'))) {
      rightValue = rightExpr.slice(1, -1);
    } else if (!isNaN(rightExpr)) {
      rightValue = Number(rightExpr);
    } else {
      rightValue = rightExpr;
    }
  }
  
  return {
    fieldName,
    operator: (operator === '==' ? '=' : (operator === '<>' ? '!=' : operator)),
    rightValue
  };
};

const canBypassRls = (req) => {
  if (!req.user) return false;
  // If control plane user has Super Admin / Admin role
  if (req.user.role === 'Super Admin' || req.user.role === 'Admin' || req.user.roleId === 'Super Admin' || req.user.roleId === 'Admin') {
    return true;
  }
  // Check if they are a project user, does project user have 'admin' role?
  if (req.user.role === 'admin' || req.user.role === 'Admin') {
    return true;
  }
  
  // If request is from Control Plane Developer/Owner (they have a matching tenantId but no project user claims)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.userId && !decoded.projectId && !decoded.refId && !decoded.sub) {
        return true;
      }
    } catch (e) {}
  }
  
  return false;
};

const checkRowPermission = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || (req.project ? req.project.id : null);
    const tableName = req.params.tableName || req.params.table;
    if (!tableName || !projectId) return next();

    // 1. Bypass Checks
    if (canBypassRls(req)) {
      return next();
    }

    // Determine the CRUD operation
    let operation = 'SELECT';
    if (req.method === 'POST') operation = 'INSERT';
    else if (req.method === 'PATCH' || req.method === 'PUT') operation = 'UPDATE';
    else if (req.method === 'DELETE') operation = 'DELETE';

    // 2. Fetch active policies for this table and operation
    const policies = await prisma.$queryRawUnsafe(
      'SELECT * FROM `RlsPolicy` WHERE `projectId` = ? AND `tableName` = ? AND `operation` IN (?, "*") AND `enabled` = 1',
      projectId,
      tableName,
      operation
    );

    if (!policies || policies.length === 0) {
      // If no policies exist at all for this table/operation, RLS is not active
      return next();
    }

    const userRole = req.user?.role || 'authenticated';
    const applicablePolicies = policies.filter(p => {
      return p.role === '*' || p.role === 'authenticated' || p.role === userRole;
    });

    if (applicablePolicies.length === 0) {
      // Policies exist, but none are applicable to the user's role -> Access Denied
      const { sendError } = require('../core/response');
      return sendError(res, 'Access denied by Row Level Security (RLS) policy', 'FORBIDDEN', [], 403);
    }

    // 3. For INSERT, evaluate the condition against req.body in-memory
    if (operation === 'INSERT') {
      let allowed = false;
      for (const policy of applicablePolicies) {
        if (!policy.condition) {
          allowed = true; // empty condition means allow all
          break;
        }
        try {
          const parsed = parseCondition(policy.condition, req.user);
          const payloadValue = req.body[parsed.fieldName];
          
          let match = false;
          if (parsed.operator === '=') {
            match = payloadValue == parsed.rightValue;
          } else if (parsed.operator === '!=') {
            match = payloadValue != parsed.rightValue;
          }
          
          if (match) {
            allowed = true;
            break;
          }
        } catch (err) {
          console.error('[RLS Middleware] Insert evaluation error:', err);
        }
      }

      if (!allowed) {
        const { sendError } = require('../core/response');
        return sendError(res, 'Access denied by Row Level Security (RLS) policy', 'FORBIDDEN', [], 403);
      }
      return next();
    }

    // 4. For SELECT, UPDATE, DELETE: formulate constraint clauses
    const clauses = [];
    const params = [];

    for (const policy of applicablePolicies) {
      if (!policy.condition) {
        // Empty condition on any applicable policy bypasses checking (allows all)
        return next();
      }
      try {
        const parsed = parseCondition(policy.condition, req.user);
        clauses.push(`\`${parsed.fieldName}\` ${parsed.operator} ?`);
        params.push(parsed.rightValue);
      } catch (err) {
        console.error('[RLS Middleware] Constraint formulation error:', err);
      }
    }

    if (clauses.length === 0) {
      return next();
    }

    req.rlsConstraints = {
      whereClause: `(${clauses.join(' OR ')})`,
      params
    };

    next();
  } catch (error) {
    console.error('[checkRowPermission] Error:', error);
    const { sendError } = require('../core/response');
    return sendError(res, 'An error occurred during row-level security authorization.', 'INTERNAL_ERROR', [], 500);
  }
};

module.exports = checkRowPermission;
