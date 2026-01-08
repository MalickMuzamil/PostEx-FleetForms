import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { DeliveryRouteBindingService } from '../../../core/services/delivery-route-binding-service';
import { AppValidators } from '../../../core/services/validators';
import { DeliveryRouteDefinitionService } from '../../../core/services/delivery-route-definition-service';
import { RouterLink } from '@angular/router';

interface BulkRow {
  rowNo: number;

  branchId: number | null;
  subBranchId: number | null;
  correctDescId: number | null;

  routeBranches: any[];
  subBranches: any[];
  correctDescText?: string;

  deliveryRouteId: number | null;
  deliveryRouteControl: FormControl<number | null>;

  effectiveDate: Date | null;
  effectiveDateControl: FormControl<Date | null>;

  requiredReportsFlag: number;
  checked: boolean;
  saving?: boolean;
  errors?: string[];

  // ✅ cache validity (performance)
  isValid?: boolean;
}

@Component({
  selector: 'app-delivery-route-bulk-preview-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzDatePickerModule,
    NzModalModule,
    NzSpinModule,
    RouterLink
  ],
  templateUrl: './delivery-route-bulk-preview-component.html',
  styleUrl: './delivery-route-bulk-preview-component.css',
})
export class DeliveryRouteBulkPreviewComponent implements OnInit {
  file!: File;

  // ---------- ERROR MESSAGES ----------
  private readonly DUP_ROUTE_ERR = 'Duplicate Delivery Route ID found in file';
  private readonly ROUTE_NOT_EXIST = 'Delivery Route ID does not exist';
  private readonly BRANCH_MISMATCH = 'Branch does not belong to selected Route';
  private readonly INVALID_FLAG = 'RequiredReportsFlag must be 0 or 1';
  private readonly INVALID_NUM = 'Invalid numeric value';

  rows: BulkRow[] = [];
  checkAll = false;
  bulkSaving = false;
  hasValidRow = false;

  // master routes
  deliveryRoutes: any[] = [];

  fileHeaders: string[] = [];
  correctDescriptions: any[] = [];
  columnMap: any = {};

  isLoading = true;
  loadingText = 'Loading routes...';
  private readonly PAST_DATE_ERR = 'Effective Date must be a future date';

  // server validation scheduling (to avoid loops/spam)
  private serverValidateTimer: any = null;
  private serverValidateInFlight = false;

  readonly REQUIRED_COLUMNS = [
    'BranchId',
    'SubBranchId',
    'DeliveryRouteID',
    'EffectiveDate',
    'RequiredReportsFlag',
  ];

  constructor(
    private bindingService: DeliveryRouteBindingService,
    private definitionService: DeliveryRouteDefinitionService,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) {}

  async ngOnInit(): Promise<void> {
    const state = history.state;
    this.file = state?.file;

    if (!this.file) {
      this.toast('error', 'No File', 'No file received');
      return;
    }

    this.isLoading = true;
    this.loadingText = 'Loading delivery routes...';

    await this.loadDeliveryRoutesPromise();

    this.loadingText = 'Loading report descriptions...';
    await this.loadCorrectDescriptionsPromise();

    this.loadingText = 'Reading file & validating...';
    this.parseFile(this.file);
  }

  // ✅ trackBy (smooth UI)
  trackByRow = (_: number, r: BulkRow) => r.rowNo;

  toast(type: 'success' | 'error' | 'warning', title: string, msg: string) {
    this.notification[type](title, msg);
  }

