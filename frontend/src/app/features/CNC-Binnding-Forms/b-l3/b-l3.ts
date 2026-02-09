import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';
import { of, forkJoin } from 'rxjs';

import {
  OPS_CNC_L2_L3_MAPPING_FORM,
  OPS_CNC_L2_L3_MAPPING_TABLE,
} from './b-l3-config';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { OpsCncL2L3MappingService } from '../../../core/services/OpsCncL2L3MappingService';

@Component({
  selector: 'app-b-l3',
  imports: [Table, Modal, CommonModule],
  templateUrl: './b-l3.html',
  styleUrl: './b-l3.css',
})
export class BL3 implements OnInit {
  formConfig = OPS_CNC_L2_L3_MAPPING_FORM;
  tableConfig = OPS_CNC_L2_L3_MAPPING_TABLE;

  rows: any[] = [];
  loading = false;
  submitting = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};
  addLoading = false;

  constructor(
    private service: OpsCncL2L3MappingService,
    private notification: NzNotificationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;

    forkJoin({
      data: this.service.getAll(),
      l2: this.service.getCnCL2List(),
      l3: this.service.getCnCL3List()
    }).subscribe({
      next: (res: any) => {

        const rows = Array.isArray(res.data)
          ? res.data
          : (res.data?.data ?? []);

        const l2Arr = Array.isArray(res.l2)
          ? res.l2
          : (res.l2?.data ?? []);

        const l3Arr = Array.isArray(res.l3)
          ? res.l3
          : (res.l3?.data ?? []);

        this.rows = rows.map((r: any) => ({
          ...r,
          cncL2Name: l2Arr.find((x: any) => x.id === r.cncL2Id)?.name || r.cncL2Id,
          cncL3Name: l3Arr.find((x: any) => x.id === r.cncL3Id)?.name || r.cncL3Id,
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

    const l2Field = this.formConfig.fields.find(
      f => f.key === 'cncL2Id'
    );

    if (l2Field) {
      l2Field.disabled = false;
    }

    forkJoin({
      l2: this.service.getCnCL2List(),
      l3: this.service.getCnCL3List(),
    }).subscribe({
      next: ({ l2, l3 }) => {

        const l2Field = this.formConfig.fields.find(f => f.key === 'cncL2Id');
        if (l2Field) {
          const arr = Array.isArray(l2) ? l2 : (l2 as any)?.data ?? [];

          l2Field.options$ = of(
            arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
              meta: { id: x.id, name: x.name, desc: x.desc }
            }))
          );
        }

        const l3Field = this.formConfig.fields.find(f => f.key === 'cncL3Id');
        if (l3Field) {
          const arr = Array.isArray(l3) ? l3 : (l3 as any)?.data ?? [];

          l3Field.options$ = of(
            arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
              meta: { id: x.id, name: x.name, desc: x.desc }
            }))
          );
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

    const l2Field = this.formConfig.fields.find(
      f => f.key === 'cncL2Id'
    );

    if (l2Field) {
      l2Field.disabled = true;
    }

    forkJoin({
      l2: this.service.getCnCL2List(),
      l3: this.service.getCnCL3List(),
    }).subscribe({
      next: ({ l2, l3 }) => {

        const l2Arr = Array.isArray(l2) ? l2 : (l2 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL2Id')!.options$ =
          of(
            l2Arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
              meta: { id: x.id, name: x.name, desc: x.desc }
            }))
          );

        const l3Arr = Array.isArray(l3) ? l3 : (l3 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL3Id')!.options$ =
          of(
            l3Arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
              meta: { id: x.id, name: x.name, desc: x.desc }
            }))
          );

        this.formData = {
          cncL2Id: row.cncL2Id,
          cncL3Id: row.cncL3Id,
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
      cncL2Id: payload.cncL2Id,
      cncL3Id: payload.cncL3Id,
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
