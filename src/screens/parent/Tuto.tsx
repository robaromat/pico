import { useState } from 'preact/hooks';
import { Pico } from '../../ui/Pico';

// Mini-tuto du téléphone parent : quelques cartes à faire défiler, montrées une fois par téléphone
// (et à la demande depuis les Réglages). Rien n'est enregistré dans les données partagées.

const KEY = 'pico-tuto-parent';

export function tutoSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

function markTutoSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* rien */
  }
}

interface Card {
  emoji: string;
  title: string;
  lines: string[];
}

function cards(name: string): Card[] {
  return [
    {
      emoji: '🦔',
      title: 'Bienvenue',
      lines: [
        `Sur la tablette, ${name} voit les missions du moment (5 au plus).`,
        'Chaque mission réussie rapporte des bons points ⭐ à dépenser dans la boutique, et souvent une partie de jeu 🎮.',
        'Ce téléphone sert à valider, récompenser et régler. Ton code est redemandé à chaque action.',
      ],
    },
    {
      emoji: '✅',
      title: 'Valider',
      lines: [
        `${name} touche « J'ai fini ! » : la mission arrive ici, en attente.`,
        '« Tout valider » confirme tout en une fois. Pas fini ? « Pas encore » : rien n\'est perdu, la mission reste à faire.',
        'La fête (confettis, son doux) se joue sur la tablette dès qu\'elle reçoit la validation.',
      ],
    },
    {
      emoji: '🎮',
      title: 'Les parties',
      lines: [
        'Une mission validée le jour même donne une partie (les missions du soir n\'en donnent pas, par défaut).',
        'Les parties non jouées disparaissent à minuit. Une partie dure une minute, sans « Rejouer ».',
        'Le score du jeu ne rapporte jamais de bons points.',
      ],
    },
    {
      emoji: '🎁',
      title: 'Récompenser',
      lines: [
        'Bon point surprise : pour un bon moment non prévu, avec une phrase gentille qui s\'affiche sur la tablette.',
        'Défi du jour : une mission ponctuelle, pour aujourd\'hui seulement.',
        'Achat dans la boutique : un parent tape le code sur la tablette, ou offre la récompense d\'ici.',
      ],
    },
    {
      emoji: '🌙',
      title: 'Coucher et jours spéciaux',
      lines: [
        'À l\'heure du coucher, Pico s\'endort : plus de missions ni de jeu.',
        'Soirée spéciale : Pico reste éveillé jusqu\'à l\'heure choisie. Journée pause : les missions sont masquées, rien n\'est compté.',
        'Corriger : ajoute ou retire des points discrètement, sans fête ni message sur la tablette.',
      ],
    },
    {
      emoji: '⚙️',
      title: 'Réglages',
      lines: [
        'Missions, boutique, horaires d\'école et du mercredi ou du week-end, sons, code parent.',
        'Ajouter un appareil : un QR code à scanner, valable 60 secondes.',
        'Ce tuto se revoit depuis Réglages → Général.',
      ],
    },
  ];
}

export function Tuto({ name, onClose }: { name: string; onClose: () => void }) {
  const list = cards(name);
  const [i, setI] = useState(0);
  const c = list[i]!;
  const last = i === list.length - 1;
  const close = () => {
    markTutoSeen();
    onClose();
  };

  return (
    <div class="tuto" role="dialog" aria-modal="true" aria-label="Présentation de l'appli">
      <div class="tuto-card">
        <div class="tuto-top">
          {i === 0 ? <Pico expr="hello" cls="tuto-pico" /> : <span class="tuto-emoji">{c.emoji}</span>}
          <button class="linkbtn" onClick={close}>
            Passer
          </button>
        </div>
        <h2>{c.title}</h2>
        <ul>
          {c.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <div class="tuto-dots" aria-hidden="true">
          {list.map((_, k) => (
            <span key={k} class={k === i ? 'on' : ''} />
          ))}
        </div>
        <div class="row">
          <button class="pbtn" disabled={i === 0} onClick={() => setI(i - 1)}>
            Précédent
          </button>
          <button class="pbtn acc" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? "C'est parti" : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}
