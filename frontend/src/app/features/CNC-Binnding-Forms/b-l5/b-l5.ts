import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';
import { of, forkJoin } from 'rxjs';

import {
  OPS_CNC_L4_L5_MAPPING_FORM,
  OPS_CNC_L4_L5_MAPPING_TABLE,
} from './b-l5-config';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { OpsCncL4L5MappingService } from '../../../core/services/OpsCncL4L5MappingService';


@Component({
  selector: 'app-b-l5',
  standalone: true,
  imports: [Table, Modal, CommonModule],
  templateUrl: './b-l5.html',
  styleUrl: './b-l5.css',
})
export class BL5 implements OnInit {
  formConfig = OPS_CNC_L4_L5_MAPPING_FORM;
  tableConfig = OPS_CNC_L4_L5_MAPPING_TABLE;

  rows: any[] = [];
  loading = false;
  submitting = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};
  addLoading = false;

  constructor(
    private service: OpsCncL4L5MappingService,
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
      l4: this.service.getCnCL4List(),
      l5: this.service.getCnCL5List(),
    }).subscribe({
      next: ({ l4, l5 }) => {

        const l4Arr = Array.isArray(l4) ? l4 : (l4 as any)?.data ?? [];
        const l5Arr = Array.isArray(l5) ? l5 : (l5 as any)?.data ?? [];

        const l4Field = this.formConfig.fields.find(f => f.key === 'cncL4Id');
        if (l4Field) {
          l4Field.options$ = of(
            l4Arr.map((x: any) => ({
              label: x.name,
              value: x.id,
              meta: x
            }))
          );
        }

        const l5Field = this.formConfig.fields.find(f => f.key === 'cncL5Id');
        if (l5Field) {
          l5Field.options$ = of(
            l5Arr.map((x: any) => ({
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
      l4: this.service.getCnCL4List(),
      l5: this.service.getCnCL5List(),
    }).subscribe({
      next: ({ l4, l5 }) => {

        const l4Arr = Array.isArray(l4) ? l4 : (l4 as any)?.data ?? [];
        const l5Arr = Array.isArray(l5) ? l5 : (l5 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL4Id')!.options =
          l4Arr.map((x: any) => ({
            label: x.name,
            value: x.id
          }));

        this.formConfig.fields.find(f => f.key === 'cncL5Id')!.options =
          l5Arr.map((x: any) => ({
            label: x.name,
            value: x.id
          }));

        this.formData = {
          cncL4Id: row.cncL4Id,
          cncL5Id: row.cncL5Id,
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
      cncL4Id: payload.cncL4Id,
      cncL5Id: payload.cncL5Id,
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
