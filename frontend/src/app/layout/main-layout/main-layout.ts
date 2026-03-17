import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { SidebarComponent } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  imports: [NzLayoutModule, SidebarComponent, Header, RouterOutlet, CommonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  isCollapsed = false;
  mobileSidebarOpen = false;

  toggleSidebar() {
    if (window.innerWidth < 992) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
      return;
    }

    this.isCollapsed = !this.isCollapsed;
  }

  closeMobileSidebar() {
    this.mobileSidebarOpen = false;
  }

  handleSidebarClose() {
    if (window.innerWidth < 992) {
      this.mobileSidebarOpen = false;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 992) {
      this.mobileSidebarOpen = false;
    }
  }
}
