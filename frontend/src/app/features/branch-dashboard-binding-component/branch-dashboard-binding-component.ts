import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BRANCH_DASHBOARD_BINDING_FORM,
  BRANCH_DASHBOARD_BINDING_TABLE,
} from './branch-dashboard-binding-config';
import { BranchDashboardBindingService } from '../../core//services/branch-dashboard-binding-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';
import { finalize, map, shareReplay, tap } from 'rxjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';

@Component({
  selector: 'app-branch-dashboard-binding-component',
  standalone: true,
  imports: [Modal, Table, CommonModule],
  templateUrl: './branch-dashboard-binding-component.html',
  styleUrl: './branch-dashboard-binding-component.css',
})
export class BranchDashboardBindingComponent {
  formConfig = { ...BRANCH_DASHBOARD_BINDING_FORM };
  tableConfig = BRANCH_DASHBOARD_BINDING_TABLE;

  showModal = false;
  selectedId: number | null = null;

  data: any = {};
  tableData: any[] = [];
  private branchesCache: any[] = [];
  submitting = false;

  constructor(
    private service: BranchDashboardBindingService,
    private notification: NzNotificationService,
    private modal: NzModalService,
  ) {}

  ngOnInit() {
    this.loadDropdowns();
    this.loadTable();
  }

  // ---------- LOADERS ----------
  loadDropdowns() {
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId',
    );
    if (!branchField) return;

    branchField.loading = true;

    const branches$ = this.service.getBranches().pipe(
      map((res: any) => res?.data ?? res ?? []),
      tap((branches: any[]) => (this.branchesCache = branches)),
      map((branches: any[]) =>
        branches.map((x: any) => ({
          label: `${x.BranchName ?? 'NA'}`,
          value: +x.BranchID,
          meta: {
            id: +x.BranchID,
            name: x.BranchName ?? '',
            desc: x.BranchDesc ?? '',
            phone: x.BPHONE ?? '',
            address: x.BADDRESS ?? '',
          },
          searchText:
            `${x.BranchID} ${x.BranchName} ${x.BranchDesc} ${x.BPHONE} ${x.BADDRESS}`.trim(),
        })),
      ),
      finalize(() => (branchField.loading = false)),
      shareReplay(1),
    );

