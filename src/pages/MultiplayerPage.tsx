import React, { useState, useEffect } from 'react';
import { UserProfile, MultiplayerRoom, MultiplayerPlayer, ChatMessage } from '../types';
import { multiplayerService, MultiplayerAction } from '../services/multiplayer';
import { soundManager } from '../services/sound';
import {
  Users,
  Plus,
  LogIn,
  Crown,
  CheckCircle2,
  Send,
  Copy,
  Check,
  Server,
  ArrowLeft,
  MessageSquare,
  Play,
  RotateCcw,
} from 'lucide-react';

interface MultiplayerPageProps {
  profile: UserProfile;
  onOpenFirebaseGuide: () => void;
  onBackToLobby: () => void;
}

export const MultiplayerPage: React.FC<MultiplayerPageProps> = ({
  profile,
  onOpenFirebaseGuide,
  onBackToLobby,
}) => {
  const [activeRoom, setActiveRoom] = useState<MultiplayerRoom | null>(null);
  const [roomsList, setRoomsList] = useState<MultiplayerRoom[]>([]);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [newRoomName, setNewRoomName] = useState<string>('VIP Poker Lounge');
  const [newRoomGame, setNewRoomGame] = useState<'poker' | 'blackjack'>('poker');
  const [newRoomMinBet, setNewRoomMinBet] = useState<number>(50);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to real-time multiplayer network actions
  useEffect(() => {
    setRoomsList(multiplayerService.getRooms());

    const unsubscribe = multiplayerService.subscribe((action: MultiplayerAction) => {
      // Refresh room list
      setRoomsList(multiplayerService.getRooms());

      if (activeRoom && action.roomId === activeRoom.id) {
        if (action.type === 'PLAYER_JOINED' || action.type === 'PLAYER_READY' || action.type === 'STATE_SYNC') {
          const fresh = multiplayerService.getRoom(activeRoom.id);
          if (fresh) setActiveRoom(fresh);
        } else if (action.type === 'PLAYER_LEFT') {
          const fresh = multiplayerService.getRoom(activeRoom.id);
          setActiveRoom(fresh);
        } else if (action.type === 'CHAT_MESSAGE') {
          setChatMessages(prev => [...prev, action.payload as ChatMessage]);
          soundManager.playButtonClick();
        } else if (action.type === 'GAME_STARTED') {
          const fresh = multiplayerService.getRoom(activeRoom.id);
          if (fresh) {
            fresh.status = 'in_game';
            setActiveRoom(fresh);
          }
          soundManager.playCardDeal();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRoom]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playButtonClick();

    const hostPlayer: MultiplayerPlayer = {
      id: profile.id,
      name: profile.username,
      avatar: profile.avatar,
      chips: profile.coins,
      isHost: true,
      isReady: true,
      lastActive: Date.now(),
    };

    const room = multiplayerService.createRoom(
      hostPlayer,
      newRoomName,
      newRoomGame,
      newRoomMinBet,
      false,
      6
    );

    setActiveRoom(room);
    setChatMessages([
      {
        id: 'sys_' + Date.now(),
        senderId: 'system',
        senderName: 'System',
        text: `Room created with code ${room.code}. Share this code with other players to join!`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ]);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;

    soundManager.playButtonClick();
    setErrorMessage(null);

    const joiningPlayer: MultiplayerPlayer = {
      id: profile.id,
      name: profile.username,
      avatar: profile.avatar,
      chips: profile.coins,
      isHost: false,
      isReady: false,
      lastActive: Date.now(),
    };

    const res = multiplayerService.joinRoom(roomCodeInput.trim(), joiningPlayer);
    if (res.success && res.room) {
      setActiveRoom(res.room);
      setChatMessages([
        {
          id: 'sys_' + Date.now(),
          senderId: 'system',
          senderName: 'System',
          text: `Joined ${res.room.name}.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    } else {
      setErrorMessage(res.error || 'Failed to join room');
    }
  };

  const handleToggleReady = () => {
    if (!activeRoom) return;
    soundManager.playButtonClick();
    const updated = multiplayerService.toggleReady(activeRoom.id, profile.id);
    if (updated) setActiveRoom(updated);
  };

  const handleLeaveRoom = () => {
    if (!activeRoom) return;
    soundManager.playButtonClick();
    multiplayerService.leaveRoom(activeRoom.id, profile.id);
    setActiveRoom(null);
  };

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard.writeText(activeRoom.code);
    setIsCopied(true);
    soundManager.playButtonClick();
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !chatInput.trim()) return;
    multiplayerService.sendChatMessage(activeRoom.id, profile.id, profile.username, chatInput);
    setChatInput('');
  };

  const handleQuickEmote = (emoteText: string) => {
    if (!activeRoom) return;
    multiplayerService.sendChatMessage(activeRoom.id, profile.id, profile.username, emoteText);
  };

  const handleStartGame = () => {
    if (!activeRoom || activeRoom.hostId !== profile.id) return;
    soundManager.playWin();

    multiplayerService.broadcast({
      type: 'GAME_STARTED',
      roomId: activeRoom.id,
      senderId: profile.id,
      payload: { roomId: activeRoom.id },
    });

    const updated = { ...activeRoom, status: 'in_game' as const };
    setActiveRoom(updated);
  };

  const isHost = activeRoom?.hostId === profile.id;
  const isMeReady = activeRoom?.players.find(p => p.id === profile.id)?.isReady;

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 pb-20 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                onBackToLobby();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Lobby</span>
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-100 flex items-center gap-2">
                <Users className="w-6 h-6 text-amber-400" />
                <span>Multiplayer Live Lounge</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Play in real-time rooms with friends or open a second window to test multi-client live sync!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onOpenFirebaseGuide();
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Realtime Network Info</span>
          </button>
        </div>

        {/* If Not in a Room: Lobby List + Create / Join Forms */}
        {!activeRoom ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Room Form */}
            <div className="bg-[#12141c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h2 className="font-serif font-bold text-base text-slate-100">Create Private Room</h2>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold">Room Name</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    className="w-full bg-[#171a25] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-slate-100 mt-1 outline-none"
                    placeholder="e.g. High Rollers Suite"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold">Game Type</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setNewRoomGame('poker')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        newRoomGame === 'poker'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-[#171a25] border border-slate-800 text-slate-400'
                      }`}
                    >
                      Texas Hold'em
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoomGame('blackjack')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        newRoomGame === 'blackjack'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-[#171a25] border border-slate-800 text-slate-400'
                      }`}
                    >
                      Blackjack 21
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold">Minimum Stake</label>
                  <select
                    value={newRoomMinBet}
                    onChange={e => setNewRoomMinBet(parseInt(e.target.value, 10))}
                    className="w-full bg-[#171a25] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-slate-100 mt-1 outline-none"
                  >
                    <option value={20}>20 Coins (Low Stakes)</option>
                    <option value={50}>50 Coins (Medium Stakes)</option>
                    <option value={100}>100 Coins (High Stakes)</option>
                    <option value={500}>500 Coins (VIP High Roller)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
                >
                  Create Room
                </button>
              </form>
            </div>

            {/* Join Room Form */}
            <div className="bg-[#12141c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-amber-400" />
                <h2 className="font-serif font-bold text-base text-slate-100">Join by Room Code</h2>
              </div>

              <form onSubmit={handleJoinByCode} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold">Enter 6-Character Code</label>
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-[#171a25] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-slate-100 mt-1 font-mono uppercase tracking-widest text-center outline-none"
                    placeholder="e.g. ACE777"
                    maxLength={6}
                    required
                  />
                </div>

                {errorMessage && (
                  <div className="text-xs text-red-400 font-medium">{errorMessage}</div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Join Room
                </button>
              </form>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                <span className="font-semibold text-slate-200">How to test real-time:</span>
                <p>
                  Open this application in a second browser window or private tab. Create a room here, copy the code, and join from the other window to test live player interaction!
                </p>
              </div>
            </div>

            {/* Public Rooms List */}
            <div className="bg-[#12141c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-bold text-base text-slate-100">Public Rooms</h2>
                <span className="text-xs text-slate-400">{roomsList.length} active</span>
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
                {roomsList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">
                    No active public rooms right now. Create one above to get started!
                  </div>
                ) : (
                  roomsList.map(r => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-[#171a25] border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-200">{r.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase mt-0.5">
                          {r.gameId} · Min: {r.minBet} coins · {r.players.length}/{r.maxPlayers} players
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const joiningPlayer: MultiplayerPlayer = {
                            id: profile.id,
                            name: profile.username,
                            avatar: profile.avatar,
                            chips: profile.coins,
                            isHost: false,
                            isReady: false,
                            lastActive: Date.now(),
                          };
                          const res = multiplayerService.joinRoom(r.code, joiningPlayer);
                          if (res.success && res.room) setActiveRoom(res.room);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs"
                      >
                        Join
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Active Room Lobby View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Room Seats & Game Stage */}
            <div className="lg:col-span-2 space-y-6">
              {/* Room Banner */}
              <div className="bg-[#12141c] border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif font-black text-xl text-slate-100">{activeRoom.name}</h2>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold uppercase">
                      {activeRoom.gameId === 'poker' ? "Texas Hold'em" : 'Blackjack 21'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>Min Stakes: {activeRoom.minBet} coins</span>
                    <span>·</span>
                    <span>Status: {activeRoom.status === 'in_game' ? 'Playing' : 'In Lobby'}</span>
                  </div>
                </div>

                {/* Room Code Lockup */}
                <div className="flex items-center gap-2 bg-[#181a25] border border-amber-500/40 rounded-xl px-3 py-1.5">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Room Code</span>
                    <span className="font-mono font-black text-amber-400 text-sm tracking-widest">{activeRoom.code}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Copy Code"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Table Seats Grid */}
              <div className="bg-[#12141c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-base text-slate-100">
                    Seated Players ({activeRoom.players.length} / {activeRoom.maxPlayers})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleReady}
                      className={`px-4 py-1.5 rounded-xl font-bold text-xs uppercase transition-all ${
                        isMeReady
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isMeReady ? 'Ready!' : 'Click to Ready'}
                    </button>

                    {isHost && (
                      <button
                        type="button"
                        onClick={handleStartGame}
                        className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase shadow-md shadow-amber-500/20"
                      >
                        Start Game
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLeaveRoom}
                      className="px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-semibold"
                    >
                      Leave
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activeRoom.players.map(p => (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 ${
                        p.isReady ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-[#161824] border-slate-800'
                      }`}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-amber-400/50 flex items-center justify-center text-xl">
                          {p.avatar === 'crown' ? '👑' : p.avatar === 'lion' ? '🦁' : p.avatar === 'diamond' ? '💎' : '♠'}
                        </div>
                        {p.isHost && (
                          <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-400 text-slate-950" title="Host">
                            <Crown className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="font-semibold text-xs text-slate-200 truncate max-w-full">
                        {p.name} {p.id === profile.id ? '(You)' : ''}
                      </div>

                      <div className="text-[10px] text-amber-400 font-mono">
                        {p.chips.toLocaleString()} chips
                      </div>

                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          p.isReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {p.isReady ? 'Ready' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                </div>

                {activeRoom.status === 'in_game' && (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-center space-y-2">
                    <div className="font-serif font-black text-amber-300 text-base">Game Round Active!</div>
                    <p className="text-xs text-slate-300">
                      Authoritative round in progress. Turns and hand outcomes are synchronized across all connected players.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Live Room Chat & Reactions */}
            <div className="bg-[#12141c] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[450px]">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-sm text-slate-100">Table Chat & Quick Emotes</h3>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-500 italic text-center py-8">No messages yet. Send a greeting!</div>
                ) : (
                  chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-xl ${
                        msg.isSystem
                          ? 'bg-amber-950/30 text-amber-300 text-center text-[11px]'
                          : msg.senderId === profile.id
                          ? 'bg-amber-500/10 border border-amber-500/30 text-slate-200 ml-4'
                          : 'bg-[#181a26] border border-slate-800 text-slate-300 mr-4'
                      }`}
                    >
                      {!msg.isSystem && (
                        <div className="text-[10px] font-bold text-amber-400/90 mb-0.5">{msg.senderName}</div>
                      )}
                      <div>{msg.text}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Emote Reactions */}
              <div className="flex items-center gap-1.5 py-2 overflow-x-auto border-t border-slate-800">
                {['Good Luck! 🍀', 'Nice Hand! 👏', 'Raise it! 🔥', 'All In! 🚀'].map(emote => (
                  <button
                    key={emote}
                    type="button"
                    onClick={() => handleQuickEmote(emote)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] whitespace-nowrap font-medium"
                  >
                    {emote}
                  </button>
                ))}
              </div>

              {/* Text Input */}
              <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Chat with table..."
                  className="flex-1 bg-[#171a25] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
