import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

import { AuthService } from '../../../core/services/auth-service';
import { ZongPortalService } from '../../../core/services/zong-portal-service';


import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';

import {
  ZONG_PORTAL_FORM,
  ZONG_PORTAL_EDIT_FORM,
  ZONG_PORTAL_TABLE,
} from './zong-portal-config';

@Component({
  selector: 'app-zong-portal',
  imports: [Table, Modal, NzModalModule],
  templateUrl: './zong-portal.html',
  styleUrl: './zong-portal.css',
})
export class ZongPortal implements OnInit {
  fetchFormConfig = { ...ZONG_PORTAL_FORM };
  editFormConfig = { ...ZONG_PORTAL_EDIT_FORM };
  formConfig: any = { ...ZONG_PORTAL_FORM };

  tableConfig = structuredClone(ZONG_PORTAL_TABLE);

  showModal = false;
  data: any = {};
  tableData: any[] = [];
  loading: boolean = true;

  isEditMode = false;
  editingRow: any = null;
  isFetching = false;

  constructor(
    private zongPortalService: ZongPortalService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    if (!this.auth.hasRole('HR') && !this.auth.hasRole('ADMIN')) {
      this.router.navigate(['/']);
      return;
    }

    this.loadTable();
  }

  loadTable() {
    this.zongPortalService.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        const mappedRows = (rows || []).map((r: any) => {
          const callDateStr = this.isoDateOnly(
            r.CallDate ?? r.callDate ?? r.CALL_DATE
          );

          return {
            id: r.ID ?? r.Id ?? r.id,

            msisdn: String(r.MSISDN ?? r.msisdn ?? ''),
            callDate: callDateStr ? new Date(callDateStr) : null,
            callDateDisplay: callDateStr || '',

            direction: String(r.Direction ?? r.direction ?? r.DIRECTION ?? '-'),
            duration: String(r.Duration ?? r.duration ?? r.DURATION ?? '-'),
            status: String(r.Status ?? r.status ?? r.STATUS ?? '-'),
          };
        });

        this.tableData = mappedRows;
        this.loading = false;

        const statusValues = mappedRows
          .map((x: any) => x.status)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== '-');

        const statusOptions = [...new Set<string>(statusValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        this.tableConfig = {
          ...this.tableConfig,
          columns: this.tableConfig.columns.map((col: any) => {
            if (col.key === 'status') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Status',
                  options: statusOptions,
                },
              };
            }

            return col;
          }),
        };
      },
      error: () => {
        this.notification.error('Error', 'Failed to load Zong call logs');
      },
    });
  }

  openAddForm() {
    this.isEditMode = false;
    this.editingRow = null;
    this.formConfig = { ...this.fetchFormConfig };
    this.data = {};
    this.showModal = true;
  }

  openEditForm(row: any) {
    this.isEditMode = true;
    this.editingRow = row;

    this.formConfig = { ...this.editFormConfig };
    this.data = {
      msisdn: row.msisdn,
      callDate: this.asLocalDate(row.callDate),
      direction: row.direction,
      duration: row.duration,
      status: row.status,
    };

    this.showModal = true;
    this.data = { ...this.data };
  }

  closeModal() {
    this.showModal = false;
  }

  onFormChange(evt: { key: string; value: any; formValue: any }) {
    if (!this.isEditMode) return;

    const key = evt?.key;
    const value = evt?.value?.value ?? evt?.value;

    if (key === 'callDate') {
      this.data.callDate = this.asLocalDate(value);
      return;
    }

    if (key) {
      this.data[key] = value;
    }
  }

  fetchFromZong() {
    if (this.isFetching) return;

    this.isFetching = true;

    const payload = {
      vpbx_id: '65e043a837e88',
      token: '1c7ce5b9-c061-4147-816d-96e649ce1eb6',
      call_type: 'outbound',
      start_date: '2026-04-10',
      end_date: '2026-04-10'
    };

    this.zongPortalService.fetchFromZong(payload).subscribe({
      next: (res: any) => {
        console.log('ZONG API RESPONSE:', res);

        if (Array.isArray(res?.data)) {
          console.table(res.data);
        }

        const totalRecords = res?.data?.length || 0;

        if (totalRecords === 0) {
          this.notification.warning('No Data', 'No records received from Zong API');
        } else {
          this.notification.success(
            'Success',
            `Fetched ${totalRecords} records successfully`
          );
        }
      },

      error: (err: any) => {
        console.error('ZONG API ERROR:', err);

        this.notification.error(
          'Error',
          err?.error?.message || 'Failed to fetch data from Zong'
        );

        this.isFetching = false;
      },

      complete: () => {
        this.isFetching = false;
      },
    });
  }

  saveEdit(formValue: any) {
    if (!this.editingRow?.id) return;

    const payload = {
      msisdn: String(formValue?.msisdn ?? '').trim(),
      callDate: formValue?.callDate
        ? this.toYMD(new Date(formValue.callDate))
        : null,
      direction: formValue?.direction ?? null,
      duration: String(formValue?.duration ?? '').trim() || null,
      status: String(formValue?.status ?? '').trim() || null,
    };

    this.zongPortalService.update(this.editingRow.id, payload).subscribe({
      next: () => {
        this.notification.success('Success', 'Call log updated successfully');
        this.showModal = false;
        this.loadTable();
      },
      error: (err: any) => {
        this.notification.error(
          'Error',
          err?.error?.message || 'Failed to update call log'
        );
      },
    });
  }

  delete(row: any) {
    if (!row?.id) return;

    this.modal.confirm({
      nzTitle: 'Delete Confirmation',
      nzContent: 'Are you sure you want to delete this call log?',
      nzOkText: 'Yes, Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.zongPortalService.delete(row.id).subscribe({
          next: () => {
            this.notification.success('Success', 'Call log deleted successfully');
            this.loadTable();
          },
          error: (err: any) => {
            this.notification.error(
              'Error',
              err?.error?.message || 'Failed to delete call log'
            );
          },
        });
      },
    });
  }

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

  private isoDateOnly(v: any): string {
    const s = String(v ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return '';
  }

  private toYMD(d: Date): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }
}
