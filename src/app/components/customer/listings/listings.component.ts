import { Component, OnInit, signal, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-customer-listings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './listings.component.html',
  styles: [
    `:host { display: block; }
    .app-layout { min-height: 100vh; display: flex; background: linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%); color: #0f172a; }
    .sidebar { width: 280px; min-height: 100vh; display: flex; flex-direction: column; background: linear-gradient(180deg, #0f172a 0%, #1e3a8a 100%); box-shadow: 18px 0 40px rgba(15, 23, 42, 0.12); }
    .sidebar-brand { border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
    .sidebar .nav-link { border-radius: 12px; padding: 0.75rem 0.9rem; margin: 0.2rem 0; transition: background-color 0.2s ease, color 0.2s ease; }
    .sidebar .nav-link:hover, .sidebar .nav-link.active { background: rgba(255, 255, 255, 0.14); color: #fff !important; }
    .main-content { flex: 1; padding: 24px 28px 36px; }
    .hero-panel { position: relative; overflow: hidden; display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 28px; margin-bottom: 20px; border-radius: 24px; color: #fff; background: linear-gradient(120deg, #0f172a 0%, #1d4ed8 55%, #2563eb 100%); box-shadow: 0 20px 45px rgba(37, 99, 235, 0.25); }
    .hero-panel::after { content: ''; position: absolute; right: -55px; bottom: -80px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255, 255, 255, 0.14); }
    .eyebrow { display: inline-block; margin-bottom: 10px; padding: 0.35rem 0.7rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(255, 255, 255, 0.18); }
    .hero-title { font-size: clamp(1.45rem, 2.1vw, 2rem); font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .hero-actions .btn-outline-light { border-color: rgba(255, 255, 255, 0.3); color: #fff; }
    .hero-stats { display: grid; grid-template-columns: repeat(3, minmax(110px, 1fr)); gap: 12px; min-width: 300px; }
    .stat-card { padding: 14px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.14); backdrop-filter: blur(10px); }
    .section-shell { padding: 18px 20px; border-radius: 20px; background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(148, 163, 184, 0.18); box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); }
    .section-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
    .section-heading h5 { margin: 0; font-weight: 700; color: #0f172a; }
    .section-heading p { margin: 0; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { display: inline-flex; align-items: center; padding: 0.35rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700; background: #e2e8f0; color: #334155; }
    .chip-success { background: #dcfce7; color: #166534; }
    .chip-warning { background: #fef3c7; color: #92400e; }
    .chip-info { background: #dbeafe; color: #1d4ed8; }
    .chip-primary { background: #dbeafe; color: #1d4ed8; }
    .chip-secondary { background: #f1f5f9; color: #475569; }
    .chip-danger { background: #fee2e2; color: #b91c1c; }
    .listing-card { border: 0; border-radius: 18px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .listing-card:hover { transform: translateY(-3px); box-shadow: 0 18px 35px rgba(37, 99, 235, 0.12); }
    .listing-card .card-body { display: flex; flex-direction: column; gap: 10px; }
    .route-block { padding: 10px 12px; border-radius: 14px; border: 1px solid #dbeafe; background: #f8fbff; font-size: 0.92rem; }
    #listing-map { height: 320px; border-radius: 14px; border: 1px solid #dbeafe; box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04); }
    @media (max-width: 992px) {
      .app-layout { flex-direction: column; }
      .sidebar { width: 100%; min-height: auto; }
      .hero-panel { flex-direction: column; align-items: flex-start; }
      .hero-stats { min-width: 0; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 576px) {
      .main-content { padding: 18px; }
      .hero-stats { grid-template-columns: 1fr; }
      .section-heading { flex-direction: column; align-items: flex-start; }
    }
    `
  ]
})
export class CustomerListingsComponent implements OnInit, AfterViewInit {
  @ViewChild('mapEl') mapEl!: ElementRef;

  listings = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  error = signal('');
  success = signal('');
  submitting = signal(false);

