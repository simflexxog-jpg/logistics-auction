import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers() {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${this.auth.token}` }) };
  }

  // Listings
  getListings() { return this.http.get<any[]>(`${this.base}/listings`, this.headers()); }
  getListing(id: string) { return this.http.get<any>(`${this.base}/listings/${id}`, this.headers()); }
  createListing(data: any) { return this.http.post<any>(`${this.base}/listings`, data, this.headers()); }
  acceptBid(listingId: string, bidId: string) {
    return this.http.post<any>(`${this.base}/listings/${listingId}/accept-bid`, { bidId }, this.headers());
  }
  markPickup(listingId: string) {
    return this.http.post<any>(`${this.base}/listings/${listingId}/pickup`, {}, this.headers());
  }
  startTransit(listingId: string) {
    return this.http.post<any>(`${this.base}/listings/${listingId}/start-transit`, {}, this.headers());
  }
  markDelivered(listingId: string) {
    return this.http.post<any>(`${this.base}/listings/${listingId}/deliver`, {}, this.headers());
  }

  // Bids
  placeBid(data: any) { return this.http.post<any>(`${this.base}/bids`, data, this.headers()); }
  getMyBids() { return this.http.get<any[]>(`${this.base}/bids/my`, this.headers()); }

  // Payments
  processPayment(listingId: string, method: string) {
    return this.http.post<any>(`${this.base}/payments`, { listingId, method }, this.headers());
  }
  getPayment(listingId: string) {
    return this.http.get<any>(`${this.base}/payments/listing/${listingId}`, this.headers());
  }

  // Chat
  getChatHistory(listingId: string) {
    return this.http.get<any[]>(`${this.base}/chat/${listingId}`, this.headers());
  }
  sendMessage(listingId: string, message: string) {
    return this.http.post<any>(`${this.base}/chat/${listingId}`, { message }, this.headers());
  }

  // Ratings
  submitRating(data: any) { return this.http.post<any>(`${this.base}/ratings`, data, this.headers()); }

  queryAI(listingId: string, prompt: string) {
    return this.http.post<any>(`${this.base}/ai/assistant/${listingId}`, { prompt }, this.headers());
  }

  querySupport(prompt: string) {
    return this.http.post<any>(`${this.base}/ai/support`, { prompt }, this.headers());
  }

  // Add-ons
  getAddOns() { return this.http.get<any[]>(`${this.base}/addons`, this.headers()); }
  createAddOn(data: any) { return this.http.post<any>(`${this.base}/addons`, data, this.headers()); }
  claimAddOn(addonId: string, listingId: string) {
    return this.http.post<any>(`${this.base}/addons/${addonId}/claim`, { listingId }, this.headers());
  }

  // Partner
  getDashboard() { return this.http.get<any>(`${this.base}/partner/dashboard`, this.headers()); }

  // Admin
  getPendingPartners() { return this.http.get<any[]>(`${this.base}/admin/partners/pending`, this.headers()); }
  approvePartner(partnerId: string) { return this.http.post<any>(`${this.base}/admin/partners/${partnerId}/approve`, {}, this.headers()); }
  rejectPartner(partnerId: string, reason?: string) { return this.http.post<any>(`${this.base}/admin/partners/${partnerId}/reject`, { reason }, this.headers()); }
  notifyPartner(partnerId: string, message: string) { return this.http.post<any>(`${this.base}/admin/partners/${partnerId}/notify`, { message }, this.headers()); }
  getUsers(q?: string, page = 1, limit = 50, sort = 'createdAt', order: 'asc'|'desc' = 'desc') {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort', sort);
    params.set('order', order);
    return this.http.get<any>(`${this.base}/admin/users?${params.toString()}`, this.headers());
  }
  getUser(userId: string) { return this.http.get<any>(`${this.base}/admin/users/${userId}`, this.headers()); }
  getAuditLogs(lines = 200, action?: string, from?: string, to?: string) {
    const params = new URLSearchParams();
    params.set('lines', String(lines));
    if (action) params.set('action', action);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return this.http.get<any[]>(`${this.base}/admin/audit?${params.toString()}`, this.headers());
  }
}
