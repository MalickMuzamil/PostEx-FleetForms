import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AuthService } from '../../core/services/auth-service';

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

  allowLeave = false;

  constructor(
    private router: Router,
    private msg: NzMessageService,
     private auth: AuthService
  ) { }

  ngOnInit(): void {
    history.pushState(null, '', location.href);
  }

  @HostListener('window:popstate')
  onBrowserBack() {
    if (!this.allowLeave) {
      history.pushState(null, '', location.href);
      this.router.navigateByUrl('/auth/passkey', { replaceUrl: true });
    }
  }

  skipForNow() {
    sessionStorage.removeItem('auth.loginDone');
    sessionStorage.removeItem('auth.otpVerified');
    this.auth.setPasskeyEnabled(false);

    this.allowLeave = true; 
    this.router.navigateByUrl('/', { replaceUrl: true });
  }

 async enablePasskey() {
  this.enabling = true;

  try {
    const email = this.auth.getOtpEmail(); 
    if (!email) throw new Error('Email missing');

    await this.auth.registerPasskey(email);
    this.auth.setPasskeyEnabled(true);

    this.msg.success('Passkey enabled');

    sessionStorage.removeItem('auth.loginDone');
    sessionStorage.removeItem('auth.otpVerified');

    this.allowLeave = true;
    this.router.navigateByUrl('/', { replaceUrl: true });
  } catch (e: any) {
    this.msg.error(e?.message || 'Passkey setup failed');
  } finally {
    this.enabling = false;
  }
}

}
