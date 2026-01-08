import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [NzResultModule, NzButtonModule],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.css',
})
export class Forbidden {
  constructor(private router: Router) {}
  goHome() {
    this.router.navigate(['/users']);
  }
}
