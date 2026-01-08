import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

import {
  SUB_BRANCH_ASSIGNMENT_DEFINITION_FORM,
  SUB_BRANCH_ASSIGNMENT_DEFINITION_TABLE,
} from './sub-branch-assignment-definition-component-config';
import { SubBranchAssignmentDefinitionService } from '../../core/services/sub-branch-assignment-definition-service';


@Component({
  selector: 'app-sub-branch-assignment-definition',
  imports: [Table, Modal, NzModalModule],
  templateUrl: './sub-branch-assignment-definition.html',
  styleUrl: './sub-branch-assignment-definition.css',
})
export class SubBranchAssignmentDefinition implements OnInit {
  // ===== CONFIGS =====
  formConfig: any = { ...SUB_BRANCH_ASSIGNMENT_DEFINITION_FORM };
  tableConfig = SUB_BRANCH_ASSIGNMENT_DEFINITION_TABLE;

  // ===== STATE =====
  showModal = false;
  data: any = {};
  tableData: any[] = [];

  // ===== DROPDOWNS =====
  subBranches: any[] = [];
  employees: any[] = []; // depends on selected sub-branch => branch

  // ===== EDIT MODE =====
  isEditMode = false;
  editingRow: any = null;

  constructor(
    private service: SubBranchAssignmentDefinitionService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) {}

  ngOnInit(): void {
    this.loadTable();
    this.loadSubBranches();
    this.patchFormOptions();
  }

