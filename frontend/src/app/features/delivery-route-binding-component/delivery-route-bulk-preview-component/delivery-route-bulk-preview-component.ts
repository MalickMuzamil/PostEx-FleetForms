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
import { trigger, transition, style, animate } from '@angular/animations';

interface BulkRow {
  rowNo: number;
  uid: number;

  branchId: number | null;
  subBranchId: number | null;
  correctDescId: number | null;
  correctDescText?: string;

  routeBranches: any[];
  subBranches: any[];

  deliveryRouteId: number | null;
  deliveryRouteControl: FormControl<number | null>;

  effectiveDate: Date | null;
  effectiveDateControl: FormControl<Date | null>;

  requiredReportsFlag: number;
  checked: boolean;
  saving?: boolean;
  errors?: string[];

  isValid?: boolean;

  rawDeliveryRoute?: string;
  rawBranch?: string;
  rawSubBranch?: string;
  rawCorrectDesc?: string;
  rawEffectiveDate?: string;
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
    RouterLink,
  ],
  templateUrl: './delivery-route-bulk-preview-component.html',
  styleUrl: './delivery-route-bulk-preview-component.css',
  animations: [
    trigger('rowAnim', [
      transition(':leave', [
        style({ opacity: 1, height: '*', transform: 'translateX(0)' }),
        animate(
          '180ms ease-in',
          style({ opacity: 0, height: 0, transform: 'translateX(12px)' }),
        ),
      ]),
    ]),
  ],
})
export class DeliveryRouteBulkPreviewComponent implements OnInit {
  file!: File;
  private uidCounter = 0;

  // ---------- ERROR MESSAGES ----------
  private readonly DUP_ROUTE_ERR = 'Duplicate Delivery Route ID found in file';
  private readonly ROUTE_NOT_EXIST = 'Delivery Route ID does not exist';
  private readonly BRANCH_MISMATCH = 'Branch does not belong to selected Route';
  private readonly INVALID_FLAG = 'RequiredReportsFlag must be 0 or 1';
  private readonly INVALID_NUM = 'Invalid numeric value';
  private readonly SUB_BRANCH_REQUIRED = 'Sub Branch is required';
  private readonly DESC_REQUIRED = 'Correct Description is required';
  private readonly DATE_REQUIRED = 'Effective Date is required';
  private readonly INVALID_DATE = 'Invalid Date';
  private readonly PAST_DATE_ERR = 'Effective Date must be a future date';

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

  // server validation scheduling (to avoid loops/spam)
  private serverValidateTimer: any = null;
  private serverValidateInFlight = false;

  // local validation timer
  private localValidateTimer: any = null;

  readonly REQUIRED_COLUMNS = [
    'BranchId',
    'SubBranchId',
    'DeliveryRouteID',
    'EffectiveDate',
    'RequiredReportsFlag',
    'CorrectDescription',
  ];

  // ✅ CACHES (no repeated calls)
  private branchesCache = new Map<number, any[]>();
  private subBranchesCache = new Map<string, any[]>();
  private branchesInFlight = new Set<number>();
  private subBranchesInFlight = new Set<string>();
  private descKeyToId = new Map<string, number>();

  constructor(
    private bindingService: DeliveryRouteBindingService,
    private definitionService: DeliveryRouteDefinitionService,
    private notification: NzNotificationService,
    private modal: NzModalService,
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
  trackByRow = (_: number, r: BulkRow) => r.uid;

  toast(type: 'success' | 'error' | 'warning', title: string, msg: string) {
    this.notification[type](title, msg);
  }

  // ---------------- CONFIRM MODAL ----------------
  private confirmOverwrite(
    message: string,
    existingDate?: string | null,
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
    conflict?: any;
    conflicts?: any[];
  } {
    const status = err?.status;
    const body = err?.error;

    const message =
      body?.message || body?.error?.message || err?.message || 'Request failed';

    const code = body?.code || body?.error?.code;

    const conflict = body?.conflict || body?.error?.conflict;
    const conflicts = body?.conflicts || body?.error?.conflicts;

    return { message, status, code, conflict, conflicts };
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
      this.SUB_BRANCH_REQUIRED,
      this.DESC_REQUIRED,
      this.DATE_REQUIRED,
      this.INVALID_DATE,
      this.PAST_DATE_ERR,
    ].forEach((m) => this.removeErr(row, m));
  }

