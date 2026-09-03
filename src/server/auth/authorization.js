import { ROLES, ROLE_PERMISSIONS } from "./permissions.js";

function normalizeRole(role) {
  return String(role || "").toUpperCase();
}

export function isSuperAdmin(user) {
  return Boolean(user && normalizeRole(user.role) === ROLES.SUPER_ADMIN);
}

export function hasRole(user, role) {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  return normalizeRole(user.role) === normalizeRole(role);
}

export function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  const userRole = normalizeRole(user.role);
  const userPermissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS[user.role] || [];
  return (
    userPermissions.includes(permission) ||
    (Array.isArray(user.permissions) && user.permissions.includes(permission))
  );
}
