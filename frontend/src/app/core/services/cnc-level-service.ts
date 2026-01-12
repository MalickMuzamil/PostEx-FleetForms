import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class CncLevelService {
  private endpoint = '/cnc-level';

  constructor(private api: GeneralService) {}

  create(payload: any) {
    return this.api.post(this.endpoint, payload);
  }

  update(id: number, payload: any) {
    return this.api.put(`${this.endpoint}/${id}`, payload);
  }

  delete(id: number) {
    return this.api.delete(`${this.endpoint}/${id}`);
  }

  getAll() {
    return this.api.get<any>(this.endpoint);
  }

  getAreas() {
    return this.api.get<any>(`${this.endpoint}/areas`);
  }

  getSubAreas(areaId: number) {
    return this.api.get<any>(`${this.endpoint}/sub-areas?areaId=${areaId}`);
  }

  getZones() {
    return this.api.get<any>(`${this.endpoint}/zones`);
  }

  getSubZones(zoneId: number) {
    return this.api.get<any>(`${this.endpoint}/sub-zones?zoneId=${zoneId}`);
  }

  getRegions() {
    return this.api.get<any>(`${this.endpoint}/regions`);
  }
}
