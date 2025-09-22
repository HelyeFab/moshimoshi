export const strings = {
  reviewDashboard: {
    title: "Wiederholungs-Dashboard",
    description: "Verfolgen Sie Ihren Lernfortschritt und Wiederholungsplan",
    tabs: {
      overview: "Übersicht",
      studied: "Gelernt",
      learned: "Beherrscht",
      queue: "Warteschlange",
      schedule: "Zeitplan"
    },
    sections: {
      reviewQueue: "Wiederholungswarteschlange",
      upcomingReviews: "Anstehende Wiederholungen",
      learningProgress: "Lernfortschritt",
      allStudiedItems: "Alle gelernten Elemente",
      learnedItems: "Beherrschte Elemente",
      masteredItems: "Gemeistert",
      inReview: "In Wiederholung",
      reviewQueueFull: "Wiederholungswarteschlange - Jetzt wiederholen",
      reviewSchedule: "Wiederholungszeitplan"
    },
    stats: {
      studied: "Gelernt",
      learned: "Beherrscht",
      dueNow: "Jetzt fällig",
      upcoming: "Anstehend"
    },
    filter: {
      all: "Alle",
      kana: "Kana",
      kanji: "Kanji",
      vocabulary: "Vokabeln",
      sentences: "Sätze"
    },
    actions: {
      startReview: "Wiederholung starten",
      viewAll: "Alle anzeigen",
      refresh: "Aktualisieren"
    },
    messages: {
      noReviewsDue: "Keine Wiederholungen fällig. Gute Arbeit!",
      noUpcoming: "Keine anstehenden Wiederholungen",
      noItemsFiltered: "Keine Elemente für diesen Filter",
      noStudiedItems: "Noch keine gelernten Elemente",
      queueEmpty: "Ihre Wiederholungswarteschlange ist leer!",
      loading: "Lade Wiederholungsdaten...",
      loadError: "Fehler beim Laden der Wiederholungsdaten"
    },
    time: {
      today: "Heute",
      tomorrow: "Morgen",
      thisWeek: "Diese Woche"
    },
    contentTypes: {
      kana: "Kana",
      kanji: "Kanji",
      vocabulary: "Vokabeln",
      sentence: "Satz"
    }
  },
  // Common/Shared
  common: {
    brand: "Moshimoshi",
    loading: "Laden...",
    processing: "Verarbeitung...",
    close: "Schließen",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    save: "Speichern",
    delete: "Löschen",
    edit: "Bearbeiten",
    back: "Zurück",
    next: "Weiter",
    previous: "Zurück",
    submit: "Absenden",
    continue: "Fortfahren",
    clear: "Löschen",
    signIn: "Anmelden",
    signUp: "Registrieren",
    signOut: "Abmelden",
    logOut: "Ausloggen",
    email: "E-Mail",
    filter: "Filtern",
    actions: "Aktionen",
    display: "Anzeige",
    password: "Passwort",
    name: "Name",
    or: "Oder",
    and: "und",
    with: "mit",
    free: "KOSTENLOS",
    premium: "PREMIUM",
    guest: "GAST",
    creating: "Erstelle...",
    saving: "Speichere...",
    upgrade: "Upgrade",
    today: "Heute",
    yesterday: "Gestern",
    theme: "Thema",
  },

  // Landing Page
  landing: {
    header: {
      navigation: {
        about: "Über uns",
        pricing: "Preise",
        signIn: "Anmelden",
      },
    },
    hero: {
      badge: "KOSTENLOS!",
      title: "Japanisch lernen",
      subtitle: "Mit Spaß!",
      description: "Meistere Hiragana, Katakana und Kanji mit kurzen Lektionen und zeitversetzter Wiederholung, die das Lernen nachhaltig macht!",
      primaryCta: "Jetzt mit dem Lernen beginnen",
      secondaryCta: "Ich habe bereits ein Konto",
    },
    mascots: {
      sakura: "Sakura",
      matcha: "Matcha",
      fuji: "Fuji",
      torii: "Torii",
    },
    features: {
      personalizedLearning: {
        title: "Personalisiertes Lernen",
        description: "KI-gestützte Lektionen passen sich Ihrem Tempo und Lernstil an",
      },
      stayMotivated: {
        title: "Bleiben Sie motiviert",
        description: "Verdienen Sie XP, halten Sie Serien aufrecht und schalten Sie Erfolge frei",
      },
      smartReview: {
        title: "Intelligentes Wiederholungssystem",
        description: "SRS-Algorithmus sorgt dafür, dass Sie zum perfekten Zeitpunkt wiederholen",
      },
    },
    stats: {
      title: "Schließen Sie sich Tausenden beim Japanischlernen an!",
      activeLearners: {
        number: "5M+",
        label: "Aktive Lernende",
      },
      lessons: {
        number: "10K+",
        label: "Lektionen",
      },
      successRate: {
        number: "95%",
        label: "Erfolgsquote",
      },
    },
    progressPreview: {
      title: "Ihre Lernreise",
      stage1: {
        title: "Hiragana & Katakana",
        description: "Beherrschen Sie die Grundlagen in 2 Wochen",
      },
      stage2: {
        title: "Grundlegende Kanji",
        description: "Lernen Sie über 100 Basis-Kanji mit Eselsbrücken",
      },
      stage3: {
        title: "Fortgeschrittene Kanji",
        description: "Beherrschen Sie über 1000 Kanji für fließende Sprachkenntnisse",
      },
    },
    finalCta: {
      title: "Bereit, Ihre Reise zu beginnen?",
      description: "Es ist kostenlos, macht Spaß und dauert nur 5 Minuten am Tag!",
      buttonText: "Meine kostenlose Reise beginnen",
    },
  },

  // Dashboard
  dashboard: {
    loading: "Dashboard wird geladen...",
    stats: {
      streak: {
        label: "Serie",
        unit: "Tage",
      },
      xpEarned: {
        label: "XP verdient",
        unit: "Punkte",
      },
      wordsLearned: {
        label: "Gelernte Wörter",
        unit: "Wörter",
      },
      timeStudied: {
        label: "Lernzeit",
        unit: "Stunden",
      },
    },
    greetings: {
      morning: {
        japanese: "おはよう",
        english: "Guten Morgen",
      },
      afternoon: {
        japanese: "こんにちは",
        english: "Guten Tag",
      },
      evening: {
        japanese: "こんばんは",
        english: "Guten Abend",
      },
    },
    navigation: {
      userMenuAria: "Benutzermenü",
      account: "Konto",
      settings: "Einstellungen",
      adminDashboard: "Admin-Dashboard",
      backToDashboard: "← Zurück zum Dashboard",
    },
    welcome: {
      firstVisit: "Willkommen bei Moshimoshi! Doshi freut sich darauf, mit Ihnen zu lernen! 🎉",
      firstVisitMessage: "Willkommen zu Ihrem Japanisch-Lernabenteuer! Doshi ist hier, um Sie zu führen.",
      returningMessage: "Bereit, Ihre Reise fortzusetzen? Ihre Hingabe ist inspirierend!",
      signoutToast: "Sayonara! Bis bald! 👋",
      doshiClick: "Doshi sagt: がんばって! (Viel Glück!)",
    },
    progress: {
      dailyGoal: {
        title: "Tagesziel",
        tooltip: "Täglich 30 Minuten Lernzeit absolvieren",
        progressLabel: "Fortschritt",
        encouragement: "Weiter so! Sie sind bei {{percentage}}%!",
      },
      achievement: {
        title: "Neuester Erfolg",
        earnedTime: "Vor {{time}} erhalten",
      },
    },
    account: {
      title: "Kontodetails",
      upgradeTooltip: "Upgrade auf Premium für unbegrenzte Lektionen!",
      upgradeLink: "Upgrade →",
      fields: {
        email: "E-Mail",
        memberSince: "Mitglied seit",
        emailStatus: "E-Mail-Status",
      },
      emailStatusValues: {
        verified: "✓ Verifiziert",
        pending: "⚠ Ausstehende Verifizierung",
      },
      defaultMemberSince: "Kürzlich beigetreten",
    },
    developer: {
      modeTitle: "Entwicklermodus",
      authTestLink: "→ Auth-Testseite",
    },
    greeting: {
      morning: "Guten Morgen",
      afternoon: "Guten Tag",
      evening: "Guten Abend"
    },
    learningVillage: {
      title: "Willkommen im Lerndorf",
      subtitle: "Wählen Sie Ihren Weg zur Japanisch-Meisterschaft",
      clickToStart: "Klicken Sie auf einen beliebigen Stand, um Ihre Reise zu beginnen!"
    },
    cards: {
      hiragana: {
        title: "Hiragana",
        subtitle: "ひらがな",
        description: "Meistern Sie die fließende Schrift"
      },
      katakana: {
        title: "Katakana",
        subtitle: "カタカナ",
        description: "Scharfe und eckige Zeichen"
      },
      kanji: {
        title: "Kanji",
        subtitle: "漢字",
        description: "Alte chinesische Schriftzeichen"
      },
      vocabulary: {
        title: "Vocabulary",
        subtitle: "単語",
        description: "Bauen Sie Ihren Wortschatz auf"
      },
      grammar: {
        title: "Grammar",
        subtitle: "文法",
        description: "Lernen Sie die Satzstruktur"
      },
      particles: {
        title: "Particles",
        subtitle: "助詞",
        description: "Verbinden Sie Ihre Wörter"
      },
      listening: {
        title: "Listening",
        subtitle: "聴解",
        description: "Trainieren Sie Ihre Ohren"
      },
      speaking: {
        title: "Speaking",
        subtitle: "会話",
        description: "Finden Sie Ihre Stimme"
      },
      reading: {
        title: "Reading",
        subtitle: "読解",
        description: "Entschlüsseln Sie das geschriebene Wort"
      },
      writing: {
        title: "Writing",
        subtitle: "作文",
        description: "Drücken Sie sich im Text aus"
      },
      culture: {
        title: "Culture",
        subtitle: "文化",
        description: "Verstehen Sie Japan tiefgreifend"
      },
      business: {
        title: "Business",
        subtitle: "ビジネス",
        description: "Professionelles Japanisch"
      },
      travel: {
        title: "Travel",
        subtitle: "旅行",
        description: "Navigieren Sie mühelos durch Japan"
      },
      food: {
        title: "Food & Dining",
        subtitle: "料理",
        description: "Bestellen Sie wie ein Einheimischer"
      },
      anime: {
        title: "Anime & Manga",
        subtitle: "アニメ",
        description: "Lernen Sie von Ihren Favoriten"
      },
      games: {
        title: "Games",
        subtitle: "ゲーム",
        description: "Lernen Sie durch Spielen"
      },
      music: {
        title: "Music",
        subtitle: "音楽",
        description: "Lernen Sie durch Lieder"
      },
      news: {
        title: "News",
        subtitle: "ニュース",
        description: "Aktuelle Ereignisse auf Japanisch"
      },
      jlpt: {
        title: "JLPT",
        subtitle: "JLPT Vorbereitung",
        description: "Bestehen Sie Ihren Sprachtest"
      },
      flashcards: {
        title: "Flashcards",
        subtitle: "カード",
        description: "Schnelle Wiederholungssessions"
      },
      favourites: {
        title: "Meine Favoriten",
        subtitle: "Gespeichert",
        description: "Gespeicherte Inhalte überprüfen"
      },
      myLists: {
        title: "Meine Listen",
        subtitle: "Eigene Listen",
        description: "Eigene Listen verwalten"
      }
    },
    achievements: {
      title: "Erfolge",
      unlocked: "freigeschaltet",
      points: "Punkte",
      complete: "abgeschlossen",
      categories: {
        all: "Alle",
        progress: "Fortschritt",
        streak: "Serie",
        accuracy: "Genauigkeit",
        speed: "Geschwindigkeit",
        special: "Spezial"
      },
      latest: "Neuester Erfolg",
      tabs: {
        overview: "Übersicht",
        progress: "Fortschritt",
        insights: "Einblicke"
      },
      stats: "{{unlocked}}/{{total}} freigeschaltet • {{points}} Punkte • {{percent}}% abgeschlossen",
      latestAchievement: "Neuester Erfolg",
      readyToStart: "Bereit zum Start!",
      firstLesson: "Absolvieren Sie Ihre erste Lektion, um Erfolge zu erhalten",
      yourJourney: "Ihre Reise beginnt jetzt"
    },
    dailyGoal: {
      title: "Tagesziel",
      progress: "Fortschritt",
      minutes: "{{min}}/30 Min",
      startPractice: "Beginnen Sie Ihre tägliche Übung, um Ihr Ziel zu erreichen!"
    },
    accountDetails: {
      title: "Kontodetails",
      email: "E-Mail",
      emailStatus: "E-Mail-Status",
      verified: "Verifiziert",
      memberSince: "Mitglied seit",
      recentlyJoined: "Kürzlich beigetreten",
      upgrade: "Upgrade"
    },
    developerMode: "Entwicklermodus",
    authTestPage: "Auth-Testseite"
  },

  // Auth Pages
  auth: {
    signin: {
      branding: {
        logoText: "も",
      },
      page: {
        title: "Willkommen zurück!",
        subtitle: "Melden Sie sich an, um weiter Japanisch zu lernen",
      },
      form: {
        labels: {
          email: "E-Mail",
          password: "Passwort",
        },
        placeholders: {
          email: "sie@beispiel.de",
          password: "••••••••",
        },
        checkbox: "Angemeldet bleiben",
        submitButton: {
          default: "Anmelden",
          loading: "Anmeldung läuft...",
        },
      },
      links: {
        forgotPassword: "Passwort vergessen?",
        signupLink: "Noch kein Konto? Kostenlos registrieren",
      },
      alternativeAuth: {
        divider: "Oder fortfahren mit",
        magicLinkButton: "Magic Link senden",
        googleButton: "Mit Google fortfahren",
      },
      messages: {
        signupSuccess: "Konto erstellt! Bitte melden Sie sich an.",
        signinSuccess: "Willkommen zurück!",
        magicLinkError: "Bitte geben Sie Ihre E-Mail-Adresse ein, um fortzufahren.",
        magicLinkSuccess: "Prüfen Sie Ihre E-Mails für den Magic Link!",
      },
      errors: {
        signinFailed: "Anmeldung fehlgeschlagen",
        sessionCreationFailed: "Sitzungserstellung fehlgeschlagen",
        magicLinkFailed: "Magic Link senden fehlgeschlagen",
        firebaseNotInitialized: "Firebase nicht initialisiert",
      },
    },
    signup: {
      page: {
        title: "Beginnen Sie Ihre Reise",
        subtitle: "Kostenloses Konto erstellen, um Japanisch zu lernen",
      },
      form: {
        labels: {
          name: "Name (optional)",
          email: "E-Mail",
          password: "Passwort",
        },
        placeholders: {
          name: "Ihr Name",
          email: "sie@beispiel.de",
          password: "••••••••",
        },
        passwordRequirements: "Mindestens 8 Zeichen mit 1 Großbuchstaben, 1 Zahl und 1 Sonderzeichen",
        termsAgreement: "Ich stimme den {{terms}} und der {{privacy}} zu",
        termsLink: "Nutzungsbedingungen",
        privacyLink: "Datenschutzerklärung",
        submitButton: {
          default: "Kostenloses Konto erstellen",
          loading: "Konto wird erstellt...",
        },
      },
      links: {
        signinLink: "Bereits ein Konto? Anmelden",
      },
      alternativeAuth: {
        divider: "Oder registrieren mit",
        googleButton: "Mit Google fortfahren",
        magicLinkButton: "Mit Magic Link anmelden",
      },
      magicLink: {
        title: "Magic Link Anmeldung",
        subtitle: "Wir senden Ihnen einen Link zum sofortigen Anmelden",
        sendButton: "Magic Link senden",
        sending: "Wird gesendet...",
        backButton: "Zurück zur regulären Anmeldung",
        successTitle: "Prüfen Sie Ihre E-Mail!",
        successMessage: "Wir haben einen Magic Link gesendet an",
        successDescription: "Klicken Sie auf den Link in der E-Mail, um sich anzumelden.",
        tryDifferentMethod: "Eine andere Methode versuchen",
      },
      messages: {
        signupSuccess: "Konto erfolgreich erstellt! Sie können sich jetzt anmelden.",
        googleNewUser: "Willkommen bei Moshimoshi! Lassen Sie uns Ihre Japanisch-Lernreise beginnen!",
        googleExistingUser: "Willkommen zurück!",
        magicLinkSent: "Magic Link gesendet! Prüfen Sie Ihre E-Mail, um sich anzumelden.",
      },
      errors: {
        signupFailed: "Registrierung fehlgeschlagen",
        sessionCreationFailed: "Sitzungserstellung fehlgeschlagen",
        firebaseNotInitialized: "Firebase nicht initialisiert",
        magicLinkFailed: "Magic Link konnte nicht gesendet werden",
      },
    },
  },

  // Admin Dashboard
  admin: {
    pageTitle: "Dashboard-Übersicht",
    pageDescription: "Willkommen zurück! Das passiert heute bei Moshimoshi.",
    loading: "Admin-Dashboard wird geladen...",
    errorMessages: {
      loadingError: "Fehler beim Laden des Dashboards:",
      fetchError: "Statistiken abrufen fehlgeschlagen",
      generalError: "Ein Fehler ist aufgetreten",
    },
    statCards: {
      totalUsers: "Gesamtnutzer",
      activeToday: "Heute aktiv",
      newUsersToday: "Neue Nutzer heute",
      activeSubscriptions: "Aktive Abonnements",
      monthlyRevenue: "Monatliche Einnahmen",
      trialUsers: "Testnutzer",
      totalLessons: "Gesamtlektionen",
      completedToday: "Heute abgeschlossen",
    },
    sections: {
      quickActions: "Schnellaktionen",
      recentUsers: "Neueste Nutzer",
      systemStatus: "Systemstatus",
      newsScraping: "Nachrichtensammlung",
    },
    quickActionButtons: {
      moodBoards: "Stimmungstafeln",
      users: "Benutzer",
      content: "Inhalte",
      analytics: "Analysen",
    },
    systemMetrics: {
      database: "Datenbank",
      operational: "Betriebsbereit",
      apiResponseTime: "API-Antwortzeit",
      cacheHitRate: "Cache-Trefferquote",
      errorRate: "Fehlerrate",
      uptime: "Betriebszeit",
    },
    userLabels: {
      user: "Nutzer",
      noRecentUsers: "Keine aktuellen Nutzer",
      daysAgo: "vor {{days}} Tagen",
      hoursAgo: "vor {{hours}} Std",
      minutesAgo: "vor {{minutes}} Min",
      justNow: "Gerade eben",
    },
    newsScraping: {
      nhkEasy: "NHK Easy",
      nhkSchedule: "Alle 4 Stunden",
      watanoc: "Watanoc",
      watanocSchedule: "Alle 6 Stunden",
      mainichiShogakusei: "Mainichi Shogakusei",
      mainichiSchedule: "Täglich um 10:00",
      scrapingArticles: "Artikel werden gesammelt...",
    },
  },

  // Account Page
  account: {
    pageTitle: "アカウント",
    pageDescription: "Kontoeinstellungen verwalten",
    loadingMessage: "Konto wird geladen...",
    sections: {
      profileInformation: "Profilinformationen",
      accountStatistics: "Kontostatistiken",
      subscription: "Abonnement",
      dangerZone: "Gefahrenzone",
    },
    profileFields: {
      profilePhoto: "Profilfoto",
      photoDescription: "JPG, PNG oder GIF. Max 2MB.",
      displayName: "Anzeigename",
      namePlaceholder: "Geben Sie Ihren Namen ein",
      emailAddress: "E-Mail-Adresse",
      verified: "Verifiziert",
      verify: "Verifizieren",
    },
    buttons: {
      saveChanges: "Änderungen speichern",
      updating: "Aktualisierung...",
      deleteAccount: "Konto löschen",
      upgradeText: "Auf Premium upgraden",
      manageSubscription: "Abonnement verwalten →",
    },
    statistics: {
      daysActive: "Aktive Tage",
      wordsLearned: "Gelernte Wörter",
      achievements: "Erfolge",
      dayStreak: "Tagesserie",
    },
    subscription: {
      premium: "PREMIUM",
      free: "KOSTENLOS",
      plan: "Plan",
      nextBilling: "Nächste Abrechnung",
      premiumMonthly: "Premium monatlich",
      premiumYearly: "Premium jährlich",
      freePlan: "Kostenloser Plan",
      manageSubscription: "Abonnement verwalten",
      upgradeToPremium: "Auf Premium upgraden",
      currentPlan: "Aktueller Plan",
      upgradeText: "Upgrade für unbegrenzte Übungssitzungen und Premium-Funktionen",
      title: "Ihr Abonnement",
      status: "Status",
      active: "Aktiv",
      inactive: "Inaktiv",
      canceled: "Gekündigt",
      trialEnds: "Testversion endet",
      renews: "Erneuert sich",
      expires: "Läuft ab",
      managePayment: "Zahlung verwalten",
      cancelSubscription: "Abonnement kündigen",
      reactivate: "Reaktivieren",
      upgradeOptions: "Upgrade-Optionen",
      choosePlan: "Wählen Sie Ihren Plan",
      recommended: "Empfohlen",
      mostPopular: "Beliebteste",
      bestValue: "Bester Wert",
      perMonth: "/Monat",
      perYear: "/Jahr",
      billed: "Abgerechnet {{amount}} {{period}}",
      monthly: "monatlich",
      yearly: "jährlich",
      features: {
        title: "Enthaltene Funktionen",
        unlimited: "Unbegrenzte Übungssitzungen",
        srs: "Erweiterte Wiederholung mit Abständen",
        offline: "Offline-Modus",
        analytics: "Detaillierte Analysen",
        priority: "Prioritäts-Support",
        customization: "Lernpfad-Anpassung",
        ai: "Personalisierter KI-Tutor",
        certificates: "Fortschrittszertifikate",
      },
      upgrade: {
        title: "Schöpfen Sie Ihr volles Potenzial aus",
        subtitle: "Upgrade auf Premium und beschleunigen Sie Ihre Japanisch-Lernreise",
        cta: "Jetzt upgraden",
        processing: "Verarbeitung...",
      },
      invoice: {
        title: "Rechnungsverlauf",
        noInvoices: "Noch keine Rechnungen verfügbar",
        date: "Datum",
        description: "Beschreibung",
        amount: "Betrag",
        status: "Status",
        actions: "Aktionen",
        download: "PDF herunterladen",
        subscription: "Abonnement",
        statuses: {
          paid: "Bezahlt",
          open: "Offen",
          void: "Ungültig",
          uncollectible: "Uneinbringlich",
        },
      },
      billing: {
        title: "Rechnungsinformationen",
        nextBillingDate: "Nächstes Abrechnungsdatum",
        paymentMethod: "Zahlungsmethode",
        cardEnding: "Karte endet auf {{last4}}",
        updatePayment: "Zahlungsmethode aktualisieren",
        billingHistory: "Rechnungsverlauf",
        downloadInvoice: "Rechnung herunterladen",
      },
    },
    dangerZone: {
      description: "Löschen Sie Ihr Konto und alle zugehörigen Daten. Diese Aktion kann nicht rückgängig gemacht werden.",
    },
    deleteAccountDialog: {
      title: "Konto löschen?",
      message: "Sind Sie sicher, dass Sie Ihr Konto löschen möchten? Dies wird dauerhaft alle Ihre Daten einschließlich Fortschritt, Erfolge und Abonnement löschen. Diese Aktion kann nicht rückgängig gemacht werden.",
      confirmText: "Ja, mein Konto löschen",
      cancelText: "Abbrechen",
    },
    toastMessages: {
      profileUpdated: "Profil erfolgreich aktualisiert!",
      accountDeletionRequested: "Kontolöschung angefordert. Bitte kontaktieren Sie den Support.",
    },
  },

  // UI Components
  components: {
    alert: {
      dismissAriaLabel: "Warnung schließen",
    },
    dialog: {
      defaultConfirm: "Bestätigen",
      defaultCancel: "Abbrechen",
      processing: "Verarbeitung...",
    },
    doshi: {
      loading: "Doshi lädt...",
      altText: "Doshi - Ihr Lernbegleiter",
      failedToLoad: "Laden der Roter-Panda-Animation fehlgeschlagen",
      ariaLabel: "{{alt}} - Klicken zum Interagieren",
      moodAria: "Doshi ist {{mood}}",
    },
    drawer: {
      closeAriaLabel: "Schublade schließen",
    },
    loading: {
      default: "Laden...",
      closeAriaLabel: "Schließen",
    },
    modal: {
      closeAriaLabel: "Modal schließen",
    },
    theme: {
      lightAriaLabel: "Helles Design",
      systemAriaLabel: "System-Design",
      darkAriaLabel: "Dunkles Design",
    },
    toast: {
      closeAriaLabel: "Schließen",
      errorMessage: "useToast muss innerhalb von ToastProvider verwendet werden",
    },
  },

  // Error Messages (User-Friendly)
  errors: {
    auth: {
      popupClosed: "Anmeldung abgebrochen. Bitte versuchen Sie es erneut, wenn Sie bereit sind.",
      networkFailed: "Verbindungsproblem. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
      tooManyRequests: "Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.",
      userDisabled: "Dieses Konto wurde deaktiviert. Bitte kontaktieren Sie den Support.",
      userNotFound: "Kein Konto mit dieser E-Mail gefunden. Bitte überprüfen oder registrieren Sie sich.",
      wrongPassword: "Falsches Passwort. Bitte versuchen Sie es erneut.",
      invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      emailInUse: "Diese E-Mail ist bereits registriert. Bitte melden Sie sich stattdessen an.",
      weakPassword: "Bitte wählen Sie ein stärkeres Passwort (mindestens 6 Zeichen).",
      invalidCredential: "Ungültige Anmeldedaten. Bitte überprüfen und erneut versuchen.",
      requiresRecentLogin: "Bitte melden Sie sich erneut an, um diese Aktion abzuschließen.",
      unauthorized: "Diese Domain ist nicht autorisiert. Bitte kontaktieren Sie den Support.",
      invalidActionCode: "Dieser Link ist abgelaufen oder ungültig. Bitte fordern Sie einen neuen an.",
    },
    validation: {
      invalidInput: "Bitte überprüfen Sie Ihre Informationen und versuchen Sie es erneut.",
    },
    network: {
      connectionIssue: "Verbindungsproblem. Bitte überprüfen Sie Ihre Internetverbindung.",
      timeout: "Anfrage-Timeout. Bitte versuchen Sie es erneut.",
      offline: "Sie scheinen offline zu sein. Bitte überprüfen Sie Ihre Verbindung.",
    },
    payment: {
      authenticationFailure: "Zahlungsauthentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      cardDeclined: "Karte wurde abgelehnt. Bitte versuchen Sie eine andere Zahlungsmethode.",
      expiredCard: "Ihre Karte ist abgelaufen. Bitte aktualisieren Sie Ihre Zahlungsinformationen.",
      insufficientFunds: "Unzureichende Mittel. Bitte versuchen Sie eine andere Zahlungsmethode.",
      subscriptionRequired: "Premium-Abonnement für diese Funktion erforderlich.",
      subscriptionExpired: "Ihr Abonnement ist abgelaufen. Bitte erneuern Sie es, um fortzufahren.",
    },
    permission: {
      denied: "Sie haben keine Berechtigung, diese Aktion auszuführen.",
      unauthorized: "Bitte melden Sie sich an, um fortzufahren.",
      forbidden: "Zugriff verweigert. Bitte kontaktieren Sie den Support, wenn Sie glauben, dass dies ein Fehler ist.",
    },
    resource: {
      notFound: "Der angeforderte Inhalt konnte nicht gefunden werden.",
      exhausted: "Tageslimit erreicht. Bitte versuchen Sie es morgen erneut.",
      alreadyExists: "Dies existiert bereits. Bitte wählen Sie einen anderen Namen.",
    },
    server: {
      internal: "Etwas ist auf unserer Seite schiefgelaufen. Bitte versuchen Sie es erneut.",
      serverError: "Serverfehler. Unser Team wurde benachrichtigt.",
      unavailable: "Service vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
    },
    generic: {
      unknown: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      somethingWrong: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    },
  },

  // Kana Learning System
  kana: {
    title: "Hiragana & Katakana",
    hiragana: "Hiragana",
    katakana: "Katakana",
    combined: "Kombinierte Übung",
    
    navigation: {
      backToGrid: "Zurück zu Zeichen",
      nextCharacter: "Nächstes Zeichen",
      previousCharacter: "Vorheriges Zeichen",
      startStudy: "Studium beginnen",
      startReview: "Wiederholung beginnen",
      viewAll: "Alle anzeigen",
    },
    
    categories: {
      all: "Alle Zeichen",
      vowels: "Vokale",
      basic: "Basis",
      dakuten: "Dakuten",
      handakuten: "Handakuten",
      digraphs: "Digraphen",
      special: "Spezial",
    },
    
    study: {
      studyMode: "Lernmodus",
      flipCard: "Zum Umdrehen tippen",
      showRomaji: "Romaji anzeigen",
      hideRomaji: "Romaji ausblenden",
      playSound: "Ton abspielen",
      exampleWords: "Beispielwörter",
      strokeOrder: "Strichreihenfolge",
      pinToReview: "Zur Wiederholung anheften",
      unpinFromReview: "Von Wiederholung lösen",
      markAsLearned: "Als gelernt markieren",
      pronunciation: "Aussprache",
    },
    
    review: {
      reviewMode: "Wiederholungsmodus",
      recognition: "Erkennung",
      recall: "Abruf", 
      listening: "Hören",
      selectAnswer: "Wählen Sie die richtige Antwort",
      typeAnswer: "Antwort eingeben",
      correct: "Richtig!",
      incorrect: "Nochmal versuchen",
      showAnswer: "Antwort anzeigen",
      nextQuestion: "Nächste Frage",
      skipQuestion: "Überspringen",
      endReview: "Wiederholung beenden",
      reviewComplete: "Wiederholung abgeschlossen!",
      accuracy: "Genauigkeit",
      timeSpent: "Benötigte Zeit",
      itemsReviewed: "Überprüfte Elemente",
    },
    
    progress: {
      learned: "Gelernt",
      learning: "Am Lernen",
      notStarted: "Nicht begonnen",
      mastered: "Gemeistert",
      totalProgress: "Gesamtfortschritt",
      charactersMastered: "Zeichen gemeistert",
      reviewStreak: "Wiederholungsserie",
      lastReviewed: "Zuletzt wiederholt",
      nextReview: "Nächste Wiederholung",
    },
    
    filters: {
      showAll: "Alle anzeigen",
      showLearned: "Gelernte anzeigen",
      showNotStarted: "Nicht begonnene anzeigen",
      filterByType: "Nach Typ filtern",
      sortBy: "Sortieren nach",
      alphabetical: "Alphabetisch",
      difficulty: "Schwierigkeit",
      progress: "Fortschritt",
    },
    
    tooltips: {
      clickToStudy: "Klicken, um dieses Zeichen zu studieren",
      rightClickToPin: "Rechtsklick zum Anheften für Wiederholung",
      dragToReorder: "Zum Neuordnen ziehen",
      progressInfo: "Sie haben {{learned}} von {{total}} Zeichen gelernt",
    },
    
    messages: {
      loadingCharacters: "Zeichen werden geladen...",
      noCharactersFound: "Keine Zeichen gefunden",
      pinnedSuccess: "Zeichen zur Wiederholung angeheftet",
      unpinnedSuccess: "Zeichen von Wiederholung gelöst",
      markedAsLearned: "Zeichen als gelernt markiert",
      reviewStarting: "Wiederholungssitzung wird gestartet...",
      studyStarting: "Lernsitzung wird gestartet...",
      progressSaved: "Fortschritt gespeichert",
      audioNotAvailable: "Audio für dieses Zeichen nicht verfügbar",
    },
  },

  // Subscription & Entitlements
  subscription: {
    status: {
      active: "Aktiv",
      inactive: "Inaktiv",
      canceled: "Gekündigt",
      pastDue: "Zahlung fällig",
      trialing: "Test",
      incomplete: "Unvollständig",
    },
    plans: {
      free: "Kostenloser Plan",
      guest: "Gast",
      premiumMonthly: "Premium monatlich",
      premiumYearly: "Premium jährlich",
    },
    badges: {
      mostPopular: "Am beliebtesten",
      recommended: "Empfohlen",
      bestValue: "Bester Wert",
    },
    billing: {
      monthly: "Monatlich",
      yearly: "Jährlich",
      perMonth: "pro Monat",
      perYear: "pro Jahr",
      save: "{{percent}}% sparen",
    },
    actions: {
      upgrade: "Auf Premium upgraden",
      upgradeToPlan: "Auf {{plan}} upgraden",
      downgrade: "Downgrade",
      manageBilling: "Abrechnung verwalten",
      manageSubscription: "Abonnement verwalten",
      cancelSubscription: "Abonnement kündigen",
      currentPlan: "Aktueller Plan",
      signUpFree: "Kostenlos registrieren",
      startFreeTrial: "Kostenlose Testversion starten",
      upgradeNow: "Jetzt upgraden",
      viewPlans: "Pläne ansehen",
      choosePlan: "Plan wählen",
    },
    features: {
      unlimited: "Unbegrenzte Übungssitzungen",
      cancelAnytime: "Jederzeit kündbar",
      bestValue: "Bester Wert - Sparen Sie 25%",
      advancedSRS: "Fortgeschrittener SRS-Algorithmus",
      detailedAnalytics: "Detaillierte Fortschrittsanalysen",
      prioritySupport: "Prioritäts-Support",
      offlineMode: "Offline-Modus",
      savePercentage: "25% Ersparnis im Vergleich zum Monatsabo",
      monthsFree: "2 Monate kostenlos",
      earlyAccess: "Früher Zugang zu neuen Funktionen",
      personalizedInsights: "Personalisierte Lerneinsichten",
    },
    upgrade: {
      selectMonthly: "Monatlich wählen",
      selectYearly: "Jährlich wählen",
      title: "Wählen Sie Ihren Plan",
      description: "Wählen Sie den Plan, der am besten zu Ihnen passt",
    },
    checkout: {
      selectPlan: "Plan auswählen",
      paymentMethod: "Zahlungsmethode",
      billingInfo: "Rechnungsinformationen",
      orderSummary: "Bestellübersicht",
      total: "Gesamt",
      processingPayment: "Zahlung wird verarbeitet...",
      paymentFailed: "Zahlung fehlgeschlagen",
      paymentSuccess: "Zahlung erfolgreich!",
    },
    messages: {
      welcomeToPremium: "🎉 Willkommen bei Premium! Ihr Abonnement ist jetzt aktiv.",
      subscriptionUpdated: "Ihr Abonnement wurde aktualisiert.",
      subscriptionCanceled: "Ihr Abonnement endet am {{date}}",
      alreadyOnPlan: "Sie sind bereits auf diesem Plan!",
      alreadySubscribed: "Sie haben diesen Plan bereits abonniert!",
      processing: "Verarbeitung...",
      loadingPricing: "Preise werden geladen...",
    },
    renewal: {
      nextBilling: "Nächste Abrechnung",
      renews: "Verlängert sich",
      ends: "Endet",
      daysRemaining: "{{days}} Tage verbleibend",
      willEndOn: "Ihr Abonnement endet am {{date}}",
    },
    errors: {
      paymentFailed: "Zahlung fehlgeschlagen. Versuchen Sie es mit einer anderen Zahlungsmethode.",
      subscriptionNotFound: "Abonnement nicht gefunden.",
      alreadySubscribed: "Sie haben diesen Plan bereits abonniert.",
      invalidPlan: "Ungültiger Plan ausgewählt.",
      processingError: "Verarbeitungsfehler. Versuchen Sie es später erneut.",
    },
  },

  // Entitlements & Limits
  entitlements: {
    limits: {
      sessionsToday: "{{feature}} Sitzungen heute",
      sessionsLeft: "{{count}} übrig",
      unlimited: "Unbegrenzt",
      dailyLimit: "Tageslimit",
      resets: "Setzt zurück {{time}}",
      resetsTomorrow: "Setzt morgen zurück",
      resetsIn: "Setzt zurück in {{time}}",
    },
    upgrade: {
      title: "Unbegrenzte Praxis freischalten",
      message: "Upgrade auf Premium für unbegrenzte tägliche Sitzungen und exklusive Funktionen.",
      benefits: {
        unlimited: "Unbegrenzte Übungssitzungen",
        allFeatures: "Alle Funktionen freigeschaltet",
        advancedAnalytics: "Erweiterte Analysen",
        prioritySupport: "Priority Support",
        offlineMode: "Offline-Modus",
      },
      cta: {
        learnMore: "Mehr erfahren",
        viewPricing: "Preise ansehen",
        upgradeToPremium: "Auf Premium upgraden",
      },
    },
    messages: {
      limitReached: "Tageslimit erreicht. Versuchen Sie es morgen erneut.",
      signUpForMore: "Kostenlos registrieren für 5 tägliche Übungen",
      upgradeForUnlimited: "Upgrade auf Premium für unbegrenzte Praxis",
      getUnlimitedAccess: "Unbegrenzten Zugang mit Premium erhalten",
      authenticationRequired: "Authentifizierung erforderlich",
      featureLimitReached: "Funktionslimit erreicht",
      upgradeRequired: "Upgrade auf Premium für unbegrenzten Zugang",
    },
  },

  // Pricing Page
  pricing: {
    title: "Wählen Sie Ihre Lernreise",
    subtitle: "Unbegrenzte Praxis freischalten und Ihre Japanisch-Kenntnisse beschleunigen",
    loading: "Preise werden geladen...",
    mostPopular: "Am beliebtesten",
    billingToggle: {
      monthly: "Monatlich",
      yearly: "Jährlich",
      savePercent: "{{percent}}% sparen",
    },
    buttons: {
      getStarted: "Loslegen",
      choosePlan: "Plan wählen",
      currentPlan: "Aktueller Plan",
      upgrade: "Upgrade",
      startFreeTrial: "Kostenlose Testversion starten",
    },
    badges: {
      free: "Kostenlos",
      trial: "Kostenlose Testversion",
      mostPopular: "Am beliebtesten",
      bestValue: "Bester Wert",
    },
    features: {
      title: "Was ist enthalten",
      free: {
        sessions: "5 Übungssitzungen pro Tag",
        basicAnalytics: "Grundlegende Fortschrittsverfolgung",
        communitySupport: "Community-Support",
      },
      premium: {
        unlimitedSessions: "Unbegrenzte Übungssitzungen",
        advancedAnalytics: "Erweiterte Analysen & Einblicke",
        prioritySupport: "Priority Support",
        offlineMode: "Offline-Modus",
        exclusiveContent: "Exklusive Inhalte",
        earlyAccess: "Früher Zugang zu neuen Funktionen",
      },
    },
    comparison: {
      title: "Pläne vergleichen",
      feature: "Funktion",
      included: "Enthalten",
      notIncluded: "—",
    },
    messages: {
      upgradeSuccess: "Upgrade erfolgreich abgeschlossen!",
      downgradePending: "Downgrade für Ende der Abrechnungsperiode geplant.",
      trialStarted: "Kostenlose Testversion gestartet! Genießen Sie die Premium-Funktionen.",
      subscriptionExpired: "Ihr Abonnement ist abgelaufen. Erneuern Sie es, um Premium fortzusetzen.",
    },
    manageBilling: {
      title: "Abrechnung verwalten",
      updatePayment: "Zahlungsmethode aktualisieren",
      downloadInvoice: "Rechnung herunterladen",
      billingHistory: "Abrechnungshistorie",
      nextPayment: "Nächste Zahlung: {{date}}",
    },
    trust: {
      secure: "Sichere Zahlung",
      guarantee: "30-Tage Geld-zurück-Garantie",
      support: "24/7 Support",
      noCommitment: "Keine Verpflichtung",
      cancelAnytime: "Jederzeit kündbar",
    },
    faq: {
      title: "Häufig gestellte Fragen",
      canICancel: {
        question: "Kann ich jederzeit kündigen?",
        answer: "Ja, Sie können Ihr Abonnement jederzeit kündigen. Sie haben weiterhin Zugang bis zum Ende Ihrer Abrechnungsperiode.",
      },
      whatPaymentMethods: {
        question: "Welche Zahlungsmethoden akzeptieren Sie?",
        answer: "Wir akzeptieren alle gängigen Kredit- und Debitkarten sowie PayPal über unseren sicheren Zahlungsdienstleister Stripe.",
      },
      isThereATrial: {
        question: "Gibt es eine kostenlose Testversion?",
        answer: "Neue Nutzer erhalten 7 Tage Premium-Funktionen kostenlos. Keine Kreditkarte erforderlich.",
      },
      canIChangeMyPlan: {
        question: "Kann ich meinen Plan ändern?",
        answer: "Ja, Sie können Ihren Plan jederzeit in Ihren Kontoeinstellungen upgraden oder downgraden.",
      },
    },
  },

  // Kana Learning System
  kana: {
    kanji: {
      study: {
        skip: "Überspringen",
        examples: "Beispiele",
        markAsLearned: "Als gelernt markieren",
        noExamples: "Keine Beispiele verfügbar"
      }
    }
  },

  // Review System
  review: {
    skip: "Überspringen",
    showAnswer: "Antwort anzeigen",
    modes: {
      recognition: "Erkennung",
      recall: "Abruf",
      listening: "Hören",
      writing: "Schreiben",
      speaking: "Sprechen"
    },

    // Kanji-specific
    kanji: {
      writeKanjiFor: "Schreibe das Kanji für:",
      strokeCount: "{{count}} Striche",
      grade: "Klasse {{grade}}",
      frequency: "Häufigkeit #{{rank}}"
    },

    // Confidence
    confidence: "Zuversicht",
    confidenceHelp: "Was ist Zuversicht?",
    confidenceLevel: "Zuversichtsniveau",
    confidenceLow: "Raten",
    confidenceMedium: "Unsicher",
    confidenceHigh: "Sicher",
    confidenceTooltip: {
      title: "Wie sicher sind Sie?",
      description: "Verwenden Sie den Schieberegler, um anzugeben, wie sicher Sie sich bei Ihrer Antwort sind:",
      high: "Hoch (70-100%): Sie kennen die Antwort gut",
      medium: "Mittel (30-70%): Sie sind einigermaßen sicher",
      low: "Niedrig (0-30%): Sie raten",
      tip: "Dies hilft dem System, Ihre Wiederholungen basierend auf Ihrem tatsächlichen Wissen besser zu planen."
    }
  },

  // Learn Section
  learn: {
    hiragana: "Hiragana",
    katakana: "Katakana",
    kanji: "Kanji",
    vocabulary: "Vokabular",
    grid: "Raster",
    browse: "Durchsuchen",
    study: "Lernen",
    review: "Wiederholen",
    progress: "Fortschritt",
    learned: "gelernt",
    selectCharacters: "Bitte wählen Sie Zeichen zum Lernen aus",
    noStrugglingCharacters: "Keine schwierigen Zeichen gefunden",
    selectionCleared: "Auswahl gelöscht",
    studySessionComplete: "Lernsitzung abgeschlossen!",
  },

  // Review Prompts
  reviewPrompts: {
    vocabulary: {
      writeJapaneseFor: "Schreiben Sie das Japanische für:",
      whatWordDoYouHear: "Welches Wort hören Sie?",
      example: "Beispiel:",
      common: "Häufig",
      pitchAccent: "Betonung: {{accent}}",
      searchTitle: "Vokabelsuche",
      searchDescription: "Suchen Sie japanische Wörter mit Bedeutungen und Beispielen",
      searchPlaceholder: "Suche nach Kanji, Kana, Romaji oder englischer Bedeutung...",
      searchButton: "Suchen",
      searchSource: "Suchquelle:",
      searchSourceJMDict: "JMDict (Offline)",
      searchSourceWaniKani: "WaniKani",
      searchResults: "Suchergebnisse",
      searchResultsCount: "Suchergebnisse ({{count}})",
      searchQuickSearch: "Schnellsuche:",
      searchHistory: "Suchverlauf",
      searchHistoryClear: "Löschen",
      searchHistoryEmpty: "Ihr Suchverlauf wird hier angezeigt",
      searchHistoryResults: "{{count}} Ergebnisse",
      searchJustNow: "Gerade eben",
      searchMinutesAgo: "vor {{minutes}} Min.",
      searchHoursAgo: "vor {{hours}} Std.",
      searchDaysAgo: "vor {{days}} Tagen",
      loadingMessage: "Vokabelsuche wird geladen...",
      searching: "Suche läuft...",

      // Tabs
      tabs: {
        details: "Details",
        conjugations: "Konjugationen"
      },

      // Toast messages
      wanikaniUnavailable: "WaniKani ist nicht verfügbar. Verwende stattdessen JMdict-Wörterbuch.",
      wanikaniSearchFailed: "WaniKani-Suche fehlgeschlagen. Wechsle zu JMdict-Wörterbuch.",
      wanikaniMockData: "WaniKani-API ist nicht richtig konfiguriert. Bitte zu JMdict wechseln oder einen gültigen WaniKani-API-Token konfigurieren.",
      wanikaniInvalidKey: "WaniKani-API-Schlüssel ist ungültig. Bitte überprüfen Sie Ihre API-Konfiguration oder verwenden Sie stattdessen JMdict.",
      wanikaniServiceDown: "WaniKani-Dienst ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut oder verwenden Sie JMdict.",
      noResultsFound: "Keine Ergebnisse gefunden. Versuchen Sie einen anderen Suchbegriff.",
      searchFailed: "Suche fehlgeschlagen. Bitte versuchen Sie es erneut.",
      searchHistoryCleared: "Suchverlauf gelöscht",
        loadingCache: "WaniKani-Vokabeldatenbank wird zum ersten Mal geladen... Dies kann einen Moment dauern.",
      wordMeaning: "Bedeutung",
      wordRomaji: "Romaji",
      wordTags: "Tags",
      wordExampleSentences: "Beispielsätze",
      wordExampleSentencesComingSoon: "Beispielsätze kommen bald!",
      noExamplesFound: "Keine Beispiele für dieses Wort gefunden",

      // Practice page
      practiceTitle: "Konjugationsübung",
      practiceDescription: "Beherrschen Sie japanische Verb- und Adjektivkonjugationen",
      filters: {
        all: "Alle",
        verbs: "Nur Verben",
        adjectives: "Nur Adjektive"
      },
      actions: {
        shuffle: "Mischen",
        loadNew: "Neue Wörter laden",
        selectForReview: "Zur Überprüfung auswählen",
        showConjugations: "Konjugationen anzeigen",
        hideConjugations: "Konjugationen ausblenden"
      },
      stats: {
        verbs: "Verben",
        adjectives: "Adjektive"
      },
      studyMode: {
        title: "Konjugationen lernen",
        description: "Lernen Sie japanische Verben und Adjektive mit interaktiven Beispielen zu konjugieren",
        startStudying: "Lernen beginnen"
      },
      reviewMode: {
        practiceConjugation: "Diese Konjugation üben",
        complete: "Überprüfung abschließen",
        noWords: "Keine Wörter zur Überprüfung ausgewählt"
      }
    }
  },

  // Benutzerdefinierte Listen-Funktion
  favourites: {
    title: "Meine Favoriten",
    description: "Ihre gespeicherten Wörter, Kanji und Sätze",
    filters: {
      all: "Alle",
      words: "Wörter",
      kanji: "Kanji",
      sentences: "Sätze",
    },
    filterByList: "Nach Liste filtern",
    allLists: "Alle Listen",
    sortBy: "Sortieren nach",
    sort: {
      recent: "Zuletzt hinzugefügt",
      alphabetical: "Alphabetisch",
      mastery: "Beherrschungsgrad",
    },
    noResultsFound: "Keine Elemente gefunden",
    noItemsSaved: "Noch keine gespeicherten Elemente",
    tryDifferentSearch: "Versuchen Sie einen anderen Suchbegriff",
    startSaving: "Speichern Sie Wörter, Kanji und Sätze, um sie hier zu sehen",
    confirmRemove: "Dieses Element aus allen Listen entfernen?",
    reviewedTimes: "{count} Mal wiederholt",
    manageLists: "Listen verwalten",
  },

  lists: {
    title: "Meine Listen",
    pageDescription: "Erstellen und verwalten Sie Ihre benutzerdefinierten Lernlisten",
    modal: {
      title: "Neue Liste erstellen",
      createTitle: "Ihre Liste konfigurieren",
      saveTitle: "In Listen speichern",
      selectType: "Wählen Sie den Listentyp, den Sie erstellen möchten:",
    },
    types: {
      flashcard: {
        name: "Karteikarten-Liste",
        short: "Karteikarten",
        description: "Beliebigen Inhalt mit zeitversetzter Wiederholung lernen",
        accepts: "Akzeptiert: Wörter, Kanji, Sätze",
      },
      drillable: {
        name: "Übungsliste",
        short: "Übung",
        description: "Konjugationen für Verben und Adjektive üben",
        accepts: "Akzeptiert: Nur Verben und Adjektive",
      },
      sentence: {
        name: "Satzliste",
        short: "Sätze",
        description: "Vollständige Sätze im Kontext lernen",
        accepts: "Akzeptiert: Nur Sätze",
      },
    },
    fields: {
      name: "Listenname",
      description: "Beschreibung",
      color: "Farbe",
      icon: "Symbol",
      notes: "Persönliche Notizen",
      tags: "Tags",
    },
    placeholders: {
      name: "z.B. JLPT N5 Vokabular",
      description: "Optionale Beschreibung für Ihre Liste",
      search: "Listen durchsuchen...",
      notes: "Notizen oder Eselsbrücken hinzufügen...",
      tags: "Kommagetrennte Tags",
    },
    actions: {
      create: "Liste erstellen",
      createNew: "Neue Liste erstellen",
      createFirst: "Ihre erste Liste erstellen",
      save: "Speichern",
      saveToList: "In Liste speichern",
      delete: "Löschen",
      edit: "Liste bearbeiten",
      remove: "Aus Liste entfernen",
      addItems: "Elemente hinzufügen",
      review: "Wiederholen",
      manage: "Liste verwalten",
    },
    deleteDialog: {
      title: "Liste löschen",
      message: "Sind Sie sicher, dass Sie \"{{name}}\" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
      confirm: "Löschen",
      cancel: "Abbrechen",
    },
    labels: {
      itemCount: "{count} Elemente",
      alreadySaved: "Bereits gespeichert",
      incompatibleLists: "Inkompatible Listentypen",
      drillable: "Übbar",
      updated: "Aktualisiert",
    },
    quota: {
      remaining: "{count} Listen verbleibend",
      guestLimit: "Melden Sie sich an, um Listen zu erstellen",
      freeLimit: "Kostenlose Benutzer können bis zu 3 Listen erstellen",
    },
    success: {
      created: "Liste erfolgreich erstellt",
      updated: "Liste erfolgreich aktualisiert",
      deleted: "Liste erfolgreich gelöscht",
      itemAdded: "Zu {count} Liste(n) hinzugefügt",
      itemRemoved: "Aus {count} Liste(n) entfernt",
      itemUpdated: "Element erfolgreich aktualisiert",
    },
    errors: {
      limitReached: "Sie haben Ihr Listenlimit erreicht. Upgraden Sie, um weitere zu erstellen.",
      nameRequired: "Bitte geben Sie einen Listennamen ein",
      typeRequired: "Bitte wählen Sie einen Listentyp",
      createFailed: "Listenerstellung fehlgeschlagen",
      loadFailed: "Listen laden fehlgeschlagen",
      saveFailed: "Element speichern fehlgeschlagen",
      noListSelected: "Bitte wählen Sie mindestens eine Liste",
      incompatibleType: "Dieser Listentyp kann dieses Element nicht akzeptieren",
    },
    empty: {
      noLists: "Sie haben noch keine Listen erstellt",
      noItems: "Diese Liste ist leer",
      noResults: "Keine Ergebnisse gefunden",
      getStarted: "Beginnen Sie, Ihre Lernmaterialien in benutzerdefinierten Listen zu organisieren",
      tryDifferentSearch: "Versuchen Sie es mit anderen Suchbegriffen",
    },
    stats: {
      items: "Elemente",
      mastered: "Gemeistert",
      learning: "Lernen",
      total: "Gesamt",
    },
  },

  // YouTube Shadowing
  youtubeShadowing: {
    title: "YouTube Shadowing",
    description: "Üben Sie Japanisch mit YouTube-Videos und Mediendateien",

    hero: {
      title: "Meistern Sie Japanisch mit beliebigen Medien",
      subtitle: "Verwandeln Sie YouTube-Videos oder Ihre eigenen Mediendateien in interaktive Shadowing-Übungen mit KI-gestützten Transkriptionen"
    },

    modes: {
      input: "Medien hinzufügen",
      player: "Üben"
    },

    input: {
      youtube: "YouTube URL",
      upload: "Datei hochladen",
      youtubeTitle: "YouTube URL einfügen",
      uploadTitle: "Mediendatei hochladen",
      placeholder: "https://www.youtube.com/watch?v=...",
      supportedFormats: "Unterstützte Formate:",
      extract: "Extrahieren & Starten",
      uploadButton: "Datei auswählen",
      maxSize: "Maximale Dateigröße:",
      acceptedFormats: "Akzeptierte Formate: MP4, MP3, WAV, M4A"
    },

    errors: {
      invalidUrl: "Bitte geben Sie eine gültige YouTube URL ein",
      emptyUrl: "Bitte geben Sie eine YouTube URL ein",
      extractFailed: "Video-ID konnte nicht aus der URL extrahiert werden",
      uploadFailed: "Datei-Upload fehlgeschlagen",
      transcriptFailed: "Transkriptionserstellung fehlgeschlagen",
      playerFailed: "Player-Ladevorgang fehlgeschlagen"
    },

    features: {
      transcripts: {
        title: "Sofort-Transkriptionen",
        description: "KI-gestützte Transkription in Sekunden"
      },
      shadowing: {
        title: "Shadowing-Übung",
        description: "Perfektionieren Sie Ihre Aussprache und Ihren Rhythmus"
      },
      furigana: {
        title: "Furigana-Unterstützung",
        description: "Lesehilfe für alle Niveaus"
      }
    },

    player: {
      loading: "Player wird geladen...",
      extractingAudio: "Audio wird extrahiert...",
      generatingTranscript: "Transkription wird erstellt...",
      ready: "Bereit zum Üben!",

      controls: {
        play: "Abspielen",
        pause: "Pause",
        previous: "Vorherige Zeile",
        next: "Nächste Zeile",
        repeat: "Wiederholen",
        speed: "Geschwindigkeit",
        volume: "Lautstärke",
        settings: "Einstellungen",
        furigana: "Furigana anzeigen",
        grammar: "Grammatik anzeigen"
      },

      settings: {
        playbackSpeed: "Wiedergabegeschwindigkeit",
        repeatCount: "Anzahl Wiederholungen",
        pauseBetween: "Pause zwischen",
        continuous: "Kontinuierliche Wiedergabe",
        autoScroll: "Automatisches Scrollen"
      },

      transcript: {
        edit: "Bearbeiten",
        regenerate: "Neu generieren",
        save: "Änderungen speichern",
        cancel: "Bearbeitung abbrechen"
      }
    },

    freeAccess: "Kostenloser Zugang",
    loadingTitle: "Videotitel wird geladen...",
    by: "von",

    usage: {
      today: "Heutige Nutzung",
      unlimited: "Unbegrenzt",
      remaining: "verbleibend",
      limitReached: "Tageslimit erreicht",
      newVideos: "Neue Videos heute",
      uploads: "Uploads"
    }
  },

  conjugation: {
      title: "Konjugation",
      showConjugations: "Konjugationen anzeigen",
      hideConjugations: "Konjugationen ausblenden",
      expandAll: "Alle ausklappen",
      collapseAll: "Alle einklappen",
      groups: {
        stems: "Stämme",
        basicForms: "Grundformen",
        politeForms: "Höflichkeitsformen",
        conditionalForms: "Konditionalformen",
        volitionalForms: "Volitionalformen",
        imperativeForms: "Imperativformen",
        potentialForms: "Potentialformen",
        passiveForms: "Passivformen",
        causativeForms: "Kausativformen",
        causativePassiveForms: "Kausativ-Passivformen",
        desiderativeForms: "Desiderativformen (たい)",
        progressiveForms: "Progressivformen",
        requestForms: "Bitten-Formen",
        colloquialForms: "Umgangssprache-Formen",
        formalForms: "Formelle/Klassische Formen",
        presumptiveForms: "Vermutungsformen",
        plainform: "Grundform",
        politeform: "Höflichkeitsform",
        taiformwantto: "Tai-Form (wollen)",
        "taiform(wantto)": "Tai-Form (wollen)",
        imperativeforms: "Befehlsformen",
        provisionalform: "Provisorische Form",
        conditionalform: "Konditionalform",
        alternativeform: "Alternative Form",
        potentialplainform: "Potentialform (einfach)",
        potentialpoliteform: "Potentialform (höflich)",
        passiveplainform: "Passivform (einfach)",
        passivepoliteform: "Passivform (höflich)",
        causativeplainform: "Kausativform (einfach)",
        causativepoliteform: "Kausativform (höflich)",
        causativepassiveplainform: "Kausativ-Passivform (einfach)",
        causativepassivepoliteform: "Kausativ-Passivform (höflich)",
        colloquialform: "Umgangssprache",
        formalform: "Formelle Form",
        classicalformnu: "Klassische Form (nu)",
        "classicalform(nu)": "Klassische Form (nu)",
        classicalformzaru: "Klassische Form (zaru)",
        "classicalform(zaru)": "Klassische Form (zaru)",
        // Adjektiv-spezifische Gruppen
        basicforms: "Grundformen",
        politeforms: "Höfliche Formen",
        conditionalforms: "Konditionalformen",
        presumptiveforms: "Vermutungsformen"
      },
      forms: {
        // Stämme
        masuStem: "Masu-Stamm",
        negativeStem: "Negativ-Stamm",
        teForm: "Te-Form",
        negativeTeForm: "Negative Te-Form",
        adverbialNegative: "Adverbiales Negativ",
        // Grundformen
        present: "Präsens/Wörterbuchform",
        past: "Vergangenheit",
        negative: "Negativ",
        pastNegative: "Vergangenheit negativ",
        // Höflichkeitsformen
        polite: "Höflich",
        politePast: "Höflich Vergangenheit",
        politeNegative: "Höflich negativ",
        politePastNegative: "Höflich Vergangenheit negativ",
        politeVolitional: "Höflich volitional",
        // Konditional
        provisional: "Falls/Wenn (ば)",
        provisionalNegative: "Falls nicht (ば)",
        conditional: "Falls/Wenn (たら)",
        conditionalNegative: "Falls nicht (たら)",
        // Volitional
        volitional: "Lass uns/Sollen",
        volitionalNegative: "Lass uns nicht",
        // Imperativ
        imperativePlain: "Befehl",
        imperativePolite: "Bitte tu",
        imperativeNegative: "Tu nicht",
        // Potential
        potential: "Kann tun",
        potentialNegative: "Kann nicht tun",
        potentialPast: "Konnte tun",
        potentialPastNegative: "Konnte nicht tun",
        // Passiv
        passive: "Wird getan",
        passiveNegative: "Wird nicht getan",
        passivePast: "Wurde getan",
        passivePastNegative: "Wurde nicht getan",
        // Kausativ
        causative: "Machen/Lassen tun",
        causativeNegative: "Nicht machen/lassen tun",
        causativePast: "Machte/Ließ tun",
        causativePastNegative: "Machte/Ließ nicht tun",
        // Kausativ-Passiv
        causativePassive: "Dazu gebracht werden zu tun",
        causativePassiveNegative: "Nicht dazu gebracht werden zu tun",
        // Desiderativ
        taiForm: "Wollen",
        taiFormNegative: "Nicht wollen",
        taiFormPast: "Wollte",
        taiFormPastNegative: "Wollte nicht",
        // Progressiv
        progressive: "Ist dabei zu tun",
        progressiveNegative: "Ist nicht dabei zu tun",
        progressivePast: "War dabei zu tun",
        progressivePastNegative: "War nicht dabei zu tun",
        // Bitten
        request: "Bitte tu",
        requestNegative: "Bitte tu nicht",
        // Umgangssprache
        colloquialNegative: "Nicht (umgangssprachlich)",
        // Formell
        formalNegative: "Nicht (formell)",
        classicalNegative: "Nicht (klassisch)",
        // Vermutung
        presumptive: "Wahrscheinlich",
        presumptiveNegative: "Wahrscheinlich nicht"
      },
      wordTypes: {
        ichidan: "Ichidan-Verb",
        godan: "Godan-Verb",
        irregular: "Unregelmäßiges Verb",
        iadjective: "i-Adjektiv",
        naadjective: "na-Adjektiv"
      },
      messages: {
        notConjugatable: "Dieses Wort kann nicht konjugiert werden",
        lowConfidence: "Konjugationstyp mit geringem Vertrauen erkannt",
        specialCase: "Dieses Wort hat spezielle Konjugationsregeln"
      },
      // Übungsseite
      practiceTitle: "Konjugationsübung",
      practiceDescription: "Meistere japanische Verb- und Adjektivkonjugationen",
      searchPlaceholder: "Nach einem Verb oder Adjektiv suchen...",
      searchButton: "Suchen",
      clearSearch: "Löschen",
      searchResults: "Suchergebnisse",
      noSearchResults: "Keine konjugierbaren Wörter gefunden",
      filters: {
        all: "Alle",
        verbs: "Nur Verben",
        adjectives: "Nur Adjektive"
      },
      actions: {
        shuffle: "Mischen",
        loadNew: "Neue Wörter laden",
        selectForReview: "Für Wiederholung auswählen",
        showConjugations: "Konjugationen anzeigen",
        hideConjugations: "Konjugationen ausblenden"
      },
      settings: "Einstellungen",
      stats: {
        verbs: "Verben",
        adjectives: "Adjektive"
      },
      studyMode: {
        title: "Konjugationen studieren",
        description: "Lerne japanische Verb- und Adjektivkonjugationen mit interaktiven Beispielen",
        startStudying: "Studium beginnen"
      },
      reviewMode: {
        practiceConjugation: "Diese Konjugation üben",
        complete: "Wiederholung abschließen",
        noWords: "Keine Wörter für Wiederholung ausgewählt"
      }
  },
}