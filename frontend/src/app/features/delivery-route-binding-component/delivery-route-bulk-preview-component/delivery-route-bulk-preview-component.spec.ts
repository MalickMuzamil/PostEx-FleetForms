import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryRouteBulkPreviewComponent } from './delivery-route-bulk-preview-component';

describe('DeliveryRouteBulkPreviewComponent', () => {
  let component: DeliveryRouteBulkPreviewComponent;
  let fixture: ComponentFixture<DeliveryRouteBulkPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryRouteBulkPreviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryRouteBulkPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
