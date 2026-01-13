import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncL1 } from './cnc-l1';

describe('CncL1', () => {
  let component: CncL1;
  let fixture: ComponentFixture<CncL1>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncL1]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncL1);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
