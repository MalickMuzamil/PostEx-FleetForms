import { Component, OnInit } from '@angular/core';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import {
  DELIVERY_ROUTE_BINDING_FORM,
  DELIVERY_ROUTE_BINDING_EDIT_FORM,
  DELIVERY_ROUTE_BINDING_TABLE,
} from './delivery-route-binding-component-config';

import { DeliveryRouteBindingService } from '../../core/services/delivery-route-binding-service';
import { SubBranchDefinitionService } from '../../core/services/sub-branch-definition-service';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DeliveryRouteDefinitionService } from '../../core/services/delivery-route-definition-service';

@Component({
  selector: 'app-delivery-route-binding-component',
  standalone: true,
  imports: [Table, Modal, NzModalModule],
  templateUrl: './delivery-route-binding-component.html',
  styleUrl: './delivery-route-binding-component.css',
})
export class DeliveryRouteBindingComponent implements OnInit {
  // ===== CONFIGS =====
  bulkFormConfig = { ...DELIVERY_ROUTE_BINDING_FORM };
  editFormConfig = { ...DELIVERY_ROUTE_BINDING_EDIT_FORM };
  formConfig: any = { ...DELIVERY_ROUTE_BINDING_FORM };

  tableConfig = DELIVERY_ROUTE_BINDING_TABLE;

  // ===== STATE =====
  showModal = false;
  data: any = {};
  tableData: any[] = [];

  // ===== DROPDOWNS =====
  branches: any[] = [];
  deliveryRoutes: any[] = [];
  correctDescriptions: any[] = [];

  // edit-mode filtered dropdowns
  routeBranches: any[] = [];
  subBranches: any[] = [];

  // ===== EDIT MODE =====
  isEditMode = false;
  editingRow: any = null;

  private originalEdit: {
    effectiveDate: string | null;
    branchId: number | null;
    subBranchId: number | null;
    deliveryRouteId: number | null;
  } | null = null;

  private subBranchLoading = false;

  // ✅ NEW: prevents patch -> re-emit -> loop/hang
  private suppressChanges = false;

  private readonly REQUIRED_COLUMNS = [
    'BranchId',
    'SubBranchId',
    'DeliveryRouteID',
    'EffectiveDate',
    'RequiredReportsFlag',
  ];

  constructor(
    private bindingService: DeliveryRouteBindingService,
    private subBranchService: SubBranchDefinitionService,
    private definitionService: DeliveryRouteDefinitionService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) {}

  ngOnInit(): void {
    this.loadTable();
    this.loadBranches();
    this.loadDeliveryRoutes();
    this.loadCorrectDescriptions();
  }

  // ✅ helper: handles select value as object OR primitive
  private normalizeSelectValue(v: any): any {
    // common dynamic-form patterns:
    // { value: 1, label: '...' }  OR  1
    return v?.value ?? v;
  }

  // ✅ safe patch to avoid loops
  private safePatchEditOptions() {
    this.suppressChanges = true;
    this.patchEditOptions();

    Promise.resolve().then(() => (this.suppressChanges = false));
  }

  // ================= TABLE =================
  loadTable() {
    this.bindingService.getAll().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];

