<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Métabolyse — Suivi nutrition &amp; métabolisme</title>
<meta name="description" content="Suivi intelligent de la nutrition, du déficit calorique et de l'adaptation métabolique." />
<meta name="theme-color" content="#0E1310" />
<link rel="manifest" href="manifest.json" />
<link rel="icon" href="icon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="style.css" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js" onerror="this.onerror=null;document.write('<script src=\'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js\'>\x3c/script>')"></script>
</head>
<body>

<!-- ===================== PASSWORD SCREEN ===================== -->
<div id="screen-password" class="screen">
  <div class="auth-card">
    <div class="brand centered">
      <img class="brand-mark" src="icon.svg" alt="Métabolyse" width="34" height="34" />
      <span class="brand-name">Métabolyse</span>
    </div>
    <p class="auth-sub">Accès protégé</p>
    <div class="auth-form">
      <label>Mot de passe
        <input type="password" id="pw-input" placeholder="••••••••" autocomplete="current-password" />
      </label>
      <div id="pw-error" class="pw-error hidden">Mot de passe incorrect</div>
      <button class="btn primary full" id="pw-submit">Entrer</button>
    </div>
  </div>
</div>

<!-- ===================== LOADING / RETRY ===================== -->
<div id="screen-loading" class="screen hidden">
  <div class="auth-card">
    <div class="brand centered">
      <img class="brand-mark" src="icon.svg" alt="Métabolyse" width="34" height="34" />
      <span class="brand-name">Métabolyse</span>
    </div>
    <p class="auth-sub" id="loading-status">Récupération de vos données…</p>
    <button class="btn primary full hidden" id="loading-retry">Réessayer</button>
  </div>
</div>

<!-- ===================== ONBOARDING ===================== -->
<div id="onboarding" class="screen hidden">
  <div class="onboard-card">
    <div class="brand">
      <img class="brand-mark" src="icon.svg" alt="Métabolyse" width="34" height="34" />
      <span class="brand-name">Métabolyse</span>
    </div>
    <p class="onboard-sub">Trois minutes de réglages, puis 30 secondes par jour.</p>

    <form id="profile-form" class="onboard-form">
      <!-- STEP 1 -->
      <div class="step active" data-step="1">
        <h2>Toi, en quelques chiffres</h2>
        <div class="field-grid">
          <label>Sexe
            <select name="sex" required>
              <option value="female">Femme</option>
              <option value="male">Homme</option>
            </select>
          </label>
          <label>Date de naissance
            <input type="date" name="birthdate" required />
          </label>
          <label>Taille (cm)
            <input type="number" name="height" min="100" max="250" required />
          </label>
          <label>Poids actuel (kg)
            <input type="number" step="0.1" name="weight" min="30" max="300" required />
          </label>
        </div>
      </div>

      <!-- STEP 2 -->
      <div class="step" data-step="2">
        <h2>Métabolisme de base</h2>
        <p class="hint">Entre ton BMR de départ (mesuré ou estimé). L'app l'ajustera automatiquement selon ton évolution.</p>
        <div class="field-grid">
          <label>BMR de base (kcal/jour)
            <input type="number" name="baseBMR" min="800" max="4000" placeholder="Ex: 1800" required />
          </label>
          <label>Date de début du suivi
            <input type="date" name="startDate" required />
          </label>
          <label>Poids de départ (kg)
            <input type="number" step="0.1" name="startWeight" min="30" max="300" placeholder="Poids au début du suivi" />
          </label>
          <label>Masse grasse de départ (%)
            <input type="number" step="0.1" name="startBodyfat" placeholder="Optionnel" />
          </label>
        </div>
      </div>

      <!-- STEP 3 -->
      <div class="step" data-step="3">
        <h2>Composition corporelle actuelle</h2>
        <p class="hint">Ces valeurs serviront de point de référence. Tu pourras les mettre à jour chaque jour.</p>
        <div class="field-grid">
          <label>Masse grasse actuelle (%)
            <input type="number" step="0.1" name="bodyfat" placeholder="Ex: 25" />
          </label>
          <label>Masse musculaire actuelle (%)
            <input type="number" step="0.1" name="muscle" placeholder="Ex: 40" />
          </label>
          <label>Objectif de poids (kg)
            <input type="number" step="0.1" name="targetWeight" placeholder="Ex: 75" />
          </label>
          <label>Objectif masse grasse (%)
            <input type="number" step="0.1" name="targetBodyfat" placeholder="Ex: 15" />
          </label>
        </div>
      </div>

      <!-- STEP 4: Cloud sync -->
      <div class="step" data-step="4">
        <h2>Synchronisation des données</h2>
        <p class="hint">Pour accéder à tes données depuis n'importe quel appareil, l'app utilise JSONBin.io (gratuit). Crée un compte sur <strong>jsonbin.io</strong>, puis crée un "Bin" et colle ta clé API et l'ID du Bin ici.</p>
        <p class="hint" style="background:var(--surface-2,rgba(255,255,255,0.05));padding:10px;border-radius:8px;margin-bottom:8px;">
          💡 <strong>Déjà configuré sur un autre appareil ?</strong> Entre simplement tes identifiants JSONBin ci-dessous — ton profil et toutes tes données seront récupérés automatiquement sans avoir à tout ressaisir.
        </p>
        <div class="field-grid-1">
          <label>Clé API JSONBin (X-Master-Key)
            <input type="text" name="jsonbinKey" placeholder="$2a$10$..." />
          </label>
          <label>Bin ID
            <input type="text" name="jsonbinId" placeholder="6...abc" />
          </label>
        </div>
        <p class="hint" style="margin-top:10px;">Tu peux aussi continuer sans synchronisation (données locales uniquement).</p>
      </div>

      <div class="onboard-nav">
        <button type="button" id="ob-back" class="btn ghost hidden">Retour</button>
        <div class="step-dots">
          <span class="dot active"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
        <button type="button" id="ob-next" class="btn primary">Continuer</button>
        <button type="submit" id="ob-submit" class="btn primary hidden">Créer mon profil</button>
      </div>
    </form>
  </div>
