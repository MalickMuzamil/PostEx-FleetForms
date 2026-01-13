import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class OpsCnCL2DefinitionService {
  private baseUrl = '/cnc-level2';

  constructor(private api: GeneralService) {}

  getAll() {
    return this.api.get(this.baseUrl);
  }

  getRoles() {
    return this.api.get(`${this.baseUrl}/roles`);
  }

  create(body: any) {
    return this.api.post(this.baseUrl, body);
  }

  update(id: number, body: any) {
    return this.api.put(`${this.baseUrl}/${id}`, body);
  }

  delete(id: number) {
    return this.api.delete(`${this.baseUrl}/${id}`);
  }
}
