import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BRANCH_GENERAL_EMP_BINDING_FORM,
  BRANCH_GENERAL_EMP_BINDING_TABLE,
} from './branch-general-employee-binding-config';
import { BranchGeneralEmployeeService } from '../../core/services/branch-general-employee-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';
import { forkJoin, map, tap, finalize, shareReplay } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-branch-general-employee-binding',
  standalone: true,
  imports: [Table, CommonModule, Modal],
  templateUrl: './branch-general-employee-binding.html',
  styleUrl: './branch-general-employee-binding.css',
})
export class BranchGeneralEmployeeBinding implements OnInit {
  formConfig = { ...BRANCH_GENERAL_EMP_BINDING_FORM };
  tableConfig = BRANCH_GENERAL_EMP_BINDING_TABLE;

  showModal = false;
  selectedId: number | null = null;
  data: any = {};
  tableData: any[] = [];

  private branchesCache: any[] = [];
  private branchDetailsMap = new Map<number, any>();
  private empMap = new Map<number, string>();

  constructor(
    private service: BranchGeneralEmployeeService,
    private msg: NzMessageService
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
    this.loadTable();
    this.loadDropdowns();
  }

  // ✅ Updated: normalize effectiveDate for stability (edit/date picker)
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
            +(b.BranchID ?? b.Branch_ID ?? b.ID),
            (b.BranchName ?? b.Branch_Name ?? b.Name ?? '').trim(),
          ])
        );

        const empMap = new Map<number, string>(
          employees.map((e: any) => [
            +(e.EMP_ID ?? e.EmpId ?? e.ID),
            (e.APP_Name ?? e.Name ?? '').trim(),
          ])
        );

        return bindings.map((r: any) => {
          const branchId = +(r.BranchID ?? r.branchId);
          const empId = +(r.Emp_ID ?? r.employeeId);

          const bcId =
            +(
              r.BranchCoordinatorID ??
              r.BC_Emp_ID ??
              r.branchCoordinatorId ??
              0
            ) || null;

          const rawDate = r.EffectiveDate ?? r.effectiveDate;

          const rawStatus = r.Status ?? r.status ?? 1;
          const statusFlag =
            rawStatus === true ? 1 : rawStatus === false ? 0 : +(rawStatus ?? 1);

          return {
            id: r.ID ?? r.id,
            branchId,
            branchName: branchMap.get(branchId) ?? 'NA',

            branchCoordinatorId: bcId,
            branchCoordinatorName: bcId ? empMap.get(bcId) ?? 'NA' : 'NA',
            branchCoordinatorEmail:
              r.BranchCoordinatorEmail ?? r.BC_Email ?? 'NA',

            employeeId: empId,
            employeeName: empMap.get(empId) ?? 'NA',

            email: r.Email ?? r.email,
            effectiveDate: this.asLocalDate(rawDate),

            // ✅ keep numeric for form/edit
            statusFlag,

            // ✅ display in table
            statusText: statusFlag === 1 ? 'Active' : 'Inactive',
          };
        });
      })
    )
    .subscribe((rows) => (this.tableData = rows));
}


  // ✅ same as your code, just kept as-is (no behavior change)
  loadDropdowns() {
    // ===== Branch =====
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId'
    );

    if (branchField) {
      branchField.loading = true;

      branchField.options$ = this.service.getBranches().pipe(
        map((res: any) => res?.data ?? res ?? []),
        tap((branches: any[]) => {
          this.branchesCache = branches;

          this.branchDetailsMap.clear();
          branches.forEach((b: any) => {
            const id = +(b.BranchID ?? b.Branch_ID ?? b.ID);
            if (Number.isNaN(id)) return;

            this.branchDetailsMap.set(id, {
              id,
              name: (b.BranchName ?? b.Branch_Name ?? b.Name ?? '').trim(),
              desc: (
                b.BranchDesc ??
                b.Branch_Desc ??
                b.BranchDescription ??
                ''
              ).trim(),
              shortCode: (b.BranchShortCode ?? b.ShortCode ?? '').trim(),
              phone: (b.BPHONE ?? b.BPhone ?? b.Phone ?? '').trim(),
              address: (b.BADDRESS ?? b.BAddress ?? b.Address ?? '').trim(),
              bcId:
                b.BranchCoordinatorID ??
                b.BC_Emp_ID ??
                b.BC_EmpId ??
                b.BranchCoordinatorEmpId ??
                null,
            });
          });
        }),
        map(
          (branches: any[]) =>
            (branches || [])
              .map((b: any) => {
                const id = +(b.BranchID ?? b.Branch_ID ?? b.ID);
                if (Number.isNaN(id)) return null;

                const name = (
                  b.BranchName ??
                  b.Branch_Name ??
                  b.Name ??
                  ''
                ).trim();
                const desc = (
                  b.BranchDesc ??
                  b.Branch_Desc ??
                  b.BranchDescription ??
                  ''
                ).trim();
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
      ) as any;

      branchField.searchable = true;
    }

    // ===== Employee =====
    const empField = this.formConfig.fields.find((f) => f.key === 'employeeId');

    if (empField) {
      empField.loading = true;

      empField.options$ = this.service.getEmployees().pipe(
        map((res: any) => res?.data ?? res ?? []),
        tap((emps: any[]) => {
          this.empMap.clear();
          (emps || []).forEach((e: any) => {
            const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
            const name = (e.APP_Name ?? e.Name ?? '').trim();
            if (!Number.isNaN(id)) this.empMap.set(id, name);
          });
        }),
        map(
          (emps: any[]) =>
            (emps || [])
              .map((e: any) => {
                const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
                if (Number.isNaN(id)) return null;

                const name = (e.APP_Name ?? e.Name ?? '').trim();
                const cnic = (e.APP_NIC ?? e.CNIC ?? e.NIC ?? '').trim();

                const searchText = `${id} ${name} ${cnic}`.trim();

                return {
                  label: name,
                  value: id,
                  searchText,
                  meta: { id, name, cnic },
                };
              })
              .filter(Boolean) as any[]
        ),
        finalize(() => (empField.loading = false)),
        shareReplay(1)
      ) as any;

      empField.searchable = true;
    }
  }

  private setMode(mode: 'create' | 'update') {
    this.formConfig = {
      ...this.formConfig,
      mode,
      fields: this.formConfig.fields.map((f) => {
        if (
          mode === 'update' &&
          (f.key === 'employeeId' || f.key === 'branchId')
        ) {
          return { ...f, disabled: true };
        }
        if (
          mode === 'create' &&
          (f.key === 'employeeId' || f.key === 'branchId')
        ) {
          return { ...f, disabled: false };
        }
        return f;
      }),
    };
  }

  openAddForm() {
    this.selectedId = null;
    this.data = { statusFlag: 1 };
    this.setMode('create');
    this.showModal = true;
  }

  // ✅ Updated: normalize effectiveDate on edit to avoid datepicker weirdness
  edit(row: any) {
    this.selectedId = row.id;

    this.data = {
      ...row,
      effectiveDate: this.asLocalDate(row.effectiveDate),
      statusFlag:
        row.statusFlag === true
          ? 1
          : row.statusFlag === false
          ? 0
          : +(row.statusFlag ?? 1),
    };

    this.setMode('update');
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  // ✅ Updated: SINGLE assignment, no formValue spreading, no double this.data updates
  // ✅ Fixes: email typing lag after selecting branch/employee
  onFormChange(ev: any) {
    if (!ev) return;

    const key = ev.key;
    const value = ev.value;

    // We ONLY react to select-type changes (branchId / employeeId / statusFlag etc.)
    if (!key) return;

    // Build nextData once
    const nextData = { ...this.data, [key]: value };

    // If branch selected -> auto fill readonly fields ONCE
    if (key === 'branchId') {
      const branchId = +value;

      // guard: same branch -> don't spam updates
      if (+this.data?.branchId === branchId) {
        this.data = nextData;
        return;
      }

      const bd =
        this.branchDetailsMap.get(branchId) ||
        (() => {
          const b = this.branchesCache.find(
            (x) => +(x.BranchID ?? x.Branch_ID ?? x.ID) === branchId
          );
          if (!b) return null;
          return {
            name: (b.BranchName ?? b.Branch_Name ?? b.Name ?? '').trim(),
            desc: (
              b.BranchDesc ??
              b.Branch_Desc ??
              b.BranchDescription ??
              ''
            ).trim(),
            shortCode: (b.BranchShortCode ?? b.ShortCode ?? '').trim(),
            bcId:
              b.BranchCoordinatorID ??
              b.BC_Emp_ID ??
              b.BC_EmpId ??
              b.BranchCoordinatorEmpId ??
              null,
          };
        })();

      if (bd) {
        nextData.branchName = bd.name ?? '';
        nextData.branchDesc = bd.desc ?? '';
        nextData.branchShortCode = bd.shortCode ?? '';

        // branchCoordinatorId optional: set only if empty
        if (nextData.branchCoordinatorId == null) {
          nextData.branchCoordinatorId = bd.bcId ?? null;
        }
      }
    }

    // ✅ one assignment only
    this.data = nextData;
  }

  // ✅ Updated: effectiveDate send as ISO string (backend-friendly)
  onSubmit(payload: any) {
    const cleanPayload = {
      empId: payload.employeeId,
      branchId: payload.branchId,
      branchCoordinatorId: payload.branchCoordinatorId ?? null,
      email: (payload.email || '').trim(),
      effectiveDate:
        payload.effectiveDate instanceof Date
          ? payload.effectiveDate.toISOString()
          : payload.effectiveDate,
      status: payload.statusFlag ?? 1,
    };

    const api$ = this.selectedId
      ? this.service.update(this.selectedId, cleanPayload)
      : this.service.create(cleanPayload);

    api$.subscribe({
      next: () => {
        this.msg.success(
          this.selectedId ? 'Updated successfully' : 'Created successfully'
        );
        this.showModal = false;
        this.loadTable();
      },
      error: (err) => {
        const status = err?.status;
        const message = err?.error?.message || 'Something went wrong';

        if (status === 409) {
          this.msg.error(message);
          return;
        }

        this.msg.error(message);
      },
    });
  }

  delete(row: any) {
    if (confirm('Delete this record?')) {
      this.service.delete(row.id).subscribe({
        next: () => {
          this.msg.success('Deleted successfully');
          this.loadTable();
        },
        error: (err) => {
          this.msg.error(err?.error?.message || 'Delete failed');
        },
      });
    }
  }
}
