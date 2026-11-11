// assembler.mjs — vérifie une visite et fabrique la page HTML autonome.
//
// Utilisation :
//   node assembler.mjs <dossier-de-la-visite> [racine-du-projet]
//
// - <dossier-de-la-visite> contient visite.json (écrit par Claude).
// - [racine-du-projet] sert à retrouver les fichiers cités (par défaut : dossier courant).
// - Le template est lu à côté de ce script : template.html.
// - Résultat : visite.html, écrit dans le dossier de la visite.
//
// Codes de sortie : 0 = page produite ; 1 = visite refusée (JSON invalide ou erreurs listées) : corriger visite.json ;
// 2 = problème d'utilisation (argument manquant, visite.json absent, template introuvable).
// Aucune dépendance : seulement les modules intégrés à Node.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIGNES_DE_CONTEXTE = 3; // lignes grises affichées avant et après la plage surlignée
const MARQUEUR = "__DONNEES_VISITE__"; // emplacement des données dans template.html
const NB_QUESTIONS_MIN = 4;
const NB_QUESTIONS_MAX = 5;

const dossierScript = path.dirname(fileURLToPath(import.meta.url));

function arreter(message, code) {
  console.error(message);
  process.exit(code);
}

// ---------- 1. Lire les arguments et visite.json ----------

const [dossierVisiteArg, racineArg] = process.argv.slice(2);
if (!dossierVisiteArg) {
  arreter("Utilisation : node assembler.mjs <dossier-de-la-visite> [racine-du-projet]", 2);
}
const dossierVisite = path.resolve(dossierVisiteArg);
const racine = path.resolve(racineArg || process.cwd());
const cheminJson = path.join(dossierVisite, "visite.json");

// Fichier absent ou illisible : problème d'utilisation (code 2).
let texteJson;
try {
  texteJson = lireTexte(cheminJson);
} catch (e) {
  arreter(`Impossible de lire ${cheminJson} : ${e.message}`, 2);
}
// Contenu vide, mal formé ou qui n'est pas un objet : c'est visite.json qu'il faut corriger (code 1).
if (texteJson.trim() === "") {
  arreter("Visite refusée : visite.json est vide.", 1);
}
let visite;
try {
  visite = JSON.parse(texteJson);
} catch (e) {
  arreter(`Visite refusée : visite.json n'est pas un JSON valide (${e.message}).`, 1);
}
if (visite === null || typeof visite !== "object" || Array.isArray(visite)) {
  arreter("Visite refusée : visite.json doit contenir un objet { \"titre\": …, \"etapes\": […], … }.", 1);
}

// ---------- 2. Vérifier ----------

const erreurs = [];
const fichiersLus = new Map(); // chemin relatif -> tableau de lignes (on lit chaque fichier une seule fois)

function lireTexte(chemin) {
  // On enlève le BOM éventuel (caractère invisible que certains éditeurs Windows ajoutent).
  return fs.readFileSync(chemin, "utf8").replace(/^﻿/, "");
}

// Vrai si "cible" est à l'intérieur du dossier "dossier" (et n'est pas le dossier lui-même).
// On teste le segment ".." entier : un fichier nommé "..config.js" reste dans le projet.
function estDans(dossier, cible) {
  const relatif = path.relative(dossier, cible);
  if (relatif === "" || path.isAbsolute(relatif)) return false;
  return relatif !== ".." && !relatif.startsWith(".." + path.sep);
}

function lignesDe(fichierRelatif) {
  if (fichiersLus.has(fichierRelatif)) return fichiersLus.get(fichierRelatif);
  const absolu = path.resolve(racine, fichierRelatif);
  // Sécurité, 1er contrôle sur le texte du chemin : pas de "../../ailleurs" ni de chemin absolu hors du projet.
  if (!estDans(racine, absolu)) {
    throw new Error(`le fichier « ${fichierRelatif} » sort du projet`);
  }
  if (!fs.existsSync(absolu) || !fs.statSync(absolu).isFile()) {
    throw new Error(`le fichier « ${fichierRelatif} » n'existe pas`);
  }
  // 2e contrôle sur l'emplacement réel : un lien (symbolique ou jonction Windows) placé dans le projet
  // peut pointer ailleurs. realpathSync suit les liens et donne le vrai chemin sur le disque.
  if (!estDans(fs.realpathSync(racine), fs.realpathSync(absolu))) {
    throw new Error(`le fichier « ${fichierRelatif} » sort du projet par un lien`);
  }
  const lignes = lireTexte(absolu).split(/\r?\n/);
  if (lignes.length > 1 && lignes[lignes.length - 1] === "") lignes.pop(); // saut de ligne final
  fichiersLus.set(fichierRelatif, lignes);
  return lignes;
}

const estTexte = (v) => typeof v === "string" && v.trim() !== "";
const estEntier = (v) => Number.isInteger(v);

if (!estTexte(visite.titre)) erreurs.push("Visite : « titre » manquant ou vide.");
if (!estTexte(visite.resume)) erreurs.push("Visite : « resume » manquant ou vide.");
if (!estTexte(visite.questionOuverte)) erreurs.push("Visite : « questionOuverte » manquante ou vide.");

if (visite.etapes !== undefined && !Array.isArray(visite.etapes)) erreurs.push("Visite : « etapes » doit être une liste.");
const etapes = Array.isArray(visite.etapes) ? visite.etapes : [];
if (etapes.length === 0) erreurs.push("Visite : il faut au moins une étape dans « etapes ».");

const idsVus = new Set();
const etapesFinales = [];

