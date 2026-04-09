import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth-service';

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

  constructor(private auth: AuthService) {}

  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }

  get isCS(): boolean {
    return this.auth.hasRole('CS');
  }

  get isHR(): boolean {
    return this.auth.hasRole('HR');
  }

  get isIT(): boolean {
    return this.auth.hasRole('IT');
  }

  get isUser(): boolean {
    return this.auth.hasRole('USER');
  }

  get canAccessFakeAttempts(): boolean {
    return this.isAdmin || this.isCS;
  }

  get canAccessAttendance(): boolean {
    return this.isAdmin || this.isHR;
  }

  get canAccessCallLogs(): boolean {
    return this.isAdmin || this.isIT;
  }

  get canAccessCommon(): boolean {
    // admin or plain users (non-CS/HR) can access all common forms
    const isPlainUser = this.isUser && !this.isCS && !this.isHR;
    return this.isAdmin || isPlainUser;
  }

  ngOnChanges() {
    if (this.collapsed) {
      this.cncOpen = false;
      this.bindingOpen = false;
    }
  }
}
