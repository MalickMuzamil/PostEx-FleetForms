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
  branchMap: Record<number, string> = {};
  cncMap: Record<number, string> = {};

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

    forkJoin({
      data: this.service.getAll(),
      branches: this.service.getBranches(),
      cnc: this.service.getCnCL1List(),
    }).subscribe({
      next: (res: any) => {

        const rows = Array.isArray(res.data)
          ? res.data
          : (res.data?.data ?? []);

        const branchArr = Array.isArray(res.branches)
          ? res.branches
          : (res.branches?.data ?? []);

        const cncArr = Array.isArray(res.cnc)
          ? res.cnc
          : (res.cnc?.data ?? []);

        // build maps
        this.branchMap = {};
        branchArr.forEach((b: any) => {
          this.branchMap[b.id] = b.name;
        });

        this.cncMap = {};
        cncArr.forEach((c: any) => {
          this.cncMap[c.id] = c.name;
        });

        // replace ids with names
        this.rows = rows.map((r: any) => ({
          ...r,
          branchName: this.branchMap[r.branchId] || r.branchId,
          cncL1Name: this.cncMap[r.cncL1Id] || r.cncL1Id,
          effectiveDate: r.effectiveDate?.split('T')[0]
        }));

        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notification.error('Error', 'Failed to load data');
      }
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

    const branchField = this.formConfig.fields.find(
      f => f.key === 'branchId'
    );

    if (branchField) {
      branchField.disabled = false;
    }

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

    const branchField = this.formConfig.fields.find(f => f.key === 'branchId');
    if (branchField) branchField.disabled = true;

    this.isEdit = true;
    this.selectedId = row?.id ?? null;

    this.service.getBranches().subscribe({
      next: (branches: any) => {

        const branchArray = (Array.isArray(branches) ? branches : branches?.data ?? []);

        const branchOptions = branchArray.map((b: any) => {
          const id = +(b.id ?? b.ID ?? b.BranchID ?? b.BranchId ?? null);
          const name = (b.name ?? b.Name ?? b.BranchName ?? '').toString().trim();
          const desc = (b.desc ?? b.description ?? b.BranchDesc ?? '').toString().trim();

          return {
            label: name || String(id),
            value: id,
            searchText: `${id} ${name} ${desc}`.trim(),
            meta: { id, name, desc }
          };
        });

        this.formConfig.fields.find(f => f.key === 'branchId')!.options$ =
          of(branchOptions);

        this.service.getCnCL1List().subscribe({
          next: (cnc: any) => {

            const cncArray = (Array.isArray(cnc) ? cnc : cnc?.data ?? []);

            const cncOptions = cncArray.map((c: any) => {
              const id = +(c.id ?? c.ID ?? c.cncL1Id ?? c.CncL1Id ?? c.CNC_L1_ID ?? null);
              if (Number.isNaN(id)) return null;

              const name = (c.name ?? c.Name ?? c.code ?? '').toString().trim();
              const desc = (c.desc ?? c.description ?? c.CNCL1Desc ?? c.CNC_L1_Desc ?? '').toString().trim();

              return {
                label: name || String(id),
                value: id,
                searchText: `${id} ${name} ${desc}`.trim(),
                meta: { id, name, desc }
              };
            }).filter(Boolean as any);

            this.formConfig.fields.find(f => f.key === 'cncL1Id')!.options$ =
              of(cncOptions);

            // SET VALUES AFTER OPTIONS READY
            this.formData = {
              branchId: row.branchId,
              cncL1Id: row.cncL1Id,
              effectiveDate: row.effectiveDate
            };

            this.showForm = true;
          }
        });
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
