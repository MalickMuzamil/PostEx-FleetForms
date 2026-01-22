import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  SUB_BRANCH_DEFINITION_FORM,
  SUB_BRANCH_DEFINITION_TABLE,
} from './sub-branch-definition-config';

import { SubBranchDefinitionService } from '../../core/services/sub-branch-definition-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';

import { map, tap, finalize, shareReplay } from 'rxjs';
import { take } from 'rxjs/operators';

import { AppValidators } from '../../core/services/validators';

@Component({
  selector: 'app-sub-branch-definition',
  standalone: true,
  imports: [CommonModule, Table, Modal],
  templateUrl: './sub-branch-definition.html',
})
export class SubBranchDefinitionComponent implements OnInit {
  formConfig = { ...SUB_BRANCH_DEFINITION_FORM };
  tableConfig = SUB_BRANCH_DEFINITION_TABLE;

  showModal = false;
  selectedId: number | null = null;

  data: any = {};
  tableData: any[] = [];

  private branchMap = new Map<number, any>();
  private lastBranchId = 0;

  constructor(
    private service: SubBranchDefinitionService,
    private notification: NzNotificationService,
    private modal: NzModalService,
  ) {}

  ngOnInit() {
    this.loadTable();
    this.loadBranchDropdown();
    this.applySubBranchValidator(); // safe init
  }

  // ================= TABLE =================
  loadTable() {
    this.service.getAll().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];

