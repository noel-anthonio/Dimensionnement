# PLANIF — Prototype de traitement des besoins

## Fichiers
- `index.html` : structure de la page et navigation
- `styles.css` : interface responsive
- `app.js` : logique JavaScript organisée en classes (POO)

## Démarrage
1. Décompressez le dossier.
2. Ouvrez `index.html` dans un navigateur récent.
3. Pour lire les fichiers Excel `.xlsx`/`.xls`, une connexion Internet est requise pour charger SheetJS depuis le CDN. Le CSV est lu nativement.
4. Importez un fichier dans le menu **REÇU**.

## Fonctions incluses
- Import Excel/CSV, aperçu des lignes, recherche dans les données, validation initiale et export CSV.
- Traitement côté navigateur : les données ne sont pas envoyées par cette application à un serveur.
- Architecture POO : `Application`, `FichierRecu`, `ImportateurFichier`, `ValidateurDonnees`, `VueFichiersRecus`.

## Limites de cette version
- Seule la première feuille du classeur Excel est chargée.
- L'aperçu affiche jusqu'à 100 lignes à la fois.
- Les menus Hypothèses et Résultats sont réservés aux prochaines étapes.
- Les règles de calcul des besoins ne sont pas encore implémentées : elles doivent être définies à partir du fichier Excel de référence avant de produire des résultats fiables.
- Pour un usage totalement hors ligne, il faudra intégrer localement la bibliothèque de lecture Excel au lieu du CDN.


## Schéma strict du menu REÇU
L'importation est désormais normalisée vers ces 12 colonnes, dans cet ordre exact :
`Date`, `Heure`, `Reçu`, `Statut`, `Source du données`, `Jour semaine`, `Semaine`, `Mois`, `Année`, `Semaine - Année`, `Services`, `Activités`.
Les colonnes manquantes sont signalées comme erreurs; les colonnes supplémentaires sont signalées et ignorées. Les valeurs ne sont pas inventées pour les colonnes manquantes.


## Modification des données

Dans l’aperçu REÇU, cliquez sur une cellule pour modifier sa valeur. Appuyez sur Entrée ou cliquez ailleurs pour enregistrer, ou sur Échap pour annuler. La colonne d’affichage supplémentaire **Old Statut** est placée en dernière position. Les modifications sont conservées dans la session de la page et incluses dans l’export CSV, mais ne modifient pas le fichier source original.

## Version 0.4 — modification contrôlée

- L'affichage reste en mode lecture par défaut : aucune cellule ne passe en édition au simple clic.
- Le bouton **Modifier les cellules** active l'édition individuelle. Entrée valide une cellule et Échap annule.
- Le bouton **Modifier une colonne** ouvre une fenêtre dédiée pour remplacer toute une colonne ou uniquement une valeur précise.
- Une opération globale demande confirmation et propose une annulation de la dernière modification globale.
- Le périmètre de l'opération globale peut viser toutes les lignes ou uniquement les lignes correspondant à la recherche courante.
- L'export CSV inclut toutes les lignes du fichier, y compris celles qui ne sont pas visibles à cause de la recherche.
- Les modifications restent en mémoire dans la page ; exportez le CSV pour conserver durablement les changements.
