import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;

  connect(token?: string) {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) return;
    if (this.socket && this.socket.connected) return;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.socket = io(environment.wsUrl, { auth: { token: authToken }, transports: ['websocket'] });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  private ensureConnection() {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
  }

  joinListing(listingId: string) {
    this.ensureConnection();
    this.socket?.emit('join:listing', listingId);
  }

  joinChat(listingId: string) {
    this.ensureConnection();
    this.socket?.emit('join:chat', listingId);
  }

  emitTyping(listingId: string, name: string) {
    this.ensureConnection();
    this.socket?.emit('chat:typing', { listingId, name });
  }

  on<T>(event: string): Observable<T> {
    this.ensureConnection();
    return new Observable(observer => {
      if (!this.socket) {
        observer.complete();
        return;
      }
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => this.socket?.off(event, handler);
    });
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
