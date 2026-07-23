import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-rating-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="row justify-content-center">
      <div class="col-md-6 text-center">
        @if (submitted()) {
          <div class="py-4">
            <div style="font-size:3rem"><span class="material-icons-outlined text-success" style="font-size:3rem;">celebration</span></div>
            <h5 class="fw-bold mt-2">Thanks for your feedback!</h5>
            <p class="text-muted">Your rating helps build trust in the platform.</p>
          </div>
        } @else {
          <p class="text-muted mb-3">How was your experience with this partner?</p>
          <div class="star-selector mb-3">
            @for (s of [1,2,3,4,5]; track s) {
              <span class="star-btn" [class.active]="hoveredStar >= s || selectedStar >= s"
                (mouseenter)="hoveredStar = s" (mouseleave)="hoveredStar = 0"
                (click)="selectedStar = s" style="font-size:2.5rem;cursor:pointer;">
                <span class="material-icons-outlined" style="font-size:2.5rem;">{{ hoveredStar >= s || selectedStar >= s ? 'star' : 'star_border' }}</span>
              </span>
            }
          </div>
          <div class="mb-3">
            <textarea class="form-control" [(ngModel)]="comment" rows="3" placeholder="Leave a comment (optional)..."></textarea>
          </div>
          @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
          <button class="btn btn-warning fw-semibold px-4" (click)="submit()" [disabled]="!selectedStar || loading()">
            @if (loading()) { <span class="spinner-border spinner-border-sm me-1"></span> }
            Submit Rating
          </button>
        }
      </div>
    </div>
  `
})
export class RatingFormComponent {
  @Input() listingId!: string;
  @Output() rated = new EventEmitter<void>();

  selectedStar = 0;
  hoveredStar = 0;
  comment = '';
  submitted = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private api: ApiService) {}

  submit() {
    this.loading.set(true);
    this.api.submitRating({ listingId: this.listingId, stars: this.selectedStar, comment: this.comment }).subscribe({
      next: () => { this.submitted.set(true); this.loading.set(false); this.rated.emit(); },
      error: (err) => { this.error.set(err.error?.error || 'Failed'); this.loading.set(false); }
    });
  }
}