</div>

<!-- ===================== APP SHELL ===================== -->
<div id="app" class="screen hidden">
  <header class="topbar">
    <div class="brand"><img class="brand-mark" src="icon.svg" alt="Métabolyse" width="34" height="34" /><span class="brand-name">Métabolyse</span></div>
    <nav class="tabs" id="tabs">
      <button data-view="dashboard" class="tab active">Aujourd'hui</button>
      <button data-view="trends" class="tab">Tendances</button>
      <button data-view="history" class="tab">Historique</button>
      <button data-view="since-start" class="tab">Depuis le début</button>
      <button data-view="goals" class="tab">Objectifs</button>
      <button data-view="journal" class="tab">Journal</button>
    </nav>
    <div class="top-actions">
      <button id="sync-settings-btn" class="icon-btn" title="Réglages de synchronisation">⚙️</button>
      <button id="sync-btn" class="icon-btn sync-btn" title="Synchroniser">↻</button>
      <button id="theme-toggle" class="icon-btn" title="Changer de thème">🌙</button>
      <button id="export-btn" class="icon-btn" title="Exporter le rapport">⤓</button>
    </div>
  </header>

  <main id="views">

    <!-- ===== DASHBOARD ===== -->
    <section id="view-dashboard" class="view active">
      <div class="welcome-banner" id="welcome-banner">
        <div class="welcome-text">
          <div class="welcome-greeting" id="welcome-greeting">Bonjour, Mathéo 👋</div>
          <div class="welcome-sub" id="welcome-sub">Voici où en est ton suivi aujourd'hui.</div>
        </div>
      </div>

      <div class="quick-log-bar">
        <button class="btn primary" id="open-log">+ Saisie du jour</button>
        <div class="insight-pill" id="top-insight">Bienvenue ! Ajoute ta première saisie pour démarrer l'analyse.</div>
      </div>

      <div class="grid-cards">
        <!-- Calories -->
        <div class="card cal-card">
          <div class="card-head"><span>Calories aujourd'hui</span></div>
          <div class="big-row">
            <div class="big-num" id="cal-consumed">0</div>
            <div class="big-sub">/ <span id="cal-target">—</span> kcal</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" id="cal-progress"></div></div>
          <div class="card-foot">
            <span id="cal-remaining">—</span> restantes &nbsp;|&nbsp; Sport: <span id="cal-sport-today">0</span> kcal
          </div>
        </div>

        <!-- Déficit -->
        <div class="card">
          <div class="card-head"><span>Déficit calorique</span></div>
          <div class="trio">
            <div><span class="trio-label">Aujourd'hui</span><span class="trio-val" id="deficit-day">—</span></div>
            <div><span class="trio-label">7 jours</span><span class="trio-val" id="deficit-week">—</span></div>
            <div><span class="trio-label">30 jours</span><span class="trio-val" id="deficit-month">—</span></div>
          </div>
          <div class="status-chip" id="deficit-status">En attente de données</div>
        </div>

        <!-- Métabolisme -->
        <div class="card">
          <div class="card-head"><span>Métabolisme</span>
            <button class="btn-mini" id="edit-bmr-btn">Modifier BMR</button>
          </div>
          <div class="trio">
            <div><span class="trio-label">BMR manuel</span><span class="trio-val" id="bmr-manual">—</span></div>
            <div><span class="trio-label">BMR adapté</span><span class="trio-val" id="bmr-adapt">—</span></div>
            <div><span class="trio-label">TDEE total</span><span class="trio-val" id="tdee-total">—</span></div>
          </div>
        </div>

        <!-- Poids -->
        <div class="card">
          <div class="card-head"><span>Poids</span></div>
          <div class="big-row"><div class="big-num" id="weight-current">—</div><div class="big-sub">kg</div></div>
          <div class="trio small">
            <div><span class="trio-label">7 j</span><span class="trio-val" id="weight-week">—</span></div>
            <div><span class="trio-label">30 j</span><span class="trio-val" id="weight-month">—</span></div>
          </div>
        </div>

        <!-- Composition -->
        <div class="card">
          <div class="card-head"><span>Composition corporelle</span></div>
          <div class="comp-grid" id="comp-grid">
            <div><span class="trio-label">Masse grasse</span><span class="trio-val" id="bf-pct">—</span><span class="trio-label" id="bf-kg">—</span></div>
            <div><span class="trio-label">Masse musculaire</span><span class="trio-val" id="mm-pct">—</span><span class="trio-label" id="mm-kg">—</span></div>
            <div><span class="trio-label">Masse maigre</span><span class="trio-val" id="lean-kg">—</span></div>
            <div><span class="trio-label">% perte en graisse</span><span class="trio-val" id="fat-loss-pct">—</span></div>
          </div>
        </div>

        <!-- Scores -->
        <div class="card">
          <div class="card-head"><span>Scores</span></div>
          <div class="trio">
            <div><span class="trio-label">Fat Loss Eff.</span><span class="trio-val" id="score-fle">—</span></div>
            <div><span class="trio-label">Muscle Pres.</span><span class="trio-val" id="score-mps">—</span></div>
          </div>
          <div class="sleep-summary" id="sleep-summary-dash">
            <span class="trio-label">Nuit dernière</span>
            <span id="sleep-dash">—</span>
          </div>
        </div>
      </div>

      <div class="card chart-card wide">
        <div class="card-head"><span>Calories des derniers jours</span></div>
        <div class="chart-wrap"><canvas id="chart-today-calories"></canvas></div>
        <div class="legend" style="margin-top:10px;">
          <span><i class="dot-i deficit-strong" style="background:var(--accent)"></i>Ingéré</span>
          <span><i class="dot-i surplus-strong" style="background:var(--warn)"></i>Dépensé (TDEE)</span>
          <span><i class="dot-i maintenance" style="background:var(--text-dim)"></i>Restant</span>
        </div>
      </div>

      <div class="card insights-card">
        <div class="card-head"><span>Analyse intelligente</span></div>
        <ul id="insights-list" class="insights-list"></ul>
      </div>
    </section>

    <!-- ===== TRENDS ===== -->
    <section id="view-trends" class="view">
      <div class="chart-grid">
        <div class="card chart-card">
          <div class="card-head"><span>Évolution du poids</span></div>
          <div class="chart-wrap"><canvas id="chart-weight"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><span>Masse grasse / Masse musculaire (%)</span></div>
          <div class="chart-wrap"><canvas id="chart-composition"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><span>Composition en kg</span></div>
          <div class="chart-wrap"><canvas id="chart-composition-kg"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><span>Métabolisme : BMR manuel vs adapté</span></div>
          <div class="chart-wrap"><canvas id="chart-metabolism"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><span>Déficit cumulé</span></div>
          <div class="chart-wrap"><canvas id="chart-deficit"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><span>Sommeil</span></div>
          <div class="chart-wrap"><canvas id="chart-sleep"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span>Prédictions</span></div>
        <div class="predict-grid">
          <div><span class="trio-label">Dans 30 jours</span><span class="trio-val" id="pred-30">—</span></div>
          <div><span class="trio-label">Dans 60 jours</span><span class="trio-val" id="pred-60">—</span></div>
          <div><span class="trio-label">Dans 90 jours</span><span class="trio-val" id="pred-90">—</span></div>
          <div><span class="trio-label">Date objectif poids</span><span class="trio-val" id="pred-goal-date">—</span></div>
        </div>
      </div>
    </section>

    <!-- ===== HISTORY ===== -->
    <section id="view-history" class="view">
      <div class="card">
        <div class="card-head">
          <span id="calendar-title">Historique</span>
          <div class="cal-nav">
            <button class="icon-btn" id="cal-prev">‹</button>
            <button class="icon-btn" id="cal-next">›</button>
          </div>
        </div>
        <div class="legend">
          <span><i class="dot-i deficit-strong"></i>Déficit optimal</span>
          <span><i class="dot-i deficit-light"></i>Déficit léger</span>
          <span><i class="dot-i maintenance"></i>Maintenance</span>
          <span><i class="dot-i surplus-light"></i>Surplus léger</span>
          <span><i class="dot-i surplus-strong"></i>Surplus important</span>
        </div>
        <div class="cal-weekdays">
          <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
        </div>
        <div id="calendar-grid" class="calendar-grid"></div>
      </div>
      <div id="day-detail" class="card hidden"></div>
    </section>

    <!-- ===== DEPUIS LE DÉBUT ===== -->
    <section id="view-since-start" class="view">
      <!-- Hero stats -->
      <div class="since-hero">
        <div class="since-stat">
          <div class="since-val" id="ss-weight-lost">—</div>
          <div class="since-label">kg perdus</div>
        </div>
        <div class="since-stat">
          <div class="since-val" id="ss-fat-lost">—</div>
          <div class="since-label">kg de graisse perdus</div>
        </div>
        <div class="since-stat">
          <div class="since-val" id="ss-muscle-delta">—</div>
          <div class="since-label">muscle gagné/perdu</div>
        </div>
        <div class="since-stat">
          <div class="since-val" id="ss-days">—</div>
          <div class="since-label">jours de suivi</div>
        </div>
        <div class="since-stat">
          <div class="since-val" id="ss-success-pct">—</div>
          <div class="since-label">% de réussite estimé</div>
        </div>
      </div>

      <!-- Progress bars -->
      <div class="card">
        <div class="card-head"><span>Progression vers les objectifs</span></div>
        <div id="ss-progress-bars" class="goals-progress"></div>
      </div>

      <!-- Full chart -->
      <div class="card chart-card wide">
        <div class="card-head"><span>Courbe depuis le début — Poids</span></div>
        <div class="chart-wrap"><canvas id="chart-since-weight"></canvas></div>
      </div>

      <!-- Cumulative stats -->
      <div class="grid-cards">
        <div class="card">
          <div class="card-head"><span>Déficit total cumulé</span></div>
          <div class="big-num" id="ss-deficit-total">—</div>
          <div class="big-sub">kcal</div>
        </div>
        <div class="card">
          <div class="card-head"><span>Équivalent graisse théorique</span></div>
          <div class="big-num" id="ss-fat-equiv">—</div>
          <div class="big-sub">kg</div>
        </div>
        <div class="card">
          <div class="card-head"><span>Vitesse hebdomadaire</span></div>
          <div class="big-num" id="ss-weekly-speed">—</div>
          <div class="big-sub">kg/semaine</div>
        </div>
      </div>

      <!-- Badges & records -->
      <div class="card">
        <div class="card-head"><span>Badges & Records</span></div>
        <div id="badges-grid" class="badges-grid"></div>
      </div>

      <!-- Success calendar -->
      <div class="card">
        <div class="card-head"><span>Calendrier de réussite</span></div>
        <div id="success-calendar" class="success-calendar"></div>
      </div>
    </section>

    <!-- ===== GOALS ===== -->
    <section id="view-goals" class="view">
      <div class="card">
        <div class="card-head"><span>Mes objectifs</span></div>
        <form id="goals-form" class="field-grid">
          <label>Poids cible (kg)<input type="number" step="0.1" name="targetWeight" /></label>
          <label>Masse grasse cible (%)<input type="number" step="0.1" name="targetBodyfat" /></label>
          <label>Masse musculaire cible (%)<input type="number" step="0.1" name="targetMuscle" /></label>
          <label>Poids de départ (pour la progression)<input type="number" step="0.1" name="startWeightRef" /></label>
          <button class="btn primary" type="submit" style="grid-column:span 2;">Enregistrer</button>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><span>Progression</span></div>
        <div id="goals-progress" class="goals-progress"></div>
      </div>
      <div class="card">
        <div class="card-head"><span>Date estimée d'atteinte des objectifs</span></div>
        <div id="goals-eta" class="goals-progress"></div>
      </div>
    </section>

    <!-- ===== JOURNAL ===== -->
    <section id="view-journal" class="view">
      <div class="card">
        <div class="card-head"><span>Journal &amp; photos de progression</span></div>
        <div id="journal-list" class="journal-list"></div>
      </div>
    </section>
  </main>
