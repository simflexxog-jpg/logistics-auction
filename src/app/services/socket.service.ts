import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return;
    this.socket = io(environment.wsUrl, { auth: { token } });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinListing(listingId: string) {
    this.socket?.emit('join:listing', listingId);
  }

  joinChat(listingId: string) {
    this.socket?.emit('join:chat', listingId);
  }

  emitTyping(listingId: string, name: string) {
    this.socket?.emit('chat:typing', { listingId, name });
  }

  on<T>(event: string): Observable<T> {
    return new Observable(observer => {
      this.socket?.on(event, (data: T) => observer.next(data));
      return () => this.socket?.off(event);
    });
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
