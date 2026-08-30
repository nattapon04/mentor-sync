"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, ShieldAlert, User as UserIcon, Code2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { User } from "@/types";
import { ROLES, Role } from "@/lib/constants";

function RoleBadge({ role }: { role: string }) {
  const { t } = useLanguage();
  if (role === "admin") return (
    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
      <ShieldAlert className="w-3 h-3" /> {t('roleAdmin')}
    </span>
  );
  if (role === "mentor") return (
    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
      <Code2 className="w-3 h-3" /> {t('roleMentor')}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
      <UserIcon className="w-3 h-3" /> {t('roleMentee')}
    </span>
  );
}

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<Role[]>(["mentee"]);
  const [newDept, setNewDept] = useState("Engineering");

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users", { params: { page, limit: 10, search: searchTerm } });
      if (data.data) {
        setUsers(data.data);
        setTotalPages(data.total_pages);
        setTotalCount(data.total);
      } else {
        setUsers(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, t('failedToLoadData')));
    }
  };

  useEffect(() => {
    if (token) fetchUsers();
  }, [token, page, searchTerm]);

  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRoles(["mentee"]);
    setNewDept("Engineering");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUserId(user.id);
    setNewName(user.name);
    setNewEmail(user.email);
    setNewPassword("");
    setNewRoles((user.roles as Role[]) ?? ["mentee"]);
    setNewDept(user.department ?? "");
    setIsModalOpen(true);
  };

  const toggleRole = (role: Role) => {
    setNewRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoles.length === 0) {
      setError(t('alertSelectRole'));
      return;
    }
    try {
      const payload = {
        name: newName,
        email: newEmail,
        passwordHash: newPassword,
        roles: newRoles,
        department: newDept,
      };
      if (editingUserId) {
        await api.put(`/users/${editingUserId}`, payload);
      } else {
        await api.post("/users", payload);
      }
      setIsModalOpen(false);
      setError(null);
      fetchUsers();
    } catch (err) {
      setError(getErrorMessage(err, t('alertSaveUserFailed')));
    }
  };

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: "", message: "", action: () => {} });

  const handleDeleteUser = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: t('deleteUserTitle'),
      message: t('deleteUserMessage'),
      action: async () => {
        try {
          await api.delete(`/users/${id}`);
          fetchUsers();
        } catch (err) {
          setError(getErrorMessage(err, t('alertDeleteUserFailed')));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('userManagement')}</h1>
          <p className="text-muted-foreground mt-1">{t('userManagementDesc')}</p>
        </div>
        <button onClick={handleOpenCreateModal} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-5 h-5" />
          {t('addNewUser')}
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center bg-muted/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('searchUsers')}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">{t('userColumn')}</th>
                <th className="px-6 py-4 font-semibold">{t('rolesColumn')}</th>
                <th className="px-6 py-4 font-semibold">{t('departmentColumn')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actionsColumn')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(user.roles ?? []).map(role => <RoleBadge key={role} role={role} />)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{user.department}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleOpenEditModal(user)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-muted-foreground hover:text-rose-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('showingPage')} {page} {t('ofPage')} {totalPages} ({t('totalUsers')}: {totalCount})</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {t('previous')}
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {t('next')}
            </button>
          </div>
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveUser}>
              <div className="p-6 space-y-4">
                <h3 className="text-xl font-bold text-foreground">{editingUserId ? t('editUser') : t('addNewUser')}</h3>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{t('fullName')}</label>
                  <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{t('email')}</label>
                  <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{editingUserId ? t('newPasswordBlank') : t('temporaryPassword')}</label>
                  <input required={!editingUserId} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" />
                </div>

                {/* Multi-Role Checkboxes */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">{t('roles')} <span className="text-muted-foreground font-normal">({t('selectOneOrMore')})</span></label>
                  <div className="flex gap-3">
                    {ROLES.map(role => (
                      <label key={role} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${newRoles.includes(role) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={newRoles.includes(role)}
                          onChange={() => toggleRole(role)}
                        />
                        <span className="text-sm font-semibold capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{t('department')}</label>
                  <input type="text" value={newDept} onChange={e => setNewDept(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">{t('cancelModal')}</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">{t('saveUserBtn')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.action}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
}
