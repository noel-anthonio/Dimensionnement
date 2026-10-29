/* Application Dimensionnement — architecture orientée objet (POO). */
"use strict";

/* Profils client/campagne : chaque couple possède son Reçu et ses prévisions. */
function normaliserProfilTexte(v) { return String(v ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim(); }
function cleProfil(client, campagne) { return `${normaliserProfilTexte(client)}::${normaliserProfilTexte(campagne)}`; }
function profilActif() { return window.dimensionnementProfil || { client: "", campagne: "", cle: cleProfil("", "") }; }
function lireProfils() { try { const v = JSON.parse(localStorage.getItem("dimensionnement.profils.v1")) || []; return Array.isArray(v) ? v : []; } catch { return []; } }
function sauvegarderProfilIndex(client, campagne) {
  if (!client.trim() || !campagne.trim()) return;
  const profils = lireProfils(); const cle = cleProfil(client, campagne);
  if (!profils.some(p => p.cle === cle)) profils.push({ client: client.trim(), campagne: campagne.trim(), cle });
  try { localStorage.setItem("dimensionnement.profils.v1", JSON.stringify(profils)); } catch {}
}
function ajouterHistoriqueRecu(entree) {
  const cle = "planif.previsions.historique.v1"; let historique = [];
  try { historique = JSON.parse(localStorage.getItem(cle)) || []; } catch {}
  historique.unshift(entree); if (historique.length > 5000) historique.length = 5000;
  try { localStorage.setItem(cle, JSON.stringify(historique)); } catch {}
}

/* Notifications discrètes (bas de l'écran). */
class Toast {
  static afficher(message, type = "ok", duree = 3200) {
    let zone = document.querySelector("#toasts");
    if (!zone) {
      zone = document.createElement("div");
      zone.id = "toasts"; zone.className = "toasts";
      zone.setAttribute("role", "status"); zone.setAttribute("aria-live", "polite");
      document.body.append(zone);
    }
    while (zone.children.length >= 3) zone.firstElementChild.remove();
    const t = document.createElement("div");
    t.className = `toast toast-${type}`; t.style.setProperty("--duree", `${duree}ms`);
    const icone = document.createElement("span"); icone.className = "toast-icone"; icone.textContent = type === "erreur" ? "!" : "✓";
    const texte = document.createElement("span"); texte.textContent = message;
    t.append(icone, texte); zone.append(t);
    window.setTimeout(() => { t.classList.add("toast-sortie"); window.setTimeout(() => t.remove(), 250); }, duree);
  }
}

/* Boîte de dialogue de confirmation (remplace window.confirm) — design premium, utilisable au clavier. */
class Dialogue {
  static confirmer({ titre = "Confirmer", message = "", details = [], libelleConfirmer = "Confirmer", libelleAnnuler = "Annuler", ton = "info", icone = null, surtitre = null } = {}) {
    return new Promise(resolve => {
      const precedent = document.activeElement;
      const uid = `pm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const fond = document.createElement("div");
      fond.className = "pm-backdrop";
      fond.setAttribute("role", "alertdialog");
      fond.setAttribute("aria-modal", "true");
      fond.setAttribute("aria-labelledby", `${uid}-t`);
      fond.setAttribute("aria-describedby", `${uid}-d`);
      const carte = document.createElement("section");
      carte.className = `pm-card pm-card-sm pm-ton-${ton}`;

      const tete = document.createElement("header"); tete.className = "pm-head";
      const badge = document.createElement("span"); badge.className = "pm-badge"; badge.setAttribute("aria-hidden", "true");
      badge.textContent = icone || (ton === "info" ? "?" : "!");
      const bloc = document.createElement("div"); bloc.className = "pm-head-text";
      const ey = document.createElement("span"); ey.className = "pm-eyebrow";
      ey.textContent = surtitre || (ton === "danger" ? "ACTION IRRÉVERSIBLE" : ton === "warn" ? "ATTENTION" : "CONFIRMATION");
      const h = document.createElement("h2"); h.className = "pm-title"; h.id = `${uid}-t`; h.textContent = titre;
      const p = document.createElement("p"); p.className = "pm-sub"; p.id = `${uid}-d`; p.textContent = message;
      bloc.append(ey, h, p); tete.append(badge, bloc);
      carte.append(tete);

      if (details.length) {
        const dl = document.createElement("dl"); dl.className = "pm-details";
        details.forEach(([nom, valeur]) => {
          const ligne = document.createElement("div");
          const dt = document.createElement("dt"); dt.textContent = nom;
          const dd = document.createElement("dd"); dd.textContent = String(valeur); dd.title = String(valeur);
          ligne.append(dt, dd); dl.append(ligne);
        });
        carte.append(dl);
      }

      const pied = document.createElement("footer"); pied.className = "pm-foot";
      const annuler = document.createElement("button"); annuler.type = "button"; annuler.className = "button button-secondary"; annuler.textContent = libelleAnnuler;
      const ok = document.createElement("button"); ok.type = "button";
      ok.className = `button ${ton === "danger" ? "pm-btn-danger" : "button-primary"}`; ok.textContent = libelleConfirmer;
      pied.append(annuler, ok); carte.append(pied); fond.append(carte);

      let ferme = false;
      const clavier = e => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(false); }
        else if (e.key === "Tab") {
          e.preventDefault();
          const f = [annuler, ok], i = f.indexOf(document.activeElement);
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      };
      const fermer = resultat => {
        if (ferme) return; ferme = true;
        document.removeEventListener("keydown", clavier, true);
        fond.classList.add("pm-sortie");
        window.setTimeout(() => {
          fond.remove();
          if (!document.querySelector(".pm-backdrop:not(.hidden)")) document.body.classList.remove("pm-open");
          if (precedent && document.contains(precedent) && precedent.focus) precedent.focus();
        }, 150);
        resolve(resultat);
      };
      annuler.addEventListener("click", () => fermer(false));
      ok.addEventListener("click", () => fermer(true));
      fond.addEventListener("mousedown", e => { if (e.target === fond) fermer(false); });
      document.addEventListener("keydown", clavier, true);
      document.body.append(fond);
      document.body.classList.add("pm-open");
      (ton === "danger" ? annuler : ok).focus();
    });
  }
}

class FichierRecu {
  constructor(file, rows, sheetName = "Données") {
    this.id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    this.nom = file.name;
    this.taille = file.size;
    this.type = file.type || "inconnu";
    this.dateReception = new Date();
    this.nomFeuille = sheetName;
    const schema = SchemaRecu.mapperColonnes(Array.isArray(rows) ? rows : []);
    this.donnees = schema.donnees.map(ligne => ({ ...ligne, "Old Statut": ligne["Old Statut"] ?? "" }));
    this.entetes = [...SchemaRecu.COLONNES, "Old Statut"];
    this.colonnesManquantes = schema.manquantes;
    this.colonnesInconnues = schema.inconnues;
  }

  get nombreLignes() { return this.donnees.length; }
  get nombreColonnes() { return this.entetes.length; }
  get estVide() { return this.nombreLignes === 0; }
}

class SchemaRecu {
  static get COLONNES() {
    return [
      "Date", "Heure", "Reçu", "Statut", "Source de données",
      "Jour semaine", "Semaine", "Mois", "Année", "Semaine - Année",
      "Services", "Activités"
    ];
  }

  static normaliserEntete(value) {
    return String(value ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  static mapperColonnes(rows) {
    if (!rows.length) return { donnees: [], manquantes: [...this.COLONNES], inconnues: [] };
    const clesOriginales = Object.keys(rows[0]);
    const indexParEntete = new Map();
    clesOriginales.forEach(cle => indexParEntete.set(this.normaliserEntete(cle), cle));

    const correspondance = new Map();
    this.COLONNES.forEach(colonne => {
      const source = indexParEntete.get(this.normaliserEntete(colonne));
      if (source !== undefined) correspondance.set(colonne, source);
    });

    const donnees = rows.map(row => Object.fromEntries(
      this.COLONNES.map(colonne => [
        colonne,
        correspondance.has(colonne) ? (row[correspondance.get(colonne)] ?? "") : ""
      ])
    ));
    const manquantes = this.COLONNES.filter(colonne => !correspondance.has(colonne));
    const connues = new Set([...correspondance.values()]);
    const inconnues = clesOriginales.filter(cle => !connues.has(cle));
    return { donnees, manquantes, inconnues };
  }
}

class ImportateurFichier {
  async importer(file) {
    if (!file) throw new Error("Veuillez sélectionner un fichier.");
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(extension)) {
      throw new Error("Format non pris en charge. Utilisez un fichier Excel (.xlsx, .xls) ou CSV.");
    }

    let rows;
    let sheetName = "Données";
    if (extension === "csv") {
      const content = await file.text();
      rows = this.lireCSV(content);
    } else {
      if (!window.XLSX) {
        throw new Error("La bibliothèque de lecture Excel n'est pas disponible. Vérifiez votre connexion Internet puis rechargez la page. Vous pouvez aussi importer un CSV.");
      }
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      sheetName = workbook.SheetNames[0] || "Données";
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    }
    return new FichierRecu(file, rows, sheetName);
  }

  lireCSV(content) {
    const premiereLigne = content.split(/\r?\n/, 1)[0] || "";
    const separateur = (premiereLigne.match(/;/g) || []).length > (premiereLigne.match(/,/g) || []).length ? ";" : ",";
    const lignes = [];
    let ligne = [], valeur = "", guillemets = false;
    for (let i = 0; i < content.length; i++) {
      const c = content[i], suivant = content[i + 1];
      if (c === '"' && guillemets && suivant === '"') { valeur += '"'; i++; }
      else if (c === '"') guillemets = !guillemets;
      else if (c === separateur && !guillemets) { ligne.push(valeur); valeur = ""; }
      else if ((c === "\n" || c === "\r") && !guillemets) {
        if (c === "\r" && suivant === "\n") i++;
        ligne.push(valeur); valeur = "";
        if (ligne.some(cell => String(cell).trim() !== "")) lignes.push(ligne);
        ligne = [];
      } else valeur += c;
    }
    ligne.push(valeur);
    if (ligne.some(cell => String(cell).trim() !== "")) lignes.push(ligne);
    if (lignes.length < 2) return [];
    const entetes = lignes.shift().map((h, i) => String(h).trim() || `Colonne ${i + 1}`);
    return lignes.map(l => Object.fromEntries(entetes.map((h, i) => [h, l[i] ?? ""])));
  }
}

class ValidateurDonnees {
  analyser(fichier) {
    const erreurs = [];
    const avertissements = [];
    if (fichier.estVide) erreurs.push("Le fichier ne contient aucune ligne de données exploitable.");
    if (fichier.colonnesManquantes.length) {
      erreurs.push(`Colonnes obligatoires absentes : ${fichier.colonnesManquantes.join(", ")}.`);
    }
    if (fichier.colonnesInconnues.length) {
      avertissements.push(`Colonnes supplémentaires ignorées : ${fichier.colonnesInconnues.join(", ")}.`);
    }
    const lignesVides = fichier.donnees.filter(row => Object.values(row).every(v => String(v ?? "").trim() === "")).length;
    if (lignesVides) avertissements.push(`${lignesVides} ligne(s) vide(s) détectée(s).`);
    return { valide: erreurs.length === 0, erreurs, avertissements };
  }
}

class VueFichiersRecus {
  constructor() {
    this.fileInput = document.querySelector("#fileInput");
    this.dropZone = document.querySelector("#dropZone");
    this.tableWrap = document.querySelector("#tableWrap");
    this.fileStatus = document.querySelector("#fileStatus");
    this.searchInput = document.querySelector("#searchInput");
    this.clearButton = document.querySelector("#clearFile");
    this.exportButton = document.querySelector("#exportCsv");
    this.editModeButton = document.querySelector("#editModeButton");
    this.bulkEditButton = document.querySelector("#bulkEditButton");
    this.pageSizeSelect = document.querySelector("#recuPageSize");
    this.pageFirstButton = document.querySelector("#recuPageFirst");
    this.pagePrevButton = document.querySelector("#recuPagePrev");
    this.pageNextButton = document.querySelector("#recuPageNext");
    this.pageLastButton = document.querySelector("#recuPageLast");
    this.pageInfo = document.querySelector("#recuPageInfo");
    this.bulkEditModal = document.querySelector("#bulkEditModal");
    this.modeEdition = false;
    this.pageActuelle = 1;
    this.taillePage = 100;
    this.historiqueOperation = null;
    this.fichierActuel = null;
    this.fichiersSession = 0;
    this.lignesAffichees = [];
    this.clientInput = document.querySelector("#activeClient");
    this.campagneInput = document.querySelector("#activeCampaign");
    this.profileDialog = document.querySelector("#clientCampaignDialog");
    this.pendingImportFile = null;
    this.profileDialogMode = "import";
    this.reuseSelect = document.querySelector("#reuseReceivedFile");
    this.reuseButton = document.querySelector("#reuseReceivedFileButton");
    this.treeHost = document.querySelector("#clientCampaignTree");
    this.treeExpandedClients = new Set();
    this.treeExpandedCampaigns = new Set();
    this.profils = lireProfils();
    this.restaurerDernierProfil();
    this.clientInput.addEventListener("input", () => { this.actualiserListeCampagnes(); this.actualiserListeFichiersAnciens(); });
    this.campagneInput.addEventListener("input", () => this.actualiserListeFichiersAnciens());
    document.querySelector("#clientCampaignDialogClose").addEventListener("click", () => this.fermerDialogueProfil());
    document.querySelector("#clientCampaignDialogCancel").addEventListener("click", () => this.fermerDialogueProfil());
    document.querySelector("#clientCampaignDialogConfirm").addEventListener("click", () => this.confirmerDialogueProfil());
    this.profileDialog.addEventListener("click", e => { if (e.target === this.profileDialog) this.fermerDialogueProfil(); });
    this.reuseSelect.addEventListener("change", () => { this.reuseButton.disabled = this.reuseSelect.value === ""; });
    this.reuseButton.addEventListener("click", () => this.reutiliserAncienFichier());
    this.treeHost?.addEventListener("click", e => this.gererClicArborescence(e));
    this.lierEvenements();
    this.actualiserArborescence();
  }

  ouvrirDialogueProfil(mode = "import", file = null) {
    this.profileDialogMode = mode;
    this.pendingImportFile = file;
    const titre = document.querySelector("#clientCampaignDialogTitle");
    const desc = document.querySelector("#clientCampaignDialogDesc");
    const bouton = document.querySelector("#clientCampaignDialogConfirm");
    if (mode === "export") {
      titre.textContent = "Confirmer le profil avant l’export";
      desc.textContent = "Vérifiez le client et la campagne associés au fichier exporté. Le nom du fichier suivra le format CLIENT_CAMPAGNE.";
      bouton.textContent = "Confirmer et exporter ↗";
    } else {
      titre.textContent = "Associer un client et une campagne";
      desc.textContent = "Renseignez ces informations avant l’import pour classer le fichier et conserver son historique.";
      bouton.textContent = "Confirmer et importer ↗";
    }
    const profil = profilActif();
    this.clientInput.value = profil.client || this.clientInput.value || "";
    this.campagneInput.value = profil.campagne || this.campagneInput.value || "";
    this.actualiserListeCampagnes();
    this.actualiserListeFichiersAnciens();
    this.profileDialog.classList.remove("hidden");
    this.profileDialog.classList.add("flex");
    setTimeout(() => this.clientInput.focus(), 0);
  }
  fermerDialogueProfil() {
    this.profileDialog?.classList.add("hidden");
    this.profileDialog?.classList.remove("flex");
    if (this.profileDialogMode === "import" && this.pendingImportFile) this.fileInput.value = "";
    this.pendingImportFile = null;
  }
  confirmerDialogueProfil() {
    const client = this.clientInput.value.trim();
    const campagne = this.campagneInput.value.trim();
    if (!client || !campagne) {
      Toast.afficher("Le client et la campagne sont obligatoires.", "erreur", 4000);
      (!client ? this.clientInput : this.campagneInput).focus();
      return;
    }
    const mode = this.profileDialogMode;
    const file = this.pendingImportFile;
    if (mode === "export") {
      const fichierClient = String(this.fichierActuel?.client || profilActif().client || "").trim();
      const fichierCampagne = String(this.fichierActuel?.campagne || profilActif().campagne || "").trim();
      if (normaliserProfilTexte(client) !== normaliserProfilTexte(fichierClient) || normaliserProfilTexte(campagne) !== normaliserProfilTexte(fichierCampagne)) {
        Toast.afficher("Ce fichier appartient à un autre profil. Ouvrez d’abord la campagne souhaitée dans l’arborescence.", "erreur", 5000);
        return;
      }
      this.fermerDialogueProfil();
      this.exporterCSV(`${client}_${campagne}`);
      return;
    }
    this.clientInput.value = client; this.campagneInput.value = campagne;
    this.appliquerProfilActif(true);
    sauvegarderProfilIndex(client, campagne);
    this.profils = lireProfils();
    this.actualiserListeCampagnes(); this.actualiserListeFichiersAnciens(); this.actualiserArborescence();
    this.fermerDialogueProfil();
    if (file) this.traiterFichier(file, true);
  }

  restaurerDernierProfil() {
    const dernier = (() => { try { return JSON.parse(localStorage.getItem("dimensionnement.profilActif.v1")) || {}; } catch { return {}; } })();
    this.clientInput.value = dernier.client || ""; this.campagneInput.value = dernier.campagne || "";
    this.actualiserListeCampagnes(); this.appliquerProfilActif(true);
  }
  actualiserListeCampagnes() {
    const liste = document.querySelector("#knownCampaigns"); if (!liste) return;
    const client = this.clientInput.value.trim();
    const campagnes = [...new Set(this.profils.filter(p => !client || normaliserProfilTexte(p.client) === normaliserProfilTexte(client)).map(p => p.campagne))].sort((a,b) => a.localeCompare(b,"fr",{sensitivity:"base"}));
    liste.replaceChildren(...campagnes.map(c => { const o = document.createElement("option"); o.value = c; return o; }));
  }
  changerProfil() {
    this.actualiserListeCampagnes();
    const client = this.clientInput.value.trim(), campagne = this.campagneInput.value.trim();
    if (!client || !campagne) {
      window.dimensionnementProfil = { client, campagne, cle: cleProfil(client,campagne) };
      document.querySelector("#activeProfileStatus").textContent = "Renseignez le client et la campagne avant d’importer un fichier.";
      return;
    }
    this.appliquerProfilActif(true);
  }
  appliquerProfilActif(charger = true) {
    const client = this.clientInput.value.trim(), campagne = this.campagneInput.value.trim(), cle = cleProfil(client,campagne);
    window.dimensionnementProfil = { client, campagne, cle };
    try { localStorage.setItem("dimensionnement.profilActif.v1", JSON.stringify({client,campagne})); } catch {}
    document.querySelector("#activeProfileStatus").textContent = client && campagne ? `Profil actif : ${client} / ${campagne}. Le fichier Reçu et les prévisions seront conservés séparément.` : "Sélectionnez un client et une campagne avant d’importer un fichier.";
    this.actualiserListeFichiersAnciens();
    this.actualiserArborescence();
    if (!charger || !client || !campagne) return;
    const stock = (() => { try { return JSON.parse(localStorage.getItem("dimensionnement.recu.profils.v1")) || {}; } catch { return {}; } })();
    const sauvegarde = stock[cle];
    if (sauvegarde?.fichier) {
      this.fichierActuel = Object.assign({}, sauvegarde.fichier);
      Object.setPrototypeOf(this.fichierActuel, FichierRecu.prototype);
      this.fichierActuel.dateReception = new Date(sauvegarde.fichier.dateReception || Date.now());
      this.fichierActuel.client = client; this.fichierActuel.campagne = campagne;
      this.fichiersSession++;
      const bilan = new ValidateurDonnees().analyser(this.fichierActuel);
      this.mettreAJourIndicateurs(this.fichierActuel,bilan); this.afficherTableau();
      this.searchInput.disabled = this.fichierActuel.estVide; this.exportButton.disabled = this.fichierActuel.estVide;
      this.editModeButton.disabled = this.fichierActuel.estVide; this.bulkEditButton.disabled = this.fichierActuel.estVide; this.clearButton.disabled = false;
      this.fileStatus.textContent = `${this.fichierActuel.nom} · ${client} / ${campagne}`;
      document.querySelector("#previewDescription").textContent = `${this.fichierActuel.nomFeuille || "Données"} · ${this.fichierActuel.nombreLignes} ligne(s) · ${client} / ${campagne}`;
    } else {
      this.reinitialiser(false, false);
      this.fileStatus.textContent = `Aucun fichier Reçu enregistré pour ${client} / ${campagne}.`;
    }
    document.dispatchEvent(new CustomEvent("profil:change", { detail: { client, campagne, cle } }));
    document.dispatchEvent(new CustomEvent("recu:donnees-modifiees"));
  }
  obtenirArborescenceDonnees() {
    let stock = {}; try { stock = JSON.parse(localStorage.getItem("dimensionnement.recu.profils.v1")) || {}; } catch {}
    const profils = new Map();
    (Array.isArray(this.profils) ? this.profils : []).forEach(p => { if (p?.client && p?.campagne) profils.set(p.cle || cleProfil(p.client,p.campagne), { client:p.client, campagne:p.campagne, cle:p.cle || cleProfil(p.client,p.campagne) }); });
    Object.entries(stock).forEach(([cle, entree]) => { if (entree?.client && entree?.campagne) profils.set(cle, { client:entree.client, campagne:entree.campagne, cle }); });
    const clients = new Map();
    for (const profil of profils.values()) {
      const sauvegarde = stock[profil.cle] || { historiqueFichiers: [] };
      const fichiers = [];
      if (sauvegarde.fichier) fichiers.push({ ...sauvegarde.fichier, courant:true });
      (Array.isArray(sauvegarde.historiqueFichiers) ? sauvegarde.historiqueFichiers : []).forEach(f => fichiers.push({ ...f, courant:false }));
      const nomClient = profil.client;
      if (!clients.has(nomClient)) clients.set(nomClient, []);
      clients.get(nomClient).push({ ...profil, fichiers });
    }
    return [...clients.entries()].map(([client,campagnes]) => ({ client, campagnes:campagnes.sort((a,b)=>a.campagne.localeCompare(b.campagne,"fr",{sensitivity:"base"})) }))
      .sort((a,b)=>a.client.localeCompare(b.client,"fr",{sensitivity:"base"}));
  }
  actualiserArborescence() {
    if (!this.treeHost) return;
    this.profils = lireProfils();
    const clients = this.obtenirArborescenceDonnees();
    const nbCampagnes = clients.reduce((n,c)=>n+c.campagnes.length,0);
    const count = document.querySelector("#clientCampaignTreeCount");
    if (count) count.textContent = `${clients.length} client${clients.length!==1?"s":""} · ${nbCampagnes} campagne${nbCampagnes!==1?"s":""}`;
    if (!clients.length) { this.treeHost.innerHTML = '<div class="tree-empty">Aucun profil enregistré. Importez un fichier reçu et renseignez le client et la campagne dans la fenêtre qui s’ouvre.</div>'; return; }
    const actif = profilActif();
    this.treeHost.replaceChildren();
    clients.forEach(({client,campagnes}) => {
      const clientWrap = document.createElement("div"); clientWrap.className = "tree-client";
      const clientKey = normaliserProfilTexte(client); const clientOpen = this.treeExpandedClients.has(clientKey) || normaliserProfilTexte(actif.client)===clientKey;
      const clientButton = document.createElement("button"); clientButton.type="button"; clientButton.className="tree-node tree-client-node"; clientButton.dataset.treeAction="client"; clientButton.dataset.client=client; clientButton.setAttribute("aria-expanded",String(clientOpen));
      clientButton.innerHTML = `<span class="tree-chevron">${clientOpen?"⌄":"›"}</span><span class="tree-folder-icon">▣</span><span class="tree-node-name"></span><span class="tree-node-meta">${campagnes.length} campagne${campagnes.length!==1?"s":""}</span>`; clientButton.querySelector(".tree-node-name").textContent=client;
      const clientLine=document.createElement("div"); clientLine.className="tree-node-line"; clientLine.append(clientButton);
      const deleteClient=document.createElement("button"); deleteClient.type="button"; deleteClient.className="tree-delete-button"; deleteClient.dataset.treeAction="remove-client"; deleteClient.dataset.client=client; deleteClient.title=`Supprimer l’arborescence ${client}`; deleteClient.setAttribute("aria-label",deleteClient.title); deleteClient.textContent="×"; clientLine.append(deleteClient); clientWrap.append(clientLine);
      if (clientOpen) {
        const campaignList=document.createElement("div"); campaignList.className="tree-children";
        campagnes.forEach(profil => {
          const campKey=`${clientKey}::${normaliserProfilTexte(profil.campagne)}`; const campOpen=this.treeExpandedCampaigns.has(campKey)|| (normaliserProfilTexte(actif.client)===clientKey && normaliserProfilTexte(actif.campagne)===normaliserProfilTexte(profil.campagne));
          const campWrap=document.createElement("div"); campWrap.className="tree-campaign";
          const campButton=document.createElement("button"); campButton.type="button"; campButton.className="tree-node tree-campaign-node"; campButton.dataset.treeAction="campaign"; campButton.dataset.client=client; campButton.dataset.campaign=profil.campagne; campButton.setAttribute("aria-expanded",String(campOpen));
          campButton.innerHTML=`<span class="tree-chevron">${campOpen?"⌄":"›"}</span><span class="tree-folder-icon">▱</span><span class="tree-node-name"></span><span class="tree-node-meta">${profil.fichiers.length} fichier${profil.fichiers.length!==1?"s":""}</span>`; campButton.querySelector(".tree-node-name").textContent=profil.campagne;
          if (normaliserProfilTexte(actif.client)===clientKey && normaliserProfilTexte(actif.campagne)===normaliserProfilTexte(profil.campagne)) campButton.classList.add("is-active");
          const campaignLine=document.createElement("div"); campaignLine.className="tree-node-line"; campaignLine.append(campButton);
          const deleteCampaign=document.createElement("button"); deleteCampaign.type="button"; deleteCampaign.className="tree-delete-button"; deleteCampaign.dataset.treeAction="remove-campaign"; deleteCampaign.dataset.client=client; deleteCampaign.dataset.campaign=profil.campagne; deleteCampaign.title=`Supprimer ${client}_${profil.campagne}`; deleteCampaign.setAttribute("aria-label",deleteCampaign.title); deleteCampaign.textContent="×"; campaignLine.append(deleteCampaign); campWrap.append(campaignLine);
          if(campOpen){
            const files=document.createElement("div"); files.className="tree-files";
            if(!profil.fichiers.length){const empty=document.createElement("div");empty.className="tree-file-empty";empty.textContent="Aucun fichier importé";files.append(empty);}
            profil.fichiers.forEach(f=>{const b=document.createElement("button");b.type="button";b.className="tree-node tree-file-node";b.dataset.treeAction="file";b.dataset.client=client;b.dataset.campaign=profil.campagne;b.dataset.fileId=String(f.id||"");b.dataset.current=f.courant?"1":"0";const d=f.dateReception?new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short"}).format(new Date(f.dateReception)):"Date inconnue";const rows=Array.isArray(f.donnees)?f.donnees.length:0;b.innerHTML=`<span class="tree-file-icon">${f.courant?"●":"↳"}</span><span class="tree-file-content"><span class="tree-file-name"></span><span class="tree-file-detail"></span></span><span class="tree-file-badge">${f.courant?"Actuel":"Historique"}</span>`;b.querySelector(".tree-file-name").textContent=f.nom||"Fichier reçu";b.querySelector(".tree-file-detail").textContent=`${d} · ${rows.toLocaleString("fr-FR")} ligne(s)`;files.append(b);});
            campWrap.append(files);
          }
          campaignList.append(campWrap);
        });
        clientWrap.append(campaignList);
      }
      this.treeHost.append(clientWrap);
    });
  }
  gererClicArborescence(e) {
    const bouton=e.target.closest("button[data-tree-action]"); if(!bouton) return;
    const action=bouton.dataset.treeAction, client=bouton.dataset.client||"", campagne=bouton.dataset.campaign||"";
    if (action === "remove-client" || action === "remove-campaign") { this.supprimerArborescence(action, client, campagne); return; }
    if(action==="client"){const key=normaliserProfilTexte(client);this.treeExpandedClients.has(key)?this.treeExpandedClients.delete(key):this.treeExpandedClients.add(key);this.actualiserArborescence();return;}
    const clientKey=normaliserProfilTexte(client), campKey=`${clientKey}::${normaliserProfilTexte(campagne)}`;
    this.clientInput.value=client;this.campagneInput.value=campagne;this.actualiserListeCampagnes();this.appliquerProfilActif(false);
    if(action==="campaign"){this.treeExpandedClients.add(clientKey);this.treeExpandedCampaigns.has(campKey)?this.treeExpandedCampaigns.delete(campKey):this.treeExpandedCampaigns.add(campKey);this.appliquerProfilActif(true);this.actualiserArborescence();return;}
    if(action==="file"){
      const {profil,stock,sauvegarde}=this.obtenirStockProfilActif();const fileId=bouton.dataset.fileId;
      const fichiers=[...(sauvegarde.fichier?[{...sauvegarde.fichier,courant:true}]:[]),...(Array.isArray(sauvegarde.historiqueFichiers)?sauvegarde.historiqueFichiers.map(f=>({...f,courant:false})):[])];
      const choisi=fichiers.find(f=>String(f.id||"")===fileId && (f.courant?"1":"0")===bouton.dataset.current);
      if(!choisi){Toast.afficher("Ce fichier n’est plus disponible dans l’historique.","erreur");this.actualiserArborescence();return;}
      if(!choisi.courant){const reste=fichiers.filter(f=>!f.courant && f.id!==choisi.id).map(({courant,...f})=>f);if(sauvegarde.fichier && sauvegarde.fichier.id!==choisi.id)reste.unshift(sauvegarde.fichier);if(reste.length>100)reste.length=100;const {courant,...serialise}=choisi;stock[profil.cle]={client,campagne,fichier:{...serialise,client,campagne},historiqueFichiers:reste};try{localStorage.setItem("dimensionnement.recu.profils.v1",JSON.stringify(stock));}catch{Toast.afficher("Espace de stockage local insuffisant.","erreur",5000);return;}}
      this.appliquerProfilActif(true);this.actualiserArborescence();Toast.afficher(choisi.courant?`Campagne ouverte : ${campagne}`:`Version restaurée : ${choisi.nom||"Fichier reçu"}`);
    }
  }

  supprimerArborescence(action, client, campagne = "") {
    const cible = action === "remove-client" ? `le client « ${client} » et toutes ses campagnes` : `la campagne « ${client}_${campagne} »`;
    if (!confirm(`Supprimer définitivement ${cible} et les fichiers reçus enregistrés dans cette arborescence ? Cette action est irréversible.`)) return;
    const estClient = p => normaliserProfilTexte(p.client) === normaliserProfilTexte(client);
    const estCampagne = p => !campagne || normaliserProfilTexte(p.campagne) === normaliserProfilTexte(campagne);
    const profils = lireProfils().filter(p => !(estClient(p) && estCampagne(p)));
    try { localStorage.setItem("dimensionnement.profils.v1", JSON.stringify(profils)); } catch {}
    let stock = {}; try { stock = JSON.parse(localStorage.getItem("dimensionnement.recu.profils.v1")) || {}; } catch {}
    Object.keys(stock).forEach(k => { const p = stock[k]; if (p && estClient(p) && estCampagne(p)) delete stock[k]; });
    try { localStorage.setItem("dimensionnement.recu.profils.v1", JSON.stringify(stock)); } catch {}
    let historique = []; try { historique = JSON.parse(localStorage.getItem("planif.previsions.historique.v1")) || []; } catch {}
    historique = historique.filter(h => !(estClient(h) && estCampagne(h)));
    try { localStorage.setItem("planif.previsions.historique.v1", JSON.stringify(historique)); } catch {}
    const actif = profilActif();
    if (estClient(actif) && estCampagne(actif)) {
      this.clientInput.value = ""; this.campagneInput.value = "";
      window.dimensionnementProfil = { client:"", campagne:"", cle:cleProfil("", "") };
      try { localStorage.removeItem("dimensionnement.profilActif.v1"); } catch {}
      this.reinitialiser(false, false);
    }
    this.profils = lireProfils(); this.actualiserListeCampagnes(); this.actualiserListeFichiersAnciens(); this.actualiserArborescence();
    Toast.afficher(action === "remove-client" ? "Arborescence client supprimée." : "Campagne supprimée de l’arborescence.");
  }

  obtenirStockProfilActif() {
    const profil = profilActif();
    let stock = {}; try { stock = JSON.parse(localStorage.getItem("dimensionnement.recu.profils.v1")) || {}; } catch {}
    return { profil, stock, sauvegarde: stock[profil.cle] || { historiqueFichiers: [] } };
  }
  actualiserListeFichiersAnciens() {
    if (!this.reuseSelect || !this.reuseButton) return;
    const { profil, sauvegarde } = this.obtenirStockProfilActif();
    const anciens = Array.isArray(sauvegarde.historiqueFichiers) ? sauvegarde.historiqueFichiers : [];
    const optionVide = document.createElement("option");
    optionVide.value = "";
    optionVide.textContent = anciens.length ? "Sélectionner une ancienne version…" : "Aucune ancienne version disponible";
    this.reuseSelect.replaceChildren(optionVide);
    anciens.forEach((fichier, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const date = fichier.dateReception ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(fichier.dateReception)) : "Date inconnue";
      const lignes = Array.isArray(fichier.donnees) ? fichier.donnees.length : 0;
      option.textContent = `${fichier.nom || "Fichier reçu"} · ${date} · ${lignes} ligne(s)`;
      this.reuseSelect.append(option);
    });
    this.reuseSelect.disabled = !profil.client || !profil.campagne || anciens.length === 0;
    this.reuseSelect.value = "";
    this.reuseButton.disabled = true;
    document.querySelector("#reuseReceivedFileStatus").textContent = anciens.length
      ? `${anciens.length} ancienne(s) version(s) disponible(s) pour ${profil.client} / ${profil.campagne}. La réutilisation remplacera le fichier courant de ce profil.`
      : (profil.client && profil.campagne ? `Aucune ancienne version enregistrée pour ${profil.client} / ${profil.campagne}. Les versions précédentes seront proposées après un nouvel import.` : "Choisissez d’abord un client et une campagne.");
  }
  reutiliserAncienFichier() {
    const index = Number(this.reuseSelect.value);
    if (this.reuseSelect.value === "" || !Number.isInteger(index) || index < 0) return;
    const { profil, stock, sauvegarde } = this.obtenirStockProfilActif();
    const anciens = Array.isArray(sauvegarde.historiqueFichiers) ? sauvegarde.historiqueFichiers : [];
    if (!profil.client || !profil.campagne || !anciens[index]) {
      Toast.afficher("Cette ancienne version n’est plus disponible.", "erreur");
      this.actualiserListeFichiersAnciens();
      return;
    }
    const choisi = anciens[index];
    const reste = anciens.filter((_, i) => i !== index);
    if (sauvegarde.fichier && sauvegarde.fichier.id !== choisi.id) reste.unshift(sauvegarde.fichier);
    if (reste.length > 100) reste.length = 100;
    const serialise = { ...choisi, client: profil.client, campagne: profil.campagne };
    stock[profil.cle] = { client: profil.client, campagne: profil.campagne, fichier: serialise, historiqueFichiers: reste };
    try { localStorage.setItem("dimensionnement.recu.profils.v1", JSON.stringify(stock)); }
    catch { Toast.afficher("Impossible de réutiliser ce fichier : espace de stockage local insuffisant.", "erreur", 5000); return; }
    this.fichierActuel = Object.assign({}, serialise);
    Object.setPrototypeOf(this.fichierActuel, FichierRecu.prototype);
    this.fichierActuel.dateReception = new Date(serialise.dateReception || Date.now());
    this.fichiersSession++;
    const bilan = new ValidateurDonnees().analyser(this.fichierActuel);
    this.mettreAJourIndicateurs(this.fichierActuel, bilan);
    this.afficherTableau();
    this.searchInput.disabled = this.fichierActuel.estVide;
    this.exportButton.disabled = this.fichierActuel.estVide;
    this.editModeButton.disabled = this.fichierActuel.estVide;
    this.bulkEditButton.disabled = this.fichierActuel.estVide;
    this.clearButton.disabled = false;
    this.modeEdition = false; this.actualiserBoutonEdition();
    this.fileStatus.textContent = `${this.fichierActuel.nom} · version réutilisée · ${profil.client} / ${profil.campagne}`;
    document.querySelector("#previewDescription").textContent = `${this.fichierActuel.nomFeuille || "Données"} · ${this.fichierActuel.nombreLignes} ligne(s) · version réutilisée · ${profil.client} / ${profil.campagne}`;
    ajouterHistoriqueRecu({ id:`recu-restore-${Date.now()}`, date:new Date().toISOString(), vue:"Reçu", client:profil.client, campagne:profil.campagne, periode:"Réutilisation", traitement:"—", champ:"Ancienne version réutilisée", ancienneValeur:sauvegarde.fichier?.nom || "Aucun fichier courant", nouvelleValeur:`${this.fichierActuel.nom} (${this.fichierActuel.nombreLignes} lignes)` });
    this.actualiserListeFichiersAnciens();
    this.actualiserArborescence();
    document.dispatchEvent(new CustomEvent("recu:donnees-modifiees"));
    Toast.afficher(`Ancien fichier réutilisé : ${this.fichierActuel.nom}`);
  }
  sauvegarderFichierProfil(fichier) {
    const profil = profilActif(); if (!profil.client || !profil.campagne) return;
    let stock = {}; try { stock = JSON.parse(localStorage.getItem("dimensionnement.recu.profils.v1")) || {}; } catch {}
    const precedent = stock[profil.cle] || { historiqueFichiers: [] };
    const historiqueFichiers = Array.isArray(precedent.historiqueFichiers) ? precedent.historiqueFichiers : [];
    if (fichier && precedent.fichier && precedent.fichier.id !== fichier.id) {
      historiqueFichiers.unshift(precedent.fichier);
      if (historiqueFichiers.length > 100) historiqueFichiers.length = 100;
    }
    const fichierSerialise = fichier ? { id:fichier.id, nom:fichier.nom, taille:fichier.taille, type:fichier.type, dateReception:fichier.dateReception, nomFeuille:fichier.nomFeuille, donnees:fichier.donnees, entetes:fichier.entetes, colonnesManquantes:fichier.colonnesManquantes, colonnesInconnues:fichier.colonnesInconnues, client:profil.client, campagne:profil.campagne } : null;
    stock[profil.cle] = { client: profil.client, campagne: profil.campagne, fichier: fichierSerialise || precedent.fichier || null, historiqueFichiers };
    try { localStorage.setItem("dimensionnement.recu.profils.v1", JSON.stringify(stock)); } catch { Toast.afficher("Le fichier est trop volumineux pour le stockage local du navigateur.","erreur",5000); }
  }
  lierEvenements() {
    this.fileInput.addEventListener("change", e => { const f=e.target.files[0]; if(f) this.ouvrirDialogueProfil("import", f); });
    this.clearButton.addEventListener("click", () => this.reinitialiser());
    this.searchInput.addEventListener("input", () => { this.pageActuelle = 1; this.afficherTableau(); });
    this.pageSizeSelect?.addEventListener("change", () => { this.taillePage = Math.max(1, Number(this.pageSizeSelect.value) || 100); this.pageActuelle = 1; this.afficherTableau(); });
    this.pageFirstButton?.addEventListener("click", () => { this.pageActuelle = 1; this.afficherTableau(); });
    this.pagePrevButton?.addEventListener("click", () => { this.pageActuelle = Math.max(1, this.pageActuelle - 1); this.afficherTableau(); });
    this.pageNextButton?.addEventListener("click", () => { this.pageActuelle += 1; this.afficherTableau(); });
    this.pageLastButton?.addEventListener("click", () => { this.pageActuelle = Math.ceil((this.lignesAffichees || []).length / this.taillePage) || 1; this.afficherTableau(); });
    this.exportButton.addEventListener("click", () => this.ouvrirDialogueProfil("export"));
    this.editModeButton.addEventListener("click", () => this.basculerModeEdition());
    this.bulkEditButton.addEventListener("click", () => this.ouvrirModificationColonne());
    document.querySelector("#closeBulkEdit").addEventListener("click", () => this.fermerModificationColonne());
    document.querySelector("#cancelBulkEdit").addEventListener("click", () => this.fermerModificationColonne());
    document.querySelector("#applyBulkEdit").addEventListener("click", () => this.appliquerModificationColonne());
    ["#bulkColumn", "#bulkMode", "#bulkMatchValue", "#bulkNewValue", "#bulkScope"].forEach(selector => {
      document.querySelector(selector).addEventListener("input", () => this.actualiserApercuModification());
      document.querySelector(selector).addEventListener("change", () => this.actualiserApercuModification());
    });
    document.querySelector("#bulkMode").addEventListener("change", e => {
      document.querySelector("#matchValueGroup").classList.toggle("hidden", e.target.value !== "match");
      this.actualiserApercuModification();
    });
    this.bulkEditModal.addEventListener("click", e => { if (e.target === this.bulkEditModal) this.fermerModificationColonne(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !this.bulkEditModal.classList.contains("hidden")) this.fermerModificationColonne(); });
    ["dragenter", "dragover"].forEach(type => this.dropZone.addEventListener(type, e => {
      e.preventDefault(); this.dropZone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach(type => this.dropZone.addEventListener(type, e => {
      e.preventDefault(); this.dropZone.classList.remove("dragover");
    }));
    this.dropZone.addEventListener("drop", e => {
      const file = e.dataTransfer?.files?.[0];
      if (file) this.ouvrirDialogueProfil("import", file);
    });
  }

  async traiterFichier(file, profilConfirme = false) {
    if (!file) return;
    if (!profilConfirme) { this.ouvrirDialogueProfil("import", file); return; }
    const profil = profilActif();
    if (!profil.client || !profil.campagne) {
      this.fileInput.value = "";
      Toast.afficher("Choisissez le client et la campagne avant d’importer le fichier.", "erreur", 4500);
      this.fileStatus.textContent = "Client et campagne obligatoires avant importation.";
      return;
    }
    this.fileStatus.textContent = `Lecture de ${file.name}…`;
    try {
      const importateur = new ImportateurFichier();
      const validateur = new ValidateurDonnees();
      const fichier = await importateur.importer(file);
      const bilan = validateur.analyser(fichier);
      fichier.client = profil.client; fichier.campagne = profil.campagne;
      this.fichierActuel = fichier;
      sauvegarderProfilIndex(profil.client, profil.campagne);
      this.profils = lireProfils(); this.actualiserListeCampagnes();
      this.sauvegarderFichierProfil(fichier);
      this.actualiserListeFichiersAnciens();
      this.actualiserArborescence();
      ajouterHistoriqueRecu({ id:`recu-${Date.now()}`, date:new Date().toISOString(), vue:"Reçu", client:profil.client, campagne:profil.campagne, periode:"Importation", traitement:"—", champ:"Fichier importé", ancienneValeur:"—", nouvelleValeur:`${fichier.nom} (${fichier.nombreLignes} lignes)` });
      this.fichiersSession++;
      this.mettreAJourIndicateurs(fichier, bilan);
      this.afficherTableau();
      this.searchInput.disabled = fichier.estVide;
      this.exportButton.disabled = fichier.estVide;
      this.editModeButton.disabled = fichier.estVide;
      this.bulkEditButton.disabled = fichier.estVide;
      this.modeEdition = false; this.actualiserBoutonEdition();
      this.clearButton.disabled = false;
      Toast.afficher(`Fichier importé : ${fichier.nombreLignes.toLocaleString("fr-FR")} ligne(s)`);
      this.fileStatus.textContent = `${fichier.nom} · ${(fichier.taille / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
      document.querySelector("#previewDescription").textContent =
        `${fichier.nomFeuille} · ${fichier.nombreLignes.toLocaleString("fr-FR")} ligne(s) · ${fichier.nombreColonnes} colonne(s)`;
      document.dispatchEvent(new CustomEvent("recu:donnees-modifiees"));
    } catch (error) {
      this.fileStatus.textContent = error.message || "Impossible de lire ce fichier.";
      this.afficherMessageValidation({ erreurs: [error.message || "Impossible de lire ce fichier."], avertissements: [] });
      Toast.afficher(error.message || "Impossible de lire ce fichier.", "erreur", 5000);
      document.querySelector("#metricState").dataset.etat = "err";
      document.querySelector("#metricState").textContent = "Erreur";
      document.querySelector("#metricStateDetail").textContent = "Importation impossible";
    }
  }

  async importerDepuisAzure(tableName, rows) {
    const profil = profilActif();
    if (!profil.client || !profil.campagne) {
      throw new Error("Choisissez le client et la campagne dans REÇU avant d’importer depuis Azure SQL.");
    }
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("La source Azure SQL ne contient aucune ligne à importer.");
    const source = { name: `Azure SQL · ${tableName}`, size: 0, type: "application/json" };
    const fichier = new FichierRecu(source, rows, tableName);
    const validateur = new ValidateurDonnees();
    const bilan = validateur.analyser(fichier);
    fichier.client = profil.client; fichier.campagne = profil.campagne;
    this.fichierActuel = fichier;
    sauvegarderProfilIndex(profil.client, profil.campagne);
    this.profils = lireProfils(); this.actualiserListeCampagnes();
    this.sauvegarderFichierProfil(fichier);
    this.actualiserListeFichiersAnciens(); this.actualiserArborescence();
    ajouterHistoriqueRecu({ id:`recu-azure-${Date.now()}`, date:new Date().toISOString(), vue:"Reçu", client:profil.client, campagne:profil.campagne, periode:"Importation Azure SQL", traitement:"—", champ:"Source importée", ancienneValeur:"—", nouvelleValeur:`${tableName} (${fichier.nombreLignes} lignes)` });
    this.fichiersSession++;
    this.mettreAJourIndicateurs(fichier, bilan); this.afficherTableau();
    this.searchInput.disabled = fichier.estVide; this.exportButton.disabled = fichier.estVide;
    this.editModeButton.disabled = fichier.estVide; this.bulkEditButton.disabled = fichier.estVide;
    this.modeEdition = false; this.actualiserBoutonEdition(); this.clearButton.disabled = false;
    this.fileStatus.textContent = `Azure SQL · ${tableName} · ${fichier.nombreLignes.toLocaleString("fr-FR")} ligne(s)`;
    document.querySelector("#previewDescription").textContent = `Azure SQL · ${tableName} · ${fichier.nombreLignes.toLocaleString("fr-FR")} ligne(s) · ${fichier.nombreColonnes} colonne(s)`;
    document.dispatchEvent(new CustomEvent("recu:donnees-modifiees"));
    Toast.afficher(`Azure SQL importé : ${fichier.nombreLignes.toLocaleString("fr-FR")} ligne(s)`);
    return fichier;
  }

  mettreAJourIndicateurs(fichier, bilan) {
    document.querySelector("#metricFiles").textContent = this.fichiersSession;
    document.querySelector("#metricRows").textContent = fichier.nombreLignes.toLocaleString("fr-FR");
    document.querySelector("#metricColumns").textContent = fichier.nombreColonnes.toLocaleString("fr-FR");
    document.querySelector("#metricState").textContent = bilan.valide ? (bilan.avertissements.length ? "À vérifier" : "Importé") : "Erreur";
    document.querySelector("#metricState").dataset.etat = bilan.valide ? (bilan.avertissements.length ? "warn" : "ok") : "err";
    document.querySelector("#metricStateDetail").textContent = bilan.erreurs[0] || bilan.avertissements[0] || "Structure lisible";
    this.afficherMessageValidation(bilan);
  }

  afficherMessageValidation(bilan) {
    const box = document.querySelector("#validationBanner");
    if (!box) return;
    box.replaceChildren();
    const erreurs = bilan?.erreurs || [];
    const avertissements = bilan?.avertissements || [];
    if (!erreurs.length && !avertissements.length) {
      box.className = "hidden mb-5";
      box.removeAttribute("data-etat");
      return;
    }
    box.className = "validation-banner mb-5";
    box.dataset.etat = erreurs.length ? "err" : "warn";
    const entete = document.createElement("div");
    entete.className = "validation-banner-heading";
    const icone = document.createElement("span");
    icone.className = "validation-banner-icon";
    icone.textContent = erreurs.length ? "!" : "i";
    const titre = document.createElement("div");
    const h = document.createElement("h2");
    h.textContent = erreurs.length ? `Erreur${erreurs.length > 1 ? "s" : ""} détectée${erreurs.length > 1 ? "s" : ""} dans le fichier` : "Points à vérifier dans le fichier";
    const intro = document.createElement("p");
    intro.textContent = erreurs.length ? "Corrigez les éléments signalés avant d’utiliser les données pour les prévisions." : "Le fichier a été lu, mais certaines colonnes ou lignes méritent votre attention.";
    titre.append(h, intro);
    entete.append(icone, titre);
    box.append(entete);
    if (erreurs.length) {
      const section = document.createElement("div");
      section.className = "validation-group";
      const label = document.createElement("strong"); label.textContent = "Erreurs bloquantes";
      const liste = document.createElement("ul");
      erreurs.forEach(message => { const li = document.createElement("li"); li.textContent = message; liste.append(li); });
      section.append(label, liste); box.append(section);
    }
    if (avertissements.length) {
      const section = document.createElement("div");
      section.className = "validation-group validation-warnings";
      const label = document.createElement("strong"); label.textContent = "Avertissements";
      const liste = document.createElement("ul");
      avertissements.forEach(message => { const li = document.createElement("li"); li.textContent = message; liste.append(li); });
      section.append(label, liste); box.append(section);
    }
  }

  afficherTableau() {
    const fichier = this.fichierActuel;
    if (!fichier || fichier.estVide) {
      this.tableWrap.innerHTML = '<div class="empty-state"><span class="empty-icon">▤</span><strong>Aucune donnée à afficher</strong><p>Le fichier ne contient pas de tableau exploitable.</p></div>';
      document.querySelector("#tableCount").textContent = "0 ligne";
      return;
    }
    const recherche = this.searchInput.value.trim().toLocaleLowerCase("fr");
    const filtrees = fichier.donnees.filter(row => !recherche || Object.values(row).some(v => String(v ?? "").toLocaleLowerCase("fr").includes(recherche)));
    this.lignesAffichees = filtrees;
    const totalPages = Math.max(1, Math.ceil(filtrees.length / this.taillePage));
    this.pageActuelle = Math.min(Math.max(1, this.pageActuelle), totalPages);
    const debut = (this.pageActuelle - 1) * this.taillePage;
    const visibles = filtrees.slice(debut, debut + this.taillePage);
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("thead"), headerRow = document.createElement("tr");
    const numHeader = document.createElement("th"); numHeader.textContent = "N°"; numHeader.className = "row-number"; headerRow.append(numHeader);
    fichier.entetes.forEach(h => { const th = document.createElement("th"); th.textContent = h; th.title = h; if (h === "Old Statut") th.classList.add("old-status-column"); headerRow.append(th); });
    thead.append(headerRow); table.append(thead);
    const tbody = document.createElement("tbody");
    visibles.forEach((row, index) => {
      const tr = document.createElement("tr");
      const num = document.createElement("td"); num.textContent = String(debut + index + 1); num.className = "row-number"; tr.append(num);
      fichier.entetes.forEach(h => {
        const td = document.createElement("td");
        td.className = "editable-cell";
        td.title = this.modeEdition ? "Cliquer pour modifier cette valeur" : "Activez le bouton Modifier les cellules pour éditer";
        td.dataset.column = h;
        td.tabIndex = 0;
        td.setAttribute("role", "button");
        td.setAttribute("aria-label", `Modifier ${h}, ligne ${index + 1}`);
        td.textContent = String(row[h] ?? "");
        if (h === "Old Statut") td.classList.add("old-status-column");
        td.addEventListener("click", () => { if (this.modeEdition) this.editerCellule(td, row, h); });
        td.addEventListener("keydown", event => {
          if ((event.key === "Enter" || event.key === " ") && !td.querySelector("input")) {
            if (this.modeEdition) { event.preventDefault(); this.editerCellule(td, row, h); }
          }
        });
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    this.tableWrap.replaceChildren(table);
    const fin = Math.min(debut + visibles.length, filtrees.length);
    document.querySelector("#tableCount").textContent = filtrees.length
      ? `Affichage ${debut + 1}–${fin} sur ${filtrees.length.toLocaleString("fr-FR")} ligne(s)`
      : "Aucune ligne correspondante";
    if (this.pageInfo) this.pageInfo.textContent = `Page ${this.pageActuelle} / ${totalPages}`;
    if (this.pageFirstButton) this.pageFirstButton.disabled = this.pageActuelle <= 1 || !filtrees.length;
    if (this.pagePrevButton) this.pagePrevButton.disabled = this.pageActuelle <= 1 || !filtrees.length;
    if (this.pageNextButton) this.pageNextButton.disabled = this.pageActuelle >= totalPages || !filtrees.length;
    if (this.pageLastButton) this.pageLastButton.disabled = this.pageActuelle >= totalPages || !filtrees.length;
  }

  basculerModeEdition() {
    this.modeEdition = !this.modeEdition;
    this.actualiserBoutonEdition();
    this.afficherTableau();
  }

  actualiserBoutonEdition() {
    if (!this.editModeButton) return;
    this.editModeButton.textContent = this.modeEdition ? "✓ Terminer la modification" : "✎ Modifier les cellules";
    this.editModeButton.setAttribute("aria-pressed", String(this.modeEdition));
    this.editModeButton.classList.toggle("is-active", this.modeEdition);
    const hint = document.querySelector("#editHint");
    if (hint) hint.textContent = this.modeEdition ? "Mode modification activé · Entrée pour valider · Échap pour annuler" : "Mode lecture · Utilisez les boutons Modifier pour éditer";
  }

  ouvrirModificationColonne() {
    if (!this.fichierActuel) return;
    const select = document.querySelector("#bulkColumn");
    select.replaceChildren();
    this.fichierActuel.entetes.forEach(entete => {
      const option = document.createElement("option"); option.value = entete; option.textContent = entete; select.append(option);
    });
    document.querySelector("#bulkMode").value = "all";
    document.querySelector("#bulkMatchValue").value = "";
    document.querySelector("#bulkNewValue").value = "";
    document.querySelector("#bulkScope").value = "all";
    document.querySelector("#matchValueGroup").classList.add("hidden");
    this.actualiserApercuModification();
    this.bulkEditModal.classList.remove("hidden");
    document.body.classList.add("pm-open");
    document.querySelector("#bulkColumn").focus();
  }

  fermerModificationColonne() { this.bulkEditModal.classList.add("hidden"); if (!document.querySelector(".pm-backdrop:not(.hidden)")) document.body.classList.remove("pm-open"); }

  lignesCiblesModification() {
    if (!this.fichierActuel) return [];
    if (document.querySelector("#bulkScope").value === "filtered") return this.lignesAffichees;
    return this.fichierActuel.donnees;
  }

  valeurCorrespond(ligne, colonne) {
    const mode = document.querySelector("#bulkMode").value;
    return mode === "all" || String(ligne[colonne] ?? "") === document.querySelector("#bulkMatchValue").value;
  }

  actualiserApercuModification() {
    if (!this.fichierActuel) return;
    const colonne = document.querySelector("#bulkColumn").value;
    const mode = document.querySelector("#bulkMode").value;
    const cible = this.lignesCiblesModification();
    const valeurNouvelle = document.querySelector("#bulkNewValue").value;
    const nombre = cible.filter(ligne => this.valeurCorrespond(ligne, colonne) && String(ligne[colonne] ?? "") !== valeurNouvelle).length;
    document.querySelector("#bulkMatchCount").textContent = `${nombre.toLocaleString("fr-FR")} ligne(s) concernée(s)`;
    document.querySelector("#bulkPreviewText").textContent = mode === "all"
      ? `La colonne « ${colonne} » sera remplacée par la nouvelle valeur.`
      : `Seules les lignes dont « ${colonne} » correspond exactement à la valeur recherchée seront modifiées.`;
    document.querySelector("#applyBulkEdit").disabled = nombre === 0;
  }

  async appliquerModificationColonne() {
    if (!this.fichierActuel) return;
    const colonne = document.querySelector("#bulkColumn").value;
    const mode = document.querySelector("#bulkMode").value;
    const cible = this.lignesCiblesModification();
    const valeurRecherchee = document.querySelector("#bulkMatchValue").value;
    const valeurNouvelle = document.querySelector("#bulkNewValue").value;
    const changements = cible.filter(ligne => (mode === "all" || String(ligne[colonne] ?? "") === valeurRecherchee) && String(ligne[colonne] ?? "") !== valeurNouvelle);
    if (!changements.length) return;
    const confirme = await Dialogue.confirmer({
      titre: "Appliquer cette modification ?",
      message: "Les valeurs seront remplacées dans les données en mémoire. Vous pourrez annuler cette dernière modification globale depuis la barre d’outils.",
      details: [["Colonne", colonne], ["Lignes concernées", changements.length.toLocaleString("fr-FR")], ["Nouvelle valeur", valeurNouvelle === "" ? "(vide)" : valeurNouvelle]],
      libelleConfirmer: "Appliquer", ton: "info", icone: "✎", surtitre: "MODIFICATION GROUPÉE"
    });
    if (!confirme) return;
    this.historiqueOperation = { colonne, changements: changements.map(ligne => ({ ligne, ancienneValeur: ligne[colonne] })) };
    changements.forEach(ligne => { ligne[colonne] = valeurNouvelle; });
    this.sauvegarderFichierProfil(this.fichierActuel);
    ajouterHistoriqueRecu({ id:`recu-edit-${Date.now()}`, date:new Date().toISOString(), vue:"Reçu", client:profilActif().client || "Non renseigné", campagne:profilActif().campagne || "Non renseignée", periode:"Fichier courant", traitement:"—", champ:`Modification groupée · ${colonne}`, ancienneValeur:`${changements.length} valeur(s) avant modification`, nouvelleValeur:String(valeurNouvelle) });
    this.fermerModificationColonne();
    this.afficherTableau();
    this.exportButton.disabled = false;
    this.fileStatus.textContent = `${changements.length} valeur(s) modifiée(s) dans « ${colonne} »`;
    this.afficherBoutonAnnulerOperation();
  }

  afficherBoutonAnnulerOperation() {
    let button = document.querySelector("#undoBulkEdit");
    if (!button) {
      button = document.createElement("button"); button.id = "undoBulkEdit"; button.className = "button button-secondary"; button.textContent = "↶ Annuler la dernière modification globale";
      button.addEventListener("click", () => {
        if (!this.historiqueOperation) return;
        this.historiqueOperation.changements.forEach(item => { item.ligne[this.historiqueOperation.colonne] = item.ancienneValeur; });
        this.sauvegarderFichierProfil(this.fichierActuel);
        this.historiqueOperation = null; button.remove(); this.afficherTableau(); this.fileStatus.textContent = "Dernière modification globale annulée.";
      });
      this.bulkEditButton.insertAdjacentElement("afterend", button);
    }
  }

  editerCellule(cellule, ligne, colonne) {
    if (cellule.querySelector("input")) return;
    const valeurInitiale = String(ligne[colonne] ?? "");
    const champ = document.createElement("input");
    champ.type = "text";
    champ.className = "cell-editor";
    champ.value = valeurInitiale;
    champ.setAttribute("aria-label", `Nouvelle valeur pour ${colonne}`);
    cellule.textContent = "";
    cellule.classList.add("is-editing");
    cellule.append(champ);
    champ.focus();
    champ.select();
    let termine = false;
    const terminer = enregistrer => {
      if (termine) return;
      termine = true;
      const nouvelleValeur = enregistrer ? champ.value : valeurInitiale;
      ligne[colonne] = nouvelleValeur;
      if (enregistrer && nouvelleValeur !== valeurInitiale) {
        this.sauvegarderFichierProfil(this.fichierActuel);
        const profil = profilActif();
        ajouterHistoriqueRecu({ id:`recu-cell-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, date:new Date().toISOString(), vue:"Reçu", client:profil.client || "Non renseigné", campagne:profil.campagne || "Non renseignée", periode:"Fichier courant", traitement:String(ligne["Statut"] || "—"), champ:colonne, ancienneValeur:valeurInitiale, nouvelleValeur });
        document.dispatchEvent(new CustomEvent("recu:historique-modifie"));
      }
      cellule.classList.remove("is-editing");
      cellule.textContent = nouvelleValeur;
      cellule.title = "Cliquer pour modifier cette valeur";
      if (enregistrer && nouvelleValeur !== valeurInitiale) {
        cellule.classList.add("cell-saved");
        window.setTimeout(() => cellule.classList.remove("cell-saved"), 900);
      }
    };
    champ.addEventListener("blur", () => terminer(true));
    champ.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); terminer(true); }
      if (event.key === "Escape") { event.preventDefault(); terminer(false); }
    });
  }

  exporterCSV(prefixeProfil = "") {
    if (!this.fichierActuel) return;
    const entetes = this.fichierActuel.entetes;
    const echapper = valeur => `"${String(valeur ?? "").replace(/"/g, '""')}"`;
    const contenu = [entetes.map(echapper).join(";"), ...this.fichierActuel.donnees.map(row => entetes.map(h => echapper(row[h])).join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF", contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(prefixeProfil ? prefixeProfil + "_" : "")}${this.fichierActuel.nom.replace(/\.[^.]+$/, "")}_export.csv`;
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    Toast.afficher("Export CSV téléchargé");
  }

  reinitialiser(supprimerProfil = true, notifier = true) {
    this.fichierActuel = null;
    this.pageActuelle = 1;
    if (supprimerProfil) this.sauvegarderFichierProfil(null);
    if (notifier) document.dispatchEvent(new CustomEvent("recu:donnees-modifiees"));
    this.fileInput.value = "";
    this.searchInput.value = "";
    this.searchInput.disabled = true;
    this.exportButton.disabled = true;
    this.editModeButton.disabled = true;
    this.bulkEditButton.disabled = true;
    this.modeEdition = false; this.actualiserBoutonEdition();
    this.historiqueOperation = null; document.querySelector("#undoBulkEdit")?.remove();
    this.clearButton.disabled = true;
    this.fileStatus.textContent = "Aucun fichier sélectionné";
    document.querySelector("#metricRows").textContent = "0";
    document.querySelector("#metricColumns").textContent = "0";
    document.querySelector("#metricState").textContent = "En attente";
    delete document.querySelector("#metricState").dataset.etat;
    document.querySelector("#metricStateDetail").textContent = "Aucun fichier chargé";
    document.querySelector("#previewDescription").textContent = "Le contenu du fichier apparaîtra ici après l'importation.";
    const validation = document.querySelector("#validationMessage");
    if (validation) validation.remove();
    this.tableWrap.innerHTML = '<div class="empty-state"><span class="empty-icon">▤</span><strong>Aucune donnée à afficher</strong><p>Importez un fichier pour vérifier les colonnes et les premières lignes.</p></div>';
    document.querySelector("#tableCount").textContent = "0 ligne";
    if (this.pageInfo) this.pageInfo.textContent = "Page 1 / 1";
    [this.pageFirstButton, this.pagePrevButton, this.pageNextButton, this.pageLastButton].forEach(button => { if (button) button.disabled = true; });
  }
}

class VueHypotheses {
  constructor(obtenirFichier) {
    this.obtenirFichier = obtenirFichier;
    this.cleStockage = "planif.hypotheses.v1";
    this.valeurs = this.charger();
    this.tableWrap = document.querySelector("#hypTableWrap");
    this.resetButton = document.querySelector("#hypReset");
    this.resetButton.addEventListener("click", () => this.reinitialiser());
  }

  /* Champs modifiables (le Traitement vient de la colonne Statut du fichier reçu). */
  static get CHAMPS() {
    return [
      { cle: "dmt", titre: "DMT (hh:mm:ss)", type: "dmt" },
      { cle: "occupation", titre: "Temps productif / occupation (min)", type: "number", min: 0, step: "any" },
      { cle: "ho", titre: "Heure d'ouverture (HO)", type: "time" },
      { cle: "production", titre: "Production par semaine", type: "number", min: 0, step: "any" },
      { cle: "finShift", titre: "Fin de shift", type: "time" },
      { cle: "heureTravail", titre: "Heure de travail (h)", type: "number", min: 0, max: 24, step: "any" }
    ];
  }

  static valeursParDefaut() {
    return { dmt: "", occupation: "", ho: "", production: "", finShift: "", heureTravail: "" };
  }

  charger() {
    try { return JSON.parse(localStorage.getItem(this.cleStockage)) || {}; } catch { return {}; }
  }

  sauvegarder() {
    try { localStorage.setItem(this.cleStockage, JSON.stringify(this.valeurs)); } catch { /* stockage indisponible : les valeurs restent en mémoire */ }
    window.clearTimeout(this.minuterie);
    this.minuterie = window.setTimeout(() => Toast.afficher("Hypothèses enregistrées"), 900);
  }

  traitements() {
    const fichier = this.obtenirFichier();
    if (!fichier) return [];
    const compte = new Map();
    fichier.donnees.forEach(ligne => {
      const statut = String(ligne["Statut"] ?? "").trim();
      if (statut) compte.set(statut, (compte.get(statut) || 0) + 1);
    });
    return [...compte].map(([nom, lignes]) => ({ nom, lignes }));
  }

  /* Nombre de traitements dont tous les champs sont renseignés. */
  progression() {
    const liste = this.traitements();
    const cles = ["dmt", "occupation", "ho", "production", "finShift", "heureTravail"];
    const complets = liste.filter(({ nom }) => {
      const v = this.valeurs[nom];
      return v && cles.every(k => String(v[k] ?? "").trim() !== "");
    }).length;
    return { total: liste.length, complets };
  }

  actualiser() {
    const liste = this.traitements();
    this.resetButton.disabled = liste.length === 0;
    document.querySelector("#hypCount").textContent = `${liste.length.toLocaleString("fr-FR")} traitement${liste.length > 1 ? "s" : ""}`;
    if (!liste.length) {
      document.querySelector("#hypDescription").textContent = "Importez d'abord un fichier dans REÇU pour générer la liste des traitements.";
      const vide = document.createElement("div");
      vide.className = "empty-state";
      vide.innerHTML = '<span class="empty-icon">☷</span><strong>Aucun traitement disponible</strong><p>Les traitements apparaissent après l\'importation d\'un fichier contenant la colonne Statut.</p>';
      const aller = document.createElement("button");
      aller.className = "button button-primary mt-4"; aller.textContent = "Importer un fichier dans REÇU →";
      aller.addEventListener("click", () => window.application.afficherVue("recu"));
      vide.append(aller);
      this.tableWrap.replaceChildren(vide);
      return;
    }
    document.querySelector("#hypDescription").textContent = "Traitements issus de la colonne Statut du fichier reçu · cliquez dans un champ pour le modifier.";

    const table = document.createElement("table");
    table.className = "data-table hyp-table";
    const headRow = document.createElement("tr");
    ["Traitement", ...VueHypotheses.CHAMPS.map(c => c.titre)].forEach(titre => {
      const th = document.createElement("th"); th.textContent = titre; th.title = titre; headRow.append(th);
    });
    const thead = document.createElement("thead"); thead.append(headRow); table.append(thead);

    const tbody = document.createElement("tbody");
    liste.forEach(({ nom, lignes }) => {
      if (!this.valeurs[nom]) this.valeurs[nom] = VueHypotheses.valeursParDefaut();
      const donnees = this.valeurs[nom];
      if (donnees.dmt === undefined) {
        const ancien = (Number(donnees.dmtMin) || 0) * 60 + (Number(donnees.dmtSec) || 0);
        donnees.dmt = ancien ? VueHypotheses.formaterDuree(ancien) : "";
      }
      const tr = document.createElement("tr");
      const tdNom = document.createElement("td");
      tdNom.className = "hyp-name";
      const strong = document.createElement("strong"); strong.textContent = nom;
      const small = document.createElement("small"); small.textContent = `${lignes.toLocaleString("fr-FR")} ligne(s) reçue(s)`;
      tdNom.append(strong, small); tr.append(tdNom);

      VueHypotheses.CHAMPS.forEach(champ => {
        const td = document.createElement("td");
        if (champ.type === "dmt") td.append(this.creerChampDmt(nom, donnees));
        else td.append(this.creerChamp(nom, donnees, champ));
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    this.tableWrap.replaceChildren(table);
  }

  creerChamp(nom, donnees, champ) {
    const input = document.createElement("input");
    input.className = "hyp-input";
    input.type = champ.type;
    if (champ.min !== undefined) input.min = champ.min;
    if (champ.max !== undefined) input.max = champ.max;
    if (champ.step) input.step = champ.step;
    input.value = donnees[champ.cle] ?? "";
    input.setAttribute("aria-label", `${champ.titre} — ${nom}`);
    input.addEventListener("input", () => { donnees[champ.cle] = input.value; this.sauvegarder(); });
    return input;
  }

  /* Convertit "90", "1:30" ou "0:01:30" en secondes (null si invalide). */
  static lireDuree(texte) {
    const t = String(texte ?? "").trim();
    if (!t) return "";
    if (!/^\d+(:\d+){0,2}$/.test(t)) return null;
    const p = t.split(":").map(Number);
    if (p.length === 1) return p[0];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] * 3600 + p[1] * 60 + p[2];
  }

  static formaterDuree(secondes) {
    const h = Math.floor(secondes / 3600), m = Math.floor((secondes % 3600) / 60), s = secondes % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  }

  creerChampDmt(nom, donnees) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "hyp-input hyp-dmt-input";
    input.inputMode = "numeric";
    input.placeholder = "hh:mm:ss";
    input.maxLength = 9;
    input.value = donnees.dmt ?? "";
    input.setAttribute("aria-label", `DMT (hh:mm:ss) — ${nom}`);
    input.title = "Format hh:mm:ss (ex. 00:05:30). 330 = 330 secondes, 5:30 = 5 min 30 s.";
    input.addEventListener("change", () => {
      const secondes = VueHypotheses.lireDuree(input.value);
      if (secondes === null) {
        input.setAttribute("aria-invalid", "true");
        input.classList.add("is-invalid");
        return;
      }
      input.removeAttribute("aria-invalid");
      input.classList.remove("is-invalid");
      donnees.dmt = secondes === "" ? "" : VueHypotheses.formaterDuree(secondes);
      input.value = donnees.dmt;
      this.sauvegarder();
    });
    return input;
  }

  async reinitialiser() {
    const confirme = await Dialogue.confirmer({
      titre: "Effacer toutes les hypothèses ?",
      message: "Le DMT, l’occupation et les autres paramètres saisis pour chaque traitement seront supprimés. Cette action est irréversible.",
      details: [["Traitements concernés", this.traitements().length.toLocaleString("fr-FR")]],
      libelleConfirmer: "Tout effacer", ton: "danger", icone: "⌫"
    });
    if (!confirme) return;
    this.valeurs = {};
    this.sauvegarder();
    window.clearTimeout(this.minuterie);
    Toast.afficher("Hypothèses réinitialisées");
    this.actualiser();
  }
}

/* Liste déroulante personnalisée : une balise <select> ne peut pas afficher de drapeaux. */
class ListeDeroulante {
  constructor({ options, valeur, ariaLabel, onChange, auto = false }) {
    this.options = options;
    this.valeur = valeur;
    this.onChange = onChange;
    this.liste = null;
    this.fermetureExterne = e => { if (this.liste && !this.liste.contains(e.target) && !this.element.contains(e.target)) this.fermer(); };
    this.fermetureDefilement = e => { if (this.liste && e.target !== this.liste) this.fermer(); };
    this.element = document.createElement("div");
    this.element.className = `ld${auto ? " ld-auto" : ""}`;
    this.bouton = document.createElement("button");
    this.bouton.type = "button";
    this.bouton.className = "ld-btn hyp-input";
    this.bouton.setAttribute("aria-haspopup", "listbox");
    this.bouton.setAttribute("aria-expanded", "false");
    this.bouton.setAttribute("aria-label", ariaLabel);
    this.element.append(this.bouton);
    this.bouton.addEventListener("click", () => (this.liste ? this.fermer() : this.ouvrir()));
    this.bouton.addEventListener("keydown", e => {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !this.liste) { e.preventDefault(); this.ouvrir(); }
    });
    this.afficher();
  }

  optionCourante() { return this.options.find(o => o.valeur === this.valeur) || this.options[0]; }

  creerContenu(option) {
    const contenu = document.createElement("span");
    contenu.className = "ld-contenu";
    if (option.glyphe) { const g = document.createElement("span"); g.className = "ld-glyphe"; g.textContent = option.glyphe; contenu.append(g); }
    (option.drapeaux || []).forEach(p => contenu.append(VueJoursFeries.drapeau(p)));
    const texte = document.createElement("span"); texte.className = "ld-texte"; texte.textContent = option.libelle;
    contenu.append(texte);
    return contenu;
  }

  afficher() {
    const chevron = document.createElement("span"); chevron.className = "ld-chevron"; chevron.textContent = "▾"; chevron.setAttribute("aria-hidden", "true");
    this.bouton.dataset.valeur = this.valeur;
    this.bouton.replaceChildren(this.creerContenu(this.optionCourante()), chevron);
  }

  definir(valeur) { this.valeur = valeur; this.afficher(); }

  ouvrir() {
    const ul = document.createElement("ul");
    ul.className = "ld-liste";
    ul.setAttribute("role", "listbox");
    this.options.forEach(option => {
      const li = document.createElement("li");
      li.className = "ld-item";
      li.setAttribute("role", "option");
      li.tabIndex = -1;
      li.dataset.valeur = option.valeur;
      const choisi = option.valeur === this.valeur;
      li.setAttribute("aria-selected", String(choisi));
      li.append(this.creerContenu(option));
      const coche = document.createElement("span"); coche.className = "ld-check"; coche.textContent = choisi ? "✓" : ""; li.append(coche);
      li.addEventListener("click", () => this.choisir(option.valeur));
      ul.append(li);
    });
    ul.addEventListener("keydown", e => {
      const items = [...ul.children], i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(i + 1, items.length - 1)].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(i - 1, 0)].focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (i >= 0) this.choisir(items[i].dataset.valeur); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.fermer(); this.bouton.focus(); }
      else if (e.key === "Tab") this.fermer();
    });
    document.body.append(ul);
    this.liste = ul;
    const r = this.bouton.getBoundingClientRect();
    ul.style.minWidth = `${Math.max(r.width, 230)}px`;
    ul.style.left = `${Math.min(r.left, window.innerWidth - ul.offsetWidth - 8)}px`;
    const bas = r.bottom + 4;
    ul.style.top = `${bas + ul.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - ul.offsetHeight - 4) : bas}px`;
    this.bouton.setAttribute("aria-expanded", "true");
    (ul.querySelector('[aria-selected="true"]') || ul.firstElementChild).focus();
    document.addEventListener("mousedown", this.fermetureExterne);
    window.addEventListener("scroll", this.fermetureDefilement, true);
    window.addEventListener("resize", () => this.fermer(), { once: true });
  }

  fermer() {
    if (!this.liste) return;
    this.liste.remove();
    this.liste = null;
    this.bouton.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", this.fermetureExterne);
    window.removeEventListener("scroll", this.fermetureDefilement, true);
  }

  choisir(valeur) {
    this.fermer();
    this.definir(valeur);
    this.bouton.focus();
    if (this.onChange) this.onChange(valeur);
  }
}

class VueJoursFeries {
  constructor() {
    this.cleStockage = "planif.feries.v1";
    this.jours = this.charger();
    if (this.fusionner()) this.sauvegarder();
    this.filtre = "Tous";
    this.tableWrap = document.querySelector("#ferTableWrap");
    this.anneeInput = document.querySelector("#ferYear");
    this.anneeInput.value = new Date().getFullYear();
    document.querySelector("#ferAddRow").addEventListener("click", () => this.ajouterLigne());
    document.querySelector("#ferAddMada").addEventListener("click", () => this.ajouterPays("Madagascar"));
    document.querySelector("#ferAddFr").addEventListener("click", () => this.ajouterPays("France"));
    this.filtreListe = new ListeDeroulante({
      options: VueJoursFeries.optionsPays(true), valeur: "Tous", ariaLabel: "Filtrer par pays", auto: true,
      onChange: v => { this.filtre = v; this.actualiser(); }
    });
    document.querySelector("#ferFilter").replaceWith(this.filtreListe.element);
  }

  static get PAYS() { return ["Madagascar", "France", "Commun", "Autre"]; }

  static libellePays(p) { return p === "Commun" ? "Commun (Mada + France)" : p; }

  /* Options de la liste déroulante : pour une ligne, ou pour le filtre (avec « Tous les pays »). */
  static optionsPays(filtre = false) {
    const base = [
      { valeur: "Madagascar", libelle: "Madagascar", drapeaux: ["Madagascar"] },
      { valeur: "France", libelle: "France", drapeaux: ["France"] },
      { valeur: filtre ? "Communs" : "Commun", libelle: "Commun (Mada + France)", drapeaux: ["Madagascar", "France"] },
      { valeur: "Autre", libelle: "Autre", drapeaux: ["Autre"] }
    ];
    return filtre ? [{ valeur: "Tous", libelle: "Tous les pays", glyphe: "🌐" }, ...base] : base;
  }

  /* Une date commune aux deux pays n'a qu'une seule ligne, de pays « Commun ». Retourne true si des lignes ont été fusionnées. */
  fusionner() {
    const parDate = new Map();
    this.jours.forEach(j => {
      if (j.date && ["Madagascar", "France", "Commun"].includes(j.pays)) {
        if (!parDate.has(j.date)) parDate.set(j.date, []);
        parDate.get(j.date).push(j);
      }
    });
    const supprimees = new Set();
    parDate.forEach(lignes => {
      if (lignes.length < 2) return;
      const pays = new Set(lignes.map(l => l.pays));
      if (!(pays.has("Commun") || (pays.has("Madagascar") && pays.has("France")))) return;
      const garder = lignes.find(l => l.pays === "Commun") || lignes.find(l => l.pays === "Madagascar");
      garder.pays = "Commun";
      lignes.forEach(l => { if (l !== garder) supprimees.add(l); });
    });
    if (supprimees.size) this.jours = this.jours.filter(l => !supprimees.has(l));
    return supprimees.size > 0;
  }

  visible(jour) {
    if (this.filtre === "Tous") return true;
    if (this.filtre === "Communs") return jour.pays === "Commun";
    if (this.filtre === "Madagascar" || this.filtre === "France") return jour.pays === this.filtre || jour.pays === "Commun";
    return jour.pays === this.filtre;
  }

  charger() {
    try {
      const v = JSON.parse(localStorage.getItem(this.cleStockage));
      return Array.isArray(v) ? v.map(x => ({ date: x.date || "", libelle: x.libelle || "", pays: x.pays || "Madagascar" })) : [];
    } catch { return []; }
  }

  sauvegarder() {
    try { localStorage.setItem(this.cleStockage, JSON.stringify(this.jours)); } catch { /* stockage indisponible */ }
  }

  static iso(annee, mois, jour) {
    return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  }

  /* Dimanche de Pâques (algorithme grégorien anonyme). */
  static paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(annee, mois - 1, jour));
  }

  static decaler(date, jours) {
    const d = new Date(date.getTime() + jours * 86400000);
    return VueJoursFeries.iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  static feriesMadagascar(annee) {
    const p = VueJoursFeries.paques(annee), I = VueJoursFeries.iso, D = VueJoursFeries.decaler;
    return [
      { date: I(annee, 1, 1), libelle: "Jour de l'An" },
      { date: I(annee, 3, 29), libelle: "Commémoration de 1947" },
      { date: D(p, 1), libelle: "Lundi de Pâques" },
      { date: I(annee, 5, 1), libelle: "Fête du Travail" },
      { date: D(p, 39), libelle: "Ascension" },
      { date: D(p, 50), libelle: "Lundi de Pentecôte" },
      { date: I(annee, 6, 26), libelle: "Fête de l'Indépendance" },
      { date: I(annee, 8, 15), libelle: "Assomption" },
      { date: I(annee, 11, 1), libelle: "Toussaint" },
      { date: I(annee, 12, 25), libelle: "Noël" }
    ];
  }

  static feriesFrance(annee) {
    const p = VueJoursFeries.paques(annee), I = VueJoursFeries.iso, D = VueJoursFeries.decaler;
    return [
      { date: I(annee, 1, 1), libelle: "Jour de l'An" },
      { date: D(p, 1), libelle: "Lundi de Pâques" },
      { date: I(annee, 5, 1), libelle: "Fête du Travail" },
      { date: I(annee, 5, 8), libelle: "Victoire 1945" },
      { date: D(p, 39), libelle: "Ascension" },
      { date: D(p, 50), libelle: "Lundi de Pentecôte" },
      { date: I(annee, 7, 14), libelle: "Fête nationale" },
      { date: I(annee, 8, 15), libelle: "Assomption" },
      { date: I(annee, 11, 1), libelle: "Toussaint" },
      { date: I(annee, 11, 11), libelle: "Armistice 1918" },
      { date: I(annee, 12, 25), libelle: "Noël" }
    ];
  }

  ajouterPays(pays) {
    const annee = Number(this.anneeInput.value);
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) { this.anneeInput.focus(); return; }
    const liste = pays === "France" ? VueJoursFeries.feriesFrance(annee) : VueJoursFeries.feriesMadagascar(annee);
    const deja = date => this.jours.some(j => j.date === date && (j.pays === pays || j.pays === "Commun"));
    const avant = this.jours.length;
    let ajoutes = 0;
    liste.forEach(f => { if (!deja(f.date)) { this.jours.push({ ...f, pays }); ajoutes++; } });
    this.fusionner();
    const fusionnes = ajoutes - (this.jours.length - avant);
    this.sauvegarder();
    Toast.afficher(ajoutes
      ? `${ajoutes} jour(s) férié(s) ${pays} ajouté(s) pour ${annee}${fusionnes > 0 ? ` · ${fusionnes} fusionné(s) en Commun` : ""}`
      : `Déjà à jour : aucun férié ${pays} à ajouter pour ${annee}`);
    this.actualiser();
  }

  ajouterLigne() {
    this.jours.push({ date: "", libelle: "", pays: this.filtre === "Tous" ? "Madagascar" : this.filtre });
    this.actualiser();
    const champs = this.tableWrap.querySelectorAll('input[type="date"]');
    champs[champs.length - 1]?.focus();
  }

  /* Drapeau en SVG (les emojis de drapeaux ne s'affichent pas sous Windows). */
  static drapeau(pays) {
    const formes = {
      Madagascar: '<rect width="1" height="2" fill="#fff"/><rect x="1" width="2" height="1" fill="#fc3d32"/><rect x="1" y="1" width="2" height="1" fill="#007e3a"/>',
      France: '<rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/>'
    };
    const span = document.createElement("span");
    span.className = "fer-flag";
    span.innerHTML = `<svg viewBox="0 0 3 2" width="22" height="15" role="img" aria-label="Drapeau ${pays}">${formes[pays] || '<rect width="3" height="2" fill="#cfd6d1"/>'}</svg>`;
    return span;
  }

  /* Pour chaque ligne : « commun », « specifique » (l'autre pays est chargé pour cette année) ou « simple ». */
  analyser() {
    const annees = { Madagascar: new Set(), France: new Set() };
    this.jours.forEach(j => {
      if (!j.date) return;
      const an = j.date.slice(0, 4);
      if (j.pays === "Madagascar" || j.pays === "Commun") annees.Madagascar.add(an);
      if (j.pays === "France" || j.pays === "Commun") annees.France.add(an);
    });
    const statut = new Map();
    this.jours.forEach(j => {
      if (j.pays === "Commun") { statut.set(j, "commun"); return; }
      const autre = j.pays === "Madagascar" ? "France" : j.pays === "France" ? "Madagascar" : null;
      statut.set(j, autre && j.date && annees[autre].has(j.date.slice(0, 4)) ? "specifique" : "simple");
    });
    return { statut, communs: this.jours.filter(j => j.pays === "Commun").length };
  }

  creerLegende(communs) {
    const legende = document.querySelector("#ferLegend");
    const compte = p => this.jours.filter(j => j.pays === p || j.pays === "Commun").length;
    const puces = [
      { valeur: "Madagascar", flags: ["Madagascar"], texte: "Madagascar", n: compte("Madagascar"), classe: "mg" },
      { valeur: "France", flags: ["France"], texte: "France", n: compte("France"), classe: "fr" },
      { valeur: "Communs", flags: ["Madagascar", "France"], texte: "Commun", n: communs, classe: "commun" }
    ];
    legende.replaceChildren(...puces.map(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `fer-chip fer-chip-${p.classe}${this.filtre === p.valeur ? " is-selected" : ""}`;
      b.setAttribute("aria-pressed", String(this.filtre === p.valeur));
      b.title = this.filtre === p.valeur ? "Cliquer pour afficher tous les pays" : `Filtrer : ${p.texte}`;
      p.flags.forEach(f => b.append(VueJoursFeries.drapeau(f)));
      b.append(document.createTextNode(`${p.texte} · ${p.n}`));
      b.addEventListener("click", () => {
        this.filtre = this.filtre === p.valeur ? "Tous" : p.valeur;
        this.filtreListe.definir(this.filtre);
        this.actualiser();
      });
      return b;
    }));
  }

  actualiser() {
    this.jours.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.pays.localeCompare(b.pays));
    if (this.fusionner()) this.sauvegarder();
    const { statut, communs } = this.analyser();
    this.creerLegende(communs);
    const visibles = this.jours.filter(j => this.visible(j));
    const n = visibles.length;
    document.querySelector("#ferCount").textContent =
      `${n.toLocaleString("fr-FR")} jour${n > 1 ? "s" : ""} férié${n > 1 ? "s" : ""}` + (this.filtre !== "Tous" ? ` · sur ${this.jours.length} au total` : "");
    document.querySelector("#ferDescription").textContent = this.jours.length
      ? "Vert = Madagascar · Bleu = France · Doré = commun aux deux pays (une seule ligne). Cliquez dans un champ pour modifier."
      : "Aucun jour férié enregistré. Chargez les fériés d'un pays ou ajoutez une date.";
    if (!n) {
      this.tableWrap.innerHTML = '<div class="empty-state"><span class="empty-icon">◷</span><strong>Aucun jour férié à afficher</strong><p>Utilisez « + Madagascar », « + France » ou « + Ajouter une date ».</p></div>';
      return;
    }
    const jourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
    const table = document.createElement("table");
    table.className = "data-table hyp-table";
    const headRow = document.createElement("tr");
    ["Date", "Jour", "Libellé", "Pays", ""].forEach(t => { const th = document.createElement("th"); th.textContent = t; headRow.append(th); });
    const thead = document.createElement("thead"); thead.append(headRow); table.append(thead);
    const tbody = document.createElement("tbody");
    visibles.forEach(jour => {
      const etat = statut.get(jour);
      const tr = document.createElement("tr");
      const cellules = Array.from({ length: 5 }, () => document.createElement("td"));
      const [tdDate, tdJour, tdLib, tdPays, tdAct] = cellules;
      tdPays.className = `fer-cell fer-cell-${jour.pays}`;
      const date = document.createElement("input"); date.type = "date"; date.className = "hyp-input"; date.value = jour.date; date.setAttribute("aria-label", "Date du jour férié");
      const libelle = document.createElement("input"); libelle.type = "text"; libelle.className = "hyp-input min-w-[200px]"; libelle.value = jour.libelle; libelle.placeholder = "Libellé"; libelle.setAttribute("aria-label", "Libellé du jour férié");
      const pays = new ListeDeroulante({
        options: VueJoursFeries.optionsPays(false), valeur: jour.pays, ariaLabel: `Pays — ${jour.libelle || jour.date || "nouvelle ligne"}`,
        onChange: v => { jour.pays = v; this.sauvegarder(); this.actualiser(); }
      });
      const d = jour.date ? new Date(`${jour.date}T00:00:00Z`) : null;
      tdJour.textContent = d && !isNaN(d) ? jourSemaine.format(d) : "—";
      tdJour.className = "fer-jour";
      date.addEventListener("change", () => { jour.date = date.value; this.sauvegarder(); this.actualiser(); });
      libelle.addEventListener("input", () => { jour.libelle = libelle.value; this.sauvegarder(); });
      const suppr = document.createElement("button"); suppr.className = "button button-secondary"; suppr.textContent = "Supprimer"; suppr.setAttribute("aria-label", `Supprimer ${jour.libelle || jour.date || "cette ligne"}`);
      suppr.addEventListener("click", () => { this.jours = this.jours.filter(x => x !== jour); this.sauvegarder(); Toast.afficher("Jour férié supprimé"); this.actualiser(); });
      tdDate.append(date); tdLib.append(libelle); tdPays.append(pays.element); tdAct.append(suppr);
      tr.append(...cellules); tbody.append(tr);
    });
    table.append(tbody);
    this.tableWrap.replaceChildren(table);
  }
}


class VuePrevision {
  constructor(obtenirFichierRecu = () => null) {
    this.obtenirFichierRecu = obtenirFichierRecu;
    this.stockageMensuel = "planif.previsions.mensuelles.v1";
    this.stockageJournalier = "planif.previsions.journalieres.v1";
    this.stockageHistorique = "planif.previsions.historique.v1";
    try { this.historique = JSON.parse(localStorage.getItem(this.stockageHistorique)) || []; } catch { this.historique = []; }
    if (!Array.isArray(this.historique)) this.historique = [];
    try { this.mensuelles = JSON.parse(localStorage.getItem(this.cleStockage("mensuel"))) || []; } catch { this.mensuelles = []; }
    try { this.journalieres = JSON.parse(localStorage.getItem(this.cleStockage("journalier"))) || []; } catch { this.journalieres = []; }
    if (!Array.isArray(this.mensuelles)) this.mensuelles = [];
    if (!Array.isArray(this.journalieres)) this.journalieres = [];
    this.initialisationMensuelleFaite = false;
    // Cache des agrégats Reçu : évite de reparcourir et reparsing toutes les lignes à chaque édition.
    this.cacheCalculRecuMensuel = null;
    this.cacheValeursRecu = new Map();
    this.cacheDernierePeriodeRecu = undefined;
    this.variationOptionsHTML = '<option value="">Choisir…</option>' + Array.from({ length: 201 }, (_, i) => i - 100).map(v => `<option value="${v}">${v > 0 ? `+${v}` : v} %</option>`).join("");
    this.journalieresCache = new Map(this.journalieres.map(l => [`${Number(l.annee)}-${Number(l.mois)}-${Number(l.jour)}|${String(l.traitement || "").trim()}`, l]));
    // Reprend les anciennes saisies (avant séparation des vues) dans le tableau mensuel.
    try {
      const anciennes = JSON.parse(localStorage.getItem("planif.previsions.saisie.v1")) || [];
      if (!this.mensuelles.length && Array.isArray(anciennes) && anciennes.length) this.mensuelles = anciennes;
    } catch {}
    this.wrapMensuel = document.querySelector("#forecastMonthlyTableWrap");
    this.wrapJournalier = document.querySelector("#forecastDailyTableWrap");
    this.wrapHistorique = document.querySelector("#forecastHistoryTableWrap");
    document.querySelector("#forecastHistoryClient").addEventListener("change", () => this.actualiserFiltresHistorique());
    document.querySelector("#forecastHistoryCampaign").addEventListener("change", () => this.afficherHistorique());
    document.querySelector("#forecastHistoryType").addEventListener("change", () => this.afficherHistorique());
    document.querySelector("#forecastHistoryClear").addEventListener("click", async () => {
      const confirme = await Dialogue.confirmer({
        titre: "Effacer l’historique ?",
        message: "Toutes les modifications enregistrées (imports Reçu, prévisions mensuelles et journalières) seront supprimées. Cette action est irréversible.",
        details: [["Entrées enregistrées", this.historique.length.toLocaleString("fr-FR")]],
        libelleConfirmer: "Effacer l’historique", ton: "danger", icone: "⌫"
      });
      if (confirme) { this.historique = []; this.sauvegarderHistorique(); this.afficherHistorique(); Toast.afficher("Historique effacé"); }
    });
    document.querySelector("#forecastMonthlyAddBatch").addEventListener("click", () => {
      const champ = document.querySelector("#forecastMonthlyAddCount");
      const nombre = Math.max(1, Math.min(100, Math.floor(Number(champ.value) || 1)));
      champ.value = String(nombre);
      for (let i = 0; i < nombre; i++) this.ajouterLigne("mensuel", { silencieux: true });
      this.enregistrerHistorique("mensuel", this.mensuelles[this.mensuelles.length - 1] || {}, "Lignes", "—", `${nombre} lignes ajoutées`);
      this.calculerPrevisionsMensuelles(); this.sauvegarder("mensuel"); this.actualiser("mensuel");
      Toast.afficher(`${nombre} ligne${nombre > 1 ? "s" : ""} ajoutée${nombre > 1 ? "s" : ""}`);
    });
    document.querySelector("#forecastMonthlyExport").addEventListener("click", () => this.exporter("mensuel"));
    document.querySelector("#forecastDailyExport").addEventListener("click", () => this.exporter("journalier"));
    this.initialiserSelectionJournaliere();
    document.querySelector("#forecastMonthlyTab").addEventListener("click", () => this.changerOnglet("mensuel"));
    document.querySelector("#forecastDailyTab").addEventListener("click", () => this.changerOnglet("journalier"));
    document.querySelector("#forecastHistoryTab").addEventListener("click", () => this.changerOnglet("historique"));
    document.addEventListener("recu:donnees-modifiees", () => { this.cacheCalculRecuMensuel = null; this.cacheValeursRecu.clear(); this.cacheDernierePeriodeRecu = undefined; this.genererLignesMensuelles(); this.genererDatesJournalieres(); this.actualiserFiltresHistorique(); });
    document.addEventListener("recu:historique-modifie", () => this.actualiserFiltresHistorique());
    document.addEventListener("profil:change", () => {
      try { this.mensuelles = JSON.parse(localStorage.getItem(this.cleStockage("mensuel"))) || []; } catch { this.mensuelles = []; }
      try { this.journalieres = JSON.parse(localStorage.getItem(this.cleStockage("journalier"))) || []; } catch { this.journalieres = []; }
      this.journalieresCache = new Map(this.journalieres.map(l => [`${Number(l.annee)}-${Number(l.mois)}-${Number(l.jour)}|${String(l.traitement || "").trim()}`, l]));
      this.initialisationMensuelleFaite = false;
      this.cacheCalculRecuMensuel = null; this.cacheValeursRecu.clear(); this.cacheDernierePeriodeRecu = undefined;
      this.genererLignesMensuelles(); this.genererDatesJournalieres(); this.actualiser(); this.actualiserFiltresHistorique();
    });
    if (!this.journalieres.length) this.journalieres.push(this.nouvelleLigne("journalier"));
    this.genererLignesMensuelles();
    this.actualiser();
    this.actualiserFiltresHistorique();
    this.changerOnglet("mensuel");
  }
  initialiserSelectionJournaliere() {
    const conteneur = document.querySelector("#forecastDailyMonths");
    const anneeInput = document.querySelector("#forecastDailyYear");
    const anneeCourante = new Date().getFullYear();
    const anneesExistantes = this.journalieres.map(l => Number(l.annee)).filter(Number.isFinite);
    const anneeInitiale = anneesExistantes.length ? Math.max(...anneesExistantes) : anneeCourante;
    anneeInput.value = String(anneeInitiale);
    const noms = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    noms.forEach((nom, i) => {
      const label = document.createElement("label");
      label.className = "forecast-month-chip";
      const input = document.createElement("input"); input.type = "checkbox"; input.value = String(i + 1); input.dataset.forecastMonth = "1";
      input.checked = this.journalieres.some(l => Number(l.annee) === anneeInitiale && Number(l.mois) === i + 1);
      const texte = document.createElement("span"); texte.textContent = nom;
      label.append(input, texte); conteneur.append(label);
      input.addEventListener("change", () => this.genererDatesJournalieres());
    });
    anneeInput.addEventListener("change", () => this.genererDatesJournalieres());
    document.querySelector("#forecastDailyClearMonths").addEventListener("click", () => {
      conteneur.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
      this.genererDatesJournalieres();
    });
    if (!conteneur.querySelector('input:checked')) {
      const moisCourant = conteneur.querySelector(`[data-forecast-month][value="${new Date().getMonth() + 1}"]`);
      if (moisCourant) moisCourant.checked = true;
    }
    this.genererDatesJournalieres();
  }
  obtenirDernierePeriodeRecu() {
    if (this.cacheDernierePeriodeRecu !== undefined) return this.cacheDernierePeriodeRecu;
    const donnees = this.obtenirFichierRecu?.()?.donnees || [];
    const ordre = donnees.length ? VueBesoinHeure.detecterOrdre(donnees.map(l => l.Date)) : "jm";
    let derniere = "";
    for (const ligne of donnees) {
      const iso = VueBesoinHeure.lireDate(ligne.Date, ordre);
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const periode = iso.slice(0, 7);
        if (periode > derniere) derniere = periode;
      }
    }
    this.cacheDernierePeriodeRecu = derniere;
    return derniere;
  }
  genererLignesMensuelles() {
    if (this.initialisationMensuelleFaite) {
      this.calculerPrevisionsMensuelles();
      this.sauvegarder("mensuel");
      return;
    }
    const traitements = this.obtenirValeursRecu("traitement");
    const dernierePeriodeRecu = this.obtenirDernierePeriodeRecu();
    const moisRecuExiste = Boolean(dernierePeriodeRecu);
    const dernierePeriode = dernierePeriodeRecu || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const [anneeInitiale, moisInitial] = dernierePeriode.split("-").map(Number);
    const dimensions = this.obtenirClientsCampagnes();
    const profil = dimensions[0] || { client: "", campagne: "" };
    const anciennes = Array.isArray(this.mensuelles) ? this.mensuelles : [];

    // La vue mensuelle démarre volontairement sur une seule période et quatre traitements maximum.
    // Les autres mois/lignes sont ajoutés ou supprimés par l'utilisateur avec les boutons du tableau.
    if (!anciennes.length) {
      this.mensuelles = traitements.slice(0, 4).map(traitement => ({
        mois: String(moisInitial), annee: String(anneeInitiale), fluxPrevu: "", traitement,
        source: "", variation: "", previsionPrise: "", client: profil.client || "", campagne: profil.campagne || ""
      }));
      if (!this.mensuelles.length) this.mensuelles = [{
        mois: String(moisInitial), annee: String(anneeInitiale), fluxPrevu: "", traitement: "",
        source: "", variation: "", previsionPrise: "", client: profil.client || "", campagne: profil.campagne || ""
      }];
    } else {
      // Migration des anciennes vues qui généraient automatiquement tous les mois :
      // conserver les lignes de la période la plus récente, avec quatre traitements au maximum.
      const periodesExistantes = anciennes.map(l => `${String(Number(l.annee) || anneeInitiale).padStart(4, "0")}-${String(Number(l.mois) || moisInitial).padStart(2, "0")}`).sort();
      const periodeAConserver = moisRecuExiste ? dernierePeriode : (periodesExistantes[periodesExistantes.length - 1] || dernierePeriode);
      const [anneeConservee, moisConserve] = periodeAConserver.split("-").map(Number);
      const lignesPeriode = anciennes.filter(l => (Number(l.annee) || anneeConservee) === anneeConservee && (Number(l.mois) || moisConserve) === moisConserve);
      const parTraitement = new Map(lignesPeriode.map(l => [String(l.traitement || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), l]));
      const traitementsInitiaux = (traitements.length ? traitements : lignesPeriode.map(l => String(l.traitement || "").trim()).filter(Boolean)).slice(0, 4);
      const lignesCompactes = traitementsInitiaux.map(traitement => {
        const cle = String(traitement).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return parTraitement.get(cle) || { mois: String(moisConserve), annee: String(anneeConservee), fluxPrevu: "", traitement, source: "", variation: "", previsionPrise: "", client: profil.client || "", campagne: profil.campagne || "" };
      });
      // Si la période conservée contenait des lignes personnalisées avec des valeurs saisies,
      // elles ne sont pas supprimées lorsqu'elles correspondent à l'un des quatre traitements initiaux.
      this.mensuelles = lignesCompactes.length ? lignesCompactes : lignesPeriode.slice(0, 4);
      if (!this.mensuelles.length) this.mensuelles = [{ mois: String(moisInitial), annee: String(anneeInitiale), fluxPrevu: "", traitement: "", source: "", variation: "", previsionPrise: "", client: profil.client || "", campagne: profil.campagne || "" }];
    }
    this.initialisationMensuelleFaite = true;
    this.calculerPrevisionsMensuelles();
    this.sauvegarder("mensuel");
  }
  calculerPrevisionsMensuelles() {
    if (!this.mensuelles?.length) return;
    const normaliser = valeur => String(valeur ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let indexRecu = this.cacheCalculRecuMensuel;
    if (!indexRecu) {
      const fichier = this.obtenirFichierRecu?.();
      const donnees = fichier?.donnees || [];
      const ordreDates = donnees.length ? VueBesoinHeure.detecterOrdre(donnees.map(l => l.Date)) : "DMY";
      const lignesParsees = [];
      let aDesValeursNumeriques = false;
      for (const ligne of donnees) {
        const iso = VueBesoinHeure.lireDate(ligne.Date, ordreDates);
        const traitement = String(ligne.Statut ?? ligne.Traitement ?? "").trim();
        if (!iso || !traitement) continue;
        const valeur = VueBesoinHeure.lireNombre(ligne.Reçu);
        if (valeur !== null && Number.isFinite(valeur)) aDesValeursNumeriques = true;
        lignesParsees.push({ mois: iso.slice(0, 7), cleTraitement: normaliser(traitement), valeur });
      }
      const volumesReels = new Map(), moisAvecDonnees = new Set(), moisParTraitement = new Map();
      for (const ligne of lignesParsees) {
        const cle = `${ligne.mois}|${ligne.cleTraitement}`;
        moisAvecDonnees.add(cle);
        if (!moisParTraitement.has(ligne.cleTraitement)) moisParTraitement.set(ligne.cleTraitement, new Set());
        moisParTraitement.get(ligne.cleTraitement).add(ligne.mois);
        const valeur = aDesValeursNumeriques ? ligne.valeur : 1;
        if (valeur === null || !Number.isFinite(valeur)) continue;
        volumesReels.set(cle, (volumesReels.get(cle) || 0) + valeur);
      }
      indexRecu = this.cacheCalculRecuMensuel = { volumesReels, moisAvecDonnees, moisParTraitement };
    }
    const { volumesReels, moisAvecDonnees, moisParTraitement } = indexRecu;

    const parTraitement = new Map();
    this.mensuelles.forEach(ligne => {
      const traitement = String(ligne.traitement || "").trim();
      if (!traitement) { ligne.previsionPrise = 0; return; }
      const mois = `${String(Number(ligne.annee) || 0).padStart(4, "0")}-${String(Number(ligne.mois) || 0).padStart(2, "0")}`;
      const cleTraitement = normaliser(traitement);
      if (!parTraitement.has(cleTraitement)) parTraitement.set(cleTraitement, { periodes: new Map() });
      const groupe = parTraitement.get(cleTraitement);
      if (!groupe.periodes.has(mois)) groupe.periodes.set(mois, []);
      groupe.periodes.get(mois).push(ligne);
    });

    const decalageMois = (mois, delta) => {
      const [annee, numero] = mois.split("-").map(Number);
      const date = new Date(annee, numero - 1 + delta, 1);
      return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };
    const moisEntre = (debut, fin) => {
      const resultat = [];
      if (!debut || !fin || debut > fin) return resultat;
      let courant = debut;
      for (let i = 0; i < 240 && courant <= fin; i++, courant = decalageMois(courant, 1)) resultat.push(courant);
      return resultat;
    };

    parTraitement.forEach((groupe, cleTraitement) => {
      const periodesLignes = [...groupe.periodes.keys()].sort();
      const periodesRecu = [...(moisParTraitement.get(cleTraitement) || [])].sort();
      const toutesPeriodes = [...periodesLignes, ...periodesRecu].sort();
      if (!toutesPeriodes.length) {
        groupe.periodes.forEach(lignes => lignes.forEach(ligne => { ligne.previsionPrise = 0; }));
        return;
      }
      const timeline = moisEntre(toutesPeriodes[0], toutesPeriodes[toutesPeriodes.length - 1]);
      const valeurs = new Map();
      const previsionnelles = new Set();
      let arretPrevision = false;
      timeline.forEach(mois => {
        const cle = `${mois}|${cleTraitement}`;
        if (moisAvecDonnees.has(cle)) {
          // Un mois avec des lignes Reçu est réel, même si la somme vaut zéro.
          valeurs.set(mois, volumesReels.get(cle) || 0);
          previsionnelles.delete(mois);
          arretPrevision = false;
          return;
        }
        const precedents = [decalageMois(mois, -3), decalageMois(mois, -2), decalageMois(mois, -1)];
        if (arretPrevision) {
          valeurs.set(mois, 0);
          return;
        }
        if (!precedents.every(p => valeurs.has(p))) {
          valeurs.set(mois, 0);
          return;
        }
        // Ne jamais calculer une moyenne de trois valeurs toutes déjà prévisionnelles.
        if (precedents.every(p => previsionnelles.has(p))) {
          valeurs.set(mois, 0);
          arretPrevision = true;
          return;
        }
        const moyenne = precedents.reduce((total, p) => total + Number(valeurs.get(p)), 0) / 3;
        const arrondie = Math.round(moyenne);
        valeurs.set(mois, arrondie);
        previsionnelles.add(mois);
      });
      groupe.periodes.forEach((lignes, mois) => {
        lignes.forEach(ligne => { ligne.previsionPrise = Math.round(Number(valeurs.has(mois) ? valeurs.get(mois) : 0) || 0); });
      });
    });
  }
  genererDatesJournalieres() {
    const conteneur = document.querySelector("#forecastDailyMonths");
    const anneeInput = document.querySelector("#forecastDailyYear");
    const annee = Math.min(2100, Math.max(2000, Number(anneeInput.value) || new Date().getFullYear()));
    anneeInput.value = String(annee);
    const moisSelectionnes = [...conteneur.querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value)).sort((a,b) => a-b);
    this.journalieres.forEach(l => this.journalieresCache.set(`${Number(l.annee)}-${Number(l.mois)}-${Number(l.jour)}|${String(l.traitement || "").trim()}`, l));
    const traitements = this.obtenirValeursRecu("traitement");
    const traitementsAGenerer = traitements.length ? traitements : [""];
    const dimensions = this.obtenirClientsCampagnes();
    const nouvelles = [];
    moisSelectionnes.forEach(mois => {
      const dernierJour = new Date(annee, mois, 0).getDate();
      for (let jour = 1; jour <= dernierJour; jour++) {
        dimensions.forEach(({ client, campagne }, dimensionIndex) => traitementsAGenerer.forEach(traitement => {
          const cle = `${annee}-${mois}-${jour}|${client}|${campagne}|${String(traitement).trim()}`;
          const cleTraitement = `${annee}-${mois}-${jour}|${String(traitement).trim()}`;
          const cleAncienne = `${annee}-${mois}-${jour}`;
          const conservee = this.journalieresCache.get(cle) || (dimensionIndex === 0 ? (this.journalieresCache.get(cleTraitement) || this.journalieresCache.get(cleAncienne)) : null);
          const ligne = conservee || { jour: String(jour), mois: String(mois), annee: String(annee), fluxPrevu: "", traitement, source: "", variation: "", previsionPrise: "", client, campagne };
          ligne.jour = String(jour); ligne.mois = String(mois); ligne.annee = String(annee); ligne.traitement = traitement; ligne.client = client; ligne.campagne = campagne;
          this.journalieresCache.set(cle, ligne); nouvelles.push(ligne);
        }));
      }
    });
    this.journalieres = nouvelles;
    const resume = document.querySelector("#forecastDailySelectionSummary");
    const totalJours = nouvelles.length;
    resume.textContent = moisSelectionnes.length ? `${moisSelectionnes.length} mois sélectionné${moisSelectionnes.length > 1 ? "s" : ""} · ${totalJours} jour${totalJours > 1 ? "s" : ""} généré${totalJours > 1 ? "s" : ""}` : "Sélectionnez au moins un mois pour afficher ses jours.";
    this.afficherTable("journalier");
  }
  obtenirClientsCampagnes() {
    const profil = profilActif();
    if (profil.client && profil.campagne) return [{ client: profil.client, campagne: profil.campagne }];
    const fichier = this.obtenirFichierRecu?.();
    const normaliser = valeur => String(valeur ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const trouverEntete = candidats => (fichier?.entetes || []).find(h => candidats.some(c => normaliser(h) === normaliser(c)))
      || (fichier?.entetes || []).find(h => candidats.some(c => normaliser(h).includes(normaliser(c))));
    const enteteClient = trouverEntete(["Client", "Nom client", "Nom du client", "Customer", "Client final"]);
    const enteteCampagne = trouverEntete(["Campagne", "Nom campagne", "Nom de campagne", "Campaign", "Campagne client"]);
    const paires = new Map();
    (fichier?.donnees || []).forEach(row => {
      const client = String(row[enteteClient] ?? "").trim();
      const campagne = String(row[enteteCampagne] ?? "").trim();
      if (!client && !campagne) return;
      const cle = `${normaliser(client)}|${normaliser(campagne)}`;
      if (!paires.has(cle)) paires.set(cle, { client, campagne });
    });
    if (!paires.size) return [{ client: "", campagne: "" }];
    return [...paires.values()].sort((a,b) => a.client.localeCompare(b.client, "fr", { sensitivity: "base" }) || a.campagne.localeCompare(b.campagne, "fr", { sensitivity: "base" }));
  }
  enregistrerHistorique(typeVue, ligne, champ, ancienneValeur, nouvelleValeur) {
    if (String(ancienneValeur ?? "") === String(nouvelleValeur ?? "")) return;
    const date = new Date();
    this.historique.unshift({
      id: `${date.getTime()}-${Math.random().toString(36).slice(2,8)}`,
      date: date.toISOString(), vue: typeVue === "journalier" ? "Journalière" : "Mensuelle",
      client: ligne.client || "Non renseigné", campagne: ligne.campagne || "Non renseignée",
      periode: typeVue === "journalier" ? `${String(ligne.jour || "").padStart(2,"0")}/${String(ligne.mois || "").padStart(2,"0")}/${ligne.annee || ""}` : `${ligne.mois || ""}/${ligne.annee || ""}`,
      traitement: ligne.traitement || "Non renseigné", champ,
      ancienneValeur: String(ancienneValeur ?? ""), nouvelleValeur: String(nouvelleValeur ?? "")
    });
    if (this.historique.length > 5000) this.historique.length = 5000;
    this.sauvegarderHistorique();
  }
  sauvegarderHistorique() { try { localStorage.setItem(this.stockageHistorique, JSON.stringify(this.historique)); } catch {} }
  actualiserFiltresHistorique() {
    const clientSelect = document.querySelector("#forecastHistoryClient");
    const campagneSelect = document.querySelector("#forecastHistoryCampaign");
    const ancienClient = clientSelect.value, ancienneCampagne = campagneSelect.value;
    const clients = [...new Set([...this.historique.map(h => h.client), ...this.obtenirClientsCampagnes().map(d => d.client)].filter(Boolean))].sort((a,b) => a.localeCompare(b,"fr",{sensitivity:"base"}));
    clientSelect.replaceChildren(new Option("Tous les clients", ""), ...clients.map(v => new Option(v,v)));
    clientSelect.value = clients.includes(ancienClient) ? ancienClient : "";
    const campagnes = [...new Set(this.historique.filter(h => !clientSelect.value || h.client === clientSelect.value).map(h => h.campagne).concat(this.obtenirClientsCampagnes().filter(d => !clientSelect.value || d.client === clientSelect.value).map(d => d.campagne)).filter(Boolean))].sort((a,b) => a.localeCompare(b,"fr",{sensitivity:"base"}));
    campagneSelect.replaceChildren(new Option("Toutes les campagnes", ""), ...campagnes.map(v => new Option(v,v)));
    campagneSelect.value = campagnes.includes(ancienneCampagne) ? ancienneCampagne : "";
    this.afficherHistorique();
  }
  afficherHistorique() {
    if (!this.wrapHistorique) return;
    const client = document.querySelector("#forecastHistoryClient").value;
    const campagne = document.querySelector("#forecastHistoryCampaign").value;
    const vue = document.querySelector("#forecastHistoryType").value;
    const donnees = this.historique.filter(h => (!client || h.client === client) && (!campagne || h.campagne === campagne) && (!vue || h.vue === vue));
    const table = document.createElement("table"); table.className = "data-table hyp-table";
    const entetes = ["Date / heure", "Client", "Campagne", "Vue", "Période", "Traitement", "Champ modifié", "Ancienne valeur", "Nouvelle valeur"];
    const thead = document.createElement("thead"), hr = document.createElement("tr");
    entetes.forEach(v => { const th = document.createElement("th"); th.textContent = v; hr.append(th); }); thead.append(hr); table.append(thead);
    const tbody = document.createElement("tbody");
    donnees.forEach(h => { const tr = document.createElement("tr");
      const date = new Date(h.date); const valeurs = [Number.isNaN(date.getTime()) ? h.date : date.toLocaleString("fr-FR"),h.client,h.campagne,h.vue,h.periode,h.traitement,h.champ,h.ancienneValeur || "—",h.nouvelleValeur || "—"];
      valeurs.forEach(v => { const td = document.createElement("td"); td.textContent = v || "—"; td.title = td.textContent; tr.append(td); }); tbody.append(tr);
    });
    if (!donnees.length) { const tr = document.createElement("tr"), td = document.createElement("td"); td.colSpan = entetes.length; td.textContent = "Aucune modification enregistrée pour ces filtres."; td.className = "text-muted"; tr.append(td); tbody.append(tr); }
    table.append(tbody); this.wrapHistorique.replaceChildren(table);
    document.querySelector("#forecastHistoryCount").textContent = `${donnees.length} modification${donnees.length > 1 ? "s" : ""} affichée${donnees.length > 1 ? "s" : ""} · ${this.historique.length} au total`;
  }

  lignes(type) { return type === "journalier" ? this.journalieres : this.mensuelles; }
  cleStockage(type) {
    const base = type === "journalier" ? this.stockageJournalier : this.stockageMensuel;
    const profil = profilActif();
    return profil.client && profil.campagne ? `${base}::${profil.cle}` : base;
  }
  nouvelleLigne(type) {
    const maintenant = new Date();
    const profil = profilActif();
    return { jour: String(maintenant.getDate()), mois: String(maintenant.getMonth() + 1), annee: String(maintenant.getFullYear()), fluxPrevu: "", traitement: "", source: "", variation: "", previsionPrise: "", client: profil.client || "", campagne: profil.campagne || "" };
  }
  sauvegarder(type) {
    if (type === "journalier") this.journalieres.forEach(l => this.journalieresCache.set(`${Number(l.annee)}-${Number(l.mois)}-${Number(l.jour)}|${String(l.traitement || "").trim()}`, l));
    const donneesASauver = type === "journalier" ? [...this.journalieresCache.values()] : this.lignes(type);
    try { localStorage.setItem(this.cleStockage(type), JSON.stringify(donneesASauver)); } catch {}
    const compteur = document.querySelector(type === "journalier" ? "#forecastDailyCount" : "#forecastMonthlyCount");
    if (compteur) { const n = this.lignes(type).length; compteur.textContent = `${n} ligne${n > 1 ? "s" : ""}`; }
  }
  ajouterLigne(type, options = {}) {
    const ligne = this.nouvelleLigne(type);
    if (type === "mensuel") {
      const dernierePeriode = this.obtenirDernierePeriodeRecu();
      if (dernierePeriode) { const [a, m] = dernierePeriode.split("-"); ligne.annee = a; ligne.mois = String(Number(m)); }
      const traitements = this.obtenirValeursRecu("traitement");
      const utilises = new Set(this.mensuelles.filter(l => Number(l.mois) === Number(ligne.mois) && Number(l.annee) === Number(ligne.annee)).map(l => String(l.traitement || "").trim().toLocaleLowerCase("fr")));
      ligne.traitement = traitements.find(t => !utilises.has(String(t).trim().toLocaleLowerCase("fr"))) || "";
    }
    this.lignes(type).push(ligne);
    if (!options.silencieux) this.enregistrerHistorique(type, ligne, "Ligne", "—", "Créée manuellement");
    if (!options.silencieux) {
      if (type === "mensuel") this.calculerPrevisionsMensuelles();
      this.sauvegarder(type); this.actualiser(type);
    }
  }
  changerOnglet(type) {
    const mensuel = type === "mensuel", journalier = type === "journalier", historique = type === "historique";
    document.querySelector("#forecastMonthlyPanel").classList.toggle("hidden", !mensuel);
    document.querySelector("#forecastDailyPanel").classList.toggle("hidden", !journalier);
    document.querySelector("#forecastHistoryPanel").classList.toggle("hidden", !historique);
    const tabs = [["forecastMonthlyTab",mensuel],["forecastDailyTab",journalier],["forecastHistoryTab",historique]];
    tabs.forEach(([id, active]) => { const tab = document.querySelector(`#${id}`); tab.className = `button ${active ? "button-primary" : "button-secondary"}`; tab.setAttribute("aria-selected", String(active)); });
    if (historique) this.actualiserFiltresHistorique();
  }
  creerCellule(element, classe = "") {
    const td = document.createElement("td"); if (classe) td.className = classe; td.append(element); return td;
  }
  creerChamp(ligne, cle, type = "text", label = "", typeVue = "mensuel") {
    const input = document.createElement("input"); input.type = type; input.className = "hyp-input"; input.value = ligne[cle] ?? "";
    if (type === "number") { input.min = "0"; input.step = "any"; }
    if (label) input.setAttribute("aria-label", label);
    input.placeholder = type === "number" ? "0" : "Saisir…";
    const valeurInitiale = String(ligne[cle] ?? "");
    input.addEventListener("input", () => { ligne[cle] = input.value; this.sauvegarder(typeVue); });
    input.dataset.lastLoggedValue = valeurInitiale;
    input.addEventListener("change", () => { this.enregistrerHistorique(typeVue, ligne, label || cle, input.dataset.lastLoggedValue, input.value); input.dataset.lastLoggedValue = input.value; });
    if (cle === "annee" && typeVue === "journalier") input.addEventListener("change", () => this.actualiser());
    if (cle === "annee" && typeVue === "mensuel") input.addEventListener("change", () => { this.calculerPrevisionsMensuelles(); this.sauvegarder(typeVue); this.actualiser(typeVue); });
    if (cle === "fluxPrevu") input.addEventListener("change", () => { if (typeVue === "mensuel") this.calculerPrevisionsMensuelles(); this.sauvegarder(typeVue); this.actualiser(typeVue); });
    return input;
  }
  creerMois(ligne, typeVue) {
    const select = document.createElement("select"); select.className = "hyp-input forecast-select forecast-month-select"; select.setAttribute("aria-label", "Mois");
    ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"].forEach((nom, i) => { const opt = document.createElement("option"); opt.value = String(i + 1); opt.textContent = nom; select.append(opt); });
    select.value = String(ligne.mois || "1"); select.addEventListener("change", () => { ligne.mois = select.value; this.sauvegarder(typeVue); if (typeVue === "journalier") this.actualiser(typeVue); else { this.calculerPrevisionsMensuelles(); this.actualiser(typeVue); } }); return select;
  }
  creerSelectTraitement(ligne, typeVue) {
    const select = document.createElement("select");
    select.className = "hyp-input forecast-select";
    select.setAttribute("aria-label", "Traitement");
    const traitements = this.obtenirValeursRecu("traitement");
    select.append(new Option("Choisir un traitement…", ""));
    traitements.forEach(t => select.append(new Option(t, t)));
    if (ligne.traitement && !traitements.includes(ligne.traitement)) select.append(new Option(ligne.traitement, ligne.traitement));
    select.value = ligne.traitement || "";
    select.addEventListener("change", () => {
      const ancienne = ligne.traitement || "";
      ligne.traitement = select.value;
      this.enregistrerHistorique(typeVue, ligne, "Traitement", ancienne, ligne.traitement);
      this.sauvegarder(typeVue);
      if (typeVue === "mensuel") this.calculerPrevisionsMensuelles();
      this.actualiser(typeVue);
    });
    return select;
  }
  obtenirValeursRecu(cle) {
    if (this.cacheValeursRecu.has(cle)) return this.cacheValeursRecu.get(cle);
    const fichier = this.obtenirFichierRecu?.();
    const normaliser = valeur => String(valeur ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const candidats = cle === "traitement"
      ? ["Statut", "Traitement"]
      : ["Source de données", "Source de données", "Source des données", "Source", "Source de donnée"];
    const entetes = fichier?.entetes || [];
    const enteteTrouvee = entetes.find(h => candidats.some(c => normaliser(h) === normaliser(c)))
      || entetes.find(h => cle === "traitement" ? normaliser(h).includes("statut") : normaliser(h).includes("source"));
    const estUneDate = valeur => {
      const v = String(valeur ?? "").trim();
      if (!v) return false;
      return /^(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\d{1,2}\s+[\p{L}.]+\s+\d{4})$/iu.test(v)
        || (!Number.isNaN(Date.parse(v)) && /[\/.-]/.test(v) && /\d/.test(v) && v.length >= 8);
    };
    const valeursUniques = new Map();
    (fichier?.donnees || []).forEach(row => {
      const valeur = String(row[enteteTrouvee || (cle === "traitement" ? "Statut" : "Source de données")] ?? "").trim();
      if (!valeur || (cle === "source" && estUneDate(valeur))) return;
      // Dédupliquer les sources/statuts sans tenir compte de la casse ni des espaces superflus.
      const cleUnique = normaliser(valeur);
      if (!valeursUniques.has(cleUnique)) valeursUniques.set(cleUnique, valeur);
    });
    const resultat = [...valeursUniques.values()].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    this.cacheValeursRecu.set(cle, resultat);
    return resultat;
  }
  creerSelectRecu(ligne, cle, colonneRecu, label, typeVue) {
    const select = document.createElement("select"); select.className = "hyp-input forecast-select"; select.setAttribute("aria-label", label);
    const choix = document.createElement("option"); choix.value = ""; choix.textContent = "Chargement depuis Reçu…"; select.append(choix);
    const valeurs = this.obtenirValeursRecu(cle);
    choix.textContent = valeurs.length ? "Choisir…" : `En attente des données de Reçu (${cle === "traitement" ? "Statut" : "Source"})`;
    valeurs.forEach(valeur => { const option = document.createElement("option"); option.value = valeur; option.textContent = valeur; select.append(option); });
    if (ligne[cle] && !valeurs.includes(String(ligne[cle]))) { const option = document.createElement("option"); option.value = String(ligne[cle]); option.textContent = `${ligne[cle]} (valeur enregistrée)`; select.append(option); }
    select.value = String(ligne[cle] ?? ""); select.disabled = valeurs.length === 0;
    const valeurInitiale = String(ligne[cle] ?? "");
    select.dataset.lastLoggedValue = valeurInitiale;
    if (!valeurs.length) select.title = `Les choix seront remplis automatiquement dès qu’un fichier Reçu contenant la colonne ${cle === "traitement" ? "Statut" : "Source de données"} est importé.`;
    select.addEventListener("change", () => { const ancienne = select.dataset.lastLoggedValue; ligne[cle] = select.value; this.sauvegarder(typeVue); this.enregistrerHistorique(typeVue, ligne, label, ancienne, select.value); select.dataset.lastLoggedValue = select.value; }); return select;
  }

  creerSelectClientCampagne(ligne, cle, typeVue) {
    const select = document.createElement("select"); select.className = "hyp-input forecast-select";
    select.setAttribute("aria-label", cle === "client" ? "Client" : "Campagne");
    const dimensions = this.obtenirClientsCampagnes();
    const valeurs = [...new Set(dimensions.map(d => d[cle]).filter(Boolean))].sort((a,b) => a.localeCompare(b,"fr",{sensitivity:"base"}));
    select.append(new Option(cle === "client" ? "Choisir un client…" : "Choisir une campagne…", ""));
    valeurs.forEach(v => select.append(new Option(v,v)));
    if (ligne[cle] && !valeurs.includes(ligne[cle])) select.append(new Option(`${ligne[cle]} (enregistré)`,ligne[cle]));
    select.value = String(ligne[cle] || "");
    const initial = select.value;
    select.dataset.lastLoggedValue = initial;
    if (cle === "campagne") {
      const client = ligne.client || "";
      const campagnesClient = dimensions.filter(d => !client || d.client === client).map(d => d.campagne).filter(Boolean);
      [...select.options].forEach(opt => { if (opt.value && !campagnesClient.includes(opt.value) && opt.value !== initial) opt.disabled = true; });
    }
    select.addEventListener("change", () => {
      ligne[cle] = select.value;
      if (cle === "client" && ligne.campagne && !dimensions.some(d => d.client === ligne.client && d.campagne === ligne.campagne)) {
        const ancienneCampagne = ligne.campagne; ligne.campagne = "";
        this.enregistrerHistorique(typeVue, ligne, "Campagne", ancienneCampagne, "");
      }
      this.sauvegarder(typeVue);
      this.enregistrerHistorique(typeVue, ligne, cle === "client" ? "Client" : "Campagne", select.dataset.lastLoggedValue, select.value);
      select.dataset.lastLoggedValue = select.value;
      this.actualiser(typeVue);
    });
    return select;
  }

  creerJour(ligne, typeVue) {
    const jour = document.createElement("span");
    jour.className = "forecast-day-label";
    jour.textContent = String(Number(ligne.jour) || 1).padStart(2, "0");
    jour.title = "Jour généré automatiquement à partir du mois sélectionné";
    return jour;
  }

  afficherTable(typeVue) {
    const journalier = typeVue === "journalier", lignes = this.lignes(typeVue), wrap = journalier ? this.wrapJournalier : this.wrapMensuel;
    const table = document.createElement("table"); table.className = "data-table hyp-table";
    const head = document.createElement("thead"), hr = document.createElement("tr");
    (journalier ? ["Jour", "Mois", "Année", "Traitement", "Flux prévu", "Source", "Client", "Campagne", "Variation (%)", "Prévision proposée", "Action"] : ["Mois", "Année", "Traitement", "Flux prévu", "Source", "Client", "Campagne", "Variation (%)", "Prévision proposée", "Action"]).forEach(t => { const th = document.createElement("th"); th.textContent = t; hr.append(th); });
    head.append(hr); table.append(head); const body = document.createElement("tbody");
    const lignesAffichees = journalier
      ? lignes.map((ligne, index) => ({ ligne, index })).sort((a, b) => String(a.ligne.traitement || "").localeCompare(String(b.ligne.traitement || ""), "fr", { sensitivity: "base" }) || Number(a.ligne.annee) - Number(b.ligne.annee) || Number(a.ligne.mois) - Number(b.ligne.mois) || Number(a.ligne.jour) - Number(b.ligne.jour))
      : lignes.map((ligne, index) => ({ ligne, index }));
    lignesAffichees.forEach(({ ligne, index }) => {
      const tr = document.createElement("tr");
      if (journalier) {
        // Ordre demandé : Jour, Mois, Année, Traitement.
        tr.append(this.creerCellule(this.creerJour(ligne, typeVue)));
        const moisAffiche = document.createElement("span"); moisAffiche.className = "forecast-date-label"; moisAffiche.textContent = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][(Number(ligne.mois) || 1) - 1];
        tr.append(this.creerCellule(moisAffiche));
        const anneeAffichee = document.createElement("span"); anneeAffichee.className = "forecast-date-label"; anneeAffichee.textContent = String(ligne.annee || "");
        tr.append(this.creerCellule(anneeAffichee));
      } else {
        tr.append(this.creerCellule(this.creerMois(ligne, typeVue)));
        tr.append(this.creerCellule(this.creerChamp(ligne, "annee", "number", "Année", typeVue)));
      }
      tr.append(this.creerCellule(this.creerSelectTraitement(ligne, typeVue)));
      tr.append(this.creerCellule(this.creerChamp(ligne, "fluxPrevu", "number", "Flux prévu", typeVue)));
      tr.append(this.creerCellule(this.creerSelectRecu(ligne, "source", "Source de données", "Source — Source de donnée dans Reçu", typeVue)));
      tr.append(this.creerCellule(this.creerSelectClientCampagne(ligne, "client", typeVue)));
      tr.append(this.creerCellule(this.creerSelectClientCampagne(ligne, "campagne", typeVue)));
      const variation = document.createElement("select"); variation.className = "hyp-input forecast-select forecast-variation-select";
      variation.setAttribute("aria-label", "Variation en pourcentage de -100 % à +100 %");
      variation.title = "Choisir une variation de -100 % à +100 %, par pas de 1 %";
      variation.innerHTML = this.variationOptionsHTML;
      const variationStockee = ligne.variation === "" || ligne.variation == null ? "" : String(Number(ligne.variation));
      variation.value = [...variation.options].some(option => option.value === variationStockee) ? variationStockee : "";
      variation.dataset.lastLoggedValue = variation.value;
      variation.addEventListener("change", () => { const ancienne = variation.dataset.lastLoggedValue; ligne.variation = variation.value; this.sauvegarder(typeVue); this.enregistrerHistorique(typeVue, ligne, "Variation (%)", ancienne, variation.value); variation.dataset.lastLoggedValue = variation.value; if (typeVue === "mensuel") this.calculerPrevisionsMensuelles(); this.actualiser(typeVue); });
      tr.append(this.creerCellule(variation));
      const attente = document.createElement("span");
      const fluxPrevu = ligne.fluxPrevu === "" || ligne.fluxPrevu == null ? NaN : Number(ligne.fluxPrevu);
      const tauxVariation = ligne.variation === "" || ligne.variation == null ? 0 : Number(ligne.variation);
      // Une valeur de flux prévue positive prend la priorité sur la valeur issue de Reçu/moyenne.
      // Si la variation est positive, on applique le taux au flux prévu.
      const valeurCalculee = Number.isFinite(fluxPrevu) && fluxPrevu > 0
        ? fluxPrevu * (Number.isFinite(tauxVariation) && tauxVariation > 0 ? 1 + tauxVariation / 100 : 1)
        : ligne.previsionPrise;
      const valeurAffichee = valeurCalculee === "" || valeurCalculee == null || !Number.isFinite(Number(valeurCalculee)) ? null : Math.round(Number(valeurCalculee));
      attente.textContent = valeurAffichee === null ? "—" : valeurAffichee.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
      attente.className = valeurAffichee === null ? "text-[#89938d]" : "font-semibold text-brand";
      attente.title = Number.isFinite(fluxPrevu) && fluxPrevu > 0
        ? (tauxVariation > 0 ? `Flux prévu ${fluxPrevu} augmenté de ${tauxVariation} %` : "Valeur égale au Flux prévu")
        : "Mois réels : somme de la colonne Reçu par traitement. Mois futurs : moyenne des trois mois précédents, avec arrêt lorsque ces trois mois sont tous prévisionnels.";
      tr.append(this.creerCellule(attente, "forecast-taken-cell"));
      const supprimer = document.createElement("button"); supprimer.className = "button button-secondary"; supprimer.textContent = "Supprimer"; supprimer.setAttribute("aria-label", `Supprimer la ligne ${index + 1}`);
      supprimer.addEventListener("click", async () => {
        const periode = journalier ? `${String(ligne.jour || "").padStart(2, "0")}/${String(ligne.mois || "").padStart(2, "0")}/${ligne.annee || ""}` : `${String(ligne.mois || "").padStart(2, "0")}/${ligne.annee || ""}`;
        const confirme = await Dialogue.confirmer({
          titre: "Supprimer cette prévision ?",
          message: "La ligne sera retirée du tableau. La suppression sera tracée dans l’historique.",
          details: [["Période", periode], ["Traitement", ligne.traitement || "—"], ["Flux prévu", ligne.fluxPrevu === "" || ligne.fluxPrevu == null ? "—" : ligne.fluxPrevu]],
          libelleConfirmer: "Supprimer", ton: "danger", icone: "⌫"
        });
        if (confirme) { this.enregistrerHistorique(typeVue, ligne, "Ligne", "Présente", "Supprimée"); lignes.splice(lignes.indexOf(ligne), 1); if (typeVue === "mensuel") this.calculerPrevisionsMensuelles(); this.sauvegarder(typeVue); this.actualiser(typeVue); }
      });
      tr.append(this.creerCellule(supprimer)); body.append(tr);
    });
    if (!lignes.length && journalier) {
      const empty = document.createElement("div"); empty.className = "empty-state";
      const icon = document.createElement("span"); icon.className = "empty-icon"; icon.textContent = "▦";
      const titre = document.createElement("strong"); titre.textContent = "Aucune date affichée";
      const aide = document.createElement("p"); aide.textContent = "Sélectionnez un ou plusieurs mois ci-dessus pour générer automatiquement tous les jours.";
      empty.append(icon, titre, aide); wrap.replaceChildren(empty); this.sauvegarder(typeVue); return;
    }
    table.append(body); wrap.replaceChildren(table); this.sauvegarder(typeVue);
  }
  actualiser(typeVue = null) {
    if (typeVue === "mensuel") { this.afficherTable("mensuel"); return; }
    if (typeVue === "journalier") { this.afficherTable("journalier"); return; }
    this.afficherTable("mensuel"); this.afficherTable("journalier"); this.afficherHistorique();
  }
  exporter(typeVue) {
    const mois = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const journalier = typeVue === "journalier";
    const entetes = journalier ? ["Jour", "Mois", "Année", "Traitement", "Flux prévu", "Source", "Client", "Campagne", "Variation (%)", "Prévision proposée"] : ["Mois", "Année", "Traitement", "Flux prévu", "Source", "Client", "Campagne", "Variation (%)", "Prévision proposée"];
    const lignesSource = this.lignes(typeVue);
    const lignesTriees = journalier ? [...lignesSource].sort((a, b) => String(a.traitement || "").localeCompare(String(b.traitement || ""), "fr", { sensitivity: "base" }) || Number(a.annee) - Number(b.annee) || Number(a.mois) - Number(b.mois) || Number(a.jour) - Number(b.jour)) : lignesSource;
    const lignes = [entetes, ...lignesTriees.map(l => journalier
      ? [l.jour || "", mois[(Number(l.mois) || 1) - 1] || "", l.annee || "", l.traitement || "", l.fluxPrevu || "", l.source || "", l.client || "", l.campagne || "", l.variation || "", Number.isFinite(Number(l.fluxPrevu)) && l.fluxPrevu !== "" && Number(l.fluxPrevu) > 0 ? Math.round(Number(l.fluxPrevu) * (Number(l.variation) > 0 ? 1 + Number(l.variation) / 100 : 1)) : Math.round(Number(l.previsionPrise) || 0)]
      : [mois[(Number(l.mois) || 1) - 1] || "", l.annee || "", l.traitement || "", l.fluxPrevu || "", l.source || "", l.client || "", l.campagne || "", l.variation || "", Number.isFinite(Number(l.fluxPrevu)) && l.fluxPrevu !== "" && Number(l.fluxPrevu) > 0 ? Math.round(Number(l.fluxPrevu) * (Number(l.variation) > 0 ? 1 + Number(l.variation) / 100 : 1)) : Math.round(Number(l.previsionPrise) || 0)] )];
    const csv = lignes.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = journalier ? "Previsions_journalieres.csv" : "Previsions_mensuelles.csv"; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    Toast.afficher(`Prévisions ${journalier ? "journalières" : "mensuelles"} exportées en CSV`);
  }
}

/* Besoin en heure (Planify) : les 5 jours ouvrés d'une semaine, heure par heure (0 h – 23 h), par traitement. */
class VueBesoinHeure {
  static get JOURS() { return ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]; }
  static get MOIS() { return ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]; }

  constructor(obtenirFichier, obtenirHypotheses = () => ({}), obtenirFeries = () => []) {
    this.obtenirFichier = obtenirFichier;
    this.obtenirHypotheses = obtenirHypotheses;
    this.obtenirFeries = obtenirFeries;
    this.etat = { mode: "besoin", affichage: "detail", du: "", au: "", semaine: "", selection: new Set() };
    this.donnees = null; this.fichierRef = null; this.listeSemaine = null; this.cleSemaines = ""; this.cacheHyp = new Map();
    const $ = s => document.querySelector(s);
    this.el = {
      du: $("#besoinFrom"), au: $("#besoinTo"), prev: $("#besoinPrev"), next: $("#besoinNext"), hote: $("#besoinWeekHost"),
      presetLast: $("#besoinPresetLast"), preset4: $("#besoinPreset4"), presetAll: $("#besoinPresetAll"),
      modes: $("#besoinModes"), vues: $("#besoinViews"), traitements: $("#besoinTreatments"), traitCount: $("#besoinTraitCount"),
      grille: $("#besoinGridWrap"), recap: $("#besoinRecapWrap"), alerte: $("#besoinAlert"), exporter: $("#besoinExport"),
      titre: $("#besoinGridTitle"), description: $("#besoinGridDescription"), formule: $("#besoinFormula"), ignorees: $("#besoinIgnored"), indice: $("#besoinFilterHint"),
      exporterExcel: $("#besoinExportExcel")
    };
    this.creerDialogueExport();
    this.lierEvenements();
  }

  /* ---------- Lecture tolérante des valeurs du fichier Reçu ---------- */
  static iso(y, m, d) { return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  static valider(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? VueBesoinHeure.iso(y, m, d) : null;
  }
  static moisDepuisTexte(texte) {
    const t = String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    if (t.startsWith("jui")) return t[3] === "n" ? 6 : t[3] === "l" ? 7 : null;
    return { jan: 1, fev: 2, feb: 2, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aou: 8, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }[t.slice(0, 3)] || null;
  }
  /* Détecte jj/mm ou mm/jj sur l'ensemble de la colonne (SheetJS formate parfois en mm/jj/aa). */
  static detecterOrdre(valeurs) {
    let jm = 0, mj = 0;
    for (const v of valeurs) {
      if (typeof v !== "string") continue;
      const m = v.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
      if (!m) continue;
      if (Number(m[1]) > 12) jm++; else if (Number(m[2]) > 12) mj++;
    }
    return mj > jm ? "mj" : "jm";
  }
  static lireDate(v, ordre = "jm") {
    const { valider, iso } = VueBesoinHeure;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    const serie = n => { if (!(n > 20000 && n < 80000)) return null; const d = new Date(Math.round((n - 25569) * 86400000)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
    if (typeof v === "number") return Number.isFinite(v) ? serie(v) : null;
    const t = String(v ?? "").trim(); if (!t) return null;
    if (/^\d{5}$/.test(t)) return serie(Number(t));
    let m = t.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (m) return valider(+m[1], +m[2], +m[3]);
    m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) { const a = +m[1], b = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return ordre === "mj" ? valider(y, a, b) : valider(y, b, a); }
    m = t.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4})/);
    if (m) { const mois = VueBesoinHeure.moisDepuisTexte(m[2]); if (mois) return valider(+m[3], mois, +m[1]); }
    return null;
  }
  static lireHeure(v) {
    const sortie = h => (Number.isInteger(h) && h >= 0 && h <= 23 ? h : null);
    if (typeof v === "number") return !Number.isFinite(v) ? null : (v >= 0 && v < 1 ? sortie(Math.floor(v * 24 + 1e-9)) : sortie(v));
    const t = String(v ?? "").trim().toLowerCase(); if (!t) return null;
    const pm = /\bp\.?m\b/.test(t), am = /\ba\.?m\b/.test(t);
    const ajuster = h => (h === null ? null : pm && h < 12 ? h + 12 : am && h === 12 ? 0 : h);
    let m = t.match(/(\d{1,2})\s*[h:]/);
    if (m) return sortie(ajuster(+m[1]));
    if (/^\d+([.,]\d+)?$/.test(t)) {
      const n = Number(t.replace(",", "."));
      if (/^\d{3,4}$/.test(t) && n > 23 && n <= 2359) return sortie(Math.floor(n / 100));
      return n >= 0 && n < 1 && /[.,]/.test(t) ? sortie(Math.floor(n * 24 + 1e-9)) : sortie(ajuster(Math.floor(n)));
    }
    m = t.match(/^(\d{1,2})\s*(am|pm)/);
    return m ? sortie(ajuster(+m[1])) : null;
  }
  static lireNombre(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const t = String(v ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); if (t === "") return null;
    const n = Number(t); return Number.isFinite(n) ? n : null;
  }

  /* ---------- Calendrier ---------- */
  static ajouterJours(iso, n) { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return VueBesoinHeure.iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  static jourSemaine(iso) { const [y, m, d] = iso.split("-").map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; } /* 0 = lundi … 6 = dimanche */
  static lundi(iso) { return VueBesoinHeure.ajouterJours(iso, -VueBesoinHeure.jourSemaine(iso)); }
  static numeroSemaine(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
    const j1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - j1) / 86400000 - 3 + ((j1.getUTCDay() + 6) % 7)) / 7);
  }
  static dateFr(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
  static libelleSemaine(lundi) {
    const v = lundi, f = VueBesoinHeure.ajouterJours(lundi, 4), M = VueBesoinHeure.MOIS;
    const [, m1, d1] = v.split("-").map(Number), [y2, m2, d2] = f.split("-").map(Number);
    return `S${VueBesoinHeure.numeroSemaine(lundi)} · ${d1} ${M[m1 - 1]} → ${d2} ${M[m2 - 1]} ${y2}`;
  }
  static heureLibelle(h) { return `${String(h).padStart(2, "0")}h – ${String(h + 1).padStart(2, "0")}h`; }

  /* ---------- Données ---------- */
  analyser(fichier) {
    const lignes = fichier.donnees || [];
    const ordre = VueBesoinHeure.detecterOrdre(lignes.map(l => l["Date"]));
    const volumeParLigne = !lignes.some(l => VueBesoinHeure.lireNombre(l["Reçu"]) !== null);
    const agg = new Map(), traitements = new Set(), jours = new Set();
    const stats = { lignes: lignes.length, utilisees: 0, weekend: 0, date: 0, heure: 0, volume: 0, volumeParLigne };
    lignes.forEach(ligne => {
      const iso = VueBesoinHeure.lireDate(ligne["Date"], ordre);
      if (!iso) { if (String(ligne["Date"] ?? "").trim() !== "") stats.date++; return; }
      const h = VueBesoinHeure.lireHeure(ligne["Heure"]);
      if (h === null) { stats.heure++; return; }
      const vol = volumeParLigne ? 1 : VueBesoinHeure.lireNombre(ligne["Reçu"]);
      if (vol === null) { stats.volume++; return; }
      if (VueBesoinHeure.jourSemaine(iso) > 4) { stats.weekend++; return; }
      const nom = String(ligne["Statut"] ?? "").trim() || "Sans statut";
      if (!agg.has(iso)) agg.set(iso, new Map());
      const j = agg.get(iso);
      if (!j.has(nom)) j.set(nom, new Float64Array(24));
      j.get(nom)[h] += vol;
      traitements.add(nom); jours.add(iso); stats.utilisees++;
    });
    const triees = [...jours].sort();
    return {
      agg, stats, jours: triees, min: triees[0] || "", max: triees[triees.length - 1] || "",
      traitements: [...traitements].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
    };
  }

  semaines() {
    if (!this.donnees) return [];
    const { du, au } = this.etat, lundis = new Set();
    this.donnees.jours.forEach(iso => { if (iso >= du && iso <= au) lundis.add(VueBesoinHeure.lundi(iso)); });
    return [...lundis].sort().map(lundi => ({ lundi, jours: [0, 1, 2, 3, 4].map(i => VueBesoinHeure.ajouterJours(lundi, i)), label: VueBesoinHeure.libelleSemaine(lundi) }));
  }

  hypothese(nom) {
    if (this.cacheHyp.has(nom)) return this.cacheHyp.get(nom);
    const h = (this.obtenirHypotheses() || {})[nom] || {};
    const s = VueHypotheses.lireDuree(h.dmt);
    const occ = Number(h.occupation);
    const res = { dmt: typeof s === "number" && s > 0 ? s : null, dmtTexte: h.dmt || "", occupation: occ > 0 ? Math.min(occ, 60) : 0, occupationTexte: h.occupation };
    this.cacheHyp.set(nom, res);
    return res;
  }

  /* Convertit un volume horaire en valeur de l'indicateur choisi. */
  mesure(volume, nom) {
    if (this.etat.mode === "volume") return volume;
    const h = this.hypothese(nom);
    if (h.dmt === null) return 0;
    const charge = volume * h.dmt / 3600;
    return this.etat.mode === "charge" ? charge : charge / (h.occupation > 0 ? h.occupation / 60 : 1);
  }
  serie(iso, noms) {
    const sortie = new Float64Array(24), jour = this.donnees.agg.get(iso);
    if (!jour) return sortie;
    noms.forEach(nom => { const v = jour.get(nom); if (v) for (let h = 0; h < 24; h++) if (v[h]) sortie[h] += this.mesure(v[h], nom); });
    return sortie;
  }
  volumeSemaine(nom, jours) {
    return jours.reduce((s, j) => { const v = this.donnees.agg.get(j.iso)?.get(nom); return s + (v ? v.reduce((a, b) => a + b, 0) : 0); }, 0);
  }
  ferie(iso) { return (this.obtenirFeries() || []).find(j => j.date === iso) || null; }
  formater(v) {
    const volume = this.etat.mode === "volume";
    return v.toLocaleString("fr-FR", { minimumFractionDigits: volume ? 0 : 2, maximumFractionDigits: volume ? 1 : 2 });
  }
  unite() { return this.etat.mode === "volume" ? "reçus" : "h"; }

  /* ---------- Événements ---------- */
  lierEvenements() {
    const e = this.el;
    e.du.addEventListener("change", () => { if (!this.donnees) return; this.etat.du = e.du.value || this.donnees.min; if (this.etat.du > this.etat.au) this.etat.au = this.etat.du; this.rendre(); });
    e.au.addEventListener("change", () => { if (!this.donnees) return; this.etat.au = e.au.value || this.donnees.max; if (this.etat.au < this.etat.du) this.etat.du = this.etat.au; this.rendre(); });
    e.prev.addEventListener("click", () => this.deplacerSemaine(-1));
    e.next.addEventListener("click", () => this.deplacerSemaine(1));
    e.presetLast.addEventListener("click", () => this.appliquerPeriode(1));
    e.preset4.addEventListener("click", () => this.appliquerPeriode(4));
    e.presetAll.addEventListener("click", () => this.appliquerPeriode(0));
    e.modes.addEventListener("click", ev => { const b = ev.target.closest("[data-mode]"); if (b) { this.etat.mode = b.dataset.mode; this.rendre(); } });
    e.vues.addEventListener("click", ev => { const b = ev.target.closest("[data-affichage]"); if (b) { this.etat.affichage = b.dataset.affichage; this.rendre(); } });
    e.traitements.addEventListener("click", ev => {
      if (!this.donnees) return;
      const tout = ev.target.closest("[data-all]"), un = ev.target.closest("[data-trait]");
      if (tout) this.etat.selection = this.etat.selection.size === this.donnees.traitements.length ? new Set() : new Set(this.donnees.traitements);
      else if (un) { const n = un.dataset.trait; this.etat.selection.has(n) ? this.etat.selection.delete(n) : this.etat.selection.add(n); }
      else return;
      this.rendre();
    });
    e.exporter.addEventListener("click", () => this.ouvrirDialogueExport());
    this.exportDialog.querySelector("[data-export-cancel]").addEventListener("click", () => this.fermerDialogueExport());
    this.exportDialog.addEventListener("click", ev => { if (ev.target === this.exportDialog) this.fermerDialogueExport(); });
    this.exportDialog.querySelector("[data-export-confirm]").addEventListener("click", () => {
      const structure = this.exportDialog.querySelector('input[name="besoinExportStructure"]:checked')?.value || "actuel";
      const format = this.exportDialog.querySelector('input[name="besoinExportFormat"]:checked')?.value || "xlsx";
      this.fermerDialogueExport();
      this.exporterSelection(format, structure);
    });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !this.exportDialog.classList.contains("hidden")) this.fermerDialogueExport(); });
  }

  /* nb = nombre de dernières semaines (0 = toute la période). */
  appliquerPeriode(nb) {
    if (!this.donnees) return;
    const d = this.donnees;
    const lundis = [...new Set(d.jours.map(VueBesoinHeure.lundi))].sort();
    this.etat.au = d.max;
    this.etat.du = nb === 0 ? d.min : (lundis[Math.max(0, lundis.length - nb)] < d.min ? d.min : lundis[Math.max(0, lundis.length - nb)]);
    this.etat.semaine = "";
    this.rendre();
  }
  deplacerSemaine(sens) {
    const s = this.semaines(), i = s.findIndex(x => x.lundi === this.etat.semaine), n = i + sens;
    if (n >= 0 && n < s.length) { this.etat.semaine = s[n].lundi; this.rendre(); }
  }

  /* ---------- Affichage ---------- */
  actualiser() {
    const fichier = this.obtenirFichier();
    this.cacheHyp = new Map();
    if (!fichier || fichier.estVide) { this.donnees = null; this.fichierRef = null; this.rendreVide("Aucune donnée disponible", "Importez un fichier dans REÇU (colonnes Date, Heure, Reçu et Statut) pour afficher le besoin heure par heure."); return; }
    const nouveau = fichier !== this.fichierRef;
    this.fichierRef = fichier;
    this.donnees = this.analyser(fichier);
    const d = this.donnees;
    if (!d.jours.length) { this.rendreVide("Aucune ligne exploitable", "Les colonnes Date et Heure du fichier reçu n’ont pas pu être lues sur des jours ouvrés (lundi → vendredi)."); this.afficherIgnorees(); return; }
    if (nouveau || !this.etat.du) { this.etat.du = d.min; this.etat.au = d.max; this.etat.semaine = ""; this.etat.selection = new Set(d.traitements); }
    else {
      this.etat.du = this.etat.du < d.min ? d.min : this.etat.du; this.etat.au = this.etat.au > d.max ? d.max : this.etat.au;
      const connus = new Set(d.traitements); this.etat.selection = new Set([...this.etat.selection].filter(t => connus.has(t)));
    }
    this.rendre();
  }

  rendreVide(titre, texte) {
    const e = this.el;
    [e.du, e.au, e.prev, e.next, e.presetLast, e.preset4, e.presetAll, e.exporter, e.exporterExcel].filter(Boolean).forEach(x => { x.disabled = true; });
    const vide = document.createElement("div"); vide.className = "empty-state";
    vide.innerHTML = '<span class="empty-icon">▥</span><strong></strong><p></p>';
    vide.querySelector("strong").textContent = titre; vide.querySelector("p").textContent = texte;
    const aller = document.createElement("button"); aller.className = "button button-primary mt-4"; aller.textContent = "Ouvrir REÇU →";
    aller.addEventListener("click", () => window.application.afficherVue("recu")); vide.append(aller);
    e.grille.replaceChildren(vide); e.recap.replaceChildren();
    e.alerte.classList.add("hidden"); e.alerte.replaceChildren();
    e.traitements.replaceChildren(Object.assign(document.createElement("span"), { className: "text-[11px] text-muted", textContent: "Les traitements apparaissent après l’import d’un fichier dans REÇU." }));
    e.traitCount.textContent = "0 sélectionné";
    e.description.textContent = "Importez un fichier dans REÇU pour afficher les heures.";
    e.formule.textContent = "—"; e.ignorees.textContent = "";
    ["Total", "Pic", "Jour", "Trait"].forEach(k => { document.querySelector(`#besoinKpi${k}`).textContent = k === "Trait" ? "0" : "—"; document.querySelector(`#besoinKpi${k}Detail`).textContent = "Aucune donnée"; });
    this.hote(null);
  }

  hote(semaines) {
    const e = this.el;
    if (!semaines) { e.hote.replaceChildren(Object.assign(document.createElement("button"), { type: "button", className: "hyp-input", disabled: true, textContent: "Aucune semaine", style: "min-width:250px;text-align:left" })); this.cleSemaines = ""; this.listeSemaine = null; return; }
    const cle = semaines.map(s => s.lundi).join(",");
    if (cle !== this.cleSemaines || !this.listeSemaine) {
      this.cleSemaines = cle;
      this.listeSemaine = new ListeDeroulante({
        options: semaines.map(s => ({ valeur: s.lundi, libelle: s.label })), valeur: this.etat.semaine, ariaLabel: "Choisir la semaine", auto: true,
        onChange: v => { this.etat.semaine = v; this.rendre(); }
      });
      e.hote.replaceChildren(this.listeSemaine.element);
    } else this.listeSemaine.definir(this.etat.semaine);
  }

  rendre() {
    const d = this.donnees, e = this.el; if (!d) return;
    this.cacheHyp = new Map();
    [e.du, e.au, e.presetLast, e.preset4, e.presetAll].forEach(x => { x.disabled = false; });
    e.du.min = e.au.min = d.min; e.du.max = e.au.max = d.max; e.du.value = this.etat.du; e.au.value = this.etat.au;
    const semaines = this.semaines();
    if (!semaines.some(s => s.lundi === this.etat.semaine)) this.etat.semaine = semaines.length ? semaines[semaines.length - 1].lundi : "";
    const i = semaines.findIndex(s => s.lundi === this.etat.semaine);
    e.prev.disabled = i <= 0; e.next.disabled = i < 0 || i >= semaines.length - 1;
    e.indice.textContent = `${semaines.length} semaine${semaines.length > 1 ? "s" : ""} disponible${semaines.length > 1 ? "s" : ""} sur la période · ${d.traitements.length} traitement${d.traitements.length > 1 ? "s" : ""} détecté${d.traitements.length > 1 ? "s" : ""}`;
    this.hote(semaines.length ? semaines : null);
    e.modes.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.mode === this.etat.mode)));
    e.vues.querySelectorAll("[data-affichage]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.affichage === this.etat.affichage)));
    this.rendreTraitements();
    this.afficherIgnorees();
    if (!semaines.length) { e.grille.replaceChildren(Object.assign(document.createElement("div"), { className: "empty-state", innerHTML: '<span class="empty-icon">▥</span><strong>Aucune semaine sur cette période</strong><p>Élargissez les dates du filtre pour retrouver des données.</p>' })); e.recap.replaceChildren(); e.exporter.disabled = true; if (e.exporterExcel) e.exporterExcel.disabled = true; return; }

    const semaine = semaines[i];
    const jours = semaine.jours.map((iso, k) => ({ iso, nom: VueBesoinHeure.JOURS[k], date: VueBesoinHeure.dateFr(iso), ferie: this.ferie(iso) }));
    const noms = d.traitements.filter(t => this.etat.selection.has(t));
    const libMode = { besoin: "Besoin en heures", charge: "Charge en heures", volume: "Volume reçu" }[this.etat.mode];
    e.titre.textContent = `${libMode} · ${semaine.label}`;
    e.description.textContent = `Lundi → vendredi, de 0 h à 23 h · ${noms.length} traitement${noms.length > 1 ? "s" : ""} affiché${noms.length > 1 ? "s" : ""}`;
    e.formule.textContent = { besoin: "Besoin (h) = Reçu × DMT ÷ 3 600 ÷ (occupation ÷ 60) · occupation = 60 min si non renseignée", charge: "Charge (h) = Reçu × DMT ÷ 3 600", volume: "Volume reçu = somme de la colonne Reçu pour chaque heure" }[this.etat.mode];
    e.exporter.disabled = !noms.length; if (e.exporterExcel) e.exporterExcel.disabled = !noms.length;

    this.rendreAlerte(noms, jours);
    const cumul = jours.map(j => this.serie(j.iso, noms));
    this.rendreKpis(jours, cumul, noms);
    if (!noms.length) {
      e.grille.replaceChildren(Object.assign(document.createElement("div"), { className: "empty-state", innerHTML: '<span class="empty-icon">☷</span><strong>Aucun traitement sélectionné</strong><p>Choisissez au moins un traitement dans les filtres ci-dessus.</p>' }));
      e.recap.replaceChildren(); return;
    }
    const blocs = [];
    if (this.etat.affichage === "detail") {
      noms.forEach((nom, k) => {
        const series = jours.map(j => this.serie(j.iso, [nom]));
        const total = series.reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0);
        const det = document.createElement("details"); det.className = "bh-block"; det.open = noms.length <= 3 || k === 0;
        const sum = document.createElement("summary");
        sum.className = "bh-treatment-head";
        sum.dataset.traitement = nom;
        const t = document.createElement("span"); t.className = "bh-treatment-name";
        const label = document.createElement("span"); label.className = "bh-treatment-label"; label.textContent = "Traitement";
        const name = document.createElement("span"); name.className = "bh-treatment-value"; name.textContent = nom;
        t.append(label, name);
        const meta = document.createElement("span"); meta.className = "bh-meta"; meta.textContent = `Total semaine : ${this.formater(total)} ${this.unite()}`;
        sum.append(t, meta);
        const sc = document.createElement("div"); sc.className = "bh-scroll"; sc.append(this.construireGrille(jours, series));
        det.append(sum, sc); blocs.push(det);
      });
    } else {
      const bloc = document.createElement("div"); bloc.className = "bh-block";
      const sc = document.createElement("div"); sc.className = "bh-scroll"; sc.append(this.construireGrille(jours, cumul));
      bloc.append(sc); blocs.push(bloc);
    }
    e.grille.replaceChildren(...blocs);
    this.rendreRecap(jours, noms);
  }

  rendreTraitements() {
    const d = this.donnees, e = this.el, tous = this.etat.selection.size === d.traitements.length;
    const tout = document.createElement("button"); tout.type = "button"; tout.className = "bh-chip bh-chip-all"; tout.dataset.all = "1"; tout.setAttribute("aria-pressed", String(tous)); tout.textContent = "Tous les traitements";
    const chips = d.traitements.map(nom => { const b = document.createElement("button"); b.type = "button"; b.className = "bh-chip"; b.dataset.trait = nom; b.setAttribute("aria-pressed", String(this.etat.selection.has(nom))); b.textContent = nom; b.title = nom; return b; });
    e.traitements.replaceChildren(tout, ...chips);
    e.traitCount.textContent = `${this.etat.selection.size} / ${d.traitements.length} sélectionné${this.etat.selection.size > 1 ? "s" : ""}`;
  }

  afficherIgnorees() {
    const s = this.donnees?.stats; if (!s) { this.el.ignorees.textContent = ""; return; }
    const morceaux = [];
    if (s.weekend) morceaux.push(`${s.weekend.toLocaleString("fr-FR")} ligne(s) de week-end exclue(s)`);
    const illisibles = s.date + s.heure + s.volume;
    if (illisibles) morceaux.push(`${illisibles.toLocaleString("fr-FR")} ligne(s) ignorée(s) (date, heure ou volume illisible)`);
    if (s.volumeParLigne) morceaux.push("colonne Reçu vide : chaque ligne compte pour 1");
    this.el.ignorees.textContent = morceaux.join(" · ");
  }

  rendreAlerte(noms, jours) {
    const a = this.el.alerte;
    const manquants = this.etat.mode === "volume" ? [] : noms.filter(n => this.hypothese(n).dmt === null && this.volumeSemaine(n, jours) > 0);
    if (!manquants.length) { a.classList.add("hidden"); a.replaceChildren(); return; }
    const bloc = document.createElement("div"); bloc.className = "validation-banner"; bloc.dataset.etat = "warn";
    const tete = document.createElement("div"); tete.className = "validation-banner-heading";
    const ic = document.createElement("span"); ic.className = "validation-banner-icon"; ic.textContent = "!";
    const tx = document.createElement("div"); const h2 = document.createElement("h2"); const p = document.createElement("p");
    h2.textContent = `DMT manquant pour ${manquants.length} traitement${manquants.length > 1 ? "s" : ""}`;
    p.textContent = "Leur besoin est compté à 0 h. Renseignez le DMT dans Hypothèses, ou passez à l’indicateur « Volume reçu ».";
    tx.append(h2, p); tete.append(ic, tx);
    const g = document.createElement("div"); g.className = "validation-group validation-warnings";
    const st = document.createElement("strong"); st.textContent = "Traitements concernés"; const ul = document.createElement("ul");
    manquants.forEach(n => { const li = document.createElement("li"); li.textContent = n; ul.append(li); }); g.append(st, ul);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "button button-secondary self-start"; btn.textContent = "Ouvrir Hypothèses →";
    btn.addEventListener("click", () => window.application.afficherVue("hypotheses"));
    bloc.append(tete, g, btn); a.replaceChildren(bloc); a.classList.remove("hidden");
  }

  rendreKpis(jours, series, noms) {
    const $ = s => document.querySelector(s), u = this.unite();
    const parJour = series.map(s => s.reduce((x, y) => x + y, 0)), total = parJour.reduce((x, y) => x + y, 0);
    const parHeure = Array.from({ length: 24 }, (_, h) => series.reduce((s, a) => s + a[h], 0));
    $("#besoinKpiTotalLabel").textContent = { besoin: "Besoin total de la semaine", charge: "Charge totale de la semaine", volume: "Volume reçu de la semaine" }[this.etat.mode];
    $("#besoinKpiTotal").textContent = this.formater(total);
    $("#besoinKpiTotalDetail").textContent = u === "h" ? "heures sur les 5 jours ouvrés" : "contacts sur les 5 jours ouvrés";
    const hp = parHeure.indexOf(Math.max(...parHeure)), jp = parJour.indexOf(Math.max(...parJour));
    $("#besoinKpiPic").textContent = total > 0 ? VueBesoinHeure.heureLibelle(hp) : "—";
    $("#besoinKpiPicDetail").textContent = total > 0 ? `${this.formater(parHeure[hp])} ${u} cumulées sur la semaine` : "Aucune activité";
    $("#besoinKpiJour").textContent = total > 0 ? `${jours[jp].nom} ${jours[jp].date.slice(0, 5)}` : "—";
    $("#besoinKpiJourDetail").textContent = total > 0 ? `${this.formater(parJour[jp])} ${u}` : "Aucune activité";
    $("#besoinKpiTrait").textContent = String(noms.length);
    $("#besoinKpiTraitDetail").textContent = `sur ${this.donnees.traitements.length} traitement${this.donnees.traitements.length > 1 ? "s" : ""} détecté${this.donnees.traitements.length > 1 ? "s" : ""}`;
  }

  creerBadgeFerie(ferie) {
    const b = document.createElement("span");
    b.className = "bh-ferie";
    b.title = `Jour férié : ${ferie.libelle || "Jour férié"} (${ferie.pays || "pays non précisé"})`;
    b.setAttribute("aria-label", `Jour férié : ${ferie.libelle || "Jour férié"}`);
    const separateur = document.createElement("span");
    separateur.className = "bh-ferie-separator";
    separateur.setAttribute("aria-hidden", "true");
    separateur.textContent = "·";
    const libelle = document.createElement("span");
    libelle.className = "bh-ferie-label";
    libelle.textContent = ferie.libelle || "Jour férié";
    b.append(separateur, libelle);
    return b;
  }

  construireGrille(jours, series) {
    /*
     * Vue Planify : une ligne = un jour ouvré, une colonne = une heure.
     * Cette orientation suit le modèle demandé : Date | Jour | 0 ... 23.
     */
    const parJour = series.map(s => s.reduce((x, y) => x + y, 0));
    const parHeure = Array.from({ length: 24 }, (_, h) => series.reduce((s, a) => s + a[h], 0));
    const valeursPositives = series.flatMap(s => [...s]).filter(v => Number.isFinite(v) && v > 1e-9);
    const min = valeursPositives.length ? Math.min(...valeursPositives) : 0;
    const max = valeursPositives.length ? Math.max(...valeursPositives) : 0;
    // Dégradé dynamique Dimensionnement : chaque valeur est positionnée
    // entre la valeur minimale et maximale réellement présentes dans la grille.
    // Palette bleue : faible → bleu très clair, moyen → bleu ADM, élevé → bleu marine.
    const intensite = v => {
      if (!(v > 1e-9) || max <= 0) return 0;
      if (max === min) return 0.5;
      const normalisee = Math.max(0, Math.min(1, (v - min) / (max - min)));
      return Math.pow(normalisee, 0.78);
    };

    const couleurBesoin = v => {
      const t = intensite(v);
      // Dégradé continu uniquement entre le bleu très clair et le bleu ADM.
      // 0 = #E8F1FA, 1 = #3478B8. Aucun bleu marine dans les cellules.
      const faible = [232, 241, 250];
      const eleve = [52, 120, 184];
      return faible.map((x, i) => Math.round(x + (eleve[i] - x) * t));
    };
    const cellule = (tag, texte, classe = "") => {
      const c = document.createElement(tag);
      if (classe) c.className = classe;
      c.textContent = texte;
      return c;
    };

    const table = document.createElement("table");
    table.className = "bh-table bh-week-table";
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = "Besoin par heure de 0 h à 23 h pour les cinq jours de la semaine";
    table.append(caption);

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    hr.append(cellule("th", "Date", "bh-date"));
    hr.append(cellule("th", "Jour", "bh-daycol"));
    for (let h = 0; h < 24; h++) hr.append(cellule("th", String(h), "bh-hour-col"));
    hr.append(cellule("th", "Total", "bh-total"));
    thead.append(hr);
    table.append(thead);

    const tbody = document.createElement("tbody");
    jours.forEach((j, k) => {
      const tr = document.createElement("tr");
      const valeurs = series[k] || new Float64Array(24);

      const date = cellule("th", j.date, "bh-date");
      date.scope = "row";
      date.title = `${j.nom} ${j.date}`;
      tr.append(date);

      const jour = document.createElement("th");
      jour.scope = "row";
      jour.className = "bh-daycol";
      jour.textContent = j.nom;
      if (j.ferie) jour.append(this.creerBadgeFerie(j.ferie));
      tr.append(jour);

      for (let h = 0; h < 24; h++) {
        const v = valeurs[h];
        const td = cellule("td", v > 1e-9 ? this.formater(v) : "·", `bh-cell${v > 1e-9 ? "" : " bh-zero"}`);
        if (v > 1e-9 && max > 0) {
          const a = intensite(v);
          // Dégradé bleu clair : #E8F1FA → #3478B8.
          // Chaque nuance dépend de la valeur réelle de la cellule.
          const [r, g, b] = couleurBesoin(v);
          td.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
          td.style.color = a >= 0.78 ? "#FFFFFF" : "#1A214D";
          td.style.fontWeight = a >= 0.72 ? "800" : "700";
        }
        td.title = `${j.nom} ${j.date} · ${VueBesoinHeure.heureLibelle(h)} : ${this.formater(v)} ${this.unite()}`;
        tr.append(td);
      }

      const totalLigne = Array.from(valeurs).reduce((somme, valeur) => somme + valeur, 0);
      tr.append(cellule("td", this.formater(totalLigne), "bh-total"));
      tbody.append(tr);
    });
    table.append(tbody);

    return table;
  }

  rendreRecap(jours, noms) {
    const table = document.createElement("table"); table.className = "data-table hyp-table bh-recap";
    const thead = document.createElement("thead"), hr = document.createElement("tr");
    ["Traitement", "DMT", "Occupation", ...jours.map(j => `${j.nom.slice(0, 3)} ${j.date.slice(0, 5)}`)].forEach(t => { const th = document.createElement("th"); th.textContent = t; hr.append(th); });
    thead.append(hr); table.append(thead);
    const tbody = document.createElement("tbody"), sommes = new Float64Array(jours.length);
    noms.forEach(nom => {
      const tr = document.createElement("tr"), hyp = this.hypothese(nom);
      const nomTd = document.createElement("td"); nomTd.className = "hyp-name"; const st = document.createElement("strong"); st.textContent = nom; nomTd.append(st); tr.append(nomTd);
      const dmt = document.createElement("td"), c1 = document.createElement("span"); c1.className = `bh-hyp${hyp.dmt === null ? " bh-hyp-manquant" : ""}`; c1.textContent = hyp.dmt === null ? "À renseigner" : hyp.dmtTexte; dmt.append(c1); tr.append(dmt);
      const occ = document.createElement("td"), c2 = document.createElement("span"); c2.className = "bh-hyp"; c2.textContent = hyp.occupation > 0 ? `${hyp.occupation} min` : "60 min (défaut)"; occ.append(c2); tr.append(occ);
      jours.forEach((j, k) => { const v = this.serie(j.iso, [nom]).reduce((x, y) => x + y, 0); sommes[k] += v; const td = document.createElement("td"); td.textContent = v > 1e-9 ? this.formater(v) : "·"; tr.append(td); });
      tbody.append(tr);
    });
    table.append(tbody);
    const tfoot = document.createElement("tfoot"), fr = document.createElement("tr");
    const lib = document.createElement("td"); lib.colSpan = 3; lib.textContent = "Total des traitements affichés"; fr.append(lib);
    sommes.forEach(v => { const td = document.createElement("td"); td.textContent = this.formater(v); fr.append(td); });
    tfoot.append(fr); table.append(tfoot);
    this.el.recap.replaceChildren(table);
  }

  creerDialogueExport() {
    const modal = document.createElement("div");
    modal.id = "besoinExportDialog";
    modal.className = "bh-export-overlay hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "bhExportTitle");
    modal.innerHTML = `
      <section class="bh-export-dialog">
        <div class="bh-export-top"><div><span class="bh-export-kicker">PLANIFY · EXPORT</span><h2 id="bhExportTitle">Exporter les données</h2><p>Choisissez la structure et le format du fichier à télécharger.</p></div><button type="button" class="bh-export-close" data-export-cancel aria-label="Fermer">×</button></div>
        <div class="bh-export-section"><h3>1. Structure des données</h3>
          <label class="bh-export-choice"><input type="radio" name="besoinExportStructure" value="actuel" checked><span><strong>Structure actuelle</strong><small>Présentation en tableau avec un total calculé pour chaque ligne de date.</small></span></label>
          <label class="bh-export-choice"><input type="radio" name="besoinExportStructure" value="plat"><span><strong>Données dépivotées · format plat</strong><small>Une ligne par date, traitement et heure, pratique pour Excel, Power BI et les analyses.</small></span></label>
        </div>
        <div class="bh-export-section"><h3>2. Type de fichier</h3>
          <div class="bh-export-formats"><label class="bh-export-format"><input type="radio" name="besoinExportFormat" value="xlsx" checked><span class="bh-format-icon">XLSX</span><span><strong>Excel</strong><small>.xlsx</small></span></label><label class="bh-export-format"><input type="radio" name="besoinExportFormat" value="csv"><span class="bh-format-icon bh-format-csv">CSV</span><span><strong>CSV</strong><small>.csv · séparateur ;</small></span></label></div>
        </div>
        <div class="bh-export-actions"><button type="button" class="button button-secondary" data-export-cancel>Annuler</button><button type="button" class="button button-primary" data-export-confirm>Télécharger le fichier ↗</button></div>
      </section>`;
    document.body.append(modal);
    this.exportDialog = modal;
  }

  ouvrirDialogueExport() {
    if (!this.donnees || !this.semaines().some(s => s.lundi === this.etat.semaine) || !this.donnees.traitements.some(t => this.etat.selection.has(t))) return;
    this.exportDialog.classList.remove("hidden");
    this.exportDialog.querySelector("[data-export-confirm]").focus();
  }

  fermerDialogueExport() { this.exportDialog?.classList.add("hidden"); }

  exporterSelection(format, structure) {
    const d = this.donnees;
    if (!d) return;
    const semaine = this.semaines().find(s => s.lundi === this.etat.semaine);
    if (!semaine) return;
    const noms = d.traitements.filter(t => this.etat.selection.has(t));
    if (!noms.length) return;
    if (format === "xlsx" && !window.XLSX) {
      Toast.afficher("La bibliothèque Excel n’est pas disponible. Vérifiez la connexion Internet puis rechargez la page.", "erreur", 5000);
      return;
    }
    const jours = semaine.jours.map((iso, k) => ({ iso, nom: VueBesoinHeure.JOURS[k], date: VueBesoinHeure.dateFr(iso) }));
    const mode = this.etat.mode;
    const suffixe = `${mode}_${semaine.lundi}`;
    const nb = v => Math.round(v * 10000) / 10000;
    const libIndicateur = { besoin: "Besoin en heures", charge: "Charge en heures", volume: "Volume reçu" }[mode];
    let lignes = [];
    if (structure === "plat") {
      // Format dépivoté : exporter toutes les dates réellement présentes dans les données,
      // indépendamment de la semaine actuellement affichée dans l'interface.
      lignes.push(["Date", "Jour", "Heure", "Traitement", "Besoin en heure"]);
      d.jours.forEach(iso => {
        const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" })
          .format(new Date(`${iso}T12:00:00Z`))
          .replace(/^./, c => c.toLocaleUpperCase("fr-FR"));
        noms.forEach(traitement => {
          const serie = this.serie(iso, [traitement]);
          for (let h = 0; h < 24; h++) {
            lignes.push([iso, jour, h, traitement, nb(serie[h])]);
          }
        });
      });
    } else {
      lignes.push(["Traitement", "Heure", ...jours.map(j => `${j.nom} ${j.date}`)]);
      const bloc = (titre, series) => {
        for (let h = 0; h < 24; h++) { const vals = series.map(s => s[h]); lignes.push([titre, VueBesoinHeure.heureLibelle(h), ...vals.map(nb), nb(vals.reduce((x, y) => x + y, 0))]); }
        const tj = series.map(s => s.reduce((x, y) => x + y, 0));
        lignes.push([titre, "Total", ...tj.map(nb)]);
      };
      bloc(noms.length > 1 ? "TOUS (cumulé)" : noms[0], jours.map(j => this.serie(j.iso, noms)));
      if (noms.length > 1) noms.forEach(n => bloc(n, jours.map(j => this.serie(j.iso, [n]))));
    }
    const nomFichier = structure === "plat"
      ? `Besoin_en_heure_plat_toutes_dates_${mode}_${d.min}_${d.max}`
      : `Besoin_en_heure_actuel_${suffixe}`;
    if (format === "csv") {
      const echapper = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = lignes.map(l => l.map(echapper).join(";")).join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `${nomFichier}.csv`; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } else {
      const feuille = XLSX.utils.aoa_to_sheet(lignes);
      feuille["!autofilter"] = { ref: feuille["!ref"] };
      feuille["!freeze"] = { xSplit: 0, ySplit: 1 };
      feuille["!cols"] = structure === "plat"
        ? [{wch:14},{wch:16},{wch:16},{wch:28},{wch:18}]
        : [{wch:28},{wch:18}, ...jours.map(() => ({wch:18})), {wch:16}];
      const classeur = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(classeur, feuille, structure === "plat" ? "Données à plat" : "Structure actuelle");
      XLSX.writeFile(classeur, `${nomFichier}.xlsx`);
    }
    Toast.afficher(`Export ${format.toUpperCase()} prêt · ${lignes.length - 1} lignes · ${structure === "plat" ? "données dépivotées" : "structure actuelle"}`);
  }

}

