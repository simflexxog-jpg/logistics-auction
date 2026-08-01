import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';

@Component({
  selector: 'app-partner-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jobs.component.html'
})
export class PartnerJobsComponent implements OnInit, OnDestroy {
  bids = signal<any[]>([]);
  loading = signal(true);
  selectedJob = signal<any>(null);
  chatMessages = signal<any[]>([]);
  chatInput = '';
  marking = signal(false);
  startingTransit = signal(false);
  private subs: Subscription[] = [];
  private map: L.Map | null = null;

  constructor(private api: ApiService, public auth: AuthService, private socket: SocketService) {}

  ngOnInit() {
    this.api.getMyBids().subscribe({
      next: d => { this.bids.set(d.filter((b: any) => b.status === 'accepted')); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  selectJob(bid: any) {
    this.selectedJob.set(bid);
    this.chatMessages.set([]);
    if (['accepted', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(bid.Listing?.status)) {
      this.api.getChatHistory(bid.listingId).subscribe(msgs => this.chatMessages.set(msgs));
      this.socket.joinChat(bid.listingId);
      this.subs.forEach(s => s.unsubscribe());
      this.subs = [
        this.socket.on<any>('chat:message').subscribe(msg => {
          if (msg.listingId === bid.listingId) this.chatMessages.update(ms => [...ms, msg]);
        }),
        this.socket.on<any>('listing:updated').subscribe((updated: any) => {
          if (updated.id === bid.Listing.id) {
            this.selectedJob.update(j => ({ ...j, Listing: { ...j.Listing, status: updated.status } }));
          }
        })
      ];
    }
    setTimeout(() => this.initMap(bid.Listing), 150);
  }

  initMap(l: any) {
    if (!l) return;
    const el = document.getElementById('job-map');
    if (!el) return;
    if (this.map) { this.map.remove(); this.map = null; }
    this.map = L.map('job-map').setView([l.pickupLat, l.pickupLng], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    L.marker([l.pickupLat, l.pickupLng]).addTo(this.map).bindPopup('📍 ' + l.pickupAddress);
    L.marker([l.dropoffLat, l.dropoffLng]).addTo(this.map).bindPopup('🏁 ' + l.dropoffAddress);
    L.polyline([[l.pickupLat, l.pickupLng], [l.dropoffLat, l.dropoffLng]], { color: '#198754', dashArray: '6 4', weight: 3 }).addTo(this.map);
  }

  markDelivered() {
    const job = this.selectedJob();
    if (!job) return;
    this.marking.set(true);
    this.api.markDelivered(job.listingId).subscribe({
      next: () => {
        this.marking.set(false);
        this.selectedJob.update(j => ({ ...j, Listing: { ...j.Listing, status: 'delivered' } }));
      },
      error: () => this.marking.set(false)
    });
  }

  startTransit() {
    const job = this.selectedJob();
    if (!job) return;
    this.startingTransit.set(true);
    this.api.startTransit(job.listingId).subscribe({
      next: () => {
        this.startingTransit.set(false);
        this.selectedJob.update(j => ({ ...j, Listing: { ...j.Listing, status: 'in_transit' } }));
      },
      error: () => this.startingTransit.set(false)
    });
  }

  markPickup() {
    const job = this.selectedJob();
    if (!job) return;
    this.startingTransit.set(true);
    this.api.markPickup(job.listingId).subscribe({
      next: () => {
        this.startingTransit.set(false);
        this.selectedJob.update(j => ({ ...j, Listing: { ...j.Listing, status: 'picked_up' } }));
      },
      error: () => this.startingTransit.set(false)
    });
  }

  sendMessage() {
    if (!this.chatInput.trim()) return;
    this.api.sendMessage(this.selectedJob().listingId, this.chatInput).subscribe(() => this.chatInput = '');
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.map) { this.map.remove(); this.map = null; }
  }
}