  private normDesc(v: any): string {
    return (v ?? '')
      .toString()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
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
          resolve();
        },
      });
    });
  }

  private loadCorrectDescriptionsPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.definitionService.getAll().subscribe({
        next: (res: any) => {
          const rows = res?.data ?? res ?? [];

          this.correctDescriptions = (rows || [])
            .map((r: any) => {
              const text =
                r.CorrectionDescriptionforReports ??
                r.correctionDescriptionforReports ??
                r.routeDescription ??
                r.RouteDescription ??
                r.text ??
                '';

              return {
                id: Number(r.Id ?? r.id),
                text: String(text ?? '').trim(),
              };
            })
            .filter((x: any) => x.id && x.text);

          this.descKeyToId.clear();
          for (const d of this.correctDescriptions) {
            const key = this.normDesc(d.text);
            if (key) this.descKeyToId.set(key, Number(d.id));
          }

          this.resolveCorrectDescriptionsForRows();

          resolve();
        },
        error: () => {
          this.toast('error', 'Error', 'Failed to load report descriptions');
          resolve();
        },
      });
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
      transformHeader: (h: string) =>
        String(h ?? '')
          .replace(/^\uFEFF/, '')
          .trim(), // ✅ BOM remove + trim
      complete: (res: any) => {
        this.fileHeaders = (res.meta.fields || []).map((h: any) =>
          String(h ?? '').trim(),
        );

        this.handleHeaderValidation(res.data);
      },
    });
  }

  parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      const json: any[] = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false,
      });

      this.fileHeaders = Object.keys(json[0] || {}).map((h) =>
        String(h ?? '').trim(),
      );

      this.handleHeaderValidation(json);
    };
    reader.readAsBinaryString(file);
  }

  handleHeaderValidation(data: any[]) {
    const matched = this.REQUIRED_COLUMNS.filter((c) =>
      this.fileHeaders.some((h) => h.toLowerCase().includes(c.toLowerCase())),
    );

    if (matched.length < 2) {
      this.toast('error', 'Invalid File', 'This file is not related');
      this.isLoading = false;
      return;
    }

    this.autoMapColumns();
    this.mapRows(data);
  }

  private normHeader(h: any): string {
    return String(h ?? '')
      .replace(/^\uFEFF/, '') // BOM remove
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, ''); // spaces/underscores remove
  }

  autoMapColumns() {
    const headerMap = new Map<string, string>();

    for (const h of this.fileHeaders) {
      headerMap.set(this.normHeader(h), h);
    }

    const pick = (candidates: string[]) => {
      for (const c of candidates) {
        const found = headerMap.get(this.normHeader(c));
        if (found) return found;
      }
      return null;
    };

    this.columnMap['BranchId'] = pick(['BranchId', 'BranchID']);
    this.columnMap['SubBranchId'] = pick(['SubBranchId', 'SubBranchID']);
    this.columnMap['DeliveryRouteID'] = pick([
      'DeliveryRouteID',
      'DeliveryRouteId',
    ]);
    this.columnMap['EffectiveDate'] = pick(['EffectiveDate']);
    this.columnMap['RequiredReportsFlag'] = pick(['RequiredReportsFlag']);

    this.columnMap['CorrectDescription'] = pick([
      'CorrectDescription',
      'Correct Description',
      'CorrectDescriptionForReports',
      'CorrectDescriptionforReports',
      'CorrectionDescriptionforReports',
      'CorrectionDescriptionForReports',
    ]);
  }

  mapRows(data: any[]) {
    console.log('COLUMN MAP (INSIDE mapRows)=', this.columnMap);
    if (!this.uidCounter) this.uidCounter = Date.now();

    this.rows = data.map((r, i) => {
      const errors: string[] = [];
      const get = (k: string) => r?.[this.columnMap[k]];

      // ---------------- RAW (FILE) VALUES KEEP ----------------
      const rawRouteVal = get('DeliveryRouteID');
      const rawBranchVal = get('BranchId');
      const rawSubBranchVal = get('SubBranchId');
      const rawDescVal = get('CorrectDescription');
      const rawDateVal = get('EffectiveDate');

      const rawDeliveryRoute = String(rawRouteVal ?? '').trim();
      const rawBranch = String(rawBranchVal ?? '').trim();
      const rawSubBranch = String(rawSubBranchVal ?? '').trim();
      const rawCorrectDesc = String(rawDescVal ?? '').trim();
      const rawEffectiveDate = String(rawDateVal ?? '').trim();

      // ---------------- REQUIRED / PARSE ----------------
      const routeId = Number(rawRouteVal) || null;
      if (!routeId) errors.push('Delivery Route is required');

      const branchId = Number(rawBranchVal) || null;
      if (!branchId) errors.push('Branch is required');

      const subBranchId = Number(rawSubBranchVal) || null;
      if (!subBranchId) errors.push('Sub Branch is required');

      // ✅ Correct Description: FILE ME TEXT AATA HAI
      const descText = rawCorrectDesc;

      // ✅ abhi ID resolve karne ki koshish (agar map already ready ho)
      let correctDescId: number | null = null;
      if (descText) {
        correctDescId = this.descKeyToId.get(this.normDesc(descText)) ?? null;
        // ❌ yahan error add nahi karna (options later load ho sakti hain)
      } else {
        errors.push(this.DESC_REQUIRED);
      }

      // ---------------- DATE PARSE ----------------
      let date: Date | null = null;
      const rawDate = rawDateVal;

      if (rawDate != null && rawDate !== '') {
        if (typeof rawDate === 'number') {
          const d = new Date((rawDate - 25569) * 86400 * 1000);
          if (!isNaN(d.getTime())) date = d;
        } else {
          const s = String(rawDate).trim();
          const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
          if (m) {
            const dd = +m[1];
            const mm = +m[2];
            const yyyy = +m[3];
            const d = new Date(yyyy, mm - 1, dd);
            if (!isNaN(d.getTime())) date = d;
          } else {
            const d = new Date(s);
            if (!isNaN(d.getTime())) date = d;
          }
        }
      }

      if (!date) errors.push(this.INVALID_DATE);

      // ---------------- FLAG ----------------
      const rawFlag = get('RequiredReportsFlag');
      const flagNum = rawFlag === '' || rawFlag == null ? 1 : Number(rawFlag);
      const requiredReportsFlag = flagNum === 0 ? 0 : flagNum === 1 ? 1 : 1;
      if (!(flagNum === 0 || flagNum === 1)) errors.push(this.INVALID_FLAG);

      const row: BulkRow = {
        uid: ++this.uidCounter,
        rowNo: i + 1,

        // ✅ RAW values (file wali) — UI me niche show karne ke liye
        rawDeliveryRoute,
        rawBranch,
        rawSubBranch,
        rawCorrectDesc,
        rawEffectiveDate,

        branchId,
        subBranchId,

        correctDescId,
        correctDescText: descText,

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

      return row;
    });

    // ✅ IMPORTANT: ab descriptions resolve karo (options ready hon ya na hon)
    this.resolveCorrectDescriptionsForRows();

    this.validateDuplicateRouteIds();
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();

    this.loadingText = 'Loading branches & sub-branches (bulk)...';
    this.isLoading = true;

    this.loadBranchesForAllRowsBulk(() => {
      this.loadSubBranchesForAllRowsBulk(() => {
        this.isLoading = false;

        // ✅ after all async loads, resolve again (safe)
        this.resolveCorrectDescriptionsForRows();

        this.applyLocalValidationsSafe();
        this.updateHasValidRow();
        this.scheduleServerValidation();
      });
    });
  }

  // ---------------- BULK: ROUTES -> BRANCHES ----------------
  private loadBranchesForAllRowsBulk(done?: () => void) {
    const routeIds = Array.from(
      new Set(
        this.rows
          .map((r) => Number(r.deliveryRouteControl.value))
          .filter((x) => x > 0),
      ),
    );

    if (!routeIds.length) {
      done?.();
      return;
    }

    // if all already cached
    const missing = routeIds.filter((rid) => !this.branchesCache.has(rid));
    if (!missing.length) {
      for (const row of this.rows) this.applyBranchesToRow(row);
      done?.();
      return;
    }

    this.bindingService.getBranchesByRoutes(missing).subscribe({
      next: (res: any) => {
        const map = res?.data ?? {};
        for (const ridStr of Object.keys(map)) {
          const rid = Number(ridStr);
          const list = map[rid] ?? [];
          const normalized = (list || []).map((b: any) => ({
            value: Number(b.BranchID ?? b.BranchId),
            label: String(b.BranchName ?? b.name ?? b.BranchID ?? '').trim(),
            ...b,
          }));
          this.branchesCache.set(rid, normalized);
        }

        for (const row of this.rows) this.applyBranchesToRow(row);
        done?.();
      },
      error: () => {
        this.toast('error', 'Error', 'Failed to load branches (bulk)');
        done?.();
      },
    });
  }

  private applyBranchesToRow(row: BulkRow) {
    const rid = Number(row.deliveryRouteControl.value) || 0;
    row.routeBranches = this.branchesCache.get(rid) ?? [];
  }

  // ---------------- BULK: (ROUTE, BRANCH) -> SUBBRANCHES ----------------
  private loadSubBranchesForAllRowsBulk(done?: () => void) {
    const pairKeys = Array.from(
      new Set(
        this.rows
          .map((r) => {
            const routeId = Number(r.deliveryRouteControl.value) || 0;
            const branchId = Number(r.branchId) || 0;
            return routeId > 0 && branchId > 0
              ? `${routeId}|${branchId}`
              : null;
          })
          .filter(Boolean) as string[],
      ),
    );

    if (!pairKeys.length) {
      done?.();
      return;
    }

    const missingKeys = pairKeys.filter((k) => !this.subBranchesCache.has(k));
    if (!missingKeys.length) {
      for (const row of this.rows) this.applySubBranchesToRow(row);
      done?.();
      return;
    }

    const pairs = missingKeys.map((k) => {
      const [routeId, branchId] = k.split('|').map(Number);
      return { routeId, branchId };
    });

    this.bindingService.getSubBranchesByRoutesAndBranches(pairs).subscribe({
      next: (res: any) => {
        const map = res?.data ?? {};
        for (const k of Object.keys(map)) {
          const list = map[k] ?? [];
          const normalized = (list || []).map((sb: any) => ({
            value: Number(sb.SubBranchID ?? sb.Sub_Branch_ID ?? sb.subBranchId),
            label:
              sb.SubBranchName ??
              sb.Sub_Branch_Name ??
              sb.name ??
              String(sb.SubBranchID ?? sb.Sub_Branch_ID ?? ''),
            ...sb,
          }));
          this.subBranchesCache.set(k, normalized);
        }

        for (const row of this.rows) this.applySubBranchesToRow(row);
        done?.();
      },
      error: () => {
        this.toast('error', 'Error', 'Failed to load sub branches (bulk)');
        done?.();
      },
    });
  }

  private applySubBranchesToRow(row: BulkRow) {
    const routeId = Number(row.deliveryRouteControl.value) || 0;
    const branchId = Number(row.branchId) || 0;
    const key = `${routeId}|${branchId}`;

    const selected = row.subBranchId;
    row.subBranches = this.subBranchesCache.get(key) ?? [];

    // preserve selection if exists
    if (selected != null) {
      const exists = row.subBranches.some(
        (x: any) => Number(x.value) === Number(selected),
      );
      row.subBranchId = exists ? selected : null;
    }
  }

  private resolveCorrectDescriptionsForRows() {
    if (!this.rows?.length) return;

    for (const row of this.rows) {
      const text = String(row.correctDescText ?? '').trim();

      // if empty -> required
      if (!text) {
        this.addErr(row, this.DESC_REQUIRED);
        row.correctDescId = null;
        continue;
      }

      // try resolve
      const id = this.descKeyToId.get(this.normDesc(text)) ?? null;

      if (id) {
        row.correctDescId = id;
        // ✅ remove both possible errors
        this.removeErr(row, this.DESC_REQUIRED);
        this.removeErr(row, `Correct Description not found: ${text}`);
      } else {
        // text exists but not found in master
        this.addErr(row, `Correct Description not found: ${text}`);
        // do not force DESC_REQUIRED here (different error)
        this.removeErr(row, this.DESC_REQUIRED);
        row.correctDescId = null;
      }
    }
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const row of this.rows) {
      this.clearManagedErrors(row);

      const routeId = Number(row.deliveryRouteControl.value) || 0;
      const branchId = Number(row.branchId) || 0;
      const subBranchId = Number(row.subBranchId) || 0;

      // ---------- DEBUG: Description mapping ----------
      const rawTxt = String(row.correctDescText ?? '');
      const trimmedTxt = rawTxt.trim();
      const normTxt = this.normDesc(trimmedTxt);
      const mappedId = this.descKeyToId.get(normTxt) ?? null;

      // numeric checks
      if (
        (row.deliveryRouteControl.value != null && !routeId) ||
        (row.branchId != null && !branchId) ||
        (row.subBranchId != null && !subBranchId)
      ) {
        this.addErr(row, this.INVALID_NUM);
        row.checked = false;
      }

      // required fields
      if (!row.subBranchId) {
        this.addErr(row, this.SUB_BRANCH_REQUIRED);
        row.checked = false;
      }

      if (!row.correctDescId) {
        const txt = trimmedTxt;

        if (!txt) {
          this.addErr(row, this.DESC_REQUIRED);
        } else {
          const resolved = this.descKeyToId.get(this.normDesc(txt)) ?? null;

          if (resolved) {
            row.correctDescId = resolved;
            this.removeErr(row, this.DESC_REQUIRED);
            this.removeErr(row, `Correct Description not found: ${txt}`);
          } else {
            this.addErr(row, `Correct Description not found: ${txt}`);
            this.removeErr(row, this.DESC_REQUIRED);
          }
        }

        row.checked = false;
      } else {
        // if ID exists, make sure not-found/required errors are removed
        const txt = trimmedTxt;
        this.removeErr(row, this.DESC_REQUIRED);
        if (txt) this.removeErr(row, `Correct Description not found: ${txt}`);
      }

      // ---------- DATE ----------
      const dt = row.effectiveDateControl?.value;
      if (!dt) {
        this.addErr(row, this.DATE_REQUIRED);
        row.checked = false;
      } else {
        const selected = new Date(dt);
        selected.setHours(0, 0, 0, 0);

        if (!row.effectiveDateControl.valid || selected <= today) {
          this.addErr(row, this.PAST_DATE_ERR);
          row.checked = false;
        }
      }

      if (!routeId) continue;

      const route = routeMap.get(routeId);
      if (!route) {
        this.addErr(row, this.ROUTE_NOT_EXIST);
        row.checked = false;
        continue;
      }

      const expectedBranch = Number(route.BranchID) || null;
      if (expectedBranch && row.branchId !== expectedBranch) {
        if (row.branchId != null && Number(row.branchId) !== expectedBranch) {
          this.addErr(row, this.BRANCH_MISMATCH);
        }
        row.branchId = expectedBranch;

        // ✅ now that branch changed, attach correct sub-branches from cache if available
        this.loadPairSubBranches(routeId, expectedBranch, row);
      }

      row.deliveryRouteId = routeId;
    }

    this.validateDuplicateRouteIds();
    this.updateHasValidRow();
  }

  private applyLocalValidationsSafe() {
    if (this.localValidateTimer) return;

    this.localValidateTimer = setTimeout(() => {
      this.localValidateTimer = null;
      this.applyLocalValidations();
    }, 100);
  }

  // ---------------- SERVER VALIDATION (OPTIONAL) ----------------
  private scheduleServerValidation() {
    if (!this.rows.length) return;
    if (!this.rows.some((r) => r.isValid)) return;
    if (this.serverValidateInFlight) return;
    if (this.serverValidateTimer) return;

    this.serverValidateTimer = setTimeout(() => {
      this.serverValidateTimer = null;
      this.applyServerValidation();
    }, 400);
  }

  private applyServerValidation() {
    if (this.serverValidateInFlight) return;

    const hasFn = (this.bindingService as any).validateBulk instanceof Function;
    if (!hasFn) return;

    // need desc text because backend validation checks it
    const descMap = new Map<number, string>();
    for (const d of this.correctDescriptions) {
      descMap.set(Number(d.id), String(d.text || '').trim());
    }

    const payloads = this.rows
      .filter((r) => r.isValid)
      .map((r) => {
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
        };
      })
      .filter(
        (p) =>
          p.branchId && p.subBranchId && p.deliveryRouteId && p.effectiveDate,
      );

    if (!payloads.length) return;

    this.serverValidateInFlight = true;

    (this.bindingService as any).validateBulk(payloads).subscribe({
      next: (res: any) => {
        const invalidRows = res?.data?.invalidRows ?? [];

        // map by (branch|sub|route|date) to avoid wrong matches
        const rowMap = new Map<string, BulkRow>();
        for (const r of this.rows) {
          const k = `${Number(r.branchId) || 0}|${Number(r.subBranchId) || 0}|${
            Number(r.deliveryRouteControl.value) || 0
          }|${r.effectiveDateControl.value?.toISOString().split('T')[0] || ''}`;
          rowMap.set(k, r);
        }

        for (const inv of invalidRows) {
          const k = `${Number(inv.branchId) || 0}|${
            Number(inv.subBranchId) || 0
          }|${Number(inv.deliveryRouteId) || 0}|${String(
            inv.effectiveDate || '',
          )}`;
          const match = rowMap.get(k);
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

  // ---------------- DEPENDENT DROPDOWNS (OPTIMIZED) ----------------
  onRowRouteChange(row: BulkRow) {
    const routeId = Number(row.deliveryRouteControl.value) || null;

    // Keep old for compare (optional)
    const oldRouteId = Number(row.deliveryRouteId) || null;
    row.deliveryRouteId = routeId;

    row.subBranchId = null;
    // ❌ DO NOT CLEAR correctDescId (this was killing file-mapped description)
    // row.correctDescId = null;

    row.subBranches = [];
    row.routeBranches = [];
    row.checked = false;

    this.applyLocalValidationsSafe();
    this.updateHasValidRow();

    if (!routeId) {
      row.branchId = null;
      return;
    }

    // ✅ branches (same)
    if (this.branchesCache.has(routeId)) {
      this.applyBranchesToRow(row);
    } else if (!this.branchesInFlight.has(routeId)) {
      this.branchesInFlight.add(routeId);
      this.bindingService.getBranchesByRoutes([routeId]).subscribe({
        next: (res: any) => {
          const map = res?.data ?? {};
          const list = map[routeId] ?? [];
          const normalized = (list || []).map((b: any) => ({
            value: Number(b.BranchID ?? b.BranchId),
            label: String(b.BranchName ?? b.name ?? b.BranchID ?? '').trim(),
            ...b,
          }));
          this.branchesCache.set(routeId, normalized);
          this.branchesInFlight.delete(routeId);
          this.applyBranchesToRow(row);
        },
        error: () => {
          this.branchesInFlight.delete(routeId);
          this.toast('error', 'Error', 'Failed to load branches (bulk single)');
        },
      });
    }

    // ✅ auto branch (same)
    const route = this.deliveryRoutes.find(
      (r: any) => Number(r.DeliveryRouteID) === Number(routeId),
    );
    const expectedBranchId = Number(route?.BranchID) || null;

    if (expectedBranchId) {
      row.branchId = expectedBranchId;
      this.loadPairSubBranches(routeId, expectedBranchId, row);
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

    this.applyLocalValidationsSafe();
    this.updateHasValidRow();

    if (!branchId || !routeId) return;

    this.loadPairSubBranches(routeId, branchId, row);
    this.scheduleServerValidation();
  }

  private loadPairSubBranches(routeId: number, branchId: number, row: BulkRow) {
    const key = `${routeId}|${branchId}`;

    // cache hit
    if (this.subBranchesCache.has(key)) {
      this.applySubBranchesToRow(row);
      this.applyLocalValidationsSafe();
      this.updateHasValidRow();
      return;
    }

    // prevent duplicate fetch
    if (this.subBranchesInFlight.has(key)) return;
    this.subBranchesInFlight.add(key);

    this.bindingService
      .getSubBranchesByRoutesAndBranches([{ routeId, branchId }])
      .subscribe({
        next: (res: any) => {
          const map = res?.data ?? {};
          const list = map[key] ?? [];
          const normalized = (list || []).map((sb: any) => ({
            value: Number(sb.SubBranchID ?? sb.Sub_Branch_ID ?? sb.subBranchId),
            label:
              sb.SubBranchName ??
              sb.Sub_Branch_Name ??
              sb.name ??
              String(sb.SubBranchID ?? sb.Sub_Branch_ID ?? ''),
            ...sb,
          }));
          this.subBranchesCache.set(key, normalized);
          this.subBranchesInFlight.delete(key);

          this.applySubBranchesToRow(row);
          this.applyLocalValidationsSafe();
          this.updateHasValidRow();
        },
        error: () => {
          this.subBranchesInFlight.delete(key);
          this.toast(
            'error',
            'Error',
            'Failed to load sub branches (bulk single)',
          );
        },
      });
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
      if (!r.isValid) r.checked = false;
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
      };
    });

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
      this.toast('success', 'Success', `Bulk saved (${selected.length})`);
      this.removeRowsRef(selected);
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
      (d: any) => Number(d.id) === Number(row.correctDescId),
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
      force: false,
    };

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
        this.removeRowRef(row);
      },
      error: async (e) => {
        if (this.isConfirmOverwriteError(e)) {
          const { message, conflict } = this.parseBackendError(e);
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
                `Row ${row.rowNo} saved successfully`,
              );
              this.removeRowRef(row);
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

    // this.updateHasValidRow();
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
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
    this.scheduleServerValidation();
  }

  onRowDateChange(row: BulkRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();

    if (!row.effectiveDateControl.valid) {
      this.updateHasValidRow();
      return;
    }

    this.updateHasValidRow();
    this.scheduleServerValidation();
  }

  onRowFlagChange(row: BulkRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
    this.scheduleServerValidation();
  }

  private removeRowRef(row: BulkRow) {
    const idx = this.rows.indexOf(row);
    if (idx === -1) return;

    this.rows.splice(idx, 1);

    this.checkAll =
      this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);

    this.validateDuplicateRouteIds();
    this.updateHasValidRow();
  }

  private removeRowsRef(rowsToRemove: BulkRow[]) {
    const set = new Set(rowsToRemove);
    this.rows = this.rows.filter((r) => !set.has(r));

    this.checkAll =
      this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);

    this.validateDuplicateRouteIds();
    this.updateHasValidRow();
  }

  isInvalidBranch(row: any): boolean {
    if (
      !row?.deliveryRouteControl?.value ||
      !row?.branchId ||
      !row?.routeBranches
    ) {
      return false;
    }

    return !row.routeBranches.some((b:any) => b.value === row.branchId);
  }
}
