import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class OpsCncL2L3MappingService {

  private endpoint = '/cnc-l2-l3-mapping';

  constructor(private api: GeneralService) { }

  /* ========================
     CRUD – Mapping
  ========================= */

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

  /* ========================
     Dropdown Data
  ========================= */

  getCnCL2List(): any {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l2`);
  }

  getCnCL3List(): any {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l3`);
  }

}
