import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, NzMenuModule, NzIconModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent implements OnChanges{
  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  cncOpen = false;
  bindingOpen = false;

  ngOnChanges() {
  if (this.collapsed) {
    this.cncOpen = false;
    this.bindingOpen = false;
  }
}
}
