import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { forkJoin } from 'rxjs';
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
  pendingListings: any[] = [];
  pendingPayments: any[] = [];
  users: any[] = [];
  audit: any[] = [];
  loading = false;
  health: any = null;
  backupMessage = '';
  searchQ = '';
  // pagination
  usersPage = 1;
  usersLimit = 25;
  usersTotal = 0;
  usersSort: 'createdAt'|'name'|'email' = 'createdAt';
  usersOrder: 'asc'|'desc' = 'desc';

  constructor(private api: ApiService) { this.load(); }

  load() {
    this.api.getHealth().subscribe(res => this.health = res);
    this.loading = true;
    forkJoin({
      partners: this.api.getPendingPartners(),
      approvals: this.api.getPendingApprovals()
    }).subscribe({
      next: ({ partners, approvals }) => {
        this.pending = Array.isArray(partners) ? partners : [];
        this.pendingListings = approvals?.listings || [];
        this.pendingPayments = approvals?.payments || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  approve(id: string) { this.api.approvePartner(id).subscribe(() => this.load()); }
  reject(id: string) { const reason = prompt('Reason for rejection (optional)') || ''; this.api.rejectPartner(id, reason).subscribe(() => this.load()); }
  approveListing(id: string) { const reason = prompt('Approval note (optional)') || ''; this.api.approveListing(id, reason).subscribe(() => this.load()); }
  rejectListing(id: string) { const reason = prompt('Reason for rejection (optional)') || ''; this.api.rejectListing(id, reason).subscribe(() => this.load()); }
  approvePayment(id: string) { const reason = prompt('Approval note (optional)') || ''; this.api.approvePayment(id, reason).subscribe(() => this.load()); }
  rejectPayment(id: string) { const reason = prompt('Reason for rejection (optional)') || ''; this.api.rejectPayment(id, reason).subscribe(() => this.load()); }
  notify(id: string) {
    const message = prompt('Notification message to partner') || 'Please complete verification documents.';
    this.api.notifyPartner(id, message).subscribe(() => alert('Notification sent'));
  }

  loadUsers() {
    this.loading = true;
    this.api.getUsers(this.searchQ, this.usersPage, this.usersLimit, this.usersSort, this.usersOrder).subscribe(r => {
      this.users = r.rows || r;
      this.usersTotal = r.count || (Array.isArray(r) ? r.length : 0);
      this.loading = false;
    }, () => this.loading = false);
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

  createBackup() {
    this.backupMessage = 'Creating backup...';
    this.api.createBackup().subscribe({
      next: (res) => this.backupMessage = res?.success ? `Backup created: ${res.path}` : 'Backup failed',
      error: () => this.backupMessage = 'Backup failed'
    });
  }

  exportUsersCsv() {
    if (!this.users || this.users.length === 0) return alert('No users to export');
    const rows = this.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, isVerified: u.isVerified }));
    const csv = [Object.keys(rows[0]).join(',')].concat(rows.map(r => Object.values(r).map(v => '"' + (v ?? '') + '"').join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `users_page${this.usersPage}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.usersTotal / this.usersLimit));
  }

  prevPage() { if (this.usersPage > 1) { this.usersPage--; this.loadUsers(); } }
  nextPage() { if (this.usersPage < this.totalPages()) { this.usersPage++; this.loadUsers(); } }

  filterAudit(action?: string, from?: string, to?: string) {
    this.loading = true;
    this.api.getAuditLogs(200, action, from, to).subscribe(r => { this.audit = r.reverse(); this.loading = false; }, () => this.loading = false);
  }
}
