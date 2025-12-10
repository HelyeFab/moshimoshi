export const strings = {
  reviewDashboard: {
    title: 'Pannello di Revisione',
    description: 'Traccia i tuoi progressi di apprendimento e il programma di revisione',
    subtitle: 'Traccia i tuoi progressi di apprendimento e il programma di revisione',
    loading: 'Caricamento del pannello di revisione...',
    tabs: {
      overview: 'Panoramica',
      studied: 'Studiato',
      learned: 'Imparato',
      queue: 'Coda',
      schedule: 'Programma',
    },
    upcomingReviews: 'Prossime Revisioni',
    overdue: 'In Ritardo',
    thisWeek: 'Questa Settimana',
    noScheduledReviews:
      'Nessuna revisione programmata. Continua a studiare per costruire il tuo programma di revisione!',
    sections: {
      reviewQueue: 'Coda di Revisione',
      upcomingReviews: 'Prossime Revisioni',
      learningProgress: 'Progressi di Apprendimento',
      allStudiedItems: 'Tutti gli Elementi Studiati',
      learnedItems: 'Elementi Imparati',
      masteredItems: 'Padroneggiato',
      inReview: 'In Revisione',
      reviewQueueFull: 'Coda di Revisione - Da Rivedere Ora',
      reviewSchedule: 'Programma di Revisione',
    },
    stats: {
      studied: 'Studiato',
      learned: 'Imparato',
      dueNow: 'Da Rivedere',
      upcoming: 'Prossimi',
    },
    filter: {
      all: 'Tutti',
      kana: 'Kana',
      kanji: 'Kanji',
      vocabulary: 'Vocabolario',
      sentences: 'Frasi',
    },
    actions: {
      startReview: 'Inizia Revisione',
      reviewOverdue: 'Rivedi {{count}} Elementi in Ritardo',
      viewAll: 'Vedi tutto',
      refresh: 'Aggiorna',
    },
    messages: {
      noReviewsDue: 'Nessuna revisione in sospeso. Ottimo lavoro!',
      noUpcoming: 'Nessuna revisione programmata',
      noItemsFiltered: 'Nessun elemento per questo filtro',
      noStudiedItems: 'Nessun elemento studiato finora',
      queueEmpty: 'La tua coda di revisione è vuota!',
      loading: 'Caricamento dati di revisione...',
      loadError: 'Errore nel caricamento dei dati di revisione',
    },
    time: {
      today: 'Oggi',
      tomorrow: 'Domani',
      thisWeek: 'Questa settimana',
    },
    schedule: {
      today: 'Oggi',
      tomorrow: 'Domani',
      thisWeek: 'Questa Settimana',
      later: 'Dopo',
      nextReview: 'Prossima revisione',
      scheduledReviews: 'Revisioni programmate',
    },
    items: 'elementi',
  },

  // Review section
  review: {
    schedule: {
      today: 'Oggi',
      tomorrow: 'Domani',
      thisWeek: 'Questa Settimana',
      later: 'Dopo',
      nextReview: 'Prossima revisione',
      scheduledReviews: 'Revisioni programmate',
    },
    items: 'elementi',
    contentTypes: {
      kana: 'Kana',
      kanji: 'Kanji',
      vocabulary: 'Vocabolario',
      sentence: 'Frase',
    },
    skip: 'Salta',
    showAnswer: 'Mostra risposta',
    modes: {
      recognition: 'Riconoscimento',
      recall: 'Richiamo',
      listening: 'Ascolto',
      writing: 'Scrittura',
      speaking: 'Parlato',
    },
    // Kanji-specific
    kanji: {
      writeKanjiFor: 'Scrivi il kanji per:',
      strokeCount: '{{count}} tratti',
      grade: 'Grado {{grade}}',
      frequency: 'Frequenza #{{rank}}',
    },
    // Confidence
    confidence: 'Confidenza',
    confidenceHelp: "Cos'è la confidenza?",
    confidenceLevel: 'Livello di confidenza',
    confidenceLow: 'Indovinando',
    confidenceMedium: 'Incerto',
    confidenceHigh: 'Sicuro',
    confidenceTooltip: {
      title: 'Quanto sei sicuro?',
      description: 'Regola il cursore per indicare quanto sei sicuro della risposta:',
      high: 'Alto (70-100%): Conosci bene la risposta',
      medium: 'Medio (30-70%): Sei abbastanza sicuro',
      low: 'Basso (0-30%): Stai indovinando',
      tip: 'Questo aiuta il sistema a pianificare meglio le tue revisioni in base alle tue conoscenze effettive.',
    },
  },
  // Common/Shared
  common: {
    brand: 'Moshimoshi',
    loading: 'Caricamento...',
    processing: 'Elaborazione...',
    close: 'Chiudi',
    cancel: 'Annulla',
    confirm: 'Conferma',
    save: 'Salva',
    delete: 'Elimina',
    edit: 'Modifica',
    remove: 'Remove',
    back: 'Indietro',
    backTo: 'Torna a',
    gotIt: 'Capito!',
    next: 'Avanti',
    previous: 'Precedente',
    play: 'Riproduci',
    playing: 'In riproduzione',
    stop: 'Ferma',
    sentence: 'Frase',
    submit: 'Invia',
    continue: 'Continua',
    clear: 'Cancella',
    signIn: 'Accedi',
    signUp: 'Registrati',
    signOut: 'Esci',
    logOut: 'Disconnetti',
    email: 'Email',
    filter: 'Filtra',
    filters: 'Filtri',
    actions: 'Azioni',
    display: 'Visualizzazione',
    password: 'Password',
    name: 'Nome',
    or: 'O',
    and: 'e',
    with: 'con',
    free: 'GRATIS',
    premium: 'PREMIUM',
    premiumOnly: 'Solo Premium',
    guest: 'OSPITE',
    creating: 'Creazione...',
    saving: 'Salvataggio...',
    upgrade: 'Aggiorna',
    today: 'Oggi',
    yesterday: 'Ieri',
    theme: 'Tema',
    complete: 'Completo',
    completed: 'Completato',
    correct: 'Corretto',
    incorrect: 'Sbagliato',
    explore: 'Esplora',
    days: 'giorni',
    minutes: 'minuti',
    cards: 'carte',
  },

  // Landing Page
  landing: {
    header: {
      navigation: {
        about: 'Chi siamo',
        pricing: 'Prezzi',
        signIn: 'Accedi',
      },
    },
    hero: {
      badge: 'GRATIS!',
      title: 'Impara il giapponese',
      subtitle: 'In modo divertente!',
      description:
        "Padroneggia hiragana, katakana e kanji con lezioni brevi e ripetizione spaziata che fa sì che l'apprendimento rimanga!",
      primaryCta: 'Inizia ad imparare ora',
      secondaryCta: 'Ho già un account',
    },
    mascots: {
      sakura: 'Sakura',
      matcha: 'Matcha',
      fuji: 'Fuji',
      torii: 'Torii',
    },
    features: {
      personalizedLearning: {
        title: 'Apprendimento personalizzato',
        description: "Le lezioni basate sull'IA si adattano al tuo ritmo e stile di apprendimento",
      },
      stayMotivated: {
        title: 'Rimani motivato',
        description: 'Guadagna XP, mantieni serie e sblocca risultati',
      },
      smartReview: {
        title: 'Sistema di ripasso intelligente',
        description: "L'algoritmo SRS garantisce che tu ripeta al momento perfetto",
      },
    },
    stats: {
      title: 'Unisciti a migliaia di studenti di giapponese!',
      activeLearners: {
        number: '5M+',
        label: 'Studenti attivi',
      },
      lessons: {
        number: '10K+',
        label: 'Lezioni',
      },
      successRate: {
        number: '95%',
        label: 'Tasso di successo',
      },
    },
    progressPreview: {
      title: 'Il tuo percorso di apprendimento',
      stage1: {
        title: 'Hiragana e Katakana',
        description: 'Padroneggia le basi in 2 settimane',
      },
      stage2: {
        title: 'Kanji essenziali',
        description: 'Impara più di 100 kanji di base con mnemonici',
      },
      stage3: {
        title: 'Kanji avanzati',
        description: 'Padroneggia più di 1000 kanji per la fluenza',
      },
    },
    finalCta: {
      title: 'Pronto per iniziare il tuo viaggio?',
      description: 'È gratis, divertente e richiede solo 5 minuti al giorno!',
      buttonText: 'Inizia il mio viaggio gratuito',
    },
  },

  // Dashboard
  dashboard: {
    loading: 'Caricamento della dashboard...',
    greeting: {
      morning: 'Buongiorno',
      afternoon: 'Buon pomeriggio',
      evening: 'Buonasera',
    },
    stats: {
      streak: 'Serie',
      days: 'giorni',
      xpEarned: 'XP Guadagnati',
      points: 'punti',
      progress: 'Progresso',
      achievements: 'Risultati',
      recent: 'recenti',
    },
    greetings: {
      morning: {
        japanese: 'おはよう',
        english: 'Buongiorno',
      },
      afternoon: {
        japanese: 'こんにちは',
        english: 'Buon pomeriggio',
      },
      evening: {
        japanese: 'こんばんは',
        english: 'Buonasera',
      },
    },
    navigation: {
      userMenuAria: 'Menu utente',
      account: 'Account',
      adminDashboard: 'Dashboard amministratore',
      backToDashboard: '← Torna alla dashboard',
    },
    welcome: {
      firstVisit:
        'Benvenuto nella tua avventura di apprendimento del giapponese! Doshi è qui per guidarti.',
      returning: 'Pronto a continuare il tuo viaggio? La tua dedizione è stimolante!',
      signoutToast: 'Sayonara! A presto! 👋',
      doshiClick: 'Doshi dice: がんばって! (Buona fortuna!)',
    },
    progress: {
      dailyGoal: {
        title: 'Obiettivo giornaliero',
        tooltip: 'Completa 30 minuti di studio ogni giorno',
        progressLabel: 'Progresso',
        encouragement: 'Continua! Sei al {{percentage}}%!',
      },
      achievement: {
        title: 'Ultimo risultato',
        earnedTime: 'Guadagnato {{time}} fa',
      },
    },
    account: {
      title: 'Dettagli account',
      upgradeTooltip: 'Passa a Premium per lezioni illimitate!',
      upgradeLink: 'Aggiorna →',
      fields: {
        email: 'Email',
        memberSince: 'Membro dal',
        emailStatus: 'Stato email',
      },
      emailStatusValues: {
        verified: '✓ Verificato',
        pending: '⚠ In attesa di verifica',
      },
      defaultMemberSince: 'Iscritto di recente',
    },
    developer: {
      modeTitle: 'Modalità sviluppatore',
      authTestLink: '→ Pagina test autenticazione',
    },
    statModals: {
      close: 'Capito!',
      formulaLabel: 'Formula',
      breakdownLabel: 'Dettagli',
      howToImproveLabel: 'Come migliorare',
      availableBonusesLabel: 'Bonus disponibili',
      masteryLevelsLabel: 'Livelli di padronanza',
      proTipLabel: 'Consiglio da professionista',
      streak: {
        title: 'Serie Giornaliera',
        description:
          'La tua serie mostra quanti giorni consecutivi hai praticato il giapponese con impegno significativo.',
        formula: 'Giorni consecutivi con ≥10 XP guadagnati',
        whatItMeans:
          'Ogni giorno in cui guadagni almeno 10 XP (completando 1+ risposte corrette in un esercizio), la tua serie aumenta di 1. Più sessioni nello stesso giorno non aumentano ulteriormente la tua serie.',
        howToImprove:
          'Pratica ogni giorno! Anche una breve sessione di 5 minuti conta. Imposta un promemoria quotidiano e rendi la pratica del giapponese parte della tua routine.',
        breakdown: {
          current: 'Serie attuale',
          longest: 'Serie più lunga (di sempre)',
          lastActive: 'Ultima attività',
          minXP: 'XP minimo richiesto al giorno',
        },
        goalNote:
          'Costruisci una serie di 7 giorni per sviluppare una forte abitudine di apprendimento!',
      },
      xpEarned: {
        title: 'XP Guadagnati',
        description:
          'I Punti Esperienza (XP) misurano la tua attività di apprendimento e i tuoi risultati. Gli XP sono guadagnati attraverso sessioni di pratica con bonus di precisione e velocità.',
        formula: 'XP base + Bonus Precisione + Bonus Velocità + Bonus Serie',
        whatItMeans:
          'Ogni risposta corretta guadagna XP base (10 punti). Alta precisione (≥90%) e risposte rapide possono raddoppiare i tuoi XP attraverso i bonus!',
        howToImprove:
          'Concentrati prima sulla precisione, poi sulla velocità! Completa sessioni di esercizi complete, mantieni alta precisione e costruisci serie per massimizzare gli XP.',
        breakdown: {
          total: 'XP totali guadagnati',
          currentLevel: 'Livello attuale',
          nextLevel: 'XP al prossimo livello',
          dailyCap: 'Limite XP giornaliero',
        },
        bonuses: {
          accuracy: 'Bonus precisione (≥90%): 2x XP',
          speed: 'Bonus velocità (<2s media): +10 XP',
          streak: 'Bonus serie (≥5): +3 XP per elemento',
        },
        goalNote:
          'Gli XP giornalieri sono limitati a 500 per incoraggiare una pratica equilibrata e sostenibile.',
      },
      achievementProgress: {
        title: 'Progresso Risultati',
        description:
          'Traccia il tuo viaggio sbloccando risultati mentre impari e pratichi il giapponese.',
        formula: '(Sbloccati / Totale) × 100',
        whatItMeans:
          'Questa percentuale mostra quanti risultati hai guadagnato sul totale disponibile.',
        howToImprove:
          'Completa esercizi, mantieni serie giornaliere e pratica regolarmente per sbloccare più risultati.',
        breakdown: {
          unlocked: 'Risultati sbloccati',
          total: 'Totale disponibile',
          completion: 'Tasso di completamento',
        },
      },
      achievements: {
        title: 'Risultati Sbloccati',
        description:
          'I risultati sono ricompense per aver raggiunto traguardi nel tuo percorso di apprendimento. Ogni risultato rappresenta un risultato specifico.',
        formula: 'Conteggio dei risultati sbloccati',
        whatItMeans:
          'Il numero totale di risultati che hai guadagnato attraverso la tua pratica e dedizione.',
        howToImprove:
          'Continua a praticare! Completa esercizi, mantieni serie, raggiungi obiettivi di precisione e pratica in momenti diversi per sbloccare tutti i 10 risultati.',
        breakdown: {
          unlocked: 'Attualmente sbloccati',
          available: 'Totale disponibile',
          earnMore: 'Come guadagnarne di più',
        },
        tips: 'Prova Mattiniero (pratica prima delle 6 del mattino) o Nottambulo (pratica dopo le 22) per risultati facili!',
      },
      drillsCompleted: {
        title: 'Esercizi Completati',
        description:
          'Ogni sessione di esercizi che completi aiuta a costruire le tue abilità di coniugazione giapponese. La qualità conta più della quantità!',
        formula: 'Totale sessioni di esercizi completate',
        whatItMeans:
          'Il numero di sessioni di esercizi complete che hai terminato, indipendentemente dal punteggio.',
        howToImprove:
          'Pratica regolarmente! Ogni sessione conta per il tuo totale e aiuta a costruire la memoria muscolare per le coniugazioni.',
        breakdown: {
          total: 'Esercizi totali',
          perfect: 'Esercizi perfetti (100%)',
          types: 'Tipi di pratica',
        },
      },
      drillAccuracy: {
        title: 'Precisione Esercizi',
        description:
          'La tua precisione riflette quanto bene comprendi le coniugazioni verbali giapponesi in tutte le tue sessioni di pratica.',
        formula: '(Risposte corrette / Risposte totali) × 100',
        whatItMeans:
          'La percentuale di domande a cui hai risposto correttamente in TUTTI gli esercizi. È calcolata cumulativamente, quindi i miglioramenti recenti aumenteranno gradualmente il tuo punteggio complessivo.',
        example:
          'Esempio: Se hai ottenuto 12 risposte corrette su 15 totali, la tua precisione è 80%.',
        howToImprove:
          'Concentrati sulla comprensione dei modelli! Rivedi le regole di coniugazione, prenditi il tuo tempo con ogni domanda e pratica costantemente.',
        breakdown: {
          current: 'Precisione attuale',
          total: 'Esercizi totali completati',
          goal: 'Obiettivo di precisione',
        },
        goalNote: 'Punta a 80% o più per mostrare una forte comprensione!',
      },
      drillMastery: {
        title: 'Punteggio Padronanza Esercizi',
        description:
          'La padronanza è un punteggio di qualità completo (0-100) che misura non solo quanto pratichi, ma quanto bene pratichi.',
        formula: 'Calcolo ponderato a 4 fattori',
        whatItMeans:
          'Questo punteggio combina volume, precisione, coerenza e rapporto di esercizi perfetti per darti un quadro completo del tuo livello di padronanza.',
        factors: 'I quattro fattori',
        howToImprove:
          "L'equilibrio è la chiave! Pratica regolarmente (volume), concentrati sulla precisione, punta a sessioni perfette e mantieni la coerenza.",
        breakdown: {
          volume: 'Volume (max 30 pts)',
          volumeDetail: 'Basato su esercizi totali completati',
          accuracy: 'Precisione (max 40 pts)',
          accuracyDetail: 'Basato sulla tua % corretta',
          perfectRatio: 'Rapporto Perfetto (20 pts)',
          perfectDetail: 'Sessioni 100% precise',
          consistency: 'Coerenza (10 pts)',
          consistencyDetail: 'Modello di pratica regolare',
          total: 'Punteggio Padronanza Totale',
        },
        masterLevels: {
          beginner: '0-30: Principiante - Continua a praticare!',
          developing: '31-60: In sviluppo - Stai migliorando!',
          proficient: '61-80: Competente - Ottimo lavoro!',
          expert: '81-100: Esperto - Eccezionale!',
        },
      },
      learningProgress: {
        title: 'Progresso di Apprendimento',
        description:
          'Il tuo progresso complessivo in tutte le categorie di apprendimento (esercizi, kana, kanji, vocabulario).',
        formula: '(Elementi padroneggiati / Elementi iniziati) × 100',
        whatItMeans:
          'Questo mostra la qualità del tuo apprendimento, non solo la quantità. Solo gli elementi che hai effettivamente praticato contano per il tuo progresso.',
        howToImprove:
          'Padroneggia ciò che hai iniziato! Concentrati sul portare gli elementi incompleti alla padronanza prima di iniziarne di nuovi.',
        breakdown: {
          percentage: 'Progresso complessivo',
          categoriesStarted: 'Categorie attive',
          itemsMastered: 'Elementi padroneggiati',
        },
      },
      videosPracticed: {
        title: 'Video Praticati',
        description:
          'Il numero totale di video YouTube unici a cui hai avuto accesso per la pratica dello shadowing.',
        formula: 'Conteggio dei video unici caricati',
        whatItMeans:
          'Ogni nuovo video che carichi per la pratica dello shadowing conta per questo totale. Rivedere lo stesso video non aumenta il conteggio.',
        howToImprove:
          'Esplora video diversi per praticare con vari parlanti, argomenti e modelli di discorso!',
        breakdown: {
          total: 'Totale video consultati',
          thisWeek: 'Video questa settimana',
          quotaInfo: 'Informazioni sulla quota',
        },
        goalNote: "Praticare con contenuti diversi migliora la tua comprensione all'ascolto!",
      },
      videosRemaining: {
        title: 'Video Rimanenti',
        description:
          'Il numero di nuovi video che puoi caricare oggi in base alla tua quota giornaliera.',
        formula: 'Limite giornaliero − Video caricati oggi',
        whatItMeans:
          'La tua quota giornaliera si azzera a mezzanotte UTC. I video precedentemente consultati possono essere praticati illimitatamente senza usare la quota.',
        howToImprove:
          'Passa a Premium per 20 video al giorno, o rivedi i tuoi video preferiti per una pratica illimitata gratuita!',
        breakdown: {
          remaining: 'Rimanenti oggi',
          limit: 'Limite giornaliero',
          used: 'Usati oggi',
          resetTime: 'Si azzera alle',
        },
        goalNote:
          'Gli utenti gratuiti ottengono 3 nuovi video al giorno, gli utenti Premium ne ottengono 20!',
      },
      watchTime: {
        title: 'Tempo di Visione',
        description:
          'Il tempo totale che hai trascorso praticando attivamente con i video di shadowing di YouTube.',
        formula: 'Somma di tutte le durate delle sessioni di pratica',
        whatItMeans:
          'Il tempo viene tracciato durante le sessioni di pratica effettive. Questo misura il tuo impegno costante con la pratica dello shadowing.',
        howToImprove:
          'Pratica regolarmente! Anche 10-15 minuti al giorno costruiscono forti abilità di ascolto e pronuncia.',
        breakdown: {
          total: 'Tempo di visione totale',
          thisWeek: 'Questa settimana',
          thisMonth: 'Questo mese',
          avgPerSession: 'Media per sessione',
        },
        goalNote: 'Mira ad almeno 30 minuti di pratica dello shadowing a settimana!',
      },
    },
    villageHeader: {
      welcomeTo: 'BENVENUTO AL',
      learningVillage: "VILLAGGIO DELL'APPRENDIMENTO",
      editLayout: 'Modifica Layout',
    },
    learningVillage: {
      title: "Benvenuto al Villaggio dell'Apprendimento",
      subtitle: 'Scegli il tuo percorso verso la padronanza del giapponese',
      clickToStart: 'Clicca su qualsiasi bancarella per iniziare il tuo viaggio!',
    },
    districts: {
      foundation: 'Piazza dei Principianti',
      study: 'Centro Studi',
      immersion: "Vicolo dell'Immersione",
      play: 'Quartiere dei Divertimenti',
      community: 'Municipio',
    },
    cards: {
      hiragana: {
        title: 'Hiragana',
        subtitle: 'ひらがな',
        description: 'Padroneggia la scrittura fluida',
      },
      katakana: {
        title: 'Katakana',
        subtitle: 'カタカナ',
        description: 'Caratteri netti e angolari',
      },
      kanji: {
        title: 'Kanji',
        subtitle: '漢字',
        description: 'Antichi caratteri cinesi',
      },
      vocabulary: {
        title: 'Vocabulary',
        subtitle: '単語',
        description: 'Costruisci il tuo vocabolario',
      },
      grammar: {
        title: 'Grammar',
        subtitle: '文法',
        description: 'Impara la struttura delle frasi',
      },
      particles: {
        title: 'Particles',
        subtitle: '助詞',
        description: 'Collega le tue parole',
      },
      listening: {
        title: 'Listening',
        subtitle: '聴解',
        description: 'Allena il tuo orecchio',
      },
      speaking: {
        title: 'Speaking',
        subtitle: '会話',
        description: 'Trova la tua voce',
      },
      reading: {
        title: 'Reading',
        subtitle: '読解',
        description: 'Decodifica la parola scritta',
      },
      writing: {
        title: 'Writing',
        subtitle: '作文',
        description: 'Esprimi te stesso nel testo',
      },
      culture: {
        title: 'Culture',
        subtitle: '文化',
        description: 'Comprendi il Giappone profondamente',
      },
      business: {
        title: 'Business',
        subtitle: 'ビジネス',
        description: 'Giapponese professionale',
      },
      travel: {
        title: 'Travel',
        subtitle: '旅行',
        description: 'Naviga in Giappone con facilità',
      },
      food: {
        title: 'Food & Dining',
        subtitle: '料理',
        description: 'Ordina come un locale',
      },
      anime: {
        title: 'Anime & Manga',
        subtitle: 'アニメ',
        description: 'Impara dai tuoi preferiti',
      },
      games: {
        title: 'Games',
        subtitle: 'ゲーム',
        description: 'Impara attraverso il gioco',
      },
      music: {
        title: 'Music',
        subtitle: '音楽',
        description: 'Impara attraverso le canzoni',
      },
      news: {
        title: 'News',
        subtitle: 'ニュース',
        description: 'Eventi attuali in giapponese',
      },
      jlpt: {
        title: 'JLPT',
        subtitle: 'Prep JLPT',
        description: 'Supera il tuo test di competenza',
      },
      library: {
        title: 'Biblioteca',
        subtitle: '図書館',
        description: 'Leggere libri condensati',
      },
      drill: {
        title: 'Esercizi',
        subtitle: 'ドリル',
        description: 'Esercizi rapidi',
      },
      youtubeSeries: {
        title: 'Serie YouTube',
        subtitle: 'シリーズ',
        description: 'Segui canali YouTube',
      },
      blog: {
        title: 'Blog',
        subtitle: 'ブログ',
        description: 'Leggi articoli e aggiornamenti',
      },
      resources: {
        title: 'Risorse',
        subtitle: 'リソース',
        description: 'Risorse di apprendimento',
      },
      achievements: {
        title: 'Risultati',
        subtitle: '成果',
        description: 'Traccia i tuoi progressi',
      },
      todos: {
        title: 'Gestione Attività',
        subtitle: 'タスク管理',
        description: 'Organizza i tuoi compiti e obiettivi di studio',
      },
      favourites: {
        title: 'I Miei Preferiti',
        subtitle: 'Salvati',
        description: 'Rivedi elementi salvati',
      },
      myLists: {
        title: 'Le Mie Liste',
        subtitle: 'Liste personali',
        description: 'Gestisci liste personalizzate',
      },
      // Anki Import
      anki: {
        importTitle: 'Import Anki Deck',
        importSuccess: 'Import Successful!',
        import: 'Import',
        importing: 'Importing...',
        cardsImported: '{{count}} cards imported successfully',
        dropFile: 'Drop your .apkg file here',
        orBrowse: 'or click to browse',
        maxFileSize: 'Maximum file size: 200MB',
        invalidFile: 'Please select a valid .apkg file',
        importFailed: 'Failed to import deck',
        processing: 'Processing...',
        description: 'Import your Anki decks and review them using the Universal Review Engine',
        importButton: 'Import Anki Deck (.apkg)',
        mediaCache: 'Media Cache',
        clearCache: 'Clear Cache',
        confirmClearCache: 'Are you sure you want to clear all cached media files?',
        importedDecks: 'Imported Decks',
        removeDeck: 'Remove deck',
        sampleCards: 'Sample Cards',
        front: 'Front',
        back: 'Back',
        startReview: 'Start Review Session',
        noDecksYet: 'No decks imported yet',
        noDecksDescription: 'Click the button above to import your first Anki deck',
        cards: 'cards',
        mediaFiles: 'media files',
        filesCount: '{{count}} files',
        sizeInMB: '{{size}} MB',
      },

      myVideos: {
        title: 'I Miei Video',
        subtitle: 'Video',
        description: 'I tuoi video salvati',
      },
      flashcards: {
        title: 'Flashcard',
        subtitle: 'Schede',
        description: 'Crea e studia mazzi di flashcard',
      },
    },
    achievements: {
      title: 'Risultati',
      unlocked: 'sbloccati',
      points: 'punti',
      complete: 'completato',
      categories: {
        all: 'Tutti',
        progress: 'Progresso',
        streak: 'Serie',
        accuracy: 'Precisione',
        speed: 'Velocità',
        special: 'Speciale',
      },
      latest: 'Ultimo Risultato',
      tabs: {
        overview: 'Panoramica',
        progress: 'Progresso',
        insights: 'Analisi',
      },
      stats: '{{unlocked}}/{{total}} sbloccati • {{points}} punti • {{percent}}% completato',
      latestAchievement: 'Ultimo Risultato',
      readyToStart: 'Pronto per iniziare!',
      firstLesson: 'Completa la tua prima lezione per guadagnare risultati',
      yourJourney: 'Il tuo viaggio inizia ora',
    },
    dailyGoal: {
      title: 'Obiettivo Giornaliero',
      progress: 'Progresso',
      minutes: '{{min}}/30 min',
      startPractice: 'Inizia la tua pratica quotidiana per raggiungere il tuo obiettivo!',
    },
    accountDetails: {
      title: 'Dettagli Account',
      email: 'Email',
      emailStatus: 'Stato Email',
      verified: 'Verificato',
      memberSince: 'Membro dal',
      recentlyJoined: 'Iscritto di recente',
      upgrade: 'Aggiorna',
    },
    developerMode: 'Modalità Sviluppatore',
    authTestPage: 'Pagina Test Autenticazione',
  },

  // Auth Pages
  auth: {
    signin: {
      branding: {
        logoText: 'も',
      },
      page: {
        title: 'Bentornato!',
        subtitle: 'Accedi per continuare ad imparare il giapponese',
      },
      form: {
        labels: {
          email: 'Email',
          password: 'Password',
        },
        placeholders: {
          email: 'tu@example.com',
          password: '••••••••',
        },
        checkbox: 'Ricordami',
        submitButton: {
          default: 'Accedi',
          loading: 'Accesso in corso...',
        },
      },
      links: {
        forgotPassword: 'Password dimenticata?',
        signupLink: 'Non hai un account? Registrati gratis',
      },
      alternativeAuth: {
        divider: 'O continua con',
        magicLinkButton: 'Invia link magico',
        googleButton: 'Continua con Google',
      },
      messages: {
        signupSuccess: 'Account creato! Accedi ora.',
        signinSuccess: 'Bentornato!',
        magicLinkError: 'Inserisci il tuo indirizzo email per continuare.',
        magicLinkSuccess: 'Controlla la tua email per il link magico!',
      },
      errors: {
        signinFailed: 'Accesso fallito',
        sessionCreationFailed: 'Creazione sessione fallita',
        magicLinkFailed: 'Invio link magico fallito',
        firebaseNotInitialized: 'Firebase non inizializzato',
      },
    },
    signup: {
      page: {
        title: 'Inizia il tuo viaggio',
        subtitle: 'Crea un account gratuito per imparare il giapponese',
      },
      form: {
        labels: {
          name: 'Nome (opzionale)',
          email: 'Email',
          password: 'Password',
        },
        placeholders: {
          name: 'Il tuo nome',
          email: 'tu@example.com',
          password: '••••••••',
        },
        passwordRequirements: 'Almeno 8 caratteri con 1 maiuscola, 1 numero e 1 carattere speciale',
        termsAgreement: 'Accetto i {{terms}} e la {{privacy}}',
        termsLink: 'Termini di servizio',
        privacyLink: 'Privacy policy',
        submitButton: {
          default: 'Crea account gratuito',
          loading: 'Creazione account...',
        },
      },
      links: {
        signinLink: 'Hai già un account? Accedi',
      },
      alternativeAuth: {
        divider: 'O registrati con',
        magicLinkButton: 'Registrati con link magico',
        googleButton: 'Continua con Google',
      },
      magicLink: {
        title: 'Registrazione con link magico',
        subtitle: 'Ti invieremo un link per accedere istantaneamente',
        sendButton: 'Invia link magico',
        sending: 'Invio in corso...',
        backButton: 'Torna alla registrazione normale',
        successTitle: 'Controlla la tua email!',
        successMessage: 'Abbiamo inviato un link magico a',
        successDescription: "Clicca sul link nell'email per accedere.",
        tryDifferentMethod: 'Prova un metodo diverso',
      },
      messages: {
        signupSuccess: 'Account creato con successo! Ora puoi accedere.',
        googleNewUser:
          'Benvenuto su Moshimoshi! Iniziamo il tuo viaggio di apprendimento del giapponese!',
        googleExistingUser: 'Bentornato!',
        magicLinkSent: 'Link magico inviato! Controlla la tua email per accedere.',
      },
      errors: {
        signupFailed: 'Registrazione fallita',
        sessionCreationFailed: 'Creazione sessione fallita',
        firebaseNotInitialized: 'Firebase non inizializzato',
        magicLinkFailed: 'Invio del link magico fallito',
      },
    },
  },

  // Admin Dashboard
  admin: {
    pageTitle: 'Panoramica dashboard',
    pageDescription: 'Bentornato! Ecco cosa succede con Moshimoshi oggi.',
    loading: 'Caricamento dashboard amministratore...',
    errorMessages: {
      loadingError: 'Errore caricamento dashboard:',
      fetchError: 'Recupero statistiche fallito',
      generalError: 'Si è verificato un errore',
    },
    statCards: {
      totalUsers: 'Utenti totali',
      activeToday: 'Attivi oggi',
      newUsersToday: 'Nuovi utenti oggi',
      activeSubscriptions: 'Abbonamenti attivi',
      monthlyRevenue: 'Entrate mensili',
      trialUsers: 'Utenti in prova',
      totalLessons: 'Lezioni totali',
      completedToday: 'Completate oggi',
    },
    youtubeSeries: {
      title: 'Gestione serie YouTube',
      description: 'Gestisci canali YouTube e serie video per contenuti di apprendimento',
      channels: 'Canali YouTube',
      totalChannels: 'Totale canali',
      totalVideos: 'Totale video',
      addChannel: 'Aggiungi canale',
      syncVideos: 'Sincronizza video',
      syncing: 'Sincronizzazione...',
      lastSync: 'Ultima sincronizzazione',
      videoCount: '{{count}} video',
      monitoringEnabled: 'Monitoraggio attivo',
      monitoringDisabled: 'Monitoraggio disattivato',
      deleteChannel: 'Elimina canale',
      confirmDelete: 'Sei sicuro di voler eliminare questo canale?',
      channelUrl: 'URL del canale o del video',
      channelUrlPlaceholder: 'https://www.youtube.com/@channelname o URL del video',
      fetchingInfo: 'Recupero informazioni canale...',
      addChannelButton: 'Aggiungi canale',
      settings: 'Impostazioni',
      enableMonitoring: 'Abilita monitoraggio automatico',
      checkInterval: 'Intervallo di controllo (ore)',
      resourceGeneration: 'Generazione risorse',
      autoGenerate: 'Genera automaticamente risorse di apprendimento',
      includeTranscripts: 'Includi trascrizioni',
      generateQuizzes: 'Genera quiz',
      generateVocabulary: 'Genera liste di vocaboli',
      errors: {
        fetchFailed: 'Recupero informazioni canale fallito',
        addFailed: 'Aggiunta canale fallita',
        syncFailed: 'Sincronizzazione video fallita',
        deleteFailed: 'Eliminazione canale fallita',
        loadFailed: 'Caricamento canali fallito',
        invalidUrl: 'Inserisci un URL valido di canale o video YouTube',
        channelExists: 'Questo canale è già stato aggiunto',
      },
      success: {
        channelAdded: 'Canale aggiunto con successo',
        syncComplete: 'Video sincronizzati con successo',
        channelDeleted: 'Canale eliminato con successo',
        settingsUpdated: 'Impostazioni aggiornate con successo',
      },
      empty: {
        noChannels: 'Nessun canale YouTube aggiunto',
        addFirst: 'Aggiungi il tuo primo canale per iniziare a importare video',
      },
      stats: {
        videosAdded: '{{added}} video aggiunti',
        videosUpdated: '{{updated}} video aggiornati',
        totalProcessed: '{{total}} video elaborati',
      },
    },
    sections: {
      quickActions: 'Azioni rapide',
      recentUsers: 'Utenti recenti',
      systemStatus: 'Stato sistema',
      newsScraping: 'Raccolta notizie',
    },
    quickActionButtons: {
      moodBoards: 'Mood Board',
      users: 'Utenti',
      content: 'Contenuti',
      analytics: 'Analisi',
    },
    systemMetrics: {
      database: 'Database',
      operational: 'Operativo',
      apiResponseTime: 'Tempo risposta API',
      cacheHitRate: 'Percentuale cache',
      errorRate: 'Tasso errori',
      uptime: 'Tempo attività',
    },
    userLabels: {
      user: 'Utente',
      noRecentUsers: 'Nessun utente recente',
      daysAgo: '{{days}}g fa',
      hoursAgo: '{{hours}}h fa',
      minutesAgo: '{{minutes}} min fa',
      justNow: 'Proprio ora',
    },
    newsScraping: {
      nhkEasy: 'NHK Easy',
      nhkSchedule: 'Ogni 4 ore',
      watanoc: 'Watanoc',
      watanocSchedule: 'Ogni 6 ore',
      mainichiShogakusei: 'Mainichi Shogakusei',
      mainichiSchedule: 'Giornaliero alle 10:00',
      scrapingArticles: 'Raccolta articoli...',
    },
    resources: {
      title: 'Risorse',
      description: 'Gestisci post del blog e risorse di apprendimento',
      newResource: 'Nuova Risorsa',
      searchResources: 'Cerca risorse...',
      allStatus: 'Tutti gli stati',
      published: 'Pubblicato',
      draft: 'Bozza',
      scheduled: 'Programmato',
      selected: 'selezionato/i',
      deleteSelected: 'Elimina selezionati',
      clearSelection: 'Cancella selezione',
      loadingResources: 'Caricamento risorse...',
      noResourcesFound: 'Nessuna risorsa trovata',
      noResourcesMatching: 'Nessuna risorsa corrisponde alla ricerca',
      selectAll: 'Seleziona tutto',
      featured: 'In evidenza',
      uncategorized: 'Non categorizzato',
      views: 'visualizzazioni',
      edit: 'Modifica',
      view: 'Visualizza',
      delete: 'Elimina',
      actions: 'Azioni',
      status: 'Stato',
      category: 'Categoria',
      updated: 'Aggiornato',
      totalPosts: 'Post totali',
      totalViews: 'Visualizzazioni totali',
      deleteResource: 'Elimina risorsa',
      deleteResourceConfirm:
        'Sei sicuro di voler eliminare questa risorsa? Questa azione non può essere annullata.',
      deleteResources: 'Elimina risorse',
      deleteResourcesConfirm:
        'Sei sicuro di voler eliminare {count} risorse? Questa azione non può essere annullata.',
      error: 'Errore',
      failedToDelete: 'Impossibile eliminare la risorsa',
      failedToDeleteSome: 'Impossibile eliminare alcune risorse',
      createResource: 'Crea risorsa',
      editResource: 'Modifica risorsa',
      basicInfo: 'Informazioni di base',
      content: 'Contenuto',
      publishingOptions: 'Opzioni di pubblicazione',
      seo: 'SEO',
      featuredImage: 'Immagine in evidenza',
      tags: 'Tag',
      addTag: 'Aggiungi tag',
      removeTag: 'Rimuovi tag',
      uploadImage: 'Carica immagine',
      imageUrl: 'URL immagine',
      imageAlt: 'Testo alternativo immagine',
      readingTime: 'Tempo di lettura',
      minRead: 'min di lettura',
      quickCreate: 'Creazione rapida da URL',
      preview: 'Anteprima',
      cancel: 'Annulla',
      save: 'Salva',
      create: 'Crea',
      update: 'Aggiorna',
      required: 'Richiesto',
      optional: 'Opzionale',
    },
  },

  // Account Page
  account: {
    pageTitle: 'アカウント',
    pageDescription: 'Gestisci le impostazioni del tuo account',
    loadingMessage: 'Caricamento account...',
    sections: {
      profileInformation: 'Informazioni profilo',
      accountStatistics: 'Statistiche account',
      subscription: 'Abbonamento',
      dangerZone: 'Zona pericolosa',
    },
    profileFields: {
      profilePhoto: 'Foto profilo',
      photoDescription: 'JPG, PNG o GIF. Max 2MB.',
      displayName: 'Nome visualizzato',
      namePlaceholder: 'Inserisci il tuo nome',
      emailAddress: 'Indirizzo email',
      verified: 'Verificato',
      verify: 'Verifica',
    },
    validation: {
      displayNameRequired: 'Il nome visualizzato non può essere vuoto',
      displayNameTooLong: 'Il nome visualizzato deve essere di massimo 50 caratteri',
      displayNameInvalid: 'Il nome visualizzato contiene caratteri non validi',
    },
    buttons: {
      saveChanges: 'Salva modifiche',
      updating: 'Aggiornamento...',
      deleteAccount: 'Elimina account',
      upgradeText: 'Passa a Premium',
      manageSubscription: 'Gestisci abbonamento →',
    },
    statistics: {
      daysActive: 'Giorni attivi',
      wordsLearned: 'Parole imparate',
      achievements: 'Risultati',
      dayStreak: 'Serie giorni',
    },
    subscription: {
      premium: 'PREMIUM',
      free: 'GRATIS',
      plan: 'Piano',
      nextBilling: 'Prossima fatturazione',
      premiumMonthly: 'Premium mensile',
      premiumYearly: 'Premium annuale',
      freePlan: 'Piano gratuito',
      manageSubscription: 'Gestisci abbonamento',
      upgradeToPremium: 'Passa a Premium',
      currentPlan: 'Piano attuale',
      upgradeText: 'Aggiorna per sbloccare sessioni di pratica illimitate e funzionalità premium',
      title: 'Il tuo abbonamento',
      status: 'Stato',
      active: 'Attivo',
      inactive: 'Inattivo',
      canceled: 'Annullato',
      trialEnds: 'La prova termina',
      renews: 'Si rinnova',
      expires: 'Scade',
      managePayment: 'Gestisci pagamento',
      cancelSubscription: 'Annulla abbonamento',
      reactivate: 'Riattiva',
      upgradeOptions: 'Opzioni di aggiornamento',
      choosePlan: 'Scegli il tuo piano',
      recommended: 'Consigliato',
      mostPopular: 'Più popolare',
      bestValue: 'Miglior valore',
      perMonth: '/mese',
      perYear: '/anno',
      billed: 'Fatturato {{amount}} {{period}}',
      monthly: 'mensilmente',
      yearly: 'annualmente',
      features: {
        title: 'Funzionalità incluse',
        unlimited: 'Sessioni di pratica illimitate',
        srs: 'Ripetizione spaziata avanzata',
        offline: 'Modalità offline',
        analytics: 'Analisi dettagliate',
        priority: 'Supporto prioritario',
        customization: 'Personalizzazione del percorso di apprendimento',
        ai: 'Tutor IA personalizzato',
        certificates: 'Certificati di progresso',
      },
      upgrade: {
        title: 'Sblocca il tuo pieno potenziale',
        subtitle: 'Aggiorna a Premium e accelera il tuo percorso di apprendimento del giapponese',
        cta: 'Aggiorna ora',
        processing: 'Elaborazione...',
      },
      invoice: {
        title: 'Cronologia fatture',
        noInvoices: 'Nessuna fattura disponibile ancora',
        date: 'Data',
        description: 'Descrizione',
        amount: 'Importo',
        status: 'Stato',
        actions: 'Azioni',
        download: 'Scarica PDF',
        subscription: 'Abbonamento',
        statuses: {
          paid: 'Pagato',
          open: 'Aperto',
          void: 'Annullato',
          uncollectible: 'Non riscuotibile',
        },
      },
      billing: {
        title: 'Informazioni di fatturazione',
        nextBillingDate: 'Prossima data di fatturazione',
        paymentMethod: 'Metodo di pagamento',
        cardEnding: 'Carta che termina con {{last4}}',
        updatePayment: 'Aggiorna metodo di pagamento',
        billingHistory: 'Cronologia fatturazione',
        downloadInvoice: 'Scarica fattura',
      },
    },
    dangerZone: {
      description:
        'Elimina il tuo account e tutti i dati associati. Questa azione non può essere annullata.',
    },
    deleteAccountDialog: {
      title: 'Eliminare account?',
      message:
        'Sei sicuro di voler eliminare il tuo account? Questo cancellerà permanentemente tutti i tuoi dati inclusi progressi, risultati e abbonamento. Questa azione non può essere annullata.',
      confirmText: 'Sì, elimina il mio account',
      cancelText: 'Annulla',
    },
    toastMessages: {
      profileUpdated: 'Profilo aggiornato con successo!',
      accountDeletionRequested: 'Eliminazione account richiesta. Contatta il supporto.',
    },
  },

  // Statistics Page
  statistics: {
    title: 'Your Statistics',
    subtitle: 'Track your Japanese learning journey',
    daysActive: 'Days Active',
    wordsLearned: 'Words Learned',
    achievements: 'Achievements',
    dayStreak: 'Day Streak',
    xpEarned: 'XP Earned',
    lessonsCompleted: 'Sessions Completed',
    bestStreak: 'Best Streak',
    learningProgress: 'Learning Progress',
    achievementCompletion: 'Achievement Completion',
  },

  // UI Components
  components: {
    alert: {
      dismissAriaLabel: 'Chiudi avviso',
    },
    dialog: {
      defaultConfirm: 'Conferma',
      defaultCancel: 'Annulla',
      processing: 'Elaborazione...',
    },
    doshi: {
      loading: 'Caricamento Doshi...',
      altText: 'Doshi - Il tuo compagno di apprendimento',
      failedToLoad: 'Caricamento animazione panda rosso fallito',
      ariaLabel: '{{alt}} - Clicca per interagire',
      moodAria: 'Doshi è {{mood}}',
    },
    drawer: {
      closeAriaLabel: 'Chiudi cassetto',
    },
    loading: {
      default: 'Caricamento...',
      closeAriaLabel: 'Chiudi',
    },
    modal: {
      closeAriaLabel: 'Chiudi modale',
    },
    theme: {
      lightAriaLabel: 'Tema chiaro',
      systemAriaLabel: 'Tema sistema',
      darkAriaLabel: 'Tema scuro',
    },
    toast: {
      closeAriaLabel: 'Chiudi',
      errorMessage: 'useToast deve essere usato dentro ToastProvider',
    },
  },

  // Error Messages (User-Friendly)
  errors: {
    auth: {
      popupClosed: 'Accesso annullato. Riprova quando sei pronto.',
      networkFailed: 'Problema di connessione. Controlla internet e riprova.',
      tooManyRequests: 'Troppi tentativi. Attendi un momento e riprova.',
      userDisabled: 'Questo account è stato disabilitato. Contatta il supporto.',
      userNotFound: 'Nessun account trovato con questa email. Controlla o registrati.',
      wrongPassword: 'Password errata. Riprova.',
      invalidEmail: 'Inserisci un indirizzo email valido.',
      emailInUse: 'Questa email è già registrata. Accedi invece.',
      weakPassword: 'Scegli una password più forte (almeno 6 caratteri).',
      invalidCredential: 'Credenziali non valide. Controlla e riprova.',
      requiresRecentLogin: 'Accedi di nuovo per completare questa azione.',
      unauthorized: 'Questo dominio non è autorizzato. Contatta il supporto.',
      invalidActionCode: 'Questo link è scaduto o non valido. Richiedine uno nuovo.',
    },
    validation: {
      invalidInput: 'Controlla le tue informazioni e riprova.',
    },
    network: {
      connectionIssue: 'Problema di connessione. Controlla internet.',
      timeout: 'Richiesta scaduta. Riprova.',
      offline: 'Sembri essere offline. Controlla la connessione.',
    },
    payment: {
      authenticationFailure: 'Autenticazione pagamento fallita. Riprova.',
      cardDeclined: 'Carta rifiutata. Prova un altro metodo di pagamento.',
      expiredCard: 'La tua carta è scaduta. Aggiorna le informazioni di pagamento.',
      insufficientFunds: 'Fondi insufficienti. Prova un altro metodo di pagamento.',
      subscriptionRequired: 'Abbonamento Premium richiesto per questa funzione.',
      subscriptionExpired: 'Il tuo abbonamento è scaduto. Rinnova per continuare.',
    },
    permission: {
      denied: 'Non hai il permesso di eseguire questa azione.',
      unauthorized: 'Accedi per continuare.',
      forbidden: 'Accesso negato. Contatta il supporto se pensi sia un errore.',
    },
    resource: {
      notFound: 'Il contenuto richiesto non è stato trovato.',
      exhausted: 'Limite giornaliero raggiunto. Riprova domani.',
      alreadyExists: 'Questo esiste già. Scegli un nome diverso.',
    },
    server: {
      internal: 'Qualcosa è andato storto da parte nostra. Riprova.',
      serverError: 'Errore del server. Il nostro team è stato notificato.',
      unavailable: 'Servizio temporaneamente non disponibile. Riprova più tardi.',
    },
    generic: {
      unknown: 'Si è verificato un errore imprevisto. Riprova.',
      somethingWrong: 'Qualcosa è andato storto. Riprova.',
    },
  },

  // Kana Learning System
  kana: {
    title: 'Hiragana e Katakana',
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    combined: 'Pratica combinata',
    combinedPractice: 'Pratica combinata',

    navigation: {
      backToGrid: 'Torna ai caratteri',
      characters: 'Caratteri',
      nextCharacter: 'Carattere successivo',
      previousCharacter: 'Carattere precedente',
      startStudy: 'Inizia a studiare',
      startReview: 'Inizia ripasso',
      viewAll: 'Vedi tutto',
    },

    categories: {
      all: 'Tutti i caratteri',
      vowels: 'Vocali',
      basic: 'Base',
      dakuten: 'Dakuten',
      handakuten: 'Handakuten',
      digraphs: 'Digrammi',
      special: 'Speciale',
    },

    selectAllInRow: 'Seleziona tutti i {{count}} caratteri in questa riga',

    browse: {
      browseAll: 'Sfoglia tutti i {{count}} caratteri organizzati per tipo',
      selectToStudy: 'Seleziona caratteri da studiare',
      selectToReview: 'Seleziona caratteri da ripassare',
      searchPlaceholder: 'Cerca kana per romaji, carattere...',
      searchResults: 'Risultati della ricerca',
      resultsFound: '{{count}} trovati',
      noResultsFound: 'Nessun carattere trovato corrispondente a "{{query}}"',
      allCharacters: 'Tutti i caratteri',
      charactersLabel: 'caratteri',
      basicLabel: 'Base',
      basicDescription: 'Caratteri base (46)',
      dakutenLabel: 'Dakuten',
      dakutenDescription: 'Consonanti sonore',
      digraphsLabel: 'Digrammi',
      digraphsDescription: 'Caratteri combinati',
    },

    study: {
      studyMode: 'Modalità studio',
      flipCard: 'Tocca per girare',
      showRomaji: 'Mostra Romaji',
      hideRomaji: 'Nascondi Romaji',
      playSound: 'Riproduci suono',
      exampleWords: 'Parole esempio',
      strokeOrder: 'Ordine tratti',
      pinToReview: 'Fissa per ripasso',
      unpinFromReview: 'Rimuovi da ripasso',
      markAsLearned: 'Segna come imparato',
      learned: 'Imparato',
      pronunciation: 'Pronuncia',
    },

    review: {
      reviewMode: 'Modalità ripasso',
      recognition: 'Riconoscimento',
      recall: 'Richiamo',
      listening: 'Ascolto',
      selectAnswer: 'Seleziona la risposta corretta',
      typeAnswer: 'Digita la risposta',
      correct: 'Corretto!',
      incorrect: 'Riprova',
      showAnswer: 'Mostra risposta',
      nextQuestion: 'Prossima domanda',
      skipQuestion: 'Salta',
      endReview: 'Termina ripasso',
      reviewComplete: 'Ripasso completato!',
      accuracy: 'Precisione',
      timeSpent: 'Tempo impiegato',
      itemsReviewed: 'Elementi ripassati',
    },

    progress: {
      learned: 'Imparato',
      learning: 'In apprendimento',
      notStarted: 'Non iniziato',
      mastered: 'Padroneggiato',
      totalProgress: 'Progresso totale',
      charactersMastered: 'Caratteri padroneggiati',
      reviewStreak: 'Serie ripassi',
      lastReviewed: 'Ultimo ripasso',
      nextReview: 'Prossimo ripasso',
    },

    filters: {
      showAll: 'Mostra tutto',
      showLearned: 'Mostra imparati',
      showNotStarted: 'Mostra non iniziati',
      filterByType: 'Filtra per tipo',
      display: 'Visualizza',
      scriptType: 'Tipo di scrittura',
      sortBy: 'Ordina per',
      alphabetical: 'Alfabetico',
      difficulty: 'Difficoltà',
      progress: 'Progresso',
    },

    tooltips: {
      clickToStudy: 'Clicca per studiare questo carattere',
      rightClickToPin: 'Tasto destro per fissare per ripasso',
      dragToReorder: 'Trascina per riordinare',
      progressInfo: 'Hai imparato {{learned}} su {{total}} caratteri',
    },

    messages: {
      loadingCharacters: 'Caricamento caratteri...',
      noCharactersFound: 'Nessun carattere trovato',
      pinnedSuccess: 'Carattere fissato per ripasso',
      unpinnedSuccess: 'Carattere rimosso da ripasso',
      markedAsLearned: 'Carattere segnato come imparato',
      reviewStarting: 'Avvio sessione di ripasso...',
      studyStarting: 'Avvio sessione di studio...',
      progressSaved: 'Progresso salvato',
      audioNotAvailable: 'Audio non disponibile per questo carattere',
    },
  },

  // News Feature
  news: {
    page: 'Pagina',
    filters: {
      title: 'Filtri',
      applied: 'Applicato',
      level: 'Livello',
      source: 'Fonte',
      month: 'Mese',
      day: 'Giorno',
    },
    reader: {
      settings: 'Impostazioni di lettura',
      summary: 'Sommario',
      fontSize: 'Dimensione del testo',
      fontSizes: {
        small: 'P',
        medium: 'M',
        large: 'G',
        xlarge: 'XG',
      },
      showFurigana: 'Mostra furigana',
      withFurigana: 'Con furigana',
      highlightGrammar: 'Evidenzia grammatica',
      highlightAll: 'Tutte le parole',
      highlightContent: 'Parole di contenuto',
      highlightGrammarOnly: 'Solo grammatica',
      shadowingMode: 'Modalità shadowing',
      playbackSpeed: 'Velocità di riproduzione',
      repeatCount: 'Numero di ripetizioni',
      translation: 'Traduzione',
      viewOriginal: 'Visualizza originale',
      lookupWord: 'Fai clic su una parola per vedere la definizione',
      wordNotFound: 'Parola non trovata',
      loading: 'Caricamento definizione...',
      reading: 'Lettura',
      meaning: 'Significato',
      type: 'Tipo',
      saveToList: 'Salva nella lista',
      savedToList: 'Salvato nella lista di studio',
    },
    error: {
      loadFailed: "Impossibile caricare l'articolo",
      notFound: 'Articolo non trovato',
      goBack: 'Torna alla lista delle notizie',
    },
  },

  // Subscription & Entitlements
  subscription: {
    status: {
      active: 'Attivo',
      inactive: 'Inattivo',
      canceled: 'Annullato',
      pastDue: 'Pagamento dovuto',
      trialing: 'Prova',
      incomplete: 'Incompleto',
    },
    plans: {
      free: 'Piano gratuito',
      guest: 'Ospite',
      premiumMonthly: 'Premium mensile',
      premiumYearly: 'Premium annuale',
    },
    badges: {
      mostPopular: 'Più popolare',
      recommended: 'Consigliato',
      bestValue: 'Miglior valore',
    },
    billing: {
      monthly: 'Mensile',
      yearly: 'Annuale',
      perMonth: 'al mese',
      perYear: "all'anno",
      save: 'Risparmia {{percent}}%',
    },
    actions: {
      upgrade: 'Aggiorna a Premium',
      upgradeToPlan: 'Aggiorna a {{plan}}',
      downgrade: 'Passa a piano inferiore',
      manageBilling: 'Gestisci fatturazione',
      manageSubscription: 'Gestisci abbonamento',
      cancelSubscription: 'Annulla abbonamento',
      currentPlan: 'Piano attuale',
      signUpFree: 'Registrati gratis',
      startFreeTrial: 'Inizia prova gratuita',
      upgradeNow: 'Aggiorna ora',
      viewPlans: 'Vedi piani',
      choosePlan: 'Scegli piano',
    },
    features: {
      unlimited: 'Sessioni di pratica illimitate',
      cancelAnytime: 'Cancella in qualsiasi momento',
      bestValue: 'Miglior valore - Risparmia 25%',
      advancedSRS: 'Algoritmo SRS avanzato',
      detailedAnalytics: 'Analisi dettagliate dei progressi',
      prioritySupport: 'Supporto prioritario',
      offlineMode: 'Modalità offline',
      savePercentage: 'Risparmia 25% rispetto al mensile',
      monthsFree: '2 mesi gratuiti',
      earlyAccess: 'Accesso anticipato alle nuove funzionalità',
      personalizedInsights: 'Approfondimenti di apprendimento personalizzati',
    },
    upgrade: {
      selectMonthly: 'Scegli Mensile',
      selectYearly: 'Scegli Annuale',
      title: 'Scegli Il Tuo Piano',
      description: 'Seleziona il piano che funziona meglio per te',
    },
    messages: {
      welcomeToPremium: '🎉 Benvenuto in Premium! Il tuo abbonamento è ora attivo.',
      subscriptionUpdated: 'Il tuo abbonamento è stato aggiornato.',
      subscriptionCanceled: 'Il tuo abbonamento terminerà il {{date}}',
      alreadyOnPlan: 'Sei già su questo piano!',
      alreadySubscribed: 'Sei già abbonato a questo piano!',
      processing: 'Elaborazione...',
      loadingPricing: 'Caricamento prezzi...',
    },
    renewal: {
      nextBilling: 'Prossima fatturazione',
      renews: 'Rinnova',
      ends: 'Termina',
      daysRemaining: '{{days}} giorni rimanenti',
      willEndOn: 'Il tuo abbonamento terminerà il {{date}}',
    },
    checkout: {
      selectPlan: 'Seleziona piano',
      paymentMethod: 'Metodo di pagamento',
      billingInfo: 'Informazioni fatturazione',
      orderSummary: 'Riepilogo ordine',
      total: 'Totale',
      processingPayment: 'Elaborazione pagamento...',
      paymentFailed: 'Pagamento fallito',
      paymentSuccess: 'Pagamento riuscito!',
      success: '🎉 Benvenuto in Premium! Il tuo abbonamento si sta attivando...',
      canceled:
        "Pagamento annullato. Puoi fare l'upgrade in qualsiasi momento dalle impostazioni del tuo account.",
    },
    errors: {
      paymentFailed: 'Pagamento fallito. Riprova con un metodo di pagamento diverso.',
      subscriptionNotFound: 'Abbonamento non trovato.',
      alreadySubscribed: 'Sei già abbonato a questo piano.',
      invalidPlan: 'Piano non valido selezionato.',
      processingError: "Errore durante l'elaborazione. Riprova più tardi.",
      checkoutFailed: 'Impossibile avviare il pagamento. Riprova.',
      billingPortalFailed: 'Impossibile aprire il portale di fatturazione. Riprova.',
      cancelFailed: "Impossibile annullare l'abbonamento. Riprova.",
    },
  },

  // Pricing Comparison
  pricingComparison: {
    badge: 'TUTTE LE FUNZIONALITÀ COMBINATE',
    title: "Un'app, ogni funzionalità",
    subtitle:
      'Perché pagare per più app? Moshimoshi combina tutte le funzionalità premium di cui hai bisogno per il tuo percorso di apprendimento giapponese.',
    tableTitle: 'Confronta il valore',
    priceColumn: 'Prezzo',
    featuresColumn: 'Caratteristiche',
    actionButton: 'Inizia prova gratuita',
    actionSecondary: 'Visualizza tutte le funzionalità',

    moshimoshi: {
      name: 'Moshimoshi',
      price: '£8.99/mese',
      yearlyPrice: '£99.9/anno',
      description: 'Soluzione completa di apprendimento',
      cta: 'Migliore valore',
      features: {
        gamification: 'Gamification & motivazione',
        youtube: 'YouTube shadowing',
        aiStories: 'Storie AI personalizzate',
        kanjiBreakdown: 'Scomposizione Kanji',
        newsReading: 'Lettura notizie',
        ankiExport: 'Esportazione Anki',
        pitchAccent: 'Formazione accento tonale',
        srsReviews: 'Sistema SRS intelligente',
        dictionary: 'Dizionario integrato',
        grammarGuide: 'Guide grammaticali',
        offline: 'Apprendimento offline',
        analytics: 'Analisi dettagliate',
      },
    },

    competitors: {
      duolingo: {
        name: 'Duolingo',
        price: '£47.99/anno',
        features: ['Gamification', 'Lezioni base', 'Tracciamento serie'],
        missing: [
          'YouTube shadowing',
          'Storie AI',
          'Scomposizione Kanji',
          'Lettura notizie',
          'Esportazione Anki',
        ],
      },
      heyjapan: {
        name: 'HeyJapan',
        price: '$33.99-$48.99',
        features: ['Pratica conversazione', 'Riconoscimento vocale', 'Lezioni dal vivo'],
        missing: [
          'YouTube shadowing',
          'Gamification',
          'SRS',
          'Esportazione Anki',
          'Lettura notizie',
        ],
      },
      miraa: {
        name: 'Miraa',
        price: '£5.49/mese',
        features: ['Lettura manga', 'Ricerca dizionario', 'Esportazione Anki'],
        missing: [
          'Storie AI',
          'YouTube shadowing',
          'Gamification',
          'Pratica conversazione',
          'Lezioni grammatica',
        ],
      },
      satoriReader: {
        name: 'Satori Reader',
        price: '£8.49/mese',
        features: ['Articoli graduati', 'Spiegazioni grammaticali', 'Audio'],
        missing: [
          'YouTube shadowing',
          'Storie AI',
          'Gamification',
          'Esportazione Anki',
          'Pratica conversazione',
        ],
      },
      takoboto: {
        name: 'Takoboto',
        price: '£25.49',
        features: ['Dizionario offline', 'Esempi', 'Coniugazioni'],
        missing: [
          'Contenuti di apprendimento',
          'SRS',
          'YouTube shadowing',
          'Storie AI',
          'Gamification',
        ],
      },
      miji: {
        name: 'Miji',
        price: '£27.49/anno',
        features: ['Carte flash', 'Riconoscimento scrittura', 'Pratica kanji'],
        missing: [
          'YouTube shadowing',
          'Storie AI',
          'Lettura notizie',
          'Pratica conversazione',
          'Gamification',
        ],
      },
      lingodeer: {
        name: 'LingoDeer',
        price: '$14.99/mese',
        features: ['Corsi strutturati', 'Spiegazioni grammaticali', 'Pratica', 'Storie'],
        missing: [
          'YouTube shadowing',
          'Storie AI personalizzate',
          'Lettura notizie reali',
          'Esportazione Anki',
          'Dizionario',
        ],
      },
    },

    comparison: {
      hasFeature: '✓',
      missingFeature: '—',
      popularLabel: 'Popolare',
      bestValueLabel: 'Miglior Valore',
      monthlyLabel: '/mese',
      yearlyLabel: '/anno',
      lifetimeLabel: 'Una tantum',
    },
  },

  // Entitlements & Limits
  entitlements: {
    limits: {
      sessionsToday: 'Sessioni {{feature}} oggi',
      sessionsLeft: '{{count}} rimanenti',
      unlimited: 'Illimitato',
      dailyLimit: 'Limite giornaliero',
      resets: 'Si resetta {{time}}',
      resetsTomorrow: 'Si resetta domani',
      resetsIn: 'Si resetta tra {{time}}',
    },
    upgrade: {
      title: 'Sblocca pratica illimitata',
      message: 'Aggiorna a Premium per sessioni giornaliere illimitate e funzioni esclusive.',
      benefits: {
        unlimited: 'Sessioni di pratica illimitate',
        allFeatures: 'Tutte le funzioni sbloccate',
        advancedAnalytics: 'Analisi avanzate',
        prioritySupport: 'Supporto prioritario',
        offlineMode: 'Modalità offline',
      },
      cta: {
        learnMore: 'Scopri di più',
        viewPricing: 'Vedi prezzi',
        upgradeToPremium: 'Aggiorna a Premium',
      },
      inline: {
        title: 'Sblocca funzioni Premium',
        subtitle: 'Accesso illimitato a tutte le funzioni',
        featureLimit: 'Hai raggiunto il limite per {{feature}}',
      },
      plans: {
        monthly: {
          name: 'Premium Mensile',
          interval: 'mese',
        },
        yearly: {
          name: 'Premium Annuale',
          interval: 'anno',
          savings: 'Risparmia il 25%',
        },
      },
      features: {
        unlimited: 'Sessioni di pratica illimitate',
        advancedStats: 'Analisi avanzate dei progressi',
        prioritySupport: 'Supporto clienti prioritario',
        offlineMode: 'Modalità offline completa',
        earlyAccess: 'Accesso anticipato alle nuove funzioni',
      },
      badges: {
        popular: 'Più popolare',
      },
      currentUsage: 'Utilizzo attuale',
      loading: 'Caricamento opzioni di prezzo...',
      upgradeNow: 'Aggiorna ora',
      maybeLater: 'Forse più tardi',
      processing: 'Elaborazione...',
      premiumNote:
        'Unisciti a migliaia di studenti che hanno accelerato il loro percorso giapponese con Premium',
      securePayment: 'Pagamento sicuro tramite Stripe',
    },
    guest: {
      title: 'Crea il tuo account gratuito',
      subtitle: "Iscriviti per sbloccare l'apprendimento personalizzato",
      featureRequiresAccount: '{{feature}} richiede un account',
      benefits: {
        progressTracking: 'Traccia i tuoi progressi',
        progressTrackingDesc: 'Salva la tua cronologia di apprendimento e i traguardi',
        cloudSync: 'Sincronizzazione cloud',
        cloudSyncDesc: 'Accedi ai tuoi dati su tutti i dispositivi',
        unlockFeatures: 'Più funzioni',
        unlockFeaturesDesc: 'Sblocca strumenti di apprendimento aggiuntivi',
        dailyLimits: 'Limiti più alti',
        dailyLimitsDesc: 'Ottieni più sessioni di pratica giornaliere',
      },
      freeAccountNote: 'È completamente gratuito - nessuna carta di credito richiesta',
      createAccount: 'Crea account gratuito',
      signIn: 'Accedi',
      continueAsGuest: 'Continua come ospite',
    },
    messages: {
      limitReached: 'Limite giornaliero raggiunto. Riprova domani.',
      signUpForMore: 'Registrati gratis per ottenere 5 pratiche giornaliere',
      upgradeForUnlimited: 'Aggiorna a Premium per pratica illimitata',
      getUnlimitedAccess: 'Ottieni accesso illimitato con Premium',
      authenticationRequired: 'Autenticazione richiesta',
      featureLimitReached: 'Limite funzione raggiunto',
      upgradeRequired: 'Aggiorna a premium per accesso illimitato',
    },
  },

  // Pricing Page
  pricing: {
    title: 'Scegli il tuo percorso di apprendimento',
    subtitle: 'Sblocca pratica illimitata e accelera la tua padronanza del giapponese',
    loading: 'Caricamento prezzi...',
    mostPopular: 'Più popolare',
    billingToggle: {
      monthly: 'Mensile',
      yearly: 'Annuale',
      savePercent: 'Risparmia {{percent}}%',
    },
    buttons: {
      getStarted: 'Inizia',
      choosePlan: 'Scegli piano',
      currentPlan: 'Piano attuale',
      upgrade: 'Aggiorna',
      startFreeTrial: 'Inizia prova gratuita',
    },
    badges: {
      free: 'Gratis',
      trial: 'Prova gratuita',
      mostPopular: 'Più popolare',
      bestValue: 'Miglior valore',
    },
    features: {
      title: 'Cosa è incluso',
      free: {
        sessions: '5 sessioni di pratica al giorno',
        basicAnalytics: 'Tracciamento progresso base',
        communitySupport: 'Supporto community',
      },
      premium: {
        unlimitedSessions: 'Sessioni di pratica illimitate',
        advancedAnalytics: 'Analisi e approfondimenti avanzati',
        prioritySupport: 'Supporto prioritario',
        offlineMode: 'Modalità offline',
        exclusiveContent: 'Contenuti esclusivi',
        earlyAccess: 'Accesso anticipato a nuove funzioni',
      },
    },
    comparison: {
      title: 'Confronta piani',
      feature: 'Funzione',
      included: 'Incluso',
      notIncluded: '—',
    },
    messages: {
      upgradeSuccess: 'Aggiornamento completato con successo!',
      downgradePending: 'Downgrade programmato per la fine del periodo di fatturazione.',
      trialStarted: 'Prova gratuita iniziata! Goditi le funzioni Premium.',
      subscriptionExpired: 'Il tuo abbonamento è scaduto. Rinnova per continuare con Premium.',
    },
    manageBilling: {
      title: 'Gestisci fatturazione',
      updatePayment: 'Aggiorna metodo di pagamento',
      downloadInvoice: 'Scarica fattura',
      billingHistory: 'Cronologia fatturazione',
      nextPayment: 'Prossimo pagamento: {{date}}',
    },
    trust: {
      secure: 'Pagamento sicuro',
      guarantee: 'Garanzia rimborso 30 giorni',
      support: 'Supporto 24/7',
      noCommitment: 'Nessun impegno',
      cancelAnytime: 'Annulla in qualsiasi momento',
    },
    faq: {
      title: 'Domande frequenti',
      canICancel: {
        question: 'Posso annullare in qualsiasi momento?',
        answer:
          'Sì, puoi annullare il tuo abbonamento in qualsiasi momento. Continuerai ad avere accesso fino alla fine del tuo periodo di fatturazione.',
      },
      whatPaymentMethods: {
        question: 'Quali metodi di pagamento accettate?',
        answer:
          'Accettiamo tutte le principali carte di credito, carte di debito e PayPal attraverso il nostro processore di pagamento sicuro Stripe.',
      },
      isThereATrial: {
        question: "C'è una prova gratuita?",
        answer:
          'I nuovi utenti ottengono 7 giorni di funzioni Premium gratuite. Non è richiesta la carta di credito.',
      },
      canIChangeMyPlan: {
        question: 'Posso cambiare il mio piano?',
        answer:
          'Sì, puoi aggiornare o ridurre il tuo piano in qualsiasi momento dalle impostazioni del tuo account.',
      },
    },
    pricingComparison: {
      badge: 'TUTTE LE FUNZIONALITÀ COMBINATE',
      title: "Un'App, Tutte le Funzionalità",
      subtitle:
        "Perché pagare per più app? Moshimoshi combina tutte le funzionalità premium delle principali app per l'apprendimento del giapponese a una frazione del costo.",
      compareTitle: 'Confronta con altre app',
      competitors: {
        duolingo: {
          name: 'Duolingo',
          price: '£47.99/anno',
          features: ['Gamificazione', 'Lezioni base', 'Tracciamento serie'],
          missing: [
            'Shadowing YouTube',
            'Storie IA',
            'Analisi kanji',
            'Lettura notizie',
            'Esportazione Anki',
          ],
        },
        heyJapan: {
          name: 'HeyJapan',
          price: '£48.99/anno',
          features: ['Lezioni video', 'Spiegazioni grammaticali'],
          missing: [
            'Gamificazione',
            'Funzionalità IA',
            'Pratica YouTube',
            'Lettura notizie',
            'Esportazione Anki',
          ],
        },
        satoriReader: {
          name: 'Satori Reader',
          price: '£8.49/mese',
          features: ['Pratica di lettura', 'Supporto furigana'],
          missing: [
            'Lezioni video',
            'Gamificazione',
            'Pratica YouTube',
            'Storie IA',
            'Esportazione Anki',
          ],
        },
        lingoDeer: {
          name: 'LingoDeer',
          price: '£95.99/anno',
          features: ['Lezioni strutturate', 'Focus grammatica'],
          missing: ['Pratica YouTube', 'Storie IA', 'Lettura notizie', 'Strumenti kanji avanzati'],
        },
      },
      missingLabel: 'Mancante:',
      moreMissing: 'altri mancanti...',
      costComparison: {
        title: 'Per ottenere tutte queste funzionalità separatamente, pagheresti:',
        amount: "£240+ all'anno",
        subtitle: '(Abbonandoti a 3-4 app diverse)',
      },
      moshimoshiPricing: {
        title: 'Prezzi Moshimoshi',
        monthly: 'Mensile',
        yearly: 'Annuale',
        save: 'Risparmia',
        free: {
          title: 'Gratuito',
          subtitle: 'Inizia il tuo viaggio',
          price: '£0',
          period: '/per sempre',
          features: [
            'Hiragana e Katakana',
            'Kanji base (N5)',
            '5 video YouTube/giorno',
            'Funzionalità IA limitate',
          ],
          limitations: ['Funzionalità avanzate bloccate'],
          cta: 'Inizia Gratuitamente',
        },
        premium: {
          title: 'Premium',
          subtitle: 'Tutto incluso',
          monthlyPrice: '£8.99',
          yearlyPrice: '£8.33',
          yearlyTotal: '£99.9/anno',
          period: '/mese',
          badge: 'MIGLIOR VALORE',
          features: [
            'Tutto in Gratuito, più:',
            'Shadowing YouTube illimitato',
            'Tutti i livelli JLPT (N5-N1)',
            'Storie e spiegazioni IA illimitate',
            'Lettore di notizie giapponesi',
            'Esportazione Anki e sincronizzazione cloud',
            'Supporto prioritario',
          ],
          cta: 'Inizia la prova gratuita di 7 giorni',
          disclaimer: 'Nessuna carta di credito richiesta • Cancella in qualsiasi momento',
        },
      },
      allFeatures: {
        title: 'Tutto quello che ottieni con Premium',
        categories: {
          learningTools: {
            title: 'Strumenti di Apprendimento',
            items: [
              'Shadowing Video YouTube',
              "Storie Generate dall'IA",
              'Lettore Notizie Giapponesi',
              'Sistema di Gamificazione e XP',
              'Obiettivi e Classifica',
              'Integrazione Esportazione Anki',
            ],
          },
          studyFeatures: {
            title: 'Funzionalità di Studio',
            items: [
              'Hiragana/Katakana Completo',
              'Browser Kanji JLPT N5-N1',
              'Spiegazioni Grammaticali',
              'Algoritmo SRS Intelligente',
              'Modalità Offline',
              'Pronuncia Audio Nativa',
            ],
          },
          advancedTools: {
            title: 'Strumenti Avanzati',
            items: [
              'Spiegazioni Parole IA',
              'Motore di Coniugazione',
              'Ordine Tratti Kanji',
              'Analisi Progressi',
              'Liste di Studio Personalizzate',
              'Tema Scuro/Chiaro',
            ],
          },
        },
      },
      bottomCta: {
        title: 'Unisciti a migliaia di studenti che imparano il giapponese in modo intelligente',
        subtitle:
          "Un'app, tutte le funzionalità, una frazione del costo. Inizia il tuo viaggio oggi!",
        button: 'Inizia la prova gratuita',
      },
    },
  },

  // Kanji Study System
  kanji: {
    study: {
      skip: 'Salta',
      examples: 'Esempi',
      markAsLearned: 'Segna come appreso',
      noExamples: 'Nessun esempio disponibile',
    },
  },

  // Learn Section
  learn: {
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
    vocabulary: 'Vocabolario',
    grid: 'Griglia',
    browse: 'Sfoglia',
    study: 'Studia',
    review: 'Ripassa',
    progress: 'Progresso',
    learned: 'imparato',
    selectCharacters: 'Seleziona i caratteri da studiare',
    noStrugglingCharacters: 'Nessun carattere difficile trovato',
    selectionCleared: 'Selezione cancellata',
    studySessionComplete: 'Sessione di studio completata!',
  },

  // Review Prompts
  reviewPrompts: {
    vocabulary: {
      writeJapaneseFor: 'Scrivi il giapponese per:',
      whatWordDoYouHear: 'Quale parola senti?',
      example: 'Esempio:',
      common: 'Comune',
      pitchAccent: 'Accento: {{accent}}',
      searchTitle: 'Ricerca Vocabolario',
      searchDescription: 'Cerca parole giapponesi con significati ed esempi',
      searchPlaceholder: 'Cerca per kanji, kana, romaji o significato in inglese...',
      searchButton: 'Cerca',
      searchSource: 'Fonte di ricerca:',
      searchSourceJMDict: 'JMDict (Offline)',
      searchSourceWaniKani: 'WaniKani',
      searchResults: 'Risultati della ricerca',
      searchResultsCount: 'Risultati della ricerca ({{count}})',
      searchQuickSearch: 'Ricerca rapida:',
      searchHistory: 'Cronologia ricerche',
      searchHistoryClear: 'Cancella',
      searchHistoryEmpty: 'La tua cronologia delle ricerche apparirà qui',
      searchHistoryResults: '{{count}} risultati',
      searchJustNow: 'Proprio ora',
      searchMinutesAgo: '{{minutes}} min fa',
      searchHoursAgo: '{{hours}} ore fa',
      searchDaysAgo: '{{days}} giorni fa',
      loadingMessage: 'Caricamento ricerca vocabolario...',
      searching: 'Ricerca in corso...',

      // Tabs
      tabs: {
        details: 'Dettagli',
        conjugations: 'Coniugazioni',
      },

      // Toast messages
      wanikaniUnavailable: 'WaniKani non è disponibile. Uso il dizionario JMdict invece.',
      wanikaniSearchFailed: 'La ricerca WaniKani è fallita. Passaggio al dizionario JMdict.',
      wanikaniMockData:
        "L'API di WaniKani non è configurata correttamente. Si prega di passare a JMdict o configurare un token API WaniKani valido.",
      wanikaniInvalidKey:
        'La chiave API di WaniKani non è valida. Si prega di verificare la configurazione API o utilizzare JMdict invece.',
      wanikaniServiceDown:
        'Il servizio WaniKani è temporaneamente non disponibile. Riprovare più tardi o utilizzare JMdict.',
      noResultsFound: 'Nessun risultato trovato. Prova un altro termine di ricerca.',
      searchFailed: 'Ricerca fallita. Per favore riprova.',
      searchHistoryCleared: 'Cronologia ricerche cancellata',
      loadingCache:
        'Caricamento del database di vocabolario WaniKani per la prima volta... Potrebbe richiedere un momento.',
      wordMeaning: 'Significato',
      wordRomaji: 'Romaji',
      wordTags: 'Tag',
      wordExampleSentences: 'Frasi di esempio',
      wordExampleSentencesComingSoon: 'Le frasi di esempio arriveranno presto!',
      noExamplesFound: 'Nessun esempio trovato per questa parola',

      // Practice page
      practiceTitle: 'Pratica di coniugazione',
      practiceDescription: 'Padroneggia le coniugazioni dei verbi e aggettivi giapponesi',
      filters: {
        all: 'Tutti',
        verbs: 'Solo verbi',
        adjectives: 'Solo aggettivi',
      },
      actions: {
        shuffle: 'Mescola',
        loadNew: 'Carica nuove parole',
        selectForReview: 'Seleziona per revisione',
        showConjugations: 'Mostra coniugazioni',
        hideConjugations: 'Nascondi coniugazioni',
      },
      stats: {
        verbs: 'Verbi',
        adjectives: 'Aggettivi',
      },
      studyMode: {
        title: 'Studia le coniugazioni',
        description: 'Impara a coniugare verbi e aggettivi giapponesi con esempi interattivi',
        startStudying: 'Inizia a studiare',
      },
      reviewMode: {
        practiceConjugation: 'Pratica questa coniugazione',
        complete: 'Completa revisione',
        noWords: 'Nessuna parola selezionata per la revisione',
      },
    },
  },

  // Funzionalità liste personalizzate
  favourites: {
    title: 'I miei Preferiti',
    description: 'Il tuo vocabolario, kanji e frasi salvati',
    filters: {
      all: 'Tutto',
      words: 'Parole',
      kanji: 'Kanji',
      sentences: 'Frasi',
    },
    filterByList: 'Filtra per lista',
    allLists: 'Tutte le liste',
    sortBy: 'Ordina per',
    sort: {
      recent: 'Aggiunto di recente',
      alphabetical: 'Alfabetico',
      mastery: 'Livello di padronanza',
    },
    noResultsFound: 'Nessun elemento trovato',
    noItemsSaved: 'Nessun elemento salvato ancora',
    tryDifferentSearch: 'Prova con un altro termine di ricerca',
    startSaving: 'Salva parole, kanji e frasi per vederli qui',
    confirmRemove: 'Rimuovere questo elemento da tutte le liste?',
    removeDialog: {
      title: 'Rimuovi dai preferiti',
      message: 'Sei sicuro di voler rimuovere questo elemento dai tuoi preferiti?',
      cancel: 'Annulla',
      confirm: 'Rimuovi',
    },
    reviewedTimes: 'Revisionato {count} volte',
    manageLists: 'Gestisci le mie liste',
  },

  lists: {
    title: 'Le mie liste',
    pageDescription: 'Crea e gestisci le tue liste di studio personalizzate',
    modal: {
      title: 'Crea nuova lista',
      createTitle: 'Configura la tua lista',
      saveTitle: 'Salva nelle liste',
      selectType: 'Scegli il tipo di lista che vuoi creare:',
    },
    types: {
      word: {
        name: 'Lista di parole',
        short: 'Parola',
        description: 'Vocabolario e kanji',
      },
      sentence: {
        name: 'Lista frasi',
        short: 'Frase',
        description: 'Studia frasi complete nel contesto',
      },
      verbAdj: {
        name: 'Verbi e aggettivi',
        short: 'Verbo/Agg',
        description: 'Pratica forme verbali e aggettivali',
      },

      flashcard: {
        name: 'Lista flashcard',
        short: 'Flashcard',
        description: 'Rivedi qualsiasi contenuto con ripetizione spaziata',
        accepts: 'Accetta: Parole, Kanji, Frasi',
      },
      drillable: {
        name: 'Lista di pratica',
        short: 'Pratica',
        description: 'Pratica coniugazioni per verbi e aggettivi',
        accepts: 'Accetta: Solo verbi e aggettivi',
      },
    },
    fields: {
      name: 'Nome lista',
      description: 'Descrizione',
      color: 'Colore',
      icon: 'Icona',
      notes: 'Note personali',
      tags: 'Tag',
    },
    placeholders: {
      name: 'es. Vocabolario JLPT N5',
      description: 'Descrizione opzionale per la tua lista',
      search: 'Cerca liste...',
      notes: 'Aggiungi note o mnemotecniche...',
      tags: 'Tag separati da virgole',
    },
    actions: {
      create: 'Crea lista',
      createNew: 'Crea nuova lista',
      createFirst: 'Crea la tua prima lista',
      save: 'Salva',
      saveToList: 'Salva nella lista',
      delete: 'Elimina',
      edit: 'Modifica lista',
      remove: 'Rimuovi dalla lista',
      addItems: 'Aggiungi elementi',
      review: 'Rivedi',
      manage: 'Gestisci lista',
    },
    deleteDialog: {
      title: 'Elimina lista',
      message: 'Sei sicuro di voler eliminare "{{name}}"? Questa azione non può essere annullata.',
      confirm: 'Elimina',
      cancel: 'Annulla',
    },
    labels: {
      itemCount: '{count} elementi',
      alreadySaved: 'Già salvato',
      incompatibleLists: 'Tipi di liste incompatibili',
      drillable: 'Coniugabile',
      updated: 'Aggiornato',
    },
    quota: {
      remaining: '{count} liste rimanenti',
      guestLimit: 'Accedi per creare liste',
      freeLimit: 'Gli utenti gratuiti possono creare fino a 3 liste',
    },
    success: {
      created: 'Lista creata con successo',
      updated: 'Lista aggiornata con successo',
      deleted: 'Lista eliminata con successo',
      itemAdded: 'Aggiunto a {{count}} lista/e',
      itemRemoved: 'Rimosso da {{count}} lista/e',
      itemUpdated: 'Elemento aggiornato con successo',
    },
    errors: {
      limitReached: 'Hai raggiunto il limite di liste. Aggiorna per crearne altre.',
      nameRequired: 'Inserisci un nome per la lista',
      typeRequired: 'Seleziona un tipo di lista',
      createFailed: 'Creazione lista fallita',
      loadFailed: 'Caricamento liste fallito',
      saveFailed: 'Salvataggio elemento fallito',
      noListSelected: 'Seleziona almeno una lista',
      incompatibleType: 'Questo tipo di lista non può accettare questo elemento',
    },
    empty: {
      noLists: 'Non hai ancora creato liste',
      noItems: 'Questa lista è vuota',
      noResults: 'Nessun risultato trovato',
      getStarted: 'Inizia a organizzare i tuoi materiali di apprendimento in liste personalizzate',
      tryDifferentSearch: 'Prova a cercare con parole chiave diverse',
    },
    stats: {
      items: 'Elementi',
      mastered: 'Padroneggiato',
      learning: 'In apprendimento',
      total: 'Totale',
    },
  },

  // YouTube Shadowing
  youtubeShadowing: {
    title: 'Shadowing YouTube',
    description: 'Pratica il giapponese con video YouTube e file audio',

    header: {
      eyebrow: 'Lettore Shadowing',
      title: 'MoshiPlayer',
      subtitle: 'Ripeti le trascrizioni, resta nel flusso.',
    },

    form: {
      videoLabel: 'URL o ID YouTube',
      videoPlaceholder: 'https://youtu.be/VIDEO_ID',
      languageLabel: 'Lingua',
      repeatLabel: 'Numero di ripetizioni (1-10)',
      loadButton: 'Carica trascrizione',
      loadingButton: 'Caricamento...',
      changeVideo: 'Cambia video',
    },

    hints: {
      transcriptWillAppear: 'La trascrizione apparirà qui una volta caricata.',
      pasteToStart: 'Incolla un link YouTube per iniziare lo shadowing.',
      firstLoadInfo: 'Il primo caricamento usa YouTube timedtext; il servizio di trascrizione è usato come fallback.',
    },

    settings: {
      title: 'Impostazioni',
      furigana: 'Furigana',
      highlighting: 'Evidenziazione grammaticale',
      noHighlighting: 'Nessuna evidenziazione',
      contentWords: 'Parole di contenuto',
      grammarWords: 'Parole grammaticali',
      allWords: 'Tutte le parole',
      clearSession: 'Cancella sessione',
      clearButton: 'Cancella',
    },

    status: {
      transcriptLoaded: 'Trascrizione caricata da {{source}} ({{language}}).',
    },

    hero: {
      title: 'Padroneggia il giapponese con qualsiasi media',
      subtitle:
        "Trasforma video YouTube o i tuoi file multimediali in sessioni di pratica shadowing interattive con trascrizioni potenziate dall'IA",
    },

    modes: {
      input: 'Aggiungi Media',
      player: 'Pratica',
    },

    input: {
      youtube: 'URL YouTube',
      upload: 'Carica File',
      youtubeTitle: 'Incolla URL YouTube',
      uploadTitle: 'Carica File Multimediale',
      placeholder: 'https://www.youtube.com/watch?v=...',
      supportedFormats: 'Formati supportati:',
      extract: 'Estrai e Inizia',
      uploadButton: 'Seleziona File',
      maxSize: 'Dimensione massima file:',
      acceptedFormats: 'Formati accettati: MP4, MP3, WAV, M4A',
    },

    errors: {
      invalidUrl: 'Inserisci un URL YouTube valido',
      emptyUrl: 'Inserisci un URL YouTube',
      extractFailed: "Impossibile estrarre l'ID video dall'URL",
      uploadFailed: 'Caricamento file fallito',
      transcriptFailed: 'Generazione trascrizione fallita',
      playerFailed: 'Caricamento player fallito',
      invalidVideoId: 'Inserisci un URL YouTube valido o un ID video di 11 caratteri.',
      transcriptUnavailable: 'Trascrizione non disponibile per questo video.',
    },

    features: {
      transcripts: {
        title: 'Trascrizioni Istantanee',
        description: "Trascrizione potenziata dall'IA in secondi",
      },
      shadowing: {
        title: 'Pratica Shadowing',
        description: 'Perfeziona la tua pronuncia e ritmo',
      },
      furigana: {
        title: 'Supporto Furigana',
        description: 'Assistenza alla lettura per tutti i livelli',
      },
    },

    player: {
      loading: 'Caricamento player...',
      extractingAudio: 'Estrazione audio...',
      generatingTranscript: 'Generazione trascrizione...',
      ready: 'Pronto a praticare!',
      title: 'Lettore',
      awaitingVideo: 'In attesa del video',
      nowPlaying: 'In riproduzione: {{videoId}}',
      sourceLabel: 'Fonte: {{source}}',
      tapToJump: 'Tocca una riga per saltare',
      tapWordsForExplanation: 'Tocca le parole per una spiegazione',
      segmentProgress: 'Segmento {{current}}/{{total}}',
      repeatProgress: 'Ripetizione {{current}}/{{total}}',

      controls: {
        play: 'Riproduci',
        pause: 'Pausa',
        previous: 'Linea precedente',
        next: 'Linea successiva',
        repeat: 'Ripeti',
        speed: 'Velocità',
        volume: 'Volume',
        settings: 'Impostazioni',
        furigana: 'Mostra Furigana',
        grammar: 'Mostra Grammatica',
      },

      settings: {
        playbackSpeed: 'Velocità Riproduzione',
        repeatCount: 'Numero Ripetizioni',
        pauseBetween: 'Pausa Tra',
        continuous: 'Riproduzione Continua',
        autoScroll: 'Scorrimento Automatico',
      },

      transcript: {
        title: 'Trascrizione',
        edit: 'Modifica',
        regenerate: 'Rigenera',
        save: 'Salva Modifiche',
        cancel: 'Annulla Modifica',
      },
    },

    freeAccess: 'Accesso Gratuito',
    loadingTitle: 'Caricamento titolo video...',
    by: 'di',

    usage: {
      today: 'Utilizzo di oggi',
      unlimited: 'Illimitato',
      remaining: 'rimanenti',
      limitReached: 'Limite giornaliero raggiunto',
      newVideos: 'Nuovi video oggi',
      uploads: 'caricamenti',
    },
  },

  // Library Page
  library: {
    title: 'Biblioteca',
    pageDescription: 'Leggi riassunti condensati di libri popolari in giapponese',
  },

  flashcards: {
    title: 'Flashcard',
    pageTitle: 'Mazzi di Flashcard',
    pageDescription: 'Crea e studia mazzi di flashcard personalizzati',

    // Empty state
    noDecksYet: 'Nessun mazzo ancora',
    noDecksDescription:
      'Inizia creando il tuo primo mazzo di flashcard per iniziare il tuo percorso di apprendimento',
    createFirstDeck: 'Crea il Tuo Primo Mazzo',

    // Deck management
    createDeck: 'Crea Nuovo Mazzo',
    editDeck: 'Modifica Mazzo',
    deleteDeck: 'Elimina Mazzo',
    deckName: 'Nome del Mazzo',
    deckDescription: 'Descrizione',
    deckSettings: 'Impostazioni Mazzo',
    totalCards: '{{count}} carte',
    lastStudied: 'Ultimo studio: {{date}}',
    neverStudied: 'Mai studiato',

    // Card management
    addCard: 'Aggiungi Carta',
    editCard: 'Modifica Carta',
    deleteCard: 'Elimina Carta',
    frontSide: 'Fronte',
    backSide: 'Retro',
    cardNotes: 'Note (opzionale)',
    cardTags: 'Etichette',
    cardDifficulty: 'Difficoltà',

    // Study modes
    studyMode: 'Modalità Studio',
    classic: 'Classica',
    match: 'Abbinamento',
    speed: 'Velocità',
    write: 'Scrittura',
    voice: 'Voce',

    // Study session
    startStudying: 'Inizia Studio',
    resumeStudying: 'Riprendi Studio',
    flipCard: 'Gira Carta',
    showAnswer: 'Mostra Risposta',
    nextCard: 'Carta Successiva',
    previousCard: 'Carta Precedente',
    markCorrect: 'Lo sapevo',
    markIncorrect: 'Non lo sapevo',
    difficulty: {
      again: 'Ancora',
      hard: 'Difficile',
      good: 'Bene',
      easy: 'Facile',
    },

    // Progress
    progress: 'Progresso',
    cardsStudied: 'Carte studiate',
    accuracy: 'Precisione',
    streak: 'Serie attuale',
    masteryLevel: 'Padronanza',
    dueForReview: 'Da rivedere',
    due: 'due',
    newCards: 'Nuove carte',
    learningCards: 'In apprendimento',
    reviewCards: 'Da ripassare',

    // Statistics
    stats: {
      title: 'Statistiche',
      todayStudied: 'Studiato oggi',
      totalStudied: 'Totale studiato',
      averageAccuracy: 'Precisione media',
      studyStreak: 'Serie di studio',
      timeSpent: 'Tempo trascorso',
      heatmap: 'Mappa di calore',
      retention: 'Tasso di ritenzione',
    },

    // Customization
    customize: {
      title: 'Personalizza Carte',
      cardStyle: 'Stile Carta',
      minimal: 'Minimale',
      decorated: 'Decorato',
      themed: 'A tema',
      animationSpeed: 'Velocità Animazione',
      slow: 'Lenta',
      normal: 'Normale',
      fast: 'Veloce',
      soundEffects: 'Effetti Sonori',
      hapticFeedback: 'Feedback Aptico',
      autoPlay: 'Riproduzione Auto',
      studyDirection: 'Direzione Studio',
      frontToBack: 'Fronte → Retro',
      backToFront: 'Retro → Fronte',
      mixed: 'Misto',
      sessionLength: 'Carte per sessione',
    },

    // Import/Export
    import: {
      title: 'Importa Mazzo',
      selectFile: 'Seleziona File',
      supportedFormats: 'Supportato: CSV, JSON, Anki (.apkg)',
      fromList: 'Crea da Lista',
      selectList: 'Seleziona una lista',
      importing: 'Importazione...',
      success: '{{count}} carte importate',
      error: 'Importazione fallita',
      yourLists: 'Le tue liste',
      noLists: 'Nessuna lista disponibile',
      createListFirst: 'Crea prima una lista per importarla come mazzo',
      anki: 'Importazione Anki',
      ankiTitle: 'Anki',
      csv: 'Importa file CSV',
      csvTitle: 'CSV',
      csvDescription: 'Importa file CSV',
    },

    export: {
      title: 'Esporta Mazzo',
      format: 'Formato Export',
      csv: 'CSV',
      json: 'JSON',
      anki: 'Pacchetto Anki',
      includeProgress: 'Includi dati progresso',
      exporting: 'Esportazione...',
      success: 'Mazzo esportato con successo',
    },

    // Empty states
    empty: {
      noDecks: 'Nessun mazzo di flashcard',
      createFirst: 'Crea il tuo primo mazzo per iniziare',
      noCards: 'Questo mazzo non ha carte',
      addFirst: 'Aggiungi la tua prima carta',
      noDue: 'Nessuna carta da rivedere',
      allCaughtUp: 'Tutto fatto! Torna più tardi.',
      studyNew: 'Studia nuove carte',
      noDecksYet: 'Nessun mazzo ancora',
      noDecksDescription:
        'Inizia creando il tuo primo mazzo di flashcard per iniziare il tuo percorso di apprendimento',
      createFirstDeck: 'Crea il tuo primo mazzo',
    },

    // Errors and limits
    errors: {
      loadFailed: 'Caricamento fallito',
      saveFailed: 'Salvataggio fallito',
      deleteFailed: 'Eliminazione fallita',
      limitReached: 'Limite mazzi raggiunto',
      upgradeRequired: 'Aggiornamento richiesto',
      offlineOnly: 'Modalità offline',
      syncFailed: 'Sincronizzazione fallita',
    },

    limits: {
      guest: 'Accedi per creare mazzi',
      freeLimit: 'Gratuito: {{current}}/{{max}} mazzi',
      dailyLimit: 'Limite giornaliero: {{current}}/{{max}}',
      unlimited: 'Mazzi illimitati',
    },

    // Missing translations for flashcards page
    optimalSettings: 'Impostazioni Ottimali',
    sessionLength: 'Durata Sessione',
    studyTime: 'Tempo di Studio',
    learningInsights: 'Approfondimenti di Apprendimento',
    recommendedStudy: 'Studio Raccomandato',
    currentStreak: 'Serie Attuale',
    retentionRate: 'Tasso di Ritenzione',
    cardsPerDay: 'Carte al Giorno',
    bestStudyTime: 'Miglior Orario di Studio',

    achievements: {
      viewAll: 'Visualizza Tutti i Risultati',
      title: 'Risultati',
      unlocked: 'Sbloccato',
      progress: '{{unlocked}}/{{total}} sbloccati',
      totalXP: 'XP Totale',
      streak: 'Serie',
      mastery: 'Padronanza',
      speed: 'Velocità',
      accuracy: 'Precisione',
      volume: 'Volume',
      special: 'Speciale',
    },

    dailyGoals: {
      title: 'Obiettivi Giornalieri',
      progress: '{{percentage}}% completato',
      cards: 'Carte',
      time: 'Tempo',
      decks: 'Mazzi',
      accuracy: 'Precisione',
      congratulations: 'Congratulazioni!',
      keepItUp: 'Continua così!',
      allComplete: 'Tutti gli obiettivi raggiunti!',
      customizeGoals: 'Personalizza Obiettivi',
      cardsPerDay: 'Carte al giorno',
      minutesPerDay: 'Minuti al giorno',
      decksPerDay: 'Mazzi al giorno',
      accuracyTarget: 'Obiettivo di precisione',
    },

    // Urgency levels
    urgency: {
      low: 'Priorità Bassa',
      medium: 'Priorità Media',
      high: 'Priorità Alta',
      critical: 'Critico',
    },

    // Additional missing translations
    minutes: 'minuti',
    cards: 'carte',
  },

  // Tooltips
  tooltips: {
    srs: 'Usa ripetizione spaziata',
    mastery: 'Studia 21+ giorni con 90% precisione',
    streak: 'Studia ogni giorno',
    difficulty: 'Valuta la tua conoscenza',
    leech: 'Questa carta richiede più pratica',
  },

  // Confirmations
  confirmDelete: {
    title: 'Elimina Mazzo',
    message: 'Sei sicuro di voler eliminare "{{name}}"? Questa azione non può essere annullata.',
    deck: 'Eliminare mazzo "{{name}}"? Irreversibile.',
    card: 'Eliminare questa carta? Irreversibile.',
    progress: 'Resettare progresso?',
  },

  // Success messages
  success: {
    deckCreated: 'Mazzo creato',
    deckUpdated: 'Mazzo aggiornato',
    deckDeleted: 'Mazzo eliminato',
    cardAdded: 'Carta aggiunta',
    cardUpdated: 'Carta aggiornata',
    cardDeleted: 'Carta eliminata',
    progressSaved: 'Progresso salvato',
    imported: 'Mazzo importato',
    exported: 'Mazzo esportato',
  },

  // Actions
  actions: {
    syncAll: 'Sincronizza tutto',
    exportAll: 'Esporta tutto',
  },

  // Study Session
  startSession: 'Inizia sessione',

  // Statistics
  showStats: 'Mostra statistiche',
  hideStats: 'Nascondi statistiche',
  stats: {
    mastered: 'Padroneggiato',
    accuracy: 'Precisione',
    streak: 'Serie attuale',
    studyTime: 'Tempo di studio',
    learningProgress: 'Progresso di apprendimento',
    deckPerformance: 'Prestazioni dei mazzi',
    insights: 'Approfondimenti di studio',
    velocity: 'Velocità di apprendimento',
    cardsPerHour: 'carte/ora',
    todayGoal: 'Progressi di oggi',
    bestStreak: 'Miglior serie',
    dueNow: 'Da rivedere',
    days: 'giorni',
    total: 'Carte totali',
    learning: 'In apprendimento',
    complete: 'Completo',
    progress: 'Progresso',
    averageAccuracy: 'Precisione media',
    hoursMinutes: '{{hours}}h {{minutes}}m',
    minutes: '{{minutes}} minuti',
    period: {
      day: 'Oggi',
      week: 'Questa settimana',
      month: 'Questo mese',
      all: 'Sempre',
    },
  },

  conjugation: {
    title: 'Coniugazione',
    showConjugations: 'Mostra Coniugazioni',
    hideConjugations: 'Nascondi Coniugazioni',
    expandAll: 'Espandi Tutto',
    collapseAll: 'Riduci Tutto',
    groups: {
      stems: 'Radici',
      basicForms: 'Forme Base',
      politeForms: 'Forme Cortesi',
      conditionalForms: 'Forme Condizionali',
      volitionalForms: 'Forme Volitive',
      imperativeForms: 'Forme Imperative',
      potentialForms: 'Forme Potenziali',
      passiveForms: 'Forme Passive',
      causativeForms: 'Forme Causative',
      causativePassiveForms: 'Forme Causative-Passive',
      desiderativeForms: 'Forme Desiderative (たい)',
      progressiveForms: 'Forme Progressive',
      requestForms: 'Forme di Richiesta',
      colloquialForms: 'Forme Colloquiali',
      formalForms: 'Forme Formali/Classiche',
      presumptiveForms: 'Forme Presuntive',
      plainform: 'Forma piana',
      politeform: 'Forma cortese',
      taiformwantto: 'Forma tai (volere)',
      'taiform(wantto)': 'Forma tai (volere)',
      imperativeforms: 'Forme imperative',
      provisionalform: 'Forma provvisoria',
      conditionalform: 'Forma condizionale',
      alternativeform: 'Forma alternativa',
      potentialplainform: 'Forma potenziale piana',
      potentialpoliteform: 'Forma potenziale cortese',
      passiveplainform: 'Forma passiva piana',
      passivepoliteform: 'Forma passiva cortese',
      causativeplainform: 'Forma causativa piana',
      causativepoliteform: 'Forma causativa cortese',
      causativepassiveplainform: 'Forma causativo-passiva piana',
      causativepassivepoliteform: 'Forma causativo-passiva cortese',
      colloquialform: 'Forma colloquiale',
      formalform: 'Forma formale',
      classicalformnu: 'Forma classica (nu)',
      'classicalform(nu)': 'Forma classica (nu)',
      classicalformzaru: 'Forma classica (zaru)',
      'classicalform(zaru)': 'Forma classica (zaru)',
      // Gruppi specifici per aggettivi
      basicforms: 'Forme di base',
      politeforms: 'Forme cortesi',
      conditionalforms: 'Forme condizionali',
      presumptiveforms: 'Forme presuntive',
    },
    forms: {
      // Radici
      masuStem: 'Radice masu',
      negativeStem: 'Radice negativa',
      teForm: 'Forma te',
      negativeTeForm: 'Forma te negativa',
      adverbialNegative: 'Negativo avverbiale',
      // Forme base
      present: 'Presente/Dizionario',
      past: 'Passato',
      negative: 'Negativo',
      pastNegative: 'Passato negativo',
      // Forme cortesi
      polite: 'Cortese',
      politePast: 'Cortese passato',
      politeNegative: 'Cortese negativo',
      politePastNegative: 'Cortese passato negativo',
      politeVolitional: 'Cortese volitivo',
      // Condizionali
      provisional: 'Se/Quando (ば)',
      provisionalNegative: 'Se non (ば)',
      conditional: 'Se/Quando (たら)',
      conditionalNegative: 'Se non (たら)',
      // Volitive
      volitional: 'Facciamo/Dovremmo',
      volitionalNegative: 'Non facciamo',
      // Imperative
      imperativePlain: 'Comando',
      imperativePolite: 'Per favore fai',
      imperativeNegative: 'Non fare',
      // Potenziali
      potential: 'Può fare',
      potentialNegative: 'Non può fare',
      potentialPast: 'Poteva fare',
      potentialPastNegative: 'Non poteva fare',
      // Passive
      passive: 'È fatto',
      passiveNegative: 'Non è fatto',
      passivePast: 'È stato fatto',
      passivePastNegative: 'Non è stato fatto',
      // Causative
      causative: 'Fare/Lasciare fare',
      causativeNegative: 'Non fare/lasciare fare',
      causativePast: 'Ha fatto/lasciato fare',
      causativePastNegative: 'Non ha fatto/lasciato fare',
      // Causative-Passive
      causativePassive: 'Essere costretto a fare',
      causativePassiveNegative: 'Non essere costretto a fare',
      // Desiderative
      taiForm: 'Volere',
      taiFormNegative: 'Non volere',
      taiFormPast: 'Voleva',
      taiFormPastNegative: 'Non voleva',
      // Progressive
      progressive: 'Sta facendo',
      progressiveNegative: 'Non sta facendo',
      progressivePast: 'Stava facendo',
      progressivePastNegative: 'Non stava facendo',
      // Richiesta
      request: 'Per favore fai',
      requestNegative: 'Per favore non fare',
      // Colloquiali
      colloquialNegative: 'Non (colloquiale)',
      // Formali
      formalNegative: 'Non (formale)',
      classicalNegative: 'Non (classico)',
      // Presuntive
      presumptive: 'Probabilmente',
      presumptiveNegative: 'Probabilmente non',
    },
    wordTypes: {
      ichidan: 'Verbo ichidan',
      godan: 'Verbo godan',
      irregular: 'Verbo irregolare',
      iadjective: 'Aggettivo in i',
      naadjective: 'Aggettivo in na',
    },
    messages: {
      notConjugatable: 'Questa parola non può essere coniugata',
      lowConfidence: 'Tipo di coniugazione rilevato con bassa fiducia',
      specialCase: 'Questa parola ha regole di coniugazione speciali',
    },
    // Pagina di pratica
    practiceTitle: 'Pratica di Coniugazione',
    practiceDescription: 'Padroneggia le coniugazioni di verbi e aggettivi giapponesi',
    searchPlaceholder: 'Cerca un verbo o un aggettivo...',
    searchButton: 'Cerca',
    clearSearch: 'Cancella',
    searchResults: 'Risultati della ricerca',
    noSearchResults: 'Nessuna parola coniugabile trovata',
    filters: {
      all: 'Tutto',
      verbs: 'Solo Verbi',
      adjectives: 'Solo Aggettivi',
    },
    actions: {
      shuffle: 'Mescola',
      loadNew: 'Carica Nuove Parole',
      selectForReview: 'Seleziona per revisione',
      showConjugations: 'Mostra Coniugazioni',
      hideConjugations: 'Nascondi Coniugazioni',
    },
    stats: {
      verbs: 'Verbi',
      adjectives: 'Aggettivi',
    },
    studyMode: {
      title: 'Studia Coniugazioni',
      description: 'Impara a coniugare verbi e aggettivi giapponesi con esempi interattivi',
      startStudying: 'Inizia a Studiare',
    },
    reviewMode: {
      practiceConjugation: 'Pratica questa coniugazione',
      complete: 'Completa Revisione',
      noWords: 'Nessuna parola selezionata per la revisione',
    },
  },

  // Settings Page
  settings: {
    title: 'Impostazioni',
    subtitle: 'Personalizza la tua esperienza di apprendimento',
    backToDashboard: '← Torna alla Dashboard',
    saveButton: 'Salva Tutte le Impostazioni',
    resetButton: 'Ripristina tutte le impostazioni ai valori predefiniti',
    resetConfirm: 'Sei sicuro di voler ripristinare tutte le impostazioni ai valori predefiniti?',
    saveSuccess: 'Impostazioni salvate con successo!',
    resetSuccess: 'Impostazioni ripristinate ai valori predefiniti',
    reviewNotifications: 'Notifiche di Ripasso',

    sections: {
      appearance: {
        title: 'Aspetto',
        language: {
          label: 'Lingua / 言語 / Langue / Lingua / Sprache / Idioma',
        },
        theme: {
          label: 'Tema',
          light: 'Chiaro',
          dark: 'Scuro',
          system: 'Sistema',
        },
        colorPalette: {
          label: 'Palette Colori',
          preview: 'Anteprima:',
          primary: 'Primario',
          secondary: 'Secondario',
          palettes: {
            sakura: 'Sakura',
            ocean: 'Oceano',
            matcha: 'Matcha',
            sunset: 'Tramonto',
            lavender: 'Lavanda',
            monochrome: 'Mono',
          },
        },
      },

      learning: {
        title: 'Preferenze di Apprendimento',
        autoplay: {
          label: 'Audio Automatico',
          description: 'Riproduci automaticamente la pronuncia quando visualizzi le parole',
        },
        furigana: {
          label: 'Mostra Furigana',
          description: 'Visualizza suggerimenti di lettura sopra i caratteri kanji',
        },
        romaji: {
          label: 'Mostra Romaji',
          description: 'Visualizza il testo giapponese romanizzato',
        },
        soundEffects: {
          label: 'Effetti Sonori',
          description: 'Riproduci suoni per risposte corrette/errate',
        },
        hapticFeedback: {
          label: 'Feedback Aptico',
          description: 'Vibrazione su dispositivi mobili',
        },
      },

      notifications: {
        title: 'Notifiche',
        dailyReminder: {
          label: 'Promemoria di Studio Quotidiano',
          description: 'Ricevi un promemoria per praticare ogni giorno',
        },
        achievementAlerts: {
          label: 'Avvisi di Risultati',
          description: 'Festeggia quando sblocchi risultati',
        },
        weeklyProgress: {
          label: 'Rapporto Settimanale',
          description: 'Ricevi un riepilogo dei tuoi progressi settimanali',
        },
        marketingEmails: {
          label: 'Email di Marketing',
          description: 'Aggiornamenti su nuove funzionalità e contenuti',
        },
        channels: {
          title: 'Canali di Notifica',
          browser: {
            label: 'Notifiche del Browser',
            description: 'Notifiche desktop quando le revisioni sono dovute',
          },
          inApp: {
            label: 'Notifiche In-App',
            description: "Notifiche toast mentre usi l'app",
          },
          push: {
            label: 'Notifiche Push',
            description: 'Notifiche mobili (richiede installazione app)',
          },
        },
        timing: {
          title: 'Preferenze di Tempistica',
          immediate: {
            label: 'Revisioni Immediate',
            description: 'Notifica per revisioni di 10 minuti e 30 minuti',
          },
          daily: {
            label: 'Riepilogo Giornaliero',
            description: 'Ottieni un riepilogo giornaliero delle revisioni dovute',
          },
        },
        quietHours: {
          title: 'Ore di Silenzio',
          enable: 'Abilita Ore di Silenzio',
          description: 'Nessuna notifica durante i periodi specificati',
          start: 'Ora di Inizio',
          end: 'Ora di Fine',
        },
        saveSuccess: 'Preferenze di notifica salvate',
        saveError: 'Impossibile salvare le preferenze',
        browserNotSupported: 'Notifiche del browser non supportate',
        browserEnabled: 'Notifiche del browser abilitate',
        browserDenied: 'Notifiche del browser bloccate. Abilita nelle impostazioni del browser.',
        enableBrowserFirst: 'Prima abilita le notifiche del browser',
        blocked: 'Bloccato',
        testNotification: 'Notifica di Test',
        test: {
          title: 'Notifica di Test',
          body: 'Questo è un test delle tue impostazioni di notifica',
        },
      },

      privacy: {
        title: 'Privacy',
        publicProfile: {
          label: 'Profilo Pubblico',
          description: 'Permetti agli altri di visualizzare il tuo profilo',
        },
        showProgress: {
          label: 'Mostra Progressi',
          description: 'Visualizza i tuoi progressi di apprendimento sul tuo profilo',
        },
        shareAchievements: {
          label: 'Condividi Risultati',
          description: 'Condividi automaticamente i risultati con gli amici',
        },
      },

      accessibility: {
        title: 'Accessibilità',
        largeText: {
          label: 'Testo Grande',
          description: 'Aumenta la dimensione del testo per una migliore leggibilità',
        },
        highContrast: {
          label: 'Alto Contrasto',
          description: 'Aumenta il contrasto dei colori per la visibilità',
        },
        reduceMotion: {
          label: 'Riduci Movimento',
          description: 'Minimizza animazioni e transizioni',
        },
        screenReader: {
          label: 'Supporto Screen Reader',
          description: 'Ottimizza per la compatibilità con screen reader',
        },
      },

      appInfo: {
        title: "Info sull'App",
        version: {
          title: "Versione dell'App",
          checking: 'Verifica in corso...',
          upToDate: 'Aggiornato',
          error: 'Verifica fallita',
          checkButton: 'Controlla Aggiornamenti',
          available: 'disponibile',
          criticalMessage:
            'È disponibile un aggiornamento importante con correzioni critiche. Si prega di aggiornare il prima possibile.',
        },
      },

      legal: {
        title: 'Legale e Supporto',
        privacyPolicy: {
          label: 'Informativa sulla Privacy',
          description: 'Come gestiamo i tuoi dati',
        },
        termsOfService: {
          label: 'Termini di Servizio',
          description: 'I nostri termini e condizioni',
        },
        credits: {
          label: 'Crediti e Ringraziamenti',
          description: 'Librerie open source e fonti di dati',
        },
        contactUs: {
          label: 'Contattaci',
          description: 'Ottieni aiuto o invia feedback',
        },
        emailSupport: {
          label: 'Supporto Email',
          description: 'support@moshimoshi.app',
        },
      },
    },
  },

  // Credits Page
  credits: {
    title: 'Crediti e Ringraziamenti',
    subtitle:
      'Moshimoshi è costruito sulle spalle di giganti. Ringraziamo sinceramente i seguenti progetti e comunità.',
    loading: 'Caricamento crediti...',
    backToSettings: '← Torna alle Impostazioni',

    sections: {
      dataSources: 'Fonti di Dati e Contenuti',
      libraries: 'Librerie e Tecnologie',
      specialThanks: 'Ringraziamenti Speciali',
    },

    sources: {
      jmdict: 'Progetto dizionario giapponese multilingue',
      wanikani: 'Metodologia di apprendimento kanji e ispirazione mnemonica',
      kanjicanvas: "Diagrammi dell'ordine dei tratti e componenti di disegno kanji",
      flaticon: 'Icone e risorse visive',
    },

    libraries: {
      nextjs: 'Framework React per la produzione',
      react: 'Libreria JavaScript per interfacce utente',
      typescript: 'JavaScript con sintassi per i tipi',
      firebase: 'Autenticazione, database e archiviazione',
      tailwind: 'Framework CSS utility-first',
      openai: 'Generazione e analisi di contenuti tramite IA',
      redis: 'Archivio dati in memoria',
      stripe: 'Elaborazione pagamenti e abbonamenti',
    },

    thanks: {
      community: {
        name: 'La Comunità di Apprendimento del Giapponese',
        description: 'Per il feedback continuo e il supporto',
      },
      contributors: {
        name: 'Contributori Open Source',
        description: 'Per aver reso disponibili gratuitamente strumenti straordinari',
      },
      users: {
        name: 'I Nostri Utenti',
        description: 'Per averci affidato il vostro percorso di apprendimento',
      },
    },

    license: {
      title: 'Licenza e Utilizzo',
      description:
        'Moshimoshi rispetta le licenze di tutti i progetti di terze parti. Utilizziamo queste risorse in conformità con le rispettive licenze. Per informazioni dettagliate sulle licenze, si prega di fare riferimento alla documentazione ufficiale di ciascun progetto.',
    },

    footer: {
      madeWith: 'Fatto con',
      forLearners: 'per gli studenti di giapponese in tutto il mondo',
      contact: 'Hai un suggerimento? Contattaci!',
    },
  },

  kanjiConnection: {
    title: 'Connessioni Kanji',
    subtitle: 'Scopri le relazioni tra i caratteri kanji',
    howItWorks: {
      description: 'Impara i kanji attraverso connessioni significative',
      step1: 'Esplora le famiglie di kanji che condividono componenti',
      step2: 'Padroneggia i radicali che formano i blocchi di costruzione',
      step3: 'Riconosci i modelli visivi tra i caratteri',
    },
    families: {
      title: 'Famiglie di Kanji',
      subtitle: 'Gruppi di caratteri correlati',
      description: 'Scopri i kanji che condividono componenti semantici o fonetici',
    },
    radicals: {
      title: 'Radicali e Componenti',
      subtitle: 'Blocchi di costruzione dei kanji',
      description: 'Impara le parti fondamentali che compongono i caratteri complessi',
    },
    visualLayout: {
      title: 'Modelli Visivi',
      subtitle: 'Riconoscere le somiglianze strutturali',
      description: 'Identifica i modelli visivi e le disposizioni tra diversi kanji',
    },
  },

  vocabulary: {
    tabs: {
      details: 'Dettagli',
      conjugations: 'Coniugazioni',
    },
  },

  // YouTube Series Public Page
  youtubeSeries: {
    title: 'Serie YouTube',
    subtitle: 'Impara il giapponese con contenuti YouTube selezionati',
    description:
      'Pratica lo shadowing e impara da contenuti nativi con le nostre serie YouTube selezionate',
    search: 'Cerca video o canali...',
    searchPlaceholder: 'Cerca per titolo, canale o descrizione',
    filters: {
      all: 'Tutti i canali',
      channel: 'Canale',
      duration: 'Durata',
      any: 'Qualsiasi durata',
      short: '< 5 min',
      medium: '5-15 min',
      long: '> 15 min',
      sortBy: 'Ordina per',
      newest: 'Più recenti',
      oldest: 'Più vecchi',
      mostViewed: 'Più visualizzati',
      leastViewed: 'Meno visualizzati',
    },
    viewModes: {
      grid: 'Vista griglia',
      list: 'Vista lista',
    },
    videoCard: {
      views: '{{count}} visualizzazioni',
      duration: '{{duration}}',
      practice: 'Pratica',
      shadowing: 'Inizia lo shadowing',
      noThumbnail: 'Nessuna miniatura',
    },
    channelHeader: {
      videos: '{{count}} video',
      viewChannel: 'Vedi canale',
    },
    empty: {
      noVideos: 'Nessun video trovato',
      tryDifferent: 'Prova a modificare i filtri o i termini di ricerca',
      noChannels: 'Nessun canale disponibile',
      checkBack: 'Torna più tardi per nuovi contenuti',
    },
    loading: {
      channels: 'Caricamento canali...',
      videos: 'Caricamento video...',
    },
    errors: {
      loadFailed: 'Caricamento contenuto fallito',
      tryAgain: 'Riprova più tardi',
    },
  },

  todos: {
    title: 'I Miei Compiti',
    addNew: 'Aggiungi Nuovo Compito',
    noTodos: 'Nessun compito ancora. Crea il tuo primo compito!',
    noActiveTodos: 'Nessun compito attivo',
    noCompletedTodos: 'Nessun compito completato',
    signInRequired: 'Accedi per gestire i tuoi compiti',
    errorLoading: 'Errore nel caricamento dei compiti',
    limitReached: 'Hai raggiunto il limite giornaliero di compiti',
    usage: '{{remaining}} di {{limit}} compiti rimanenti oggi',

    titleLabel: 'Titolo',
    titlePlaceholder: 'Cosa deve essere fatto?',
    descriptionLabel: 'Descrizione',
    descriptionPlaceholder: 'Aggiungi più dettagli (opzionale)',
    priorityLabel: 'Priorità',
    dueDateLabel: 'Data di scadenza',
    due: 'Scadenza',
    tagsLabel: 'Etichette',
    tagPlaceholder: "Aggiungi un'etichetta...",
    addTag: 'Aggiungi',
    creating: 'Creazione...',

    priority: {
      low: 'Bassa',
      medium: 'Media',
      high: 'Alta',
      label: 'Priorità',
    },

    filter: {
      all: 'Tutti',
      active: 'Attivi',
      completed: 'Completati',
    },

    sort: {
      date: 'Ordina per Data',
      priority: 'Ordina per Priorità',
    },

    demoBanner: {
      title: 'Funzionalità Demo',
      description:
        "Questa lista di compiti dimostra l'architettura Moshimoshi inclusi autenticazione, diritti e integrazione Firebase.",
      limits: 'Limiti giornalieri',
      guestLimit: 'Utenti ospiti: Nessun accesso',
      freeLimit: 'Utenti gratuiti: 5 compiti al giorno',
      premiumLimit: 'Utenti Premium: Compiti illimitati',
      signInPrompt: 'Accedi per iniziare a creare compiti!',
      upgradePrompt: 'Passa a Premium per compiti illimitati!',
    },

    techDemo: {
      title: 'Dimostrazione Tecnica',
      auth: 'Autenticazione lato server con sessioni JWT',
      entitlements: 'Controllo centralizzato dei diritti',
      firebase: 'Firebase Firestore per la persistenza dei dati',
      subscription: 'Controllo del livello di abbonamento',
      i18n: "Supporto completo all'internazionalizzazione",
      darkMode: 'Stile adattivo al tema',
      responsive: 'Design responsive mobile',
    },

    form: {
      titlePlaceholder: 'Cosa deve essere fatto?',
      descriptionPlaceholder: 'Aggiungi più dettagli (opzionale)',
      addButton: 'Crea Compito',
    },

    item: {
      cancel: 'Annulla',
    },
  },

  // Anki Import
  anki: {
    importTitle: 'Import Anki Deck',
    importSuccess: 'Import Successful!',
    import: 'Import',
    importing: 'Importing...',
    cardsImported: '{{count}} cards imported successfully',
    dropFile: 'Drop your .apkg file here',
    orBrowse: 'or click to browse',
    maxFileSize: 'Maximum file size: 200MB',
    invalidFile: 'Please select a valid .apkg file',
    importFailed: 'Failed to import deck',
    processing: 'Processing...',
    description: 'Import your Anki decks and review them using the Universal Review Engine',
    importButton: 'Import Anki Deck (.apkg)',
    mediaCache: 'Media Cache',
    clearCache: 'Clear Cache',
    confirmClearCache: 'Are you sure you want to clear all cached media files?',
    importedDecks: 'Imported Decks',
    removeDeck: 'Remove deck',
    sampleCards: 'Sample Cards',
    front: 'Front',
    back: 'Back',
    startReview: 'Start Review Session',
    noDecksYet: 'No decks imported yet',
    noDecksDescription: 'Click the button above to import your first Anki deck',
    cards: 'cards',
    mediaFiles: 'media files',
    filesCount: '{{count}} files',
    sizeInMB: '{{size}} MB',
  },

  myVideos: {
    title: 'I Miei Video di Pratica',
    subtitle: 'Cronologia YouTube',
    backToHome: 'Torna alla Home',
    loginRequired: 'Accedi per tracciare la tua cronologia',
    loginDescription:
      'Accedi per tracciare la tua cronologia di pratica e accedere rapidamente ai video che hai guardato.',

    hero: {
      title: 'La Tua Cronologia di Pratica',
      syncedDescription: 'Sincronizzato su tutti i dispositivi',
      localDescription: 'Salvato su questo dispositivo',
    },

    stats: {
      videosPracticed: 'Video Praticati',
      totalSessions: 'Sessioni Totali',
      practiceTime: 'Tempo di Pratica',
    },

    storage: {
      freeTitle: 'Account Gratuito - Solo Archiviazione Locale',
      freeDescription:
        'La tua cronologia è salvata solo su questo dispositivo. Passa a Premium per sincronizzare su tutti i tuoi dispositivi.',
    },

    search: {
      placeholder: 'Cerca nella cronologia...',
      noResults: 'Nessun Risultato',
      noResultsDescription:
        'Nessun video corrisponde a "{{query}}". Prova un altro termine di ricerca.',
    },

    sort: {
      mostRecent: 'Più Recente',
      mostPracticed: 'Più Praticato',
    },

    video: {
      practiceAgain: 'Pratica di Nuovo',
      practiceCount: 'Praticato {{count}}x',
      duration: '{{minutes}}m',
      today: 'Oggi',
      yesterday: 'Ieri',
      daysAgo: '{{days}} giorni fa',
      weeksAgo: '{{weeks}} settimane fa',
      delete: 'Rimuovi dalla cronologia',
    },

    empty: {
      title: 'Nessuna Cronologia di Pratica',
      description:
        'Inizia a praticare con i video di YouTube e appariranno qui per un accesso rapido.',
      startPracticing: 'Inizia a Praticare',
    },

    loading: {
      message: 'Caricamento cronologia...',
    },

    confirmDelete: {
      title: 'Elimina Video',
      message: 'Sei sicuro di voler rimuovere "{{title}}" dalla tua cronologia?',
      confirm: 'Rimuovi',
      cancel: 'Annulla',
    },
  },

  // Drill Feature
  drill: {
    title: 'Esercizio di Coniugazione',
    description: 'Pratica le coniugazioni di verbi e aggettivi giapponesi',
    loading: 'Caricamento esercizio...',
    settings: 'Impostazioni Esercizio',

    // Practice mode section
    practiceMode: 'Modalità Pratica',
    randomWords: 'Parole Casuali',
    randomDescription: 'Pratica con parole comuni',
    fromLists: 'Dalle Liste',
    listsDescription: 'Usa le tue liste di studio',
    myLists: 'Le Mie Liste',

    // Word types section
    wordTypes: 'Tipi di Parole',
    wordTypeFilter: 'Filtro Tipo Parola',
    allTypes: 'Tutti i Tipi',
    verbs: 'Verbi',
    adjectives: 'Aggettivi',
    verbsOnly: 'Solo Verbi',
    adjectivesOnly: 'Solo Aggettivi',

    // Buttons and actions
    startDrill: 'Inizia Esercizio',
    tryAgain: 'Riprova',
    newDrill: 'Nuovo Esercizio',
    backToSetup: 'Torna alle Impostazioni',
    backToDashboard: 'Torna alla Dashboard',
    seeResults: 'Vedi Risultati',
    showResults: 'Mostra Risultati',
    nextQuestion: 'Prossima Domanda',
    finish: 'Fine',

    // Questions and game play
    question: 'Domanda',
    questionNumber: 'Domanda {{current}} di {{total}}',
    conjugateTo: 'Coniuga in',
    correctAnswer: 'Risposta Corretta',
    yourAnswer: 'La Tua Risposta',
    showAnswer: 'Mostra Risposta',
    rule: 'Regola',

    // Results
    complete: 'Esercizio Completato!',
    correct: 'Corretto!',
    incorrect: 'Errato',
    score: 'Punteggio',
    yourScore: 'Il Tuo Punteggio',
    accuracy: 'Precisione',
    results: 'Risultati',
    excellentPerformance: 'Ottimo lavoro! Hai padroneggiato queste coniugazioni!',
    goodPerformance: 'Buon lavoro! Stai migliorando!',
    keepPracticing: 'Continua a praticare! Migliorerai con più esercizi!',

    // Progress stats
    yourProgress: 'I Tuoi Progressi',
    totalDrills: 'Esercizi Totali',
    perfectDrills: 'Perfetto',
    wordsStudied: 'Parole',

    // Settings
    questionsPerSession: 'Domande per sessione',
    autoAdvance: 'Avanza automaticamente alla prossima domanda',
    showRules: 'Mostra regole di coniugazione',
    hideRules: 'Nascondi regole',
    remainingToday: '{{count}} esercizi rimanenti oggi',
    upgradeForMore: 'Passa a Premium per più domande per sessione',

    // Messages
    limitReached: 'Limite giornaliero di esercizi raggiunto',
    startError: "Impossibile avviare l'esercizio. Riprova.",

    // Conjugation forms
    forms: {
      present: 'Presente',
      past: 'Passato',
      negative: 'Negativo',
      pastNegative: 'Passato Negativo',
      polite: 'Formale',
      politePast: 'Passato Formale',
      politeNegative: 'Negativo Formale',
      politePastNegative: 'Passato Negativo Formale',
      teForm: 'Forma Te',
      potential: 'Potenziale',
      passive: 'Passivo',
      causative: 'Causativo',
      conditional: 'Condizionale',
      volitional: 'Volitivo',
      imperative: 'Imperativo',
      taiForm: 'Forma Tai (desiderio)',
      adverbial: 'Avverbiale',
    },

    // Messages
    noQuestions: 'Nessuna parola coniugabile trovata. Prova impostazioni diverse.',
    selectLists: 'Seleziona almeno una lista per praticare.',
    noConjugableWords: 'Nessuna parola coniugabile trovata nelle liste selezionate.',
    dailyLimitReached: 'Hai raggiunto il limite giornaliero di esercizi.',
    loadingQuestions: 'Caricamento domande...',
    of: 'di',
  },

  // PWA (Progressive Web App)
  pwa: {
    install: {
      title: 'Installa Moshimoshi',
      description: "Installa l'app per un'esperienza migliore",
      button: 'Installa App',
      later: 'Più tardi',
      benefits: {
        offline: 'Accedi alle tue lezioni offline',
        faster: 'Tempi di caricamento più veloci',
        notifications: 'Ricevi promemoria per le revisioni',
      },
      ios: {
        instructions: 'Come installare su iOS:',
        step1: 'Tocca il pulsante Condividi',
        step2: 'Scorri e tocca "Aggiungi a Home"',
        step3: 'Tocca "Aggiungi" per installare',
      },
    },
    notifications: {
      permission: {
        title: 'Abilita le notifiche',
        description: 'Ricevi promemoria quando le revisioni sono dovute',
        allow: 'Consenti notifiche',
        deny: 'Non ora',
        blocked: 'Le notifiche sono bloccate. Abilitale nelle impostazioni del browser.',
        unsupported: 'Le notifiche non sono supportate nel tuo browser',
      },
      quietHours: {
        title: 'Ore silenziose',
        description: 'Non inviare notifiche durante questi orari',
        start: 'Ora di inizio',
        end: 'Ora di fine',
        enabled: 'Ore silenziose abilitate',
        disabled: 'Ore silenziose disabilitate',
      },
      test: {
        title: 'Notifica di prova',
        body: 'Questo è un test delle tue impostazioni di notifica',
        button: 'Invia test',
      },
    },
    badge: {
      reviewsDue: '{{count}} revisioni in attesa',
      clearBadge: 'Cancella badge',
    },
    share: {
      title: 'Aggiungi a Moshimoshi',
      description: 'Scegli dove salvare questo contenuto',
      addToList: 'Aggiungi alla lista',
      createNew: 'Crea nuova lista',
      selectList: 'Seleziona una lista',
      success: 'Contenuto aggiunto con successo',
      error: 'Impossibile aggiungere il contenuto',
    },
    mediaSession: {
      playing: 'In riproduzione',
      paused: 'In pausa',
      playbackRate: 'Velocità di riproduzione',
    },

    // Shadowing Feature
    shadowing: {
      title: 'Esercizio di Shadowing',
      noSentence: 'Nessuna frase da riprodurre',
      playbackError: 'Errore nella riproduzione audio',
      voice: 'Voce',
      male: 'Uomo',
      female: 'Donna',
      speed: 'Velocità',
      repeatCount: 'Numero di Ripetizioni',
      pauseDuration: 'Pausa tra Ripetizioni',
      showFurigana: 'Mostra Furigana',
      furiganaDescription: 'Mostra suggerimenti di lettura sopra i kanji',
      sentenceProgress: 'Frase {{current}} di {{total}}',
      repeatProgress: 'Ripetizione {{current}}/{{total}}',
      saveSentence: 'Salva frase nella lista di studio',
      noSentenceAvailable: 'Nessuna frase disponibile',
      repeatProgressLabel: 'Progresso Ripetizioni:',
      sentenceProgressLabel: 'Progresso Frasi:',
      allSentences: 'Tutte le Frasi',
      sentenceSaved: 'Frase salvata con successo',
      saveFailed: 'Impossibile salvare la frase',
      instructions1: 'Ascolta ogni frase e ripetila durante la pausa.',
      instructions2: 'Regola le impostazioni secondo il tuo ritmo di apprendimento.',

      // Floating Navbar (Mobile)
      floatingNavbar: {
        message: 'Spiega la grammatica',
        repeat: 'Ripeti',
        play: 'Riproduci',
        pause: 'Pausa',
        settings: 'Impostazioni',
      },
    },
    aiGrammar: {
      title: 'Spiegazione grammaticale',
      trigger: 'Spiega la grammatica',
      targetSentence: 'Frase di riferimento',
      analyzing: 'Analisi della grammatica in corso...',
      errorTitle: 'Impossibile generare la spiegazione',
      error:
        'Si è verificato un errore durante la generazione della spiegazione grammaticale. Riprova.',
      cachedLabel: 'Caricato dalla cache',
      structureLabel: 'Struttura',
      examplesLabel: 'Esempi',
      mistakesLabel: 'Errori comuni',
      relatedLabel: 'Schemi correlati',
      formalityLabel: 'Formalità',
    },
    offline: {
      title: 'Sei offline',
      description: 'Alcune funzionalità potrebbero essere limitate senza connessione internet',
      cached: 'Visualizzazione contenuto in cache',
      retry: 'Riprova connessione',
      backOnline: 'Di nuovo online',
    },
  },

  // Stories
  stories: {
    title: 'Storie',
    description: 'Impara con storie interattive in giapponese',
    createNew: 'Crea Nuova',
    generateAI: 'Genera con IA',
    published: 'Pubblicato',
    draft: 'Bozza',
    viewStory: 'Visualizza Storia',
    editStory: 'Modifica',
    deleteStory: 'Elimina',
    confirmDelete: 'Sei sicuro di voler eliminare questa storia?',
    emptyState: 'Nessuna storia ancora',
    createFirst: 'Crea la tua prima storia per iniziare',
    jlptLevel: 'Livello JLPT',
    theme: 'Tema',
    pageCount: '{{count}} pagine',
    quizQuestions: '{{count}} domande',
    takeQuiz: 'Fai il Quiz',
    finish: 'Finisci',
    quiz: {
      title: 'Quiz della Storia',
      yourScore: 'Il Tuo Punteggio',
      excellent: 'Eccellente!',
      good: 'Ottimo Lavoro!',
      keepPracticing: 'Continua a Praticare!',
    },
  },

  // Privacy Policy Page
  privacy: {
    title: 'Informativa sulla Privacy',
    lastUpdated: 'Ultimo aggiornamento: Gennaio 2025',
    footer:
      'Grazie per aver scelto Moshimoshi per il tuo percorso di apprendimento del giapponese.',
    sections: {
      introduction: {
        title: '1. Introduzione',
        content:
          'Benvenuto su Moshimoshi ("noi", "nostro" o "ci"). Ci impegniamo a proteggere le tue informazioni personali e il tuo diritto alla privacy. Questa Informativa sulla Privacy spiega come raccogliamo, utilizziamo, divulghiamo e proteggiamo le tue informazioni quando utilizzi la nostra applicazione per l\'apprendimento del giapponese.',
        agreement:
          "Utilizzando Moshimoshi, accetti la raccolta e l'utilizzo delle informazioni in conformità con questa politica. Se non sei d'accordo con le nostre politiche e pratiche, ti preghiamo di non utilizzare i nostri servizi.",
      },
      collection: {
        title: '2. Informazioni che raccogliamo',
        provided: {
          title: '2.1 Informazioni che fornisci',
          account: "Informazioni dell'account",
          accountDesc:
            'Indirizzo email, nome visualizzato e foto del profilo quando crei un account',
          learning: 'Dati di apprendimento',
          learningDesc:
            'Il tuo progresso, vocabolario salvato, risultati degli esercizi e preferenze di studio',
          content: 'Contenuti utente',
          contentDesc:
            "Note, liste di parole personalizzate e qualsiasi contenuto che crei nell'app",
          communications: 'Comunicazioni',
          communicationsDesc: 'Feedback, richieste di supporto e corrispondenza con noi',
        },
        automatic: {
          title: '2.2 Informazioni raccolte automaticamente',
          device: 'Informazioni sul dispositivo',
          deviceDesc:
            'Tipo di browser, sistema operativo, tipo di dispositivo e identificatori univoci',
          usage: 'Dati di utilizzo',
          usageDesc:
            'Funzionalità utilizzate, tempo trascorso, pagine visitate e modelli di interazione',
          performance: 'Dati sulle prestazioni',
          performanceDesc:
            'Rapporti sugli arresti anomali, log degli errori e metriche delle prestazioni',
          analytics: 'Analisi',
          analyticsDesc: 'Statistiche aggregate per migliorare i nostri servizi',
        },
        thirdParty: {
          title: '2.3 Servizi di terze parti',
          intro:
            'Utilizziamo i seguenti servizi di terze parti che potrebbero raccogliere informazioni:',
          firebase: 'Autenticazione, database e analisi',
          stripe: 'Elaborazione pagamenti (non memorizziamo i dati delle carte di credito)',
          openai: "Funzionalità basate sull'IA (contenuti anonimizzati)",
        },
      },
      usage: {
        title: '3. Come utilizziamo le tue informazioni',
        intro: 'Utilizziamo le informazioni che raccogliamo per:',
        provide: 'Fornire e mantenere i nostri servizi di apprendimento linguistico',
        personalize: 'Personalizzare la tua esperienza di apprendimento e monitorare i progressi',
        process: 'Elaborare transazioni e gestire abbonamenti',
        notify: 'Inviare notifiche e aggiornamenti relativi al servizio',
        support: 'Rispondere a richieste di supporto e feedback',
        improve: 'Migliorare i nostri servizi attraverso analisi e ricerca',
        comply: 'Rispettare gli obblighi legali e proteggere i nostri diritti',
      },
      security: {
        title: '4. Archiviazione e sicurezza dei dati',
        content:
          'Implementiamo misure tecniche e organizzative appropriate per proteggere i tuoi dati.',
        measures: {
          title: 'Le nostre misure di sicurezza',
          encryption: 'Crittografia end-to-end per i dati sensibili',
          https: 'Connessioni HTTPS sicure per tutti i trasferimenti di dati',
          audits: 'Audit di sicurezza regolari e valutazioni delle vulnerabilità',
          access: 'Controlli di accesso e meccanismi di autenticazione',
        },
        location: {
          title: 'Posizione dei dati',
          content:
            "I tuoi dati sono archiviati su server sicuri forniti da Google Firebase, situati negli Stati Uniti. Per gli utenti dell'Unione Europea, i dati potrebbero essere trasferiti a livello internazionale in conformità con le leggi applicabili sulla protezione dei dati.",
        },
        local: {
          title: 'Archiviazione locale',
          content:
            "Alcuni dati vengono archiviati localmente sul tuo dispositivo per l'accesso offline e l'ottimizzazione delle prestazioni. Ciò include contenuti memorizzati nella cache, preferenze e attività recenti.",
        },
      },
      rights: {
        title: '5. I tuoi diritti e le tue scelte',
        exercise: 'Per esercitare uno di questi diritti, contattaci a',
        exerciseSuffix: 'o attraverso le impostazioni del tuo account.',
        yourRights: {
          title: 'Hai il diritto di:',
          access: 'Accesso',
          accessDesc: 'Richiedere una copia dei tuoi dati personali',
          correct: 'Rettifica',
          correctDesc: 'Aggiornare o correggere informazioni inesatte',
          delete: 'Cancellazione',
          deleteDesc: 'Richiedere la cancellazione del tuo account e dei tuoi dati',
          export: 'Esportazione',
          exportDesc: 'Scaricare i tuoi dati in un formato portatile',
          optOut: 'Opt-out',
          optOutDesc: "Annullare l'iscrizione alle comunicazioni di marketing",
          restrict: 'Limitazione',
          restrictDesc: "Limitare l'elaborazione dei tuoi dati in determinate circostanze",
        },
      },
      contact: {
        title: '6. Informazioni di contatto',
        intro:
          'Se hai domande o dubbi su questa informativa sulla privacy o sulle nostre pratiche sui dati, contattaci:',
        email: 'Email',
        support: 'Supporto',
      },
      recaptcha: {
        title: '7. Protezione reCAPTCHA',
        content: 'Questo sito è protetto da reCAPTCHA e si applicano le',
        privacyPolicy: 'Norme sulla privacy',
        and: 'e i',
        termsOfService: 'Termini di servizio',
        apply: 'di Google.',
      },
    },
    acceptButton: 'Comprendo e accetto',
  },

  // Contact Page
  contact: {
    title: 'Contattaci',
    subtitle: 'Ci farebbe piacere sentirti!',
    error:
      "Spiacenti, si è verificato un errore durante l'invio del messaggio. Per favore riprova.",
    validation: {
      invalidEmail: 'Inserisci un indirizzo email valido',
      messageTooShort: 'Il messaggio deve contenere almeno 10 caratteri',
      messageTooLong: 'Il messaggio supera il limite di caratteri',
    },
    form: {
      name: 'Nome',
      namePlaceholder: 'Il tuo nome',
      email: 'Email',
      emailPlaceholder: 'tua@email.com',
      category: 'Categoria',
      categories: {
        general: 'Richiesta generale',
        support: 'Supporto tecnico',
        bug: 'Segnala un bug',
        feature: 'Richiesta funzionalità',
        feedback: 'Feedback',
        privacy: 'Preoccupazione sulla privacy',
      },
      subject: 'Oggetto',
      subjectPlaceholder: 'Breve descrizione della tua richiesta',
      message: 'Messaggio',
      messagePlaceholder: 'Raccontaci di più sulla tua richiesta...',
      info: {
        title: 'Il tuo messaggio sarà inviato a',
        support: 'Supporto',
        feedback: 'Feedback',
        privacy: 'Privacy',
      },
      sending: 'Invio in corso...',
      submit: 'Invia messaggio',
    },
    success: {
      title: 'Messaggio inviato!',
      message: 'Grazie per averci contattato. Ti risponderemo il prima possibile!',
      sendAnother: 'Invia un altro messaggio',
      goBack: 'Torna indietro',
    },
    alternative: {
      title: 'Altri modi per contattarci',
      email: {
        title: "Inviaci un'email",
        description: "Inviaci un'email in qualsiasi momento",
      },
      privacy: {
        title: 'Preoccupazioni sulla privacy',
      },
      social: {
        title: 'Seguici',
        description: 'Resta aggiornato con le nostre ultime novità',
      },
    },
  },

  // Leaderboard Page
  leaderboard: {
    title: 'Classifica',
    yourRank: 'La tua posizione',
    totalXP: 'XP Totali',
    streak: 'Serie',
    global: 'Globale',
    friends: 'Amici',
    friendsComingSoon: 'Classifica amici in arrivo',
    friendsDescription:
      'Connettiti con gli amici e gareggia insieme nel tuo percorso di apprendimento.',
    rank: 'Posizione',
    learner: 'Studente',
    level: 'Livello',
    xp: 'XP',
    noData: 'Nessun dato di classifica disponibile',
    loading: 'Caricamento classifica...',
  },

  // Resources Page
  resources: {
    notFound: 'Risorsa non trovata',
    backToResources: 'Torna alle risorse',
    views: 'visualizzazioni',
    lastUpdated: 'Ultimo aggiornamento',
    relatedResources: 'Risorse correlate',
    title: 'Risorse di apprendimento',
    description:
      'Risorse selezionate per aiutarti nel tuo percorso di apprendimento del giapponese',
    categories: {
      all: 'Tutto',
      grammar: 'Grammatica',
      vocabulary: 'Vocabolario',
      reading: 'Lettura',
      listening: 'Ascolto',
      speaking: 'Parlato',
      kanji: 'Kanji',
    },
  },

  // Moodboards
  moodboards: {
    viewModes: {
      grid: 'Griglia',
      study: 'Studia',
      list: 'Elenco',
    },
  },

  // Kanji Browser Page
  kanjiBrowser: {
    searchPlaceholder: 'Cerca kanji per carattere, significato o lettura...',
    title: 'Browser Kanji',
    subtitle: 'Esplora e impara i kanji giapponesi',
    filters: {
      jlptLevel: 'Livello JLPT',
      gradeLevel: 'Grado scolastico',
      strokeCount: 'Numero di tratti',
      radical: 'Radicale',
    },
    sort: {
      frequency: 'Frequenza',
      strokes: 'Tratti',
      grade: 'Grado',
    },
    details: {
      meanings: 'Significati',
      readings: 'Letture',
      onyomi: "On'yomi",
      kunyomi: "Kun'yomi",
      strokes: 'Tratti',
      examples: 'Esempi',
      radicals: 'Radicali',
    },
    noResults: 'Nessun kanji trovato corrispondente ai tuoi criteri',
    loading: 'Caricamento kanji...',
  },

  // Flusso di onboarding
  onboarding: {
    // Pagina di benvenuto
    welcome: {
      title: 'Benvenuto su Moshimoshi!',
      subtitle: 'La piattaforma definitiva per padroneggiare la lingua giapponese. Iniziamo il tuo viaggio di apprendimento.',
      getStarted: 'Inizia',
    },

    // Selezione obiettivo di apprendimento
    learningGoal: {
      title: 'Qual è il tuo obiettivo principale?',
      subtitle: 'Questo ci aiuterà a personalizzare la tua esperienza di apprendimento.',
      next: 'Avanti',
      goals: {
        jlpt: {
          title: 'Preparazione JLPT',
          description: 'Focus su vocabolario, grammatica e kanji per un livello JLPT specifico.',
        },
        travel: {
          title: 'Imparare per viaggiare',
          description: 'Padroneggia frasi e vocaboli essenziali per il tuo viaggio in Giappone.',
        },
        anime: {
          title: 'Capire Anime/Manga',
          description: 'Immergiti nella lingua dei tuoi media giapponesi preferiti.',
        },
        conversation: {
          title: 'Migliorare la conversazione',
          description: 'Pratica parlare e ascoltare con scenari reali.',
        },
      },
    },

    // Selezione livello di esperienza
    experienceLevel: {
      title: 'Qual è il tuo livello di giapponese?',
      subtitle: 'Questo ci aiuta a consigliare i contenuti giusti per te.',
      next: 'Avanti',
      levels: {
        beginner: {
          title: 'Principiante',
          description: 'Sto appena iniziando o conosco poche parole e frasi.',
        },
        intermediate: {
          title: 'Intermedio',
          description: 'Posso avere conversazioni di base e capire un po\' di grammatica.',
        },
        advanced: {
          title: 'Avanzato',
          description: 'Posso capire ed esprimere idee complesse in giapponese.',
        },
      },
    },

    // Presentazione funzionalità
    featureShowcase: {
      continue: 'Continua',
      swipeHint: 'Scorri per esplorare altre funzionalità',
      progress: '{{current}} di {{total}}',
      defaultHeadline: {
        title: 'Funzionalità che amerai',
        subtitle: 'In base ai tuoi obiettivi, ecco alcune funzionalità per iniziare.',
      },
      personalizedHeadlines: {
        jlpt: {
          title: 'Supera il JLPT con questi strumenti',
          subtitle: 'Padroneggia kanji, vocabolario e grammatica sistematicamente per il successo all\'esame.',
        },
        travel: {
          title: 'Preparati per il viaggio con il giapponese',
          subtitle: 'Impara frasi pratiche e conoscenze culturali per il tuo viaggio.',
        },
        anime: {
          title: 'Comprendi i tuoi anime preferiti',
          subtitle: 'Impara espressioni naturali dai contenuti nativi.',
        },
        conversation: {
          title: 'Parla giapponese con sicurezza',
          subtitle: 'Pratica la pronuncia e impara veri modelli conversazionali.',
        },
      },
      features: {
        shadowing: {
          title: 'YouTube Shadowing',
          description: 'Padroneggia la pronuncia nativa praticando con veri video YouTube giapponesi.',
          highlight: 'Ideale per parlare',
        },
        kanjiConnection: {
          title: 'Connessione Kanji',
          description: 'Impara 2.136 kanji attraverso pattern visivi e famiglie di radicali.',
          highlight: 'Apprendimento visivo',
        },
        kanjiBrowser: {
          title: 'Browser Kanji',
          description: 'Cerca ed esplora tutti i jōyō kanji con analisi dettagliate.',
          highlight: 'Strumento di riferimento',
        },
        kanjiMoods: {
          title: 'Kanji Mood',
          description: 'Impara kanji raggruppati per temi ed emozioni per un apprendimento memorabile.',
          highlight: 'Apprendimento tematico',
        },
        conjugation: {
          title: 'Motore di coniugazione',
          description: 'Padroneggia oltre 100 forme verbali e aggettivali con il nostro sistema completo.',
          highlight: 'Maestria grammaticale',
        },
        news: {
          title: 'Notizie giapponesi',
          description: 'Leggi articoli NHK autentici con supporto vocabolario IA.',
          highlight: 'Lettura reale',
        },
        stories: {
          title: 'Storie IA',
          description: 'Goditi storie generate dall\'IA adattate al tuo livello.',
          highlight: 'Adatto al livello',
        },
        library: {
          title: 'Biblioteca di lettura',
          description: 'Sfoglia letture graduate, libri e storie per il tuo livello.',
          highlight: 'Collezione ampia',
        },
        anki: {
          title: 'Importa Anki',
          description: 'Porta i tuoi mazzi Anki esistenti e continua a imparare.',
          highlight: 'Mantieni le tue carte',
        },
        textbooks: {
          title: 'Vocabolario dei libri di testo',
          description: 'Studia vocabolario da Genki, Minna no Nihongo e altro.',
          highlight: 'Preparazione accademica',
        },
        flashcards: {
          title: 'Flashcard intelligenti',
          description: 'Ripassa con il nostro sistema SRS intelligente che si adatta a te.',
          highlight: 'Ripasso adattivo',
        },
        drill: {
          title: 'Esercizio rapido',
          description: 'Sessioni di ripasso veloci perfette per brevi pause studio.',
          highlight: 'Pratica veloce',
        },
      },
    },

    // Pronto per iniziare
    readyToGo: {
      title: 'Sei pronto!',
      subtitle: 'Hai configurato il tuo profilo con successo. Preparati per la tua avventura giapponese!',
      goToDashboard: 'Vai alla Dashboard',
      settingUp: 'Configurazione...',
      error: 'Qualcosa è andato storto. Riprova.',
    },
  },
}
