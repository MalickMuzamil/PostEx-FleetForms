import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BL5 } from './b-l5';

describe('BL5', () => {
  let component: BL5;
  let fixture: ComponentFixture<BL5>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BL5]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BL5);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
