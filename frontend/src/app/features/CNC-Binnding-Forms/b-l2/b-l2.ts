import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';
import { of, forkJoin } from 'rxjs';

import {
  OPS_CNC_L1_L2_MAPPING_FORM,
  OPS_CNC_L1_L2_MAPPING_TABLE,
} from './b-l2-config';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { OpsCncL1L2MappingService } from '../../../core/services/OpsCncL1L2MappingService';

@Component({
  selector: 'app-b-l2',
  standalone: true,
  imports: [Table, Modal, CommonModule],
  templateUrl: './b-l2.html',
  styleUrl: './b-l2.css',
})
export class BL2 implements OnInit {
  formConfig = OPS_CNC_L1_L2_MAPPING_FORM;
  tableConfig = OPS_CNC_L1_L2_MAPPING_TABLE;

  rows: any[] = [];
  loading = false;
  submitting = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};
  addLoading = false;

  l1Map: Record<number, string> = {};
  l2Map: Record<number, string> = {};

  constructor(
    private service: OpsCncL1L2MappingService,
    private notification: NzNotificationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;

    forkJoin({
      data: this.service.getAll(),
      l1: this.service.getCnCL1List(),
      l2: this.service.getCnCL2List()
    }).subscribe({
      next: (res: any) => {

        const rows = Array.isArray(res.data)
          ? res.data
          : (res.data?.data ?? []);

        const l1Arr = Array.isArray(res.l1)
          ? res.l1
          : (res.l1?.data ?? []);

        const l2Arr = Array.isArray(res.l2)
          ? res.l2
          : (res.l2?.data ?? []);

        // build lookup
        this.l1Map = {};
        l1Arr.forEach((x: any) => {
          this.l1Map[x.id] = x.name;
        });

        this.l2Map = {};
        l2Arr.forEach((x: any) => {
          this.l2Map[x.id] = x.name;
        });

        // map rows
        this.rows = rows.map((r: any) => ({
          ...r,
          cncL1Name: this.l1Map[r.cncL1Id] || r.cncL1Id,
          cncL2Name: this.l2Map[r.cncL2Id] || r.cncL2Id,
          effectiveDate: r.effectiveDate?.split('T')[0]
        }));

        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  openAdd() {

    if (this.addLoading) return;
    this.addLoading = true;

    this.isEdit = false;
    this.selectedId = null;
    this.formData = {};

    const l1Field = this.formConfig.fields.find(
      f => f.key === 'cncL1Id'
    );

    if (l1Field) {
      l1Field.disabled = false;
    }

    forkJoin({
      l1: this.service.getCnCL1List(),
      l2: this.service.getCnCL2List(),
    }).subscribe({
      next: ({ l1, l2 }) => {
        const l1Val: any = l1 as any;
        const l2Val: any = l2 as any;

        const l1Field = this.formConfig.fields.find(f => f.key === 'cncL1Id');
        if (l1Field) {
          const l1Array = (Array.isArray(l1Val) ? l1Val : l1Val?.data ?? []);
          const mappedL1 = (l1Array ?? []).map((x: any) => {
            const id = +(x.id ?? x.ID ?? x.cncL1Id ?? x.CncL1Id ?? x.CNC_L1_ID ?? null);
            if (Number.isNaN(id)) return null;
            const name = (x.name ?? x.Name ?? x.code ?? '').toString().trim();
            const desc = (x.desc ?? x.description ?? x.CNCL1Desc ?? x.CNC_L1_Desc ?? '').toString().trim();
            return {
              label: name || String(id),
              value: id,
              searchText: `${id} ${name} ${desc}`.trim(),
              meta: { id, name, desc },
            };
          }).filter(Boolean as any);
          l1Field.options$ = of(mappedL1);
        }

        const l2Field = this.formConfig.fields.find(f => f.key === 'cncL2Id');
        if (l2Field) {
          const l2Array = (Array.isArray(l2Val) ? l2Val : l2Val?.data ?? []);
          const mappedL2 = (l2Array ?? []).map((x: any) => {
            const id = +(x.id ?? x.ID ?? x.cncL2Id ?? x.CncL2Id ?? x.CNC_L2_ID ?? null);
            if (Number.isNaN(id)) return null;
            const name = (x.name ?? x.Name ?? x.code ?? '').toString().trim();
            const desc = (x.desc ?? x.description ?? x.CNCL2Desc ?? x.CNC_L2_Desc ?? '').toString().trim();
            return {
              label: name || String(id),
              value: id,
              searchText: `${id} ${name} ${desc}`.trim(),
              meta: { id, name, desc },
            };
          }).filter(Boolean as any);
          l2Field.options$ = of(mappedL2);
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

  openEdit(row: any) {

    this.isEdit = true;
    this.selectedId = row.id;

    const l1Field = this.formConfig.fields.find(
      f => f.key === 'cncL1Id'
    );

    if (l1Field) {
      l1Field.disabled = true;
    }

    forkJoin({
      l1: this.service.getCnCL1List(),
      l2: this.service.getCnCL2List(),
    }).subscribe({
      next: ({ l1, l2 }) => {
        const l1Val: any = l1 as any;
        const l2Val: any = l2 as any;

        const l1Field = this.formConfig.fields.find(f => f.key === 'cncL1Id');
        if (l1Field) {
          const l1Array = (Array.isArray(l1Val) ? l1Val : l1Val?.data ?? []);
          const mappedL1 = (l1Array ?? []).map((x: any) => {
            const id = +(x.id ?? x.ID ?? x.cncL1Id ?? x.CncL1Id ?? x.CNC_L1_ID ?? null);
            if (Number.isNaN(id)) return null;
            const name = (x.name ?? x.Name ?? x.code ?? '').toString().trim();
            const desc = (x.desc ?? x.description ?? x.CNCL1Desc ?? x.CNC_L1_Desc ?? '').toString().trim();
            return {
              label: name || String(id),
              value: id,
              searchText: `${id} ${name} ${desc}`.trim(),
              meta: { id, name, desc },
            };
          }).filter(Boolean as any);
          l1Field.options$ = of(mappedL1);
        }

        const l2Field = this.formConfig.fields.find(f => f.key === 'cncL2Id');
        if (l2Field) {
          const l2Array = (Array.isArray(l2Val) ? l2Val : l2Val?.data ?? []);
          const mappedL2 = (l2Array ?? []).map((x: any) => {
            const id = +(x.id ?? x.ID ?? x.cncL2Id ?? x.CncL2Id ?? x.CNC_L2_ID ?? null);
            if (Number.isNaN(id)) return null;
            const name = (x.name ?? x.Name ?? x.code ?? '').toString().trim();
            const desc = (x.desc ?? x.description ?? x.CNCL2Desc ?? x.CNC_L2_Desc ?? '').toString().trim();
            return {
              label: name || String(id),
              value: id,
              searchText: `${id} ${name} ${desc}`.trim(),
              meta: { id, name, desc },
            };
          }).filter(Boolean as any);
          l2Field.options$ = of(mappedL2);
        }

        this.formData = {
          cncL1Id: row.cncL1Id,
          cncL2Id: row.cncL2Id,
          effectiveDate: row.effectiveDate
        };

        this.showForm = true;
      }
    });
  }

  onSubmit(payload: any) {

    if (this.submitting) return;
    this.submitting = true;

    const body = {
      cncL1Id: payload.cncL1Id,
      cncL2Id: payload.cncL2Id,
      effectiveDate: payload.effectiveDate
    };

    const done = () => this.submitting = false;

    if (!this.isEdit) {
      this.service.create(body).subscribe({
        next: () => {
          this.notification.success('Success', 'Created successfully');
          this.showForm = false;
          this.load();
          done();
        },
        error: err => {
          this.notification.error('Error', err?.error?.message || 'Create failed');
          done();
        }
      });
      return;
    }

    this.service.update(this.selectedId!, body).subscribe({
      next: () => {
        this.notification.success('Success', 'Updated successfully');
        this.showForm = false;
        this.load();
        done();
      },
      error: err => {
        this.notification.error('Error', err?.error?.message || 'Update failed');
        done();
      }
    });

  }

  closeForm() {
    this.showForm = false;
  }
}
