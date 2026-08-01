import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-partner-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class PartnerDashboardComponent implements OnInit {
  stats = signal<any>(null);
  loading = signal(true);

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() {
    this.api.getDashboard().subscribe({
      next: d => { this.stats.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  winRate(): string {
    const s = this.stats();
    if (!s || !s.myBids) return '0';
    return ((s.wonBids / s.myBids) * 100).toFixed(0);
  }

  deliveryScore(): number {
    const rate = Number(this.winRate());
    return rate ? Math.min(98, Math.max(72, rate + 35)) : 84;
  }

  exceptionCount(): number {
    const jobs = this.stats()?.recentJobs ?? [];
    return jobs.filter(job => ['at_risk', 'delayed', 'auction_ended', 'cancelled'].includes(job.status)).length;
  }

  shipmentStatusClass(status: string): string {
    switch (status) {
      case 'picked_up':
      case 'in_transit':
        return 'badge bg-success';
      case 'accepted':
      case 'paid':
        return 'badge bg-info text-dark';
      case 'delivered':
        return 'badge bg-secondary';
      case 'auction_ended':
        return 'badge bg-warning text-dark';
      case 'cancelled':
        return 'badge bg-danger';
      default:
        return 'badge bg-light text-dark';
    }
  }

  shipmentStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    if (status === 'paid') return 'Paid';
    if (status === 'picked_up') return 'Picked up';
    if (status === 'in_transit') return 'In transit';
    if (status === 'auction_ended') return 'Auction ended';
    return status.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
  }
}
