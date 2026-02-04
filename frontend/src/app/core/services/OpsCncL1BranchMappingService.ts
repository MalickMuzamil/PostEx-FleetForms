import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class OpsCncL1BranchMappingService {

  private endpoint = '/cnc-l1-branch-mapping';

  constructor(private api: GeneralService) {}

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

  getBranches() {
    return this.api.get<any[]>(`${this.endpoint}/branches`);
  }

  getCnCL1List() {
    return this.api.get<any[]>(`${this.endpoint}/cnc-l1`);
  }

}
