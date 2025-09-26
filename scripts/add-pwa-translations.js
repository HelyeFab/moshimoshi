const fs = require('fs');
const path = require('path');

// PWA translations for remaining languages
const translations = {
  fr: `
  // PWA (Progressive Web App)
  pwa: {
    install: {
      title: "Installer Moshimoshi",
      description: "Installez l'application pour une meilleure expérience",
      button: "Installer l'App",
      later: "Plus tard",
      benefits: {
        offline: "Accédez à vos leçons hors ligne",
        faster: "Temps de chargement plus rapides",
        notifications: "Recevez des rappels de révision"
      },
      ios: {
        instructions: "Comment installer sur iOS:",
        step1: "Appuyez sur le bouton Partager",
        step2: "Faites défiler et appuyez sur \\"Sur l'écran d'accueil\\"",
        step3: "Appuyez sur \\"Ajouter\\" pour installer"
      }
    },
    notifications: {
      permission: {
        title: "Activer les notifications",
        description: "Recevez des rappels quand des révisions sont dues",
        allow: "Autoriser les notifications",
        deny: "Pas maintenant",
        blocked: "Les notifications sont bloquées. Veuillez les activer dans les paramètres de votre navigateur.",
        unsupported: "Les notifications ne sont pas supportées dans votre navigateur"
      },
      quietHours: {
        title: "Heures silencieuses",
        description: "Ne pas envoyer de notifications pendant ces heures",
        start: "Heure de début",
        end: "Heure de fin",
        enabled: "Heures silencieuses activées",
        disabled: "Heures silencieuses désactivées"
      },
      test: {
        title: "Notification de test",
        body: "Ceci est un test de vos paramètres de notification",
        button: "Envoyer un test"
      }
    },
    badge: {
      reviewsDue: "{{count}} révisions en attente",
      clearBadge: "Effacer le badge"
    },
    share: {
      title: "Ajouter à Moshimoshi",
      description: "Choisissez où sauvegarder ce contenu",
      addToList: "Ajouter à la liste",
      createNew: "Créer une nouvelle liste",
      selectList: "Sélectionner une liste",
      success: "Contenu ajouté avec succès",
      error: "Échec de l'ajout du contenu"
    },
    mediaSession: {
      playing: "En lecture",
      paused: "En pause",
      playbackRate: "Vitesse de lecture"
    },
    offline: {
      title: "Vous êtes hors ligne",
      description: "Certaines fonctionnalités peuvent être limitées sans connexion internet",
      cached: "Affichage du contenu en cache",
      retry: "Réessayer la connexion"
    }
  }`,
  it: `
  // PWA (Progressive Web App)
  pwa: {
    install: {
      title: "Installa Moshimoshi",
      description: "Installa l'app per un'esperienza migliore",
      button: "Installa App",
      later: "Più tardi",
      benefits: {
        offline: "Accedi alle tue lezioni offline",
        faster: "Tempi di caricamento più veloci",
        notifications: "Ricevi promemoria per le revisioni"
      },
      ios: {
        instructions: "Come installare su iOS:",
        step1: "Tocca il pulsante Condividi",
        step2: "Scorri e tocca \\"Aggiungi a Home\\"",
        step3: "Tocca \\"Aggiungi\\" per installare"
      }
    },
    notifications: {
      permission: {
        title: "Abilita le notifiche",
        description: "Ricevi promemoria quando le revisioni sono dovute",
        allow: "Consenti notifiche",
        deny: "Non ora",
        blocked: "Le notifiche sono bloccate. Abilitale nelle impostazioni del browser.",
        unsupported: "Le notifiche non sono supportate nel tuo browser"
      },
      quietHours: {
        title: "Ore silenziose",
        description: "Non inviare notifiche durante questi orari",
        start: "Ora di inizio",
        end: "Ora di fine",
        enabled: "Ore silenziose abilitate",
        disabled: "Ore silenziose disabilitate"
      },
      test: {
        title: "Notifica di prova",
        body: "Questo è un test delle tue impostazioni di notifica",
        button: "Invia test"
      }
    },
    badge: {
      reviewsDue: "{{count}} revisioni in attesa",
      clearBadge: "Cancella badge"
    },
    share: {
      title: "Aggiungi a Moshimoshi",
      description: "Scegli dove salvare questo contenuto",
      addToList: "Aggiungi alla lista",
      createNew: "Crea nuova lista",
      selectList: "Seleziona una lista",
      success: "Contenuto aggiunto con successo",
      error: "Impossibile aggiungere il contenuto"
    },
    mediaSession: {
      playing: "In riproduzione",
      paused: "In pausa",
      playbackRate: "Velocità di riproduzione"
    },
    offline: {
      title: "Sei offline",
      description: "Alcune funzionalità potrebbero essere limitate senza connessione internet",
      cached: "Visualizzazione contenuto in cache",
      retry: "Riprova connessione"
    }
  }`,
  de: `
  // PWA (Progressive Web App)
  pwa: {
    install: {
      title: "Moshimoshi installieren",
      description: "Installieren Sie die App für ein besseres Erlebnis",
      button: "App installieren",
      later: "Später",
      benefits: {
        offline: "Greifen Sie offline auf Ihre Lektionen zu",
        faster: "Schnellere Ladezeiten",
        notifications: "Erhalten Sie Wiederholungserinnerungen"
      },
      ios: {
        instructions: "So installieren Sie auf iOS:",
        step1: "Tippen Sie auf die Teilen-Schaltfläche",
        step2: "Scrollen Sie nach unten und tippen Sie auf \\"Zum Home-Bildschirm\\"",
        step3: "Tippen Sie auf \\"Hinzufügen\\" zum Installieren"
      }
    },
    notifications: {
      permission: {
        title: "Benachrichtigungen aktivieren",
        description: "Erhalten Sie Erinnerungen, wenn Wiederholungen fällig sind",
        allow: "Benachrichtigungen erlauben",
        deny: "Jetzt nicht",
        blocked: "Benachrichtigungen sind blockiert. Bitte aktivieren Sie sie in Ihren Browsereinstellungen.",
        unsupported: "Benachrichtigungen werden in Ihrem Browser nicht unterstützt"
      },
      quietHours: {
        title: "Ruhezeiten",
        description: "Keine Benachrichtigungen während dieser Zeiten senden",
        start: "Startzeit",
        end: "Endzeit",
        enabled: "Ruhezeiten aktiviert",
        disabled: "Ruhezeiten deaktiviert"
      },
      test: {
        title: "Testbenachrichtigung",
        body: "Dies ist ein Test Ihrer Benachrichtigungseinstellungen",
        button: "Test senden"
      }
    },
    badge: {
      reviewsDue: "{{count}} Wiederholungen fällig",
      clearBadge: "Badge löschen"
    },
    share: {
      title: "Zu Moshimoshi hinzufügen",
      description: "Wählen Sie, wo Sie diesen Inhalt speichern möchten",
      addToList: "Zur Liste hinzufügen",
      createNew: "Neue Liste erstellen",
      selectList: "Liste auswählen",
      success: "Inhalt erfolgreich hinzugefügt",
      error: "Inhalt konnte nicht hinzugefügt werden"
    },
    mediaSession: {
      playing: "Wiedergabe",
      paused: "Pausiert",
      playbackRate: "Wiedergabegeschwindigkeit"
    },
    offline: {
      title: "Sie sind offline",
      description: "Einige Funktionen können ohne Internetverbindung eingeschränkt sein",
      cached: "Zwischengespeicherte Inhalte anzeigen",
      retry: "Verbindung erneut versuchen"
    }
  }`,
  es: `
  // PWA (Progressive Web App)
  pwa: {
    install: {
      title: "Instalar Moshimoshi",
      description: "Instala la aplicación para una mejor experiencia",
      button: "Instalar App",
      later: "Más tarde",
      benefits: {
        offline: "Accede a tus lecciones sin conexión",
        faster: "Tiempos de carga más rápidos",
        notifications: "Recibe recordatorios de revisión"
      },
      ios: {
        instructions: "Cómo instalar en iOS:",
        step1: "Toca el botón Compartir",
        step2: "Desplázate y toca \\"Añadir a pantalla de inicio\\"",
        step3: "Toca \\"Añadir\\" para instalar"
      }
    },
    notifications: {
      permission: {
        title: "Habilitar notificaciones",
        description: "Recibe recordatorios cuando las revisiones estén pendientes",
        allow: "Permitir notificaciones",
        deny: "Ahora no",
        blocked: "Las notificaciones están bloqueadas. Por favor, actívalas en la configuración de tu navegador.",
        unsupported: "Las notificaciones no son compatibles con tu navegador"
      },
      quietHours: {
        title: "Horas silenciosas",
        description: "No enviar notificaciones durante estas horas",
        start: "Hora de inicio",
        end: "Hora de fin",
        enabled: "Horas silenciosas activadas",
        disabled: "Horas silenciosas desactivadas"
      },
      test: {
        title: "Notificación de prueba",
        body: "Esta es una prueba de tu configuración de notificaciones",
        button: "Enviar prueba"
      }
    },
    badge: {
      reviewsDue: "{{count}} revisiones pendientes",
      clearBadge: "Borrar insignia"
    },
    share: {
      title: "Añadir a Moshimoshi",
      description: "Elige dónde guardar este contenido",
      addToList: "Añadir a lista",
      createNew: "Crear nueva lista",
      selectList: "Seleccionar una lista",
      success: "Contenido añadido con éxito",
      error: "Error al añadir el contenido"
    },
    mediaSession: {
      playing: "Reproduciendo",
      paused: "Pausado",
      playbackRate: "Velocidad de reproducción"
    },
    offline: {
      title: "Estás sin conexión",
      description: "Algunas funciones pueden estar limitadas sin conexión a internet",
      cached: "Viendo contenido en caché",
      retry: "Reintentar conexión"
    }
  }`
};

// Process each language file
Object.entries(translations).forEach(([lang, pwaSection]) => {
  const filePath = path.join(__dirname, '..', 'src', 'i18n', 'locales', lang, 'strings.ts');

  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');

  // Find the last closing brace and add the PWA section before it
  const lastBraceIndex = content.lastIndexOf('  }\n}');

  if (lastBraceIndex !== -1) {
    // Insert the PWA section before the last closing braces
    const newContent =
      content.slice(0, lastBraceIndex) +
      '  },\n' +
      pwaSection + '\n' +
      '}';

    // Write the updated content back to the file
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Updated ${lang}/strings.ts with PWA translations`);
  } else {
    console.error(`❌ Could not find insertion point in ${lang}/strings.ts`);
  }
});

console.log('🎉 PWA translations added to all language files!');