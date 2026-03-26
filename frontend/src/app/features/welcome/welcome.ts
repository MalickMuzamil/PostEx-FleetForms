import { Component, OnInit } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome',
  imports: [NzCardModule, CommonModule],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',  
})
export class Welcome implements OnInit {
  isPageLoading = true;

  ngOnInit(): void {
    setTimeout(() => {
      this.isPageLoading = false;
    }, 450);
  }
}
