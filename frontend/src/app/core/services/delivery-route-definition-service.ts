import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

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

  delete(id: number) {
    return this.api.delete(`${this.baseUrl}/${id}`);
  }
}