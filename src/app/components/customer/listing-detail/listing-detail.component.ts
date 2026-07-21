import { Component, OnInit, OnDestroy, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { SocketService } from '../../../services/socket.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { RatingFormComponent } from '../../shared/rating-form/rating-form.component';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RatingFormComponent],
  templateUrl: './listing-detail.component.html'
})
export class ListingDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  listing = signal<any>(null);
  loading = signal(true);
  paying = signal(false);
  paySuccess = signal(false);
  error = signal('');
  chatMessages = signal<any[]>([]);
  chatInput = '';
  timer: any;
  timeLeft = signal('');
  private subs: Subscription[] = [];
  map: L.Map | null = null;
  activeTab = signal<'bids' | 'chat' | 'payment' | 'rate'>('bids');
  paymentMethod = 'card';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private socket: SocketService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    this.load(id);
    this.socket.joinListing(id);
    this.subs.push(
      this.socket.on<any>('bid:new').subscribe(bid => {
        this.listing.update(l => l ? { ...l, bids: [...(l.bids || []), bid] } : l);
      }),
      this.socket.on<any>('bid:updated').subscribe(bid => {
        this.listing.update(l => {
          if (!l) return l;
          const bids = l.bids.map((b: any) => b.id === bid.id ? bid : b);
          return { ...l, bids };
        });
      }),
      this.socket.on<any>('auction:ended').subscribe(() => this.load(id))
    );
  }

  ngAfterViewInit() {}

  load(id: string) {
    this.api.getListing(id).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.loading.set(false);
        this.startTimer();
        setTimeout(() => this.initMap(), 200);
        if (data.status === 'in_transit' || data.status === 'delivered') {
          this.loadChat(id);
          this.socket.joinChat(id);
          this.subs.push(
            this.socket.on<any>('chat:message').subscribe(msg => {
              this.chatMessages.update(msgs => [...msgs, msg]);
            })
          );
        }
      },
      error: () => this.loading.set(false)
    });
  }

  initMap() {
    const l = this.listing();
    if (!l || this.map) return;
    const el = document.getElementById('detail-map');
    if (!el) return;
    this.map = L.map('detail-map').setView([l.pickupLat, l.pickupLng], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    L.marker([l.pickupLat, l.pickupLng]).addTo(this.map).bindPopup('📍 Pickup: ' + l.pickupAddress);
    L.marker([l.dropoffLat, l.dropoffLng]).addTo(this.map).bindPopup('🏁 Dropoff: ' + l.dropoffAddress);
    L.polyline([[l.pickupLat, l.pickupLng], [l.dropoffLat, l.dropoffLng]], { color: '#0d6efd', dashArray: '6 4' }).addTo(this.map);
  }

  startTimer() {
    const l = this.listing();
    if (!l) return;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      const diff = new Date(l.auctionEndsAt).getTime() - Date.now();
      if (diff <= 0) { this.timeLeft.set('Auction Ended'); clearInterval(this.timer); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.timeLeft.set(`${h}h ${m}m ${s}s`);
    }, 1000);
  }

  sortedBids() {
    return [...(this.listing()?.bids || [])].sort((a, b) => a.amount - b.amount);
  }

  acceptBid(bidId: string) {
    const id = this.listing().id;
    this.api.acceptBid(id, bidId).subscribe({
      next: () => this.load(id),
      error: (err) => this.error.set(err.error?.error || 'Failed to accept bid')
    });
  }

  pay() {
    this.paying.set(true);
    this.api.processPayment(this.listing().id, this.paymentMethod).subscribe({
      next: () => { this.paySuccess.set(true); this.paying.set(false); this.load(this.listing().id); this.activeTab.set('chat'); },
      error: (err) => { this.error.set(err.error?.error || 'Payment failed'); this.paying.set(false); }
    });
  }

  loadChat(listingId: string) {
    this.api.getChatHistory(listingId).subscribe(msgs => this.chatMessages.set(msgs));
  }

  sendMessage() {
    if (!this.chatInput.trim()) return;
    this.api.sendMessage(this.listing().id, this.chatInput).subscribe(() => this.chatInput = '');
  }

  ratePartner(stars: number, comment: string) {
    this.api.submitRating({ listingId: this.listing().id, stars, comment }).subscribe({
      next: () => this.load(this.listing().id),
      error: (err) => this.error.set(err.error?.error)
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.subs.forEach(s => s.unsubscribe());
    if (this.map) { this.map.remove(); this.map = null; }
  }
}
