import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BL3 } from './b-l3';

describe('BL3', () => {
  let component: BL3;
  let fixture: ComponentFixture<BL3>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BL3]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BL3);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
