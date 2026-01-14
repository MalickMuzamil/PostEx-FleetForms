import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncL5 } from './cnc-l5';

describe('CncL5', () => {
  let component: CncL5;
  let fixture: ComponentFixture<CncL5>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncL5]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncL5);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
