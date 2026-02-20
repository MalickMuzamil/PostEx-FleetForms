import { FormsModule } from '@angular/forms';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { environment } from '../../../environment/environment';

type UserData = {
  email?: string;
  name?: string;
  roles?: string[];
};

type UserRow = { id: string; name: string; email: string; role: string; active: boolean };

type UiRole = 'USER' | 'ADMIN';

@Component({
  selector: 'app-management-page',
  standalone: true,
  imports: [
    NzLayoutModule,
    FormsModule,
    NzMenuModule,
    NzIconModule,
    NzButtonModule,
    NzCardModule,
    NzTableModule,
    NzModalModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    NzAlertModule,
    CommonModule,
    NzResultModule,
    NzPopconfirmModule
  ],
  templateUrl: './management-page.html',
  styleUrls: ['./management-page.css']
})
export class ManagementPage implements OnInit {
  isAdmin = false;

  loading = false;
  users: UserRow[] = [];
  filteredUsers: UserRow[] = [];

  search = '';
  roleFilter: UiRole | null = null;
  statusFilter: 'active' | 'inactive' | null = null;

  modalVisible = false;
  saving = false;
  editing: UserRow | null = null;

  form: { name: string; lastName: string; email: string; role: UiRole } = {
    name: '',
    lastName: '',
    email: '',
    role: 'USER'
  };

  error = '';
  toast = '';

  ngOnInit(): void {
    const userData = this.getUserDataFromStorage();
    const roles = (userData?.roles || []).map(r => String(r).toLowerCase());
    this.isAdmin = roles.includes('postex-auth-admin');

    if (!this.isAdmin) return;

    this.loadUsers();
  }

  private getUserDataFromStorage(): UserData | null {
    try {
      const raw = localStorage.getItem('postex.user');
      if (!raw) return null;
      return JSON.parse(raw) as UserData;
    } catch {
      return null;
    }
  }

