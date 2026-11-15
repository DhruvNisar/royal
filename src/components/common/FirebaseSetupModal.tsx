import React from 'react';
import { X, Server, Database, CheckCircle, Info, ExternalLink } from 'lucide-react';
import { soundManager } from '../../services/sound';

interface FirebaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseSetupModal: React.FC<FirebaseSetupModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#13151d] border border-amber-500/30 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400" />
            <h2 className="font-serif font-bold text-lg">Multiplayer & Cloud Architecture</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Status Badge */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3 text-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-300 text-sm">Active Mode: Real-Time Multi-Client Sync</div>
              <div className="text-xs text-emerald-200/80 mt-0.5">
                Multiplayer rooms are fully functional and synchronized in real time across browser windows and tabs using BroadcastChannel and local multi-client state.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif font-bold text-amber-300 text-sm uppercase tracking-wide">
              How Real Multiplayer Works in ROYAL ACE
            </h3>
            <p>
              When you create a multiplayer room (e.g. room code <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">ACE777</code>), you can open a second browser window, join that exact code, and both players will immediately sit at the same table, ready up, and compete in real-time poker hands or blackjack!
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200 text-xs">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Cloud Firebase Realtime & Firestore Instructions:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-400">
              <li>Open your Firebase Console and create a project for your domain.</li>
              <li>Enable Firestore Database in production or test mode.</li>
              <li>Enable Anonymous / Email Authentication.</li>
              <li>Supply environment variables via your cloud deployment configuration:
                <div className="mt-1 font-mono text-[11px] bg-slate-950 p-2 rounded text-slate-300 border border-slate-800">
                  VITE_FIREBASE_API_KEY="..."<br />
                  VITE_FIREBASE_PROJECT_ID="..."<br />
                  VITE_FIREBASE_DATABASE_URL="..."
                </div>
              </li>
              <li>The client will seamlessly upgrade from local broadcast sync to global Firebase websocket listeners.</li>
            </ol>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
