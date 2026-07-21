import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';

@Component({
  selector: 'app-partner-auction',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auction.component.html'
})
export class PartnerAuctionComponent implements OnInit, OnDestroy {
  listings = signal<any[]>([]);
  loading = signal(true);
  selectedListing = signal<any>(null);
  bidAmount = '';
  bidNote = '';
  bidError = signal('');
  bidSuccess = signal('');
  placing = signal(false);
  timers: { [id: string]: string } = {};
  private timerInterval: any;
  private subs: Subscription[] = [];
  private map: L.Map | null = null;

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private socket: SocketService
  ) {}

  ngOnInit() {
    this.load();
    this.timerInterval = setInterval(() => this.updateTimers(), 1000);
    this.subs.push(
      this.socket.on<any>('auction:ended').subscribe(data => {
        this.listings.update(ls => ls.map(l => l.id === data.listingId ? { ...l, status: 'auction_ended' } : l));
        if (this.selectedListing()?.id === data.listingId) {
          this.selectedListing.update(l => ({ ...l, status: 'auction_ended' }));
        }
      }),
      this.socket.on<any>('bid:new').subscribe(bid => {
        this.listings.update(ls => ls.map(l => l.id === bid.listingId
          ? { ...l, bids: [...(l.bids || []), bid] } : l));
        if (this.selectedListing()?.id === bid.listingId) {
          this.selectedListing.update(l => ({ ...l, bids: [...(l.bids || []), bid] }));
        }
      }),
      this.socket.on<any>('bid:updated').subscribe(bid => {
        this.listings.update(ls => ls.map(l => l.id === bid.listingId
          ? { ...l, bids: (l.bids || []).map((b: any) => b.id === bid.id ? bid : b) } : l));
      })
    );
  }

  load() {
    this.api.getListings().subscribe({
      next: d => { this.listings.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  updateTimers() {
    this.listings().forEach(l => {
      const diff = new Date(l.auctionEndsAt).getTime() - Date.now();
      if (diff <= 0) { this.timers[l.id] = 'Ended'; return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.timers[l.id] = `${h}h ${m}m ${s}s`;
    });
  }

  selectListing(l: any) {
    this.selectedListing.set(l);
    this.bidAmount = '';
    this.bidNote = '';
    this.bidError.set('');
    this.bidSuccess.set('');
    this.socket.joinListing(l.id);
    setTimeout(() => this.initMap(l), 100);
  }

  initMap(l: any) {
    const el = document.getElementById('bid-map');
    if (!el) return;
    if (this.map) { this.map.remove(); this.map = null; }
    this.map = L.map('bid-map').setView([l.pickupLat, l.pickupLng], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    L.marker([l.pickupLat, l.pickupLng]).addTo(this.map).bindPopup('📍 ' + l.pickupAddress);
    L.marker([l.dropoffLat, l.dropoffLng]).addTo(this.map).bindPopup('🏁 ' + l.dropoffAddress);
    L.polyline([[l.pickupLat, l.pickupLng], [l.dropoffLat, l.dropoffLng]], { color: '#0d6efd', dashArray: '6 4' }).addTo(this.map);
  }

  sortedListingBids(listing: any): any[] {
    return [...(listing?.bids || [])].sort((a, b) => a.amount - b.amount);
  }

  myBid(listing: any): any {
    return listing.bids?.find((b: any) => b.partnerId === this.auth.currentUser()?.id);
  }

  lowestBid(listing: any): number | null {
    if (!listing.bids?.length) return null;
    return Math.min(...listing.bids.map((b: any) => b.amount));
  }

  placeBid() {
    if (!this.bidAmount || +this.bidAmount <= 0) { this.bidError.set('Enter a valid bid amount'); return; }
    this.placing.set(true);
    this.bidError.set('');
    this.api.placeBid({ listingId: this.selectedListing().id, amount: +this.bidAmount, note: this.bidNote }).subscribe({
      next: () => {
        this.bidSuccess.set(`Bid of ₹${this.bidAmount} placed!`);
        this.placing.set(false);
        this.bidAmount = '';
        this.load();
      },
      error: err => { this.bidError.set(err.error?.error || 'Failed'); this.placing.set(false); }
    });
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
    this.subs.forEach(s => s.unsubscribe());
    if (this.map) { this.map.remove(); this.map = null; }
  }
}
