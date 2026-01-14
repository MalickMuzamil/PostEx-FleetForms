import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncL6 } from './cnc-l6';

describe('CncL6', () => {
  let component: CncL6;
  let fixture: ComponentFixture<CncL6>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncL6]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncL6);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
