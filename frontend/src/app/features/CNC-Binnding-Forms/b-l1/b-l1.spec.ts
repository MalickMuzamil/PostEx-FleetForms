import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BL1 } from './b-l1';

describe('BL1', () => {
  let component: BL1;
  let fixture: ComponentFixture<BL1>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BL1]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BL1);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
