import { Component, EventEmitter, Output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../../core/services/auth-service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NzIconModule, NzDropDownModule, NzAvatarModule, NzMenuModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  @Output() toggle = new EventEmitter<void>();

  user = JSON.parse(localStorage.getItem('UserData') || '{}');

  get avatarUrl(): string {
    return this.user?.image || 'assets/images/Avatar.jpg';
  }

  constructor(private auth: AuthService) { }

  logout() {
    this.auth.logout();
  }
}
