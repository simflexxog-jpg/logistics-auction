import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent {
  pending: any[] = [];
  loading = false;

  constructor(private api: ApiService) { this.load(); }

  load() {
    this.loading = true;
    this.api.getPendingPartners().subscribe(res => { this.pending = res; this.loading = false; }, () => this.loading = false);
  }

  approve(id: string) { this.api.approvePartner(id).subscribe(() => this.load()); }
  reject(id: string) { const reason = prompt('Reason for rejection (optional)') || ''; this.api.rejectPartner(id, reason).subscribe(() => this.load()); }
  notify(id: string) {
    const message = prompt('Notification message to partner') || 'Please complete verification documents.';
    this.api.notifyPartner(id, message).subscribe(() => alert('Notification sent'));
  }
}
