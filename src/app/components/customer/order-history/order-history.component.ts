import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-history.component.html'
})
export class OrderHistoryComponent implements OnInit {
  history = signal<any[]>([]);
  loading = signal(true);
  error = signal('');

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getListings().subscribe({
      next: (data) => {
        this.history.set((data || []).filter((listing) => ['delivered', 'auction_ended', 'cancelled'].includes((listing.status || '').toLowerCase())));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load order history right now.');
        this.loading.set(false);
      }
    });
  }

  statusBadge(status: string): string {
    const map: any = { delivered: 'success', auction_ended: 'warning', cancelled: 'secondary' };
    return map[status] || 'secondary';
  }

  statusLabel(status: string): string {
    const labels: any = { delivered: 'Delivered', auction_ended: 'Expired', cancelled: 'Cancelled' };
    return labels[status] || status;
  }
}
