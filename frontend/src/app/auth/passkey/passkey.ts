import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-passkey',
  standalone: true,
  imports: [
    CommonModule,
    NzCardModule,
    NzButtonModule,
    NzAlertModule,
    NzIconModule,
  ],
  templateUrl: './passkey.html',
  styleUrl: './passkey.css',
})
export class Passkey {
  enabling = false;

  // ✅ default: dont allow leaving passkey page
  allowLeave = false;

  constructor(
    private router: Router,
    private msg: NzMessageService
  ) {}

  ngOnInit(): void {
    // ✅ put an extra entry so back doesn't escape to otp/login
    history.pushState(null, '', location.href);
  }

  @HostListener('window:popstate')
  onBrowserBack() {
    // ✅ STRICT: if not allowed to leave, keep user on passkey
    if (!this.allowLeave) {
      history.pushState(null, '', location.href);
      this.router.navigateByUrl('/auth/passkey', { replaceUrl: true });
    }
  }

  skipForNow() {
    sessionStorage.removeItem('auth.loginDone');
    sessionStorage.removeItem('auth.otpVerified');

    this.allowLeave = true; // ✅ now allow navigation
    this.router.navigateByUrl('/', { replaceUrl: true });
  }

  enablePasskey() {
    this.enabling = true;

    setTimeout(() => {
      this.enabling = false;
      this.msg.success('Passkey enabled (UI only)');

      sessionStorage.removeItem('auth.loginDone');
      sessionStorage.removeItem('auth.otpVerified');

      this.allowLeave = true; // ✅ now allow navigation
      this.router.navigateByUrl('/', { replaceUrl: true });
    }, 600);
  }
}
