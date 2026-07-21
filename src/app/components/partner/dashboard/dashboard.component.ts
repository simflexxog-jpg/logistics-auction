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
}