class Application {
  constructor() {
    this.vueRecu = new VueFichiersRecus();
    this.vueHypotheses = new VueHypotheses(() => this.vueRecu.fichierActuel);
    this.vueFeries = new VueJoursFeries();
    this.vuePrevision = new VuePrevision(() => this.vueRecu.fichierActuel);
    this.vueBesoin = new VueBesoinHeure(() => this.vueRecu.fichierActuel, () => this.vueHypotheses.valeurs, () => this.vueFeries.jours);
    this.vueFeries.actualiser();
    this.initialiserNavigation();
    document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()).toUpperCase();
  }

  initialiserNavigation() {
    document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
      if (button.disabled) return;
      this.afficherVue(button.dataset.view);
      this.basculerMenu(false);
    }));
    document.querySelectorAll("[data-go-recu]").forEach(button => button.addEventListener("click", () => this.afficherVue("recu")));
    document.querySelector("#mobileMenu").addEventListener("click", () => this.basculerMenu(!document.querySelector("#sidebar").classList.contains("open")));
    document.querySelector("#sidebarOverlay").addEventListener("click", () => this.basculerMenu(false));
    document.addEventListener("keydown", e => { if (e.key === "Escape") this.basculerMenu(false); });
  }

  basculerMenu(ouvert) {
    document.querySelector("#sidebar").classList.toggle("open", ouvert);
    document.querySelector("#sidebarOverlay").classList.toggle("hidden", !ouvert);
  }

  actualiserDashboard() {
    const fichier = this.vueRecu.fichierActuel;
    const lignes = fichier && Array.isArray(fichier.donnees) ? fichier.donnees.length : 0;
    const detailFichier = document.querySelector("#dashFichierDetail");
    document.querySelector("#dashFichier").textContent = fichier ? fichier.nom : "Aucun fichier";
    detailFichier.textContent = fichier
      ? `${(fichier.nombreLignes ?? lignes).toLocaleString("fr-FR")} ligne(s) · ${(fichier.nombreColonnes || 0).toLocaleString("fr-FR")} colonne(s)`
      : "Importez un fichier dans REÇU pour commencer.";

    const p = this.vueHypotheses.progression();
    const nbLignes = fichier ? (fichier.nombreLignes ?? lignes) : 0;
    const reste = Math.max(0, p.total - p.complets);
    document.querySelector("#dashRows").textContent = nbLignes.toLocaleString("fr-FR");
    document.querySelector("#dashRowsDetail").textContent = fichier ? "lignes dans le fichier actif" : "Aucune donnée importée";

    // Compter les clients distincts, et non les couples client/campagne.
    const clientsDistincts = new Map();
    const ajouterClient = valeur => {
      const nom = String(valeur ?? "").trim();
      const cle = normaliserProfilTexte(nom);
      if (nom && cle && cle !== "non renseigne" && cle !== "non renseignee") {
        if (!clientsDistincts.has(cle)) clientsDistincts.set(cle, nom);
      }
    };
    lireProfils().forEach(profil => ajouterClient(profil?.client));
    try {
      const stockProfils = JSON.parse(localStorage.getItem("dimensionnement.recu.profils.v1")) || {};
      Object.values(stockProfils).forEach(profil => ajouterClient(profil?.client));
    } catch {}
    const nombreClients = clientsDistincts.size;
    const dashClients = document.querySelector("#dashClients");
    const dashClientsDetail = document.querySelector("#dashClientsDetail");
    if (dashClients) dashClients.textContent = nombreClients.toLocaleString("fr-FR");
    if (dashClientsDetail) dashClientsDetail.textContent = nombreClients ? "clients distincts enregistrés" : "Aucun client enregistré";

    document.querySelector("#dashTreatments").textContent = p.total.toLocaleString("fr-FR");
    document.querySelector("#dashTreatmentsDetail").textContent = p.total ? "traitement(s) distinct(s) issu(s) de Statut" : "Aucun traitement détecté";
    document.querySelector("#dashTraitements").textContent = `${p.complets} / ${p.total}`;
    document.querySelector("#dashTraitementsDetail").textContent = p.total
      ? `${Math.round((p.complets / p.total) * 100)} % des traitements entièrement renseignés`
      : "Aucune hypothèse renseignée";
    const pct = p.total ? Math.round((p.complets / p.total) * 100) : 0;
    document.querySelector("#dashBar").style.width = `${pct}%`;
    document.querySelector("#dashBarWrap").setAttribute("aria-valuenow", String(pct));
    document.querySelector("#dashRemaining").textContent = reste.toLocaleString("fr-FR");
    document.querySelector("#dashRemainingDetail").textContent = reste
      ? "traitement(s) avec des paramètres à renseigner"
      : (p.total ? "Toutes les hypothèses sont complètes" : "Aucune action en attente");
  }

  actualiserContexteBesoin() {
    const profil = (window.dimensionnementProfil && window.dimensionnementProfil.client && window.dimensionnementProfil.campagne)
      ? window.dimensionnementProfil
      : (this.vueRecu.fichierActuel || {});
    const client = profil.client || "Non renseigné";
    const campagne = profil.campagne || "Non renseignée";
    const clientEl = document.querySelector("#besoinActiveClient");
    const campagneEl = document.querySelector("#besoinActiveCampaign");
    const fichierEl = document.querySelector("#besoinCurrentFile");
    if (clientEl) {
      clientEl.textContent = client;
      clientEl.title = `Client en cours : ${client}`;
    }
    if (campagneEl) {
      campagneEl.textContent = campagne;
      campagneEl.title = `Campagne en cours : ${campagne}`;
    }
    const fichier = this.vueRecu.fichierActuel;
    if (fichierEl) {
      fichierEl.textContent = fichier
        ? `${fichier.nom || "Fichier reçu"} · ${(fichier.nombreLignes || 0).toLocaleString("fr-FR")} ligne(s) · ${fichier.client || client} / ${fichier.campagne || campagne}`
        : "Aucun fichier chargé";
      fichierEl.title = fichierEl.textContent;
    }
  }

  afficherVue(vue) {
    document.querySelectorAll(".page-view").forEach(section => section.classList.add("hidden"));
    // L’historique reste accessible comme onglet dans Prévision, sans entrée séparée dans le menu principal.
    const vueCible = vue === "historique" ? "prevision" : vue;
    const cible = document.querySelector(`#${vueCible}View`);
    if (cible) cible.classList.remove("hidden");
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === vue));
    const titres = { recu: "REÇU", archive: "ARCHIVE IMPORT", hypotheses: "HYPOTHÈSES", feries: "JOURS FÉRIÉS", prevision: "PRÉVISION", besoin: "BESOIN EN HEURE", historique: "HISTORIQUE", dashboard: "TABLEAU DE BORD" };
    document.querySelector("#breadcrumbCurrent").textContent = titres[vue] || "TABLEAU DE BORD";
    const besoinHeaderContext = document.querySelector("#besoinHeaderContext");
    if (besoinHeaderContext) besoinHeaderContext.classList.remove("hidden");
    if (vue === "hypotheses") this.vueHypotheses.actualiser();
    if (vue === "feries") this.vueFeries.actualiser();
    if (vue === "prevision" || vue === "historique") {
      this.vuePrevision.actualiser();
      if (vue === "historique") this.vuePrevision.changerOnglet("historique");
    }
    if (vue === "besoin") { this.vueBesoin.actualiser(); this.actualiserContexteBesoin(); }
    if (vue === "dashboard") this.actualiserDashboard();
    this.actualiserContexteBesoin();
    window.scrollTo({ top: 0 });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.application = new Application();
  initialiserDemonstrationAzure();
});

