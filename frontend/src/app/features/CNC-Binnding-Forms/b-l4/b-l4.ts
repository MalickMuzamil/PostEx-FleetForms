import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';
import { of, forkJoin } from 'rxjs';

import {
  OPS_CNC_L3_L4_MAPPING_FORM,
  OPS_CNC_L3_L4_MAPPING_TABLE,
} from './b-l4-config';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { OpsCncL3L4MappingService } from '../../../core/services/OpsCncL3L4MappingService';

@Component({
  selector: 'app-b-l4',
  standalone: true,
  imports: [Table, Modal, CommonModule],
  templateUrl: './b-l4.html',
  styleUrl: './b-l4.css',
})
export class BL4 implements OnInit {
  formConfig = OPS_CNC_L3_L4_MAPPING_FORM;
  tableConfig = OPS_CNC_L3_L4_MAPPING_TABLE;

  rows: any[] = [];
  loading = false;
  submitting = false;
  editLoading = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};
  addLoading = false;

  constructor(
    private service: OpsCncL3L4MappingService,
    private notification: NzNotificationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (res: any) => {
        this.rows = Array.isArray(res) ? res : (res?.data ?? []);
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

    forkJoin({
      l3: this.service.getCnCL3List(),
      l4: this.service.getCnCL4List(),
    }).subscribe({
      next: ({ l3, l4 }) => {

        const l3Field = this.formConfig.fields.find(f => f.key === 'cncL3Id');
        if (l3Field) {
          const l3Any = l3 as any;
          const arr = Array.isArray(l3Any) ? l3Any : l3Any?.data ?? [];
          l3Field.options$ = of(
            arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              meta: x
            }))
          );
        }

        const l4Field = this.formConfig.fields.find(f => f.key === 'cncL4Id');
        if (l4Field) {
          const l4Any = l4 as any;
          const arr = Array.isArray(l4Any) ? l4Any : l4Any?.data ?? [];
          l4Field.options$ = of(
            arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              meta: x
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

    forkJoin({
      l3: this.service.getCnCL3List(),
      l4: this.service.getCnCL4List(),
    }).subscribe({
      next: ({ l3, l4 }) => {

        const l3Arr = Array.isArray(l3) ? l3 : (l3 as any)?.data ?? [];
        const l4Arr = Array.isArray(l4) ? l4 : (l4 as any)?.data ?? [];

        // 🔥 use options instead of options$
        this.formConfig.fields.find(f => f.key === 'cncL3Id')!.options =
          l3Arr.map((x: any) => ({ label: x.name, value: x.id }));

        this.formConfig.fields.find(f => f.key === 'cncL4Id')!.options =
          l4Arr.map((x: any) => ({ label: x.name, value: x.id }));

        this.formData = {
          cncL3Id: row.cncL3Id,
          cncL4Id: row.cncL4Id,
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
      cncL3Id: payload.cncL3Id,
      cncL4Id: payload.cncL4Id,
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
