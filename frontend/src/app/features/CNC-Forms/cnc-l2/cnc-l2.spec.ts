import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncL2 } from './cnc-l2';

describe('CncL2', () => {
  let component: CncL2;
  let fixture: ComponentFixture<CncL2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncL2]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncL2);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
