// Tests d'assembler.mjs avec le module de test intégré à Node (aucune dépendance).
// Lancer depuis la racine du dépôt : node --test tests/assembler.test.mjs
//
// Chaque test fabrique un petit projet dans un dossier temporaire, écrit un visite.json,
// lance le vrai script comme le ferait Claude, puis vérifie le code de sortie et la page produite.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(DEPOT, "assembler.mjs");

// Un projet temporaire : projet/src/a.js, et un dossier "dehors" à côté (hors du projet).
function preparer() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "visite-test-"));
  const projet = path.join(base, "projet");
  const dehors = path.join(base, "dehors");
  fs.mkdirSync(path.join(projet, "src"), { recursive: true });
  fs.mkdirSync(dehors);
  fs.writeFileSync(path.join(projet, "src", "a.js"), "function a() {\n  return 1;\n}\n");
  fs.writeFileSync(path.join(dehors, "secret.txt"), "MOT_DE_PASSE=hunter2\n");
  return { base, projet, dehors };
}

const etape = (extra = {}) => ({
  id: "e1", titre: "Titre", fichier: "src/a.js", lignes: { debut: 1, fin: 2 },
  repere: "function a", explication: "Explication.", ...extra,
});
const questions = (n = 4) => Array.from({ length: n }, (_, i) => ({
  question: "Question " + i, choix: ["oui", "non"], bonneReponse: 0, explication: "Parce que.", etape: "e1",
}));
const visite = (extra = {}) => ({
  titre: "Titre", resume: "Résumé.", questionOuverte: "Explique.", etapes: [etape()], questions: questions(), ...extra,
});

// Écrit visite.json (texte brut ou objet) et lance le script. Renvoie { code, sortie, page }.
function lancer(env, contenu, racine = env.projet) {
  const dossier = fs.mkdtempSync(path.join(env.base, "visite-"));
  if (contenu !== undefined) {
    fs.writeFileSync(path.join(dossier, "visite.json"), typeof contenu === "string" ? contenu : JSON.stringify(contenu));
  }
  const r = spawnSync(process.execPath, [SCRIPT, dossier, racine], { encoding: "utf8" });
  const cheminPage = path.join(dossier, "visite.html");
  return { code: r.status, sortie: r.stdout + r.stderr, page: fs.existsSync(cheminPage) ? fs.readFileSync(cheminPage, "utf8") : null };
}

// Le bloc de données tel qu'il est écrit dans la page.
function blocDonnees(page) {
  const ouverture = '<script id="donnees" type="application/json">';
  const debut = page.indexOf(ouverture) + ouverture.length;
  return page.slice(debut, page.indexOf("</script>", debut));
}

// ---------- Cas normal ----------

test("une visite valide produit la page (code 0)", () => {
  const env = preparer();
  const r = lancer(env, visite());
  assert.equal(r.code, 0, r.sortie);
  assert.ok(r.page.includes("function a()"));
});

test("la visite d'exemple du dépôt est valide", () => {
  const env = preparer();
  const r = lancer(env, fs.readFileSync(path.join(DEPOT, "exemple-visite.json"), "utf8"), path.join(DEPOT, "exemple"));
  assert.equal(r.code, 0, r.sortie);
});

// ---------- Fichiers hors du projet ----------

test("un chemin avec ../ est refusé", () => {
  const env = preparer();
  const r = lancer(env, visite({ etapes: [etape({ fichier: "../dehors/secret.txt", repere: "MOT" })] }));
  assert.equal(r.code, 1);
  assert.match(r.sortie, /sort du projet/);
  assert.equal(r.page, null);
});

test("un chemin absolu hors du projet est refusé", () => {
  const env = preparer();
  const r = lancer(env, visite({ etapes: [etape({ fichier: path.join(env.dehors, "secret.txt"), repere: "MOT" })] }));
  assert.equal(r.code, 1);
  assert.match(r.sortie, /sort du projet/);
});

test("un lien placé dans le projet vers un dossier extérieur est refusé", () => {
  const env = preparer();
  // "junction" : lien de dossier Windows, sans droits administrateur. Ignoré ailleurs (lien symbolique normal).
  fs.symlinkSync(env.dehors, path.join(env.projet, "lien"), "junction");
  const r = lancer(env, visite({ etapes: [etape({ fichier: "lien/secret.txt", repere: "MOT" })] }));
  assert.equal(r.code, 1, r.sortie);
  assert.match(r.sortie, /sort du projet par un lien/);
  assert.equal(r.page, null);
});

test("un fichier dont le nom commence par .. reste dans le projet", () => {
  const env = preparer();
  fs.writeFileSync(path.join(env.projet, "..config.js"), "const x = 1;\n");
  const r = lancer(env, visite({ etapes: [etape({ fichier: "..config.js", lignes: { debut: 1, fin: 1 }, repere: "const x" })] }));
  assert.equal(r.code, 0, r.sortie);
});

// ---------- HTML, JavaScript et </script> ----------

