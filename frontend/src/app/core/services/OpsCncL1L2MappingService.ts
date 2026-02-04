import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class OpsCncL1L2MappingService {

  private endpoint = '/cnc-l1-l2-mapping';

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

  getCnCL1List() {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l1`);
  }

  getCnCL2List() {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l2`);
  }

}