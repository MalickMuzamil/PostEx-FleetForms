import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('postex-fleetforms');

  constructor(private authService: AuthService) {
    this.checkTokenAndSession();
  }

  private checkTokenAndSession() {
    const token =
      localStorage.getItem('postex.access_token') ||
      localStorage.getItem('postex-auth-token');

    if (!token) {
      this.authService.setAuthenticated(false);
      return;
    }

    if (this.authService.isTokenExpired(token)) {
      this.authService.logout();
      return;
    }
    this.authService.setAuthenticated(true);
  }
}
