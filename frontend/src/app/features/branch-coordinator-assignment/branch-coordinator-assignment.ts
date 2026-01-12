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
    private modal: NzModalService
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
      shareReplay(1)
    );

    this.employees$ = this.service.getEmployees().pipe(
      map((res: any) => res?.data ?? res ?? []),
      shareReplay(1)
    );

    // this.loadBranchesAndEmployeesForForm();
    this.warmupDropdownCaches();
    this.loadTable();
  }

  // ================= TABLE =================
  loadTable() {
    forkJoin({
      branches: this.branches$,
      employees: this.employees$,
      bindingsRes: this.service.getAll(),
    })
      .pipe(
        map(({ branches, employees, bindingsRes }: any) => {
          const bindings = bindingsRes?.data ?? bindingsRes ?? [];

          const branchMap = new Map<number, string>(
            (branches || []).map((b: any) => [
              +(b.Branch_ID ?? b.BranchID ?? b.ID),
              (b.Branch_Name ?? b.BranchName ?? b.Name ?? '').trim(),
            ])
          );

          const empMap = new Map<number, string>(
            (employees || []).map((e: any) => [
              +(e.EMP_ID ?? e.EmpId ?? e.ID),
              (e.APP_Name ?? e.Name ?? '').trim(),
            ])
          );

          return (bindings || []).map((r: any) => {
            const branchId = +(r.BranchID ?? r.branchId);
            const empId = +(r.BC_Emp_ID ?? r.employeeId);

            const rawDate = r.EffectiveDate ?? r.effectiveDate;

            // ✅ Date object (edit/date-picker)
            const d = this.asLocalDate(rawDate);

            // ✅ Date-only for table
            const effectiveDateDisplay = d
              ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                  2,
                  '0'
                )}-${String(d.getDate()).padStart(2, '0')}`
              : '';

            return {
              id: r.ID ?? r.id,

              branchId,
              branchName: branchMap.get(branchId) ?? 'NA',

              employeeId: empId,
              employeeName: empMap.get(empId) ?? 'NA',

              email: r.BC_Email ?? r.email,

              // ✅ keep for edit mode
              effectiveDate: d,

              // ✅ show in table
              effectiveDateDisplay,
            };
          });
        })
      )
      .subscribe((rows) => (this.tableData = rows));
  }

  // ================= DROPDOWNS =================
  loadBranchesAndEmployeesForForm() {
    // ===== Branch dropdown =====
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId'
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
            .filter(Boolean)
        ),
        finalize(() => (branchField.loading = false))
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
            .filter(Boolean)
        ),
        finalize(() => (empField.loading = false))
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
    this.formConfig.mode = 'create';
    this.showModal = true;
  }

  edit(row: any) {
    this.selectedId = row.id;

    const bd = this.branchDetailsMap.get(+row.branchId);

    this.data = {
      ...row,
      effectiveDate: this.asLocalDate(row.effectiveDate),
      branchName: bd?.name ?? row.branchName ?? '',
      branchDesc: bd?.desc ?? '',
      branchEmail: bd?.email ?? '',
      branchPhone: bd?.phone ?? '',
      branchAddress: bd?.address ?? '',
    };

    this.formConfig.mode = 'update';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= SUBMIT =================
  onSubmit(payload: any) {
    const body = {
      empId: payload.employeeId,
      branchId: payload.branchId,
      email: (payload.email || '').trim(),
      effectiveDate:
        payload.effectiveDate instanceof Date
          ? payload.effectiveDate.toISOString()
          : payload.effectiveDate,
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
        if (err?.status === 409) {
          const msg = err?.error?.message ?? 'Duplicate binding not allowed.';
          const existingId = err?.error?.existingId;

          this.notification.error(
            'Duplicate',
            `${msg}${existingId ? ` (Existing ID: ${existingId})` : ''}`
          );
          return;
        }

        this.notification.error(
          'Error',
          err?.error?.message ?? 'Something went wrong.'
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
              'Record deleted successfully.'
            );
          },
          error: (err) => {
            this.notification.error(
              'Error',
              err?.error?.message ?? 'Delete failed.'
            );
          },
        });
      },
    });
  }

  private warmupDropdownCaches() {
    forkJoin({
      branches: this.branches$,
      employees: this.employees$,
    }).subscribe(({ branches, employees }: any) => {
      // ---- branches cache ----
      this.branchDetailsMap.clear();
      this.branchOptions = (branches || [])
        .map((b: any) => {
          const id = +(b.Branch_ID ?? b.BranchID ?? b.ID);
          if (Number.isNaN(id)) return null;

          const name = (b.Branch_Name ?? b.BranchName ?? b.Name ?? '').trim();
          const desc = (b.BranchDesc ?? b.Branch_Desc ?? '').trim();
          const email = (b.BEMAIL ?? b.BEmail ?? b.Email ?? '').trim();
          const phone = (b.BPHONE ?? b.BPhone ?? b.Phone ?? '').trim();
          const address = (b.BADDRESS ?? b.BAddress ?? b.Address ?? '').trim();

          this.branchDetailsMap.set(id, {
            id,
            name,
            desc,
            email,
            phone,
            address,
          });

          return {
            label: name,
            value: id,
            searchText: `${id} ${name} ${desc} ${phone} ${address}`.trim(),
            meta: { id, name, desc, phone, address },
          };
        })
        .filter(Boolean);

      this.branchesLoaded = true;

      // ---- employees cache ----
      this.empMap.clear();
      this.employeeOptions = (employees || [])
        .map((e: any) => {
          const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
          if (Number.isNaN(id)) return null;

          const name = (e.APP_Name ?? e.Name ?? '').trim();
          const dept = (e.DepartmentName ?? e.DEP_DESC ?? '').trim();
          const desig = (e.DesignationName ?? e.DES_DESC ?? '').trim();

          this.empMap.set(id, name);

          return {
            label: name,
            value: id,
            searchText: `${id} ${name} ${dept} ${desig}`.trim(),
            meta: { id, name, department: dept, designation: desig },
          };
        })
        .filter(Boolean);

      this.employeesLoaded = true;

      // ✅ now bind options to form fields (instant)
      this.bindDropdownOptionsToForm();
    });
  }

  private bindDropdownOptionsToForm() {
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId'
    );
    if (branchField) {
      branchField.loading = false;
      branchField.searchable = true;
      branchField.options = this.branchOptions; // ✅ IMPORTANT: plain array
    }

    const empField = this.formConfig.fields.find((f) => f.key === 'employeeId');
    if (empField) {
      empField.loading = false;
      empField.searchable = true;
      empField.options = this.employeeOptions; // ✅ IMPORTANT: plain array
    }
  }
}
