#!/bin/bash

# Script to add achievement translations to all language files

# French translations
cat << 'EOF' > /tmp/fr_achievements.txt
    achievements: {
      title: "Succès",
      unlocked: "débloqué",
      points: "points",
      complete: "complet",
      totalPoints: "Points Totaux",
      legendary: "Légendaire",
      epic: "Épique",
      rare: "Rare",
      uncommon: "Peu commun",
      common: "Commun",
      categories: {
        all: "Tous",
        progress: "Progrès",
        streak: "Série",
        accuracy: "Précision",
        speed: "Vitesse",
        special: "Spécial"
      }
    },

    leaderboard: {
      title: "Classement",
      daily: "Aujourd'hui",
      weekly: "Cette semaine",
      monthly: "Ce mois",
      allTime: "Tout temps",
      rank: "Rang",
      player: "Joueur",
      achievements: "Succès",
      points: "Points",
      streak: "Série",
      yourPosition: "Votre position"
    },

    profile: {
      title: "Profil",
      achievements: {
        title: "Badges de Succès",
        totalPoints: "Points Totaux",
        legendary: "Légendaire",
        epic: "Épique",
        rare: "Rare",
        uncommon: "Peu commun",
        common: "Commun",
        complete: "Complet"
      },
      level: {
        title: "Progression de Niveau",
        level: "Niveau",
        xp: "XP",
        totalXP: "XP Total",
        nextLevel: "Prochain Niveau",
        perks: "Avantages",
        progression: "Progression",
        xpMultiplier: "Multiplicateur XP"
      }
    },
EOF

# Italian translations
cat << 'EOF' > /tmp/it_achievements.txt
    achievements: {
      title: "Obiettivi",
      unlocked: "sbloccato",
      points: "punti",
      complete: "completo",
      totalPoints: "Punti Totali",
      legendary: "Leggendario",
      epic: "Epico",
      rare: "Raro",
      uncommon: "Non comune",
      common: "Comune",
      categories: {
        all: "Tutti",
        progress: "Progresso",
        streak: "Serie",
        accuracy: "Precisione",
        speed: "Velocità",
        special: "Speciale"
      }
    },

    leaderboard: {
      title: "Classifica",
      daily: "Oggi",
      weekly: "Questa settimana",
      monthly: "Questo mese",
      allTime: "Sempre",
      rank: "Posizione",
      player: "Giocatore",
      achievements: "Obiettivi",
      points: "Punti",
      streak: "Serie",
      yourPosition: "La tua posizione"
    },

    profile: {
      title: "Profilo",
      achievements: {
        title: "Badge Obiettivi",
        totalPoints: "Punti Totali",
        legendary: "Leggendario",
        epic: "Epico",
        rare: "Raro",
        uncommon: "Non comune",
        common: "Comune",
        complete: "Completo"
      },
      level: {
        title: "Progresso Livello",
        level: "Livello",
        xp: "XP",
        totalXP: "XP Totali",
        nextLevel: "Prossimo Livello",
        perks: "Vantaggi",
        progression: "Progressione",
        xpMultiplier: "Moltiplicatore XP"
      }
    },
EOF

# German translations
cat << 'EOF' > /tmp/de_achievements.txt
    achievements: {
      title: "Erfolge",
      unlocked: "freigeschaltet",
      points: "Punkte",
      complete: "vollständig",
      totalPoints: "Gesamtpunkte",
      legendary: "Legendär",
      epic: "Episch",
      rare: "Selten",
      uncommon: "Ungewöhnlich",
      common: "Gewöhnlich",
      categories: {
        all: "Alle",
        progress: "Fortschritt",
        streak: "Serie",
        accuracy: "Genauigkeit",
        speed: "Geschwindigkeit",
        special: "Spezial"
      }
    },

    leaderboard: {
      title: "Bestenliste",
      daily: "Heute",
      weekly: "Diese Woche",
      monthly: "Diesen Monat",
      allTime: "Alle Zeit",
      rank: "Rang",
      player: "Spieler",
      achievements: "Erfolge",
      points: "Punkte",
      streak: "Serie",
      yourPosition: "Deine Position"
    },

    profile: {
      title: "Profil",
      achievements: {
        title: "Erfolgsabzeichen",
        totalPoints: "Gesamtpunkte",
        legendary: "Legendär",
        epic: "Episch",
        rare: "Selten",
        uncommon: "Ungewöhnlich",
        common: "Gewöhnlich",
        complete: "Vollständig"
      },
      level: {
        title: "Level-Fortschritt",
        level: "Level",
        xp: "XP",
        totalXP: "Gesamt-XP",
        nextLevel: "Nächstes Level",
        perks: "Vorteile",
        progression: "Fortschritt",
        xpMultiplier: "XP-Multiplikator"
      }
    },
EOF

# Spanish translations
cat << 'EOF' > /tmp/es_achievements.txt
    achievements: {
      title: "Logros",
      unlocked: "desbloqueado",
      points: "puntos",
      complete: "completo",
      totalPoints: "Puntos Totales",
      legendary: "Legendario",
      epic: "Épico",
      rare: "Raro",
      uncommon: "Poco común",
      common: "Común",
      categories: {
        all: "Todos",
        progress: "Progreso",
        streak: "Racha",
        accuracy: "Precisión",
        speed: "Velocidad",
        special: "Especial"
      }
    },

    leaderboard: {
      title: "Tabla de Líderes",
      daily: "Hoy",
      weekly: "Esta semana",
      monthly: "Este mes",
      allTime: "Todo el tiempo",
      rank: "Rango",
      player: "Jugador",
      achievements: "Logros",
      points: "Puntos",
      streak: "Racha",
      yourPosition: "Tu posición"
    },

    profile: {
      title: "Perfil",
      achievements: {
        title: "Insignias de Logros",
        totalPoints: "Puntos Totales",
        legendary: "Legendario",
        epic: "Épico",
        rare: "Raro",
        uncommon: "Poco común",
        common: "Común",
        complete: "Completo"
      },
      level: {
        title: "Progreso de Nivel",
        level: "Nivel",
        xp: "XP",
        totalXP: "XP Total",
        nextLevel: "Siguiente Nivel",
        perks: "Beneficios",
        progression: "Progresión",
        xpMultiplier: "Multiplicador XP"
      }
    },
EOF

echo "Translation templates created in /tmp/"
echo "Now these need to be manually inserted into each language file"