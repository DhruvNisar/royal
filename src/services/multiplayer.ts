import { MultiplayerRoom, MultiplayerPlayer, ChatMessage, Card } from '../types';

export interface MultiplayerAction {
  type:
    | 'ROOM_CREATED'
    | 'PLAYER_JOINED'
    | 'PLAYER_LEFT'
    | 'PLAYER_READY'
    | 'GAME_STARTED'
    | 'CHAT_MESSAGE'
    | 'POKER_ACTION'
    | 'BLACKJACK_ACTION'
    | 'STATE_SYNC';
  roomId: string;
  senderId: string;
  payload: any;
  timestamp: number;
}

const STORAGE_ROOMS_KEY = 'royal_ace_multiplayer_rooms';

class MultiplayerService {
  private channel: BroadcastChannel | null = null;
  private listeners: ((action: MultiplayerAction) => void)[] = [];
  private activeRoomId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('royal_ace_multiplayer_network');
        this.channel.onmessage = (event: MessageEvent<MultiplayerAction>) => {
          this.handleIncomingAction(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not available, falling back to storage events', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'royal_ace_multiplayer_broadcast' && e.newValue) {
          try {
            const action = JSON.parse(e.newValue);
            this.handleIncomingAction(action);
          } catch (err) {
            console.warn('Error parsing storage broadcast', err);
          }
        }
      });
    }
  }

  private handleIncomingAction(action: MultiplayerAction) {
    this.listeners.forEach(fn => fn(action));
  }

  public subscribe(callback: (action: MultiplayerAction) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public broadcast(action: Omit<MultiplayerAction, 'timestamp'>) {
    const fullAction: MultiplayerAction = {
      ...action,
      timestamp: Date.now(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(fullAction);
      } catch (e) {
        console.warn('Broadcast channel post failed', e);
      }
    }

    try {
      localStorage.setItem('royal_ace_multiplayer_broadcast', JSON.stringify(fullAction));
    } catch (e) {
      console.warn('Storage broadcast failed', e);
    }

    // Call locally as well
    this.handleIncomingAction(fullAction);
  }

  // --- Room Registry ---
  public getRooms(): MultiplayerRoom[] {
    try {
      const data = localStorage.getItem(STORAGE_ROOMS_KEY);
      if (data) {
        const rooms: MultiplayerRoom[] = JSON.parse(data);
        // Filter out stale rooms older than 4 hours
        const activeRooms = rooms.filter(r => Date.now() - r.createdAt < 4 * 60 * 60 * 1000);
        return activeRooms;
      }
    } catch (e) {
      console.warn('Error reading rooms', e);
    }
    return [];
  }

  public saveRooms(rooms: MultiplayerRoom[]) {
    try {
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    } catch (e) {
      console.warn('Error saving rooms', e);
    }
  }

  public getRoom(roomIdOrCode: string): MultiplayerRoom | null {
    const rooms = this.getRooms();
    const query = roomIdOrCode.trim().toUpperCase();
    return rooms.find(r => r.id === roomIdOrCode || r.code === query) || null;
  }

  public createRoom(
    hostPlayer: MultiplayerPlayer,
    name: string,
    gameId: 'poker' | 'blackjack',
    minBet: number = 50,
    isPrivate: boolean = false,
    maxPlayers: number = 6
  ): MultiplayerRoom {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomId = 'room_' + Date.now() + '_' + code;

    const newRoom: MultiplayerRoom = {
      id: roomId,
      code,
      name: name.trim() || `VIP ${gameId === 'poker' ? 'Poker' : 'Blackjack'} Suite`,
      gameId,
      hostId: hostPlayer.id,
      isPrivate,
      minBet,
      maxPlayers,
      players: [{ ...hostPlayer, isHost: true, isReady: true, lastActive: Date.now() }],
      status: 'waiting',
      createdAt: Date.now(),
    };

    const rooms = this.getRooms();
    this.saveRooms([newRoom, ...rooms]);
    this.activeRoomId = roomId;

    this.broadcast({
      type: 'ROOM_CREATED',
      roomId,
      senderId: hostPlayer.id,
      payload: newRoom,
    });

    return newRoom;
  }

  public joinRoom(roomIdOrCode: string, player: MultiplayerPlayer): { success: boolean; room?: MultiplayerRoom; error?: string } {
    const room = this.getRoom(roomIdOrCode);
    if (!room) {
      return { success: false, error: 'Room not found. Check the room code and try again.' };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: 'This VIP room is currently full.' };
    }

    // Check if player already in room
    const existingIndex = room.players.findIndex(p => p.id === player.id);
    if (existingIndex >= 0) {
      room.players[existingIndex] = { ...player, lastActive: Date.now() };
    } else {
      room.players.push({ ...player, isHost: false, isReady: false, lastActive: Date.now() });
    }

    const rooms = this.getRooms();
    const updatedRooms = rooms.map(r => (r.id === room.id ? room : r));
    this.saveRooms(updatedRooms);
    this.activeRoomId = room.id;

    this.broadcast({
      type: 'PLAYER_JOINED',
      roomId: room.id,
      senderId: player.id,
      payload: { room, player },
    });

    return { success: true, room };
  }

  public toggleReady(roomId: string, playerId: string): MultiplayerRoom | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.players = room.players.map(p => {
      if (p.id === playerId) {
        return { ...p, isReady: !p.isReady, lastActive: Date.now() };
      }
      return p;
    });

    const rooms = this.getRooms();
    const updated = rooms.map(r => (r.id === room.id ? room : r));
    this.saveRooms(updated);

    this.broadcast({
      type: 'PLAYER_READY',
      roomId,
      senderId: playerId,
      payload: { room, playerId },
    });

    return room;
  }

  public leaveRoom(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    const rooms = this.getRooms();

    if (room.players.length === 0) {
      // Delete empty room
      const remaining = rooms.filter(r => r.id !== roomId);
      this.saveRooms(remaining);
    } else {
      // Reassign host if host left
      if (room.hostId === playerId && room.players.length > 0) {
        room.hostId = room.players[0].id;
        room.players[0].isHost = true;
      }
      const updated = rooms.map(r => (r.id === room.id ? room : r));
      this.saveRooms(updated);
    }

    this.broadcast({
      type: 'PLAYER_LEFT',
      roomId,
      senderId: playerId,
      payload: { roomId, playerId },
    });
  }

  public sendChatMessage(roomId: string, senderId: string, senderName: string, text: string) {
    const msg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId,
      senderName,
      text: text.trim(),
      timestamp: Date.now(),
    };

    this.broadcast({
      type: 'CHAT_MESSAGE',
      roomId,
      senderId,
      payload: msg,
    });

    return msg;
  }
}

export const multiplayerService = new MultiplayerService();