etapes.forEach((etape, i) => {
  const nom = `Étape ${i + 1}${estTexte(etape?.id) ? ` (${etape.id})` : ""}`;
  const avant = erreurs.length;

  for (const champ of ["id", "titre", "fichier", "repere", "explication"]) {
    if (!estTexte(etape?.[champ])) erreurs.push(`${nom} : « ${champ} » manquant ou vide.`);
  }
  if (estTexte(etape?.id)) {
    if (idsVus.has(etape.id)) erreurs.push(`${nom} : l'id « ${etape.id} » est déjà utilisé.`);
    idsVus.add(etape.id);
  }
  const debut = etape?.lignes?.debut;
  const fin = etape?.lignes?.fin;
  if (!estEntier(debut) || !estEntier(fin)) {
    erreurs.push(`${nom} : « lignes » doit être { "debut": nombre entier, "fin": nombre entier }.`);
  }
  if (etape?.transition !== undefined && !estTexte(etape.transition)) {
    erreurs.push(`${nom} : « transition » doit être une phrase non vide (ou absente).`);
  }
  if (estTexte(etape?.transition) && i === etapes.length - 1) {
    erreurs.push(`${nom} : la dernière étape ne peut pas avoir de « transition ».`);
  }
  if (etape?.exemple !== undefined) {
    const ok = Array.isArray(etape.exemple) && etape.exemple.every((x) => estTexte(x?.nom) && estTexte(x?.valeur));
    if (!ok) erreurs.push(`${nom} : « exemple » doit être une liste de { "nom": texte, "valeur": texte }.`);
  }
  if (erreurs.length > avant) return; // inutile d'aller lire le fichier si la forme est déjà fausse

  // Le fichier, la plage de lignes, puis le repère.
  let lignes;
  try {
    lignes = lignesDe(etape.fichier);
  } catch (e) {
    erreurs.push(`${nom} : ${e.message}.`);
    return;
  }
  if (debut < 1 || fin < debut || fin > lignes.length) {
    erreurs.push(`${nom} : lignes ${debut}-${fin} impossibles, « ${etape.fichier} » a ${lignes.length} lignes.`);
    return;
  }
  const plage = lignes.slice(debut - 1, fin).join("\n");
  if (!plage.includes(etape.repere)) {
    erreurs.push(`${nom} : repère « ${etape.repere} » introuvable dans ${etape.fichier}, lignes ${debut}-${fin}.`);
    return;
  }

  // Tout est bon : on recopie l'extrait depuis le disque, avec un peu de contexte autour.
  const premiere = Math.max(1, debut - LIGNES_DE_CONTEXTE);
  const derniere = Math.min(lignes.length, fin + LIGNES_DE_CONTEXTE);
  etapesFinales.push({
    ...etape,
    extrait: { premiereLigne: premiere, lignes: lignes.slice(premiere - 1, derniere) },
  });
});

if (visite.questions !== undefined && !Array.isArray(visite.questions)) erreurs.push("Visite : « questions » doit être une liste.");
const questions = Array.isArray(visite.questions) ? visite.questions : [];
if (questions.length < NB_QUESTIONS_MIN || questions.length > NB_QUESTIONS_MAX) {
  erreurs.push(`Visite : il faut entre ${NB_QUESTIONS_MIN} et ${NB_QUESTIONS_MAX} questions, il y en a ${questions.length}.`);
}
questions.forEach((q, i) => {
  const nom = `Question ${i + 1}`;
  if (!estTexte(q?.question)) erreurs.push(`${nom} : « question » manquante ou vide.`);
  if (!estTexte(q?.explication)) erreurs.push(`${nom} : « explication » manquante ou vide.`);
  const choix = q?.choix;
  if (!Array.isArray(choix) || choix.length < 2 || !choix.every(estTexte)) {
    erreurs.push(`${nom} : « choix » doit contenir au moins 2 textes non vides.`);
  } else if (!estEntier(q.bonneReponse) || q.bonneReponse < 0 || q.bonneReponse >= choix.length) {
    erreurs.push(`${nom} : « bonneReponse » doit être un entier entre 0 et ${choix.length - 1}.`);
  }
  if (!idsVus.has(q?.etape)) erreurs.push(`${nom} : « etape » = « ${q?.etape} » ne correspond à aucun id d'étape.`);
});

if (erreurs.length > 0) {
  console.error(`Visite refusée, ${erreurs.length} erreur(s) :`);
  for (const e of erreurs) console.error(`- ${e}`);
  process.exit(1);
}

// ---------- 3. Assembler la page ----------

const cheminTemplate = path.join(dossierScript, "template.html");
if (!fs.existsSync(cheminTemplate)) {
  arreter(`Visite valide, mais template introuvable : ${cheminTemplate}`, 2);
}
const template = lireTexte(cheminTemplate);
if (!template.includes(MARQUEUR)) {
  arreter(`Le template ne contient pas le marqueur ${MARQUEUR}.`, 2);
}

const donnees = {
  ...visite,
  etapes: etapesFinales,
  genereLe: new Date().toISOString(),
};
// Les données vont dans une balise <script type="application/json">. On remplace "<" par
// son code < : le JSON reste identique, mais un "</script>" dans un extrait de code
// ne peut plus fermer la balise par erreur.
const json = JSON.stringify(donnees).replace(/</g, "\\u003c");
// Remplacement par une fonction : sinon des "$&" ou "$1" présents dans le code cité
// seraient interprétés comme des motifs spéciaux par replace().
const page = template.replace(MARQUEUR, () => json);

const cheminPage = path.join(dossierVisite, "visite.html");
fs.writeFileSync(cheminPage, page, "utf8");
console.log(`Visite valide : ${etapesFinales.length} étapes, ${questions.length} questions.`);
console.log(`Page produite : ${cheminPage}`);
