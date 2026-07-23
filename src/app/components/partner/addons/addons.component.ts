import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-partner-addons',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './addons.component.html'
})
export class PartnerAddonsComponent implements OnInit {
  addons = signal<any[]>([]);
  myJobs = signal<any[]>([]);
  loading = signal(true);
  claiming: { [id: string]: boolean } = {};
  claimResult: { [id: string]: string } = {};
  selectedListing: { [id: string]: string } = {};

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() {
    this.api.getAddOns().subscribe({
      next: d => { this.addons.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.api.getMyBids().subscribe({
      next: d => this.myJobs.set(d.filter((b: any) => b.status === 'accepted' && b.Listing?.status === 'in_transit')),
      error: () => {}
    });
  }

  claim(addonId: string) {
    const listingId = this.selectedListing[addonId];
    if (!listingId) { this.claimResult[addonId] = 'Please select your active job first'; return; }
    this.claiming[addonId] = true;
    this.claimResult[addonId] = '';
    this.api.claimAddOn(addonId, listingId).subscribe({
      next: () => {
        this.claimResult[addonId] = 'Claimed! This add-on is now part of your shipment.';
        this.claiming[addonId] = false;
        this.addons.update(as => as.filter(a => a.id !== addonId));
      },
      error: err => {
        this.claimResult[addonId] = err.error?.error ? err.error.error : 'Failed to claim add-on.';
        this.claiming[addonId] = false;
      }
    });
  }
}
