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
import { NzModalService } from 'ng-zorro-antd/modal';

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
  private branches$!: any;
  private employees$!: any;
  private branchOptions: any[] = [];
  private employeeOptions: any[] = [];
  private branchesLoaded = false;
  private employeesLoaded = false;

  private notNull<T>(x: T | null): x is T {
    return x !== null;
  }

  constructor(
    private service: BranchGeneralEmployeeService,
    private msg: NzMessageService,
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
    // this.loadDropdowns();
    // this.warmupDropdownCaches();
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
              +(b.BranchID ?? b.Branch_ID ?? b.ID),
              (b.BranchName ?? b.Branch_Name ?? b.Name ?? '').trim(),
            ]),
          );

          const empMap = new Map<number, string>(
            (employees || []).map((e: any) => [
              +(e.EMP_ID ?? e.EmpId ?? e.ID),
              (e.APP_Name ?? e.Name ?? '').trim(),
            ]),
          );

          return (bindings || []).map((r: any) => {
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

            // ✅ keep Date object (edit picker)
            const d = this.asLocalDate(rawDate);

            // ✅ date-only for table
            const effectiveDateDisplay = d
              ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                  2,
                  '0',
                )}-${String(d.getDate()).padStart(2, '0')}`
              : '';

            const rawStatus = r.Status ?? r.status ?? 1;
            const statusFlag =
              rawStatus === true
                ? 1
                : rawStatus === false
                  ? 0
                  : +(rawStatus ?? 1);

            return {
              id: r.ID ?? r.id,

              branchId,
              branchName: branchMap.get(branchId) ?? 'NA',

              branchCoordinatorId: bcId,
              branchCoordinatorName: bcId ? (empMap.get(bcId) ?? 'NA') : 'NA',
              branchCoordinatorEmail:
                r.BranchCoordinatorEmail ?? r.BC_Email ?? 'NA',

              employeeId: empId,
              employeeName: empMap.get(empId) ?? 'NA',

              email: r.Email ?? r.email,

              // ✅ for edit/date-picker
              effectiveDate: d,

              // ✅ for table view
              effectiveDateDisplay,

              statusFlag,
              statusText: statusFlag === 1 ? 'Active' : 'Inactive',
            };
          });
        }),
      )
      .subscribe((rows) => (this.tableData = rows));
  }

  // ================= DROPDOWNS =================
  loadDropdowns() {
    // ===== Branch =====
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId',
    );
    if (branchField) {
      branchField.loading = true;

      const branchesOptions$ = this.branches$.pipe(
        tap((branches: any[]) => {
          this.branchesCache = branches || [];

          this.branchDetailsMap.clear();
          (branches || []).forEach((b: any) => {
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
              .filter(Boolean) as any[],
        ),
        finalize(() => (branchField.loading = false)),
      );

      branchField.options$ = branchesOptions$ as any;
      branchField.searchable = true;
    }

    // ===== Employee =====
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
        map(
          (emps: any[]) =>
            (emps || [])
              .map((e: any) => {
                const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
                if (Number.isNaN(id)) return null;

                const name = (e.APP_Name ?? e.Name ?? '').trim();
                const department = (
                  e.DepartmentName ??
                  e.DEP_DESC ??
                  ''
                ).trim();
                const designation = (
                  e.DesignationName ??
                  e.DES_DESC ??
                  ''
                ).trim();

                const searchText =
                  `${id} ${name} ${department} ${designation}`.trim();

                return {
                  label: name,
                  value: id,
                  searchText,
                  meta: { id, name, department, designation },
                };
              })
              .filter(Boolean) as any[],
        ),
        finalize(() => (empField.loading = false)),
      );

      empField.options$ = employeesOptions$ as any;
      empField.searchable = true;
    }
  }

  // ================= MODES =================
  private applyMode(cfg: any, mode: 'create' | 'update') {
    const fields = cfg.fields.map((f: any) => {
      if (f.key === 'employeeId' || f.key === 'branchId') {
        return { ...f, disabled: mode === 'update' };
      }
      return { ...f };
    });

    return { ...cfg, mode, fields };
  }

  openAddForm() {
    this.selectedId = null;
    this.data = { statusFlag: 1, effectiveDate: null };
    this.showModal = true;

    setTimeout(() => {
      // 1) reset + mode in one go
      this.formConfig = this.applyMode(
        { ...BRANCH_GENERAL_EMP_BINDING_FORM },
        'create',
      );

      // 2) then bind dropdowns
      this.warmupDropdownCaches();
    }, 0);
  }

  edit(row: any) {
    this.selectedId = row.id;

    const branchName = (row?.branchName ?? '').toString().trim().toUpperCase();
    const employeeName = (row?.employeeName ?? '')
      .toString()
      .trim()
      .toUpperCase();

    const branchIdNum = Number(row?.branchId);
    const empIdNum = Number(row?.employeeId);

    const badBranch =
      branchName === 'NA' || !Number.isFinite(branchIdNum) || branchIdNum <= 0;
    const badEmp =
      employeeName === 'NA' || !Number.isFinite(empIdNum) || empIdNum <= 0;

    this.data = {
      ...row,
      effectiveDate: this.asLocalDate(row.effectiveDate),
      statusFlag:
        row.statusFlag === true
          ? 1
          : row.statusFlag === false
            ? 0
            : +(row.statusFlag ?? 1),

      // ✅ force null => submit will block
      branchId: badBranch ? null : branchIdNum,
      employeeId: badEmp ? null : empIdNum,
    };

    this.showModal = true;

    setTimeout(() => {
      this.formConfig = this.applyMode(
        { ...BRANCH_GENERAL_EMP_BINDING_FORM },
        'update',
      );
      this.warmupDropdownCaches();
    }, 0);
  }

  closeModal() {
    this.showModal = false;
  }

  onFormChange(ev: any) {
    if (!ev || !ev.key) return;

    const key = ev.key;
    const value = ev.value;

    // ✅ 1) Email typing: MUTATE (prevents lag)
    if (key === 'email') {
      const next = (value ?? '').toString();
      if (this.data?.email === next) return;
      this.data.email = next;
      return;
    }

    // ✅ 2) Effective Date: keep Date|null (mutate)
    if (key === 'effectiveDate') {
      const next = value ? this.asLocalDate(value) : null;

      const cur = this.data?.effectiveDate;
      if (
        cur instanceof Date &&
        next instanceof Date &&
        cur.getTime() === next.getTime()
      )
        return;
      if (!cur && !next) return;

      this.data.effectiveDate = next;
      return;
    }

    // ✅ 3) Branch: mutate only (and keep same auto-fill flow)
    if (key === 'branchId') {
      const branchId = +value;
      if (+this.data?.branchId === branchId) return;

      this.data.branchId = branchId;

      const bd = this.branchDetailsMap.get(branchId);
      if (bd) {
        this.data.branchName = bd.name ?? '';
        this.data.branchDesc = bd.desc ?? '';
        this.data.branchShortCode = bd.shortCode ?? '';

        // ✅ only set BC if empty (same as your existing logic)
        if (this.data.branchCoordinatorId == null) {
          this.data.branchCoordinatorId = bd.bcId ?? null;
        }
      }
      return;
    }

    // ✅ 4) Employee: mutate only
    if (key === 'employeeId') {
      const employeeId = +value;
      if (+this.data?.employeeId === employeeId) return;
      this.data.employeeId = employeeId;
      return;
    }

    // ✅ 5) Status flag: normalize to 0/1 (mutate)
    if (key === 'statusFlag') {
      const statusFlag =
        value === true ? 1 : value === false ? 0 : +(value ?? 1);

      if (+this.data?.statusFlag === statusFlag) return;
      this.data.statusFlag = statusFlag;
      return;
    }

    // ✅ 6) Default: mutate
    if (this.data?.[key] === value) return;
    this.data[key] = value;
  }

  // ================= SUBMIT =================
  onSubmit(payload: any) {
    // ---------- helpers ----------
    const isEdit = !!this.selectedId;

    const getId = (v: any): number => {
      if (v == null) return NaN;
      if (typeof v === 'number' || typeof v === 'string') return +v;

      // dropdown might emit {value,label} or {id,name} etc
      return +(v.value ?? v.id ?? v.key ?? v.ID ?? v.BranchID ?? v.EMP_ID);
    };

    const isBadName = (s: string) => {
      const t = (s ?? '').toString().trim().toUpperCase();
      return !t || t === 'NA';
    };

    const toDateOnlyIso = (dt: any): string | null => {
      const d = this.asLocalDate(dt);
      if (!d) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      // backend expects datetime? then add T00:00:00.000Z
      return `${y}-${m}-${day}T00:00:00.000Z`;
    };

    // ---------- read ids (this.data preferred, payload fallback) ----------
    const branchId = getId(this.data?.branchId ?? payload?.branchId);
    const empId = getId(this.data?.employeeId ?? payload?.employeeId);

    // basic required validation (create + edit both)
    if (!Number.isFinite(branchId) || branchId <= 0) {
      this.msg.error('Please select a valid Branch.');
      return;
    }

    if (!Number.isFinite(empId) || empId <= 0) {
      this.msg.error('Please select a valid Employee.');
      return;
    }

    // ---------- derive names (avoid empty/NA false errors) ----------
    // Branch name: prefer map (most accurate), then data, then payload
    const bd = this.branchDetailsMap.get(branchId);
    const branchName = (
      bd?.name ??
      this.data?.branchName ??
      payload?.branchName ??
      ''
    )
      .toString()
      .trim()
      .toUpperCase();

    // Employee name: from empMap cache, then data/payload
    const empNameFromMap = this.empMap.get(empId) ?? '';
    const employeeName = (
      empNameFromMap ??
      this.data?.employeeName ??
      payload?.employeeName ??
      ''
    )
      .toString()
      .trim()
      .toUpperCase();

    // ---------- NA rule (ONLY for edit existing bad DB rows) ----------
    if (isEdit) {
      if (isBadName(branchName)) {
        this.msg.error(
          'Invalid record: Branch is NA/empty in DB. Please fix data first.',
        );
        return;
      }
      if (isBadName(employeeName)) {
        this.msg.error(
          'Invalid record: Employee is NA/empty in DB. Please fix data first.',
        );
        return;
      }
    }

    // ---------- effective date ----------
    const effectiveDateValue =
      payload?.effectiveDate ?? this.data?.effectiveDate ?? null;

    // ---------- build payload ----------
    const cleanPayload = {
      empId,
      branchId,
      branchCoordinatorId:
        getId(payload?.branchCoordinatorId ?? this.data?.branchCoordinatorId) ||
        null,
      email: (payload?.email ?? this.data?.email ?? '').toString().trim(),
      effectiveDate: toDateOnlyIso(effectiveDateValue), // date-only ISO
      status: payload?.statusFlag ?? this.data?.statusFlag ?? 1,
    };

    const api$ = this.selectedId
      ? this.service.update(this.selectedId, cleanPayload)
      : this.service.create(cleanPayload);

    api$.subscribe({
      next: () => {
        this.msg.success(
          isEdit ? 'Updated successfully' : 'Created successfully',
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

  // ================= DELETE =================
  delete(row: any) {
    this.modal.confirm({
      nzTitle: 'Delete Confirmation',
      nzContent: 'Are you sure you want to delete this record?',
      nzOkText: 'Yes, Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.service.delete(row.id).subscribe({
          next: () => {
            this.msg.success('Deleted successfully');
            this.loadTable();
          },
          error: (err) => {
            this.msg.error(err?.error?.message || 'Delete failed');
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
        // ❌ loading/finalize wala mutation remove
        options$: this.branches$.pipe(
          tap((branches: any[]) => {
            this.branchesCache = branches || [];
            this.branchDetailsMap.clear();

            (branches || []).forEach((b: any) => {
              const id = +(b.BranchID ?? b.Branch_ID ?? b.ID);
              if (Number.isNaN(id)) return;

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
              const shortCode = (b.BranchShortCode ?? b.ShortCode ?? '').trim();
              const phone = (b.BPHONE ?? b.BPhone ?? b.Phone ?? '').trim();
              const address = (
                b.BADDRESS ??
                b.BAddress ??
                b.Address ??
                ''
              ).trim();

              const bcId =
                b.BranchCoordinatorID ??
                b.BC_Emp_ID ??
                b.BC_EmpId ??
                b.BranchCoordinatorEmpId ??
                null;

              this.branchDetailsMap.set(id, {
                id,
                name,
                desc,
                shortCode,
                phone,
                address,
                bcId,
              });
            });

            this.branchesLoaded = true;
          }),
          map((branches: any[]) =>
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
                const shortCode = (
                  b.BranchShortCode ??
                  b.ShortCode ??
                  ''
                ).trim();
                const phone = (b.BPHONE ?? b.BPhone ?? b.Phone ?? '').trim();
                const address = (
                  b.BADDRESS ??
                  b.BAddress ??
                  b.Address ??
                  ''
                ).trim();

                const bcId =
                  b.BranchCoordinatorID ??
                  b.BC_Emp_ID ??
                  b.BC_EmpId ??
                  b.BranchCoordinatorEmpId ??
                  null;

                return {
                  label: name,
                  value: id,
                  searchText:
                    `${id} ${name} ${desc} ${shortCode} ${phone} ${address}`.trim(),
                  // ✅ optionColumns keys: id,name,desc,phone,address (extra fields allowed)
                  meta: { id, name, desc, shortCode, phone, address, bcId },
                };
              })
              .filter(Boolean),
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
        // ❌ loading/finalize wala mutation remove
        options$: this.employees$.pipe(
          tap((employees: any[]) => {
            this.empMap.clear();
            (employees || []).forEach((e: any) => {
              const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
              if (Number.isNaN(id)) return;
              const name = (e.APP_Name ?? e.Name ?? '').trim();
              this.empMap.set(id, name);
            });

            this.employeesLoaded = true;
          }),
          map((employees: any[]) =>
            (employees || [])
              .map((e: any) => {
                const id = +(e.EMP_ID ?? e.EmpId ?? e.ID);
                if (Number.isNaN(id)) return null;

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
                  label: name,
                  value: id,
                  searchText:
                    `${id} ${name} ${department} ${designation}`.trim(),
                  meta: { id, name, department, designation },
                };
              })
              .filter(Boolean),
          ),
        ),
      };
    }

    // ✅ single immutable update (Coordinator jaisa)
    this.formConfig = { ...this.formConfig, fields };
  }
}