      this.tableData = rows.map((r: any) => {
        const entered = r.EnteredOn ? new Date(r.EnteredOn) : null;
        const edited = r.EditedOn ? new Date(r.EditedOn) : null;

        const enteredOnDisplay = entered
          ? `${entered.getFullYear()}-${String(entered.getMonth() + 1).padStart(
              2,
              '0',
            )}-${String(entered.getDate()).padStart(2, '0')}`
          : '';

        const editedOnDisplay = edited
          ? `${edited.getFullYear()}-${String(edited.getMonth() + 1).padStart(
              2,
              '0',
            )}-${String(edited.getDate()).padStart(2, '0')}`
          : '';

        return {
          id: r.ID,
          subBranchId: r.SubBranchID,
          branchId: r.BranchID,

          branchName: r.BranchName,
          branchDesc: r.BranchDesc,

          subBranchName: r.SubBranchName,
          subBranchDesc: r.SubBranchDesc,

          enteredOn: r.EnteredOn,
          enteredBy: r.EnteredBy,
          editedOn: r.EditedOn,
          editedBy: r.EditedBy,

          enteredOnDisplay,
          editedOnDisplay,
        };
      });
    });
  }

  // ================= BRANCH DROPDOWN =================
  loadBranchDropdown() {
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId',
    );
    if (!branchField) return;

    branchField.loading = true;

    const branches$ = this.service.getBranches().pipe(
      map((res: any) => res?.data ?? res ?? []),
      tap((branches: any[]) => {
        this.branchMap.clear();
        branches.forEach((b) => {
          const id = +b.BranchID;
          this.branchMap.set(id, { name: b.BranchName, desc: b.BranchDesc });
        });
      }),
      shareReplay(1),
      finalize(() => (branchField.loading = false)),
    );

    branchField.options$ = branches$.pipe(
      map((branches: any[]) =>
        branches.map((b) => ({
          label: b.BranchName,
          value: +b.BranchID,
          searchText: `${b.BranchID} ${b.BranchName} ${b.BranchDesc}`,
          meta: { id: +b.BranchID, name: b.BranchName, desc: b.BranchDesc },
        })),
      ),
    ) as any;

    branchField.searchable = true;

    // ✅ IMPORTANT: default selection OFF (no auto select)
    // (Removed take(1) auto set first branch)
  }

  // ================= Helpers =================
  private getSelectedBranchCode(): string {
    const branchId = +(this.data?.branchId ?? 0);
    const b = this.branchMap.get(branchId);

    // b.name example: "LHE - 1" or "FSD - 1"
    const name = (b?.name ?? '').toString();
    const code = name.split('-')[0].trim().toUpperCase(); // "LHE"
    return code || '';
  }

  private applySubBranchValidator() {
    const idx = this.formConfig.fields.findIndex(
      (f) => f.key === 'subBranchName',
    );
    if (idx === -1) return;

    const fields = [...this.formConfig.fields];
    fields[idx] = {
      ...fields[idx],
      // ✅ placeholder removed
      validators: [
        AppValidators.subBranchNameWithBranch(() =>
          this.getSelectedBranchCode(),
        ),
      ],
    };

    this.formConfig = { ...this.formConfig, fields };
  }

  // ================= FORM CHANGE =================
  onFormChange(ev: any) {
    if (ev?.formValue) {
      this.data = { ...this.data, ...ev.formValue };
    }

    const newBranchId = +(this.data?.branchId ?? 0);

    const normalizeSubBranch = (raw: any, code: string) => {
      const prefix = (code || '').trim().toUpperCase();
      if (!prefix) return null;

      let v = (raw ?? '').toString().toUpperCase().replace(/\s+/g, '');

      // avoid LHE-LHE
      v = v.replace(new RegExp(`^${prefix}-?`), '');

      // only A-Z 0-9
      const cleaned = v.replace(/[^A-Z0-9]/g, '').slice(0, 6);

      const mid = cleaned.slice(0, 3);
      const last = cleaned.slice(3, 6);

      if (!mid) return `${prefix}-`;
      if (cleaned.length <= 3) return `${prefix}-${mid}`;
      return `${prefix}-${mid}-${last}`;
    };

    // ===== branch cleared =====
    if (!newBranchId) {
      this.data = {
        ...this.data,
        branchName: '',
        branchDesc: '',
        subBranchName: null,
      };
      this.lastBranchId = 0;
      this.applySubBranchValidator();
      return;
    }

    const b = this.branchMap.get(newBranchId);
    const code = this.getSelectedBranchCode();

    // ===== branch changed =====
    if (newBranchId !== this.lastBranchId) {
      this.lastBranchId = newBranchId;

      this.data = {
        ...this.data,
        branchName: b?.name ?? '',
        branchDesc: b?.desc ?? '',
        subBranchName: code ? `${code}-` : null,
      };

      this.applySubBranchValidator();
      return;
    }

    // ===== branch same → enforce format =====
    if (code) {
      const current = this.data?.subBranchName;
      const fixed = normalizeSubBranch(current, code);

      if (fixed !== current) {
        this.data = { ...this.data, subBranchName: fixed };
      }
    }
  }

  // ================= MODES =================
  openAddForm() {
    this.selectedId = null;
    this.lastBranchId = 0;

    this.data = {
      branchId: null,
      branchName: '',
      branchDesc: '',
      subBranchName: null,
      subBranchDesc: null,
    };

    this.formConfig = { ...SUB_BRANCH_DEFINITION_FORM, mode: 'create' };
    this.showModal = true;

    this.loadBranchDropdown();
    this.applySubBranchValidator();
  }

  edit(row: any) {
    this.selectedId = row.id;
    this.lastBranchId = +row.branchId || 0;

    this.data = {
      ...row,
      branchId: this.lastBranchId || null,
      branchName: row.branchName ?? '',
      branchDesc: row.branchDesc ?? '',
      subBranchName: (row.subBranchName ?? '').toString().toUpperCase(),
    };

    this.formConfig = { ...SUB_BRANCH_DEFINITION_FORM, mode: 'update' };
    this.showModal = true;

    // ✅ load dropdown and after map fills, ensure readonly fields + validator are correct
    this.loadBranchDropdown();

    setTimeout(() => {
      // fallback fill from branchMap (in case row didn't include)
      const b = this.branchMap.get(this.lastBranchId);
      if (b && (!this.data.branchName || !this.data.branchDesc)) {
        this.data = {
          ...this.data,
          branchName: this.data.branchName || b.name || '',
          branchDesc: this.data.branchDesc || b.desc || '',
        };
      }

      this.applySubBranchValidator();
    }, 0);
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= SUBMIT =================
  onSubmit(payload: any) {
    const code = this.getSelectedBranchCode();
    const value = (payload.subBranchName ?? '').toString().trim().toUpperCase();

    const fullRegex = new RegExp(`^${code}-[A-Z0-9]{3}-[A-Z0-9]{3}$`);
    if (!fullRegex.test(value)) {
      this.notification.error('Invalid Format', `Must be ${code}-A0A-AAA`);
      return;
    }

    const now = new Date().toISOString();
    const user =
      localStorage.getItem('userName') ||
      localStorage.getItem('username') ||
      localStorage.getItem('name') ||
      'Admin';

    const body: any = {
      branchId: payload.branchId,
      subBranchName: value,
      subBranchDesc: (payload.subBranchDesc ?? '').toString().trim(),
    };

    if (this.selectedId) {
      body.editedOn = now;
      body.editedBy = user;
    } else {
      body.enteredOn = now;
      body.enteredBy = user;
    }

    const api$ = this.selectedId
      ? this.service.update(this.selectedId, body)
      : this.service.create(body);

    api$.subscribe({
      next: () => {
        this.notification.success('Success', 'Saved successfully');
        this.showModal = false;
        this.loadTable();
      },
      error: (err) => {
        if (err?.status === 409) {
          this.notification.error(
            'Duplicate',
            'Sub-Branch Name already exists for this branch',
          );
          return;
        }
        this.notification.error('Error', 'Something went wrong');
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
            this.notification.success('Deleted', 'Record deleted');
            this.loadTable();
          },
          error: () => {
            this.notification.error('Error', 'Delete failed');
          },
        });
      },
    });
  }
}
