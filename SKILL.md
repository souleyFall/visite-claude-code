---
description: Visite guidée d'une fonctionnalité du projet. Reconstitue son chemin d'exécution, fabrique une page web pas à pas (extraits de code, explications pour débutant, valeurs d'exemple, questionnaire) et l'ouvre dans le panneau navigateur.
argument-hint: <fonctionnalité à visiter>
disable-model-invocation: true
---

# /visite

L'utilisateur découvre ce code et veut le comprendre. Il veut comprendre une fonctionnalité de son projet en suivant le code dans l'ordre où il s'exécute, puis vérifier qu'il sait l'expliquer.

Fonctionnalité demandée : **$ARGUMENTS**

Si rien n'est indiqué, demande quelle fonctionnalité visiter et arrête-toi là.

Tu n'écris **que les données** (`visite.json`). La page vient d'un template fixe et c'est un script qui l'assemble. Ne modifie jamais `template.html` ni `assembler.mjs`.

Fichiers de la skill, dans `${CLAUDE_SKILL_DIR}` :
- `exemple-visite.json` : une visite complète et valide. **Lis-la avant d'écrire**, c'est le modèle de format et de ton.
- `assembler.mjs` : il vérifie la visite et produit la page.
- `template.html` : la page, à ne pas toucher.

## 1. Reconstituer le chemin d'exécution

- Pars du déclencheur réel : le clic, le formulaire, la route HTTP, la commande ou le message reçu.
- Suis les appels de fichier en fichier, et de service en service s'il y en a plusieurs : requêtes HTTP, routage (ingress, proxy), événements, files de messages.
- **Lis le vrai code** avec Read, qui donne les numéros de ligne. Ne devine aucun nom de fonction ni aucun numéro de ligne.
- Ne garde que les étapes qui s'exécutent vraiment pour ce scénario. Laisse de côté les branches d'erreur et le code voisin qui n'est pas appelé.
- Vise entre 5 et 12 étapes, dans l'ordre d'exécution. Une étape correspond à une action compréhensible, pas à une ligne de code.
- Si la demande est ambiguë, par exemple plusieurs chemins possibles, choisis le chemin principal et dis-le dans le `resume`.
- Si la fonctionnalité a été écrite ou modifiée pendant la session en cours, appuie-toi sur ce qui a été demandé et décidé dans la conversation pour expliquer le **pourquoi** de chaque étape (« on vérifie ici que… parce que tu as demandé… »). Le code reste la référence pour le **quoi** et pour les lignes.

## 2. Choisir un seul scénario d'exemple

Invente un seul scénario aux valeurs plausibles et suis-le de bout en bout. Une valeur ne change que là où le code la modifie réellement : par exemple, `statut` passe de `"recue"` à `"prete"` à l'étape où le code le change. Partout ailleurs, elle reste identique. Si l'étape 3 crée l'id `"7f3a9c21"`, toutes les étapes suivantes utilisent `"7f3a9c21"`.

Ces valeurs sont **déduites de la lecture du code**, pas d'une exécution : n'exécute rien pour les obtenir. La page affiche déjà cet avertissement, et rien dans tes textes ne doit laisser croire le contraire.

## 3. Écrire `visite.json`

Dossier : `.claude/visites/<AAAA-MM-JJ>-<slug>/` à la racine du projet, c'est-à-dire le répertoire de travail. Pour le slug, prends le nom de la fonctionnalité en minuscules, sans accents, avec des tirets (par exemple `2026-11-11-commande-pizza`). Si le dossier existe déjà, ajoute `-2`, `-3`…

Format (voir `exemple-visite.json`) :

```
{
  "titre": "…", "resume": "2-3 phrases : ce que fait la fonctionnalité et le chemin suivi",
  "etapes": [ {
      "id": "kebab-case-unique",
      "titre": "phrase courte : ce qui se passe",
      "fichier": "chemin/relatif/à/la/racine.js",
      "lignes": { "debut": 17, "fin": 25 },
      "repere": "texte copié tel quel d'une ligne de la plage",
      "explication": "2-3 phrases",
      "exemple": [ { "nom": "…", "valeur": "…" } ],    // facultatif
      "transition": "comment on passe à l'étape suivante" // facultatif, interdit sur la dernière
  } ],
  "questions": [ {
      "question": "…", "choix": ["…", "…", "…"], "bonneReponse": 1,
      "explication": "pourquoi c'est la bonne réponse", "etape": "id-de-l-etape"
  } ],
  "questionOuverte": "…"
}
```

Règles à respecter :
- **Langue et niveau** : tout est en français, pour un débutant. Explique chaque terme technique la première fois qu'il apparaît (« un middleware, c'est… »). Pas de jargon gratuit.
- **`lignes`** : une plage serrée, de 20 lignes au plus, centrée sur ce que dit l'explication. Le script ajoute de lui-même 3 lignes de contexte autour.
- **`repere`** : un morceau de texte **copié exactement** d'une ligne de la plage, comme un nom de fonction ou un début d'instruction. Le script refuse l'étape s'il ne le trouve pas. C'est la garantie que l'extrait affiché est bien celui dont parle l'explication.
- **`explication`** : 2 à 3 phrases. Elles disent ce que fait ce code et pourquoi il est là, pas une paraphrase ligne à ligne.
- **`exemple`** : les valeurs du scénario à cet endroit précis, comme le corps de la requête, l'objet créé ou l'événement envoyé.
- **`transition`** : à mettre dès qu'on change de fichier de façon non évidente, et toujours quand on change de service. Elle dit comment on passe à la suite (« La commande part vers le service cuisine, sur le port 4000 »).
- **Questions** : 4 ou 5, chacune rattachée à l'étape qui contient la réponse.
  - Elles testent la compréhension du parcours (qui appelle qui, dans quel ordre, avec quelle donnée, pourquoi), pas des détails à apprendre par cœur.
  - 3 ou 4 choix plausibles par question.
  - Varie la position de la bonne réponse ; `bonneReponse` compte à partir de 0.
