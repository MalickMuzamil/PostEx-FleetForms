import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Table } from '../../../ui/table/table';
import { Modal } from '../../../ui/modal/modal';
import { of, forkJoin } from 'rxjs';

import {
  OPS_CNC_L5_L6_MAPPING_FORM,
  OPS_CNC_L5_L6_MAPPING_TABLE,
} from './b-l6-config';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { OpsCncL5L6MappingService } from '../../../core/services/OpsCncL5L6MappingService';

@Component({
  selector: 'app-b-l6',
  standalone: true,
  imports: [Table, Modal, CommonModule],
  templateUrl: './b-l6.html',
  styleUrl: './b-l6.css',
})
export class BL6 implements OnInit {
  formConfig = OPS_CNC_L5_L6_MAPPING_FORM;
  tableConfig = OPS_CNC_L5_L6_MAPPING_TABLE;

  rows: any[] = [];
  loading = false;
  submitting = false;

  showForm = false;
  isEdit = false;
  selectedId: number | null = null;

  formData: any = {};
  addLoading = false;
  l5Map: Record<number, string> = {};
  l6Map: Record<number, string> = {};

  constructor(
    private service: OpsCncL5L6MappingService,
    private notification: NzNotificationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;

    forkJoin({
      data: this.service.getAll(),
      l5: this.service.getCnCL5List(),
      l6: this.service.getCnCL6List()
    }).subscribe({
      next: (res: any) => {

        const rows = Array.isArray(res.data)
          ? res.data
          : (res.data?.data ?? []);

        const l5Arr = Array.isArray(res.l5)
          ? res.l5
          : (res.l5?.data ?? []);

        const l6Arr = Array.isArray(res.l6)
          ? res.l6
          : (res.l6?.data ?? []);

        this.l5Map = {};
        l5Arr.forEach((x: any) => {
          this.l5Map[x.id] = x.name;
        });

        this.l6Map = {};
        l6Arr.forEach((x: any) => {
          this.l6Map[x.id] = x.name;
        });

        this.rows = rows.map((r: any) => ({
          ...r,
          cncL5Name: this.l5Map[r.cncL5Id] || r.cncL5Id,
          cncL6Name: this.l6Map[r.cncL6Id] || r.cncL6Id,
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

    const l5Lock = this.formConfig.fields.find(f => f.key === 'cncL5Id');
    if (l5Lock) l5Lock.disabled = false;

    forkJoin({
      l5: this.service.getCnCL5List(),
      l6: this.service.getCnCL6List(),
    }).subscribe({
      next: ({ l5, l6 }) => {

        const l5Arr = Array.isArray(l5) ? l5 : (l5 as any)?.data ?? [];
        const l6Arr = Array.isArray(l6) ? l6 : (l6 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL5Id')!.options$ =
          of(l5Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

        this.formConfig.fields.find(f => f.key === 'cncL6Id')!.options$ =
          of(l6Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

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

    const l5Lock = this.formConfig.fields.find(f => f.key === 'cncL5Id');
    if (l5Lock) l5Lock.disabled = true;

    forkJoin({
      l5: this.service.getCnCL5List(),
      l6: this.service.getCnCL6List(),
    }).subscribe({
      next: ({ l5, l6 }) => {

        const l5Arr = Array.isArray(l5) ? l5 : (l5 as any)?.data ?? [];
        const l6Arr = Array.isArray(l6) ? l6 : (l6 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL5Id')!.options$ =
          of(l5Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

        this.formConfig.fields.find(f => f.key === 'cncL6Id')!.options$ =
          of(l6Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

        this.formData = {
          cncL5Id: row.cncL5Id,
          cncL6Id: row.cncL6Id,
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
      cncL5Id: payload.cncL5Id,
      cncL6Id: payload.cncL6Id,
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
