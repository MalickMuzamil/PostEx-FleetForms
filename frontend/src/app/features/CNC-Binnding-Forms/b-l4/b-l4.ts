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
  l3Map: Record<number, string> = {};
  l4Map: Record<number, string> = {};

  constructor(
    private service: OpsCncL3L4MappingService,
    private notification: NzNotificationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;

    forkJoin({
      data: this.service.getAll(),
      l3: this.service.getCnCL3List(),
      l4: this.service.getCnCL4List()
    }).subscribe({
      next: (res: any) => {

        const rows = Array.isArray(res.data)
          ? res.data
          : (res.data?.data ?? []);

        const l3Arr = Array.isArray(res.l3)
          ? res.l3
          : (res.l3?.data ?? []);

        const l4Arr = Array.isArray(res.l4)
          ? res.l4
          : (res.l4?.data ?? []);

        this.l3Map = {};
        l3Arr.forEach((x: any) => {
          this.l3Map[x.id] = x.name;
        });

        this.l4Map = {};
        l4Arr.forEach((x: any) => {
          this.l4Map[x.id] = x.name;
        });

        this.rows = rows.map((r: any) => ({
          ...r,
          cncL3Name: this.l3Map[r.cncL3Id] || r.cncL3Id,
          cncL4Name: this.l4Map[r.cncL4Id] || r.cncL4Id,
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

    const l3Lock = this.formConfig.fields.find(f => f.key === 'cncL3Id');
    if (l3Lock) l3Lock.disabled = false;

    forkJoin({
      l3: this.service.getCnCL3List(),
      l4: this.service.getCnCL4List(),
    }).subscribe({
      next: ({ l3, l4 }) => {

        const l3Arr = Array.isArray(l3) ? l3 : (l3 as any)?.data ?? [];
        const l4Arr = Array.isArray(l4) ? l4 : (l4 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL3Id')!.options$ =
          of(l3Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

        this.formConfig.fields.find(f => f.key === 'cncL4Id')!.options$ =
          of(l4Arr.map((x: any) => ({
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

    const l3Lock = this.formConfig.fields.find(f => f.key === 'cncL3Id');
    if (l3Lock) l3Lock.disabled = true;

    forkJoin({
      l3: this.service.getCnCL3List(),
      l4: this.service.getCnCL4List(),
    }).subscribe({
      next: ({ l3, l4 }) => {

        const l3Arr = Array.isArray(l3) ? l3 : (l3 as any)?.data ?? [];
        const l4Arr = Array.isArray(l4) ? l4 : (l4 as any)?.data ?? [];

        this.formConfig.fields.find(f => f.key === 'cncL3Id')!.options$ =
          of(l3Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

        this.formConfig.fields.find(f => f.key === 'cncL4Id')!.options$ =
          of(l4Arr.map((x: any) => ({
            label: x.name,
            value: x.id,
            searchText: `${x.id} ${x.name} ${x.desc}`.trim(),
            meta: { id: x.id, name: x.name, desc: x.desc }
          })));

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