test("du HTML et des </script> dans le code et les textes ne cassent pas le bloc de données", () => {
  const env = preparer();
  const piege = "<script>alert(1)</script>\n<img src=x onerror=alert(2)>\n</script><!--\n";
  fs.writeFileSync(path.join(env.projet, "src", "piege.html"), piege);
  const titre = "<b>gras</b></script><script>alert(3)</script>";
  const r = lancer(env, visite({
    titre,
    etapes: [etape({ fichier: "src/piege.html", lignes: { debut: 1, fin: 3 }, repere: "</script>", explication: "<img src=x onerror=alert(4)>" })],
  }));
  assert.equal(r.code, 0, r.sortie);
  const bloc = blocDonnees(r.page);
  assert.ok(!bloc.includes("<"), "aucun < brut ne doit rester dans le bloc de données");
  const donnees = JSON.parse(bloc); // ce que fait la page
  assert.equal(donnees.titre, titre, "le texte est conservé tel quel, pour être affiché");
  assert.deepEqual(donnees.etapes[0].extrait.lignes, piege.trimEnd().split("\n"));
});

test("des motifs $& et $1 dans le code sont recopiés tels quels", () => {
  const env = preparer();
  fs.writeFileSync(path.join(env.projet, "src", "dollar.js"), "s.replace(/a/, \"$& et $1\");\n");
  const r = lancer(env, visite({ etapes: [etape({ fichier: "src/dollar.js", lignes: { debut: 1, fin: 1 }, repere: "replace" })] }));
  assert.equal(r.code, 0, r.sortie);
  assert.equal(JSON.parse(blocDonnees(r.page)).etapes[0].extrait.lignes[0], "s.replace(/a/, \"$& et $1\");");
});

test("le template n'insère jamais de données avec innerHTML", () => {
  const template = fs.readFileSync(path.join(DEPOT, "template.html"), "utf8");
  // Seul usage autorisé : les icônes SVG fixes (variable "chemin", alimentée par des constantes du template).
  const usages = template.match(/\.innerHTML\s*=\s*[^;]+;/g) || [];
  assert.deepEqual(usages, [".innerHTML = chemin;"]);
  assert.ok(!/insertAdjacentHTML|outerHTML|document\.write|eval\(|new Function/.test(template));
});

// ---------- JSON invalide, vide, types incorrects ----------

test("visite.json absent : code 2 (problème d'utilisation)", () => {
  const r = lancer(preparer(), undefined);
  assert.equal(r.code, 2);
});

for (const [nom, contenu, message] of [
  ["vide", "", /est vide/],
  ["seulement des espaces", "  \n ", /est vide/],
  ["JSON mal formé", "{ titre: 'x' ", /pas un JSON valide/],
  ["null", "null", /doit contenir un objet/],
  ["tableau", "[]", /doit contenir un objet/],
  ["nombre", "42", /doit contenir un objet/],
]) {
  test(`visite.json ${nom} : code 1 avec un message clair`, () => {
    const r = lancer(preparer(), contenu);
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, message);
    assert.doesNotMatch(r.sortie, /TypeError|    at /, "pas de trace technique");
  });
}

test("types incorrects : toutes les erreurs sont listées, sans plantage", () => {
  const r = lancer(preparer(), { titre: 3, resume: ["x"], questionOuverte: {}, etapes: "pas une liste", questions: 7 });
  assert.equal(r.code, 1);
  for (const attendu of [/« titre »/, /« resume »/, /« questionOuverte »/, /« etapes » doit être une liste/, /« questions » doit être une liste/]) {
    assert.match(r.sortie, attendu);
  }
});

test("étape null, lignes en texte, décimales ou négatives : refusées", () => {
  const env = preparer();
  for (const lignes of [{ debut: "1", fin: "2" }, { debut: 1.5, fin: 2 }, { debut: -1, fin: 2 }, { debut: 2, fin: 1 }, { debut: 1, fin: 999 }]) {
    const r = lancer(env, visite({ etapes: [etape({ lignes })] }));
    assert.equal(r.code, 1, JSON.stringify(lignes) + " devrait être refusé");
  }
  const r = lancer(env, visite({ etapes: [null, etape()] }));
  assert.equal(r.code, 1);
  assert.match(r.sortie, /Étape 1 : « id » manquant/);
});

test("repère absent de la plage : étape refusée", () => {
  const r = lancer(preparer(), visite({ etapes: [etape({ repere: "introuvable" })] }));
  assert.equal(r.code, 1);
  assert.match(r.sortie, /repère « introuvable » introuvable/);
});

test("questions : étape inconnue et bonneReponse hors limites refusées", () => {
  const qs = questions();
  qs[0].etape = "inconnue";
  qs[1].bonneReponse = 2;
  const r = lancer(preparer(), visite({ questions: qs }));
  assert.equal(r.code, 1);
  assert.match(r.sortie, /ne correspond à aucun id/);
  assert.match(r.sortie, /« bonneReponse » doit être un entier entre 0 et 1/);
});