      this.tableData = rows.map((r: any) => {
        const isActive =
          r.RequiredReportsFlag === 1 || r.RequiredReportsFlag === true;

        // ✅ date only: YYYY-MM-DD
        const d = r.EffectiveDate ? new Date(r.EffectiveDate) : null;
        const effectiveDateOnly = d
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0'
            )}-${String(d.getDate()).padStart(2, '0')}`
          : '';

        return {
          id: r.ID ?? r.Id,

          branchId: r.BranchID,
          branchName: r.BranchName,

          subBranchId: r.SubBranchID,
          subBranchName: r.SubBranchName,

          deliveryRouteId: r.DeliveryRouteID,
          deliveryRouteDescription: r.DeliveryRouteDescription,

          // ✅ keep real date for edit logic if needed
          effectiveDate: d,

          // ✅ keep flag for edit payloads
          requiredReportsFlag: isActive ? 1 : 0,

          // ✅ NEW display fields for table
          effectiveDateDisplay: effectiveDateOnly,
          requiredReportsDisplay: isActive ? 'Active' : 'Inactive',
        };
      });
    });
  }

  // ================= DROPDOWNS =================
  loadBranches() {
    this.subBranchService.getBranches().subscribe({
      next: (res: any) => {
        this.branches = res?.data ?? [];
        this.safePatchEditOptions();
      },
      error: () => this.notification.error('Error', 'Failed to load branches'),
    });
  }

  loadDeliveryRoutes() {
    this.bindingService.getAll().subscribe({
      next: (res: any) => {
        const list = res?.data ?? [];
        const map = new Map<number, any>();

        const beforeDash = (text: any): string => {
          const s = String(text ?? '').trim();
          if (!s) return '';
          // "KHI-009 - Muzamil" => "KHI-009"
          return s.split(' - ')[0].trim();
        };

        list.forEach((x: any) => {
          const rid = Number(x.DeliveryRouteID);
          if (!rid) return;

          if (!map.has(rid)) {
            map.set(rid, {
              value: rid,
              label: beforeDash(
                `${x.DeliveryRouteNo ?? rid} - ${
                  x.DeliveryRouteDescription ?? ''
                }`
              ),
              BranchID: Number(x.BranchID) || null,
              DeliveryRouteID: rid,
            });
          }
        });

        this.deliveryRoutes = Array.from(map.values());
        this.safePatchEditOptions();
      },
      error: () =>
        this.notification.error('Error', 'Failed to load delivery routes'),
    });
  }

  loadCorrectDescriptions() {
    this.definitionService.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];
        this.correctDescriptions = rows
          .map((r: any) => {
            const text = String(
              r.CorrectionDescriptionforReports ||
                r.routeDescription ||
                r.RouteDescription ||
                ''
            ).trim();
            return { value: text, label: text };
          })
          .filter((x: any) => !!x.value);

        this.safePatchEditOptions();
      },
      error: () =>
        this.notification.error('Error', 'Failed to load report descriptions'),
    });
  }

  // ================= FILTERED LOADERS (EDIT MODE) =================
  private loadBranchesByRouteId(routeId: number | null) {
    const rid = Number(routeId) || null;

    if (!rid) {
      this.routeBranches = [];
      this.safePatchEditOptions();
      return;
    }

    this.bindingService.getBranchesByRoute(rid).subscribe({
      next: (res: any) => {
        const list = res?.data ?? [];
        this.routeBranches = list.map((b: any) => ({
          value: Number(b.BranchID ?? b.BranchId),
          label: b.BranchName ?? b.BranchID ?? b.BranchId,
          ...b,
        }));
        this.safePatchEditOptions();

        // keep selected valid
        if (this.data?.branchId) {
          const ok = this.routeBranches.some(
            (x: any) => Number(x.value) === Number(this.data.branchId)
          );
          if (!ok) {
            this.data = { ...this.data, branchId: null, subBranchId: null };
            this.subBranches = [];
            this.safePatchEditOptions();
          } else {
            this.loadSubBranchesByRouteAndBranch(
              rid,
              Number(this.data.branchId),
              true
            );
          }
        }
      },
      error: () =>
        this.notification.error('Error', 'Failed to load branches by route'),
    });
  }

  private loadSubBranchesByRouteAndBranch(
    routeId: number | null,
    branchId: number | null,
    keepSelected = false
  ) {
    const rid = Number(routeId) || null;
    const bid = Number(branchId) || null;

    if (!rid || !bid) {
      this.subBranches = [];
      this.safePatchEditOptions();
      return;
    }

    if (this.subBranchLoading) return;
    this.subBranchLoading = true;

    this.subBranches = [];
    this.safePatchEditOptions();

    this.bindingService.getSubBranchesByRouteAndBranch(rid, bid).subscribe({
      next: (res: any) => {
        const list = res?.data ?? [];

        this.subBranches = list.map((x: any) => ({
          value: Number(x.SubBranchID ?? x.Sub_Branch_ID ?? x.value),
          label:
            x.SubBranchName ??
            x.Sub_Branch_Name ??
            x.label ??
            x.SubBranchID ??
            x.Sub_Branch_ID,
          ...x,
        }));

        this.safePatchEditOptions();

        if (keepSelected && this.data?.subBranchId) {
          const ok = this.subBranches.some(
            (s: any) => Number(s.value) === Number(this.data.subBranchId)
          );
          if (!ok) this.data = { ...this.data, subBranchId: null };
        }
      },
      error: () =>
        this.notification.error('Error', 'Failed to load sub branches'),
      complete: () => {
        this.subBranchLoading = false;
      },
    });
  }

  // ================= PATCH FORM OPTIONS =================
  private patchEditOptions() {
    this.editFormConfig = {
      ...DELIVERY_ROUTE_BINDING_EDIT_FORM,
      fields: DELIVERY_ROUTE_BINDING_EDIT_FORM.fields.map((f: any) => {
        if (f.key === 'deliveryRouteId') {
          return {
            ...f,
            options: this.deliveryRoutes ?? [],
            disabled: this.isEditMode,
          };
        }

        if (f.key === 'branchId') {
          const opts = this.isEditMode
            ? this.routeBranches ?? []
            : (this.branches ?? []).map((b: any) => ({
                value: Number(b.BranchID ?? b.BranchId),
                label: b.BranchName ?? b.BranchID ?? b.BranchId,
                ...b,
              }));

          return { ...f, options: opts, disabled: this.isEditMode };
        }

        if (f.key === 'subBranchId') {
          // ✅ IMPORTANT: always filtered
          return { ...f, options: this.subBranches ?? [] };
        }

        if (f.key === 'correctDescriptionForReports') {
          return { ...f, options: this.correctDescriptions ?? [] };
        }

        return f;
      }),
    };

    // ✅ FIX: OnPush child ko update karne ke liye NEW reference do (no mutation)
    if (this.isEditMode && this.showModal) {
      this.formConfig = {
        ...this.editFormConfig,
        fields: [...this.editFormConfig.fields],
      };

      // optional: ensure data reference bhi fresh rahe
      this.data = { ...this.data };
    }
  }

  // ================= MODAL =================
  openAddForm() {
    this.isEditMode = false;
    this.editingRow = null;

    this.formConfig = this.applyMode({ ...this.bulkFormConfig }, 'create');
    this.data = {};
    this.showModal = true;
  }

  openEditForm(row: any) {
    this.isEditMode = true;
    this.editingRow = row;

    const routeId = Number(row.deliveryRouteId) || null;
    const branchId = Number(row.branchId) || null;
    const subBranchId = Number(row.subBranchId) || null;

    this.routeBranches = [];
    this.subBranches = [];
    this.safePatchEditOptions();

    const eff = this.asLocalDate(row.effectiveDate ?? row.EffectiveDate);

    this.data = {
      deliveryRouteId: routeId,
      branchId,
      subBranchId,
      effectiveDate: eff,
      correctDescriptionForReports: row.deliveryRouteDescription || null,
      requiredReportsFlag:
        row.requiredReportsFlag === 1 || row.requiredReportsFlag === true
          ? 1
          : 0,
    };

    // ✅ snapshot for confirmation checks
    this.originalEdit = {
      effectiveDate: eff ? eff.toISOString().split('T')[0] : null,
      branchId,
      subBranchId,
      deliveryRouteId: routeId,
    };

    this.formConfig = this.applyMode({ ...this.editFormConfig }, 'update');
    this.showModal = true;

    this.loadBranchesByRouteId(routeId);
    if (routeId && branchId) {
      this.loadSubBranchesByRouteAndBranch(routeId, branchId, true);
    }

    this.data = { ...this.data };
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= FORM CHANGE =================
  async onFormChange(evt: { key: string; value: any; formValue: any }) {
    if (this.suppressChanges) return;

    // -------- BULK IMPORT FLOW --------
    if (!this.isEditMode && evt.key === 'bulkImport' && evt.value) {
      const file: File = evt.value;
      const isValid = await this.validateBulkFile(file);

      if (!isValid) {
        this.notification.error(
          'Invalid File',
          'Please upload Delivery Route bulk file',
          { nzDuration: 3000 }
        );
        return;
      }

      this.showModal = false;
      this.router.navigate(['/delivery-route-binding/bulk-preview'], {
        state: { file },
      });
      return;
    }

    if (!this.isEditMode) return;

    const key = evt?.key;
    const v = this.normalizeSelectValue(evt?.value);

    // ✅ IMPORTANT: Never merge evt.formValue (it can overwrite effectiveDate)
    // if (!key && evt?.formValue) { ... }  <-- REMOVE

    // ✅ RequiredReportsFlag: MUTATE (no spread) so DynamicForm won't rebuild
    if (key === 'requiredReportsFlag') {
      this.data.requiredReportsFlag = Number(v) === 0 ? 0 : 1;
      return;
    }

    // ✅ EffectiveDate: MUTATE + always Date (local-safe)
    if (key === 'effectiveDate') {
      const dt = this.asLocalDate(v);
      this.data.effectiveDate = dt;

      // optional auto-active on date select
      if (dt) this.data.requiredReportsFlag = 1;

      return;
    }

    // ✅ Route change
    if (key === 'deliveryRouteId') {
      const rid = Number(v) || null;
      const prevRoute = Number(this.data?.deliveryRouteId) || null;
      if (prevRoute === rid) return;

      this.data.deliveryRouteId = rid;
      this.data.branchId = null;
      this.data.subBranchId = null;

      this.routeBranches = [];
      this.subBranches = [];
      this.safePatchEditOptions();

      this.loadBranchesByRouteId(rid);

      const route = this.deliveryRoutes.find(
        (x: any) => Number(x.value) === rid
      );
      const autoBranchId = Number(route?.BranchID) || null;

      if (rid && autoBranchId) {
        this.data.branchId = autoBranchId;
        this.data.subBranchId = null;

        this.safePatchEditOptions();
        this.loadSubBranchesByRouteAndBranch(rid, autoBranchId, false);
      }
      return;
    }

    // ✅ Branch change
    if (key === 'branchId') {
      const bId = Number(v) || null;
      const prevBranch = Number(this.data?.branchId) || null;
      if (prevBranch === bId) return;

      this.data.branchId = bId;
      this.data.subBranchId = null;

      this.subBranches = [];
      this.safePatchEditOptions();

      const rId = Number(this.data?.deliveryRouteId) || null;
      this.loadSubBranchesByRouteAndBranch(rId, bId, false);
      return;
    }

    // ✅ SubBranch change
    if (key === 'subBranchId') {
      const sid = Number(v) || null;
      const ok = this.subBranches.some((s: any) => Number(s.value) === sid);
      this.data.subBranchId = ok ? sid : null;
      return;
    }

    // ✅ Other fields: also mutate
    if (key) {
      (this.data as any)[key] = v;
    }

    if (key === 'submit') {
      await this.saveEdit(this.data);
    }
  }

  // ================= EDIT SAVE =================
  async saveEdit(formValue: any) {
    if (!this.editingRow?.id) return;

    const toYMD = (v: any): string | null => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    const newDate = toYMD(formValue?.effectiveDate);
    const oldDate = this.originalEdit?.effectiveDate ?? null;

    const isActive = Number(formValue?.requiredReportsFlag) !== 0;
    const dateChanged =
      !!oldDate && !!newDate && String(oldDate) !== String(newDate);

    const payloadBase: any = {
      effectiveDate: newDate,
      requiredReportsFlag: Number(formValue?.requiredReportsFlag) === 0 ? 0 : 1,

      branchId: Number(this.normalizeSelectValue(formValue?.branchId)) || null,
      subBranchId:
        Number(this.normalizeSelectValue(formValue?.subBranchId)) || null,
      deliveryRouteId:
        Number(this.normalizeSelectValue(formValue?.deliveryRouteId)) || null,

      correctDescriptionForReports:
        String(formValue?.correctDescriptionForReports ?? '').trim() || null,
    };

    const doUpdate = (force: boolean) => {
      const payload = { ...payloadBase, ...(force ? { force: true } : {}) };

      return new Promise<void>((resolve, reject) => {
        this.bindingService.update(this.editingRow.id, payload).subscribe({
          next: () => {
            this.notification.success('Success', 'Updated successfully');
            this.showModal = false;
            this.loadTable();

            // ✅ refresh snapshot
            this.originalEdit = {
              effectiveDate: payloadBase.effectiveDate,
              branchId: payloadBase.branchId,
              subBranchId: payloadBase.subBranchId,
              deliveryRouteId: payloadBase.deliveryRouteId,
            };

            resolve();
          },
          error: (e) => {
            const parsed = this.parseBackendError(e);
            reject(parsed);
          },
        });
      });
    };

    // ✅ YOUR REQUIREMENT:
    if (isActive && dateChanged) {
      this.modal.confirm({
        nzTitle: 'Confirmation Required',
        nzContent: `Confirmation Required An active binding already exists for this Branch/SubBranch/Route with a different effective date. Confirm overwrite.(${oldDate} → ${newDate}). Confirm overwrite?`,
        nzOkText: 'OK',
        nzCancelText: 'Cancel',
        nzOnOk: async () => {
          try {
            await doUpdate(true); // ✅ confirmed => force true
          } catch (err: any) {
            this.notification.error('Error', err?.message || 'Update failed');
          }
        },
      });
      return;
    }

    // ✅ normal save (no confirm needed)
    try {
      await doUpdate(false);
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();

      // ✅ if backend still says confirm overwrite (rare case)
      const isOverwriteCase =
        err?.status === 409 ||
        err?.code === 'CONFIRM_OVERWRITE' ||
        msg.includes('confirm overwrite') ||
        msg.includes('active binding already exists');

      if (isOverwriteCase) {
        this.modal.confirm({
          nzTitle: 'Overwrite existing binding?',
          nzContent:
            'Confirmation Required An active binding already exists for this Branch/SubBranch/Route with a different effective date. Confirm overwrite.',
          nzOkText: 'Yes, overwrite',
          nzCancelText: 'Cancel',
          nzOnOk: async () => {
            try {
              await doUpdate(true); // ✅ confirmed => force true
            } catch (err2: any) {
              this.notification.error(
                'Error',
                err2?.message || 'Update failed'
              );
            }
          },
        });
        return;
      }

      this.notification.error('Error', err?.message || 'Update failed');
    }
  }

  // ================= FILE VALIDATION =================
  private validateBulkFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res: any) => {
            const headers = res.meta.fields || [];
            resolve(this.matchHeaders(headers));
          },
        });
        return;
      }

      if (ext === 'xls' || ext === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(sheet);
          const headers = Object.keys(json[0] || {});
          resolve(this.matchHeaders(headers));
        };
        reader.readAsBinaryString(file);
        return;
      }

      resolve(false);
    });
  }

  private matchHeaders(headers: string[]): boolean {
    const matched = this.REQUIRED_COLUMNS.filter((c) =>
      headers.some((h) => h.toLowerCase().includes(c.toLowerCase()))
    );
    return matched.length >= 2;
  }

  // ================= ACTIONS =================
  delete(row: any) {
    this.modal.confirm({
      nzTitle: 'Delete Confirmation',
      nzContent: 'Are you sure you want to delete this binding?',
      nzOkText: 'Yes, Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',

      nzOnOk: () => {
        this.bindingService.delete(row.id).subscribe({
          next: () => {
            this.notification.success(
              'Deleted',
              'Binding deleted successfully'
            );
            this.loadTable();
          },
          error: () => {
            this.notification.error('Error', 'Delete failed');
          },
        });
      },
    });
  }

  private parseBackendError(err: any) {
    const status = err?.status;

    const body =
      typeof err?.error === 'string' ? { message: err.error } : err?.error;

    const message =
      body?.message || body?.error?.message || err?.message || 'Request failed';

    const code = body?.code || body?.error?.code;
    const conflict = body?.conflict || body?.error?.conflict;

    return { message, status, code, conflict };
  }

  private asLocalDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;

    // handles "YYYY-MM-DD"
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const y = +v.slice(0, 4);
      const m = +v.slice(5, 7);
      const d = +v.slice(8, 10);
      return new Date(y, m - 1, d);
    }

    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private applyMode(cfg: any, mode: 'create' | 'update') {
    const fields = cfg.fields.map((f: any) => {
      if (f.key === 'deliveryRouteId' || f.key === 'branchId') {
        return { ...f, disabled: mode === 'update' };
      }
      return { ...f };
    });

    return { ...cfg, mode, fields };
  }
}
