import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { RouterLink } from '@angular/router';
import { CallLogsService } from '../../../core/services/call-logs-service';

interface BulkCallLogsRow {
  rowNo: number;
  uid: number;

  customerNumber: string | null;
  consigneeCellLength: number | null;
  masterNo: string | null;

  agentDuration: string | null; // keep as string (seconds or HH:mm:ss)
  totalDuration: string | null;

  extension: string | null;
  callResponse: string | null;

  time: Date | null;
  timeControl: FormControl<Date | null>;

  recording: string | null;

  isArchived: number;
  checked: boolean;
  saving?: boolean;
  errors?: string[];
  isValid?: boolean;

  rawCustomerNumber?: string;
  rawConsigneeCellLength?: string;
  rawMasterNo?: string;
  rawAgentDuration?: string;
  rawTotalDuration?: string;
  rawExtension?: string;
  rawCallResponse?: string;
  rawTime?: string;
  rawRecording?: string;
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

export class CallLogsBulkView {
  file!: File;
  private uidCounter = 0;

  // ---------- messages ----------
  private readonly CUST_REQUIRED = 'Customer_Number is required';

  private readonly CONS_REQUIRED = 'Consignee_Cell_Length is required';
  private readonly CONS_INVALID = 'Consignee_Cell_Length: Invalid number';

  private readonly MASTER_REQUIRED = 'Master_No is required';

  private readonly AG_REQUIRED = 'Agent Duration is required';
  private readonly AG_INVALID = 'Agent Duration: Invalid format';

  private readonly TOT_REQUIRED = 'Total Duration is required';
  private readonly TOT_INVALID = 'Total Duration: Invalid format';

  private readonly RESP_REQUIRED = 'Call_Response is required';

  private readonly TIME_REQUIRED = 'Time is required';
  private readonly INVALID_TIME = 'Invalid Time';

  private readonly ARCH_REQUIRED = 'IsArchived is required';
  private readonly INVALID_ARCH = 'IsArchived must be 0 or 1';

  readonly REQUIRED_COLUMNS = [
    'Customer_Number',
    'Consignee_Cell_Length',
    'Master_No',
    'Agent Duration',
    'Total Duration',
    'Extension',
    'Call_Response',
    'Time',
    'Recording',
    'IsArchived',
  ];

  rows: BulkCallLogsRow[] = [];
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
    private callLogsService: CallLogsService,
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

  trackByRow = (_: number, r: BulkCallLogsRow) => r.uid;

  toast(type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) {
    (this.notification as any)[type](title, msg, { nzDuration: 5000 });
  }

  hasErr(row: BulkCallLogsRow, msg: string): boolean {
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

        this.fileHeaders = (rowsHeader[0] as any[]).map((h) => String(h ?? '').trim()).filter(Boolean);

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

    this.columnMap['Customer_Number'] = pick(['Customer_Number', 'CUSTOMER_NUMBER']);
    this.columnMap['Consignee_Cell_Length'] = pick(['Consignee_Cell_Length', 'CONSIGNEE_CELL_LENGTH']);
    this.columnMap['Master_No'] = pick(['Master_No', 'MASTER_NO']);

    this.columnMap['Agent Duration'] = pick(['Agent Duration', 'AGENT_DURATION', 'Agent_Duration']);
    this.columnMap['Total Duration'] = pick(['Total Duration', 'TOTAL_DURATION', 'Total_Duration']);

    this.columnMap['Extension'] = pick(['Extension', 'EXTENSION']);
    this.columnMap['Call_Response'] = pick(['Call_Response', 'CALL_RESPONSE']);

    this.columnMap['Time'] = pick(['Time', 'TIME']);
    this.columnMap['Recording'] = pick(['Recording', 'RECORDING']);
    this.columnMap['IsArchived'] = pick(['IsArchived', 'ISARCHIVED', 'Is_Archived']);
  }

