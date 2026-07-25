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
  private pickupAddressTimer: any = null;
  private dropoffAddressTimer: any = null;

  form: any = {
    title: '', description: '', cargoType: '', weight: '', dimensions: '',
    pickupAddress: '', pickupLat: null, pickupLng: null,
    dropoffAddress: '', dropoffLat: null, dropoffLng: null,
    auctionDuration: 24, auctionEndsAt: '', isAddOnEligible: false, maxAddOnWeight: 100
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
          this.reverseGeocode(lat, lng, 'pickup');
        } else {
          this.reverseGeocode(lat, lng, 'dropoff');
        }
        this.selectingFor = null;
      });

      if (this.form.pickupLat && this.form.pickupLng) {
        this.setPoint('pickup', this.form.pickupLat, this.form.pickupLng, this.form.pickupAddress || 'Pickup point');
      }
      if (this.form.dropoffLat && this.form.dropoffLng) {
        this.setPoint('dropoff', this.form.dropoffLat, this.form.dropoffLng, this.form.dropoffAddress || 'Dropoff point');
      }
      this.drawRoute();
    }, 100);
  }

  setPoint(type: 'pickup' | 'dropoff', lat: number, lng: number, address: string) {
    if (type === 'pickup') {
      this.form.pickupLat = lat;
      this.form.pickupLng = lng;
      this.form.pickupAddress = address;
      if (this.pickupMarker) this.map!.removeLayer(this.pickupMarker);
      this.pickupMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div class="map-marker pickup">P</div>', iconSize: [32, 32] })
      }).addTo(this.map!).bindPopup('Pickup Point').openPopup();
    } else {
      this.form.dropoffLat = lat;
      this.form.dropoffLng = lng;
      this.form.dropoffAddress = address;
      if (this.dropoffMarker) this.map!.removeLayer(this.dropoffMarker);
      this.dropoffMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div class="map-marker dropoff">D</div>', iconSize: [32, 32] })
      }).addTo(this.map!).bindPopup('Dropoff Point').openPopup();
    }

    if (this.form.pickupLat && this.form.dropoffLat) {
      const bounds = L.latLngBounds([
        [this.form.pickupLat, this.form.pickupLng],
        [this.form.dropoffLat, this.form.dropoffLng]
      ]);
      this.map!.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  onPickupAddressInput(value: string) {
    this.form.pickupAddress = value;
    if (!value?.trim()) return;
    if (this.pickupAddressTimer) clearTimeout(this.pickupAddressTimer);
    this.pickupAddressTimer = setTimeout(() => this.geocodeAddress(value, 'pickup'), 600);
  }

  onDropoffAddressInput(value: string) {
    this.form.dropoffAddress = value;
    if (!value?.trim()) return;
    if (this.dropoffAddressTimer) clearTimeout(this.dropoffAddressTimer);
    this.dropoffAddressTimer = setTimeout(() => this.geocodeAddress(value, 'dropoff'), 600);
  }

  geocodeAddress(address: string, type: 'pickup' | 'dropoff') {
    if (!address?.trim()) return;
    this.initMap();
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
    fetch(url, { headers: { Accept: 'application/json' } as HeadersInit })
      .then((res) => res.json())
      .then((results) => {
        if (!results?.length) return;
        const result = results[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        this.setPoint(type, lat, lng, result.display_name || address);
        this.drawRoute();
      })
      .catch(() => {
        // Ignore geocoding failures and keep the typed address visible.
      });
  }

  reverseGeocode(lat: number, lng: number, type: 'pickup' | 'dropoff') {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    fetch(url, { headers: { Accept: 'application/json' } as HeadersInit })
      .then((res) => res.json())
      .then((result) => {
        const label = result?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        this.setPoint(type, lat, lng, label);
        this.drawRoute();
      })
      .catch(() => {
        this.setPoint(type, lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        this.drawRoute();
      });
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
      this.form.auctionDuration = 24;
      this.form.auctionEndsAt = '';
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
    this.form.auctionEndsAt = new Date(Date.now() + Number(this.form.auctionDuration) * 3600000).toISOString();
    this.submitting.set(true);
    this.api.createListing(this.form).subscribe({
      next: () => {
        this.success.set('Listing posted! Auction is live.');
        this.showForm.set(false);
        this.submitting.set(false);
        this.form = { title: '', description: '', cargoType: '', weight: '', dimensions: '', pickupAddress: '', pickupLat: null, pickupLng: null, dropoffAddress: '', dropoffLat: null, dropoffLng: null, auctionDuration: 24, auctionEndsAt: '', isAddOnEligible: false, maxAddOnWeight: 100 };
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
    const map: any = { open: 'success', auction_ended: 'warning', accepted: 'info', paid: 'info', picked_up: 'primary', in_transit: 'primary', delivered: 'secondary', cancelled: 'danger' };
    return map[status] || 'secondary';
  }
  statusLabel(status: string): string {
    const labels: any = {
      open: 'Open',
      auction_ended: 'Auction ended',
      accepted: 'Accepted',
      paid: 'Paid',
      picked_up: 'Picked up',
      in_transit: 'In transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  }
}
