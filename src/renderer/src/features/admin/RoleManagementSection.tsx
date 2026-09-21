import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Plus,
  Search,
  Eye,
  Edit2,
  Copy,
  Trash2,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Lock,
  Users,
  CheckSquare,
  Square,
  MinusSquare,
  Info,
} from 'lucide-react';
import { RoleDTO, RoleDetailDTO, CreateRoleDTO, UpdateRoleDTO, Status } from '../../../../shared/types';
import {
  PERMISSION_CATEGORIES,
  PERMISSION_CATALOGUE,
  PermissionDefinition,
} from '../../../../shared/constants/permissions';

interface RoleManagementSectionProps {
  sessionToken?: string;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

export function RoleManagementSection({ sessionToken, onNotify }: RoleManagementSectionProps) {
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Builder Modal State
  const [showBuilderModal, setShowBuilderModal] = useState<boolean>(false);
  const [builderMode, setBuilderMode] = useState<'create' | 'edit' | 'clone'>('create');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [originalRoleName, setOriginalRoleName] = useState<string>('');
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    status: Status;
  }>({
    name: '',
    description: '',
    status: 'ACTIVE',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [permissionFilter, setPermissionFilter] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  // Dangerous confirmation modal
  const [showDangerousWarning, setShowDangerousWarning] = useState<boolean>(false);

  // Role Details Modal State
  const [detailsRole, setDetailsRole] = useState<RoleDetailDTO | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deleteTargetRole, setDeleteTargetRole] = useState<RoleDTO | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load roles on mount
  useEffect(() => {
    loadRoles();
  }, [sessionToken]);

  const loadRoles = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    setLoading(true);
    try {
      const res = await electronAPI.invoke('admin:listRoles', { token: sessionToken });
      if (res.success && res.roles) {
        setRoles(res.roles);
      } else {
        onNotify?.('error', res.error || 'Failed to load roles');
      }
    } catch (err: any) {
      console.error('[RoleManagement] Failed to fetch roles:', err);
      onNotify?.('error', err?.message || 'Error loading roles');
    } finally {
      setLoading(false);
    }
  };

  // Open Builder for Create
  const handleOpenCreate = () => {
    setBuilderMode('create');
    setEditingRoleId(null);
    setOriginalRoleName('');
    setRoleForm({ name: '', description: '', status: 'ACTIVE' });
    setSelectedPermissions(new Set());
    setPermissionFilter('');
    // Expand all categories by default
    const exp: Record<string, boolean> = {};
    PERMISSION_CATEGORIES.forEach((c) => (exp[c.name] = true));
    setExpandedCategories(exp);
    setBuilderError(null);
    setShowBuilderModal(true);
  };

