# Dimensionnement — Référence global canal

## Modifications de cette version
- Affichage des poids journaliers avec deux chiffres après la virgule (ex. 18,25 %).
- Arrondi par la méthode des plus forts restes afin que le total affiché de chaque traitement reste exactement égal à 100,00 %.
- Suppression de la colonne « Volume semaine » dans le tableau des résultats.
- Ajout d'un filtre multi-sélection « Semaine - année » : sélectionnez une ou plusieurs semaines avec Ctrl + clic. Sans sélection, toutes les semaines sont incluses.
- Le bouton « Effacer le filtre » rétablit l'analyse de toutes les semaines.
- Le calcul reste automatique à partir de REÇU : regroupement par valeur de « Traitement », somme de « Reçu » et répartition du lundi au dimanche.

## Installation
1. Décompressez l'archive dans un nouveau dossier.
2. Conservez votre fichier `.env` local (il n'est pas inclus dans l'archive).
3. Installez les dépendances si nécessaire avec `npm install`.
4. Démarrez l'application avec la commande habituelle `npm start`.
5. Ouvrez « Calculs intermédiaires » puis « Référence global canal ».

Les fichiers `index.html`, `app.js`, `styles.css`, `server.js`, `package.json` et le logo PostgreSQL sont inclus.

## Référence par heure canal

La page **Calculs intermédiaires** contient désormais une seconde référence : **Référence par heure canal**. Elle répartit les volumes `Reçu` par heure de 0 à 23, séparément pour chaque valeur `Traitement` (canal). Pour chaque traitement et chaque jour de semaine, les 24 poids horaires totalisent 100,00 %.

L'heure est recherchée dans une colonne `Heure` (ou variante reconnue). À défaut, elle est extraite d'une colonne date/horodatage contenant une heure au format `HH:mm`. La sélection de semaines existante s'applique aux deux références. Le bouton **Actualiser le calcul** recalcule les deux tableaux à partir des données REÇU actuellement chargées.


### Présentation horaire et détail par jour
- Les heures sont libellées de 0 à 23 (sans suffixe « h »).
- Chaque traitement dispose de sa propre matrice : les jours (lundi à dimanche) sont affichés en lignes et les heures (0 à 23) en colonnes. Chaque ligne jour répartit son volume sur les 24 heures et totalise 100,00 %.
- Le jour est lu depuis `Jour Sem` / `Jour semaine` lorsqu’il existe, sinon déduit de la date.
- L’affichage utilise une grille responsive sans barre de défilement horizontale. Une mise en forme conditionnelle simple colore les poids selon leur intensité : faible, moyenne, élevée ou très élevée ; les valeurs nulles restent grisées.