  private showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => (this.toast = ''), 2000);
  }

  private isAllowedEmail(email: string): boolean {
    return email.toLowerCase().endsWith('@postexglobal.com');
  }

  private mapRoleForBackend(uiRole: UiRole): string {
    const r = (uiRole || '').toUpperCase();

    if (r === 'ADMIN') return 'postex-auth-admin';
    return 'USER';
  }

  applyFilter(): void {
    const s = this.search.trim().toLowerCase();

    this.filteredUsers = this.users.filter(u => {
      const matchesSearch =
        !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);

      const matchesRole = !this.roleFilter || (u.role as UiRole) === this.roleFilter;

      const matchesStatus =
        !this.statusFilter || (this.statusFilter === 'active' ? u.active : !u.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  resetFilters(): void {
    this.search = '';
    this.roleFilter = null;
    this.statusFilter = null;
    this.applyFilter();
  }

  openCreate(): void {
    this.error = '';
    this.editing = null;
    this.form = { name: '', lastName: '', email: '', role: 'USER' };
    this.modalVisible = true;
  }

  openEdit(u: UserRow): void {
    this.error = '';
    this.editing = u;

    const parts = (u.name || '').trim().split(/\s+/);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');

    this.form = {
      name: firstName,
      lastName,
      email: u.email,
      role: (u.role as UiRole) || 'USER'
    };

    this.modalVisible = true;
  }

  closeModal(): void {
    this.modalVisible = false;
    this.editing = null;
    this.error = '';
  }

  save(): void {
    this.error = '';

    const firstName = this.form.name.trim();
    const lastName = (this.form.lastName || '').trim() || 'Postex';
    const email = this.form.email.trim().toLowerCase();
    const uiRole: UiRole = this.form.role;

    if (!firstName) { this.error = 'First name is required'; return; }
    if (!email) { this.error = 'Email is required'; return; }
    if (!this.isAllowedEmail(email)) { this.error = 'Only @postexglobal.com emails allowed'; return; }

    const backendRole = this.mapRoleForBackend(uiRole);

    this.saving = true;

    (async () => {
      try {
        // ✅ EDIT FLOW
        if (this.editing) {
          const userId = this.editing.id;

          const payload = {
            firstName,
            lastName,
            roles: [backendRole],
            metadata: { updatedBy: 'ui' },
            status: this.editing.active ? 'active' : 'inactive'
          };

          await this.updateUserOnServer(userId, payload);

          // ✅ Update UI row locally
          this.users = this.users.map(x =>
            x.id === userId
              ? {
                ...x,
                name: `${firstName} ${lastName}`.trim(),
                role: backendRole, // (UI me ADMIN/USER chahiye ho to uiRole rakh lena)
              }
              : x
          );

          this.applyFilter();
          this.showToast('User updated');
          this.modalVisible = false;
          this.editing = null;
          return;
        }

        // ✅ CREATE FLOW (same as before)
        const payload = {
          email,
          firstName,
          lastName,
          roles: [backendRole]
        };

        await this.createUserOnServer(payload);
        await this.loadUsers();

        this.showToast('User created on server');
        this.modalVisible = false;
      } catch (e: any) {
        this.error = e?.message || (this.editing ? 'Update user failed' : 'Create user failed');
      } finally {
        this.saving = false;
      }
    })();
  }

  toggleActive(u: { id: string }, active: boolean): void {
    this.users = this.users.map(x => (x.id === u.id ? { ...x, active } : x));
    this.applyFilter();
    this.showToast(active ? 'User activated' : 'User deactivated');
  }

  async deleteUser(u: { id: string }): Promise<void> {
    this.error = '';

    try {
      await this.deleteUserOnServer(u.id);

      // ✅ refresh from backend
      await this.loadUsers();

      this.showToast('User deleted');
    } catch (e: any) {
      this.error = e?.message || 'Delete user failed';
    }
  }

  private async createUserOnServer(payload: any) {
    const url = `${environment.POSTEX_BASE_URL}/public/v1/tenant/users`;

    // const accessToken = localStorage.getItem('auth_sdk_refresh_token');
    const accessToken = this.getAccessToken();
    if (!accessToken) throw new Error('Access token missing. Please login again.');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || data?.error?.message || `Create user failed (${res.status})`);
    }

    return data;
  }

  private getAccessToken(): string {
    const token = localStorage.getItem('postex.access_token');
    if (!token) throw new Error('Access token missing. Please login again.');
    return token;
  }

  private async fetchUsersFromServer(): Promise<UserRow[]> {
    const url = `${environment.POSTEX_BASE_URL}/public/v1/tenant/users`;
    const token = this.getAccessToken();

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || data?.error?.message || `Fetch users failed (${res.status})`);
    }

    const list = data?.data?.users;

    if (!Array.isArray(list)) {
      throw new Error('Unexpected response: users list not found');
    }

    return list.map((u: any) => ({
      id: String(u.id ?? ''),
      name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      email: String(u.email ?? ''),
      role: String(u.roles?.[0] ?? 'USER'),
      active: Boolean(u.enabled)
    }));
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const rows = await this.fetchUsersFromServer();
      this.users = rows;
      this.applyFilter();
    } catch (e: any) {
      this.error = e?.message || 'Failed to load users';
      this.users = [];
      this.filteredUsers = [];
    } finally {
      this.loading = false;
    }
  }

  private async updateUserOnServer(userId: string, payload: any) {
    const url = `${environment.POSTEX_BASE_URL}/public/v1/tenant/users/${encodeURIComponent(userId)}`;

    const accessToken = this.getAccessToken();

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || data?.error?.message || `Update user failed (${res.status})`);
    }

    return data;
  }

  private async deleteUserOnServer(userId: string) {
    const url = `${environment.POSTEX_BASE_URL}/public/v1/tenant/users/${encodeURIComponent(
      userId
    )}?permanent=true`;

    const accessToken = this.getAccessToken();

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || data?.error?.message || `Delete user failed (${res.status})`);
    }

    return data;
  }
}
