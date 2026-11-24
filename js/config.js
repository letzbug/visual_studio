/* Configuration publique de l'application.
   Ne jamais placer de clé API ici : ce fichier est lisible par tout le monde.
   Les clés vivent uniquement dans le Worker (voir worker/cloudflare-worker.example.js). */
window.UVS_CONFIG = {
  version: '0.2',
  // URL du Worker Cloudflare qui relaie les appels vers les API d'images.
  // Vide = aucun fournisseur IA connecté, seul le mode démo est disponible.
  workerUrl: 'https://unipop-visual-studio.letzbug.workers.dev'
};
