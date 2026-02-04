import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BL2 } from './b-l2';

describe('BL2', () => {
  let component: BL2;
  let fixture: ComponentFixture<BL2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BL2]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BL2);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