    branchField.options$ = branches$ as any;
    branchField.searchable = true;
  }

  loadTable() {
    this.service.getAll().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];

      this.tableData = rows.map((r: any) => {
        const flag = Number(r.Req_Con_Call ? 1 : 0);

        const d = r.EffectiveDate ? new Date(r.EffectiveDate) : null;
        const effectiveDateDisplay = d
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0',
            )}-${String(d.getDate()).padStart(2, '0')}`
          : '';

        return {
          id: r.ID,
          branchId: r.BranchID,
          branchName: r.BranchName ?? 'NA',
          branchDesc: r.BranchDesc ?? 'NA',

          // ✅ numeric (filter/edit stable)
          conferenceCallFlag: flag,

          // ✅ text (table display)
          conferenceCallText: flag === 1 ? 'Active' : 'Inactive',

          effectiveDate: r.EffectiveDate,
          effectiveDateDisplay,
        };
      });
    });
  }

  // ---------- MODES ----------
  private setMode(mode: 'create' | 'update') {
    this.formConfig = {
      ...this.formConfig,
      mode,
      fields: this.formConfig.fields.map((f) =>
        mode === 'update' && f.key === 'branchId'
          ? { ...f, disabled: true }
          : { ...f, disabled: false },
      ),
    };
  }

  openAddForm() {
    this.selectedId = null;
    this.setMode('create');
    this.data = { conferenceCallFlag: 1 };
    this.showModal = true;
  }

  edit(row: any) {
    this.selectedId = row.id;
    this.setMode('update');

    const branchName = (row?.branchName ?? '').toString().trim().toUpperCase();
    const branchIdNum = Number(row?.branchId);

    const badBranch =
      branchName === 'NA' || !Number.isFinite(branchIdNum) || branchIdNum <= 0;

    this.data = {
      ...row,
      branchId: badBranch ? null : branchIdNum,
    };

    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  onFormChange(evt: any) {
    const key = evt?.key;
    const value = evt?.value;
    const fv = evt?.formValue ?? {};

    // apply only the changed key to avoid overwriting pending control values
    if (key) {
      this.data = { ...this.data, [key]: value };
    } else {
      this.data = { ...this.data, ...fv };
    }

    const branchId = +(this.data.branchId ?? 0);
    const b = this.branchesCache.find((x) => +x.BranchID === branchId);

    this.data = {
      ...this.data,
      branchName: b?.BranchName ?? '',
      branchDesc: b?.BranchDesc ?? '',
    };
  }

  // ---------- SUBMIT ----------
  onSubmit(payload: any) {
    if (this.submitting) return;
    this.submitting = true;
    const done = () => (this.submitting = false);

    const isUpdate = !!this.selectedId;

    // ---------- helpers ----------
    const getId = (v: any): number => {
      if (v == null) return NaN;
      if (typeof v === 'number' || typeof v === 'string') return +v;
      return +(v.value ?? v.id ?? v.key ?? v.ID ?? v.BranchID);
    };

    const normalizeName = (s: any) => (s ?? '').toString().trim().toUpperCase();

    const isBadName = (s: any) => {
      const t = normalizeName(s);
      return !t || t === 'NA';
    };

    const toDateOnlyIso = (dt: any): string | null => {
      if (!dt) return null;

      const d = dt instanceof Date ? dt : new Date(dt);
      if (isNaN(d.getTime())) return null;

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      return `${y}-${m}-${day}T00:00:00.000Z`;
    };

    // ✅ trust this.data (branchId disabled in update)
    const branchId = getId(this.data?.branchId ?? payload?.branchId);

    // ---------- REQUIRED: branchId only ----------
    if (!Number.isFinite(branchId) || branchId <= 0) {
      this.notification.error('Validation', 'Please select a valid Branch.');
      done();
      return;
    }

    // ---------- derive branchName from cache (reliable) ----------
    const b = this.branchesCache?.find((x) => +x.BranchID === branchId) ?? null;

    const branchName = normalizeName(
      b?.BranchName ?? this.data?.branchName ?? payload?.branchName,
    );

    // ✅ ONLY block NA-name for UPDATE (your rule: DB me NA saved ho to edit na ho)
    if (isUpdate && isBadName(branchName)) {
      this.notification.error(
        'Validation',
        'Invalid record: Branch is NA/empty in DB. Please fix data first.',
      );
      done();
      return;
    }

    // ---------- other fields ----------
    const confFlag = Number(
      payload?.conferenceCallFlag ?? this.data?.conferenceCallFlag ?? 0,
    );

    const effectiveDateRaw = payload?.effectiveDate ?? this.data?.effectiveDate;
    const effectiveDate = toDateOnlyIso(effectiveDateRaw);

    // ---------- payload ----------
    const cleanPayload = {
      branchId,
      // always send these (create/update both) - stable
      reqConCall: Number.isFinite(confFlag) ? confFlag : 0,
      effectiveDate,
    };

    const api$ = isUpdate
      ? this.service.update(this.selectedId!, cleanPayload)
      : this.service.create(cleanPayload);

    api$.subscribe({
      next: () => {
        this.notification.success(
          'Success',
          isUpdate
            ? 'Branch Dashboard Binding updated successfully.'
            : 'Branch Dashboard Binding created successfully.',
        );
        this.showModal = false;
        this.loadTable();
        done();
      },
      error: (err) => {
        if (err?.status === 409 || err?.error?.code === 'DUPLICATE_BRANCH') {
          this.notification.error(
            'Duplicate Entry',
            err?.error?.message ||
              'This branch has already been bound. No new entry allowed.',
          );
          done();
          return;
        }

        this.notification.error(
          'Error',
          err?.error?.message || 'Something went wrong.',
        );
        done();
      },
    });
  }

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
            this.notification.success(
              'Deleted',
              'Branch Dashboard Binding deleted successfully.',
            );
            this.loadTable();
          },
          error: (err) => {
            this.notification.error(
              'Error',
              err?.error?.message || 'Delete failed.',
            );
          },
        });
      },
    });
  }
}
