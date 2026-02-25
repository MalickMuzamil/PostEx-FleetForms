import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkView } from './bulk-view';

describe('BulkView', () => {
  let component: BulkView;
  let fixture: ComponentFixture<BulkView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
