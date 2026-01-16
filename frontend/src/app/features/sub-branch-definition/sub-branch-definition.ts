import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SUB_BRANCH_DEFINITION_FORM,
  SUB_BRANCH_DEFINITION_TABLE,
} from './sub-branch-definition-config';
import { SubBranchDefinitionService } from '../../core/services/sub-branch-definition-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';
import { map, tap, finalize, shareReplay } from 'rxjs';
import { take } from 'rxjs/operators';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';

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
  private lastBranchId = 0; // ✅ IMPORTANT: branch change tracking

  constructor(
    private service: SubBranchDefinitionService,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) {}

  ngOnInit() {
    this.loadTable();
    this.loadBranchDropdown();
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
              '0'
            )}-${String(entered.getDate()).padStart(2, '0')}`
          : '';

        const editedOnDisplay = edited
          ? `${edited.getFullYear()}-${String(edited.getMonth() + 1).padStart(
              2,
              '0'
            )}-${String(edited.getDate()).padStart(2, '0')}`
          : '';

        return {
          id: r.ID,
          subBranchId: r.SubBranchID,
          branchId: r.BranchID,
          branchName: r.BranchName,
          subBranchName: r.SubBranchName,

          // keep originals (optional)
          enteredOn: r.EnteredOn,
          enteredBy: r.EnteredBy,
          editedOn: r.EditedOn,
          editedBy: r.EditedBy,

          // ✅ new display fields
          enteredOnDisplay,
          editedOnDisplay,
        };
      });
    });
  }

  // ================= BRANCH DROPDOWN =================
  loadBranchDropdown() {
    const branchField = this.formConfig.fields.find(
      (f) => f.key === 'branchId'
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
      finalize(() => (branchField.loading = false))
    );

    branchField.options$ = branches$.pipe(
      map((branches: any[]) =>
        branches.map((b) => ({
          label: b.BranchName,
          value: +b.BranchID,
          searchText: `${b.BranchID} ${b.BranchName} ${b.BranchDesc}`,
          meta: { id: +b.BranchID, name: b.BranchName, desc: b.BranchDesc },
        }))
      )
    ) as any;

    branchField.searchable = true;

    // ✅ default selection only in CREATE mode / when modal open
    branches$.pipe(take(1)).subscribe((branches: any[]) => {
      const firstId = +branches?.[0]?.BranchID || 0;
      if (!firstId) return;

      if (!this.selectedId && this.showModal && !this.data?.branchId) {
        this.data = { ...this.data, branchId: firstId };
        this.lastBranchId = firstId; // ✅
        this.loadSubBranchDropdown(firstId, true);
      }
    });
  }

  // ================= SUB-BRANCH DROPDOWN =================
  loadSubBranchDropdown(branchId?: number, clearSelection: boolean = true) {
    const idx = this.formConfig.fields.findIndex(
      (f) => f.key === 'subBranchName'
    );
    if (idx === -1) return;

    if (clearSelection) this.data = { ...this.data, subBranchName: null };

    const fieldsA = [...this.formConfig.fields];
    fieldsA[idx] = { ...fieldsA[idx], loading: true, options: [] };
    this.formConfig = { ...this.formConfig, fields: fieldsA };

    if (!branchId) {
      const fieldsStop = [...this.formConfig.fields];
      fieldsStop[idx] = { ...fieldsStop[idx], loading: false };
      this.formConfig = { ...this.formConfig, fields: fieldsStop };
      return;
    }

    const req$ = this.service.getSubBranchesByBranchId(branchId, true);

    req$
      .pipe(
        map((res: any) => res?.data ?? res ?? []),
        map((rows: any[]) => {
          const mapByName = new Map<
            string,
            { name: string; isActive: number }
          >();

          for (const r of rows) {
            const name = String(r?.SubBranchName ?? '').trim();
            if (!name) continue;

            const isActive = Number(r?.IsActive ?? 1);
            const prev = mapByName.get(name);
            if (!prev || (prev.isActive === 0 && isActive === 1)) {
              mapByName.set(name, { name, isActive });
            }
          }

          return Array.from(mapByName.values()).map((x) => ({
            label: x.isActive ? x.name : `${x.name} (Deleted)`,
            value: x.name,
            searchText: x.name,
            meta: { name: x.name, isActive: x.isActive },
          }));
        }),
        finalize(() => {
          const fieldsB = [...this.formConfig.fields];
          fieldsB[idx] = { ...fieldsB[idx], loading: false };
          this.formConfig = { ...this.formConfig, fields: fieldsB };
        })
      )
      .subscribe((opts) => {
        const fieldsC = [...this.formConfig.fields];
        fieldsC[idx] = { ...fieldsC[idx], options: opts };
        this.formConfig = { ...this.formConfig, fields: fieldsC };
      });
  }

  // ================= FORM CHANGE (KEY FIX) =================
  onFormChange(ev: any) {
    if (ev?.formValue) this.data = { ...this.data, ...ev.formValue };

    const newBranchId = +(this.data?.branchId ?? 0);
    if (!newBranchId) return;
    if (newBranchId === this.lastBranchId) return;

    this.lastBranchId = newBranchId;
    this.data = { ...this.data, subBranchName: null };

    this.loadSubBranchDropdown(newBranchId, true);
  }

  // ================= MODES =================
  openAddForm() {
    this.selectedId = null;
    this.data = {};
    this.lastBranchId = 0;
    this.formConfig = { ...SUB_BRANCH_DEFINITION_FORM, mode: 'create' };
    this.showModal = true;

    this.loadBranchDropdown();

    this.loadSubBranchDropdown(0, true);
  }

  edit(row: any) {
    this.selectedId = row.id;
    this.data = { ...row };
    this.lastBranchId = +row.branchId || 0; // ✅ set tracker from row
    this.formConfig = { ...SUB_BRANCH_DEFINITION_FORM, mode: 'update' };
    this.showModal = true;

    setTimeout(() => {
      if (this.data?.branchId) {
        // ✅ edit open: load options but keep selected value
        this.loadSubBranchDropdown(+this.data.branchId, false);
      }
    }, 0);
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= SUBMIT =================
  onSubmit(payload: any) {
    const now = new Date().toISOString();

    const user =
      localStorage.getItem('userName') ||
      localStorage.getItem('username') ||
      localStorage.getItem('name') ||
      'Admin';

    const body: any = {
      branchId: payload.branchId,
      subBranchName: payload.subBranchName,
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
            'Sub-Branch Name already exists for this branch'
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
