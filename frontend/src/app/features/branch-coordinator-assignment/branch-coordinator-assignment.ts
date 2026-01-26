import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BRANCH_COORDINATOR_ASSIGNMENT_FORM,
  BRANCH_COORDINATOR_ASSIGNMENT_TABLE,
} from './branch-coordinator-assignment.config';
import { BranchCoordinatorService } from '../../core/services/branch-coordinator-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize, forkJoin, map, shareReplay, tap } from 'rxjs';

type BranchDetails = {
  id: number;
  name: string;
  desc?: string;
  email?: string;
  phone?: string;
  address?: string;
};

@Component({
  selector: 'app-branch-coordinator-assignment',
  standalone: true,
  imports: [CommonModule, Table, Modal],
  templateUrl: './branch-coordinator-assignment.html',
})
export class BranchCoordinatorAssignment implements OnInit {
  formConfig = { ...BRANCH_COORDINATOR_ASSIGNMENT_FORM };
  tableConfig = BRANCH_COORDINATOR_ASSIGNMENT_TABLE;

  showModal = false;
  selectedId: number | null = null;

  data: any = {};
  tableData: any[] = [];

  private branchDetailsMap = new Map<number, BranchDetails>();
  private empMap = new Map<number, string>();
  private branches$!: any;
  private employees$!: any;
  private branchOptions: any[] = [];
  private employeeOptions: any[] = [];
  private branchesLoaded = false;
  private employeesLoaded = false;

  constructor(
    private service: BranchCoordinatorService,
    private notification: NzNotificationService,
    private modal: NzModalService,
  ) {}

