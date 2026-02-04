import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class OpsCncL4L5MappingService {

  private endpoint = '/cnc-l4-l5-mapping';

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

  getCnCL4List(): any {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l4`);
  }

  getCnCL5List(): any {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l5`);
  }

}