  // Open Builder for Edit
  const handleOpenEdit = async (role: RoleDTO) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    setLoading(true);
    try {
      const res = await electronAPI.invoke('admin:getRole', { id: role.id, token: sessionToken });
      if (res.success && res.role) {
        const fullRole: RoleDetailDTO = res.role;
        setBuilderMode('edit');
        setEditingRoleId(fullRole.id);
        setOriginalRoleName(fullRole.name);
        setRoleForm({
          name: fullRole.name,
          description: fullRole.description || '',
          status: fullRole.status,
        });
        setSelectedPermissions(new Set(fullRole.permissions));
        setPermissionFilter('');
        const exp: Record<string, boolean> = {};
        PERMISSION_CATEGORIES.forEach((c) => (exp[c.name] = true));
        setExpandedCategories(exp);
        setBuilderError(null);
        setShowBuilderModal(true);
      } else {
        onNotify?.('error', res.error || 'Failed to load role details for editing');
      }
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Error loading role for edit');
    } finally {
      setLoading(false);
    }
  };

  // Open Builder for Clone (Role Cloning creates a NEW role identity)
  const handleOpenClone = async (role: RoleDTO) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    setLoading(true);
    try {
      const res = await electronAPI.invoke('admin:getRole', { id: role.id, token: sessionToken });
      if (res.success && res.role) {
        const fullRole: RoleDetailDTO = res.role;
        setBuilderMode('clone');
        setEditingRoleId(null);
        setOriginalRoleName('');
        setRoleForm({
          name: `${fullRole.name} (Copy)`,
          description: fullRole.description ? `Clone of ${fullRole.name}: ${fullRole.description}` : `Clone of ${fullRole.name}`,
          status: 'ACTIVE',
        });
        setSelectedPermissions(new Set(fullRole.permissions));
        setPermissionFilter('');
        const exp: Record<string, boolean> = {};
        PERMISSION_CATEGORIES.forEach((c) => (exp[c.name] = true));
        setExpandedCategories(exp);
        setBuilderError(null);
        setShowBuilderModal(true);
      }
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Error loading role for cloning');
    } finally {
      setLoading(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (role: RoleDTO) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    setDetailsLoading(true);
    try {
      const res = await electronAPI.invoke('admin:getRole', { id: role.id, token: sessionToken });
      if (res.success && res.role) {
        setDetailsRole(res.role);
      } else {
        onNotify?.('error', res.error || 'Failed to load role details');
      }
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Error loading role details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Toggle Single Permission
  const handleTogglePermission = (permKey: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permKey)) {
        next.delete(permKey);
      } else {
        next.add(permKey);
      }
      return next;
    });
  };

  // Toggle Category Select All
  const handleToggleCategory = (categoryName: string, permsInCategory: PermissionDefinition[]) => {
    const categoryKeys = permsInCategory.map((p) => p.key);
    const allSelected = categoryKeys.every((k) => selectedPermissions.has(k));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // Unselect all in this category
        categoryKeys.forEach((k) => next.delete(k));
      } else {
        // Select all in this category
        categoryKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Filtered Categories according to permission filter search
  const filteredCategories = useMemo(() => {
    const query = permissionFilter.trim().toLowerCase();
    if (!query) return PERMISSION_CATEGORIES;

    return PERMISSION_CATEGORIES.map((cat) => {
      const matchingPerms = cat.permissions.filter(
        (p) =>
          p.key.toLowerCase().includes(query) ||
          p.displayName.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          cat.name.toLowerCase().includes(query)
      );
      return {
        name: cat.name,
        permissions: matchingPerms,
      };
    }).filter((cat) => cat.permissions.length > 0);
  }, [permissionFilter]);

  // Check which dangerous permissions are selected
  const selectedDangerousPerms = useMemo(() => {
    const dangerousKeys = new Set(
      PERMISSION_CATALOGUE.filter((p) => p.dangerous).map((p) => p.key)
    );
    return Array.from(selectedPermissions).filter((k) => dangerousKeys.has(k));
  }, [selectedPermissions]);

  // Attempt Save Role
  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    setBuilderError(null);

    if (!roleForm.name.trim()) {
      setBuilderError('Role name is required.');
      return;
    }

    // If dangerous permissions are selected and we haven't confirmed yet
    if (selectedDangerousPerms.length > 0 && !showDangerousWarning) {
      setShowDangerousWarning(true);
      return;
    }

    executeSaveRole();
  };

  // Actually save role to backend
  const executeSaveRole = async () => {
    setShowDangerousWarning(false);
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    setSaving(true);
    setBuilderError(null);

    try {
      const permsArray = Array.from(selectedPermissions);

      if (builderMode === 'create' || builderMode === 'clone') {
        const payload: CreateRoleDTO = {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || undefined,
          status: roleForm.status,
          permissions: permsArray,
        };

        const res = await electronAPI.invoke('admin:createRole', {
          role: payload,
          token: sessionToken,
        });

        if (res.success && res.role) {
          setShowBuilderModal(false);
          loadRoles();
          onNotify?.('success', `Role "${res.role.name}" created successfully with ${permsArray.length} permissions.`);
        } else {
          setBuilderError(res.error || 'Failed to create role');
        }
      } else if (builderMode === 'edit' && editingRoleId) {
        const payload: UpdateRoleDTO = {
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          status: roleForm.status,
          permissions: permsArray,
        };

        const res = await electronAPI.invoke('admin:updateRole', {
          id: editingRoleId,
          updates: payload,
          token: sessionToken,
        });

        if (res.success && res.role) {
          setShowBuilderModal(false);
          loadRoles();
          onNotify?.('success', `Role "${res.role.name}" updated successfully.`);
        } else {
          setBuilderError(res.error || 'Failed to update role');
        }
      }
    } catch (err: any) {
      setBuilderError(err?.message || 'Error saving role');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Role Status (Activate / Deactivate)
  const handleToggleStatus = async (role: RoleDTO) => {
    if (role.isSystem) {
      onNotify?.('error', `System role "${role.name}" cannot be deactivated.`);
      return;
    }

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    const nextStatus: Status = role.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await electronAPI.invoke('admin:updateRole', {
        id: role.id,
        updates: { status: nextStatus },
        token: sessionToken,
      });
      if (res.success) {
        loadRoles();
        onNotify?.('success', `Role "${role.name}" marked as ${nextStatus}.`);
      } else {
        onNotify?.('error', res.error || 'Failed to update role status');
      }
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Error updating role status');
    }
  };

  // Safe Delete Role
  const handleDeleteRole = async () => {
    if (!deleteTargetRole) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !sessionToken) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await electronAPI.invoke('admin:deleteRole', {
        id: deleteTargetRole.id,
        token: sessionToken,
      });

      if (res.success) {
        setDeleteTargetRole(null);
        loadRoles();
        onNotify?.('success', `Role "${deleteTargetRole.name}" deleted successfully.`);
      } else {
        setDeleteError(res.error || 'Failed to delete role');
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Error deleting role');
    } finally {
      setDeleting(false);
    }
  };

  // Filter roles in list
  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
            <Shield className="w-5 h-5 text-accent" />
            <span>Roles & Permissions</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Production-grade Role-Based Access Control (RBAC) enforced authoritatively by Fastify backend and application guards
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create role</span>
          </button>
        </div>
      </div>

      {/* Roles List Card */}
      <div className="bg-surface-elevated/40 border border-border rounded-xl p-5 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search roles by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{filteredRoles.length}</span> of {roles.length} roles
          </div>
        </div>

        {/* Roles Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {loading && roles.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-accent" />
              <span>Loading roles & permissions...</span>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No roles found matching "{searchQuery}".
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated border-b border-border text-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Users</th>
                  <th className="py-3 px-4 text-center">Permissions</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-muted-foreground">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-surface-elevated transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">{role.name}</span>
                        {role.isSystem && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            SYSTEM
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                      {role.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-surface-elevated border border-border text-foreground">
                        {role.userCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {role.permissionCount} / {PERMISSION_CATALOGUE.length}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          role.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {role.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {new Date(role.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(role)}
                          title="View Details & Scope"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Role */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(role)}
                          title="Edit Role & Permissions"
                          className="p-1 rounded text-muted-foreground hover:text-accent hover:bg-surface-elevated transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Clone Role */}
                        <button
                          type="button"
                          onClick={() => handleOpenClone(role)}
                          title="Clone as New Role"
                          className="p-1 rounded text-muted-foreground hover:text-blue-400 hover:bg-surface-elevated transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle Status */}
                        {!role.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(role)}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
                          >
                            {role.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}

                        {/* Delete Role */}
                        {!role.isSystem && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTargetRole(role);
                              setDeleteError(null);
                            }}
                            title={role.userCount > 0 ? `Cannot delete: ${role.userCount} users assigned` : 'Delete Role'}
                            className={`p-1 rounded transition ${
                              role.userCount > 0
                                ? 'text-muted-foreground cursor-not-allowed'
                                : 'text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ROLE CREATION & PERMISSION BUILDER MODAL */}
      {/* ========================================================================= */}
      {showBuilderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-muted">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {builderMode === 'create'
                      ? 'New role'
                      : builderMode === 'clone'
                      ? `Clone role: ${roleForm.name}`
                      : `Edit role: ${originalRoleName}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">Configure role identity and assign server-side persisted permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuilderModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveClick} className="flex-1 overflow-y-auto p-6 space-y-6">
              {builderError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{builderError}</span>
                </div>
              )}

              {/* Top Fields: Role name, Description, Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-muted p-4 border border-border rounded-xl">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Role name <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Floor Supervisor"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Handles normal floor operations"
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={roleForm.status}
                    onChange={(e) => setRoleForm({ ...roleForm, status: e.target.value as Status })}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Selection Summary Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-surface-elevated border border-slate-700/60 rounded-xl gap-3">
                <div className="flex items-center space-x-3">
                  <div className="px-3 py-1 bg-accent/20 border border-accent/40 rounded-lg text-accent font-bold text-sm">
                    {selectedPermissions.size} selected
                  </div>
                  <div className="text-xs text-foreground">
                    of <span className="font-semibold">{PERMISSION_CATALOGUE.length} total permissions</span> in catalogue
                  </div>
                  {selectedDangerousPerms.length > 0 && (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{selectedDangerousPerms.length} Dangerous</span>
                    </span>
                  )}
                </div>

                {/* Permission Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder-slate-500 focus:outline-none focus:border-accent"
                  />
                  {permissionFilter && (
                    <button
                      type="button"
                      onClick={() => setPermissionFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Permission Categories Accordion / Cards */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Permission Categories
                </div>

                {filteredCategories.map((category) => {
                  const catPerms = category.permissions;
                  const selectedCountInCat = catPerms.filter((p) => selectedPermissions.has(p.key)).length;
                  const totalInCat = catPerms.length;
                  const isAllSelected = totalInCat > 0 && selectedCountInCat === totalInCat;
                  const isPartiallySelected = selectedCountInCat > 0 && selectedCountInCat < totalInCat;
                  const isExpanded = expandedCategories[category.name] ?? true;

                  return (
                    <div
                      key={category.name}
                      className="border border-border rounded-xl overflow-hidden bg-surface-muted transition"
                    >
                      {/* Category Header */}
                      <div className="px-4 py-3 bg-surface-elevated/70 border-b border-border flex items-center justify-between select-none">
                        <div
                          className="flex items-center space-x-3 cursor-pointer flex-1"
                          onClick={() =>
                            setExpandedCategories((prev) => ({
                              ...prev,
                              [category.name]: !isExpanded,
                            }))
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-bold text-sm text-foreground">{category.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                              selectedCountInCat === totalInCat
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : selectedCountInCat > 0
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-surface-elevated text-muted-foreground border border-border'
                            }`}
                          >
                            {selectedCountInCat} / {totalInCat}
                          </span>
                        </div>

                        {/* Select All Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(category.name, catPerms)}
                          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition border ${
                            isAllSelected
                              ? 'bg-accent/20 border-accent/40 text-accent hover:bg-accent/30'
                              : isPartiallySelected
                              ? 'bg-surface-elevated border-border text-foreground hover:bg-surface-muted'
                              : 'bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                          }`}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-accent" />
                          ) : isPartiallySelected ? (
                            <MinusSquare className="w-3.5 h-3.5 text-foreground" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span>Select all</span>
                        </button>
                      </div>

                      {/* Individual Permissions in Category */}
                      {isExpanded && (
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-surface-elevated/40">
                          {catPerms.map((perm) => {
                            const isChecked = selectedPermissions.has(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start space-x-3 p-2.5 rounded-lg border transition cursor-pointer select-none ${
                                  isChecked
                                    ? perm.dangerous
                                      ? 'bg-rose-950/20 border-rose-500/40'
                                      : 'bg-accent/10 border-accent/30'
                                    : 'bg-surface-elevated/40 border-border hover:bg-surface-elevated'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.key)}
                                  className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent bg-surface-elevated"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-semibold text-xs text-foreground truncate">
                                      {perm.displayName}
                                    </span>
                                    {perm.dangerous && (
                                      <span className="flex-shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        <span>Dangerous</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                                    {perm.key}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Total <span className="font-bold text-foreground">{selectedPermissions.size}</span> permissions selected
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowBuilderModal(false)}
                    className="px-4 py-2 rounded-lg border border-border bg-surface-elevated text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-xs font-bold transition shadow-md disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save role</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DANGEROUS PERMISSION CONFIRMATION PROMPT */}
      {/* ========================================================================= */}
      {showDangerousWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-surface border border-rose-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Critical Permission Confirmation</h4>
                <p className="text-xs text-muted-foreground">Review dangerous administrative permissions before persisting</p>
              </div>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-200 space-y-2">
              <p>
                You have assigned <span className="font-bold text-rose-300">{selectedDangerousPerms.length} dangerous permission(s)</span> to this role. These capabilities can permanently alter data, wipe fiscal records, or reset security configurations:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-rose-300">
                {selectedDangerousPerms.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-foreground">
              Are you certain you wish to grant these high-privilege permissions to role <span className="font-bold text-foreground font-mono">"{roleForm.name}"</span>?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDangerousWarning(false)}
                className="px-4 py-2 rounded-lg border border-border bg-surface-elevated text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                Go Back & Review
              </button>
              <button
                type="button"
                onClick={executeSaveRole}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md"
              >
                Confirm & Save Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ROLE DETAILS MODAL */}
      {/* ========================================================================= */}
      {detailsRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-muted">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                    <span>{detailsRole.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        detailsRole.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {detailsRole.status}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">{detailsRole.description || 'No description provided'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsRole(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stat overview */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-muted border border-border rounded-xl p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Total Permissions</div>
                  <div className="text-xl font-bold text-foreground font-mono mt-1">
                    {detailsRole.permissionCount} / {PERMISSION_CATALOGUE.length}
                  </div>
                </div>

                <div className="bg-surface-muted border border-border rounded-xl p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Assigned Users</div>
                  <div className="text-xl font-bold text-foreground font-mono mt-1">
                    {detailsRole.userCount}
                  </div>
                </div>

                <div className="bg-surface-muted border border-border rounded-xl p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Scope Type</div>
                  <div className="text-xs font-semibold text-foreground mt-2">
                    {detailsRole.permissions.includes('sales.view_all') ? 'All Records (Global)' : 'Own Records Only'}
                  </div>
                </div>
              </div>

              {/* Category Breakdown (Section 20 requirement) */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                  Permissions Breakdown by Category
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PERMISSION_CATEGORIES.map((cat) => {
                    const granted = cat.permissions.filter((p) => detailsRole.permissions.includes(p.key)).length;
                    return (
                      <div
                        key={cat.name}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          granted > 0
                            ? 'bg-surface-elevated border-slate-700/60 text-foreground'
                            : 'bg-surface-elevated/40 border-border text-muted-foreground'
                        }`}
                      >
                        <span className="font-medium truncate">{cat.name}</span>
                        <span className="font-mono font-bold text-[11px] ml-2">
                          {granted} / {cat.permissions.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dangerous Permissions List */}
              {(() => {
                const dangerousGranted = detailsRole.permissions.filter((key) => {
                  const def = PERMISSION_CATALOGUE.find((p) => p.key === key);
                  return def?.dangerous;
                });
                if (dangerousGranted.length === 0) return null;

                return (
                  <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Dangerous Administrative Permissions Granted ({dangerousGranted.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px] text-rose-300">
                      {dangerousGranted.map((k) => (
                        <div key={k} className="p-1.5 bg-rose-950/40 rounded border border-rose-500/20 truncate">
                          {k}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex justify-end bg-surface-muted">
              <button
                type="button"
                onClick={() => setDetailsRole(null)}
                className="px-4 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteTargetRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Delete Role</h4>
                <p className="text-xs text-muted-foreground">Ensure no users will be left with broken roles</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {deleteTargetRole.userCount > 0 ? (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                Cannot delete role <span className="font-bold">"{deleteTargetRole.name}"</span> because it is currently assigned to <span className="font-bold">{deleteTargetRole.userCount} user(s)</span>. Please reassign those users to another role first.
              </div>
            ) : (
              <p className="text-xs text-foreground">
                Are you sure you want to permanently delete role <span className="font-bold text-foreground">"{deleteTargetRole.name}"</span>? This action cannot be undone.
              </p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetRole(null)}
                className="px-4 py-2 rounded-lg border border-border bg-surface-elevated text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              {deleteTargetRole.userCount === 0 && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteRole}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Delete Role</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
