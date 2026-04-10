import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CallLogsBulkView } from './bulk-view';

describe('CallLogsBulkView', () => {
  let component: CallLogsBulkView;
  let fixture: ComponentFixture<CallLogsBulkView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CallLogsBulkView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CallLogsBulkView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