</div>

<!-- ===================== LOG MODAL ===================== -->
<div id="log-modal" class="modal hidden">
  <div class="modal-card">
    <div class="modal-head">
      <h2>Saisie du jour</h2>
      <button class="icon-btn" id="close-log">✕</button>
    </div>
    <form id="log-form" class="modal-form">
      <label>Date<input type="date" name="date" required /></label>

      <div class="modal-section-title">📊 Mesures corporelles</div>
      <div class="field-grid">
        <label>Poids (kg)<input type="number" step="0.1" name="weight" /></label>
        <label>Masse grasse (%)<input type="number" step="0.1" name="bodyfat" /></label>
        <label>Masse musculaire (%)<input type="number" step="0.1" name="muscle" /></label>
      </div>

      <div class="modal-section-title">🍽️ Alimentation</div>
      <label>Calories consommées (kcal)<input type="number" name="calories" required /></label>

      <div class="modal-section-title">🏃 Activités sportives</div>
      <div id="sport-activities-list"></div>
      <button type="button" class="btn ghost" id="add-sport-btn" style="width:100%;margin-top:4px;">+ Ajouter une activité</button>

      <div class="modal-section-title">😴 Sommeil</div>
      <div class="field-grid">
        <label>Durée de sommeil (heures)<input type="number" step="0.5" name="sleepDuration" min="0" max="24" placeholder="Ex: 7.5" /></label>
        <label>Score de sommeil (0-100)<input type="number" name="sleepScore" min="0" max="100" placeholder="Ex: 78" /></label>
      </div>

      <div class="modal-section-title">💭 Bien-être</div>
      <div class="field-grid">
        <label>Humeur
          <select name="mood">
            <option value="">—</option>
            <option value="5">Excellente</option>
            <option value="4">Bonne</option>
            <option value="3">Neutre</option>
            <option value="2">Faible</option>
            <option value="1">Mauvaise</option>
          </select>
        </label>
        <label>Énergie
          <select name="energy">
            <option value="">—</option>
            <option value="5">Très haute</option>
            <option value="4">Haute</option>
            <option value="3">Normale</option>
            <option value="2">Basse</option>
            <option value="1">Très basse</option>
          </select>
        </label>
      </div>
      <label>Notes<textarea name="notes" rows="2"></textarea></label>
      <label>Photo de progression<input type="file" name="photo" accept="image/*" /></label>
      <button type="submit" class="btn primary full">Enregistrer</button>
    </form>
  </div>