  // ---------------- ROW MAPPING ----------------
  private mapRows(data: any[]) {
    if (!this.uidCounter) this.uidCounter = Date.now();

    const getVal = (rowObj: any, key: string) => rowObj?.[this.columnMap[key]];

    this.rows = (data || []).map((r, i) => {
      const errors: string[] = [];

      const rawCustomerNumber = String(getVal(r, 'Customer_Number') ?? '').trim();
      const rawConsigneeCellLength = String(getVal(r, 'Consignee_Cell_Length') ?? '').trim();
      const rawMasterNo = String(getVal(r, 'Master_No') ?? '').trim();

      const rawAgentDuration = String(getVal(r, 'Agent Duration') ?? '').trim();
      const rawTotalDuration = String(getVal(r, 'Total Duration') ?? '').trim();

      const rawExtension = String(getVal(r, 'Extension') ?? '').trim();
      const rawCallResponse = String(getVal(r, 'Call_Response') ?? '').trim();

      const rawTime = String(getVal(r, 'Time') ?? '').trim();
      const rawRecording = String(getVal(r, 'Recording') ?? '').trim();

      const rawIsArchived = String(getVal(r, 'IsArchived') ?? '').trim();

      // Customer_Number (must be exactly 11 digits)
      const customerNumber = rawCustomerNumber || null;

      if (!customerNumber) {
        errors.push(this.CUST_REQUIRED);
      } else if (!/^\d{11}$/.test(rawCustomerNumber)) {
        errors.push('Customer_Number must be exactly 11 digits');
      }

      // Consignee_Cell_Length (number)
      const consigneeCellLength = this.toNumberOrNull(rawConsigneeCellLength);
      if (rawConsigneeCellLength === '') errors.push(this.CONS_REQUIRED);
      else if (consigneeCellLength === null) errors.push(this.CONS_INVALID);

      // Master_No
      const masterNo = rawMasterNo || null;
      if (!masterNo) errors.push(this.MASTER_REQUIRED);

      // Agent Duration (seconds OR HH:mm:ss)
      const agentDuration = rawAgentDuration || null;
      if (!rawAgentDuration) errors.push(this.AG_REQUIRED);
      else if (!this.isDurationValid(rawAgentDuration)) errors.push(this.AG_INVALID);

      // Total Duration
      const totalDuration = rawTotalDuration || null;
      if (!rawTotalDuration) errors.push(this.TOT_REQUIRED);
      else if (!this.isDurationValid(rawTotalDuration)) errors.push(this.TOT_INVALID);

      // Extension (optional)
      const extension = rawExtension || null;

      // Call_Response
      const callResponse = rawCallResponse || null;
      if (!callResponse) errors.push(this.RESP_REQUIRED);

      // Time (datetime)
      const time = this.parseAnyDateTime(rawTime);
      if (!rawTime) errors.push(this.TIME_REQUIRED);
      else if (!time) errors.push(this.INVALID_TIME);

      // Recording (optional)
      const recording = rawRecording || null;

      // IsArchived
      let isArchivedNum: number | null = null;
      if (rawIsArchived === '') errors.push(this.ARCH_REQUIRED);
      else {
        const n = Number(rawIsArchived);
        if (n === 0 || n === 1) isArchivedNum = n;
        else errors.push(this.INVALID_ARCH);
      }

      // ✅ Max length = 20 (same as your previous pattern)
      const checkMax = (val: string, label: string) => {
        if (val && val.length > this.MAX_LEN) errors.push(this.TOO_LONG(label));
      };
      checkMax(rawCustomerNumber, 'Customer_Number');
      checkMax(rawMasterNo, 'Master_No');
      checkMax(rawExtension, 'Extension');
      checkMax(rawCallResponse, 'Call_Response');

      const row: BulkCallLogsRow = {
        uid: ++this.uidCounter,
        rowNo: i + 1,

        rawCustomerNumber,
        rawConsigneeCellLength,
        rawMasterNo,
        rawAgentDuration,
        rawTotalDuration,
        rawExtension,
        rawCallResponse,
        rawTime,
        rawRecording,
        rawIsArchived,

        customerNumber,
        consigneeCellLength,
        masterNo,
        agentDuration,
        totalDuration,
        extension,
        callResponse,

        time,
        timeControl: new FormControl<Date | null>(time),

        recording,

        isArchived: isArchivedNum ?? 0,

        checked: false,
        errors,
        isValid: false,
      };

      return row;
    });

    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  // ---------------- ERROR HELPERS ----------------
  private addErr(row: BulkCallLogsRow, msg: string) {
    row.errors = row.errors ?? [];
    if (!row.errors.includes(msg)) row.errors.push(msg);
  }
  private removeErr(row: BulkCallLogsRow, msg: string) {
    row.errors = (row.errors ?? []).filter((e) => e !== msg);
  }

  private clearManagedErrors(row: BulkCallLogsRow) {
    [
      this.CUST_REQUIRED,
      'Customer_Number must be exactly 11 digits',
      this.CONS_REQUIRED,
      this.CONS_INVALID,
      this.MASTER_REQUIRED,
      this.AG_REQUIRED,
      this.AG_INVALID,
      this.TOT_REQUIRED,
      this.TOT_INVALID,
      this.RESP_REQUIRED,
      this.TIME_REQUIRED,
      this.INVALID_TIME,
      this.ARCH_REQUIRED,
      this.INVALID_ARCH,
    ].forEach((m) => this.removeErr(row, m));

    row.errors = (row.errors ?? []).filter((e) => !/Max 20 characters allowed/i.test(e));
  }

  // ---------------- VALIDATIONS ----------------
  private applyLocalValidations() {
    for (const row of this.rows) {
      this.clearManagedErrors(row);

      // Customer_Number
      const cust = String(row.customerNumber ?? '').trim();
      if (!cust) {
        this.addErr(row, this.CUST_REQUIRED);
      } else if (!/^\d{11}$/.test(cust)) {
        this.addErr(row, 'Customer_Number must be exactly 11 digits');
      }

      // Consignee_Cell_Length
      const consRaw = String(row.consigneeCellLength ?? '').trim();
      if (!consRaw) {
        this.addErr(row, this.CONS_REQUIRED);
      } else if (row.consigneeCellLength === null || row.consigneeCellLength === undefined || isNaN(Number(consRaw))) {
        this.addErr(row, this.CONS_INVALID);
      }

      // Master_No
      const master = String(row.masterNo ?? '').trim();
      if (!master) {
        this.addErr(row, this.MASTER_REQUIRED);
      }

      // Agent Duration
      const ag = String(row.agentDuration ?? '').trim();
      if (!ag) {
        this.addErr(row, this.AG_REQUIRED);
      } else if (!this.isDurationValid(ag)) {
        this.addErr(row, this.AG_INVALID);
      }

      // Total Duration
      const tot = String(row.totalDuration ?? '').trim();
      if (!tot) {
        this.addErr(row, this.TOT_REQUIRED);
      } else if (!this.isDurationValid(tot)) {
        this.addErr(row, this.TOT_INVALID);
      }

      // Call_Response
      const resp = String(row.callResponse ?? '').trim();
      if (!resp) {
        this.addErr(row, this.RESP_REQUIRED);
      }

      // Time
      const dt = row.timeControl?.value;
      if (!dt) {
        if (!String(row.rawTime ?? '').trim()) this.addErr(row, this.TIME_REQUIRED);
        else this.addErr(row, this.INVALID_TIME);
      }

      // IsArchived
      const arch = Number(row.isArchived);
      if (!(arch === 0 || arch === 1)) {
        this.addErr(row, this.INVALID_ARCH);
      }

      // max len
      this.validateMaxLen(row, row.customerNumber, 'Customer_Number');
      this.validateMaxLen(row, row.masterNo, 'Master_No');
      this.validateMaxLen(row, row.extension, 'Extension');
      this.validateMaxLen(row, row.callResponse, 'Call_Response');
    }

    this.updateHasValidRow();
    this.enforceSelectionRules();
  }

  private applyLocalValidationsSafe() {
    if (this.localValidateTimer) return;
    this.localValidateTimer = setTimeout(() => {
      this.localValidateTimer = null;
      this.applyLocalValidations();
    }, 80);
  }

  isRowValid(row: BulkCallLogsRow): boolean {
    const cust = String(row.customerNumber ?? '').trim();
    const cons = String(row.consigneeCellLength ?? '').trim();
    const master = String(row.masterNo ?? '').trim();
    const ag = String(row.agentDuration ?? '').trim();
    const tot = String(row.totalDuration ?? '').trim();
    const resp = String(row.callResponse ?? '').trim();

    return (row.errors?.length ?? 0) === 0 &&
      !!cust &&
      /^\d{11}$/.test(cust) &&
      !!cons &&
      row.consigneeCellLength !== null &&
      row.consigneeCellLength !== undefined &&
      !isNaN(Number(cons)) &&
      !!master &&
      !!ag &&
      this.isDurationValid(ag) &&
      !!tot &&
      this.isDurationValid(tot) &&
      !!resp &&
      !!row.timeControl?.value &&
      (Number(row.isArchived) === 0 || Number(row.isArchived) === 1);
  }

  updateHasValidRow() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);
      if (!r.isValid) r.checked = false;
    }

