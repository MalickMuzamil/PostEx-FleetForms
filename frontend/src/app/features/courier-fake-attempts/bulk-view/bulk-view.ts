import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { RouterLink } from '@angular/router';
import { CourierFakeAttemptsService } from '../../../core/services/courier-fake-attempts-service';

interface BulkFakeAttemptsRow {
  rowNo: number;
  uid: number;

  cnNo: string | null;
  branchName: string | null;

  attempts: number | null;
  courierId: string | null;
  rider: string | null;

  fakeAttempts: number | null;

  date: Date | null;
  dateControl: FormControl<Date | null>;

  isArchived: number; // 0/1

  createdBy: string; // Admin/User (readonly)

  checked: boolean;
  saving?: boolean;
  errors?: string[];
  isValid?: boolean;

  rawCnNo?: string;
  rawBranchName?: string;
  rawAttempts?: string;
  rawCourierId?: string;
  rawRider?: string;
  rawFakeAttempts?: string;
  rawDate?: string;
  rawIsArchived?: string;
}

@Component({
  selector: 'app-bulk-view',
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
  templateUrl: './bulk-view.html',
  styleUrl: './bulk-view.css',
})
export class BulkView {
  file!: File;
  private uidCounter = 0;

  // ---------- errors ----------
  private readonly CN_REQUIRED = 'CNNo is required';

  private readonly BR_REQUIRED = 'BranchName is required';

  private readonly ATT_REQUIRED = 'Attempts is required';
  private readonly ATT_INVALID = 'Attempts: Invalid number';

  private readonly COURIER_REQUIRED = 'CourierID is required';

  private readonly RIDER_REQUIRED = 'Rider is required';

  private readonly FAKE_REQUIRED = 'Fake_Attempts is required';
  private readonly FAKE_INVALID = 'Fake_Attempts: Invalid number';

  private readonly DATE_REQUIRED = 'Date is required';
  private readonly INVALID_DATE = 'Invalid Date';

  private readonly ARCH_REQUIRED = 'IsArchived is required';
  private readonly INVALID_ARCH = 'IsArchived must be 0 or 1';

  // required columns (strict)
  readonly REQUIRED_COLUMNS = ['CNNo', 'BranchName', 'Attempts', 'CourierID', 'Rider', 'Fake_Attempts', 'Date', 'IsArchived'];

  rows: BulkFakeAttemptsRow[] = [];
  checkAll = false;
  bulkSaving = false;
  hasValidRow = false;

  fileHeaders: string[] = [];
  columnMap: any = {};

  isLoading = true;
  loadingText = 'Reading file & validating...';

  private localValidateTimer: any = null;
  private readonly MAX_LEN = 20;
  private readonly TOO_LONG = (label: string) => `${label}: Max ${this.MAX_LEN} characters allowed`;

  constructor(
    private fakeService: CourierFakeAttemptsService,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) { }

  async ngOnInit(): Promise<void> {
    const state = history.state;
    this.file = state?.file;

    if (!this.file) {
      this.toast('error', 'No File', 'No file received');
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.loadingText = 'Reading file & validating...';
    this.parseFile(this.file);
  }

  trackByRow = (_: number, r: BulkFakeAttemptsRow) => r.uid;

  toast(type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) {
    (this.notification as any)[type](title, msg, { nzDuration: 5000 });
  }

  hasErr(row: BulkFakeAttemptsRow, msg: string): boolean {
    return (row.errors ?? []).includes(msg);
  }

  // ---------------- FILE PARSING ----------------
  parseFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') this.parseCSV(file);
    else if (ext === 'xls' || ext === 'xlsx') this.parseExcel(file);
    else {
      this.toast('error', 'Invalid File', 'Unsupported file format (only CSV/XLS/XLSX)');
      this.isLoading = false;
    }
  }

