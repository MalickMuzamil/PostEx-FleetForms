import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';

import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

import { CNC_LEVEL_FORM, CNC_LEVEL_TABLE } from './cnc-level-component-config';
import { CncLevelService } from '../../core/services/cnc-level-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cnc-level',
  standalone: true,
  imports: [Table, Modal, NzModalModule, CommonModule],
  templateUrl: './cnc-level.html',
  styleUrl: './cnc-level.css',
})
export class CncLevel implements OnInit{
  // configs
  formConfig: any = { ...CNC_LEVEL_FORM };
  tableConfig = CNC_LEVEL_TABLE;

  // state
  showModal = false;
  data: any = {};
  tableData: any[] = [];

  // dropdown data
  areas: any[] = [];
  zones: any[] = [];
  regions: any[] = [];

  // cached for duplicate checks (frontend)
  existingAreas: string[] = [];
  existingZones: string[] = [];
  existingRegions: string[] = [];

  // (optional) if backend provides these lists
  existingSubAreasByArea: Record<number, string[]> = {};
  existingSubZonesByZone: Record<number, string[]> = {};

  // edit
  isEditMode = false;
  editingRow: any = null;

  constructor(
    private service: CncLevelService,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) {}

  ngOnInit(): void {
    this.loadTable();
    this.loadMasters();
    this.patchFormOptions();
  }

  // ================= TABLE =================
  loadTable() {
    this.service.getAll().subscribe({
      next: (rows: any[]) => {
        this.tableData = (rows || []).map((r: any) => ({
          id: r.ID ?? r.Id ?? r.id,
          cncLevelId: r.CncLevelID ?? r.CNCLevelID ?? r.cncLevelId ?? r.id,

          levelType: r.LevelType ?? r.levelType,
          levelTypeText: this.typeText(r.LevelType ?? r.levelType),

          term: r.Term ?? r.term ?? r.Name ?? r.name,

          areaId: r.AreaID ?? r.areaId,
          areaName: r.AreaName ?? r.areaName ?? '',

          zoneId: r.ZoneID ?? r.zoneId,
          zoneName: r.ZoneName ?? r.zoneName ?? '',

          regionId: r.RegionID ?? r.regionId,
          regionName: r.RegionName ?? r.regionName ?? '',
        }));
      },
      error: () =>
        this.notification.error('Error', 'Failed to load CNC Levels'),
    });
  }

  private typeText(t: string) {
    const v = String(t || '').toUpperCase();
    if (v === 'AREA') return 'Area';
    if (v === 'SUB_AREA') return 'Sub-Area';
    if (v === 'ZONE') return 'Zone';
    if (v === 'SUB_ZONE') return 'Sub-Zone';
    if (v === 'REGION') return 'Region';
    return 'Other';
  }

  // ================= MASTERS =================
  loadMasters() {
    // Areas
    this.service.getAreas().subscribe({
      next: (rows: any[]) => {
        this.areas = (rows || []).map((x: any) => ({
          value: Number(x.ID ?? x.Id ?? x.id),
          label: String(x.Name ?? x.AreaName ?? x.name ?? '').trim(),
          id: Number(x.ID ?? x.Id ?? x.id),
          name: String(x.Name ?? x.AreaName ?? x.name ?? '').trim(),
        }));
        this.existingAreas = this.areas.map((a) => a.name.toLowerCase());
        this.patchFormOptions();
      },
    });

    // Zones
    this.service.getZones().subscribe({
      next: (rows: any[]) => {
        this.zones = (rows || []).map((x: any) => ({
          value: Number(x.ID ?? x.Id ?? x.id),
          label: String(x.Name ?? x.ZoneName ?? x.name ?? '').trim(),
          id: Number(x.ID ?? x.Id ?? x.id),
          name: String(x.Name ?? x.ZoneName ?? x.name ?? '').trim(),
        }));
        this.existingZones = this.zones.map((z) => z.name.toLowerCase());
        this.patchFormOptions();
      },
    });

    // Regions
    this.service.getRegions().subscribe({
      next: (rows: any[]) => {
        this.regions = (rows || []).map((x: any) => ({
          value: Number(x.ID ?? x.Id ?? x.id),
          label: String(x.Name ?? x.RegionName ?? x.name ?? '').trim(),
          id: Number(x.ID ?? x.Id ?? x.id),
          name: String(x.Name ?? x.RegionName ?? x.name ?? '').trim(),
        }));
        this.existingRegions = this.regions.map((r) => r.name.toLowerCase());
        this.patchFormOptions();
      },
    });
  }

  // ================= PATCH OPTIONS =================
  private patchFormOptions() {
    const base = CNC_LEVEL_FORM;

    this.formConfig = {
      ...this.formConfig,
      title: this.formConfig?.title ?? base.title,
      fields: base.fields.map((f: any) => {
        if (f.key === 'areaId') {
          return { ...f, options$: of(this.areas ?? []) };
        }
        if (f.key === 'zoneId') {
          return { ...f, options$: of(this.zones ?? []) };
        }
        if (f.key === 'regionId') {
          return { ...f, options$: of(this.regions ?? []) };
        }
        return f;
      }),
    };
  }

