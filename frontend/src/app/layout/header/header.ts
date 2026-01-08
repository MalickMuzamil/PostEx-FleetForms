import { Component, EventEmitter, Output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-header',
  imports: [NzIconModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  @Output() toggle = new EventEmitter<void>();
}
