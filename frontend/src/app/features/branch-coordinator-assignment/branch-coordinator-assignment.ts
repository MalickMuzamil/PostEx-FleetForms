import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BRANCH_COORDINATOR_ASSIGNMENT_FORM,
  BRANCH_COORDINATOR_ASSIGNMENT_TABLE,
} from './branch-coordinator-assignment.config';
import { BranchCoordinatorService } from '../../core/services/branch-coordinator-service';
import { Table } from '../../ui/table/table';
import { finalize, map, tap, shareReplay, forkJoin } from 'rxjs';
import { Modal } from '../../ui/modal/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';

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

  constructor(
    private service: BranchCoordinatorService,
    private notification: NzNotificationService
  ) {}

  ngOnInit() {
    this.loadTable();
    this.loadBranchesAndEmployeesForForm();
  }

  loadTable() {
    forkJoin({
      branchesRes: this.service.getBranches(),
      employeesRes: this.service.getEmployees(),
      bindingsRes: this.service.getAll(),
    })
      .pipe(
        map(({ branchesRes, employeesRes, bindingsRes }: any) => {
          const branches = branchesRes?.data ?? branchesRes ?? [];
          const employees = employeesRes?.data ?? employeesRes ?? [];
          const bindings = bindingsRes?.data ?? bindingsRes ?? [];

          const branchMap = new Map<number, string>(
            branches.map((b: any) => [
              +(b.Branch_ID ?? b.BranchID ?? b.ID),
              (b.Branch_Name ?? b.BranchName ?? b.Name ?? '').trim(),
            ])
          );

          const empMap = new Map<number, string>(
            employees.map((e: any) => [+e.EMP_ID, (e.APP_Name ?? '').trim()])
          );

          return bindings.map((r: any) => {
            const branchId = +(r.BranchID ?? r.branchId);
            const empId = +(r.BC_Emp_ID ?? r.employeeId);

            const rawDate = r.EffectiveDate ?? r.effectiveDate;

            return {
              id: r.ID ?? r.id,
              branchId,
              branchName: branchMap.get(branchId) ?? 'NA',
              employeeId: empId,
              employeeName: empMap.get(empId) ?? 'NA',
              email: r.BC_Email ?? r.email,
              // ✅ normalized for NZ date picker + edit mode stability
              effectiveDate: this.asLocalDate(rawDate),
            };
          });
        })
      )
      .subscribe((rows) => (this.tableData = rows));
  }

  loadBranchesAndEmployeesForForm() {
    // ===== Branch dropdown =====
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId'
    );

    if (branchField) {
      branchField.loading = true;

      const branches$ = this.service.getBranches().pipe(
        map((res: any) => res?.data ?? res ?? []),
        tap((branches: any[]) => {
          this.branchDetailsMap.clear();

          branches.forEach((b: any) => {
            const id = +(b.Branch_ID ?? b.BranchID ?? b.ID);
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

            if (!Number.isNaN(id)) {
              this.branchDetailsMap.set(id, {
                id,
                name,
                desc,
                email,
                phone,
                address,
              });
            }
          });
        }),
        map(
          (branches: any[]) =>
            branches
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

                const searchText =
                  `${id} ${name} ${desc} ${phone} ${address}`.trim();

                return {
                  label: name,
                  value: id,
                  searchText,
                  meta: { id, name, desc, phone, address },
                };
              })
              .filter(Boolean) as any[]
        ),
        finalize(() => (branchField.loading = false)),
        shareReplay(1)
      );

      branchField.options$ = branches$ as any;
      branchField.searchable = true;
    }

    // ===== Employee dropdown =====
    const empField = this.formConfig.fields.find((f) => f.key === 'employeeId');

    if (empField) {
      empField.loading = true;

      const emps$ = this.service.getEmployees().pipe(
        map((res: any) => res?.data ?? res ?? []),
        tap((emps: any[]) => {
          this.empMap.clear();
          emps.forEach((e: any) => {
            const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
            const name = (e.APP_Name ?? e.Name ?? '').trim();
            if (!Number.isNaN(id)) this.empMap.set(id, name);
          });
        }),
        map(
          (emps: any[]) =>
            emps
              .map((e: any) => {
                const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
                if (Number.isNaN(id)) return null;

                const name = (e.APP_Name ?? e.Name ?? '').trim();
                const dept = (e.DepartmentName ?? e.DEP_DESC ?? '').trim();
                const desig = (e.DesignationName ?? e.DES_DESC ?? '').trim();

                const searchText = `${id} ${name} ${dept} ${desig}`.trim();

                return {
                  label: name,
                  value: id,
                  searchText,
                  meta: {
                    id,
                    name,
                    department: dept,
                    designation: desig,
                  },
                };
              })
              .filter(Boolean) as any[]
        ),
        finalize(() => (empField.loading = false)),
        shareReplay(1)
      );

      empField.options$ = emps$ as any;
      empField.searchable = true;
    }
  }

  onFormChange(ev: any) {
    if (!ev || !ev.key) return;

    const key = ev.key;
    const value = ev.value;

    // ✅ Effective Date: always Date | null
    if (key === 'effectiveDate') {
      this.data = {
        ...this.data,
        effectiveDate: value ? this.asLocalDate(value) : null,
      };
      return;
    }

    // ✅ Branch: only update branchId (no extra patching)
    if (key === 'branchId') {
      const branchId = +value;

      // same branch -> no re-render spam
      if (+this.data?.branchId === branchId) return;

      this.data = {
        ...this.data,
        branchId,
      };
      return;
    }

    // ✅ Employee: only update employeeId
    if (key === 'employeeId') {
      const employeeId = +value;

      if (+this.data?.employeeId === employeeId) return;

      this.data = {
        ...this.data,
        employeeId,
      };
      return;
    }

    // ✅ Email or other simple inputs
    this.data = {
      ...this.data,
      [key]: value,
    };
  }

  openAddForm() {
    this.selectedId = null;
    this.data = {};
    this.formConfig = { ...this.formConfig, mode: 'create' };
    this.showModal = true;
  }

  edit(row: any) {
    this.selectedId = row.id;

    const bd = this.branchDetailsMap.get(+row.branchId);

    this.data = {
      ...row,
      // ✅ normalize date for edit mode
      effectiveDate: this.asLocalDate(row.effectiveDate),
      branchName: bd?.name ?? row.branchName ?? '',
      branchDesc: bd?.desc ?? '',
      branchEmail: bd?.email ?? '',
      branchPhone: bd?.phone ?? '',
      branchAddress: bd?.address ?? '',
    };

    this.formConfig = { ...this.formConfig, mode: 'update' };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

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

  delete(row: any) {
    if (confirm('Delete this record?')) {
      this.service.delete(row.id).subscribe({
        next: () => {
          this.loadTable();
          this.notification.success('Deleted', 'Record deleted successfully.');
        },
        error: (err) => {
          this.notification.error(
            'Error',
            err?.error?.message ?? 'Delete failed.'
          );
        },
      });
    }
  }
}
