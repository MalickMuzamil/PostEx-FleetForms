import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';
import { of, forkJoin } from 'rxjs';

import {
  OPS_CNC_L1_BRANCH_MAPPING_FORM,
  OPS_CNC_L1_BRANCH_MAPPING_TABLE,
} from './b-l1-config';

import { NzNotificationService } from 'ng-zorro-antd/notification';

/* service baad me attach hogi */
import { OpsCncL1BranchMappingService } from '../../../core/services/OpsCncL1BranchMappingService';

@Component({
  selector: 'app-b-l1',
  standalone: true,
  imports: [Table, Modal, CommonModule],
  templateUrl: './b-l1.html',
  styleUrl: './b-l1.css',
})
export class BL1 implements OnInit {

  /* =======================
     CONFIGS
  ======================== */

  formConfig = OPS_CNC_L1_BRANCH_MAPPING_FORM;
  tableConfig = OPS_CNC_L1_BRANCH_MAPPING_TABLE;

  /* =======================
     STATE
  ======================== */

  rows: any[] = [];
  loading = false;
  submitting = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};

  addLoading = false;

  constructor(
    private service: OpsCncL1BranchMappingService,
    private notification: NzNotificationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  /* =======================
     LOAD TABLE
  ======================== */

  load(): void {
    this.loading = true;

    this.service.getAll().subscribe({
      next: (res: any) => {
        this.rows = Array.isArray(res) ? res : (res?.data ?? []);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notification.error(
          'Error',
          err?.error?.message || 'Failed to load data'
        );
      },
    });
  }

  /* =======================
     OPEN ADD
  ======================== */

  openAdd(): void {

    if (this.addLoading) return;
    this.addLoading = true;

    this.isEdit = false;
    this.selectedId = null;
    this.formData = {};

    forkJoin({
      branches: this.service.getBranches(),
      cnc: this.service.getCnCL1List(),
    }).subscribe({
      next: ({ branches, cnc }) => {
        const bVal: any = branches as any;
        const cVal: any = cnc as any;
        const branchField = this.formConfig.fields.find(
          f => f.key === 'branchId'
        );

        if (branchField) {
          const branchArray = (Array.isArray(bVal) ? bVal : bVal?.data ?? []);
          const mappedBranches = (branchArray ?? []).map((b: any) => {
            const id = +(b.id ?? b.ID ?? b.BranchID ?? b.BranchId ?? b.branchId ?? b.Branch_Id ?? b.ID ?? null);
            if (Number.isNaN(id)) return null;
            const name = (b.name ?? b.Name ?? b.BranchName ?? b.branchName ?? b.Branch ?? '').toString().trim();
            const desc = (b.desc ?? b.description ?? b.BranchDesc ?? b.Branch_Desc ?? b.BranchDescription ?? '').toString().trim();
            return {
              label: name || String(id),
              value: id,
              searchText: `${id} ${name} ${desc}`.trim(),
              meta: { id, name, desc },
            };
          }).filter(Boolean as any);
          branchField.options$ = of(mappedBranches);
        }

        const cncField = this.formConfig.fields.find(
          f => f.key === 'cncL1Id'
        );

        if (cncField) {
          const cncArray = (Array.isArray(cVal) ? cVal : cVal?.data ?? []);
          const mappedCnc = (cncArray ?? []).map((c: any) => {
            const id = +(c.id ?? c.ID ?? c.cncL1Id ?? c.CncL1Id ?? c.CNC_L1_ID ?? null);
            if (Number.isNaN(id)) return null;
            const name = (c.name ?? c.Name ?? c.code ?? '').toString().trim();
            const desc = (c.desc ?? c.description ?? c.CNCL1Desc ?? c.CNC_L1_Desc ?? '').toString().trim();
            return {
              label: name || String(id),
              value: id,
              searchText: `${id} ${name} ${desc}`.trim(),
              meta: { id, name, desc },
            };
          }).filter(Boolean as any);
          cncField.options$ = of(mappedCnc);
        }

        this.showForm = true;
        this.addLoading = false;
      },
      error: () => {
        this.showForm = true;
        this.addLoading = false;
      }
    });

  }

  /* =======================
     OPEN EDIT
  ======================== */

  openEdit(row: any): void {

    this.isEdit = true;
    this.selectedId = row?.id ?? null;

    // ===== LOAD BRANCHES =====
    this.service.getBranches().subscribe({
      next: (branches: any) => {

        const branchOptions =
          (Array.isArray(branches) ? branches : branches?.data ?? [])
            .map((b: any) => ({
              label: b.name,
              value: b.id
            }));

        this.formConfig.fields.find(f => f.key === 'branchId')!.options =
          branchOptions;

        // ===== LOAD CNC L1 =====
        this.service.getCnCL1List().subscribe({
          next: (cnc: any) => {

            const cncOptions =
              (Array.isArray(cnc) ? cnc : cnc?.data ?? [])
                .map((c: any) => ({
                  label: c.name,
                  value: c.id
                }));

            this.formConfig.fields.find(f => f.key === 'cncL1Id')!.options =
              cncOptions;

            // ===== SET FORM DATA AFTER OPTIONS =====
            this.formData = {
              branchId: row.branchId,
              cncL1Id: row.cncL1Id,
              effectiveDate: row.effectiveDate
            };

            this.showForm = true;
          },
          error: () => {
            this.showForm = true;
          }
        });
      },
      error: () => {
        this.showForm = true;
      }
    });
  }

  /* =======================
     SUBMIT
  ======================== */

  onSubmit(payload: any): void {
    if (this.submitting) return;
    this.submitting = true;

    const done = () => (this.submitting = false);

    const body = {
      branchId: payload?.branchId,
      cncL1Id: payload?.cncL1Id,
      effectiveDate: payload?.effectiveDate,
    };

    /* ===== CREATE ===== */

    if (!this.isEdit) {
      this.service.create(body).subscribe({
        next: (res: any) => {
          this.notification.success(
            'Success',
            res?.message || 'Created successfully'
          );
          this.showForm = false;
          this.load();
          done();
        },
        error: (err) => {
          this.notification.error(
            'Error',
            err?.error?.message || 'Create failed'
          );
          done();
        },
      });
      return;
    }

    /* ===== UPDATE ===== */

    if (!this.selectedId) {
      done();
      return;
    }

    this.service.update(this.selectedId, body).subscribe({
      next: (res: any) => {
        this.notification.success(
          'Success',
          res?.message || 'Updated successfully'
        );
        this.showForm = false;
        this.load();
        done();
      },
      error: (err) => {
        this.notification.error(
          'Error',
          err?.error?.message || 'Update failed'
        );
        done();
      },
    });
  }

  /* =======================
     CLOSE
  ======================== */

  closeForm(): void {
    this.showForm = false;
  }

}
