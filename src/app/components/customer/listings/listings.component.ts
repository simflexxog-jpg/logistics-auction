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
  templateUrl: './listings.component.html'
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

  statusBadge(status: string): string {
    const map: any = { open: 'success', auction_ended: 'warning', accepted: 'info', in_transit: 'primary', delivered: 'secondary', cancelled: 'danger' };
    return map[status] || 'secondary';
  }
}
