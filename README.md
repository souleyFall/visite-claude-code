# /visite : une visite guidée de ton code

[![Tests](https://github.com/souleyFall/visite-claude-code/actions/workflows/tests.yml/badge.svg)](https://github.com/souleyFall/visite-claude-code/actions/workflows/tests.yml)

**/visite** is a [Claude Code](https://code.claude.com) skill that turns any feature of your codebase into a guided, step-by-step tour: verified code excerpts in execution order, beginner-friendly explanations, and a quiz to check you understood.
*The documentation below is in French.*

![Démonstration : une visite de la commande d'une pizza, étape par étape, puis le questionnaire](docs/demo.gif)

`/visite` est une **skill pour [Claude Code](https://code.claude.com)**. Tu lui donnes le nom d'une fonctionnalité de ton projet, et elle en fabrique une visite guidée : une page web qui suit le code **dans l'ordre où il s'exécute**, étape par étape, puis vérifie avec un questionnaire que tu sais l'expliquer.

## Le problème de départ

Avec un assistant de code IA, on obtient vite du code qui fonctionne. On le comprend beaucoup moins vite. Lire les fichiers un par un ne montre pas comment ils s'enchaînent, et relire une longue conversation avec l'assistant non plus.

Je voulais pouvoir répondre, avant de pousser du code : « qu'est-ce qui se passe exactement quand l'utilisateur clique sur ce bouton ? ». J'ai donc construit un outil qui me fait parcourir le chemin réel du code, avec des extraits vérifiés, puis m'interroge dessus.

## Ce que fait la skill

Tu tapes `/visite commande d'une pizza`. Claude :

1. **reconstitue le chemin d'exécution** de la fonctionnalité en lisant le vrai code, de fichier en fichier et de service en service ;
2. **écrit un fichier de données** (`visite.json`) : pour chaque étape, le fichier, la plage de lignes, une explication de 2-3 phrases accessible à un débutant, des valeurs d'exemple et la transition vers l'étape suivante, plus 4 ou 5 questions ;
3. **lance un script** qui vérifie ces données et les assemble avec un template fixe en une page HTML autonome ;
4. **ouvre la page** à côté du chat.

La page montre :
- chaque étape avec son extrait de code coloré et les lignes concernées surlignées ;
- le service traversé (`client`, `api`, `cuisine`…) et le passage de l'un à l'autre ;
- un exemple de valeurs qui reste le même du début à la fin de la visite ;
- un questionnaire corrigé automatiquement, qui renvoie vers les étapes à revoir ;
- une question ouverte à laquelle tu réponds dans le chat, et que Claude corrige.

Tu peux poser tes questions dans le chat pendant la visite : Claude relit le fichier concerné et répond en citant l'étape.

## Installation

Il faut [Claude Code](https://code.claude.com) et Node.js 18 ou plus récent. Le script n'a aucune dépendance.

Clone le dépôt dans le dossier des skills personnelles de Claude Code :

```bash
git clone https://github.com/souleyFall/visite-claude-code.git ~/.claude/skills/visite
```

Sous Windows, `~` correspond à `C:\Users\<ton-nom>`.

## Utilisation

Dans une session Claude Code ouverte sur ton projet :

```
/visite <fonctionnalité>
```

Par exemple `/visite connexion d'un utilisateur` ou `/visite création d'un commentaire`.

La skill ne se lance que lorsque tu tapes la commande : Claude ne la déclenche jamais de lui-même. Les visites sont rangées dans `.claude/visites/<date>-<nom>/` de ton projet. Pense à ajouter `.claude/visites/` à ton `.gitignore`, la skill te le propose sinon.

## Fonctionnement en bref

```
Claude lit le code ──► visite.json ──► assembler.mjs ──► visite.html
                       (les données)   (vérifie, puis    (template fixe
                                        assemble)         + données)
```

- **`SKILL.md`** : la consigne que suit Claude (comment tracer le chemin, règles d'écriture, format des données, façon de corriger).
- **`visite.json`** : le seul fichier que Claude écrit. Il ne génère jamais de HTML.
- **`assembler.mjs`** : un script Node sans dépendance qui **refuse la visite** si quelque chose ne colle pas avec le code réel. Il vérifie que chaque fichier existe, que chaque plage de lignes est valide, et qu'un court repère textuel (un nom de fonction, un début de ligne) se trouve bien dans la plage citée. C'est ce qui garantit que l'extrait affiché est celui dont parle l'explication. Il vérifie aussi les questions. Les extraits sont recopiés depuis le disque, jamais depuis ce qu'a écrit Claude.
- **`template.html`** : la page, fixe. Elle a un thème sombre et un thème clair, une coloration syntaxique maison, des animations courtes (coupées si le système demande moins d'animations), la navigation au clavier, et elle s'adapte au mobile.
- **`exemple-visite.json`** et **`exemple/`** : une visite complète sur un mini-projet fictif (une pizzeria en trois services). Elle sert de modèle à Claude, et c'est elle qui apparaît dans la démonstration.

## Limites actuelles

- **Rien n'est exécuté.** Les valeurs d'exemple sont déduites de la lecture du code, pas observées pendant une vraie exécution. La page l'indique clairement. Elles peuvent donc être fausses si le code a un comportement surprenant.
- **Coloration syntaxique partielle.** Elle est complète seulement pour JavaScript, TypeScript et JSON. Pour YAML, Python, shell ou Dockerfile, seuls les chaînes, les nombres et les commentaires sont colorés, et les autres langages restent en texte simple. Un commentaire ou une chaîne sur plusieurs lignes n'est coloré que sur sa première ligne.
- **Panneau navigateur de l'application Claude.** Il n'exécute le JavaScript d'un fichier local que si ce fichier se trouve dans le dossier de la session. Ailleurs, la skill ouvre la page dans le navigateur par défaut. Dans ce panneau, le choix de thème n'est pas retenu d'une ouverture à l'autre, et la page repart en sombre.
- **Qualité variable selon le projet.** La justesse du chemin et des explications dépend de ce que Claude comprend du code. Le script vérifie que les extraits existent, pas que l'explication est juste.

## Comment il a été fait

J'ai conçu et construit cet outil **avec Claude Code**, étape par étape. J'ai fixé les choix de départ : pas de serveur ni de clé API, un template fixe, des extraits vérifiés, pas d'exécution réelle. J'ai validé chaque étape avant la suivante : le format des données, puis le script, puis le template, puis la consigne. Le design de la page est passé par une maquette avant d'être intégré.

## Licence

[MIT](LICENSE)
