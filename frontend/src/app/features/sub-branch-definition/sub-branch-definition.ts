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
    private notification: NzNotificationService
  ) {}

  ngOnInit() {
    this.loadTable();
    this.loadBranchDropdown();
  }

  // ================= TABLE =================
  loadTable() {
    this.service.getAll().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];
      this.tableData = rows.map((r: any) => ({
        id: r.ID,
        subBranchId: r.SubBranchID,
        branchId: r.BranchID,
        branchName: r.BranchName,
        subBranchName: r.SubBranchName,

        enteredOn: r.EnteredOn,
        enteredBy: r.EnteredBy,
        editedOn: r.EditedOn,
        editedBy: r.EditedBy,
      }));
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

    // clear options immediately
    const fieldsA = [...this.formConfig.fields];
    fieldsA[idx] = { ...fieldsA[idx], loading: false, options: [] };
    this.formConfig = { ...this.formConfig, fields: fieldsA };

    const hasBranch = !!branchId;

    // ✅ If no branch -> stop (no API)
    if (!hasBranch) return;

    // ✅ Always hit API for selected branch
    const req$ = this.service.getSubBranchesByBranchId(branchId!);

    req$
      .pipe(
        map((res: any) => res?.data ?? res ?? []),
        map((rows: any[]) =>
          rows
            .map((r) => (r.SubBranchName ?? '').trim())
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((name) => ({
              label: name,
              value: name,
              searchText: name,
              meta: { name },
            }))
        ),
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
    // ✅ branchId nikaalo even if key missing
    const newBranchId =
      ev?.key === 'branchId' ? +ev?.value : +(ev?.formValue?.branchId ?? 0);

    // merge latest form state
    if (ev?.formValue) {
      this.data = { ...this.data, ...ev.formValue };
    }

    // ✅ if branchId valid nahi, exit
    if (!newBranchId) return;

    // ✅ detect change using tracker (NOT this.data.branchId)
    if (newBranchId === this.lastBranchId) return;

    // ✅ update tracker
    this.lastBranchId = newBranchId;

    const bd = this.branchMap.get(newBranchId);

    this.data = {
      ...this.data,
      branchId: newBranchId,
      branchName: bd?.name,
      branchDesc: bd?.desc,
      subBranchName: null,
    };

    // ✅ HIT API always on branch change
    this.loadSubBranchDropdown(newBranchId, true);
  }

  // ================= MODES =================
  openAddForm() {
    this.selectedId = null;
    this.data = {};
    this.lastBranchId = 0;
    this.formConfig = { ...SUB_BRANCH_DEFINITION_FORM, mode: 'create' };
    this.showModal = true;

    // ✅ Do NOT call getAll here
    this.loadSubBranchDropdown(0, true); // or just clear options without API
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
    if (!confirm('Delete this record?')) return;

    this.service.delete(row.id).subscribe(() => {
      this.notification.success('Deleted', 'Record deleted');
      this.loadTable();
    });
  }
}
