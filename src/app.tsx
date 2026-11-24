import { useEffect, useState } from 'preact/hooks';
import { device, saveDevice } from './device';
import { updateReady, applyUpdate } from './pwa';
import { KidApp } from './screens/kid/KidApp';
import { ParentApp } from './screens/parent/ParentApp';
import { Setup } from './screens/Setup';
import { data, engine, installSyncTriggers, resetLocal, startSync } from './sync/store';
import { codeAsk, toastMsg } from './ui/ask';
import { CodePad } from './ui/CodePad';
import { Pico } from './ui/Pico';

export function App() {
  const dev = device.value;
  const [parentOnTablet, setParentOnTablet] = useState(false);

  useEffect(() => {
    if (!dev) return;
    void startSync();
    installSyncTriggers();
  }, [dev?.token, dev?.repo, dev?.owner]);

  let screen;
  if (!dev) screen = <Setup />;
  else if (!data.value) screen = <Loading />;
  else if (dev.role === 'child' && !parentOnTablet) screen = <KidApp onParent={() => setParentOnTablet(true)} />;
  else screen = <ParentApp onTablet={dev.role === 'child'} onBack={() => setParentOnTablet(false)} />;

  const ask = codeAsk.value;
  return (
    <>
      {screen}
      {updateReady.value && (
        <button class="update" onClick={applyUpdate}>
          ✨ Nouvelle version de Pico : toucher pour l'installer
        </button>
      )}
      {ask && <CodePad title={ask.title} sub={ask.sub} onOk={() => ask.resolve(true)} onCancel={() => ask.resolve(false)} />}
      {toastMsg.value && (
        <div class="toast" role="status">
          {toastMsg.value}
        </div>
      )}
    </>
  );
}

function Loading() {
  const e = engine.value;
  const failed = e?.status.value === 'error' || (e?.status.value === 'offline' && !e.data.value);
  return (
    <div class="setup">
      <div class="setup-card">
        <Pico expr={failed ? 'wait' : 'hello'} cls="setup-pico bob" />
        {failed ? (
          <>
            <h1>Je n'arrive pas à charger</h1>
            <p class="error">{e?.error.value ?? 'Pas de connexion.'}</p>
            <button class="kbtn" onClick={() => void e?.sync()}>
              Réessayer
            </button>
            <button
              class="linkbtn"
              onClick={() => {
                void resetLocal();
                saveDevice(null);
              }}
            >
              Reconfigurer cet appareil
            </button>
          </>
        ) : (
          <h1>Chargement…</h1>
        )}
      </div>
    </div>
  );
}
