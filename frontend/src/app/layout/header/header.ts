import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../../core/services/auth-service';
import { Router } from '@angular/router';

type PostexUser = {
  login?: boolean;
  userName?: string;
  name?: string;
  email?: string;
  realm?: string;
  apps?: string[];
  roles?: string[];
  token_type?: string;
  auth_method?: string;
  image?: string;
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzDropDownModule, NzAvatarModule, NzMenuModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  @Output() toggle = new EventEmitter<void>();

  user: PostexUser = this.getPostexUser();

  private getPostexUser(): PostexUser {
    try {
      return JSON.parse(localStorage.getItem('postex.user') || '{}');
    } catch {
      return {};
    }
  }

  get avatarUrl(): string {
    return this.user?.image || 'assets/images/Avatar.jpg';
  }

  get rolesText(): string {
    const roles = this.user?.roles || [];
    return roles.length ? roles.join(', ') : '-';
  }

  constructor(private auth: AuthService, private router: Router) {}

  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }

  logout() {
    this.auth.logout();
  }

  goToUsers() {
    this.router.navigate(['/users']);
  }
}