  // ---------------- CONFIRM MODAL ----------------
  private confirmOverwrite(
    message: string,
    existingDate?: string | null
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.modal.confirm({
        nzTitle: 'Confirmation Required',
        nzContent: `
        <div>
          <p>${message || 'Confirm overwrite?'}</p>
          ${
            existingDate
              ? `<p style="margin-top:8px">
                   <strong>Existing Effective Date:</strong>
                   <span style="color:#d46b08">${existingDate}</span>
                 </p>`
              : ''
          }
        </div>
      `,
        nzOkText: 'OK',
        nzCancelText: 'Cancel',
        nzOnOk: () => resolve(true),
        nzOnCancel: () => resolve(false),
      });
    });
  }

  private parseBackendError(err: any): {
    message: string;
    status?: number;
    code?: string;
    conflict?: any; // ✅ singular
  } {
    const status = err?.status;
    const body = err?.error;

    const message =
      body?.message || body?.error?.message || err?.message || 'Request failed';

    const code = body?.code || body?.error?.code;

    // ✅ backend returns "conflict" (NOT conflicts)
    const conflict = body?.conflict || body?.error?.conflict;

    return { message, status, code, conflict };
  }

  private isConfirmOverwriteError(err: any): boolean {
    const { status, code, message } = this.parseBackendError(err);
    if (status === 409) return true;
    if (code === 'CONFIRM_OVERWRITE' || code === 'CONFIRM_OVERWRITE_BULK')
      return true;
    return /confirm overwrite/i.test(message);
  }

  // ---------------- ERROR HELPERS ----------------
  private addErr(row: BulkRow, msg: string) {
    row.errors = row.errors ?? [];
    if (!row.errors.includes(msg)) row.errors.push(msg);
  }

  private removeErr(row: BulkRow, msg: string) {
    row.errors = (row.errors ?? []).filter((e) => e !== msg);
  }

  private clearManagedErrors(row: BulkRow) {
    [
      this.ROUTE_NOT_EXIST,
      this.BRANCH_MISMATCH,
      this.INVALID_FLAG,
      this.INVALID_NUM,
    ].forEach((m) => this.removeErr(row, m));
  }

  // ---------------- MASTER LOADERS ----------------
  private loadDeliveryRoutesPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.bindingService.getDeliveryRoutes().subscribe({
        next: (res: any) => {
          const list = res?.data ?? [];
          this.deliveryRoutes = list.map((r: any) => ({
            DeliveryRouteID:
              Number(r.DeliveryRouteID ?? r.RouteID ?? r.RouteId) || null,
            DeliveryRouteNo: r.DeliveryRouteNo ?? r.RouteNo ?? '',
            DeliveryRouteDescription:
              r.DeliveryRouteDescription ?? r.RouteDescription ?? '',
            BranchID: Number(r.BranchID ?? r.BranchId) || null,
          }));
          resolve();
        },
        error: () => {
          this.toast('error', 'Error', 'Failed to load delivery routes');
          resolve(); // resolve anyway so UI doesn't hang
        },
      });
    });
  }

  // Route -> Branches (ROW LEVEL)
  private loadBranchesByRouteForRow(row: BulkRow, routeId: number) {
    row.routeBranches = [];
    this.bindingService.getBranchesByRoute(routeId).subscribe({
      next: (res: any) => {
        const list = res?.data ?? [];
        row.routeBranches = list.map((b: any) => ({
          value: Number(b.BranchID),
          label: b.BranchName ?? b.BranchID,
          ...b,
        }));
      },
      error: () =>
        this.toast('error', 'Error', 'Failed to load branches by route'),
    });
  }

  private loadCorrectDescriptionsPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.definitionService.getAll().subscribe({
        next: (res: any) => {
          const rows = res?.data ?? res ?? [];
          this.correctDescriptions = rows.map((r: any) => ({
            id: Number(r.Id),
            text:
              r.CorrectionDescriptionforReports ||
              r.routeDescription ||
              r.RouteDescription ||
              '',
          }));
          resolve();
        },
        error: () => {
          this.toast('error', 'Error', 'Failed to load report descriptions');
          resolve();
        },
      });
    });
  }

  // Route + Branch -> SubBranches (ROW LEVEL)
  private loadSubBranchesForRow(
    row: BulkRow,
    routeId: number,
    branchId: number
  ) {
    row.subBranchId = null;
    row.subBranches = [];

    this.bindingService
      .getSubBranchesByRouteAndBranch(routeId, branchId)
      .subscribe({
        next: (res: any) => {
          row.subBranches = res?.data ?? [];

          // ✅ IMPORTANT: re-validate so UI errors update immediately
          this.applyLocalValidationsSafe();
          this.updateHasValidRow();
        },
        error: () =>
          this.toast('error', 'Error', 'Failed to load sub branches'),
      });
  }

  // ---------------- FILE PARSING ----------------
  parseFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') this.parseCSV(file);
    else if (ext === 'xls' || ext === 'xlsx') this.parseExcel(file);
    else this.toast('error', 'Invalid File', 'Unsupported file format');
  }

  parseCSV(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res: any) => {
        this.fileHeaders = res.meta.fields || [];
        this.handleHeaderValidation(res.data);
      },
    });
  }

  parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet);
      this.fileHeaders = Object.keys(json[0] || {});
      this.handleHeaderValidation(json);
    };
    reader.readAsBinaryString(file);
  }

  handleHeaderValidation(data: any[]) {
    const matched = this.REQUIRED_COLUMNS.filter((c) =>
      this.fileHeaders.some((h) => h.toLowerCase().includes(c.toLowerCase()))
    );

    if (matched.length < 2) {
      this.toast('error', 'Invalid File', 'This file is not related');
      this.isLoading = false;
      return;
    }

    this.autoMapColumns();
    this.mapRows(data);
  }

  autoMapColumns() {
    this.REQUIRED_COLUMNS.forEach((req) => {
      const found = this.fileHeaders.find((h) =>
        h.toLowerCase().includes(req.toLowerCase())
      );
      if (found) this.columnMap[req] = found;
    });
  }

  mapRows(data: any[]) {
    this.rows = data.map((r, i) => {
      const errors: string[] = [];
      const get = (k: string) => r[this.columnMap[k]];

      const routeId = Number(get('DeliveryRouteID')) || null;
      if (!routeId) errors.push('Delivery Route is required');

      const branchId = Number(get('BranchId')) || null;
      if (!branchId) errors.push('Branch is required');

      const subBranchId = Number(get('SubBranchId')) || null;
      if (!subBranchId) errors.push('Sub Branch is required');

      let date: Date | null = null;
      const rawDate = get('EffectiveDate');
      if (rawDate) {
        const d =
          typeof rawDate === 'number'
            ? new Date((rawDate - 25569) * 86400 * 1000)
            : new Date(rawDate);
        if (!isNaN(d.getTime())) date = d;
      }
      if (!date) errors.push('Invalid Date');

      const rawFlag = get('RequiredReportsFlag');
      const flagNum = rawFlag === '' || rawFlag == null ? 1 : Number(rawFlag);
      const requiredReportsFlag = flagNum === 0 ? 0 : flagNum === 1 ? 1 : 1;
      if (!(flagNum === 0 || flagNum === 1)) errors.push(this.INVALID_FLAG);

      return {
        rowNo: i + 1,
        branchId,
        subBranchId,
        correctDescId: null,
        routeBranches: [],
        subBranches: [],
        deliveryRouteId: routeId,
        deliveryRouteControl: new FormControl(routeId, { nonNullable: false }),
        effectiveDate: date,
        effectiveDateControl: new FormControl(date, [
          AppValidators.futureDate(),
        ]),
        requiredReportsFlag,
        checked: false,
        errors,
        isValid: false,
      };
    });

    this.validateDuplicateRouteIds();
    this.applyLocalValidationsSafe();
    this.scheduleServerValidation();
    this.updateHasValidRow();

    this.isLoading = false;
  }

  // ---------------- LOCAL VALIDATIONS ----------------
  private applyLocalValidations() {
    if (!this.rows.length || !this.deliveryRoutes.length) {
      this.updateHasValidRow();
      return;
    }

    const routeMap = new Map<number, any>();
    this.deliveryRoutes.forEach((r) => {
      if (r.DeliveryRouteID) routeMap.set(Number(r.DeliveryRouteID), r);
    });

    for (const row of this.rows) {
      this.clearManagedErrors(row);

      const routeId = Number(row.deliveryRouteControl.value) || 0;
      const branchId = Number(row.branchId) || 0;
      const subBranchId = Number(row.subBranchId) || 0;

      if (
        (row.deliveryRouteControl.value != null && !routeId) ||
        (row.branchId != null && !branchId) ||
        (row.subBranchId != null && !subBranchId)
      ) {
        this.addErr(row, this.INVALID_NUM);
        row.checked = false;
      }

      if (!routeId) continue;

      const route = routeMap.get(routeId);
      if (!route) {
        this.addErr(row, this.ROUTE_NOT_EXIST);
        row.checked = false;
        continue;
      }

      const expectedBranch = Number(route.BranchID) || null;

      // ✅ if file has different branch => show error + auto-correct
      if (expectedBranch && row.branchId !== expectedBranch) {
        if (row.branchId != null && Number(row.branchId) !== expectedBranch) {
          this.addErr(row, this.BRANCH_MISMATCH);
        }
        row.branchId = expectedBranch;
      }

      row.deliveryRouteId = routeId;
    }

    this.validateDuplicateRouteIds();
    this.updateHasValidRow();
  }

  // ---------------- SERVER VALIDATION (BATCH, NO SPAM) ----------------
  private scheduleServerValidation() {
    // ✅ no rows
    if (!this.rows.length) return;

    // ✅ no valid rows → DON'T DO ANYTHING
    if (!this.rows.some((r) => r.isValid)) return;

    // ✅ already validating
    if (this.serverValidateInFlight) return;

    if (this.serverValidateTimer) return;

    this.serverValidateTimer = setTimeout(() => {
      this.serverValidateTimer = null;
      this.applyServerValidation();
    }, 400); // little relaxed debounce
  }

  private applyServerValidation() {
    if (this.serverValidateInFlight) return;

    const hasFn = (this.bindingService as any).validateBulk instanceof Function;
    if (!hasFn) return;

    const payloads = this.rows
      .map((r) => ({
        branchId: r.branchId,
        subBranchId: r.subBranchId,
        deliveryRouteId: r.deliveryRouteControl.value,
        effectiveDate: r.effectiveDateControl.value
          ?.toISOString()
          .split('T')[0],
        requiredReportsFlag: r.requiredReportsFlag,
      }))
      .filter(
        (p) =>
          p.branchId && p.subBranchId && p.deliveryRouteId && p.effectiveDate
      );

    if (!payloads.length) return;

    // ✅ DO NOT BLOCK UI (no spinner on whole table)
    this.serverValidateInFlight = true;

    (this.bindingService as any).validateBulk(payloads).subscribe({
      next: (res: any) => {
        const invalidRows = res?.data?.invalidRows ?? [];

        // ✅ O(1) matching (no .find loop)
        const rowMap = new Map<string, BulkRow>();
        for (const r of this.rows) {
          const k = `${Number(r.branchId) || 0}|${Number(r.subBranchId) || 0}|${
            Number(r.deliveryRouteControl.value) || 0
          }`;
          rowMap.set(k, r);
        }

        for (const inv of invalidRows) {
          const key = `${Number(inv.branchId) || 0}|${
            Number(inv.subBranchId) || 0
          }|${Number(inv.deliveryRouteId) || 0}`;
          const match = rowMap.get(key);
          if (!match) continue;

          (inv.reasons ?? []).forEach((msg: string) => this.addErr(match, msg));
          match.checked = false;
        }

        this.updateHasValidRow();
        this.serverValidateInFlight = false;
      },
      error: () => {
        this.serverValidateInFlight = false;
      },
    });
  }

  // ---------------- DEPENDENT DROPDOWNS ----------------
  onRowRouteChange(row: BulkRow) {
    const routeId = Number(row.deliveryRouteControl.value) || null;
    row.deliveryRouteId = routeId;

    row.subBranchId = null;
    row.correctDescId = null;
    row.subBranches = [];
    row.routeBranches = [];
    row.checked = false;

    // ✅ run validations immediately
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();

    if (!routeId) {
      row.branchId = null;
      return;
    }

    this.loadBranchesByRouteForRow(row, routeId);

    const route = this.deliveryRoutes.find(
      (r: any) => Number(r.DeliveryRouteID) === Number(routeId)
    );

    const expectedBranchId = Number(route?.BranchID) || null;
    if (expectedBranchId) {
      row.branchId = expectedBranchId;

      this.loadSubBranchesForRow(row, routeId, expectedBranchId);
    } else {
      row.branchId = null;
      this.updateHasValidRow();
    }

    this.scheduleServerValidation();
  }

  onRowBranchChange(row: BulkRow) {
    row.subBranchId = null;
    row.subBranches = [];
    row.checked = false;

    const branchId = Number(row.branchId) || null;
    const routeId = Number(row.deliveryRouteControl.value) || null;

    // ✅ run validations immediately so error clears without extra click
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();

    if (!branchId || !routeId) return;

    this.loadSubBranchesForRow(row, routeId, branchId);
    this.scheduleServerValidation();
  }

  // ---------------- VALIDATION ----------------
  isRowValid(row: BulkRow): boolean {
    const hasDup = this.hasDuplicateRouteError(row);
    return (
      !hasDup &&
      (row.errors?.length ?? 0) === 0 &&
      row.branchId != null &&
      row.subBranchId != null &&
      !!row.deliveryRouteControl.value &&
      row.effectiveDateControl.valid &&
      !!row.effectiveDateControl.value &&
      row.correctDescId != null
    );
  }

  updateHasValidRow() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);
      if (!r.isValid) r.checked = false; // keep selection safe
    }

    this.hasValidRow = this.rows.some((r) => r.isValid === true);

    this.checkAll =
      this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  disablePastDates = (d: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d <= today;
  };

  onToggleAll(checked: boolean) {
    this.checkAll = checked;
    this.rows.forEach((r) => (r.checked = checked ? !!r.isValid : false));
    this.checkAll =
      this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  onRowToggle(row: BulkRow, checked: boolean) {
    row.checked = checked && !!row.isValid;
    this.checkAll =
      this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  // ---------------- BULK SAVE ----------------
  async proceedBulkUpdate() {
    const selected = this.rows.filter((r) => r.checked && this.isRowValid(r));
    if (selected.length < 2) return;

    this.bulkSaving = true;

    const descMap = new Map<number, string>();
    for (const d of this.correctDescriptions) {
      descMap.set(Number(d.id), String(d.text || '').trim());
    }

    const payload = selected.map((r) => {
      const descText = descMap.get(Number(r.correctDescId)) || '';

      return {
        branchId: r.branchId,
        subBranchId: r.subBranchId,
        deliveryRouteId: r.deliveryRouteControl.value,
        effectiveDate: r.effectiveDateControl.value
          ?.toISOString()
          .split('T')[0],
        requiredReportsFlag: r.requiredReportsFlag,

        correctDescriptionForReports: descText,
        // correctDescriptionForReportsId: r.correctDescId,
      };
    });

    // ✅ helper (safe)
    const formatYMD = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    try {
      const chunks = this.chunk(payload, 100);

      for (let idx = 0; idx < chunks.length; idx++) {
        await new Promise<void>((resolve, reject) => {
          this.bindingService.create({ payloads: chunks[idx] }).subscribe({
            next: () => resolve(),
            error: async (e) => {
              if (this.isConfirmOverwriteError(e)) {
                const { message, conflict } = this.parseBackendError(e);

                // ✅ pick existing effective date from backend conflict
                const existingDate = formatYMD(conflict?.ExistingEffectiveDate);

                const ok = await this.confirmOverwrite(message, existingDate);
                if (!ok) return reject(e);

                this.bindingService
                  .create({ payloads: chunks[idx], force: true })
                  .subscribe({
                    next: () => resolve(),
                    error: (e2) => reject(e2),
                  });

                return;
              }

              reject(e);
            },
          });
        });
      }

      this.bulkSaving = false;
      this.rows.forEach((r) => (r.checked = false));
      this.checkAll = false;
      this.toast('success', 'Success', `Bulk saved (${selected.length})`);
    } catch (e: any) {
      this.bulkSaving = false;
      const { message } = this.parseBackendError(e);
      this.toast('error', 'Error', message || 'Bulk failed');
    }
  }

  // ---------------- SINGLE SAVE ----------------
  async saveRow(row: BulkRow) {
    if (!this.isRowValid(row)) return;

    row.saving = true;

    const selectedDesc = this.correctDescriptions.find(
      (d: any) => Number(d.id) === Number(row.correctDescId)
    );
    const descText = String(selectedDesc?.text || '').trim();

    const payload: any = {
      branchId: row.branchId,
      subBranchId: row.subBranchId,
      deliveryRouteId: row.deliveryRouteControl.value,
      effectiveDate: row.effectiveDateControl.value
        ?.toISOString()
        .split('T')[0],
      requiredReportsFlag: row.requiredReportsFlag,

      correctDescriptionForReports: descText,
      // correctDescriptionForReportsId: row.correctDescId,
    };

    // ✅ helper (safe)
    const formatYMD = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    this.bindingService.create(payload).subscribe({
      next: () => {
        row.saving = false;
        row.checked = false;
        this.checkAll = false;
        this.toast('success', 'Saved', `Row ${row.rowNo} saved successfully`);
      },
      error: async (e) => {
        if (this.isConfirmOverwriteError(e)) {
          const { message, conflict } = this.parseBackendError(e);

          // ✅ pick existing effective date from backend conflict
          const existingDate = formatYMD(conflict?.ExistingEffectiveDate);

          const ok = await this.confirmOverwrite(message, existingDate);
          if (!ok) {
            row.saving = false;
            this.toast('warning', 'Cancelled', 'Operation cancelled');
            return;
          }

          this.bindingService.create({ ...payload, force: true }).subscribe({
            next: () => {
              row.saving = false;
              row.checked = false;
              this.checkAll = false;
              this.toast(
                'success',
                'Saved',
                `Row ${row.rowNo} saved successfully`
              );
            },
            error: (e2) => {
              row.saving = false;
              const { message: m2 } = this.parseBackendError(e2);
              this.toast('error', 'Error', m2 || `Row ${row.rowNo} failed`);
            },
          });
          return;
        }

        row.saving = false;
        const { message } = this.parseBackendError(e);
        this.toast('error', 'Error', message || `Row ${row.rowNo} failed`);
      },
    });
  }

  // ---------------- DUP CHECK ----------------
  private validateDuplicateRouteIds() {
    const DUP_ERR = this.DUP_ROUTE_ERR;

    this.rows.forEach((r) => {
      r.errors = (r.errors ?? []).filter((e) => e !== DUP_ERR);
    });

    const map = new Map<number, BulkRow[]>();
    this.rows.forEach((r) => {
      const val = Number(r.deliveryRouteControl.value) || 0;
      if (!val) return;
      const arr = map.get(val) ?? [];
      arr.push(r);
      map.set(val, arr);
    });

    map.forEach((sameRows) => {
      if (sameRows.length > 1) {
        sameRows.forEach((r) => {
          r.errors = r.errors ?? [];
          if (!r.errors.includes(DUP_ERR)) r.errors.push(DUP_ERR);
          r.checked = false;
        });
      }
    });

    this.updateHasValidRow();
  }

  hasDuplicateRouteError(row: BulkRow): boolean {
    return (row.errors ?? []).includes(this.DUP_ROUTE_ERR);
  }

  removeRow(index: number) {
    this.rows.splice(index, 1);
    this.rows.forEach((r, i) => (r.rowNo = i + 1));

    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked);
    this.validateDuplicateRouteIds();
    this.updateHasValidRow();

    this.scheduleServerValidation();
  }

  get selectedValidCount(): number {
    return this.rows.filter((r) => r.checked && r.isValid).length;
  }

  get hasAnyDuplicateSelected(): boolean {
    return this.rows.some((r) => r.checked && this.hasDuplicateRouteError(r));
  }

  get canProceed(): boolean {
    return (
      this.selectedValidCount >= 2 &&
      !this.bulkSaving &&
      !this.hasAnyDuplicateSelected
    );
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  onRowSubBranchChange(row: BulkRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
    this.scheduleServerValidation();
  }

  onRowDescChange(row: BulkRow) {
    row.checked = false;
    this.updateHasValidRow();
  }

  onRowDateChange(row: BulkRow) {
    row.checked = false;

    // ❌ invalid date → STOP HERE
    if (!row.effectiveDateControl.valid) {
      this.updateHasValidRow();
      return;
    }

    this.updateHasValidRow();
    this.scheduleServerValidation();
  }

  onRowFlagChange(row: BulkRow) {
    row.checked = false;
    this.updateHasValidRow();
    this.scheduleServerValidation();
  }

  private localValidateTimer: any = null;

  private applyLocalValidationsSafe() {
    if (this.localValidateTimer) return;

    this.localValidateTimer = setTimeout(() => {
      this.localValidateTimer = null;
      this.applyLocalValidations();
    }, 100);
  }

  private formatYMD(dateIso: string | null | undefined): string | null {
    if (!dateIso) return null;
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }
}