- **`questionOuverte`** : demander d'expliquer la fonctionnalité de bout en bout, avec ses mots, sans regarder le code, en citant les étapes ou les services dans l'ordre.

## 4. Assembler et vérifier

```
node "${CLAUDE_SKILL_DIR}/assembler.mjs" ".claude/visites/<dossier>" "."
```

Lance la commande depuis la racine du projet.
- **Code 0** : la page `visite.html` est produite dans le même dossier.
- **Code 1** : la visite est refusée et toutes les erreurs sont listées. Relis les fichiers concernés, corrige `visite.json` et relance. Après 3 essais sans succès, arrête-toi et montre les erreurs à l'utilisateur.
- **Code 2** : problème d'utilisation, par exemple un chemin ou le template. Signale-le.

## 5. Ouvrir la page

Ouvre-la dans le panneau navigateur de l'app desktop avec `preview_start`, en passant l'URL `file:///` du chemin absolu avec des `/`, par exemple `file:///C:/Users/…/.claude/visites/<dossier>/visite.html`.

Le panneau n'exécute le JavaScript d'un fichier local que s'il se trouve dans le dossier du projet : c'est pour ça que les visites vivent sous `.claude/visites/`.

Lis la réponse de `preview_start`. Si elle indique que le fichier sera affiché en aperçu figé (« static snapshot »), la page ne marchera pas dans le panneau : elle a besoin de JavaScript pour s'afficher. Ça arrive quand le dossier de la session n'est pas exactement la racine du projet.

Dans ce cas, ou si le panneau n'est pas disponible, ouvre le fichier dans le navigateur par défaut (`Start-Process "<chemin>"` sous Windows). Dis à l'utilisateur pourquoi la page s'ouvre là, et donne-lui le chemin.

Vérifie aussi que `.claude/visites/` figure dans le `.gitignore` du projet. Si ce n'est pas le cas, propose de l'ajouter, sans le faire d'office.

## 6. Message dans le chat

Court :
- la page est ouverte ;
- le nombre d'étapes et les services traversés ;
- le chemin du dossier ;
- un rappel : à la fin, répondre ici à la question ouverte pour être corrigé.

N'y recopie pas le contenu des étapes.

## 7. Répondre aux questions pendant la visite

L'utilisateur peut poser des questions dans le chat pendant qu'il parcourt la page. Pour y répondre :
- Appuie-toi sur `visite.json` pour savoir de quelle étape il parle et quel scénario d'exemple il a sous les yeux.
- **Relis le vrai fichier** concerné avant de répondre : ne réponds pas de mémoire, le code a pu changer.
- Reste au niveau débutant : des phrases courtes, chaque terme technique expliqué, les valeurs du scénario pour illustrer.
- Cite l'étape concernée (« Étape 4 : api/serveur.js, lignes 18-22 ») pour qu'il la retrouve dans la page.
- Si la question sort du parcours de la visite, dis-le, réponds brièvement et précise où se trouve ce code.

## 8. Corriger la question ouverte

Quand l'utilisateur répond à la question ouverte, corrige sa réponse en t'appuyant sur `visite.json` :
- ce qui est juste ;
- ce qui manque, avec le numéro de l'étape concernée ;
- ce qui est faux, et pourquoi.

Reste bienveillant et précis. Termine en indiquant les étapes à revoir dans la page, s'il y en a.
