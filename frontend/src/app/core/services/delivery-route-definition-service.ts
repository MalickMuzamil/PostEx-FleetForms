import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DeliveryRouteDefinitionService {
  private baseUrl = '/delivery-routes';

  constructor(private api: GeneralService) {}

  getAll() {
    return this.api.get(this.baseUrl);
  }

  create(body: any) {
    return this.api.post(this.baseUrl, body);
  }

  update(id: number, payload: any): Observable<any> {
    return this.api.put<any>(`${this.baseUrl}/${id}`, payload);
  }
}
