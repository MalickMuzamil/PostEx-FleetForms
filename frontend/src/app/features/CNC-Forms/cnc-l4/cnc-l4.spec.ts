import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncL4 } from './cnc-l4';

describe('CncL4', () => {
  let component: CncL4;
  let fixture: ComponentFixture<CncL4>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncL4]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncL4);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