</div>

<!-- ===================== BMR MODAL ===================== -->
<div id="bmr-modal" class="modal hidden">
  <div class="modal-card" style="max-width:380px;">
    <div class="modal-head">
      <h2>Modifier le BMR</h2>
      <button class="icon-btn" id="close-bmr">✕</button>
    </div>
    <form id="bmr-form" class="modal-form">
      <label>Nouveau BMR de base (kcal/jour)
        <input type="number" id="bmr-input" min="800" max="4000" required />
      </label>
      <p class="hint">Le BMR adapté sera recalculé automatiquement selon ton historique poids/calories.</p>
      <button type="submit" class="btn primary full">Valider</button>
    </form>
  </div>
</div>

<!-- ===================== SYNC SETTINGS MODAL ===================== -->
<div id="sync-settings-modal" class="modal hidden">
  <div class="modal-card" style="max-width:440px;">
    <div class="modal-head">
      <h2>Synchronisation entre appareils</h2>
      <button class="icon-btn" id="close-sync-settings">✕</button>
    </div>
    <form id="sync-settings-form" class="modal-form">
      <p class="hint">Renseigne les mêmes identifiants JSONBin.io sur chacun de tes appareils pour qu'ils partagent les mêmes données. Crée un compte gratuit sur <strong>jsonbin.io</strong>, crée un "Bin", puis colle ta clé API et l'ID du Bin ci-dessous.</p>
      <label>Clé API JSONBin (X-Master-Key)
        <input type="text" id="sync-jsonbin-key" placeholder="$2a$10$..." autocomplete="off" />
      </label>
      <label>Bin ID
        <input type="text" id="sync-jsonbin-id" placeholder="6...abc" autocomplete="off" />
      </label>
      <button type="submit" class="btn primary full">Enregistrer et synchroniser</button>
    </form>
  </div>
</div>

<!-- ===================== SPORT ACTIVITY TEMPLATE ===================== -->
<template id="sport-activity-tpl">
  <div class="sport-activity-row">
    <input type="text" class="sport-name" placeholder="Nom de l'activité (ex: Course à pied)" />
    <input type="number" class="sport-kcal" placeholder="Calories dépensées" min="0" />
    <button type="button" class="sport-remove icon-btn">✕</button>
  </div>
</template>

<script src="app.js"></script>
</body>
</html>
