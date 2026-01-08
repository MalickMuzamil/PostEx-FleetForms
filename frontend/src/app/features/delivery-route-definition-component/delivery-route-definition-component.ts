import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DELIVERY_ROUTE_DEFINITION_FORM,
  DELIVERY_ROUTE_DEFINITION_TABLE,
} from './delivery-route-definition-config';
import { DeliveryRouteDefinitionService } from '../../core/services/delivery-route-definition-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';

@Component({
  selector: 'app-delivery-route-definition',
  standalone: true,
  imports: [CommonModule, Table, Modal],
  templateUrl: './delivery-route-definition-component.html',
})
export class DeliveryRouteDefinitionComponent implements OnInit {
  formConfig = { ...DELIVERY_ROUTE_DEFINITION_FORM };
  tableConfig = DELIVERY_ROUTE_DEFINITION_TABLE;

  showModal = false;
  data: any = {};
  tableData: any[] = [];

  constructor(
    private service: DeliveryRouteDefinitionService,
    private notification: NzNotificationService
  ) {}

  ngOnInit() {
    this.loadTable();
  }

  loadTable() {
    this.service.getAll().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];

      this.tableData = rows.map((r: any) => ({
        id: r.Id,
        Id: r.Id,
        CorrectionDescriptionforReports: r.CorrectionDescriptionforReports,
      }));
    });
  }

  openAddForm() {
    this.data = { routeId: null, routeDescription: '' };
    this.formConfig = { ...this.formConfig, mode: 'create' };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  onSubmit(payload: any) {
    const now = new Date().toISOString();
    const user =
      localStorage.getItem('userName') ||
      localStorage.getItem('username') ||
      localStorage.getItem('name') ||
      'Admin';

    const body: any = {
      routeDescription: payload.routeDescription,
      enteredOn: now,
      enteredBy: user,
    };

    this.service.create(body).subscribe({
      next: () => {
        this.notification.success('Success', 'Saved successfully');
        this.showModal = false;
        this.loadTable();
      },
      error: (err) => {
        if (err?.status === 409) {
          this.notification.error(
            'Duplicate',
            err?.error?.message ||
              'The Delivery Route Description already exists.'
          );
          return;
        }

        this.notification.error(
          'Error',
          err?.error?.message || 'Something went wrong'
        );
      },
    });
  }

  delete(row: any) {
    if (!confirm('Delete this record?')) return;

    this.service.delete(row.id).subscribe({
      next: () => {
        this.notification.success('Deleted', 'Record deleted');
        this.loadTable();
      },
      error: () => this.notification.error('Error', 'Something went wrong'),
    });
  }
}
