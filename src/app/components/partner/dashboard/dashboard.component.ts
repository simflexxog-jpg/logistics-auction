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
  reportOpen = signal(false);

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() {
    this.api.getDashboard().subscribe({
      next: d => { this.stats.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  viewReport() {
    this.reportOpen.set(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  exportReport() {
    const summary = this.stats();
    if (!summary) return;

    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Partner', summary.partner?.name ?? 'N/A'],
      ['Total earnings', `₹${Number(summary.partner?.totalEarnings || 0).toFixed(0)}`],
      ['My bids', String(summary.myBids ?? 0)],
      ['Won bids', String(summary.wonBids ?? 0)],
      ['Active shipments', String(summary.activeShipments ?? 0)],
      ['Completed shipments', String(summary.completedShipments ?? 0)],
      ['Recent jobs', String((summary.recentJobs ?? []).length)]
    ];

    (summary.recentJobs ?? []).forEach((job: any) => {
      rows.push([
        `Job ${job.id?.slice(0, 8).toUpperCase() || 'N/A'}`,
        this.shipmentStatusLabel(job.status)
      ]);
    });

    const csv = rows
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `partner-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
