import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { DynamicForm } from '../dynamic-form/dynamic-form';
import { FormConfig } from '../../shared/form-model/dynamic-form-model';

@Component({
  selector: 'app-modal',
  imports: [CommonModule, NzModalModule, DynamicForm],
  standalone: true,
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  @Input() visible = false;
  @Input() title = '';
  @Input() formConfig!: FormConfig;
  @Input() data: any = {};

  @Output() submit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @Output() formChange = new EventEmitter<{ key: string; value: any; formValue: any }>();

  handleCancel() {
    this.cancel.emit();
  }

  handleSubmit(payload: any) {
    this.submit.emit(payload);
  }
}
