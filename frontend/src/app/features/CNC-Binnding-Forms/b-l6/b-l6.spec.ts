import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BL6 } from './b-l6';

describe('BL6', () => {
  let component: BL6;
  let fixture: ComponentFixture<BL6>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BL6]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BL6);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
