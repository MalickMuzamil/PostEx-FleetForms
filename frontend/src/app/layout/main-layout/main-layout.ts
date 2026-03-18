import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { SidebarComponent } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, filter } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [NzLayoutModule, SidebarComponent, Header, RouterOutlet, CommonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit, OnDestroy {
  isCollapsed = false;
  mobileSidebarOpen = false;

  private destroy$ = new Subject<void>();

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (window.innerWidth < 992) {
          this.mobileSidebarOpen = false;
        }
      });
  }

  toggleSidebar() {
    if (window.innerWidth < 992) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
      return;
    }

    this.isCollapsed = !this.isCollapsed;

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));

      document.body.style.zoom = '1.0001';
      setTimeout(() => {
        document.body.style.zoom = '1';
      }, 50);

    }, 260);
  }

  closeMobileSidebar() {
    this.mobileSidebarOpen = false;
  }

  handleSidebarClose() {
    if (window.innerWidth < 992) {
      this.mobileSidebarOpen = false;
    } else {
      this.isCollapsed = !this.isCollapsed;

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 260);
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 992) {
      this.mobileSidebarOpen = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}