  map: L.Map | null = null;
  pickupMarker: L.Marker | null = null;
  dropoffMarker: L.Marker | null = null;
  routeLine: L.Polyline | null = null;
  selectingFor: 'pickup' | 'dropoff' | null = null;

  form: any = {
    title: '', description: '', cargoType: '', weight: '', dimensions: '',
    pickupAddress: '', pickupLat: null, pickupLng: null,
    dropoffAddress: '', dropoffLat: null, dropoffLng: null,
    auctionEndsAt: '', isAddOnEligible: false, maxAddOnWeight: 100
  };

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() {
    this.load();
  }

  ngAfterViewInit() {
    // Map init delayed to when form is shown
  }

  load() {
    this.api.getListings().subscribe({
      next: (data) => { this.listings.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  initMap() {
    setTimeout(() => {
      if (this.map) return;
      this.map = L.map('listing-map').setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        if (!this.selectingFor) return;
        const { lat, lng } = e.latlng;
        if (this.selectingFor === 'pickup') {
          this.form.pickupLat = lat;
          this.form.pickupLng = lng;
          this.form.pickupAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          if (this.pickupMarker) this.map!.removeLayer(this.pickupMarker);
          this.pickupMarker = L.marker([lat, lng], {
            icon: L.divIcon({ className: '', html: '<div class="map-marker pickup">P</div>', iconSize: [32, 32] })
          }).addTo(this.map!).bindPopup('Pickup Point').openPopup();
        } else {
          this.form.dropoffLat = lat;
          this.form.dropoffLng = lng;
          this.form.dropoffAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          if (this.dropoffMarker) this.map!.removeLayer(this.dropoffMarker);
          this.dropoffMarker = L.marker([lat, lng], {
            icon: L.divIcon({ className: '', html: '<div class="map-marker dropoff">D</div>', iconSize: [32, 32] })
          }).addTo(this.map!).bindPopup('Dropoff Point').openPopup();
        }
        this.selectingFor = null;
        this.drawRoute();
      });
    }, 100);
  }

  drawRoute() {
    if (this.form.pickupLat && this.form.dropoffLat) {
      if (this.routeLine) this.map!.removeLayer(this.routeLine);
      this.routeLine = L.polyline([
        [this.form.pickupLat, this.form.pickupLng],
        [this.form.dropoffLat, this.form.dropoffLng]
      ], { color: '#0d6efd', weight: 3, dashArray: '6 4' }).addTo(this.map!);
    }
  }

  toggleForm() {
    this.showForm.set(!this.showForm());
    if (this.showForm()) {
      this.initMap();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.form.auctionEndsAt = tomorrow.toISOString().slice(0, 16);
    }
  }

  selectPoint(type: 'pickup' | 'dropoff') {
    this.selectingFor = type;
  }

  submit() {
    if (!this.form.pickupLat || !this.form.dropoffLat) {
      this.error.set('Please select pickup and dropoff on the map');
      return;
    }
    this.submitting.set(true);
    this.api.createListing(this.form).subscribe({
      next: () => {
        this.success.set('Listing posted! Auction is live.');
        this.showForm.set(false);
        this.submitting.set(false);
        this.form = { title: '', cargoType: '', weight: '', pickupAddress: '', pickupLat: null, pickupLng: null, dropoffAddress: '', dropoffLat: null, dropoffLng: null, auctionEndsAt: '', isAddOnEligible: false, maxAddOnWeight: 100 };
        this.load();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to post');
        this.submitting.set(false);
      }
    });
  }

  getTimeLeft(endsAt: string): string {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  getOpenCount(): number {
    return this.listings().filter((listing) => listing.status === 'open').length;
  }

  getBidCount(): number {
    return this.listings().reduce((total, listing) => total + (listing.bids?.length || 0), 0);
  }

  getRouteCount(): number {
    return this.listings().filter((listing) => listing.pickupAddress && listing.dropoffAddress).length;
  }

  statusBadge(status: string): string {
    const map: any = { open: 'success', auction_ended: 'warning', accepted: 'info', in_transit: 'primary', delivered: 'secondary', cancelled: 'danger' };
    return map[status] || 'secondary';
  }
}
