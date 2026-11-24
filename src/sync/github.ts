import { base64ToUtf8, utf8ToBase64 } from '../lib/base64';

// Lecture / écriture de pico.json dans le dépôt privé via l'API GitHub Contents (repris de Boire & Manger).
// Chaque écriture envoie le sha de la version lue : si un autre appareil a écrit entre-temps, GitHub refuse
// (409/422) et le moteur de synchro fusionne puis réessaie.

export interface RepoRef {
  token: string;
  owner: string;
  repo: string;
}

export interface RemoteFile<T> {
  data: T;
  sha: string;
}

export type GitHubErrorKind = 'auth' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limit' | 'network' | 'invalid' | 'server';

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export const PICO_FILE = 'pico.json';
const API = 'https://api.github.com';

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const repoUrl = (r: RepoRef) => `${API}/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}`;
const contentsUrl = (r: RepoRef, path: string) => `${repoUrl(r)}/contents/${path}`;

async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = import.meta.env.DEV && url.includes('/repos/demo/') ? await fakeGitHub(url, init) : await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new GitHubError('network', 'Pas de connexion à Internet.');
  }
  if (res.ok) return res;
  const status = res.status;
  if (status === 401) throw new GitHubError('auth', 'Jeton GitHub refusé : il a peut-être expiré ou été mal copié.', status);
  if (status === 403 || status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || status === 429)
      throw new GitHubError('rate_limit', 'Trop de requêtes vers GitHub, nouvel essai dans quelques minutes.', status);
    throw new GitHubError('forbidden', "Le jeton n'a pas le droit d'écrire dans ce dépôt (permission Contents : Read and write).", status);
  }
  if (status === 404) throw new GitHubError('not_found', 'Dépôt ou fichier introuvable.', status);
  if (status === 409 || status === 422) throw new GitHubError('conflict', 'Le fichier a changé sur GitHub entre-temps.', status);
  throw new GitHubError('server', `GitHub a répondu ${status}.`, status);
}

interface ContentsResponse {
  sha: string;
  content?: string;
  encoding?: string;
}

export async function readJsonFile<T>(r: RepoRef, path: string, parse: (raw: unknown) => T | null): Promise<RemoteFile<T>> {
  const res = await request(contentsUrl(r, path), { headers: headers(r.token) });
  const body = (await res.json()) as ContentsResponse;
  let text: string;
  if (body.encoding === 'base64' && body.content !== undefined && body.content !== '') {
    text = base64ToUtf8(body.content);
  } else {
    // Au-delà de 1 Mo, l'API Contents ne renvoie pas le contenu : on passe par le blob.
    const blobRes = await request(`${repoUrl(r)}/git/blobs/${body.sha}`, { headers: headers(r.token) });
    text = base64ToUtf8(((await blobRes.json()) as { content: string }).content);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GitHubError('invalid', `${path} n'est pas un JSON valide.`);
  }
  const data = parse(parsed);
  if (!data) throw new GitHubError('invalid', `${path} n'a pas le format attendu.`);
  return { data, sha: body.sha };
}

export async function writeJsonFile<T>(r: RepoRef, path: string, data: T, sha: string | null, message: string): Promise<string> {
  const res = await request(contentsUrl(r, path), {
    method: 'PUT',
    headers: { ...headers(r.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(JSON.stringify(data, null, 1) + '\n'),
      ...(sha ? { sha } : {}),
    }),
  });
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

export type ConnectionTest = { ok: true; hasFile: boolean } | { ok: false; message: string };

/** Pour l'installation : le dépôt est-il accessible avec ce jeton, et contient-il déjà pico.json ? */
export async function testRepo(r: RepoRef): Promise<ConnectionTest> {
  try {
    await request(repoUrl(r), { headers: headers(r.token) });
  } catch (e) {
    const ge = e as GitHubError;
    if (ge.kind === 'not_found') return { ok: false, message: `Dépôt ${r.owner}/${r.repo} introuvable, ou le jeton n'y a pas accès.` };
    return { ok: false, message: ge.message };
  }
  try {
    await request(contentsUrl(r, PICO_FILE), { headers: headers(r.token) });
    return { ok: true, hasFile: true };
  } catch (e) {
    if ((e as GitHubError).kind === 'not_found') return { ok: true, hasFile: false };
    return { ok: false, message: (e as GitHubError).message };
  }
}

/**
 * Développement seulement (compte « demo ») : faux dépôt rangé dans localStorage, pour essayer l'app
 * sans jeton. Absent de la version publiée (import.meta.env.DEV vaut false au build).
 */
async function fakeGitHub(url: string, init: RequestInit): Promise<Response> {
  const KEY = 'pico-demo-repo';
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { sha: string; content: string } | null;
  await new Promise((r) => setTimeout(r, 150));
  if (!url.includes('/contents/')) return json({ name: 'demo' });
  if ((init.method ?? 'GET') === 'GET') return stored ? json({ sha: stored.sha, content: stored.content, encoding: 'base64' }) : json({}, 404);
  const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
  if ((stored?.sha ?? undefined) !== body.sha) return json({ message: 'conflict' }, 409);
  const sha = Math.random().toString(16).slice(2);
  localStorage.setItem(KEY, JSON.stringify({ sha, content: body.content }));
  return json({ content: { sha } });
}
