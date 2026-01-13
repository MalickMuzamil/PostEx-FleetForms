import { Component, OnInit } from '@angular/core';
import { OPS_CNC_L3_DEFINITION_FORM, OPS_CNC_L3_DEFINITION_TABLE } from './cnc-l3-definition-config';
import { OpsCnCL3DefinitionService } from '../../../core/services/ops-cnc-L3-service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Modal } from '../../../ui/modal/modal';
import { Table } from '../../../ui/table/table';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cnc-l3',
  imports: [Table, Modal, CommonModule],
  templateUrl: './cnc-l3.html',
  styleUrl: './cnc-l3.css',
})
export class CncL3 implements OnInit {
 formConfig = OPS_CNC_L3_DEFINITION_FORM;
  tableConfig = OPS_CNC_L3_DEFINITION_TABLE;

  rows: any[] = [];
  loading = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};

  constructor(
    private service: OpsCnCL3DefinitionService,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (res: any) => {
        this.rows = Array.isArray(res) ? res : res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notification.error('Error', err?.error?.message || 'Failed to load data');
      },
    });
  }

  openAdd(): void {
    this.isEdit = false;
    this.selectedId = null;

    this.formData = { role: null, id: null };

    this.service.getRoles().subscribe({
      next: (res: any) => {
        const roles = Array.isArray(res?.data) ? res.data : [];
        this.formData = { ...this.formData, role: roles?.[0]?.role ?? null };
        this.showForm = true;
      },
      error: () => (this.showForm = true),
    });
  }

  openEdit(row: any): void {
    this.isEdit = true;
    this.selectedId = row?.id ?? null;
    this.formData = { ...row };
    this.showForm = true;
  }

  onDelete(row: any): void {
    const id = row?.id;
    if (!id) return;

    this.modal.confirm({
      nzTitle: 'Confirm Delete',
      nzContent: `Are you sure you want to delete ID ${id}?`,
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.service.delete(id).subscribe({
          next: (res: any) => {
            this.notification.success('Success', res?.message || 'Deleted successfully');
            this.load();
          },
          error: (err) => {
            this.notification.error('Error', err?.error?.message || 'Delete failed');
          },
        });
      },
    });
  }

  onSubmit(payload: any): void {
    const currentUser = this.getCurrentUser();
    const nowIso = new Date().toISOString();

    const base = {
      name: (payload?.name ?? '').toString().trim(),
      description: payload?.description,
      role: payload?.role ?? this.formData?.role ?? null,
    };

    // ✅ CREATE
    if (!this.isEdit) {
      const body = {
        ...base,
        enteredOn: nowIso,
        enteredBy: currentUser,
        editedOn: null,
        editedBy: null,
      };

      this.service.create(body).subscribe({
        next: (res: any) => {
          const newId = res?.data?.Ops_CnC_L3_Id ?? res?.data?.id;
          this.notification.success(
            'Success',
            newId
              ? `${res?.message || 'Created successfully'} (ID: ${newId})`
              : (res?.message || 'Created successfully')
          );
          this.showForm = false;
          this.load();
        },
        error: (err) => {
          this.notification.error('Error', err?.error?.message || 'Create failed');
        },
      });

      return;
    }

    // ✅ UPDATE
    if (!this.selectedId) return;

    const body = {
      ...base,
      enteredOn: this.formData?.enteredOn ?? null,
      enteredBy: this.formData?.enteredBy ?? null,
      editedOn: nowIso,
      editedBy: currentUser,
    };

    this.service.update(this.selectedId, body).subscribe({
      next: (res: any) => {
        this.notification.success('Success', res?.message || 'Updated successfully');
        this.showForm = false;
        this.load();
      },
      error: (err) => {
        this.notification.error('Error', err?.error?.message || 'Update failed');
      },
    });
  }

  closeForm(): void {
    this.showForm = false;
  }

  private getCurrentUser(): string {
    const raw =
      localStorage.getItem('currentUser') ||
      localStorage.getItem('user') ||
      localStorage.getItem('username') ||
      '';

    try {
      const obj = JSON.parse(raw);
      const u = (obj?.username || obj?.name || obj?.email || '').toString().trim();
      return u || 'Admin';
    } catch {
      const u = (raw || '').toString().trim();
      return u || 'Admin';
    }
  }
}