  parseCSV(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => String(h ?? '').replace(/^\uFEFF/, '').trim(),
      complete: (res: any) => {
        this.fileHeaders = (res?.meta?.fields || []).map((h: any) => String(h ?? '').trim());

        if (!this.fileHeaders.length) {
          this.toast('error', 'Invalid File', 'CSV has no header row.');
          this.isLoading = false;
          return;
        }

        this.handleHeaderValidation(res.data || []);
      },
      error: () => {
        this.toast('error', 'Invalid File', 'Unable to read CSV file.');
        this.isLoading = false;
      },
    });
  }

  parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames?.[0];
        const sheet = wb.Sheets?.[sheetName];

        if (!sheetName || !sheet) {
          this.toast('error', 'Invalid File', 'Excel file has no sheet.');
          this.isLoading = false;
          return;
        }

        const rowsHeader: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

        if (!rowsHeader?.length || !rowsHeader[0]?.length) {
          this.toast('error', 'Invalid File', 'Excel file is empty or missing header row.');
          this.isLoading = false;
          return;
        }

        this.fileHeaders = (rowsHeader[0] as any[])
          .map((h) => String(h ?? '').trim())
          .filter(Boolean);

        if (!this.fileHeaders.length) {
          this.toast('error', 'Invalid File', 'Excel header row is empty.');
          this.isLoading = false;
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        this.handleHeaderValidation(json || []);
      } catch {
        this.toast('error', 'Invalid File', 'Unable to read Excel file.');
        this.isLoading = false;
      }
    };

    reader.onerror = () => {
      this.toast('error', 'Invalid File', 'Unable to read file.');
      this.isLoading = false;
    };

    reader.readAsBinaryString(file);
  }

  // ---------------- HEADER VALIDATION & MAPPING ----------------
  private normHeader(h: any): string {
    return String(h ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  private handleHeaderValidation(data: any[]) {
    const headerSet = new Set(this.fileHeaders.map((h) => this.normHeader(h)));
    const required = this.REQUIRED_COLUMNS.map((c) => this.normHeader(c));
    const missing = required.filter((c) => !headerSet.has(c));

    if (missing.length) {
      this.toast('error', 'Invalid File', `Missing required columns: ${missing.join(', ')}`);
      this.isLoading = false;
      return;
    }

    this.autoMapColumns();
    this.mapRows(data);

    this.isLoading = false;
  }

  private autoMapColumns() {
    const headerMap = new Map<string, string>();
    for (const h of this.fileHeaders) headerMap.set(this.normHeader(h), h);

    const pick = (candidates: string[]) => {
      for (const c of candidates) {
        const found = headerMap.get(this.normHeader(c));
        if (found) return found;
      }
      return null;
    };

    // required
    this.columnMap['CNNo'] = pick(['CNNo', 'CNNO']);
    this.columnMap['BranchName'] = pick(['BranchName', 'BRANCHNAME']);
    this.columnMap['Attempts'] = pick(['Attempts', 'ATTEMPTS']);
    this.columnMap['CourierID'] = pick(['CourierID', 'COURIERID']);
    this.columnMap['Rider'] = pick(['Rider', 'RIDER']);
    this.columnMap['Fake_Attempts'] = pick(['Fake_Attempts', 'FAKE_ATTEMPTS', 'FAKEATTEMPTS']);
    this.columnMap['Date'] = pick(['Date', 'DATE']);
    this.columnMap['IsArchived'] = pick(['IsArchived', 'ISARCHIVED', 'Is_Archived']);
  }

  // ---------------- ROW MAPPING ----------------
  private mapRows(data: any[]) {
    if (!this.uidCounter) this.uidCounter = Date.now();

    const getVal = (rowObj: any, key: string) => rowObj?.[this.columnMap[key]];
    const createdBy = this.getCreatedBy();

    this.rows = (data || []).map((r, i) => {
      const errors: string[] = [];

      const rawCnNo = String(getVal(r, 'CNNo') ?? '').trim();
      const rawBranchName = String(getVal(r, 'BranchName') ?? '').trim();
      const rawAttempts = String(getVal(r, 'Attempts') ?? '').trim();
      const rawCourierId = String(getVal(r, 'CourierID') ?? '').trim();
      const rawRider = String(getVal(r, 'Rider') ?? '').trim();
      const rawFakeAttempts = String(getVal(r, 'Fake_Attempts') ?? '').trim();
      const rawDate = String(getVal(r, 'Date') ?? '').trim();
      const rawIsArchived = String(getVal(r, 'IsArchived') ?? '').trim();

      // CNNo
      const cnNo = rawCnNo || null;
      if (!cnNo) errors.push(this.CN_REQUIRED);

      // BranchName
      const branchName = rawBranchName || null;
      if (!branchName) errors.push(this.BR_REQUIRED);

      // 🔥 Attempts (digits only)
      let attempts: number | null = null;
      if (rawAttempts === '') {
        errors.push(this.ATT_REQUIRED);
      } else if (!/^\d+$/.test(rawAttempts)) {
        errors.push('Attempts must be digits only');
      } else {
        attempts = Number(rawAttempts);
      }

      // CourierID
      const courierId = rawCourierId || null;
      if (!courierId) errors.push(this.COURIER_REQUIRED);

      // Rider
      const rider = rawRider || null;
      if (!rider) errors.push(this.RIDER_REQUIRED);

      // 🔥 Fake_Attempts (digits only)
      let fakeAttempts: number | null = null;
      if (rawFakeAttempts === '') {
        errors.push(this.FAKE_REQUIRED);
      } else if (!/^\d+$/.test(rawFakeAttempts)) {
        errors.push('Fake_Attempts must be digits only');
      } else {
        fakeAttempts = Number(rawFakeAttempts);
      }

      // Date
      const date = this.parseAnyDate(rawDate);
      if (!rawDate) errors.push(this.DATE_REQUIRED);
      else if (!date) errors.push(this.INVALID_DATE);

      // IsArchived
      let isArchivedNum: number | null = null;
      if (rawIsArchived === '') errors.push(this.ARCH_REQUIRED);
      else {
        const n = Number(rawIsArchived);
        if (n === 0 || n === 1) isArchivedNum = n;
        else errors.push(this.INVALID_ARCH);
      }

      // Max length
      const checkMax = (val: string, label: string) => {
        if (val && val.length > this.MAX_LEN) errors.push(this.TOO_LONG(label));
      };
      checkMax(rawCnNo, 'CNNo');
      checkMax(rawBranchName, 'BranchName');
      checkMax(rawCourierId, 'CourierID');
      checkMax(rawRider, 'Rider');

      return {
        uid: ++this.uidCounter,
        rowNo: i + 1,

        rawCnNo,
        rawBranchName,
        rawAttempts,
        rawCourierId,
        rawRider,
        rawFakeAttempts,
        rawDate,
        rawIsArchived,

        cnNo,
        branchName,
        attempts,
        courierId,
        rider,
        fakeAttempts,

        date,
        dateControl: new FormControl<Date | null>(date),

        isArchived: isArchivedNum ?? 0,
        createdBy,

        checked: false,
        errors,
        isValid: false,
      };
    });

    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
    this.checkDuplicateInFile();
  }

  // ---------------- ERROR HELPERS ----------------
  private addErr(row: BulkFakeAttemptsRow, msg: string) {
    row.errors = row.errors ?? [];
    if (!row.errors.includes(msg)) row.errors.push(msg);
  }

  private removeErr(row: BulkFakeAttemptsRow, msg: string) {
    row.errors = (row.errors ?? []).filter((e) => e !== msg);
  }

  private clearManagedErrors(row: BulkFakeAttemptsRow) {
    [
      this.CN_REQUIRED,
      this.BR_REQUIRED,
      this.ATT_REQUIRED,
      this.ATT_INVALID,
      this.COURIER_REQUIRED,
      this.RIDER_REQUIRED,
      this.FAKE_REQUIRED,
      this.FAKE_INVALID,
      this.DATE_REQUIRED,
      this.INVALID_DATE,
      this.ARCH_REQUIRED,
      this.INVALID_ARCH,
    ].forEach((m) => this.removeErr(row, m));

    row.errors = (row.errors ?? []).filter((e) => !/Max 20 characters allowed/i.test(e));
    row.errors = (row.errors ?? []).filter((e) => !e.startsWith('Duplicate with row'));
    this.removeErr(row, 'Attempts must be digits only');
    this.removeErr(row, 'Fake_Attempts must be digits only');
  }

  // ---------------- VALIDATIONS ----------------
  private applyLocalValidations() {
    for (const row of this.rows) {
      this.clearManagedErrors(row);

      const cn = String(row.cnNo ?? '').trim();
      if (!cn) this.addErr(row, this.CN_REQUIRED);

      const br = String(row.branchName ?? '').trim();
      if (!br) this.addErr(row, this.BR_REQUIRED);

      // 🔥 Attempts strict
      const attRaw = String(row.rawAttempts ?? '').trim();
      if (!attRaw) this.addErr(row, this.ATT_REQUIRED);
      else if (!/^\d+$/.test(attRaw)) this.addErr(row, 'Attempts must be digits only');

      const cId = String(row.courierId ?? '').trim();
      if (!cId) this.addErr(row, this.COURIER_REQUIRED);

      const rid = String(row.rider ?? '').trim();
      if (!rid) this.addErr(row, this.RIDER_REQUIRED);

      // 🔥 Fake_Attempts strict
      const fakeRaw = String(row.rawFakeAttempts ?? '').trim();
      if (!fakeRaw) this.addErr(row, this.FAKE_REQUIRED);
      else if (!/^\d+$/.test(fakeRaw)) this.addErr(row, 'Fake_Attempts must be digits only');

      const dt = row.dateControl?.value;
      if (!dt) {
        if (!String(row.rawDate ?? '').trim()) this.addErr(row, this.DATE_REQUIRED);
        else this.addErr(row, this.INVALID_DATE);
      }

      const arch = Number(row.isArchived);
      if (!(arch === 0 || arch === 1)) this.addErr(row, this.INVALID_ARCH);

      this.validateMaxLen(row, row.cnNo, 'CNNo');
      this.validateMaxLen(row, row.branchName, 'BranchName');
      this.validateMaxLen(row, row.courierId, 'CourierID');
      this.validateMaxLen(row, row.rider, 'Rider');
    }

    this.updateHasValidRow();
    this.checkDuplicateInFile();
    this.enforceSelectionRules();
  }

  private applyLocalValidationsSafe() {
    if (this.localValidateTimer) return;
    this.localValidateTimer = setTimeout(() => {
      this.localValidateTimer = null;
      this.applyLocalValidations();
    }, 80);
  }

  isRowValid(row: BulkFakeAttemptsRow): boolean {
    return (row.errors?.length ?? 0) === 0 &&
      !!String(row.cnNo ?? '').trim() &&
      !!String(row.branchName ?? '').trim() &&
      row.attempts !== null &&
      !!String(row.courierId ?? '').trim() &&
      !!String(row.rider ?? '').trim() &&
      row.fakeAttempts !== null &&
      !!row.dateControl?.value &&
      (Number(row.isArchived) === 0 || Number(row.isArchived) === 1);
  }

  updateHasValidRow() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);

      if (!r.isValid || this.hasErrLike(r, 'Duplicate with row')) {
        r.checked = false;
      }
    }

    this.hasValidRow = this.rows.some((r) => r.isValid === true);

    const validRows = this.rows.filter(r => r.isValid && !this.hasErrLike(r, 'Duplicate with row'));
    this.checkAll = validRows.length > 0 && validRows.every(r => r.checked);
  }

  // ---------------- UI EVENTS ----------------
  onToggleAll(checked: boolean) {
    this.checkAll = checked;
    this.rows.forEach((r) => (r.checked = checked ? !!r.isValid : false));
    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  onRowToggle(row: BulkFakeAttemptsRow, checked: boolean) {
    const canSelect = !!row.isValid && !this.hasErrLike(row, 'Duplicate with row');
    row.checked = checked && canSelect;

    this.enforceSelectionRules();
  }

  onRowDateChange(row: BulkFakeAttemptsRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowArchivedChange(row: BulkFakeAttemptsRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowTextChange(row: BulkFakeAttemptsRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  // ---------------- BULK PROCEED ----------------
  get selectedValidCount(): number {
    return this.rows.filter((r) => r.checked && r.isValid).length;
  }

  get canProceed(): boolean {
    return this.selectedValidCount >= 1 && !this.bulkSaving && !this.isLoading;
  }

  async proceedBulkImport() {
    const selected = this.rows.filter((r) => r.checked && r.isValid);
    if (!selected.length) return;

    this.bulkSaving = true;

    const payloads = selected
      .map((r) => ({
        CNNo: String(r.cnNo || '').trim(),
        BranchName: String(r.branchName || '').trim(),
        Attempts: Number(r.attempts),
        CourierID: String(r.courierId || '').trim(),
        Rider: String(r.rider || '').trim(),
        Fake_Attempts: Number(r.fakeAttempts),
        Date: r.dateControl.value ? this.toYMD(r.dateControl.value) : null,
        IsArchived: Number(r.isArchived),
        CreatedBy: String(r.createdBy || '').trim(), // Admin/User (frontend)
      }))
      .filter((p) => p.CNNo && p.Date);

    try {
      const chunks = this.chunk(payloads, 200);

      let totalInserted = 0;
      let totalUpdated = 0;
      let serverMessage = '';

      for (const ch of chunks) {
        const res: any = await new Promise((resolve, reject) => {
          this.fakeService.importBulk(ch).subscribe({
            next: (response) => resolve(response),
            error: (e) => reject(e),
          });
        });

        if (res?.data) {
          totalInserted += Number(res.data.inserted || 0);
          totalUpdated += Number(res.data.updated || 0);
        }

        if (res?.message) {
          serverMessage = res.message;
        }
      }

      // ✅ show backend message
      this.toast(
        'success',
        'Success',
        serverMessage || `Inserted: ${totalInserted}, Updated: ${totalUpdated}`
      );

      this.removeRowsRef(selected);
    } catch (e: any) {
      this.toast('error', 'Error', e?.error?.message || e?.message || 'Bulk import failed');
    } finally {
      this.bulkSaving = false;
    }
  }

  // ---------------- HELPERS ----------------
  private removeRowsRef(rowsToRemove: BulkFakeAttemptsRow[]) {
    const set = new Set(rowsToRemove);
    this.rows = this.rows.filter((r) => !set.has(r));
    this.rows.forEach((r, i) => (r.rowNo = i + 1));

    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
    this.updateHasValidRow();
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private toYMD(d: Date): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseAnyDate(raw: string): Date | null {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const y = +iso[1];
      const mo = +iso[2];
      const da = +iso[3];
      const d = new Date(y, mo - 1, da);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  private toNumberOrNull(v: any): number | null {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private validateMaxLen(row: BulkFakeAttemptsRow, value: any, label: string) {
    const msg = this.TOO_LONG(label);
    const s = String(value ?? '').trim();
    if (s && s.length > this.MAX_LEN) this.addErr(row, msg);
    else this.removeErr(row, msg);
  }

  private checkDuplicateInFile() {
    const map = new Map<string, BulkFakeAttemptsRow[]>();

    for (const row of this.rows) {
      const cn = String(row.cnNo ?? '').trim();
      const courier = String(row.courierId ?? '').trim();
      const dt = row.dateControl?.value ? this.toYMD(row.dateControl.value) : '';

      if (!cn || !courier || !dt) continue;

      // ✅ NEW KEY: CNNo + CourierID + Date
      const key = `${cn}|${courier}|${dt}`;

      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }

    // clear old duplicate errors
    for (const row of this.rows) {
      row.errors = (row.errors ?? []).filter((e) => !e.startsWith('Duplicate with row'));
    }

    // apply new duplicates
    map.forEach((rows) => {
      if (rows.length > 1) {
        const rowNos = rows.map((r) => r.rowNo).join(', ');
        rows.forEach((r) => {
          this.addErr(r, `Duplicate with row(s): ${rowNos}`);
          r.checked = false;
        });
      }
    });

    this.enforceSelectionRules();
  }

  hasErrLike(row: BulkFakeAttemptsRow, prefix: string): boolean {
    return (row.errors ?? []).some((e) => String(e).startsWith(prefix));
  }

  getErrLike(row: BulkFakeAttemptsRow, prefix: string): string | null {
    return (row.errors ?? []).find((e) => String(e).startsWith(prefix)) ?? null;
  }

  private getCreatedBy(): string {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;

        try {
          const obj = JSON.parse(raw);
          const roles: string[] = obj?.roles ?? [];
          if (Array.isArray(roles) && roles.includes('postex-auth-admin')) return 'Admin';
        } catch { }
      }
    } catch { }

    return 'User';
  }

  private enforceSelectionRules() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);

      if (!r.isValid || this.hasErrLike(r, 'Duplicate with row')) {
        r.checked = false;
      }
    }

    const validRows = this.rows.filter(r => r.isValid && !this.hasErrLike(r, 'Duplicate with row'));
    this.checkAll = validRows.length > 0 && validRows.every(r => r.checked);
  }

  onAttemptsInput(row: BulkFakeAttemptsRow, v: any) {
    const s = String(v ?? '');
    const cleaned = s.replace(/\D+/g, ''); // digits only
    row.attempts = cleaned === '' ? null : Number(cleaned);
    row.rawAttempts = s;
    this.onRowTextChange(row);
  }

  onFakeAttemptsInput(row: BulkFakeAttemptsRow, v: any) {
    const s = String(v ?? '');
    const cleaned = s.replace(/\D+/g, '');
    row.fakeAttempts = cleaned === '' ? null : Number(cleaned);
    row.rawFakeAttempts = s;
    this.onRowTextChange(row);
  }

}
