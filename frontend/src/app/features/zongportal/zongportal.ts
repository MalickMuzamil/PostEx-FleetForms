import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environment/environment';

@Component({
  selector: 'app-zongportal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './zongportal.html',
  styleUrl: './zongportal.css',
})
export class Zongportal implements OnInit {
  isLoading = true;
  responseData: any = null;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchZongportalData();
  }

  fetchZongportalData() {
    this.isLoading = true;
    this.error = null;

    // Dummy endpoint - replace with actual endpoint when provided
    const endpoint = `${environment.apiBaseUrl}/zongportal/dummy`;

    this.http.get(endpoint).subscribe({
      next: (data) => {
        console.log('Zongportal Response:', data);
        this.responseData = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Zongportal Error:', err);
        this.error = err?.message || 'Failed to fetch data';
        this.isLoading = false;
      },
    });
  }
}