  // ✅ compact: converts "YYYY-MM-DD" into local Date (no timezone issues)
  private asLocalDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;

    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const y = +v.slice(0, 4);
      const m = +v.slice(5, 7);
      const d = +v.slice(8, 10);
      return new Date(y, m - 1, d);
    }

    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }

  ngOnInit() {
    this.branches$ = this.service.getBranches().pipe(
      map((res: any) => res?.data ?? res ?? []),
      shareReplay(1),
    );

    this.employees$ = this.service.getEmployees().pipe(
      map((res: any) => res?.data ?? res ?? []),
      shareReplay(1),
    );

    // this.loadBranchesAndEmployeesForForm();
    // this.warmupDropdownCaches();
    this.loadTable();
  }

  // ================= TABLE =================
  loadTable() {
    forkJoin({
      branches: this.branches$,
      employees: this.employees$,
      bindingsRes: this.service.getAll(), // should return PrevEmpName/NextEmpName/EndDate if backend changed
    })
      .pipe(
        map(({ branches, employees, bindingsRes }: any) => {
          const bindings = bindingsRes?.data ?? bindingsRes ?? [];

          const branchMap = new Map<number, string>(
            (branches || []).map((b: any) => [
              +(b.Branch_ID ?? b.BranchID ?? b.ID),
              (b.Branch_Name ?? b.BranchName ?? b.Name ?? '').trim(),
            ]),
          );

          const empMap = new Map<number, string>(
            (employees || []).map((e: any) => [
              +(e.EMP_ID ?? e.EmpId ?? e.ID),
              (e.APP_Name ?? e.Name ?? '').trim(),
            ]),
          );

          const fmt = (dt: Date | null) => {
            if (!dt) return '';
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
              2,
              '0',
            )}-${String(dt.getDate()).padStart(2, '0')}`;
          };

          return (bindings || []).map((r: any) => {
            const branchId = +(r.BranchID ?? r.branchId);
            const empId = +(r.BC_Emp_ID ?? r.employeeId);

            const rawStart = r.EffectiveDate ?? r.effectiveDate;
            const startDate = this.asLocalDate(rawStart);

            // ✅ backend should provide EndDate OR NextEffectiveDate (depends on your query)
            const rawEnd = r.EndDate ?? r.endDate;
            const endDate = this.asLocalDate(rawEnd);

            // ✅ prev/next owner names (prefer backend-provided names)
            const prevOwner =
              (r.PrevEmpName ?? '').trim() ||
              (r.PrevEmpId != null ? empMap.get(+r.PrevEmpId) : '') ||
              '-';

            const nextOwner =
              (r.NextEmpName ?? '').trim() ||
              (r.NextEmpId != null ? empMap.get(+r.NextEmpId) : '') ||
              '-';

            const effectiveDateDisplay = fmt(startDate);
            const endDateDisplay = endDate ? fmt(endDate) : 'Present'; // nice UX

            return {
              id: r.ID ?? r.id,

              branchId,
              branchName: branchMap.get(branchId) ?? 'NA',

              employeeId: empId,
              employeeName: empMap.get(empId) ?? r.EmployeeName ?? 'NA',

              email: r.BC_Email ?? r.email,

              // edit
              effectiveDate: startDate,

              // table
              effectiveDateDisplay,
              endDateDisplay,

              // 🔥 new timeline fields
              prevOwner,
              nextOwner,

              // optional label if backend sends ChangeType
              changeType: r.ChangeType ?? '',
            };
          });
        }),
      )
      .subscribe((rows) => (this.tableData = rows));
  }

  // ================= DROPDOWNS =================
  loadBranchesAndEmployeesForForm() {
    // ===== Branch dropdown =====
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId',
    );
    if (branchField) {
      branchField.loading = true;

      const branchesOptions$ = this.branches$.pipe(
        tap((branches: any[]) => {
          this.branchDetailsMap.clear();

          (branches || []).forEach((b: any) => {
            const id = +(b.Branch_ID ?? b.BranchID ?? b.ID);
            if (Number.isNaN(id)) return;

            const name = (b.Branch_Name ?? b.BranchName ?? b.Name ?? '').trim();
            const desc = (b.BranchDesc ?? b.Branch_Desc ?? '').trim();
            const email = (b.BEMAIL ?? b.BEmail ?? b.Email ?? '').trim();
            const phone = (b.BPHONE ?? b.BPhone ?? b.Phone ?? '').trim();
            const address = (
              b.BADDRESS ??
              b.BAddress ??
              b.Address ??
              ''
            ).trim();

            this.branchDetailsMap.set(id, {
              id,
              name,
              desc,
              email,
              phone,
              address,
            });
          });
        }),
        map((branches: any[]) =>
          (branches || [])
            .map((b: any) => {
              const id = +(b.Branch_ID ?? b.BranchID ?? b.ID);
              if (Number.isNaN(id)) return null;

              const name = (
                b.Branch_Name ??
                b.BranchName ??
                b.Name ??
                ''
              ).trim();
              const desc = (b.BranchDesc ?? b.Branch_Desc ?? '').trim();
              const phone = (b.BPHONE ?? b.BPhone ?? b.Phone ?? '').trim();
              const address = (
                b.BADDRESS ??
                b.BAddress ??
                b.Address ??
                ''
              ).trim();

              return {
                label: name,
                value: id,
                searchText: `${id} ${name} ${desc} ${phone} ${address}`.trim(),
                meta: { id, name, desc, phone, address },
              };
            })
            .filter(Boolean),
        ),
        finalize(() => (branchField.loading = false)),
      );

      branchField.options$ = branchesOptions$ as any;
      branchField.searchable = true;
    }

    // ===== Employee dropdown =====
    const empField = this.formConfig.fields.find((f) => f.key === 'employeeId');
    if (empField) {
      empField.loading = true;

      const employeesOptions$ = this.employees$.pipe(
        tap((emps: any[]) => {
          this.empMap.clear();
          (emps || []).forEach((e: any) => {
            const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
            const name = (e.APP_Name ?? e.Name ?? '').trim();
            if (!Number.isNaN(id)) this.empMap.set(id, name);
          });
        }),
        map((emps: any[]) =>
          (emps || [])
            .map((e: any) => {
              const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
              if (Number.isNaN(id)) return null;

              const name = (e.APP_Name ?? e.Name ?? '').trim();
              const dept = (e.DepartmentName ?? e.DEP_DESC ?? '').trim();
              const desig = (e.DesignationName ?? e.DES_DESC ?? '').trim();

              return {
                label: name,
                value: id,
                searchText: `${id} ${name} ${dept} ${desig}`.trim(),
                meta: {
                  id,
                  name,
                  department: dept,
                  designation: desig,
                },
              };
            })
            .filter(Boolean),
        ),
        finalize(() => (empField.loading = false)),
      );

      empField.options$ = employeesOptions$ as any;
      empField.searchable = true;
    }
  }

  onFormChange(ev: any) {
    if (!ev || !ev.key) return;

    const key = ev.key;
    const value = ev.value;

    // ✅ Email typing: MUTATE (prevents lag)
    if (key === 'email') {
      const next = (value ?? '').toString();
      if (this.data?.email === next) return;
      this.data.email = next;
      return;
    }

    // ✅ Effective Date: keep Date|null (mutate)
    if (key === 'effectiveDate') {
      this.data.effectiveDate = value ? this.asLocalDate(value) : null;
      return;
    }

    // ✅ Branch: mutate only
    if (key === 'branchId') {
      const branchId = +value;
      if (+this.data?.branchId === branchId) return;
      this.data.branchId = branchId;
      return;
    }

    // ✅ Employee: mutate only
    if (key === 'employeeId') {
      const employeeId = +value;
      if (+this.data?.employeeId === employeeId) return;
      this.data.employeeId = employeeId;
      return;
    }

    // ✅ Others
    this.data[key] = value;
  }

  // ================= MODES =================
  openAddForm() {
    this.selectedId = null;
    this.data = {};
    this.showModal = true;

    setTimeout(() => {
      this.formConfig = this.applyMode(
        { ...BRANCH_COORDINATOR_ASSIGNMENT_FORM },
        'create',
      );

      this.warmupDropdownCaches();
    }, 0);
  }

  edit(row: any) {
    this.selectedId = row.id;

    const employeeName = (row.employeeName ?? '').toString().trim();
    const employeeId = Number(row.employeeId);

    this.data = {
      ...row,
      // ✅ if NA / invalid -> force null so required validation can trigger
      employeeId:
        employeeName === 'NA' || !Number.isFinite(employeeId) || employeeId <= 0
          ? null
          : employeeId,
    };

    this.showModal = true;

    setTimeout(() => {
      this.formConfig = this.applyMode(
        { ...BRANCH_COORDINATOR_ASSIGNMENT_FORM },
        'update',
      );

      this.warmupDropdownCaches();
    }, 0);
  }

  closeModal() {
    this.showModal = false;
  }

  private applyMode(cfg: any, mode: 'create' | 'update') {
    const fields = cfg.fields.map((f: any) => {
      if (f.key === 'branchId') {
        return { ...f, disabled: mode === 'update' };
      }

      // ✅ Employee hamesha editable
      if (f.key === 'employeeId') {
        return { ...f, disabled: false };
      }

      return { ...f };
    });

    return { ...cfg, mode, fields };
  }

  // ================= SUBMIT =================
  onSubmit(payload: any) {
    const branchId = Number(payload?.branchId);
    const empId = Number(payload?.employeeId);

    const empName = (payload?.employeeName ?? payload?.employee ?? '')
      .toString()
      .trim(); // fallback if your form emits name
    const dbName = (this.data?.employeeName ?? '').toString().trim();

    // ✅ Branch required
    if (!Number.isFinite(branchId) || branchId <= 0) {
      this.notification.error('Validation', 'Branch is required.');
      return;
    }

    // ✅ Employee required (ID must exist)
    if (!Number.isFinite(empId) || empId <= 0) {
      this.notification.error('Validation', 'Employee is required.');
      return;
    }

    // ✅ If DB already has "NA" and user cleared/invalid, block it
    // (This covers cases where UI keeps old NA)
    if (
      (dbName === 'NA' || empName === 'NA') &&
      (!Number.isFinite(empId) || empId <= 0)
    ) {
      this.notification.error(
        'Validation',
        'Please select a valid employee (NA not allowed).',
      );
      return;
    }

    const body = {
      empId,
      branchId,
      email: (payload?.email || '').trim(),
      effectiveDate:
        payload?.effectiveDate instanceof Date
          ? payload.effectiveDate.toISOString()
          : payload?.effectiveDate,
    };

    const api$ = this.selectedId
      ? this.service.update(this.selectedId, body)
      : this.service.create(body);

    api$.subscribe({
      next: () => {
        this.showModal = false;
        this.loadTable();
        this.notification.success('Success', 'Saved successfully.');
      },
      error: (err) => {
        this.notification.error(
          'Error',
          err?.error?.message ?? 'Something went wrong.',
        );
      },
    });
  }

  // ================= DELETE =================
  delete(row: any) {
    this.modal.confirm({
      nzTitle: 'Delete Confirmation',
      nzContent: `Are you sure you want to delete this record?`,
      nzOkText: 'Yes, Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.service.delete(row.id).subscribe({
          next: () => {
            this.loadTable();
            this.notification.success(
              'Deleted',
              'Record deleted successfully.',
            );
          },
          error: (err) => {
            this.notification.error(
              'Error',
              err?.error?.message ?? 'Delete failed.',
            );
          },
        });
      },
    });
  }

  private warmupDropdownCaches() {
    const fields = this.formConfig.fields.map((f) => ({ ...f }));

    /* ================= BRANCH ================= */
    const bIdx = fields.findIndex((f) => f.key === 'branchId');
    if (bIdx !== -1) {
      fields[bIdx] = {
        ...fields[bIdx],
        searchable: true,
        options$: this.branches$.pipe(
          map((branches: any[]) =>
            (branches || []).map((b: any) => {
              const id = +(b.Branch_ID ?? b.BranchID ?? b.ID);

              const name = (
                b.Branch_Name ??
                b.BranchName ??
                b.Name ??
                ''
              ).trim();
              const desc = (b.BranchDesc ?? b.Branch_Desc ?? '').trim();
              const phone = (b.BPHONE ?? b.BPhone ?? '').trim();
              const address = (b.BADDRESS ?? b.BAddress ?? '').trim();

              return {
                value: id,
                label: name,
                searchText: `${id} ${name} ${desc} ${phone}`.trim(),

                // ✅ META (exact keys as optionColumns)
                meta: {
                  id,
                  name,
                  desc,
                  phone,
                  address,
                },
              };
            }),
          ),
        ),
      };
    }

    /* ================= EMPLOYEE ================= */
    const eIdx = fields.findIndex((f) => f.key === 'employeeId');
    if (eIdx !== -1) {
      fields[eIdx] = {
        ...fields[eIdx],
        searchable: true,
        options$: this.employees$.pipe(
          map((employees: any[]) =>
            (employees || []).map((e: any) => {
              const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);

              const name = (e.APP_Name ?? e.Name ?? '').trim();

              const department = (
                e.DepartmentName ??
                e.DEP_DESC ??
                e.Department ??
                ''
              ).trim();

              const designation = (
                e.DesignationName ??
                e.DES_DESC ??
                e.Designation ??
                ''
              ).trim();

              return {
                value: id,
                label: name,
                searchText: `${id} ${name}${department} ${designation}`.trim(),

                // ✅ META (exact keys as optionColumns)
                meta: {
                  id,
                  name,
                  department,
                  designation,
                },
              };
            }),
          ),
        ),
      };
    }

    // 🔑 single immutable update
    this.formConfig = { ...this.formConfig, fields };
  }
}
