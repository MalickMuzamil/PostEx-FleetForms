import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './core/services/auth-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('postex-fleetforms');

  //Will remove in future.
  constructor(private authService: AuthService) {
    this.authService.verifyToken().subscribe({
      error: () => {},
    });
  }
}