  // ================= MODAL =================
  openAddForm() {
    this.isEditMode = false;
    this.editingRow = null;

    this.data = {
      cncLevelId: null,
      levelType: 'AREA',
      term: '',
      areaId: null,
      zoneId: null,
      regionId: null,
    };

    this.showModal = true;
    this.formConfig = { ...CNC_LEVEL_FORM, title: 'Add CNC Level' };
    this.patchFormOptions();
    this.data = { ...this.data };
  }

  openEditForm(row: any) {
    this.isEditMode = true;
    this.editingRow = row;

    this.data = {
      cncLevelId: row.cncLevelId,
      levelType: row.levelType,
      term: row.term,
      areaId: row.areaId ?? null,
      zoneId: row.zoneId ?? null,
      regionId: row.regionId ?? null,
    };

    this.showModal = true;
    this.formConfig = { ...CNC_LEVEL_FORM, title: 'Edit CNC Level' };
    this.patchFormOptions();
    this.data = { ...this.data };
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= FORM CHANGE =================
  onFormChange(evt: { key: string; value: any; formValue: any }) {
    // merge form changes (works with __form__ too)
    if (evt?.formValue) this.data = { ...this.data, ...evt.formValue };
    if (evt?.key && evt.key !== '__form__')
      this.data = { ...this.data, [evt.key]: evt.value };

    // type change -> reset parents
    if (evt.key === 'levelType') {
      this.data = {
        ...this.data,
        areaId: null,
        zoneId: null,
        regionId: null,
      };
      return;
    }
  }

  // ================= FRONTEND DUPLICATE CHECK =================
  private isDuplicatePredefined(payload: any): {
    ok: boolean;
    message?: string;
  } {
    const type = String(payload.levelType || '').toUpperCase();
    const term = String(payload.term || '')
      .trim()
      .toLowerCase();

    if (!term) return { ok: false, message: 'Please enter a value.' };

    // OTHER => allow (optional: check duplicate custom)
    if (type === 'OTHER') return { ok: true };

    if (type === 'AREA') {
      if (this.existingAreas.includes(term))
        return {
          ok: false,
          message: 'The Area already exists. Please provide a different Area.',
        };
      return { ok: true };
    }

    if (type === 'ZONE') {
      if (this.existingZones.includes(term))
        return {
          ok: false,
          message: 'The Zone already exists. Please provide a different Zone.',
        };
      return { ok: true };
    }

    if (type === 'REGION') {
      if (this.existingRegions.includes(term))
        return {
          ok: false,
          message:
            'The Region already exists. Please provide a different Region.',
        };
      return { ok: true };
    }

    if (type === 'SUB_AREA') {
      const areaId = Number(payload.areaId) || null;
      if (!areaId)
        return { ok: false, message: 'Please select Area for Sub-Area.' };

      const list = this.existingSubAreasByArea[areaId] || [];
      if (list.includes(term))
        return {
          ok: false,
          message:
            'The Sub-Area already exists. Please provide a different Sub-Area.',
        };
      return { ok: true };
    }

    if (type === 'SUB_ZONE') {
      const zoneId = Number(payload.zoneId) || null;
      if (!zoneId)
        return { ok: false, message: 'Please select Zone for Sub-Zone.' };

      const list = this.existingSubZonesByZone[zoneId] || [];
      if (list.includes(term))
        return {
          ok: false,
          message:
            'The Sub-Zone already exists. Please provide a different Sub-Zone.',
        };
      return { ok: true };
    }

    return { ok: true };
  }

  // ================= SUBMIT =================
  onSubmit(formValue: any) {
    const payload = {
      levelType: String(formValue?.levelType || '').toUpperCase(),
      term: String(formValue?.term ?? '').trim(),

      areaId: Number(formValue?.areaId) || null,
      zoneId: Number(formValue?.zoneId) || null,
      regionId: Number(formValue?.regionId) || null,
    };

    // ✅ frontend validation (dup)
    const dup = this.isDuplicatePredefined(payload);
    if (!dup.ok) {
      this.notification.error('Duplicate', dup.message || 'Duplicate found');
      return;
    }

    // EDIT
    if (this.isEditMode && this.editingRow?.id) {
      this.service.update(Number(this.editingRow.id), payload).subscribe({
        next: () => {
          this.notification.success('Success', 'Updated successfully');
          this.showModal = false;
          this.loadTable();
          this.loadMasters(); // refresh lists for dup check
        },
        error: () => this.notification.error('Error', 'Update failed'),
      });
      return;
    }

    // CREATE
    this.service.create(payload).subscribe({
      next: () => {
        this.notification.success('Success', 'Saved successfully');
        this.showModal = false;
        this.loadTable();
        this.loadMasters(); // refresh lists for dup check
      },
      error: () => this.notification.error('Error', 'Save failed'),
    });
  }

  // ================= ACTIONS =================
  delete(row: any) {
    this.modal.confirm({
      nzTitle: 'Delete Confirmation',
      nzContent: 'Are you sure you want to delete this entry?',
      nzOkText: 'Yes, Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.service.delete(Number(row.id)).subscribe({
          next: () => {
            this.notification.success('Deleted', 'Deleted successfully');
            this.loadTable();
            this.loadMasters();
          },
          error: () => this.notification.error('Error', 'Delete failed'),
        });
      },
    });
  }
}
