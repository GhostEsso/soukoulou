<a name="readme-top"></a>

<div align="center">
  <h3><b>Soukoulou</b></h3>
  <p>SaaS de gestion scolaire multi-écoles pour l'Afrique de l'Ouest</p>
</div>

---

# 📗 Table des matières

- [📖 À propos](#about-project)
  - [🛠 Stack technique](#tech-stack)
  - [✨ Fonctionnalités clés](#key-features)
- [💻 Démarrage](#getting-started)
  - [Prérequis](#prerequisites)
  - [Installation](#setup)
  - [Utilisation](#usage)
  - [Tests](#run-tests)
- [👥 Auteur](#authors)
- [🔭 Prochaines fonctionnalités](#future-features)
- [📝 Licence](#license)

---

# 📖 À propos <a name="about-project"></a>

**Soukoulou** permet à chaque école de gérer sa scolarité en ligne : élèves, enseignants, présences, emploi du temps, notes, bulletins et communication avec les familles. Chaque école a son espace isolé (multi-tenant), et les enseignants, parents et élèves ont chacun leur propre espace.

## 🛠 Stack technique <a name="tech-stack"></a>

<details>
  <summary>API</summary>
  <ul>
    <li><a href="https://nestjs.com/">NestJS 11</a> — API REST en TypeScript</li>
    <li><a href="https://www.prisma.io/">Prisma 6</a> + <a href="https://www.postgresql.org/">PostgreSQL 16</a></li>
    <li>Authentification JWT maison (jetons d'accès + rotation des refresh tokens), mots de passe argon2</li>
    <li>Stockage S3 (<a href="https://min.io/">MinIO</a> en local) pour les photos</li>
  </ul>
</details>

<details>
  <summary>Web</summary>
  <ul>
    <li><a href="https://nextjs.org/">Next.js 16</a> + React 19 (App Router, Server Actions)</li>
    <li><a href="https://tailwindcss.com/">Tailwind CSS 4</a> + <a href="https://ui.shadcn.com/">shadcn/ui</a></li>
    <li>PWA (Serwist) — installable et utilisable hors ligne</li>
  </ul>
</details>

<details>
  <summary>Outils</summary>
  <ul>
    <li>Monorepo pnpm</li>
    <li>Docker Compose — PostgreSQL et MinIO</li>
    <li>Jest + Supertest — tests e2e de l'API</li>
  </ul>
</details>

### ✨ Fonctionnalités clés <a name="key-features"></a>

- **Inscription des écoles** — mode découverte avec données de démo, abonnement, dépôt des pièces justificatives et validation par l'équipe Soukoulou
- **Rôles et espaces** — admin d'école, enseignant, parent et élève ; chacun ne voit que ses propres données
- **Scolarité** — années et périodes, niveaux, matières avec coefficients, classes, élèves et enseignants
- **Présences et emploi du temps** — appel quotidien, grille horaire avec détection des conflits classe/enseignant
- **Notes et bulletins** — moyennes coefficientées, rangs, avis du conseil, bulletins A4 imprimables
- **Vie scolaire** — annonces ciblées par rôle, discipline (mérites, punitions, blâmes)
- **Console d'administration** — vérification des écoles, paiements, offres, calendriers scolaires par pays

<p align="right">(<a href="#readme-top">retour en haut</a>)</p>

---

## 💻 Démarrage <a name="getting-started"></a>

### Prérequis <a name="prerequisites"></a>

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- **Docker** (PostgreSQL et MinIO)

### Installation <a name="setup"></a>

```sh
git clone https://github.com/GhostEsso/soukoulou.git
cd soukoulou
pnpm install
docker compose up -d
```

Créez `apps/api/.env` :

```env
DATABASE_URL=postgresql://soukoulou:soukoulou@localhost:5433/soukoulou
JWT_SECRET=une-longue-chaine-aleatoire
PAYMENT_WEBHOOK_SECRET=une-autre-chaine-aleatoire
WEB_URL=http://localhost:3000
UPLOAD_DIR=./uploads

# Stockage des photos (MinIO local)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=soukoulou
S3_SECRET_KEY=soukoulou-dev-secret
S3_BUCKET=soukoulou

# Seed : compte admin Soukoulou, et école de démo (développement uniquement)
SEED_ADMIN_EMAIL=admin@exemple.com
SEED_ADMIN_PASSWORD=choisissez-un-mot-de-passe
SEED_DEMO_EMAIL=demo@exemple.com
SEED_DEMO_PASSWORD=choisissez-un-mot-de-passe
```

Appliquez les migrations et le seed :

```sh
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

Le seed de démo crée une école Premium vérifiée avec 569 élèves, 28 enseignants, des notes et des présences.

### Utilisation <a name="usage"></a>

```sh
# API — http://localhost:4000
pnpm dev:api

# Web — http://localhost:3000
pnpm --filter web dev
```

Les emails (confirmation, mot de passe oublié) ne sont pas envoyés en développement : ils s'affichent dans la console de l'API.

### Tests <a name="run-tests"></a>

Les tests e2e utilisent une base dédiée `soukoulou_test` (créez-la une fois dans le conteneur PostgreSQL) :

```sh
docker compose exec db createdb -U soukoulou soukoulou_test
pnpm test:api
```

<p align="right">(<a href="#readme-top">retour en haut</a>)</p>

---

## 👥 Auteur <a name="authors"></a>

👤 **Essohanam TAMBANA**

- GitHub : [@GhostEsso](https://github.com/GhostEsso)
- LinkedIn : [Essohanam TAMBANA](https://www.linkedin.com/in/essohanam-tambana)

<p align="right">(<a href="#readme-top">retour en haut</a>)</p>

---

## 🔭 Prochaines fonctionnalités <a name="future-features"></a>

- [ ] **Frais de scolarité** — frais par classe, encaissements par Mobile Money et reçus
- [ ] **Examens** — sessions d'examens distinctes des évaluations
- [ ] **Invitations** — rattacher un compte existant à une école seulement après accord de la personne
- [ ] **Emails réels** — branchement d'un fournisseur (SMTP, SendGrid…)

<p align="right">(<a href="#readme-top">retour en haut</a>)</p>

---

## 📝 Licence <a name="license"></a>

Tous droits réservés — © Essohanam TAMBANA.

<p align="right">(<a href="#readme-top">retour en haut</a>)</p>
