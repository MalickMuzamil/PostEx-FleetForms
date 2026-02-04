import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class OpsCncL5L6MappingService {

  private endpoint = '/cnc-l5-l6-mapping';

  constructor(private api: GeneralService) {}

  getAll() {
    return this.api.get<any[]>(this.endpoint);
  }

  getById(id: number) {
    return this.api.get<any>(`${this.endpoint}/${id}`);
  }

  create(payload: any) {
    return this.api.post(this.endpoint, payload);
  }

  update(id: number, payload: any) {
    return this.api.put(`${this.endpoint}/${id}`, payload);
  }

  getCnCL5List(): any {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l5`);
  }

  getCnCL6List(): any {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l6`);
  }

}