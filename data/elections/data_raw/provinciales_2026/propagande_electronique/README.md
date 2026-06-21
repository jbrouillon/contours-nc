# Propagande électronique — provinciales 2026

Ce dossier contient les circulaires numériques publiées par le
[Haut-commissariat de la République en Nouvelle-Calédonie](https://www.nouvelle-caledonie.gouv.fr/Actions-de-l-Etat/Elections/Elections-2026/Elections-provinciales-2026/Propagande-electronique).

Le fichier `manifest.csv` conserve, pour chaque document, la province, le numéro
et le nom de la liste, l’URL officielle, la date de collecte, la taille du fichier
et son empreinte MD5.

Pour mettre à jour le corpus depuis la racine du projet :

```powershell
& "C:\Program Files\R\R-4.5.2\bin\Rscript.exe" scripts/download_propagande_provinciales_2026.R
```

Les documents d’information publiés par l’administration ne sont pas des
bulletins de vote. Ils restent la propriété de leurs auteurs et sont conservés
ici comme sources de l’analyse textuelle.

L’extraction hybride utilise les packages R `pdftools` et `tesseract`. Le script
emploie aussi PyMuPDF pour réparer les PDF qui bloquent Poppler :

```powershell
py -m pip install pymupdf
```
