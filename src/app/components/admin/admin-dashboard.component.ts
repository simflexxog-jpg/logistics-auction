import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent {
  tab: 'pending' | 'users' | 'audit' = 'pending';
  pending: any[] = [];
  users: any[] = [];
  audit: any[] = [];
  loading = false;
  searchQ = '';

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

  loadUsers() {
    this.loading = true;
    this.api.getUsers(this.searchQ).subscribe(r => { this.users = r; this.loading = false; }, () => this.loading = false);
  }

  viewUser(id: string) {
    this.api.getUser(id).subscribe(u => alert(JSON.stringify(u, null, 2)));
  }

  loadAudit() {
    this.loading = true;
    this.api.getAuditLogs(200).subscribe(r => { this.audit = r.reverse(); this.loading = false; }, () => this.loading = false);
  }

  setTab(t: 'pending' | 'users' | 'audit') {
    this.tab = t;
    if (t === 'users') this.loadUsers();
    if (t === 'audit') this.loadAudit();
    if (t === 'pending') this.load();
  }
}
