import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of, map } from 'rxjs';

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

        this.subBranches = (rows || [])
          .map((x: any) => {
            const id = Number(x.SubBranchID) || null;
            const name = String(x.SubBranchName ?? '').trim();

            // ✅ EXACT backend keys
            const branchId =
              x.BranchID !== undefined && x.BranchID !== null
                ? Number(x.BranchID)
                : null;

            const branchName =
              x.BranchName !== undefined && x.BranchName !== null
                ? String(x.BranchName).trim()
                : '';

            if (!id || !name) return null;

            return {
              value: id,
              label: `${branchName} - (${name})`,
              id,
              name,
              branchId,
              branchName,
              meta: { id, name, branchId, branchName },
              searchText: `${id} ${name} ${
                branchId ?? ''
              } ${branchName}`.trim(),
              raw: x,
            };
          })
          .filter(Boolean);

        this.patchFormOptions();
        this.formConfig = { ...this.formConfig };
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

        this.employees = (list || [])
          .filter((e: any) => Number(e.APP_ACTIVE ?? 1) === 1)
          .map((e: any) => {
            const id = Number(e.EMP_ID) || null;
            if (!id) return null;

            const name = String(
              e.EmployeeName ?? e.APP_Name ?? e.AppName ?? ''
            ).trim();
            const departmentName = String(e.DepartmentName ?? '').trim();
            const designationName = String(e.DesignationName ?? '').trim();

            return {
              value: id,
              label: `${name}`,
              searchText:
                `${id} ${name} ${departmentName} ${designationName}`.trim(),
              meta: {
                id,
                name,
                departmentName,
                designationName,
              },
              raw: e,
            };
          })
          .filter(Boolean);

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

    this.formConfig = {
      ...this.formConfig,
      title: this.formConfig?.title ?? base.title,
      fields: base.fields.map((f: any) => {
        if (f.key === 'subBranchId') {
          return {
            ...f,
            searchable: true,
            options$: of(this.subBranches ?? []).pipe(
              map((opts) =>
                (opts || []).map((o: any) => ({
                  ...o,
                  // ✅ VERY IMPORTANT: columns are rendered from meta
                  meta: {
                    id: o.id,
                    name: o.name,
                    branchId: o.branchId,
                    branchName: o.branchName,
                  },
                }))
              )
            ),
          };
        }

        if (f.key === 'employeeId') {
          return {
            ...f,
            searchable: true,
            options$: of(this.employees ?? []),
          };
        }

        return f;
      }),
    };
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
    const prevSub = Number(this.data?.subBranchId) || null;

    // merge latest form
    if (evt?.formValue) this.data = { ...this.data, ...evt.formValue };
    if (evt?.key && evt.key !== '__form__')
      this.data = { ...this.data, [evt.key]: evt.value };

    // ✅ NEW: __form__ se bhi subBranchId change detect
    const nextSub = Number(this.data?.subBranchId) || null;

    if (
      evt.key === 'subBranchId' ||
      (evt.key === '__form__' && prevSub !== nextSub)
    ) {
      const subId = nextSub;

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

      this.loadEmployeesByBranch(branchId, false);
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
