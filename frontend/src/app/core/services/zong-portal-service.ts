import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class ZongPortalService {
  private readonly baseUrl = '/zong-portal';
  private readonly zongUrl = 'https://cap.zong.com.pk:8444/vpbx-apis/customApi/vpbx-custom-apis';

  constructor(
    private api: GeneralService,
    private http: HttpClient
  ) {}

  getAll(): Observable<any> {
    return this.api.get<any>(this.baseUrl);
  }

  fetchFromZong(payload: any): Observable<any> {
    return this.http.post<any>(this.zongUrl, payload);
  }

  create(payload: any): Observable<any> {
    return this.api.post<any>(this.baseUrl, payload);
  }

  update(id: number, payload: any): Observable<any> {
    return this.api.put<any>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<any> {
    return this.api.delete<any>(`${this.baseUrl}/${id}`);
  }
}