function initialiserDemonstrationAzure() {
  const modal = document.querySelector("#azureDemoModal");
  const open = document.querySelector("#openAzureDemo");
  const close = document.querySelector("#closeAzureDemo");
  const status = document.querySelector("#azureDemoStatus");
  const preview = document.querySelector("#azureDemoPreview");
  const tableSelect = document.querySelector("#azureTable");
  const refreshTables = document.querySelector("#azureRefreshTables");
  if (!modal || !open || !status || !preview) return;
  const setStatus = (message, kind = "") => { status.className = `azure-demo-status${kind ? ` azure-status-${kind}` : ""}`; status.textContent = message; };
  const showModal = () => { modal.classList.remove("hidden"); document.body.classList.add("azure-modal-open"); setStatus("Prêt à contacter le service Azure configuré sur le serveur."); preview.classList.add("hidden"); close?.focus(); };
  const hideModal = () => { modal.classList.add("hidden"); document.body.classList.remove("azure-modal-open"); open.focus(); };
  const api = async (url, options = {}) => {
    const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
    let payload = {}; try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || `Erreur du service (${response.status}).`);
    return payload;
  };
  open.addEventListener("click", showModal);
  close?.addEventListener("click", hideModal);
  modal.querySelectorAll("[data-azure-close]").forEach(el => el.addEventListener("click", hideModal));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.classList.contains("hidden")) hideModal(); });
  document.querySelector("#azureTestConnection")?.addEventListener("click", async () => {
    const button = document.querySelector("#azureTestConnection"); button.disabled = true;
    setStatus("Vérification de la connexion au service Azure…");
    try { const result = await api("/api/azure-sql/status"); setStatus(result.message || "Connexion Azure SQL opérationnelle.", "success"); }
    catch (error) { setStatus(`${error.message} Vérifiez que le serveur de l’application est démarré et que ses paramètres Azure SQL sont configurés.`, "warning"); }
    finally { button.disabled = false; }
  });
  refreshTables?.addEventListener("click", async () => {
    refreshTables.disabled = true; setStatus("Chargement des tables et vues Azure SQL…");
    try {
      const result = await api("/api/azure-sql/tables");
      tableSelect.replaceChildren();
      result.tables.forEach(item => { const option = document.createElement("option"); option.value = item.name; option.textContent = item.name; tableSelect.append(option); });
      if (!result.tables.length) throw new Error("Aucune table ou vue accessible trouvée dans cette base.");
      setStatus(`${result.tables.length} table(s)/vue(s) disponible(s). Sélectionnez une source puis importez.`, "success");
    } catch (error) { setStatus(error.message, "warning"); }
    finally { refreshTables.disabled = false; }
  });
  document.querySelector("#azureLoadPreview")?.addEventListener("click", async () => {
    const table = tableSelect?.value;
    if (!table) { setStatus("Chargez d’abord la liste des tables Azure SQL.", "warning"); return; }
    const button = document.querySelector("#azureLoadPreview"); button.disabled = true;
    setStatus("Lecture des données depuis Azure SQL…"); preview.classList.add("hidden");
    try {
      const result = await api("/api/azure-sql/import", { method: "POST", body: JSON.stringify({ table, limit: 5000 }) });
      const rows = Array.isArray(result.rows) ? result.rows : [];
      if (!rows.length) { setStatus("La table ne contient aucune ligne à importer.", "warning"); return; }
      const columns = Object.keys(rows[0]);
      const thead = preview.querySelector("thead"); const tbody = preview.querySelector("tbody");
      thead.replaceChildren(); tbody.replaceChildren();
      const headerRow = document.createElement("tr"); columns.slice(0, 8).forEach(column => { const th = document.createElement("th"); th.textContent = column; headerRow.append(th); }); thead.append(headerRow);
      rows.slice(0, 8).forEach(row => { const tr = document.createElement("tr"); columns.slice(0, 8).forEach(column => { const td = document.createElement("td"); td.textContent = String(row[column] ?? ""); tr.append(td); }); tbody.append(tr); });
      document.querySelector("#azurePreviewTitle").textContent = result.table || table;
      preview.querySelector(".azure-preview-count").textContent = `${rows.length.toLocaleString("fr-FR")} ligne(s)`;
      preview.querySelector(".azure-preview-footnote").textContent = `Aperçu réel issu d’Azure SQL. Limite de sécurité : ${result.limit || 5000} lignes par import.`;
      preview.classList.remove("hidden");
      const importButton = document.querySelector("#azureImportData"); importButton.disabled = false;
      importButton.onclick = async () => {
        importButton.disabled = true;
        try { await window.application.vueRecu.importerDepuisAzure(result.table || table, rows); setStatus(`${rows.length.toLocaleString("fr-FR")} ligne(s) importée(s) dans REÇU.`, "success"); hideModal(); }
        catch (error) { setStatus(error.message, "warning"); }
        finally { importButton.disabled = false; }
      };
      setStatus(`Aperçu chargé depuis Azure SQL : ${rows.length.toLocaleString("fr-FR")} ligne(s). Vérifiez les données puis cliquez sur « Importer dans REÇU ».`, "success");
      preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) { setStatus(error.message, "warning"); }
    finally { button.disabled = false; }
  });
}