  // ================= TABLE =================
  loadTable() {
    this.service.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        this.tableData = rows.map((r: any) => {
          const statusFlag =
            Number(
              r.StatusFlag ?? r.statusFlag ?? r.APP_ACTIVE ?? r.ActiveFlag
            ) === 0
              ? 0
              : 1;

          return {
            id: r.ID ?? r.Id,

            subBranchId: r.SubBranchID ?? r.Sub_Branch_ID ?? r.SubBranchId,
            subBranchName:
              r.SubBranchName ?? r.Sub_Branch_Name ?? r.SubBranchName,

            branchId: r.BranchID ?? r.BranchId,
            branchName: r.BranchName ?? r.Branch_Name ?? r.BranchName,

            employeeId: r.EMP_ID ?? r.EmployeeID ?? r.EmployeeId,
            employeeName:
              r.EmployeeName ?? r.APP_Name ?? r.EmpName ?? r.EmployeeName,

            email: r.Email ?? r.EmailAddress ?? r.email,

            effectiveDate: r.EffectiveDate
              ? new Date(r.EffectiveDate).toISOString().split('T')[0]
              : null,

            statusFlag,
            statusText: statusFlag === 1 ? 'ACTIVE' : 'INACTIVE',
          };
        });
      },
      error: () =>
        this.notification.error('Error', 'Failed to load assignments'),
    });
  }

  // ================= DROPDOWNS =================
  loadSubBranches() {
    this.service.getSubBranches().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        this.subBranches = rows
          .map((x: any) => {
            const id =
              Number(x.SubBranchID ?? x.Sub_Branch_ID ?? x.Id ?? x.value) ||
              null;
            const name = String(
              x.SubBranchName ?? x.Sub_Branch_Name ?? x.Name ?? x.label ?? ''
            ).trim();
            const branchId = Number(x.BranchID ?? x.BranchId) || null;
            const branchName = String(
              x.BranchName ?? x.Branch_Name ?? ''
            ).trim();

            if (!id || !name) return null;

            return {
              value: id,
              label: `${id} - ${name}`,
              id,
              name,
              branchId,
              branchName,

              // for optionColumns
              subBranchId: id,
              subBranchName: name,

              raw: x,
            };
          })
          .filter(Boolean);

        this.patchFormOptions();
      },
      error: () =>
        this.notification.error('Error', 'Failed to load sub-branches'),
    });
  }

  loadEmployeesByBranch(branchId: number | null, keepSelected = false) {
    const bid = Number(branchId) || null;

    if (!bid) {
      this.employees = [];
      this.patchFormOptions();
      return;
    }

    this.service.getActiveEmployeesByBranch(bid).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res ?? [];

        this.employees = list
          .filter((e: any) => Number(e.APP_ACTIVE ?? e.Active ?? 1) === 1)
          .map((e: any) => {
            const id = Number(e.EMP_ID ?? e.EmployeeId ?? e.Id) || null;
            const name = String(e.APP_Name ?? e.Name ?? '').trim();
            const cnic = String(e.CNIC ?? e.Cnic ?? '').trim();

            return {
              value: id,
              label: `${id} - ${name}`.trim(),
              id,
              name,
              cnic,
              raw: e,
            };
          })
          .filter((x: any) => !!x.value);

        this.patchFormOptions();

        if (keepSelected && this.data?.employeeId) {
          const ok = this.employees.some(
            (x: any) => Number(x.value) === Number(this.data.employeeId)
          );
          if (!ok) this.data = { ...this.data, employeeId: null };
        }
      },
      error: () => this.notification.error('Error', 'Failed to load employees'),
    });
  }

  // ================= PATCH FORM OPTIONS =================
  private patchFormOptions() {
    const base = SUB_BRANCH_ASSIGNMENT_DEFINITION_FORM;

    const patched = {
      ...base,
      title: this.formConfig?.title ?? base.title,
      fields: base.fields.map((f: any) => {
        if (f.key === 'subBranchId')
          return { ...f, options: this.subBranches ?? [] };
        if (f.key === 'employeeId')
          return { ...f, options: this.employees ?? [] };
        return f;
      }),
    };

    // ✅ if modal is open, don't break reference too aggressively
    if (this.showModal && this.formConfig) {
      (this.formConfig as any).fields = patched.fields;
    } else {
      this.formConfig = patched;
    }
  }

  // ================= MODAL =================
  openAddForm() {
    this.isEditMode = false;
    this.editingRow = null;

    this.employees = [];
    this.data = { statusFlag: 1 };

    this.showModal = true;
    this.formConfig = {
      ...SUB_BRANCH_ASSIGNMENT_DEFINITION_FORM,
      title: 'Add Sub-Branch Assignment',
    };
    this.patchFormOptions();
  }

  openEditForm(row: any) {
    this.isEditMode = true;
    this.editingRow = row;

    const subBranchId = Number(row.subBranchId) || null;
    const branchId = Number(row.branchId) || null;
    const employeeId = Number(row.employeeId) || null;

    this.data = {
      subBranchId,
      subBranchName: row.subBranchName ?? '',
      branchId,
      branchName: row.branchName ?? '',
      employeeId,
      email: row.email ?? '',
      effectiveDate: row.effectiveDate ? new Date(row.effectiveDate) : null,
      statusFlag: Number(row.statusFlag) === 0 ? 0 : 1,
    };

    // ✅ seed employee option so dropdown blank na ho
    this.employees = employeeId
      ? [
          {
            value: employeeId,
            label: `${employeeId} - ${row.employeeName ?? ''}`.trim(),
            id: employeeId,
            name: row.employeeName ?? '',
          },
        ]
      : [];

    this.showModal = true;
    this.formConfig = {
      ...SUB_BRANCH_ASSIGNMENT_DEFINITION_FORM,
      title: 'Edit Sub-Branch Assignment',
    };
    this.patchFormOptions();

    // ✅ load real employees for branch
    this.loadEmployeesByBranch(branchId, true);

    // ensure reference refresh
    this.data = { ...this.data };
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= FORM CHANGE =================
  onFormChange(evt: { key: string; value: any; formValue: any }) {
    // Avoid overwriting blur-pending controls: apply only changed key
    if (evt?.key) this.data = { ...this.data, [evt.key]: evt.value };
    else if (evt?.formValue) this.data = { ...this.data, ...evt.formValue };

    // ✅ When Sub-Branch changes => auto fill details + load employees by branch
    if (evt.key === 'subBranchId') {
      const subId = Number(evt.value) || null;

      // reset dependent fields
      this.data = {
        ...this.data,
        subBranchName: '',
        branchId: null,
        branchName: '',
        employeeId: null,
      };

      this.employees = [];
      this.patchFormOptions();

      if (!subId) return;

      const sb = this.subBranches.find((x: any) => Number(x.value) === subId);
      const branchId = Number(sb?.branchId) || null;

      this.data = {
        ...this.data,
        subBranchName: sb?.name ?? '',
        branchId,
        branchName: sb?.branchName ?? '',
      };

      // load active employees of that branch
      this.loadEmployeesByBranch(branchId, false);
      return;
    }

  }

  // ================= SUBMIT =================
  async onSubmit(formValue: any) {
    const payload: any = {
      subBranchId: Number(formValue?.subBranchId) || null,
      employeeId: Number(formValue?.employeeId) || null,
      email: String(formValue?.email ?? '').trim(),

      effectiveDate: formValue?.effectiveDate
        ? new Date(formValue.effectiveDate).toISOString().split('T')[0]
        : null,

      statusFlag: Number(formValue?.statusFlag) === 0 ? 0 : 1,
    };

    // ✅ EDIT
    if (this.isEditMode && this.editingRow?.id) {
      this.service.update(Number(this.editingRow.id), payload).subscribe({
        next: () => {
          this.notification.success('Success', 'Updated successfully');
          this.showModal = false;
          this.loadTable();
        },
        error: (e) => {
          const { message } = this.parseBackendError(e);
          this.notification.error('Error', message || 'Update failed');
        },
      });
      return;
    }

    // ✅ CREATE + overwrite confirm
    this.service.create(payload).subscribe({
      next: () => {
        this.notification.success('Success', 'Saved successfully');
        this.showModal = false;
        this.loadTable();
      },
      error: async (e) => {
        if (this.isConfirmOverwriteError(e)) {
          const { message, conflict } = this.parseBackendError(e);
          const existingDate = this.formatYMD(conflict?.ExistingEffectiveDate);

          const ok = await this.confirmOverwrite(message, existingDate);
          if (!ok) return;

          this.service.create({ ...payload, force: true }).subscribe({
            next: () => {
              this.notification.success('Success', 'Saved successfully');
              this.showModal = false;
              this.loadTable();
            },
            error: (e2) => {
              const { message: m2 } = this.parseBackendError(e2);
              this.notification.error('Error', m2 || 'Save failed');
            },
          });
          return;
        }

        const { message } = this.parseBackendError(e);
        this.notification.error('Error', message || 'Save failed');
      },
    });
  }

  // ================= ACTIONS =================
  delete(row: any) {
    if (!confirm('Delete this assignment?')) return;

    this.service.delete(Number(row.id)).subscribe({
      next: () => {
        this.notification.success('Success', 'Deleted');
        this.loadTable();
      },
      error: () => this.notification.error('Error', 'Delete failed'),
    });
  }

  // ================= CONFIRM MODAL =================
  private confirmOverwrite(
    message: string,
    existingDate?: string | null
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.modal.confirm({
        nzTitle: 'Confirmation Required',
        nzContent: `
          <div>
            <p>${message || 'Confirm overwrite?'}</p>
            ${
              existingDate
                ? `<p style="margin-top:8px">
                     <strong>Existing Effective Date:</strong>
                     <span style="color:#d46b08">${existingDate}</span>
                   </p>`
                : ''
            }
          </div>
        `,
        nzOkText: 'OK',
        nzCancelText: 'Cancel',
        nzOnOk: () => resolve(true),
        nzOnCancel: () => resolve(false),
      });
    });
  }

  private formatYMD(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  private parseBackendError(err: any): {
    message: string;
    status?: number;
    code?: string;
    conflict?: any;
  } {
    const status = err?.status;
    const body = err?.error;

    const message =
      body?.message || body?.error?.message || err?.message || 'Request failed';

    const code = body?.code || body?.error?.code;

    // ✅ IMPORTANT: backend sends "conflict"
    const conflict = body?.conflict || body?.error?.conflict;

    return { message, status, code, conflict };
  }

  private isConfirmOverwriteError(err: any): boolean {
    const { status, code, message } = this.parseBackendError(err);
    if (status === 409) return true;
    if (code === 'CONFIRM_OVERWRITE' || code === 'CONFIRM_OVERWRITE_BULK')
      return true;
    return /confirm overwrite/i.test(message || '');
  }
}
