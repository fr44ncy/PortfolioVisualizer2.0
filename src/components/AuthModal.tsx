// src/components/AuthModal.tsx

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  return (
    <div
      // Overlay sfondo
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose} // Chiude se si clicca sullo sfondo
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl p-8 w-full max-w-md transition-all duration-300"
        onClick={(e) => e.stopPropagation()} // Evita la chiusura se si clicca sul modale
      >
        {/* Pulsante di chiusura (che usa la prop onClose) */}
        <button
          onClick={onClose} // <-- PROP UTILIZZATA
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Chiudi modale"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Salva il tuo portfolio</h2>
        <p className="text-sm text-gray-600 mb-6">Accedi o registrati per salvare le tue analisi e riprenderle in seguito.</p>
        
        {/* Componente Auth di Supabase */}
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          theme="light"
          localization={{
            variables: {
              sign_in: { email_label: 'Email', password_label: 'Password', button_label: 'Accedi' },
              sign_up: { email_label: 'Email', password_label: 'Password', button_label: 'Registrati' },
              forgotten_password: { email_label: 'Email', button_label: 'Invia istruzioni', link_text: 'Password dimenticata?' },
            }
          }}
        />
      </div>
    </div>
  );
}