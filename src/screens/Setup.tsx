import { useState } from 'preact/hooks';
import { decodeSetup, saveDevice, type Device, type Role } from '../device';
import { hashCode, newSalt } from '../lib/code';
import { newFile } from '../model/defaults';
import { PICO_FILE, testRepo, writeJsonFile } from '../sync/github';
import { Pico } from '../ui/Pico';
import { Chips } from '../ui/Sheet';
import { Scanner } from './Scanner';

// Installation d'un appareil :
//  - le premier téléphone parent : saisie du dépôt et du jeton, puis création de pico.json (prénom, code, solde) ;
//  - les autres appareils : scan du QR code affiché par un téléphone parent (Réglages → Ajouter un appareil).

type Step = 'home' | 'scan' | 'manual' | 'create';

export function Setup() {
  const [step, setStep] = useState<Step>('home');
  const [dev, setDev] = useState<Device>({ owner: 'robaromat', repo: 'pico-data', token: '', role: 'parent' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function connect(d: Device) {
    setBusy(true);
    setErr('');
    const t = await testRepo(d);
    setBusy(false);
    if (!t.ok) return setErr(t.message);
    if (t.hasFile) return saveDevice(d);
    if (d.role === 'child') return setErr("Il n'y a pas encore de données : installe d'abord un téléphone parent.");
    setDev(d);
    setStep('create');
  }

  if (step === 'scan')
    return (
      <Scanner
        onCancel={() => setStep('home')}
        onCode={(text) => {
          const d = decodeSetup(text);
          if (!d) return false;
          setStep('home');
          void connect(d);
          return true;
        }}
      />
    );

  return (
    <div class="setup">
      <div class="setup-card">
        <Pico expr="hello" cls="setup-pico" />
        {step === 'home' && (
          <>
            <h1>Bonjour, je suis Pico !</h1>
            <p>Pour commencer, relie cet appareil aux autres.</p>
            <button class="kbtn big" disabled={busy} onClick={() => setStep('scan')}>
              📷 Scanner le QR code
            </button>
            <p class="small">Le QR code s'affiche sur un téléphone parent déjà installé : Réglages → Ajouter un appareil.</p>
            <button class="linkbtn" onClick={() => setStep('manual')}>
              Premier appareil ? Saisie manuelle
            </button>
            {busy && <p class="small">Connexion…</p>}
            <button
              class="linkbtn"
              onClick={() => {
                location.hash = '#test';
                location.reload();
              }}
            >
              Tester cet appareil
            </button>
          </>
        )}

        {step === 'manual' && (
          <form
            class="form"
            onSubmit={(e) => {
              e.preventDefault();
              void connect({ ...dev, owner: dev.owner.trim(), repo: dev.repo.trim(), token: dev.token.trim() });
            }}
          >
            <h1>Premier appareil</h1>
            <label>
              Compte GitHub
              <input value={dev.owner} autocomplete="off" autocapitalize="off" onInput={(e) => setDev({ ...dev, owner: e.currentTarget.value })} />
            </label>
            <label>
              Dépôt de données (privé)
              <input value={dev.repo} autocomplete="off" autocapitalize="off" onInput={(e) => setDev({ ...dev, repo: e.currentTarget.value })} />
            </label>
            <label>
              Jeton d'accès (fine-grained, Contents : Read and write)
              <input type="password" value={dev.token} autocomplete="off" onInput={(e) => setDev({ ...dev, token: e.currentTarget.value })} />
            </label>
            <label>
              Cet appareil est
              <Chips<Role> values={['parent', 'child']} value={dev.role} onChange={(role) => setDev({ ...dev, role })} label={(r) => (r === 'parent' ? 'Téléphone parent' : 'Tablette enfant')} />
            </label>
            <div class="row">
              <button type="button" class="pbtn" onClick={() => setStep('home')}>
                Retour
              </button>
              <button class="pbtn acc" disabled={busy || !dev.token || !dev.owner || !dev.repo}>
                {busy ? 'Connexion…' : 'Connecter'}
              </button>
            </div>
          </form>
        )}

        {step === 'create' && <Create dev={dev} onBack={() => setStep('manual')} />}
        {err && <p class="error">{err}</p>}
      </div>
    </div>
  );
}

function Create({ dev, onBack }: { dev: Device; onBack: () => void }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('0');
  const [code, setCode] = useState('');
  const [code2, setCode2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const valid = name.trim() && /^\d{4}$/.test(code) && code === code2 && /^\d+$/.test(start);

  async function create() {
    setBusy(true);
    setErr('');
    try {
      const salt = newSalt();
      const f = newFile({ childName: name.trim(), startPoints: Number(start), codeHash: await hashCode(code, salt), codeSalt: salt, now: new Date().toISOString() });
      await writeJsonFile(dev, PICO_FILE, f, null, 'Création des données de Pico');
      saveDevice(dev);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      class="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void create();
      }}
    >
      <h1>Création</h1>
      <p class="small">Le dépôt est vide : on crée les données. Le prénom reste dans le dépôt privé.</p>
      <label>
        Prénom de l'enfant
        <input value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <label>
        Bons points de départ
        <input inputMode="numeric" value={start} onInput={(e) => setStart(e.currentTarget.value.replace(/\D/g, ''))} />
      </label>
      <label>
        Code parent (4 chiffres)
        <input type="password" inputMode="numeric" maxLength={4} value={code} onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, ''))} />
      </label>
      <label>
        Le même code, encore une fois
        <input type="password" inputMode="numeric" maxLength={4} value={code2} onInput={(e) => setCode2(e.currentTarget.value.replace(/\D/g, ''))} />
      </label>
      {code2.length === 4 && code !== code2 && <p class="error">Les deux codes sont différents.</p>}
      <div class="row">
        <button type="button" class="pbtn" onClick={onBack}>
          Retour
        </button>
        <button class="pbtn acc" disabled={!valid || busy}>
          {busy ? 'Création…' : 'Créer'}
        </button>
      </div>
      {err && <p class="error">{err}</p>}
    </form>
  );
}
