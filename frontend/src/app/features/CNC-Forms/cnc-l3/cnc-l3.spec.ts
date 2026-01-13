import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncL3 } from './cnc-l3';

describe('CncL3', () => {
  let component: CncL3;
  let fixture: ComponentFixture<CncL3>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncL3]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncL3);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