    this.hasValidRow = this.rows.some(r => r.isValid === true);

    const validRows = this.rows.filter(r => r.isValid);
    this.checkAll = validRows.length > 0 && validRows.every(r => r.checked);
  }

  // ---------------- UI EVENTS ----------------
  onToggleAll(checked: boolean) {
    this.checkAll = checked;
    this.rows.forEach((r) => (r.checked = checked ? !!r.isValid : false));
    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  onRowToggle(row: BulkCallLogsRow, checked: boolean) {
    const canSelect = !!row.isValid;
    row.checked = checked && canSelect;
    this.enforceSelectionRules();
  }

  onRowTimeChange(row: BulkCallLogsRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowArchivedChange(row: BulkCallLogsRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowTextChange(row: BulkCallLogsRow) {
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

    const payloads = selected.map((r) => ({
      Customer_Number: String(r.customerNumber || '').trim(),
      Consignee_Cell_Length: Number(r.consigneeCellLength),
      Master_No: String(r.masterNo || '').trim(),
      'Agent Duration': String(r.agentDuration || '').trim(),
      'Total Duration': String(r.totalDuration || '').trim(),
      Extension: String(r.extension || '').trim(),
      Call_Response: String(r.callResponse || '').trim(),
      Time: r.timeControl.value ? this.toYMDHMS(r.timeControl.value) : null,
      Recording: String(r.recording || '').trim(),
      IsArchived: Number(r.isArchived),
    })).filter((p) => p.Customer_Number && p.Master_No && p.Time);

    try {
      const chunks = this.chunk(payloads, 200);

      let insertedTotal = 0;
      let lastMsg = '';

      for (const ch of chunks) {
        const res: any = await new Promise((resolve, reject) => {
          this.callLogsService.importBulk(ch).subscribe({
            next: (resp) => resolve(resp),
            error: (e) => reject(e),
          });
        });

        lastMsg = res?.message || lastMsg;
        insertedTotal += Number(res?.data?.inserted || 0);
      }

      // ✅ show backend message
      this.toast('success', 'Success', lastMsg || `Imported (${insertedTotal}) rows`);

      this.removeRowsRef(selected);
    } catch (e: any) {
      this.toast('error', 'Error', e?.error?.message || e?.message || 'Bulk import failed');
    } finally {
      this.bulkSaving = false;
    }
  }

  // ---------------- HELPERS ----------------
  private removeRowsRef(rowsToRemove: BulkCallLogsRow[]) {
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

  private toYMDHMS(d: Date): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  private parseAnyDateTime(raw: string): Date | null {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    // Accept: "YYYY-MM-DD HH:mm:ss" OR ISO
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      const normalized = s.length === 16 ? `${s}:00` : s;
      const iso = normalized.replace(' ', 'T');
      const d = new Date(iso);
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

  // ✅ duration accepts "123" (seconds) OR "HH:mm:ss" OR "mm:ss"
  private isDurationValid(v: string): boolean {
    const s = String(v ?? '').trim();
    if (!s) return false;
    if (/^\d+(\.\d+)?$/.test(s)) return true;               // seconds
    if (/^\d{1,2}:\d{2}$/.test(s)) return true;             // mm:ss
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return true;       // HH:mm:ss
    return false;
  }

  private validateMaxLen(row: BulkCallLogsRow, value: any, label: string) {
    const msg = this.TOO_LONG(label);
    const s = String(value ?? '').trim();
    if (s && s.length > this.MAX_LEN) this.addErr(row, msg);
    else this.removeErr(row, msg);
  }

  private enforceSelectionRules() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);
      if (!r.isValid) r.checked = false;
    }

    const validRows = this.rows.filter(r => r.isValid);
    this.checkAll = validRows.length > 0 && validRows.every(r => r.checked);
  }

  hasErrLike(row: BulkCallLogsRow, key: string): boolean {
    return (row.errors ?? []).some(e =>
      String(e).toLowerCase().includes(key.toLowerCase())
    );
  }

  showRowErrors(row: BulkCallLogsRow) {
    const errors = row.errors ?? [];

    const messages = errors.length
      ? errors.map((err: string) => `<li>${err}</li>`).join('')
      : '<li>No errors</li>';

    this.modal.info({
      nzTitle: `Row ${row.rowNo} errors`,
      nzContent: `<ul style="margin:0;padding-left:18px">${messages}</ul>`,
      nzClosable: true,
      nzWidth: 420,
    });
  }
}
