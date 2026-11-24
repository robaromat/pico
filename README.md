# Pico

Petite app de bons points avec Pico, le hérisson (PWA personnelle, GitHub Pages).

- App : https://robaromat.github.io/pico/
- Stack : Vite + TypeScript, service worker maison, données dans un dépôt privé séparé.

```
npm install
npm run dev
npm run build
npm run icons   # régénère les icônes à partir du dessin de Pico
```

- Page de test de l'appareil : `…/pico/#test` (stockage, réseau, hors connexion, son, plein écran paysage).
- Appli Android (dossier `android/`) : la même page dans sa propre WebView, compilée par GitHub Actions (release « android »).
