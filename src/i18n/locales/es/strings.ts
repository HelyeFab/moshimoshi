export const strings = {
  reviewDashboard: {
    title: 'Panel de Revisión',
    description: 'Rastrea tu progreso de aprendizaje y programa de revisión',
    subtitle: 'Rastrea tu progreso de aprendizaje y programa de revisión',
    loading: 'Cargando panel de revisión...',
    tabs: {
      overview: 'Resumen',
      studied: 'Estudiado',
      learned: 'Aprendido',
      queue: 'Cola',
      schedule: 'Horario',
    },
    upcomingReviews: 'Próximas Revisiones',
    overdue: 'Atrasado',
    thisWeek: 'Esta Semana',
    noScheduledReviews:
      'No hay revisiones programadas. ¡Sigue estudiando para construir tu horario de revisión!',
    sections: {
      reviewQueue: 'Cola de Revisión',
      upcomingReviews: 'Próximas Revisiones',
      learningProgress: 'Progreso de Aprendizaje',
      allStudiedItems: 'Todos los Elementos Estudiados',
      learnedItems: 'Elementos Aprendidos',
      masteredItems: 'Dominado',
      inReview: 'En Revisión',
      reviewQueueFull: 'Cola de Revisión - Revisar Ahora',
      reviewSchedule: 'Horario de Revisión',
    },
    stats: {
      studied: 'Estudiado',
      learned: 'Aprendido',
      dueNow: 'Pendiente',
      upcoming: 'Próximo',
    },
    filter: {
      all: 'Todo',
      kana: 'Kana',
      kanji: 'Kanji',
      vocabulary: 'Vocabulario',
      sentences: 'Frases',
    },
    actions: {
      startReview: 'Iniciar Revisión',
      reviewOverdue: 'Revisar {{count}} Elementos Atrasados',
      viewAll: 'Ver todo',
      refresh: 'Actualizar',
    },
    messages: {
      noReviewsDue: 'No hay revisiones pendientes. ¡Excelente trabajo!',
      noUpcoming: 'No hay revisiones programadas',
      noItemsFiltered: 'No hay elementos para este filtro',
      noStudiedItems: 'No hay elementos estudiados aún',
      queueEmpty: '¡Tu cola de revisión está vacía!',
      loading: 'Cargando datos de revisión...',
      loadError: 'Error al cargar los datos de revisión',
    },
    time: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      thisWeek: 'Esta semana',
    },
    contentTypes: {
      kana: 'Kana',
      kanji: 'Kanji',
      vocabulary: 'Vocabulario',
      sentence: 'Frase',
    },
    schedule: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      thisWeek: 'Esta Semana',
      later: 'Después',
      nextReview: 'Próxima revisión',
      scheduledReviews: 'Revisiones programadas',
    },
    items: 'elementos',
  },

  // Common/Shared
  common: {
    brand: 'Moshimoshi',
    loading: 'Cargando...',
    processing: 'Procesando...',
    close: 'Cerrar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    remove: 'Remove',
    back: 'Atrás',
    backTo: 'Volver a',
    gotIt: '¡Entendido!',
    next: 'Siguiente',
    previous: 'Anterior',
    play: 'Reproducir',
    playing: 'Reproduciendo',
    stop: 'Detener',
    sentence: 'Oración',
    submit: 'Enviar',
    continue: 'Continuar',
    clear: 'Borrar',
    signIn: 'Iniciar sesión',
    signUp: 'Registrarse',
    signOut: 'Cerrar sesión',
    logOut: 'Salir',
    email: 'Correo electrónico',
    filter: 'Filtrar',
    filters: 'Filtros',
    actions: 'Acciones',
    display: 'Visualización',
    password: 'Contraseña',
    name: 'Nombre',
    or: 'O',
    and: 'y',
    with: 'con',
    free: 'GRATIS',
    premium: 'PREMIUM',
    premiumOnly: 'Solo Premium',
    guest: 'INVITADO',
    creating: 'Creando...',
    saving: 'Guardando...',
    upgrade: 'Mejorar',
    today: 'Hoy',
    yesterday: 'Ayer',
    theme: 'Tema',
    complete: 'Completo',
    completed: 'Completado',
    correct: 'Correcto',
    incorrect: 'Incorrecto',
    explore: 'Explorar',
    days: 'días',
    minutes: 'minutos',
    cards: 'tarjetas',
  },

  // Landing Page
  landing: {
    header: {
      navigation: {
        about: 'Acerca de',
        pricing: 'Precios',
        signIn: 'Iniciar sesión',
      },
    },
    hero: {
      badge: '¡GRATIS!',
      title: 'Aprende japonés',
      subtitle: '¡De forma divertida!',
      description:
        'Domina hiragana, katakana y kanji con lecciones breves y repetición espaciada que hace que el aprendizaje se mantenga!',
      primaryCta: 'Empieza a aprender ahora',
      secondaryCta: 'Ya tengo una cuenta',
    },
    mascots: {
      sakura: 'Sakura',
      matcha: 'Matcha',
      fuji: 'Fuji',
      torii: 'Torii',
    },
    features: {
      personalizedLearning: {
        title: 'Aprendizaje personalizado',
        description:
          'Las lecciones impulsadas por IA se adaptan a tu ritmo y estilo de aprendizaje',
      },
      stayMotivated: {
        title: 'Mantente motivado',
        description: 'Gana XP, mantén rachas y desbloquea logros',
      },
      smartReview: {
        title: 'Sistema de repaso inteligente',
        description: 'El algoritmo SRS garantiza que repases en el momento perfecto',
      },
    },
    stats: {
      title: '¡Únete a miles aprendiendo japonés!',
      activeLearners: {
        number: '5M+',
        label: 'Estudiantes activos',
      },
      lessons: {
        number: '10K+',
        label: 'Lecciones',
      },
      successRate: {
        number: '95%',
        label: 'Tasa de éxito',
      },
    },
    progressPreview: {
      title: 'Tu viaje de aprendizaje',
      stage1: {
        title: 'Hiragana y Katakana',
        description: 'Domina los conceptos básicos en 2 semanas',
      },
      stage2: {
        title: 'Kanji esenciales',
        description: 'Aprende más de 100 kanji básicos con mnemotécnicos',
      },
      stage3: {
        title: 'Kanji avanzados',
        description: 'Domina más de 1000 kanji para la fluidez',
      },
    },
    finalCta: {
      title: '¿Listo para comenzar tu viaje?',
      description: '¡Es gratis, divertido y solo toma 5 minutos al día!',
      buttonText: 'Comenzar mi viaje gratuito',
    },
  },

  // Dashboard
  dashboard: {
    loading: 'Cargando tu panel...',
    stats: {
      streak: {
        label: 'Racha',
        unit: 'días',
      },
      xpEarned: {
        label: 'XP ganados',
        unit: 'puntos',
      },
      wordsLearned: {
        label: 'Palabras aprendidas',
        unit: 'palabras',
      },
      timeStudied: {
        label: 'Tiempo estudiado',
        unit: 'horas',
      },
      progress: {
        label: 'Progreso',
        unit: '%',
      },
      achievements: {
        label: 'Logros',
        unit: 'recientes',
      },
    },
    greetings: {
      morning: {
        japanese: 'おはよう',
        english: 'Buenos días',
      },
      afternoon: {
        japanese: 'こんにちは',
        english: 'Buenas tardes',
      },
      evening: {
        japanese: 'こんばんは',
        english: 'Buenas noches',
      },
    },
    navigation: {
      userMenuAria: 'Menú de usuario',
      account: 'Cuenta',
      settings: 'Configuración',
      adminDashboard: 'Panel de administración',
      backToDashboard: '← Volver al panel',
    },
    welcome: {
      firstVisit:
        '¡Bienvenido a tu aventura de aprendizaje de japonés! Doshi está aquí para guiarte.',
      returning: '¿Listo para continuar tu viaje? ¡Tu dedicación es inspiradora!',
      signoutToast: '¡Sayonara! ¡Hasta pronto! 👋',
      doshiClick: 'Doshi dice: ¡がんばって! (¡Buena suerte!)',
    },
    progress: {
      dailyGoal: {
        title: 'Objetivo diario',
        tooltip: 'Completa 30 minutos de estudio cada día',
        progressLabel: 'Progreso',
        encouragement: '¡Sigue así! ¡Estás al {{percentage}}%!',
      },
      achievement: {
        title: 'Último logro',
        earnedTime: 'Obtenido hace {{time}}',
      },
    },
    account: {
      title: 'Detalles de la cuenta',
      upgradeTooltip: '¡Actualiza a Premium para lecciones ilimitadas!',
      upgradeLink: 'Actualizar →',
      fields: {
        email: 'Correo electrónico',
        memberSince: 'Miembro desde',
        emailStatus: 'Estado del correo',
      },
      emailStatusValues: {
        verified: '✓ Verificado',
        pending: '⚠ Verificación pendiente',
      },
      defaultMemberSince: 'Unido recientemente',
    },
    developer: {
      modeTitle: 'Modo desarrollador',
      authTestLink: '→ Página de prueba de autenticación',
    },
    statModals: {
      close: '¡Entendido!',
      formulaLabel: 'Fórmula',
      breakdownLabel: 'Desglose',
      howToImproveLabel: 'Cómo mejorar',
      availableBonusesLabel: 'Bonificaciones disponibles',
      masteryLevelsLabel: 'Niveles de dominio',
      proTipLabel: 'Consejo profesional',
      streak: {
        title: 'Racha Diaria',
        description:
          'Tu racha muestra cuántos días consecutivos has practicado japonés con compromiso significativo.',
        formula: 'Días consecutivos con ≥10 XP ganados',
        whatItMeans:
          'Cada día que ganas al menos 10 XP (completando 1+ respuestas correctas en un ejercicio), tu racha aumenta en 1. Múltiples sesiones el mismo día no aumentan tu racha más.',
        howToImprove:
          '¡Practica todos los días! Incluso una sesión corta de 5 minutos cuenta. Establece un recordatorio diario y haz que la práctica del japonés sea parte de tu rutina.',
        breakdown: {
          current: 'Racha actual',
          longest: 'Racha más larga (de todos los tiempos)',
          lastActive: 'Última actividad',
          minXP: 'XP mínimo necesario por día',
        },
        goalNote:
          '¡Construye una racha de 7 días para desarrollar un fuerte hábito de aprendizaje!',
      },
      xpEarned: {
        title: 'XP Ganados',
        description:
          'Los Puntos de Experiencia (XP) miden tu actividad de aprendizaje y logros. Los XP se ganan a través de sesiones de práctica con bonos de precisión y velocidad.',
        formula: 'XP base + Bono de Precisión + Bono de Velocidad + Bono de Racha',
        whatItMeans:
          'Cada respuesta correcta gana XP base (10 puntos). ¡Alta precisión (≥90%) y respuestas rápidas pueden duplicar tus XP a través de bonos!',
        howToImprove:
          '¡Concéntrate primero en la precisión, luego en la velocidad! Completa sesiones de ejercicios completas, mantén alta precisión y construye rachas para maximizar XP.',
        breakdown: {
          total: 'XP totales ganados',
          currentLevel: 'Nivel actual',
          nextLevel: 'XP hasta el próximo nivel',
          dailyCap: 'Límite XP diario',
        },
        bonuses: {
          accuracy: 'Bono de precisión (≥90%): 2x XP',
          speed: 'Bono de velocidad (<2s prom): +10 XP',
          streak: 'Bono de racha (≥5): +3 XP por elemento',
        },
        goalNote:
          'Los XP diarios están limitados a 500 para fomentar una práctica equilibrada y sostenible.',
      },
      achievementProgress: {
        title: 'Progreso de Logros',
        description: 'Rastrea tu viaje desbloqueando logros mientras aprendes y practicas japonés.',
        formula: '(Desbloqueados / Total) × 100',
        whatItMeans: 'Este porcentaje muestra cuántos logros has ganado del total disponible.',
        howToImprove:
          'Completa ejercicios, mantén rachas diarias y practica regularmente para desbloquear más logros.',
        breakdown: {
          unlocked: 'Logros desbloqueados',
          total: 'Total disponible',
          completion: 'Tasa de completación',
        },
      },
      achievements: {
        title: 'Logros Desbloqueados',
        description:
          'Los logros son recompensas por alcanzar hitos en tu viaje de aprendizaje. Cada logro representa un logro específico.',
        formula: 'Conteo de logros desbloqueados',
        whatItMeans:
          'El número total de logros que has ganado a través de tu práctica y dedicación.',
        howToImprove:
          '¡Sigue practicando! Completa ejercicios, mantén rachas, alcanza objetivos de precisión y practica en diferentes momentos para desbloquear los 10 logros.',
        breakdown: {
          unlocked: 'Actualmente desbloqueados',
          available: 'Total disponible',
          earnMore: 'Cómo ganar más',
        },
        tips: '¡Prueba Madrugador (practica antes de las 6 AM) o Noctámbulo (practica después de las 10 PM) para logros fáciles!',
      },
      drillsCompleted: {
        title: 'Ejercicios Completados',
        description:
          'Cada sesión de ejercicios que completas ayuda a construir tus habilidades de conjugación japonesa. ¡La calidad cuenta más que la cantidad!',
        formula: 'Total de sesiones de ejercicios terminadas',
        whatItMeans:
          'El número de sesiones de ejercicios completas que has terminado, independientemente de la puntuación.',
        howToImprove:
          '¡Practica regularmente! Cada sesión cuenta para tu total y ayuda a construir memoria muscular para las conjugaciones.',
        breakdown: {
          total: 'Ejercicios totales',
          perfect: 'Ejercicios perfectos (100%)',
          types: 'Tipos de práctica',
        },
      },
      drillAccuracy: {
        title: 'Precisión de Ejercicios',
        description:
          'Tu precisión refleja qué tan bien comprendes las conjugaciones verbales japonesas en todas tus sesiones de práctica.',
        formula: '(Respuestas correctas / Respuestas totales) × 100',
        whatItMeans:
          'El porcentaje de preguntas que has respondido correctamente en TODOS los ejercicios. Se calcula acumulativamente, por lo que las mejoras recientes aumentarán gradualmente tu puntuación general.',
        example: 'Ejemplo: Si tuviste 12 respuestas correctas de 15 totales, tu precisión es 80%.',
        howToImprove:
          '¡Concéntrate en entender los patrones! Revisa las reglas de conjugación, tómate tu tiempo con cada pregunta y practica constantemente.',
        breakdown: {
          current: 'Precisión actual',
          total: 'Ejercicios totales completados',
          goal: 'Objetivo de precisión',
        },
        goalNote: '¡Apunta a 80% o más para mostrar una comprensión sólida!',
      },
      drillMastery: {
        title: 'Puntuación de Dominio de Ejercicios',
        description:
          'El dominio es una puntuación de calidad completa (0-100) que mide no solo cuánto practicas, sino qué tan bien practicas.',
        formula: 'Cálculo ponderado de 4 factores',
        whatItMeans:
          'Esta puntuación combina volumen, precisión, consistencia y proporción de ejercicios perfectos para darte una imagen completa de tu nivel de dominio.',
        factors: 'Los cuatro factores',
        howToImprove:
          '¡El equilibrio es clave! Practica regularmente (volumen), concéntrate en la precisión, apunta a sesiones perfectas y mantén la consistencia.',
        breakdown: {
          volume: 'Volumen (máx 30 pts)',
          volumeDetail: 'Basado en ejercicios totales completados',
          accuracy: 'Precisión (máx 40 pts)',
          accuracyDetail: 'Basado en tu % correcto',
          perfectRatio: 'Proporción Perfecta (20 pts)',
          perfectDetail: 'Sesiones 100% precisas',
          consistency: 'Consistencia (10 pts)',
          consistencyDetail: 'Patrón de práctica regular',
          total: 'Puntuación de Dominio Total',
        },
        masterLevels: {
          beginner: '0-30: Principiante - ¡Sigue practicando!',
          developing: '31-60: En desarrollo - ¡Estás mejorando!',
          proficient: '61-80: Competente - ¡Excelente trabajo!',
          expert: '81-100: Experto - ¡Excepcional!',
        },
      },
      learningProgress: {
        title: 'Progreso de Aprendizaje',
        description:
          'Tu progreso general en todas las categorías de aprendizaje (ejercicios, kana, kanji, vocabulario).',
        formula: '(Elementos dominados / Elementos iniciados) × 100',
        whatItMeans:
          'Esto muestra la calidad de tu aprendizaje, no solo la cantidad. Solo los elementos que has practicado realmente cuentan para tu progreso.',
        howToImprove:
          '¡Domina lo que has comenzado! Concéntrate en llevar los elementos incompletos al dominio antes de comenzar nuevos.',
        breakdown: {
          percentage: 'Progreso general',
          categoriesStarted: 'Categorías activas',
          itemsMastered: 'Elementos dominados',
        },
      },
      videosPracticed: {
        title: 'Videos Practicados',
        description:
          'El número total de videos únicos de YouTube a los que has accedido para practicar shadowing.',
        formula: 'Conteo de videos únicos cargados',
        whatItMeans:
          'Cada nuevo video que cargas para practicar shadowing cuenta para este total. Volver a visitar el mismo video no aumenta el conteo.',
        howToImprove:
          '¡Explora diferentes videos para practicar con varios hablantes, temas y patrones de habla!',
        breakdown: {
          total: 'Total de videos accedidos',
          thisWeek: 'Videos esta semana',
          quotaInfo: 'Información de cuota',
        },
        goalNote: '¡Practicar con contenido diverso mejora tu comprensión auditiva!',
      },
      videosRemaining: {
        title: 'Videos Restantes',
        description: 'El número de nuevos videos que puedes cargar hoy según tu cuota diaria.',
        formula: 'Límite diario − Videos cargados hoy',
        whatItMeans:
          'Tu cuota diaria se reinicia a medianoche UTC. Los videos previamente accedidos pueden practicarse ilimitadamente sin usar cuota.',
        howToImprove:
          '¡Actualiza a Premium para 20 videos por día, o vuelve a visitar tus videos favoritos para práctica ilimitada gratis!',
        breakdown: {
          remaining: 'Restantes hoy',
          limit: 'Límite diario',
          used: 'Usados hoy',
          resetTime: 'Se reinicia a las',
        },
        goalNote:
          '¡Los usuarios gratuitos obtienen 3 videos nuevos diarios, los usuarios Premium obtienen 20!',
      },
      watchTime: {
        title: 'Tiempo de Visualización',
        description:
          'El tiempo total que has pasado practicando activamente con videos de shadowing de YouTube.',
        formula: 'Suma de todas las duraciones de las sesiones de práctica',
        whatItMeans:
          'El tiempo se rastrea durante las sesiones de práctica reales. Esto mide tu compromiso constante con la práctica de shadowing.',
        howToImprove:
          '¡Practica regularmente! Incluso 10-15 minutos diarios construyen fuertes habilidades de escucha y pronunciación.',
        breakdown: {
          total: 'Tiempo total de visualización',
          thisWeek: 'Esta semana',
          thisMonth: 'Este mes',
          avgPerSession: 'Promedio por sesión',
        },
        goalNote: '¡Apunta a al menos 30 minutos de práctica de shadowing por semana!',
      },
    },
    greeting: {
      morning: 'Buenos días',
      afternoon: 'Buenas tardes',
      evening: 'Buenas noches',
    },
    villageHeader: {
      welcomeTo: 'BIENVENIDO A LA',
      learningVillage: 'VILLA DE APRENDIZAJE',
      editLayout: 'Editar Diseño',
    },
    learningVillage: {
      title: 'Bienvenido a la Villa de Aprendizaje',
      subtitle: 'Elige tu camino hacia el dominio del japonés',
      clickToStart: '¡Haz clic en cualquier puesto para comenzar tu viaje!',
    },
    districts: {
      foundation: 'Plaza de Principiantes',
      study: 'Centro de Estudio',
      immersion: 'Callejón de Inmersión',
      play: 'Distrito de Entretenimiento',
      community: 'Ayuntamiento',
    },
    cards: {
      hiragana: {
        title: 'Hiragana',
        subtitle: 'ひらがな',
        description: 'Domina la escritura fluida',
      },
      katakana: {
        title: 'Katakana',
        subtitle: 'カタカナ',
        description: 'Caracteres nítidos y angulares',
      },
      kanji: {
        title: 'Kanji',
        subtitle: '漢字',
        description: 'Caracteres chinos antiguos',
      },
      vocabulary: {
        title: 'Vocabulary',
        subtitle: '単語',
        description: 'Construye tu vocabulario',
      },
      grammar: {
        title: 'Grammar',
        subtitle: '文法',
        description: 'Aprende la estructura de oraciones',
      },
      particles: {
        title: 'Particles',
        subtitle: '助詞',
        description: 'Conecta tus palabras',
      },
      listening: {
        title: 'Listening',
        subtitle: '聴解',
        description: 'Entrena tu oído',
      },
      speaking: {
        title: 'Speaking',
        subtitle: '会話',
        description: 'Encuentra tu voz',
      },
      reading: {
        title: 'Reading',
        subtitle: '読解',
        description: 'Descifra la palabra escrita',
      },
      writing: {
        title: 'Writing',
        subtitle: '作文',
        description: 'Exprésate en texto',
      },
      culture: {
        title: 'Culture',
        subtitle: '文化',
        description: 'Comprende Japón profundamente',
      },
      business: {
        title: 'Business',
        subtitle: 'ビジネス',
        description: 'Japonés profesional',
      },
      travel: {
        title: 'Travel',
        subtitle: '旅行',
        description: 'Navega por Japón con facilidad',
      },
      food: {
        title: 'Food & Dining',
        subtitle: '料理',
        description: 'Pide como un local',
      },
      anime: {
        title: 'Anime & Manga',
        subtitle: 'アニメ',
        description: 'Aprende de tus favoritos',
      },
      games: {
        title: 'Games',
        subtitle: 'ゲーム',
        description: 'Aprende jugando',
      },
      music: {
        title: 'Music',
        subtitle: '音楽',
        description: 'Aprende a través de canciones',
      },
      news: {
        title: 'News',
        subtitle: 'ニュース',
        description: 'Noticias actuales en japonés',
      },
      jlpt: {
        title: 'JLPT',
        subtitle: 'Prep JLPT',
        description: 'Aprueba tu examen de competencia',
      },
      library: {
        title: 'Biblioteca',
        subtitle: '図書館',
        description: 'Leer libros condensados',
      },
      drill: {
        title: 'Ejercicios',
        subtitle: 'ドリル',
        description: 'Ejercicios rápidos',
      },
      youtubeSeries: {
        title: 'Series de YouTube',
        subtitle: 'シリーズ',
        description: 'Seguir canales de YouTube',
      },
      blog: {
        title: 'Blog',
        subtitle: 'ブログ',
        description: 'Leer artículos y actualizaciones',
      },
      resources: {
        title: 'Recursos',
        subtitle: 'リソース',
        description: 'Recursos de aprendizaje',
      },
      achievements: {
        title: 'Logros',
        subtitle: '成果',
        description: 'Seguir tu progreso',
      },
      todos: {
        title: 'Gestor de Tareas',
        subtitle: 'タスク管理',
        description: 'Organiza tus tareas y objetivos de estudio',
      },
      favourites: {
        title: 'Mis Favoritos',
        subtitle: 'Guardados',
        description: 'Revisar elementos guardados',
      },
      myLists: {
        title: 'Mis Listas',
        subtitle: 'Listas personales',
        description: 'Gestionar listas personalizadas',
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
        title: 'Mis Videos',
        subtitle: 'Videos',
        description: 'Tus videos guardados',
      },
      flashcards: {
        title: 'Tarjetas Flash',
        subtitle: 'Tarjetas',
        description: 'Crear y estudiar mazos de tarjetas',
      },
    },
    achievements: {
      title: 'Logros',
      unlocked: 'desbloqueados',
      points: 'puntos',
      complete: 'completado',
      categories: {
        all: 'Todos',
        progress: 'Progreso',
        streak: 'Racha',
        accuracy: 'Precisión',
        speed: 'Velocidad',
        special: 'Especial',
      },
      latest: 'Último Logro',
      tabs: {
        overview: 'Resumen',
        progress: 'Progreso',
        insights: 'Análisis',
      },
      stats: '{{unlocked}}/{{total}} desbloqueados • {{points}} puntos • {{percent}}% completado',
      latestAchievement: 'Último Logro',
      readyToStart: '¡Listo para comenzar!',
      firstLesson: 'Completa tu primera lección para obtener logros',
      yourJourney: 'Tu viaje comienza ahora',
    },
    dailyGoal: {
      title: 'Objetivo Diario',
      progress: 'Progreso',
      minutes: '{{min}}/30 min',
      startPractice: '¡Comienza tu práctica diaria para alcanzar tu objetivo!',
    },
    accountDetails: {
      title: 'Detalles de la Cuenta',
      email: 'Correo Electrónico',
      emailStatus: 'Estado del Correo',
      verified: 'Verificado',
      memberSince: 'Miembro Desde',
      recentlyJoined: 'Unido recientemente',
      upgrade: 'Actualizar',
    },
    developerMode: 'Modo Desarrollador',
    authTestPage: 'Página de Prueba de Autenticación',
  },

  // Auth Pages
  auth: {
    signin: {
      branding: {
        logoText: 'も',
      },
      page: {
        title: '¡Bienvenido de nuevo!',
        subtitle: 'Inicia sesión para continuar aprendiendo japonés',
      },
      form: {
        labels: {
          email: 'Correo electrónico',
          password: 'Contraseña',
        },
        placeholders: {
          email: 'tu@ejemplo.com',
          password: '••••••••',
        },
        checkbox: 'Recordarme',
        submitButton: {
          default: 'Iniciar sesión',
          loading: 'Iniciando sesión...',
        },
      },
      links: {
        forgotPassword: '¿Olvidaste tu contraseña?',
        signupLink: '¿No tienes cuenta? Regístrate gratis',
      },
      alternativeAuth: {
        divider: 'O continúa con',
        magicLinkButton: 'Enviar enlace mágico',
        googleButton: 'Continuar con Google',
      },
      messages: {
        signupSuccess: '¡Cuenta creada! Por favor inicia sesión.',
        signinSuccess: '¡Bienvenido de nuevo!',
        magicLinkError: 'Por favor ingresa tu correo electrónico para continuar.',
        magicLinkSuccess: '¡Revisa tu correo para el enlace mágico!',
      },
      errors: {
        signinFailed: 'Error al iniciar sesión',
        sessionCreationFailed: 'Error al crear sesión',
        magicLinkFailed: 'Error al enviar enlace mágico',
        firebaseNotInitialized: 'Firebase no inicializado',
      },
    },
    signup: {
      page: {
        title: 'Comienza tu viaje',
        subtitle: 'Crea una cuenta gratuita para aprender japonés',
      },
      form: {
        labels: {
          name: 'Nombre (opcional)',
          email: 'Correo electrónico',
          password: 'Contraseña',
        },
        placeholders: {
          name: 'Tu nombre',
          email: 'tu@ejemplo.com',
          password: '••••••••',
        },
        passwordRequirements:
          'Al menos 8 caracteres con 1 mayúscula, 1 número y 1 carácter especial',
        termsAgreement: 'Acepto los {{terms}} y la {{privacy}}',
        termsLink: 'Términos de servicio',
        privacyLink: 'Política de privacidad',
        submitButton: {
          default: 'Crear cuenta gratuita',
          loading: 'Creando cuenta...',
        },
      },
      links: {
        signinLink: '¿Ya tienes cuenta? Inicia sesión',
      },
      alternativeAuth: {
        divider: 'O regístrate con',
        magicLinkButton: 'Registrarse con enlace mágico',
        googleButton: 'Continuar con Google',
      },
      magicLink: {
        title: 'Registro con enlace mágico',
        subtitle: 'Te enviaremos un enlace para iniciar sesión al instante',
        sendButton: 'Enviar enlace mágico',
        sending: 'Enviando...',
        backButton: 'Volver al registro normal',
        successTitle: '¡Revisa tu correo!',
        successMessage: 'Hemos enviado un enlace mágico a',
        successDescription: 'Haz clic en el enlace del correo para iniciar sesión.',
        tryDifferentMethod: 'Probar un método diferente',
      },
      messages: {
        signupSuccess: '¡Cuenta creada con éxito! Ahora puedes iniciar sesión.',
        googleNewUser: '¡Bienvenido a Moshimoshi! ¡Comencemos tu viaje de aprendizaje de japonés!',
        googleExistingUser: '¡Bienvenido de nuevo!',
        magicLinkSent: '¡Enlace mágico enviado! Revisa tu correo para iniciar sesión.',
      },
      errors: {
        signupFailed: 'Error al registrarse',
        sessionCreationFailed: 'Error al crear sesión',
        firebaseNotInitialized: 'Firebase no inicializado',
        magicLinkFailed: 'Error al enviar el enlace mágico',
      },
    },
  },

  // Admin Dashboard
  admin: {
    pageTitle: 'Vista general del panel',
    pageDescription: '¡Bienvenido de nuevo! Esto es lo que está pasando con Moshimoshi hoy.',
    loading: 'Cargando panel de administración...',
    errorMessages: {
      loadingError: 'Error al cargar el panel:',
      fetchError: 'Error al obtener estadísticas',
      generalError: 'Ha ocurrido un error',
    },
    statCards: {
      totalUsers: 'Usuarios totales',
      activeToday: 'Activos hoy',
      newUsersToday: 'Nuevos usuarios hoy',
      activeSubscriptions: 'Suscripciones activas',
      monthlyRevenue: 'Ingresos mensuales',
      trialUsers: 'Usuarios de prueba',
      totalLessons: 'Lecciones totales',
      completedToday: 'Completadas hoy',
    },
    youtubeSeries: {
      title: 'Gestión de series de YouTube',
      description: 'Gestionar canales de YouTube y series de videos para contenido de aprendizaje',
      channels: 'Canales de YouTube',
      totalChannels: 'Total de canales',
      totalVideos: 'Total de videos',
      addChannel: 'Añadir canal',
      syncVideos: 'Sincronizar videos',
      syncing: 'Sincronizando...',
      lastSync: 'Última sincronización',
      videoCount: '{{count}} videos',
      monitoringEnabled: 'Monitoreo activado',
      monitoringDisabled: 'Monitoreo desactivado',
      deleteChannel: 'Eliminar canal',
      confirmDelete: '¿Está seguro de que desea eliminar este canal?',
      channelUrl: 'URL del canal o video',
      channelUrlPlaceholder: 'https://www.youtube.com/@channelname o URL del video',
      fetchingInfo: 'Obteniendo información del canal...',
      addChannelButton: 'Añadir canal',
      settings: 'Configuración',
      enableMonitoring: 'Habilitar monitoreo automático',
      checkInterval: 'Intervalo de verificación (horas)',
      resourceGeneration: 'Generación de recursos',
      autoGenerate: 'Generar recursos de aprendizaje automáticamente',
      includeTranscripts: 'Incluir transcripciones',
      generateQuizzes: 'Generar cuestionarios',
      generateVocabulary: 'Generar listas de vocabulario',
      errors: {
        fetchFailed: 'Error al obtener información del canal',
        addFailed: 'Error al añadir el canal',
        syncFailed: 'Error al sincronizar videos',
        deleteFailed: 'Error al eliminar el canal',
        loadFailed: 'Error al cargar canales',
        invalidUrl: 'Por favor, ingrese una URL válida de canal o video de YouTube',
        channelExists: 'Este canal ya ha sido añadido',
      },
      success: {
        channelAdded: 'Canal añadido exitosamente',
        syncComplete: 'Videos sincronizados exitosamente',
        channelDeleted: 'Canal eliminado exitosamente',
        settingsUpdated: 'Configuración actualizada exitosamente',
      },
      empty: {
        noChannels: 'No se han añadido canales de YouTube',
        addFirst: 'Añade tu primer canal para comenzar a importar videos',
      },
      stats: {
        videosAdded: '{{added}} videos añadidos',
        videosUpdated: '{{updated}} videos actualizados',
        totalProcessed: '{{total}} videos procesados',
      },
    },
    sections: {
      quickActions: 'Acciones rápidas',
      recentUsers: 'Usuarios recientes',
      systemStatus: 'Estado del sistema',
      newsScraping: 'Recolección de noticias',
    },
    quickActionButtons: {
      moodBoards: 'Tableros de estado de ánimo',
      users: 'Usuarios',
      content: 'Contenido',
      analytics: 'Análisis',
    },
    systemMetrics: {
      database: 'Base de datos',
      operational: 'Operacional',
      apiResponseTime: 'Tiempo de respuesta API',
      cacheHitRate: 'Tasa de caché',
      errorRate: 'Tasa de errores',
      uptime: 'Tiempo de actividad',
    },
    userLabels: {
      user: 'Usuario',
      noRecentUsers: 'No hay usuarios recientes',
      daysAgo: 'hace {{days}} días',
      hoursAgo: 'hace {{hours}}h',
      minutesAgo: 'hace {{minutes}} min',
      justNow: 'Ahora mismo',
    },
    newsScraping: {
      nhkEasy: 'NHK Easy',
      nhkSchedule: 'Cada 4 horas',
      watanoc: 'Watanoc',
      watanocSchedule: 'Cada 6 horas',
      mainichiShogakusei: 'Mainichi Shogakusei',
      mainichiSchedule: 'Diario a las 10:00',
      scrapingArticles: 'Recopilando artículos...',
    },
    resources: {
      title: 'Recursos',
      description: 'Gestionar publicaciones del blog y recursos de aprendizaje',
      newResource: 'Nuevo Recurso',
      searchResources: 'Buscar recursos...',
      allStatus: 'Todos los estados',
      published: 'Publicado',
      draft: 'Borrador',
      scheduled: 'Programado',
      selected: 'seleccionado(s)',
      deleteSelected: 'Eliminar selección',
      clearSelection: 'Limpiar selección',
      loadingResources: 'Cargando recursos...',
      noResourcesFound: 'No se encontraron recursos',
      noResourcesMatching: 'Ningún recurso coincide con tu búsqueda',
      selectAll: 'Seleccionar todo',
      featured: 'Destacado',
      uncategorized: 'Sin categoría',
      views: 'vistas',
      edit: 'Editar',
      view: 'Ver',
      delete: 'Eliminar',
      actions: 'Acciones',
      status: 'Estado',
      category: 'Categoría',
      updated: 'Actualizado',
      totalPosts: 'Total de publicaciones',
      totalViews: 'Total de vistas',
      deleteResource: 'Eliminar recurso',
      deleteResourceConfirm:
        '¿Estás seguro de que deseas eliminar este recurso? Esta acción no se puede deshacer.',
      deleteResources: 'Eliminar recursos',
      deleteResourcesConfirm:
        '¿Estás seguro de que deseas eliminar {count} recursos? Esta acción no se puede deshacer.',
      error: 'Error',
      failedToDelete: 'Error al eliminar el recurso',
      failedToDeleteSome: 'Error al eliminar algunos recursos',
      createResource: 'Crear recurso',
      editResource: 'Editar recurso',
      basicInfo: 'Información básica',
      content: 'Contenido',
      publishingOptions: 'Opciones de publicación',
      seo: 'SEO',
      featuredImage: 'Imagen destacada',
      tags: 'Etiquetas',
      addTag: 'Añadir etiqueta',
      removeTag: 'Eliminar etiqueta',
      uploadImage: 'Subir imagen',
      imageUrl: 'URL de imagen',
      imageAlt: 'Texto alternativo de imagen',
      readingTime: 'Tiempo de lectura',
      minRead: 'min de lectura',
      quickCreate: 'Creación rápida desde URL',
      preview: 'Vista previa',
      cancel: 'Cancelar',
      save: 'Guardar',
      create: 'Crear',
      update: 'Actualizar',
      required: 'Requerido',
      optional: 'Opcional',
    },
  },

  // Account Page
  account: {
    pageTitle: 'アカウント',
    pageDescription: 'Gestiona la configuración de tu cuenta',
    loadingMessage: 'Cargando tu cuenta...',
    sections: {
      profileInformation: 'Información del perfil',
      accountStatistics: 'Estadísticas de la cuenta',
      subscription: 'Suscripción',
      dangerZone: 'Zona de peligro',
    },
    profileFields: {
      profilePhoto: 'Foto de perfil',
      photoDescription: 'JPG, PNG o GIF. Máx 2MB.',
      displayName: 'Nombre para mostrar',
      namePlaceholder: 'Ingresa tu nombre',
      emailAddress: 'Dirección de correo',
      verified: 'Verificado',
      verify: 'Verificar',
    },
    validation: {
      displayNameRequired: 'El nombre para mostrar no puede estar vacío',
      displayNameTooLong: 'El nombre para mostrar debe tener 50 caracteres o menos',
      displayNameInvalid: 'El nombre para mostrar contiene caracteres no válidos',
    },
    buttons: {
      saveChanges: 'Guardar cambios',
      updating: 'Actualizando...',
      deleteAccount: 'Eliminar cuenta',
      upgradeText: 'Actualizar a Premium',
      manageSubscription: 'Gestionar suscripción →',
    },
    statistics: {
      daysActive: 'Días activo',
      wordsLearned: 'Palabras aprendidas',
      achievements: 'Logros',
      dayStreak: 'Racha de días',
    },
    subscription: {
      premium: 'PREMIUM',
      free: 'GRATIS',
      plan: 'Plan',
      nextBilling: 'Próxima facturación',
      premiumMonthly: 'Premium mensual',
      premiumYearly: 'Premium anual',
      freePlan: 'Plan gratuito',
      manageSubscription: 'Gestionar suscripción',
      upgradeToPremium: 'Actualizar a Premium',
      currentPlan: 'Plan actual',
      upgradeText: 'Actualiza para desbloquear sesiones de práctica ilimitadas y funciones premium',
      title: 'Tu suscripción',
      status: 'Estado',
      active: 'Activo',
      inactive: 'Inactivo',
      canceled: 'Cancelado',
      trialEnds: 'La prueba termina',
      renews: 'Se renueva',
      expires: 'Expira',
      managePayment: 'Gestionar pago',
      cancelSubscription: 'Cancelar suscripción',
      reactivate: 'Reactivar',
      upgradeOptions: 'Opciones de actualización',
      choosePlan: 'Elige tu plan',
      recommended: 'Recomendado',
      mostPopular: 'Más popular',
      bestValue: 'Mejor valor',
      perMonth: '/mes',
      perYear: '/año',
      billed: 'Facturado {{amount}} {{period}}',
      monthly: 'mensualmente',
      yearly: 'anualmente',
      features: {
        title: 'Características incluidas',
        unlimited: 'Sesiones de práctica ilimitadas',
        srs: 'Repetición espaciada avanzada',
        offline: 'Modo sin conexión',
        analytics: 'Análisis detallado',
        priority: 'Soporte prioritario',
        customization: 'Personalización del camino de aprendizaje',
        ai: 'Tutor IA personalizado',
        certificates: 'Certificados de progreso',
      },
      upgrade: {
        title: 'Desbloquea tu potencial completo',
        subtitle: 'Actualiza a Premium y acelera tu viaje de aprendizaje del japonés',
        cta: 'Actualizar ahora',
        processing: 'Procesando...',
      },
      invoice: {
        title: 'Historial de facturas',
        noInvoices: 'No hay facturas disponibles todavía',
        date: 'Fecha',
        description: 'Descripción',
        amount: 'Monto',
        status: 'Estado',
        actions: 'Acciones',
        download: 'Descargar PDF',
        subscription: 'Suscripción',
        statuses: {
          paid: 'Pagado',
          open: 'Abierto',
          void: 'Anulado',
          uncollectible: 'Incobrable',
        },
      },
      billing: {
        title: 'Información de facturación',
        nextBillingDate: 'Próxima fecha de facturación',
        paymentMethod: 'Método de pago',
        cardEnding: 'Tarjeta terminada en {{last4}}',
        updatePayment: 'Actualizar método de pago',
        billingHistory: 'Historial de facturación',
        downloadInvoice: 'Descargar factura',
      },
    },
    dangerZone: {
      description:
        'Elimina tu cuenta y todos los datos asociados. Esta acción no se puede deshacer.',
    },
    deleteAccountDialog: {
      title: '¿Eliminar cuenta?',
      message:
        '¿Estás seguro de que quieres eliminar tu cuenta? Esto eliminará permanentemente todos tus datos, incluidos el progreso, los logros y la suscripción. Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar mi cuenta',
      cancelText: 'Cancelar',
    },
    toastMessages: {
      profileUpdated: '¡Perfil actualizado con éxito!',
      accountDeletionRequested: 'Eliminación de cuenta solicitada. Por favor contacta con soporte.',
    },
  },

  // UI Components
  components: {
    alert: {
      dismissAriaLabel: 'Cerrar alerta',
    },
    dialog: {
      defaultConfirm: 'Confirmar',
      defaultCancel: 'Cancelar',
      processing: 'Procesando...',
    },
    doshi: {
      loading: 'Cargando Doshi...',
      altText: 'Doshi - Tu compañero de aprendizaje',
      failedToLoad: 'Error al cargar la animación del panda rojo',
      ariaLabel: '{{alt}} - Clic para interactuar',
      moodAria: 'Doshi está {{mood}}',
    },
    drawer: {
      closeAriaLabel: 'Cerrar cajón',
    },
    loading: {
      default: 'Cargando...',
      closeAriaLabel: 'Cerrar',
    },
    modal: {
      closeAriaLabel: 'Cerrar modal',
    },
    theme: {
      lightAriaLabel: 'Tema claro',
      systemAriaLabel: 'Tema del sistema',
      darkAriaLabel: 'Tema oscuro',
    },
    toast: {
      closeAriaLabel: 'Cerrar',
      errorMessage: 'useToast debe usarse dentro de ToastProvider',
    },
  },

  // Error Messages (User-Friendly)
  errors: {
    auth: {
      popupClosed: 'Inicio de sesión cancelado. Por favor inténtalo de nuevo cuando estés listo.',
      networkFailed: 'Problema de conexión. Por favor verifica tu internet e inténtalo de nuevo.',
      tooManyRequests: 'Demasiados intentos. Por favor espera un momento e inténtalo de nuevo.',
      userDisabled: 'Esta cuenta ha sido deshabilitada. Por favor contacta con soporte.',
      userNotFound: 'No se encontró cuenta con este correo. Por favor verifica o regístrate.',
      wrongPassword: 'Contraseña incorrecta. Por favor inténtalo de nuevo.',
      invalidEmail: 'Por favor ingresa una dirección de correo válida.',
      emailInUse: 'Este correo ya está registrado. Por favor inicia sesión en su lugar.',
      weakPassword: 'Por favor elige una contraseña más fuerte (al menos 6 caracteres).',
      invalidCredential: 'Credenciales inválidas. Por favor verifica e inténtalo de nuevo.',
      requiresRecentLogin: 'Por favor inicia sesión de nuevo para completar esta acción.',
      unauthorized: 'Este dominio no está autorizado. Por favor contacta con soporte.',
      invalidActionCode: 'Este enlace ha expirado o es inválido. Por favor solicita uno nuevo.',
    },
    validation: {
      invalidInput: 'Por favor verifica tu información e inténtalo de nuevo.',
    },
    network: {
      connectionIssue: 'Problema de conexión. Por favor verifica tu internet.',
      timeout: 'La solicitud ha expirado. Por favor inténtalo de nuevo.',
      offline: 'Parece que estás sin conexión. Por favor verifica tu conexión.',
    },
    payment: {
      authenticationFailure: 'Fallo en la autenticación del pago. Por favor inténtalo de nuevo.',
      cardDeclined: 'Tarjeta rechazada. Por favor prueba otro método de pago.',
      expiredCard: 'Tu tarjeta ha expirado. Por favor actualiza tu información de pago.',
      insufficientFunds: 'Fondos insuficientes. Por favor prueba otro método de pago.',
      subscriptionRequired: 'Se requiere suscripción Premium para esta función.',
      subscriptionExpired: 'Tu suscripción ha expirado. Por favor renueva para continuar.',
    },
    permission: {
      denied: 'No tienes permiso para realizar esta acción.',
      unauthorized: 'Por favor inicia sesión para continuar.',
      forbidden: 'Acceso denegado. Por favor contacta con soporte si crees que es un error.',
    },
    resource: {
      notFound: 'El contenido solicitado no se pudo encontrar.',
      exhausted: 'Límite diario alcanzado. Por favor inténtalo mañana.',
      alreadyExists: 'Esto ya existe. Por favor elige un nombre diferente.',
    },
    server: {
      internal: 'Algo salió mal de nuestro lado. Por favor inténtalo de nuevo.',
      serverError: 'Error del servidor. Nuestro equipo ha sido notificado.',
      unavailable: 'Servicio temporalmente no disponible. Por favor inténtalo más tarde.',
    },
    generic: {
      unknown: 'Ocurrió un error inesperado. Por favor inténtalo de nuevo.',
      somethingWrong: 'Algo salió mal. Por favor inténtalo de nuevo.',
    },
  },

  // Kana Learning System
  kana: {
    title: 'Hiragana y Katakana',
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    combined: 'Práctica combinada',

    navigation: {
      backToGrid: 'Volver a caracteres',
      characters: 'Caracteres',
      nextCharacter: 'Siguiente carácter',
      previousCharacter: 'Carácter anterior',
      startStudy: 'Comenzar a estudiar',
      startReview: 'Comenzar repaso',
      viewAll: 'Ver todo',
    },

    categories: {
      all: 'Todos los caracteres',
      vowels: 'Vocales',
      basic: 'Básico',
      dakuten: 'Dakuten',
      handakuten: 'Handakuten',
      digraphs: 'Dígrafos',
      special: 'Especial',
    },

    study: {
      studyMode: 'Modo estudio',
      flipCard: 'Toca para voltear',
      showRomaji: 'Mostrar Romaji',
      hideRomaji: 'Ocultar Romaji',
      playSound: 'Reproducir sonido',
      exampleWords: 'Palabras de ejemplo',
      strokeOrder: 'Orden de trazos',
      pinToReview: 'Fijar para repaso',
      unpinFromReview: 'Quitar de repaso',
      markAsLearned: 'Marcar como aprendido',
      learned: 'Aprendido',
      pronunciation: 'Pronunciación',
    },

    review: {
      reviewMode: 'Modo repaso',
      recognition: 'Reconocimiento',
      recall: 'Recordar',
      listening: 'Escuchar',
      selectAnswer: 'Selecciona la respuesta correcta',
      typeAnswer: 'Escribe la respuesta',
      correct: '¡Correcto!',
      incorrect: 'Intenta de nuevo',
      showAnswer: 'Mostrar respuesta',
      nextQuestion: 'Siguiente pregunta',
      skipQuestion: 'Saltar',
      endReview: 'Terminar repaso',
      reviewComplete: '¡Repaso completado!',
      accuracy: 'Precisión',
      timeSpent: 'Tiempo empleado',
      itemsReviewed: 'Elementos repasados',
    },

    progress: {
      learned: 'Aprendido',
      learning: 'Aprendiendo',
      notStarted: 'No iniciado',
      mastered: 'Dominado',
      totalProgress: 'Progreso total',
      charactersMastered: 'Caracteres dominados',
      reviewStreak: 'Racha de repasos',
      lastReviewed: 'Último repaso',
      nextReview: 'Próximo repaso',
    },

    filters: {
      showAll: 'Mostrar todo',
      showLearned: 'Mostrar aprendidos',
      showNotStarted: 'Mostrar no iniciados',
      filterByType: 'Filtrar por tipo',
      display: 'Mostrar',
      sortBy: 'Ordenar por',
      alphabetical: 'Alfabético',
      difficulty: 'Dificultad',
      progress: 'Progreso',
      scriptType: 'Tipo de escritura',
    },

    selectAllInRow: 'Seleccionar todos los {{count}} caracteres en esta fila',
    combinedPractice: 'Práctica combinada',

    browse: {
      browseAll: 'Explorar todos los {{count}} caracteres organizados por tipo',
      selectToStudy: 'Seleccionar caracteres para estudiar',
      selectToReview: 'Seleccionar caracteres para repasar',
      searchPlaceholder: 'Buscar kana por romaji, carácter...',
      searchResults: 'Resultados de búsqueda',
      resultsFound: '{{count}} encontrados',
      noResultsFound: 'No se encontraron caracteres que coincidan con "{{query}}"',
      allCharacters: 'Todos los caracteres',
      charactersLabel: 'caracteres',
      basicLabel: 'Básico',
      basicDescription: 'Caracteres básicos (46)',
      dakutenLabel: 'Dakuten',
      dakutenDescription: 'Consonantes sonoras',
      digraphsLabel: 'Dígrafos',
      digraphsDescription: 'Caracteres combinados',
    },

    kanji: {
      study: {
        skip: 'Saltar',
        examples: 'Ejemplos',
        markAsLearned: 'Marcar como aprendido',
        noExamples: 'No hay ejemplos disponibles',
      },
    },

    tooltips: {
      clickToStudy: 'Clic para estudiar este carácter',
      rightClickToPin: 'Clic derecho para fijar para repaso',
      dragToReorder: 'Arrastra para reordenar',
      progressInfo: 'Has aprendido {{learned}} de {{total}} caracteres',
    },

    messages: {
      loadingCharacters: 'Cargando caracteres...',
      noCharactersFound: 'No se encontraron caracteres',
      pinnedSuccess: 'Carácter fijado para repaso',
      unpinnedSuccess: 'Carácter quitado de repaso',
      markedAsLearned: 'Carácter marcado como aprendido',
      reviewStarting: 'Iniciando sesión de repaso...',
      studyStarting: 'Iniciando sesión de estudio...',
      progressSaved: 'Progreso guardado',
      audioNotAvailable: 'Audio no disponible para este carácter',
    },
  },

  // News Feature
  news: {
    page: 'Página',
    filters: {
      title: 'Filtros',
      applied: 'Aplicado',
      level: 'Nivel',
      source: 'Fuente',
      month: 'Mes',
      day: 'Día',
    },
    reader: {
      settings: 'Configuración de lectura',
      summary: 'Resumen',
      fontSize: 'Tamaño del texto',
      fontSizes: {
        small: 'P',
        medium: 'M',
        large: 'G',
        xlarge: 'MG',
      },
      showFurigana: 'Mostrar furigana',
      withFurigana: 'Con furigana',
      highlightGrammar: 'Resaltar gramática',
      highlightAll: 'Todas las palabras',
      highlightContent: 'Palabras de contenido',
      highlightGrammarOnly: 'Solo gramática',
      shadowingMode: 'Modo de sombreado',
      playbackSpeed: 'Velocidad de reproducción',
      repeatCount: 'Número de repeticiones',
      translation: 'Traducción',
      viewOriginal: 'Ver original',
      lookupWord: 'Haz clic en una palabra para ver su definición',
      wordNotFound: 'Palabra no encontrada',
      loading: 'Cargando definición...',
      reading: 'Lectura',
      meaning: 'Significado',
      type: 'Tipo',
      saveToList: 'Guardar en lista',
      savedToList: 'Guardado en la lista de estudio',
    },
    error: {
      loadFailed: 'Error al cargar el artículo',
      notFound: 'Artículo no encontrado',
      goBack: 'Volver a la lista de noticias',
    },
  },

  // Subscription & Entitlements
  subscription: {
    status: {
      active: 'Activo',
      inactive: 'Inactivo',
      canceled: 'Cancelado',
      pastDue: 'Pago vencido',
      trialing: 'Prueba',
      incomplete: 'Incompleto',
    },
    plans: {
      free: 'Plan gratuito',
      guest: 'Invitado',
      premiumMonthly: 'Premium mensual',
      premiumYearly: 'Premium anual',
    },
    badges: {
      mostPopular: 'Más popular',
      recommended: 'Recomendado',
      bestValue: 'Mejor valor',
    },
    billing: {
      monthly: 'Mensual',
      yearly: 'Anual',
      perMonth: 'por mes',
      perYear: 'por año',
      save: 'Ahorra {{percent}}%',
    },
    actions: {
      upgrade: 'Mejorar a Premium',
      upgradeToPlan: 'Mejorar a {{plan}}',
      downgrade: 'Degradar',
      manageBilling: 'Gestionar facturación',
      manageSubscription: 'Gestionar suscripción',
      cancelSubscription: 'Cancelar suscripción',
      currentPlan: 'Plan actual',
      signUpFree: 'Registrarse gratis',
      startFreeTrial: 'Iniciar prueba gratuita',
      upgradeNow: 'Mejorar ahora',
      viewPlans: 'Ver planes',
      choosePlan: 'Elegir plan',
    },
    features: {
      unlimited: 'Sesiones de práctica ilimitadas',
      cancelAnytime: 'Cancela en cualquier momento',
      bestValue: 'Mejor valor - Ahorra 25%',
      advancedSRS: 'Algoritmo SRS avanzado',
      detailedAnalytics: 'Análisis detallados del progreso',
      prioritySupport: 'Soporte prioritario',
      offlineMode: 'Modo sin conexión',
      savePercentage: 'Ahorra 25% comparado con el plan mensual',
      monthsFree: '2 meses gratis',
      earlyAccess: 'Acceso temprano a nuevas características',
      personalizedInsights: 'Perspectivas de aprendizaje personalizadas',
    },
    upgrade: {
      selectMonthly: 'Elegir Mensual',
      selectYearly: 'Elegir Anual',
      title: 'Elige Tu Plan',
      description: 'Selecciona el plan que mejor funcione para ti',
    },
    checkout: {
      selectPlan: 'Seleccionar plan',
      paymentMethod: 'Método de pago',
      billingInfo: 'Información de facturación',
      orderSummary: 'Resumen del pedido',
      total: 'Total',
      processingPayment: 'Procesando pago...',
      paymentFailed: 'Pago fallido',
      paymentSuccess: '¡Pago exitoso!',
      success: '🎉 ¡Bienvenido a Premium! Tu suscripción se está activando...',
      canceled:
        'Pago cancelado. Puedes actualizar en cualquier momento desde la configuración de tu cuenta.',
    },
    messages: {
      welcomeToPremium: '🎉 ¡Bienvenido a Premium! Tu suscripción está ahora activa.',
      subscriptionUpdated: 'Tu suscripción ha sido actualizada.',
      subscriptionCanceled: 'Tu suscripción terminará el {{date}}',
      alreadyOnPlan: '¡Ya estás en este plan!',
      alreadySubscribed: '¡Ya estás suscrito a este plan!',
      processing: 'Procesando...',
      loadingPricing: 'Cargando precios...',
    },
    renewal: {
      nextBilling: 'Próxima facturación',
      renews: 'Se renueva',
      ends: 'Termina',
      daysRemaining: '{{days}} días restantes',
      willEndOn: 'Tu suscripción terminará el {{date}}',
    },
    errors: {
      paymentFailed: 'Pago fallido. Inténtalo con un método de pago diferente.',
      subscriptionNotFound: 'Suscripción no encontrada.',
      alreadySubscribed: 'Ya estás suscrito a este plan.',
      invalidPlan: 'Plan inválido seleccionado.',
      processingError: 'Error de procesamiento. Inténtalo más tarde.',
      checkoutFailed: 'No se pudo iniciar el pago. Inténtalo de nuevo.',
      billingPortalFailed: 'No se pudo abrir el portal de facturación. Inténtalo de nuevo.',
      cancelFailed: 'No se pudo cancelar la suscripción. Inténtalo de nuevo.',
    },
  },

  // Pricing Comparison
  pricingComparison: {
    badge: 'TODAS LAS FUNCIONES COMBINADAS',
    title: 'Una app, cada función',
    subtitle:
      '¿Por qué pagar por múltiples aplicaciones? Moshimoshi combina todas las funciones premium que necesitas para tu viaje de aprendizaje del japonés.',
    tableTitle: 'Compara el valor',
    priceColumn: 'Precio',
    featuresColumn: 'Características',
    actionButton: 'Comenzar prueba gratuita',
    actionSecondary: 'Ver todas las funciones',

    moshimoshi: {
      name: 'Moshimoshi',
      price: '£8.99/mes',
      yearlyPrice: '£99.9/año',
      description: 'Solución completa de aprendizaje',
      cta: 'Mejor valor',
      features: {
        gamification: 'Gamificación y motivación',
        youtube: 'YouTube shadowing',
        aiStories: 'Historias IA personalizadas',
        kanjiBreakdown: 'Desglose de Kanji',
        newsReading: 'Lectura de noticias',
        ankiExport: 'Exportación a Anki',
        pitchAccent: 'Entrenamiento de acento tonal',
        srsReviews: 'Sistema SRS inteligente',
        dictionary: 'Diccionario integrado',
        grammarGuide: 'Guías gramaticales',
        offline: 'Aprendizaje sin conexión',
        analytics: 'Análisis detallados',
      },
    },

    competitors: {
      duolingo: {
        name: 'Duolingo',
        price: '£47.99/año',
        features: ['Gamificación', 'Lecciones básicas', 'Seguimiento de rachas'],
        missing: [
          'YouTube shadowing',
          'Historias IA',
          'Desglose de Kanji',
          'Lectura de noticias',
          'Exportación a Anki',
        ],
      },
      heyjapan: {
        name: 'HeyJapan',
        price: '$33.99-$48.99',
        features: ['Práctica de conversación', 'Reconocimiento de voz', 'Clases en vivo'],
        missing: [
          'YouTube shadowing',
          'Gamificación',
          'SRS',
          'Exportación a Anki',
          'Lectura de noticias',
        ],
      },
      miraa: {
        name: 'Miraa',
        price: '£5.49/mes',
        features: ['Lectura de manga', 'Búsqueda en diccionario', 'Exportación a Anki'],
        missing: [
          'Historias IA',
          'YouTube shadowing',
          'Gamificación',
          'Práctica de conversación',
          'Lecciones de gramática',
        ],
      },
      satoriReader: {
        name: 'Satori Reader',
        price: '£8.49/mes',
        features: ['Artículos graduados', 'Explicaciones gramaticales', 'Audio'],
        missing: [
          'YouTube shadowing',
          'Historias IA',
          'Gamificación',
          'Exportación a Anki',
          'Práctica de conversación',
        ],
      },
      takoboto: {
        name: 'Takoboto',
        price: '£25.49',
        features: ['Diccionario sin conexión', 'Ejemplos', 'Conjugaciones'],
        missing: [
          'Contenido de aprendizaje',
          'SRS',
          'YouTube shadowing',
          'Historias IA',
          'Gamificación',
        ],
      },
      miji: {
        name: 'Miji',
        price: '£27.49/año',
        features: ['Tarjetas flash', 'Reconocimiento de escritura', 'Práctica de kanji'],
        missing: [
          'YouTube shadowing',
          'Historias IA',
          'Lectura de noticias',
          'Práctica de conversación',
          'Gamificación',
        ],
      },
      lingodeer: {
        name: 'LingoDeer',
        price: '$14.99/mes',
        features: ['Cursos estructurados', 'Explicaciones gramaticales', 'Ejercicios', 'Historias'],
        missing: [
          'YouTube shadowing',
          'Historias IA personalizadas',
          'Lectura de noticias reales',
          'Exportación a Anki',
          'Diccionario',
        ],
      },
    },

    comparison: {
      hasFeature: '✓',
      missingFeature: '—',
      popularLabel: 'Popular',
      bestValueLabel: 'Mejor Valor',
      monthlyLabel: '/mes',
      yearlyLabel: '/año',
      lifetimeLabel: 'Único pago',
    },
  },

  // Entitlements & Limits
  entitlements: {
    limits: {
      sessionsToday: 'Sesiones de {{feature}} hoy',
      sessionsLeft: '{{count}} restantes',
      unlimited: 'Ilimitado',
      dailyLimit: 'Límite diario',
      resets: 'Se reinicia {{time}}',
      resetsTomorrow: 'Se reinicia mañana',
      resetsIn: 'Se reinicia en {{time}}',
    },
    upgrade: {
      title: 'Desbloquea práctica ilimitada',
      message: 'Mejora a Premium para sesiones diarias ilimitadas y funciones exclusivas.',
      benefits: {
        unlimited: 'Sesiones de práctica ilimitadas',
        allFeatures: 'Todas las funciones desbloqueadas',
        advancedAnalytics: 'Análisis avanzados',
        prioritySupport: 'Soporte prioritario',
        offlineMode: 'Modo sin conexión',
      },
      cta: {
        learnMore: 'Saber más',
        viewPricing: 'Ver precios',
        upgradeToPremium: 'Mejorar a Premium',
      },
      inline: {
        title: 'Desbloquea funciones Premium',
        subtitle: 'Acceso ilimitado a todas las funciones',
        featureLimit: 'Has alcanzado tu límite para {{feature}}',
      },
      plans: {
        monthly: {
          name: 'Premium Mensual',
          interval: 'mes',
        },
        yearly: {
          name: 'Premium Anual',
          interval: 'año',
          savings: 'Ahorra 25%',
        },
      },
      features: {
        unlimited: 'Sesiones de práctica ilimitadas',
        advancedStats: 'Análisis avanzados de progreso',
        prioritySupport: 'Soporte al cliente prioritario',
        offlineMode: 'Modo sin conexión completo',
        earlyAccess: 'Acceso anticipado a nuevas funciones',
      },
      badges: {
        popular: 'Más popular',
      },
      currentUsage: 'Uso actual',
      loading: 'Cargando opciones de precio...',
      upgradeNow: 'Mejorar ahora',
      maybeLater: 'Quizás más tarde',
      processing: 'Procesando...',
      premiumNote: 'Únete a miles de estudiantes que han acelerado su viaje japonés con Premium',
      securePayment: 'Pago seguro a través de Stripe',
    },
    guest: {
      title: 'Crea tu cuenta gratuita',
      subtitle: 'Regístrate para desbloquear el aprendizaje personalizado',
      featureRequiresAccount: '{{feature}} requiere una cuenta',
      benefits: {
        progressTracking: 'Rastrea tu progreso',
        progressTrackingDesc: 'Guarda tu historial de aprendizaje y logros',
        cloudSync: 'Sincronización en la nube',
        cloudSyncDesc: 'Accede a tus datos en todos los dispositivos',
        unlockFeatures: 'Más funciones',
        unlockFeaturesDesc: 'Desbloquea herramientas de aprendizaje adicionales',
        dailyLimits: 'Límites más altos',
        dailyLimitsDesc: 'Obtén más sesiones de práctica diarias',
      },
      freeAccountNote: 'Es completamente gratis - no se requiere tarjeta de crédito',
      createAccount: 'Crear cuenta gratuita',
      signIn: 'Iniciar sesión',
      continueAsGuest: 'Continuar como invitado',
    },
    messages: {
      limitReached: 'Límite diario alcanzado. Inténtalo mañana.',
      signUpForMore: 'Regístrate gratis para obtener 5 prácticas diarias',
      upgradeForUnlimited: 'Mejora a Premium para práctica ilimitada',
      getUnlimitedAccess: 'Obtén acceso ilimitado con Premium',
      authenticationRequired: 'Autenticación requerida',
      featureLimitReached: 'Límite de función alcanzado',
      upgradeRequired: 'Mejora a premium para acceso ilimitado',
    },
  },

  // Pricing Page
  pricing: {
    title: 'Elige tu viaje de aprendizaje',
    subtitle: 'Desbloquea práctica ilimitada y acelera tu dominio del japonés',
    loading: 'Cargando precios...',
    mostPopular: 'Más popular',
    billingToggle: {
      monthly: 'Mensual',
      yearly: 'Anual',
      savePercent: 'Ahorra {{percent}}%',
    },
    buttons: {
      getStarted: 'Empezar',
      choosePlan: 'Elegir plan',
      currentPlan: 'Plan actual',
      upgrade: 'Mejorar',
      startFreeTrial: 'Iniciar prueba gratuita',
    },
    badges: {
      free: 'Gratis',
      trial: 'Prueba gratuita',
      mostPopular: 'Más popular',
      bestValue: 'Mejor valor',
    },
    features: {
      title: 'Qué está incluido',
      free: {
        sessions: '5 sesiones de práctica por día',
        basicAnalytics: 'Seguimiento básico de progreso',
        communitySupport: 'Soporte de la comunidad',
      },
      premium: {
        unlimitedSessions: 'Sesiones de práctica ilimitadas',
        advancedAnalytics: 'Análisis avanzados e insights',
        prioritySupport: 'Soporte prioritario',
        offlineMode: 'Modo sin conexión',
        exclusiveContent: 'Contenido exclusivo',
        earlyAccess: 'Acceso anticipado a nuevas funciones',
      },
    },
    comparison: {
      title: 'Comparar planes',
      feature: 'Función',
      included: 'Incluido',
      notIncluded: '—',
    },
    messages: {
      upgradeSuccess: '¡Mejora completada exitosamente!',
      downgradePending: 'Degradación programada para el final del período de facturación.',
      trialStarted: '¡Prueba gratuita iniciada! Disfruta las funciones Premium.',
      subscriptionExpired: 'Tu suscripción ha expirado. Renuévala para continuar con Premium.',
    },
    manageBilling: {
      title: 'Gestionar facturación',
      updatePayment: 'Actualizar método de pago',
      downloadInvoice: 'Descargar factura',
      billingHistory: 'Historial de facturación',
      nextPayment: 'Próximo pago: {{date}}',
    },
    trust: {
      secure: 'Pago seguro',
      guarantee: 'Garantía de devolución de 30 días',
      support: 'Soporte 24/7',
      noCommitment: 'Sin compromiso',
      cancelAnytime: 'Cancela en cualquier momento',
    },
    faq: {
      title: 'Preguntas frecuentes',
      canICancel: {
        question: '¿Puedo cancelar en cualquier momento?',
        answer:
          'Sí, puedes cancelar tu suscripción en cualquier momento. Continuarás teniendo acceso hasta el final de tu período de facturación.',
      },
      whatPaymentMethods: {
        question: '¿Qué métodos de pago aceptan?',
        answer:
          'Aceptamos todas las tarjetas de crédito principales, tarjetas de débito y PayPal a través de nuestro procesador de pagos seguro Stripe.',
      },
      isThereATrial: {
        question: '¿Hay una prueba gratuita?',
        answer:
          'Los nuevos usuarios obtienen 7 días de funciones Premium gratis. No se requiere tarjeta de crédito.',
      },
      canIChangeMyPlan: {
        question: '¿Puedo cambiar mi plan?',
        answer:
          'Sí, puedes mejorar o degradar tu plan en cualquier momento desde la configuración de tu cuenta.',
      },
    },
    pricingComparison: {
      badge: 'TODAS LAS FUNCIONES COMBINADAS',
      title: 'Una App, Todas las Funciones',
      subtitle:
        '¿Por qué pagar por múltiples aplicaciones? Moshimoshi combina todas las funciones premium de las principales aplicaciones de aprendizaje de japonés por una fracción del costo.',
      compareTitle: 'Comparar con otras aplicaciones',
      competitors: {
        duolingo: {
          name: 'Duolingo',
          price: '£47.99/año',
          features: ['Gamificación', 'Lecciones básicas', 'Seguimiento de rachas'],
          missing: [
            'Shadowing de YouTube',
            'Historias IA',
            'Análisis de kanji',
            'Lectura de noticias',
            'Exportación Anki',
          ],
        },
        heyJapan: {
          name: 'HeyJapan',
          price: '£48.99/año',
          features: ['Lecciones en video', 'Explicaciones gramaticales'],
          missing: [
            'Gamificación',
            'Funciones IA',
            'Práctica de YouTube',
            'Lectura de noticias',
            'Exportación Anki',
          ],
        },
        satoriReader: {
          name: 'Satori Reader',
          price: '£8.49/mes',
          features: ['Práctica de lectura', 'Soporte furigana'],
          missing: [
            'Lecciones en video',
            'Gamificación',
            'Práctica de YouTube',
            'Historias IA',
            'Exportación Anki',
          ],
        },
        lingoDeer: {
          name: 'LingoDeer',
          price: '£95.99/año',
          features: ['Lecciones estructuradas', 'Enfoque en gramática'],
          missing: [
            'Práctica de YouTube',
            'Historias IA',
            'Lectura de noticias',
            'Herramientas avanzadas de kanji',
          ],
        },
      },
      missingLabel: 'Falta:',
      moreMissing: 'más faltantes...',
      costComparison: {
        title: 'Para obtener todas estas funciones por separado, pagarías:',
        amount: '£240+ al año',
        subtitle: '(Suscribiéndose a 3-4 aplicaciones diferentes)',
      },
      moshimoshiPricing: {
        title: 'Precios de Moshimoshi',
        monthly: 'Mensual',
        yearly: 'Anual',
        save: 'Ahorra',
        free: {
          title: 'Gratis',
          subtitle: 'Comienza tu viaje',
          price: '£0',
          period: '/para siempre',
          features: [
            'Hiragana y Katakana',
            'Kanji básico (N5)',
            '5 videos de YouTube/día',
            'Funciones IA limitadas',
          ],
          limitations: ['Funciones avanzadas bloqueadas'],
          cta: 'Comienza Gratis',
        },
        premium: {
          title: 'Premium',
          subtitle: 'Todo incluido',
          monthlyPrice: '£8.99',
          yearlyPrice: '£8.33',
          yearlyTotal: '£99.9/año',
          period: '/mes',
          badge: 'MEJOR VALOR',
          features: [
            'Todo en Gratis, más:',
            'Shadowing ilimitado de YouTube',
            'Todos los niveles JLPT (N5-N1)',
            'Historias y explicaciones IA ilimitadas',
            'Lector de noticias japonesas',
            'Exportación Anki y sincronización en la nube',
            'Soporte prioritario',
          ],
          cta: 'Comienza la prueba gratuita de 7 días',
          disclaimer: 'No se requiere tarjeta de crédito • Cancela en cualquier momento',
        },
      },
      allFeatures: {
        title: 'Todo lo que obtienes con Premium',
        categories: {
          learningTools: {
            title: 'Herramientas de Aprendizaje',
            items: [
              'Shadowing de Videos YouTube',
              'Historias Generadas por IA',
              'Lector de Noticias Japonesas',
              'Sistema de Gamificación y XP',
              'Logros y Tabla de Clasificación',
              'Integración de Exportación Anki',
            ],
          },
          studyFeatures: {
            title: 'Funciones de Estudio',
            items: [
              'Hiragana/Katakana Completo',
              'Navegador Kanji JLPT N5-N1',
              'Explicaciones Gramaticales',
              'Algoritmo SRS Inteligente',
              'Modo Sin Conexión',
              'Pronunciación de Audio Nativa',
            ],
          },
          advancedTools: {
            title: 'Herramientas Avanzadas',
            items: [
              'Explicaciones de Palabras con IA',
              'Motor de Conjugación',
              'Orden de Trazos Kanji',
              'Análisis de Progreso',
              'Listas de Estudio Personalizadas',
              'Tema Oscuro/Claro',
            ],
          },
        },
      },
      bottomCta: {
        title: 'Únete a miles aprendiendo japonés de manera inteligente',
        subtitle:
          'Una aplicación, todas las funciones, una fracción del costo. ¡Comienza tu viaje hoy!',
        button: 'Comienza la prueba gratuita',
      },
    },
  },

  // Review System
  review: {
    skip: 'Saltar',
    showAnswer: 'Mostrar respuesta',
    modes: {
      recognition: 'Reconocimiento',
      recall: 'Recordar',
      listening: 'Escuchar',
      writing: 'Escribir',
      speaking: 'Hablar',
    },

    // Kanji-specific
    kanji: {
      writeKanjiFor: 'Escribe el kanji para:',
      strokeCount: '{{count}} trazos',
      grade: 'Grado {{grade}}',
      frequency: 'Frecuencia #{{rank}}',
    },

    // Confidence
    confidence: 'Confianza',
    confidenceHelp: '¿Qué es la confianza?',
    confidenceLevel: 'Nivel de confianza',
    confidenceLow: 'Adivinando',
    confidenceMedium: 'Inseguro',
    confidenceHigh: 'Seguro',
    confidenceTooltip: {
      title: '¿Qué tan seguro estás?',
      description:
        'Ajusta el control deslizante para indicar qué tan seguro estás de tu respuesta:',
      high: 'Alto (70-100%): Conoces bien la respuesta',
      medium: 'Medio (30-70%): Estás algo seguro',
      low: 'Bajo (0-30%): Estás adivinando',
      tip: 'Esto ayuda al sistema a programar mejor tus repasos según tu conocimiento real.',
    },
  },

  learn: {
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
    vocabulary: 'Vocabulario',
    grid: 'Cuadrícula',
    browse: 'Explorar',
    study: 'Estudiar',
    review: 'Repasar',
    progress: 'Progreso',
    learned: 'aprendido',
    selectCharacters: 'Por favor selecciona caracteres para estudiar',
    noStrugglingCharacters: 'No se encontraron caracteres difíciles',
    selectionCleared: 'Selección borrada',
    studySessionComplete: '¡Sesión de estudio completada!',
  },

  // Review Prompts
  reviewPrompts: {
    vocabulary: {
      writeJapaneseFor: 'Escribe el japonés para:',
      whatWordDoYouHear: '¿Qué palabra escuchas?',
      example: 'Ejemplo:',
      common: 'Común',
      pitchAccent: 'Acento: {{accent}}',
      searchTitle: 'Búsqueda de Vocabulario',
      searchDescription: 'Busca palabras japonesas con significados y ejemplos',
      searchPlaceholder: 'Buscar por kanji, kana, romaji o significado en inglés...',
      searchButton: 'Buscar',
      searchSource: 'Fuente de búsqueda:',
      searchSourceJMDict: 'JMDict (Sin conexión)',
      searchSourceWaniKani: 'WaniKani',
      searchResults: 'Resultados de búsqueda',
      searchResultsCount: 'Resultados de búsqueda ({{count}})',
      searchQuickSearch: 'Búsqueda rápida:',
      searchHistory: 'Historial de búsqueda',
      searchHistoryClear: 'Borrar',
      searchHistoryEmpty: 'Tu historial de búsqueda aparecerá aquí',
      searchHistoryResults: '{{count}} resultados',
      searchJustNow: 'Justo ahora',
      searchMinutesAgo: 'hace {{minutes}} min',
      searchHoursAgo: 'hace {{hours}} h',
      searchDaysAgo: 'hace {{days}} días',
      loadingMessage: 'Cargando búsqueda de vocabulario...',
      searching: 'Buscando...',

      // Tabs
      tabs: {
        details: 'Detalles',
        conjugations: 'Conjugaciones',
      },

      // Toast messages
      wanikaniUnavailable: 'WaniKani no está disponible. Usando el diccionario JMdict en su lugar.',
      wanikaniSearchFailed: 'La búsqueda de WaniKani falló. Cambiando al diccionario JMdict.',
      wanikaniMockData:
        'La API de WaniKani no está configurada correctamente. Por favor cambie a JMdict o configure un token de API de WaniKani válido.',
      wanikaniInvalidKey:
        'La clave de API de WaniKani no es válida. Por favor verifique su configuración de API o use JMdict en su lugar.',
      wanikaniServiceDown:
        'El servicio de WaniKani no está disponible temporalmente. Inténtelo de nuevo más tarde o use JMdict.',
      noResultsFound: 'No se encontraron resultados. Intenta con otro término de búsqueda.',
      searchFailed: 'La búsqueda falló. Por favor, inténtalo de nuevo.',
      searchHistoryCleared: 'Historial de búsqueda borrado',
      loadingCache:
        'Cargando la base de datos de vocabulario de WaniKani por primera vez... Esto puede tardar un momento.',
      wordMeaning: 'Significado',
      wordRomaji: 'Romaji',
      wordTags: 'Etiquetas',
      wordExampleSentences: 'Oraciones de ejemplo',
      wordExampleSentencesComingSoon: '¡Las oraciones de ejemplo llegarán pronto!',
      noExamplesFound: 'No se encontraron ejemplos para esta palabra',

      // Practice page
      practiceTitle: 'Práctica de conjugación',
      practiceDescription: 'Domina las conjugaciones de verbos y adjetivos japoneses',
      filters: {
        all: 'Todos',
        verbs: 'Solo verbos',
        adjectives: 'Solo adjetivos',
      },
      actions: {
        shuffle: 'Mezclar',
        loadNew: 'Cargar nuevas palabras',
        selectForReview: 'Seleccionar para revisión',
        showConjugations: 'Mostrar conjugaciones',
        hideConjugations: 'Ocultar conjugaciones',
      },
      stats: {
        verbs: 'Verbos',
        adjectives: 'Adjetivos',
      },
      studyMode: {
        title: 'Estudiar conjugaciones',
        description: 'Aprende a conjugar verbos y adjetivos japoneses con ejemplos interactivos',
        startStudying: 'Empezar a estudiar',
      },
      reviewMode: {
        practiceConjugation: 'Practicar esta conjugación',
        complete: 'Completar revisión',
        noWords: 'No se han seleccionado palabras para revisar',
      },
    },
  },

  // Funcionalidad de listas personalizadas
  favourites: {
    title: 'Mis Favoritos',
    description: 'Tu vocabulario, kanji y oraciones guardados',
    filters: {
      all: 'Todo',
      words: 'Palabras',
      kanji: 'Kanji',
      sentences: 'Oraciones',
    },
    filterByList: 'Filtrar por lista',
    allLists: 'Todas las listas',
    sortBy: 'Ordenar por',
    sort: {
      recent: 'Agregado recientemente',
      alphabetical: 'Alfabético',
      mastery: 'Nivel de dominio',
    },
    noResultsFound: 'No se encontraron elementos',
    noItemsSaved: 'Aún no hay elementos guardados',
    tryDifferentSearch: 'Prueba con otro término de búsqueda',
    startSaving: 'Guarda palabras, kanji y oraciones para verlos aquí',
    confirmRemove: '¿Eliminar este elemento de todas las listas?',
    removeDialog: {
      title: 'Eliminar de favoritos',
      message: '¿Estás seguro de que quieres eliminar este elemento de tus favoritos?',
      cancel: 'Cancelar',
      confirm: 'Eliminar',
    },
    reviewedTimes: 'Revisado {count} veces',
    manageLists: 'Administrar mis listas',
  },

  lists: {
    title: 'Mis listas',
    pageDescription: 'Crea y gestiona tus listas de estudio personalizadas',
    modal: {
      title: 'Crear nueva lista',
      createTitle: 'Configurar tu lista',
      saveTitle: 'Guardar en listas',
      selectType: 'Elige el tipo de lista que quieres crear:',
    },
    types: {
      word: {
        name: 'Lista de palabras',
        short: 'Palabra',
        description: 'Vocabulario y kanji',
      },
      sentence: {
        name: 'Lista de oraciones',
        short: 'Oración',
        description: 'Estudiar oraciones completas en contexto',
      },
      verbAdj: {
        name: 'Verbos y adjetivos',
        short: 'Verbo/Adj',
        description: 'Practicar formas verbales y adjetivales',
      },

      flashcard: {
        name: 'Lista de tarjetas',
        short: 'Tarjetas',
        description: 'Revisar cualquier contenido con repetición espaciada',
        accepts: 'Acepta: Palabras, Kanji, Oraciones',
      },
      drillable: {
        name: 'Lista de práctica',
        short: 'Práctica',
        description: 'Practicar conjugaciones para verbos y adjetivos',
        accepts: 'Acepta: Solo verbos y adjetivos',
      },
    },
    fields: {
      name: 'Nombre de la lista',
      description: 'Descripción',
      color: 'Color',
      icon: 'Ícono',
      notes: 'Notas personales',
      tags: 'Etiquetas',
    },
    placeholders: {
      name: 'ej. Vocabulario JLPT N5',
      description: 'Descripción opcional para tu lista',
      search: 'Buscar listas...',
      notes: 'Agregar notas o mnemotécnicos...',
      tags: 'Etiquetas separadas por comas',
    },
    actions: {
      create: 'Crear lista',
      createNew: 'Crear nueva lista',
      createFirst: 'Crear tu primera lista',
      save: 'Guardar',
      saveToList: 'Guardar en lista',
      delete: 'Eliminar',
      edit: 'Editar lista',
      remove: 'Quitar de la lista',
      addItems: 'Agregar elementos',
      review: 'Revisar',
      manage: 'Gestionar lista',
    },
    deleteDialog: {
      title: 'Eliminar lista',
      message:
        '¿Estás seguro de que quieres eliminar "{{name}}"? Esta acción no se puede deshacer.',
      confirm: 'Eliminar',
      cancel: 'Cancelar',
    },
    labels: {
      itemCount: '{count} elementos',
      alreadySaved: 'Ya guardado',
      incompatibleLists: 'Tipos de lista incompatibles',
      drillable: 'Conjugable',
      updated: 'Actualizado',
    },
    quota: {
      remaining: '{count} listas restantes',
      guestLimit: 'Inicia sesión para crear listas',
      freeLimit: 'Los usuarios gratuitos pueden crear hasta 3 listas',
    },
    success: {
      created: 'Lista creada exitosamente',
      updated: 'Lista actualizada exitosamente',
      deleted: 'Lista eliminada exitosamente',
      itemAdded: 'Agregado a {{count}} lista(s)',
      itemRemoved: 'Quitado de {{count}} lista(s)',
      itemUpdated: 'Elemento actualizado exitosamente',
    },
    errors: {
      limitReached: 'Has alcanzado tu límite de listas. Mejora para crear más.',
      nameRequired: 'Por favor ingresa un nombre de lista',
      typeRequired: 'Por favor selecciona un tipo de lista',
      createFailed: 'Error al crear la lista',
      loadFailed: 'Error al cargar las listas',
      saveFailed: 'Error al guardar el elemento',
      noListSelected: 'Por favor selecciona al menos una lista',
      incompatibleType: 'Este tipo de lista no puede aceptar este elemento',
    },
    empty: {
      noLists: 'Aún no has creado listas',
      noItems: 'Esta lista está vacía',
      noResults: 'No se encontraron resultados',
      getStarted: 'Comienza a organizar tus materiales de aprendizaje en listas personalizadas',
      tryDifferentSearch: 'Intenta buscar con palabras clave diferentes',
    },
    stats: {
      items: 'Elementos',
      mastered: 'Dominado',
      learning: 'Aprendiendo',
      total: 'Total',
    },
  },

  // YouTube Shadowing
  youtubeShadowing: {
    title: 'Shadowing YouTube',
    description: 'Practica japonés con videos de YouTube y archivos multimedia',

    hero: {
      title: 'Domina el japonés con cualquier medio',
      subtitle:
        'Convierte videos de YouTube o tus propios archivos multimedia en sesiones de práctica de shadowing interactivas con transcripciones impulsadas por IA',
    },

    modes: {
      input: 'Agregar Medio',
      player: 'Practicar',
    },

    input: {
      youtube: 'URL de YouTube',
      upload: 'Subir Archivo',
      youtubeTitle: 'Pegar URL de YouTube',
      uploadTitle: 'Subir Archivo Multimedia',
      placeholder: 'https://www.youtube.com/watch?v=...',
      supportedFormats: 'Formatos soportados:',
      extract: 'Extraer e Iniciar',
      uploadButton: 'Seleccionar Archivo',
      maxSize: 'Tamaño máximo de archivo:',
      acceptedFormats: 'Formatos aceptados: MP4, MP3, WAV, M4A',
    },

    errors: {
      invalidUrl: 'Por favor ingresa una URL de YouTube válida',
      emptyUrl: 'Por favor ingresa una URL de YouTube',
      extractFailed: 'No se pudo extraer el ID del video de la URL',
      uploadFailed: 'Error al subir el archivo',
      transcriptFailed: 'Error al generar la transcripción',
      playerFailed: 'Error al cargar el reproductor',
    },

    features: {
      transcripts: {
        title: 'Transcripciones Instantáneas',
        description: 'Transcripción impulsada por IA en segundos',
      },
      shadowing: {
        title: 'Práctica de Shadowing',
        description: 'Perfecciona tu pronunciación y ritmo',
      },
      furigana: {
        title: 'Soporte Furigana',
        description: 'Asistencia de lectura para todos los niveles',
      },
    },

    player: {
      loading: 'Cargando reproductor...',
      extractingAudio: 'Extrayendo audio...',
      generatingTranscript: 'Generando transcripción...',
      ready: '¡Listo para practicar!',

      controls: {
        play: 'Reproducir',
        pause: 'Pausa',
        previous: 'Línea anterior',
        next: 'Línea siguiente',
        repeat: 'Repetir',
        speed: 'Velocidad',
        volume: 'Volumen',
        settings: 'Configuración',
        furigana: 'Mostrar Furigana',
        grammar: 'Mostrar Gramática',
      },

      settings: {
        playbackSpeed: 'Velocidad de Reproducción',
        repeatCount: 'Número de Repeticiones',
        pauseBetween: 'Pausa Entre',
        continuous: 'Reproducción Continua',
        autoScroll: 'Desplazamiento Automático',
      },

      transcript: {
        edit: 'Editar',
        regenerate: 'Regenerar',
        save: 'Guardar Cambios',
        cancel: 'Cancelar Edición',
      },
    },

    freeAccess: 'Acceso Gratuito',
    loadingTitle: 'Cargando título del video...',
    by: 'por',

    usage: {
      today: 'Uso de hoy',
      unlimited: 'Ilimitado',
      remaining: 'restantes',
      limitReached: 'Límite diario alcanzado',
      newVideos: 'Nuevos videos hoy',
      uploads: 'subidas',
    },
  },

  flashcards: {
    title: 'Tarjetas de Memoria',
    pageTitle: 'Mazos de Tarjetas',
    pageDescription: 'Crea y estudia mazos de tarjetas personalizados',

    // Empty state
    noDecksYet: 'Aún no hay mazos',
    noDecksDescription: 'Comienza tu viaje de aprendizaje creando tu primer mazo de tarjetas',
    createFirstDeck: 'Crear Tu Primer Mazo',

    // Deck management
    createDeck: 'Crear Nuevo Mazo',
    editDeck: 'Editar Mazo',
    deleteDeck: 'Eliminar Mazo',
    deckName: 'Nombre del Mazo',
    deckDescription: 'Descripción',
    deckSettings: 'Configuración del Mazo',
    totalCards: '{{count}} tarjetas',
    lastStudied: 'Último estudio: {{date}}',
    neverStudied: 'Nunca estudiado',

    // Card management
    addCard: 'Añadir Tarjeta',
    editCard: 'Editar Tarjeta',
    deleteCard: 'Eliminar Tarjeta',
    frontSide: 'Anverso',
    backSide: 'Reverso',
    cardNotes: 'Notas (opcional)',
    cardTags: 'Etiquetas',
    cardDifficulty: 'Dificultad',

    // Study modes
    studyMode: 'Modo de Estudio',
    classic: 'Clásico',
    match: 'Emparejar',
    speed: 'Velocidad',
    write: 'Escritura',
    voice: 'Voz',

    // Study session
    startStudying: 'Comenzar Estudio',
    resumeStudying: 'Reanudar Estudio',
    flipCard: 'Voltear Tarjeta',
    showAnswer: 'Mostrar Respuesta',
    nextCard: 'Siguiente Tarjeta',
    previousCard: 'Tarjeta Anterior',
    markCorrect: 'Lo sabía',
    markIncorrect: 'No lo sabía',
    difficulty: {
      again: 'Otra vez',
      hard: 'Difícil',
      good: 'Bien',
      easy: 'Fácil',
    },

    // Progress
    progress: 'Progreso',
    cardsStudied: 'Tarjetas estudiadas',
    accuracy: 'Precisión',
    streak: 'Racha actual',
    masteryLevel: 'Maestría',
    dueForReview: 'Para revisar',
    due: 'due',
    newCards: 'Tarjetas nuevas',
    learningCards: 'Aprendiendo',
    reviewCards: 'Revisar',

    // Customization
    customize: {
      title: 'Personalizar Tarjetas',
      cardStyle: 'Estilo de Tarjeta',
      minimal: 'Minimalista',
      decorated: 'Decorado',
      themed: 'Temático',
      animationSpeed: 'Velocidad de Animación',
      slow: 'Lenta',
      normal: 'Normal',
      fast: 'Rápida',
      soundEffects: 'Efectos de Sonido',
      hapticFeedback: 'Retroalimentación Háptica',
      autoPlay: 'Reproducción Auto',
      studyDirection: 'Dirección de Estudio',
      frontToBack: 'Anverso → Reverso',
      backToFront: 'Reverso → Anverso',
      mixed: 'Mixto',
      sessionLength: 'Tarjetas por sesión',
    },

    // Import/Export
    import: {
      title: 'Importar Mazo',
      selectFile: 'Seleccionar Archivo',
      supportedFormats: 'Soportado: CSV, JSON, Anki (.apkg)',
      fromList: 'Crear desde Lista',
      selectList: 'Seleccionar una lista',
      importing: 'Importando...',
      success: '{{count}} tarjetas importadas',
      error: 'Error al importar',
      yourLists: 'Tus listas',
      noLists: 'No hay listas disponibles',
      createListFirst: 'Crea primero una lista para importarla como mazo',
      anki: 'Importación Anki',
      ankiTitle: 'Anki',
      csv: 'Importar archivo CSV',
      csvTitle: 'CSV',
      csvDescription: 'Importar archivo CSV',
    },

    export: {
      title: 'Exportar Mazo',
      format: 'Formato de Exportación',
      csv: 'CSV',
      json: 'JSON',
      anki: 'Paquete Anki',
      includeProgress: 'Incluir datos de progreso',
      exporting: 'Exportando...',
      success: 'Mazo exportado con éxito',
    },

    // Empty states
    empty: {
      noDecks: 'Sin mazos de tarjetas',
      createFirst: 'Crea tu primer mazo para empezar',
      noCards: 'Este mazo no tiene tarjetas',
      addFirst: 'Añade tu primera tarjeta',
      noDue: 'Sin tarjetas para revisar',
      allCaughtUp: '¡Todo listo! Vuelve más tarde.',
      studyNew: 'Estudiar tarjetas nuevas',
    },

    // Errors and limits
    errors: {
      loadFailed: 'Error al cargar',
      saveFailed: 'Error al guardar',
      deleteFailed: 'Error al eliminar',
      limitReached: 'Límite de mazos alcanzado',
      upgradeRequired: 'Actualización requerida',
      offlineOnly: 'Modo sin conexión',
      syncFailed: 'Error de sincronización',
    },

    limits: {
      guest: 'Inicia sesión para crear mazos',
      freeLimit: 'Gratis: {{current}}/{{max}} mazos',
      dailyLimit: 'Límite diario: {{current}}/{{max}}',
      unlimited: 'Mazos ilimitados',
    },

    // Daily Goals
    dailyGoals: {
      title: 'Objetivos Diarios',
      progress: '{{percentage}}% completado',
      allComplete: '¡Todos los objetivos alcanzados!',
      cards: 'Tarjetas',
      time: 'Tiempo',
      decks: 'Mazos',
      accuracy: 'Precisión',
      congratulations: '¡Felicitaciones!',
      keepItUp: '¡Sigue así!',
      customizeGoals: 'Personalizar Objetivos',
      cardsPerDay: 'Tarjetas por día',
      minutesPerDay: 'Minutos por día',
      decksPerDay: 'Mazos por día',
      accuracyTarget: 'Objetivo de precisión',
    },

    // Achievements
    achievements: {
      title: 'Logros',
      unlocked: 'Desbloqueado',
      progress: '{{unlocked}}/{{total}} desbloqueados',
      totalXP: 'XP Total',
      streak: 'Racha',
      mastery: 'Maestría',
      speed: 'Velocidad',
      accuracy: 'Precisión',
      volume: 'Volumen',
      special: 'Especial',
      viewAll: 'Ver Todos',
    },

    // Learning Insights
    learningInsights: 'Perspectivas de Aprendizaje',
    currentStreak: 'Racha Actual',
    retentionRate: 'Tasa de Retención',
    cardsPerDay: 'Tarjetas por Día',
    bestStudyTime: 'Mejor Hora de Estudio',

    // Optimal Settings
    optimalSettings: 'Configuración Óptima',
    sessionLength: 'Duración de Sesión',
    studyTime: 'Tiempo de Estudio',

    // Recommended Study
    recommendedStudy: 'Estudio Recomendado',

    // Urgency levels
    urgency: {
      low: 'Prioridad Baja',
      medium: 'Prioridad Media',
      high: 'Prioridad Alta',
      critical: 'Crítico',
    },

    // Additional missing translations
    minutes: 'minutos',
    cards: 'tarjetas',

    // Tooltips
    tooltips: {
      srs: 'Usa repetición espaciada',
      mastery: 'Estudia 21+ días con 90% precisión',
      streak: 'Estudia cada día',
      difficulty: 'Evalúa tu conocimiento',
      leech: 'Esta tarjeta necesita más práctica',
    },

    // Confirmations
    confirmDelete: {
      title: 'Eliminar Mazo',
      message:
        '¿Estás seguro de que quieres eliminar "{{name}}"? Esta acción no se puede deshacer.',
      deck: '¿Eliminar mazo "{{name}}"? Irreversible.',
      card: '¿Eliminar esta tarjeta? Irreversible.',
      progress: '¿Reiniciar progreso?',
    },

    // Success messages
    success: {
      deckCreated: 'Mazo creado',
      deckUpdated: 'Mazo actualizado',
      deckDeleted: 'Mazo eliminado',
      cardAdded: 'Tarjeta añadida',
      cardUpdated: 'Tarjeta actualizada',
      cardDeleted: 'Tarjeta eliminada',
      progressSaved: 'Progreso guardado',
      imported: 'Mazo importado',
      exported: 'Mazo exportado',
    },

    // Session Settings
    settings: {
      sessionLength: 'Tarjetas por sesión',
      sessionLengthHint: 'Elige cuántas tarjetas estudiar en esta sesión',
      quickSettings: 'Configuración rápida',
      reviewMode: 'Modo de revisión',
      sequential: 'Secuencial',
      random: 'Aleatorio',
      smart: 'Inteligente',
      studyDirection: 'Dirección de estudio',
      frontToBack: 'Frente → Reverso',
      frontToBackDesc: 'Mostrar el frente primero',
      backToFront: 'Reverso → Frente',
      backToFrontDesc: 'Mostrar el reverso primero',
      mixed: 'Mezclado',
      mixedDesc: 'Dirección aleatoria para cada tarjeta',
      usingAllCards: 'Usando todas las tarjetas disponibles',
    },

    // Actions
    actions: {
      syncAll: 'Sincronizar todo',
      exportAll: 'Exportar todo',
    },

    // Study Session
    startSession: 'Iniciar sesión',

    // Statistics
    showStats: 'Mostrar estadísticas',
    hideStats: 'Ocultar estadísticas',
    stats: {
      mastered: 'Dominado',
      accuracy: 'Precisión',
      streak: 'Racha actual',
      studyTime: 'Tiempo de estudio',
      learningProgress: 'Progreso de aprendizaje',
      deckPerformance: 'Rendimiento de mazos',
      insights: 'Perspectivas de estudio',
      velocity: 'Velocidad de aprendizaje',
      cardsPerHour: 'tarjetas/hora',
      todayGoal: 'Progreso de hoy',
      bestStreak: 'Mejor racha',
      dueNow: 'Para revisar',
      days: 'días',
      total: 'Total de tarjetas',
      learning: 'Aprendiendo',
      complete: 'Completo',
      progress: 'Progreso',
      averageAccuracy: 'Precisión promedio',
      hoursMinutes: '{{hours}}h {{minutes}}m',
      minutes: '{{minutes}} minutos',
      period: {
        day: 'Hoy',
        week: 'Esta semana',
        month: 'Este mes',
        all: 'Todo el tiempo',
      },
    },
  },
  conjugation: {
    title: 'Conjugación',
    showConjugations: 'Mostrar Conjugaciones',
    hideConjugations: 'Ocultar Conjugaciones',
    expandAll: 'Expandir Todo',
    collapseAll: 'Contraer Todo',
    groups: {
      stems: 'Raíces',
      basicForms: 'Formas Básicas',
      politeForms: 'Formas Corteses',
      conditionalForms: 'Formas Condicionales',
      volitionalForms: 'Formas Volitivas',
      imperativeForms: 'Formas Imperativas',
      potentialForms: 'Formas Potenciales',
      passiveForms: 'Formas Pasivas',
      causativeForms: 'Formas Causativas',
      causativePassiveForms: 'Formas Causativo-Pasivas',
      desiderativeForms: 'Formas Desiderativas (たい)',
      progressiveForms: 'Formas Progresivas',
      requestForms: 'Formas de Solicitud',
      colloquialForms: 'Formas Coloquiales',
      formalForms: 'Formas Formales/Clásicas',
      presumptiveForms: 'Formas Presuntivas',
      plainform: 'Forma simple',
      politeform: 'Forma cortés',
      taiformwantto: 'Forma tai (querer)',
      'taiform(wantto)': 'Forma tai (querer)',
      imperativeforms: 'Formas imperativas',
      provisionalform: 'Forma provisional',
      conditionalform: 'Forma condicional',
      alternativeform: 'Forma alternativa',
      potentialplainform: 'Forma potencial simple',
      potentialpoliteform: 'Forma potencial cortés',
      passiveplainform: 'Forma pasiva simple',
      passivepoliteform: 'Forma pasiva cortés',
      causativeplainform: 'Forma causativa simple',
      causativepoliteform: 'Forma causativa cortés',
      causativepassiveplainform: 'Forma causativo-pasiva simple',
      causativepassivepoliteform: 'Forma causativo-pasiva cortés',
      colloquialform: 'Forma coloquial',
      formalform: 'Forma formal',
      classicalformnu: 'Forma clásica (nu)',
      'classicalform(nu)': 'Forma clásica (nu)',
      classicalformzaru: 'Forma clásica (zaru)',
      'classicalform(zaru)': 'Forma clásica (zaru)',
      // Grupos específicos de adjetivos
      basicforms: 'Formas básicas',
      politeforms: 'Formas corteses',
      conditionalforms: 'Formas condicionales',
      presumptiveforms: 'Formas presuntivas',
    },
    forms: {
      // Raíces
      masuStem: 'Raíz masu',
      negativeStem: 'Raíz negativa',
      teForm: 'Forma te',
      negativeTeForm: 'Forma te negativa',
      adverbialNegative: 'Negativo adverbial',
      // Formas básicas
      present: 'Presente/Diccionario',
      past: 'Pasado',
      negative: 'Negativo',
      pastNegative: 'Pasado negativo',
      // Formas corteses
      polite: 'Cortés',
      politePast: 'Cortés pasado',
      politeNegative: 'Cortés negativo',
      politePastNegative: 'Cortés pasado negativo',
      politeVolitional: 'Cortés volitivo',
      // Condicionales
      provisional: 'Si/Cuando (ば)',
      provisionalNegative: 'Si no (ば)',
      conditional: 'Si/Cuando (たら)',
      conditionalNegative: 'Si no (たら)',
      // Volitivas
      volitional: 'Hagamos/Deberíamos',
      volitionalNegative: 'No hagamos',
      // Imperativas
      imperativePlain: 'Comando',
      imperativePolite: 'Por favor haz',
      imperativeNegative: 'No hagas',
      // Potenciales
      potential: 'Puede hacer',
      potentialNegative: 'No puede hacer',
      potentialPast: 'Podía hacer',
      potentialPastNegative: 'No podía hacer',
      // Pasivas
      passive: 'Se hace',
      passiveNegative: 'No se hace',
      passivePast: 'Se hizo',
      passivePastNegative: 'No se hizo',
      // Causativas
      causative: 'Hacer/Dejar hacer',
      causativeNegative: 'No hacer/dejar hacer',
      causativePast: 'Hizo/Dejó hacer',
      causativePastNegative: 'No hizo/dejó hacer',
      // Causativo-Pasivas
      causativePassive: 'Ser obligado a hacer',
      causativePassiveNegative: 'No ser obligado a hacer',
      // Desiderativas
      taiForm: 'Querer',
      taiFormNegative: 'No querer',
      taiFormPast: 'Quería',
      taiFormPastNegative: 'No quería',
      // Progresivas
      progressive: 'Está haciendo',
      progressiveNegative: 'No está haciendo',
      progressivePast: 'Estaba haciendo',
      progressivePastNegative: 'No estaba haciendo',
      // Solicitud
      request: 'Por favor haz',
      requestNegative: 'Por favor no hagas',
      // Coloquiales
      colloquialNegative: 'No (coloquial)',
      // Formales
      formalNegative: 'No (formal)',
      classicalNegative: 'No (clásico)',
      // Presuntivas
      presumptive: 'Probablemente',
      presumptiveNegative: 'Probablemente no',
    },
    wordTypes: {
      ichidan: 'Verbo ichidan',
      godan: 'Verbo godan',
      irregular: 'Verbo irregular',
      iadjective: 'Adjetivo en i',
      naadjective: 'Adjetivo en na',
    },
    messages: {
      notConjugatable: 'Esta palabra no se puede conjugar',
      lowConfidence: 'Tipo de conjugación detectado con baja confianza',
      specialCase: 'Esta palabra tiene reglas de conjugación especiales',
    },
    // Página de práctica
    practiceTitle: 'Práctica de Conjugación',
    practiceDescription: 'Domina las conjugaciones de verbos y adjetivos japoneses',
    searchPlaceholder: 'Buscar un verbo o adjetivo...',
    searchButton: 'Buscar',
    clearSearch: 'Limpiar',
    searchResults: 'Resultados de búsqueda',
    noSearchResults: 'No se encontraron palabras conjugables',
    filters: {
      all: 'Todo',
      verbs: 'Solo Verbos',
      adjectives: 'Solo Adjetivos',
    },
    actions: {
      shuffle: 'Mezclar',
      loadNew: 'Cargar Nuevas Palabras',
      selectForReview: 'Seleccionar para repaso',
      showConjugations: 'Mostrar Conjugaciones',
      hideConjugations: 'Ocultar Conjugaciones',
    },
    settings: 'Configuración',
    stats: {
      verbs: 'Verbos',
      adjectives: 'Adjetivos',
    },
    studyMode: {
      title: 'Estudiar Conjugaciones',
      description: 'Aprende a conjugar verbos y adjetivos japoneses con ejemplos interactivos',
      startStudying: 'Comenzar Estudio',
    },
    reviewMode: {
      practiceConjugation: 'Practicar esta conjugación',
      complete: 'Completar Repaso',
      noWords: 'No hay palabras seleccionadas para repaso',
    },
  },

  // Settings Page
  settings: {
    title: 'Ajustes',
    subtitle: 'Personaliza tu experiencia de aprendizaje',
    backToDashboard: '← Volver al Panel',
    saveButton: 'Guardar Todos los Ajustes',
    resetButton: 'Restablecer todos los ajustes a valores predeterminados',
    resetConfirm:
      '¿Estás seguro de que quieres restablecer todos los ajustes a valores predeterminados?',
    saveSuccess: '¡Ajustes guardados con éxito!',
    resetSuccess: 'Ajustes restablecidos a valores predeterminados',
    reviewNotifications: 'Notificaciones de Repaso',

    sections: {
      appearance: {
        title: 'Apariencia',
        language: {
          label: 'Idioma / 言語 / Langue / Lingua / Sprache / Idioma',
        },
        theme: {
          label: 'Tema',
          light: 'Claro',
          dark: 'Oscuro',
          system: 'Sistema',
        },
        colorPalette: {
          label: 'Paleta de Colores',
          preview: 'Vista Previa:',
          primary: 'Primario',
          secondary: 'Secundario',
          palettes: {
            sakura: 'Sakura',
            ocean: 'Océano',
            matcha: 'Matcha',
            sunset: 'Atardecer',
            lavender: 'Lavanda',
            monochrome: 'Mono',
          },
        },
      },

      learning: {
        title: 'Preferencias de Aprendizaje',
        autoplay: {
          label: 'Reproducción Automática de Audio',
          description: 'Reproducir automáticamente la pronunciación al ver palabras',
        },
        furigana: {
          label: 'Mostrar Furigana',
          description: 'Mostrar pistas de lectura sobre los caracteres kanji',
        },
        romaji: {
          label: 'Mostrar Romaji',
          description: 'Mostrar texto japonés romanizado',
        },
        soundEffects: {
          label: 'Efectos de Sonido',
          description: 'Reproducir sonidos para respuestas correctas/incorrectas',
        },
        hapticFeedback: {
          label: 'Retroalimentación Háptica',
          description: 'Retroalimentación de vibración en dispositivos móviles',
        },
      },

      notifications: {
        title: 'Notificaciones',
        dailyReminder: {
          label: 'Recordatorio de Estudio Diario',
          description: 'Recibe un recordatorio para practicar cada día',
        },
        achievementAlerts: {
          label: 'Alertas de Logros',
          description: 'Celebra cuando desbloquees logros',
        },
        weeklyProgress: {
          label: 'Informe de Progreso Semanal',
          description: 'Recibe un resumen de tu progreso semanal',
        },
        marketingEmails: {
          label: 'Correos de Marketing',
          description: 'Actualizaciones sobre nuevas funciones y contenido',
        },
        channels: {
          title: 'Canales de Notificación',
          browser: {
            label: 'Notificaciones del Navegador',
            description: 'Notificaciones de escritorio cuando hay repasos pendientes',
          },
          inApp: {
            label: 'Notificaciones In-App',
            description: 'Notificaciones emergentes mientras usas la app',
          },
          push: {
            label: 'Notificaciones Push',
            description: 'Notificaciones móviles (requiere instalación de app)',
          },
        },
        timing: {
          title: 'Preferencias de Tiempo',
          immediate: {
            label: 'Repasos Inmediatos',
            description: 'Notificar para repasos de 10 minutos y 30 minutos',
          },
          daily: {
            label: 'Resumen Diario',
            description: 'Obtener un resumen diario de repasos pendientes',
          },
        },
        quietHours: {
          title: 'Horas de Silencio',
          enable: 'Activar Horas de Silencio',
          description: 'Sin notificaciones durante los períodos especificados',
          start: 'Hora de Inicio',
          end: 'Hora de Fin',
        },
        saveSuccess: 'Preferencias de notificación guardadas',
        saveError: 'Error al guardar preferencias',
        browserNotSupported: 'Notificaciones del navegador no soportadas',
        browserEnabled: 'Notificaciones del navegador activadas',
        browserDenied:
          'Notificaciones del navegador bloqueadas. Por favor, activa en la configuración del navegador.',
        enableBrowserFirst: 'Por favor, activa primero las notificaciones del navegador',
        blocked: 'Bloqueado',
        testNotification: 'Notificación de Prueba',
        test: {
          title: 'Notificación de Prueba',
          body: 'Esta es una prueba de tu configuración de notificaciones',
        },
      },

      privacy: {
        title: 'Privacidad',
        publicProfile: {
          label: 'Perfil Público',
          description: 'Permitir que otros vean tu perfil',
        },
        showProgress: {
          label: 'Mostrar Progreso',
          description: 'Mostrar tu progreso de aprendizaje en tu perfil',
        },
        shareAchievements: {
          label: 'Compartir Logros',
          description: 'Compartir automáticamente logros con amigos',
        },
      },

      accessibility: {
        title: 'Accesibilidad',
        largeText: {
          label: 'Texto Grande',
          description: 'Aumentar el tamaño del texto para mejor legibilidad',
        },
        highContrast: {
          label: 'Alto Contraste',
          description: 'Aumentar el contraste de colores para visibilidad',
        },
        reduceMotion: {
          label: 'Reducir Movimiento',
          description: 'Minimizar animaciones y transiciones',
        },
        screenReader: {
          label: 'Soporte para Lector de Pantalla',
          description: 'Optimizar para compatibilidad con lector de pantalla',
        },
      },

      appInfo: {
        title: 'Info de la App',
        version: {
          title: 'Versión de la App',
          checking: 'Verificando...',
          upToDate: 'Actualizado',
          error: 'Verificación fallida',
          checkButton: 'Buscar Actualizaciones',
          available: 'disponible',
          criticalMessage:
            'Hay una actualización importante con correcciones críticas disponible. Por favor, actualiza lo antes posible.',
        },
      },

      legal: {
        title: 'Legal y Soporte',
        privacyPolicy: {
          label: 'Política de Privacidad',
          description: 'Cómo manejamos tus datos',
        },
        termsOfService: {
          label: 'Términos de Servicio',
          description: 'Nuestros términos y condiciones',
        },
        credits: {
          label: 'Créditos y Agradecimientos',
          description: 'Bibliotecas de código abierto y fuentes de datos',
        },
        contactUs: {
          label: 'Contáctanos',
          description: 'Obtén ayuda o envía comentarios',
        },
        emailSupport: {
          label: 'Soporte por Email',
          description: 'support@moshimoshi.app',
        },
      },
    },
  },

  // Credits Page
  credits: {
    title: 'Créditos y Agradecimientos',
    subtitle:
      'Moshimoshi está construido sobre los hombros de gigantes. Agradecemos sinceramente a los siguientes proyectos y comunidades.',
    loading: 'Cargando créditos...',
    backToSettings: '← Volver a Configuración',

    sections: {
      dataSources: 'Fuentes de Datos y Contenido',
      libraries: 'Bibliotecas y Tecnologías',
      specialThanks: 'Agradecimientos Especiales',
    },

    sources: {
      jmdict: 'Proyecto de diccionario japonés multilingüe',
      wanikani: 'Metodología de aprendizaje de kanji e inspiración mnemotécnica',
      kanjicanvas: 'Diagramas de orden de trazos y componentes de dibujo de kanji',
      flaticon: 'Iconos y recursos visuales',
    },

    libraries: {
      nextjs: 'Framework React para producción',
      react: 'Biblioteca JavaScript para interfaces de usuario',
      typescript: 'JavaScript con sintaxis para tipos',
      firebase: 'Autenticación, base de datos y almacenamiento',
      tailwind: 'Framework CSS utility-first',
      openai: 'Generación y análisis de contenido con IA',
      redis: 'Almacén de datos en memoria',
      stripe: 'Procesamiento de pagos y suscripciones',
    },

    thanks: {
      community: {
        name: 'La Comunidad de Aprendizaje del Japonés',
        description: 'Por el feedback continuo y el apoyo',
      },
      contributors: {
        name: 'Contribuidores de Código Abierto',
        description: 'Por hacer disponibles herramientas increíbles de forma gratuita',
      },
      users: {
        name: 'Nuestros Usuarios',
        description: 'Por confiarnos su viaje de aprendizaje',
      },
    },

    license: {
      title: 'Licencia y Uso',
      description:
        'Moshimoshi respeta las licencias de todos los proyectos de terceros. Utilizamos estos recursos en conformidad con sus licencias respectivas. Para información detallada sobre las licencias, consulte la documentación oficial de cada proyecto.',
    },

    footer: {
      madeWith: 'Hecho con',
      forLearners: 'para estudiantes de japonés en todo el mundo',
      contact: '¿Tienes una sugerencia? ¡Contáctanos!',
    },
  },

  kanjiConnection: {
    title: 'Conexiones Kanji',
    subtitle: 'Descubre las relaciones entre los caracteres kanji',
    howItWorks: {
      description: 'Aprende kanji a través de conexiones significativas',
      step1: 'Explora familias de kanji que comparten componentes',
      step2: 'Domina los radicales que forman los bloques de construcción',
      step3: 'Reconoce patrones visuales entre caracteres',
    },
    families: {
      title: 'Familias de Kanji',
      subtitle: 'Grupos de caracteres relacionados',
      description: 'Descubre kanji que comparten componentes semánticos o fonéticos',
    },
    radicals: {
      title: 'Radicales y Componentes',
      subtitle: 'Bloques de construcción de kanji',
      description: 'Aprende las partes fundamentales que componen los caracteres complejos',
    },
    visualLayout: {
      title: 'Patrones Visuales',
      subtitle: 'Reconocer similitudes estructurales',
      description: 'Identifica patrones visuales y disposiciones en diferentes kanji',
    },
  },

  vocabulary: {
    tabs: {
      details: 'Detalles',
      conjugations: 'Conjugaciones',
    },
  },

  // YouTube Series Public Page
  youtubeSeries: {
    title: 'Series de YouTube',
    subtitle: 'Aprende japonés con contenido seleccionado de YouTube',
    description:
      'Practica shadowing y aprende con contenido nativo a través de nuestras series seleccionadas de YouTube',
    search: 'Buscar videos o canales...',
    searchPlaceholder: 'Buscar por título, canal o descripción',
    filters: {
      all: 'Todos los canales',
      channel: 'Canal',
      duration: 'Duración',
      any: 'Cualquier duración',
      short: '< 5 min',
      medium: '5-15 min',
      long: '> 15 min',
      sortBy: 'Ordenar por',
      newest: 'Más recientes',
      oldest: 'Más antiguos',
      mostViewed: 'Más vistos',
      leastViewed: 'Menos vistos',
    },
    viewModes: {
      grid: 'Vista de cuadrícula',
      list: 'Vista de lista',
    },
    videoCard: {
      views: '{{count}} vistas',
      duration: '{{duration}}',
      practice: 'Practicar',
      shadowing: 'Iniciar shadowing',
      noThumbnail: 'Sin miniatura',
    },
    channelHeader: {
      videos: '{{count}} videos',
      viewChannel: 'Ver canal',
    },
    empty: {
      noVideos: 'No se encontraron videos',
      tryDifferent: 'Intenta ajustar tus filtros o términos de búsqueda',
      noChannels: 'No hay canales disponibles',
      checkBack: 'Vuelve más tarde para ver nuevo contenido',
    },
    loading: {
      channels: 'Cargando canales...',
      videos: 'Cargando videos...',
    },
    errors: {
      loadFailed: 'Error al cargar el contenido',
      tryAgain: 'Por favor, inténtalo de nuevo más tarde',
    },
  },

  todos: {
    title: 'Mis Tareas',
    addNew: 'Añadir Nueva Tarea',
    noTodos: 'No hay tareas todavía. ¡Crea tu primera tarea!',
    noActiveTodos: 'No hay tareas activas',
    noCompletedTodos: 'No hay tareas completadas',
    signInRequired: 'Por favor, inicia sesión para gestionar tus tareas',
    errorLoading: 'Error al cargar las tareas',
    limitReached: 'Has alcanzado tu límite diario de tareas',
    usage: '{{remaining}} de {{limit}} tareas restantes hoy',

    titleLabel: 'Título',
    titlePlaceholder: '¿Qué hay que hacer?',
    descriptionLabel: 'Descripción',
    descriptionPlaceholder: 'Añade más detalles (opcional)',
    priorityLabel: 'Prioridad',
    dueDateLabel: 'Fecha de vencimiento',
    due: 'Vencimiento',
    tagsLabel: 'Etiquetas',
    tagPlaceholder: 'Añadir una etiqueta...',
    addTag: 'Añadir',
    creating: 'Creando...',

    priority: {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      label: 'Prioridad',
    },

    filter: {
      all: 'Todas',
      active: 'Activas',
      completed: 'Completadas',
    },

    sort: {
      date: 'Ordenar por Fecha',
      priority: 'Ordenar por Prioridad',
    },

    demoBanner: {
      title: 'Función de Demostración',
      description:
        'Esta lista de tareas demuestra la arquitectura Moshimoshi incluyendo autenticación, derechos e integración con Firebase.',
      limits: 'Límites diarios',
      guestLimit: 'Usuarios invitados: Sin acceso',
      freeLimit: 'Usuarios gratuitos: 5 tareas por día',
      premiumLimit: 'Usuarios Premium: Tareas ilimitadas',
      signInPrompt: '¡Inicia sesión para empezar a crear tareas!',
      upgradePrompt: '¡Actualiza a Premium para tareas ilimitadas!',
    },

    techDemo: {
      title: 'Demostración Técnica',
      auth: 'Autenticación del lado del servidor con sesiones JWT',
      entitlements: 'Verificación centralizada de derechos',
      firebase: 'Firebase Firestore para persistencia de datos',
      subscription: 'Verificación del nivel de suscripción',
      i18n: 'Soporte completo de internacionalización',
      darkMode: 'Estilo adaptativo al tema',
      responsive: 'Diseño responsivo móvil',
    },

    form: {
      titlePlaceholder: '¿Qué hay que hacer?',
      descriptionPlaceholder: 'Añade más detalles (opcional)',
      addButton: 'Crear Tarea',
    },

    item: {
      cancel: 'Cancelar',
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
    title: 'Mis Videos de Práctica',
    subtitle: 'Historial de YouTube',
    backToHome: 'Volver al Inicio',
    loginRequired: 'Inicia sesión para rastrear tu historial',
    loginDescription:
      'Inicia sesión para rastrear tu historial de práctica y acceder rápidamente a los videos que has visto.',

    hero: {
      title: 'Tu Historial de Práctica',
      syncedDescription: 'Sincronizado en todos los dispositivos',
      localDescription: 'Guardado en este dispositivo',
    },

    stats: {
      videosPracticed: 'Videos Practicados',
      totalSessions: 'Sesiones Totales',
      practiceTime: 'Tiempo de Práctica',
    },

    storage: {
      freeTitle: 'Cuenta Gratuita - Solo Almacenamiento Local',
      freeDescription:
        'Tu historial se guarda solo en este dispositivo. Actualiza a Premium para sincronizar en todos tus dispositivos.',
    },

    search: {
      placeholder: 'Buscar en el historial...',
      noResults: 'Sin Resultados',
      noResultsDescription:
        'Ningún video coincide con "{{query}}". Prueba con otro término de búsqueda.',
    },

    sort: {
      mostRecent: 'Más Reciente',
      mostPracticed: 'Más Practicado',
    },

    video: {
      practiceAgain: 'Practicar de Nuevo',
      practiceCount: 'Practicado {{count}}x',
      duration: '{{minutes}}m',
      today: 'Hoy',
      yesterday: 'Ayer',
      daysAgo: 'Hace {{days}} días',
      weeksAgo: 'Hace {{weeks}} semanas',
      delete: 'Eliminar del historial',
    },

    empty: {
      title: 'Sin Historial de Práctica',
      description:
        'Comienza a practicar con videos de YouTube y aparecerán aquí para un acceso rápido.',
      startPracticing: 'Comenzar a Practicar',
    },

    loading: {
      message: 'Cargando historial...',
    },

    confirmDelete: {
      title: 'Eliminar Video',
      message: '¿Estás seguro de que quieres eliminar "{{title}}" de tu historial?',
      confirm: 'Eliminar',
      cancel: 'Cancelar',
    },
  },

  // Shadowing Feature
  shadowing: {
    title: 'Ejercicio de Shadowing',
    noSentence: 'No hay oración para reproducir',
    playbackError: 'Error en la reproducción de audio',
    voice: 'Voz',
    male: 'Hombre',
    female: 'Mujer',
    speed: 'Velocidad',
    repeatCount: 'Número de Repeticiones',
    pauseDuration: 'Pausa entre Repeticiones',
    showFurigana: 'Mostrar Furigana',
    furiganaDescription: 'Mostrar pistas de lectura sobre caracteres kanji',
    sentenceProgress: 'Oración {{current}} de {{total}}',
    repeatProgress: 'Repetición {{current}}/{{total}}',
    saveSentence: 'Guardar oración en lista de estudio',
    noSentenceAvailable: 'No hay oración disponible',
    repeatProgressLabel: 'Progreso de Repeticiones:',
    sentenceProgressLabel: 'Progreso de Oraciones:',
    allSentences: 'Todas las Oraciones',
    sentenceSaved: 'Oración guardada exitosamente',
    saveFailed: 'Error al guardar la oración',
    instructions1: 'Escucha cada oración y repítela durante la pausa.',
    instructions2: 'Ajusta la configuración según tu ritmo de aprendizaje.',

    // Floating Navbar (Mobile)
    floatingNavbar: {
      message: 'Explicar gramática',
      repeat: 'Repetir',
      play: 'Reproducir',
      pause: 'Pausa',
      settings: 'Configuración',
    },
  },

  aiGrammar: {
    title: 'Explicación gramatical',
    trigger: 'Explicar gramática',
    targetSentence: 'Frase objetivo',
    analyzing: 'Analizando la gramática...',
    errorTitle: 'No se pudo generar la explicación',
    error: 'Se produjo un error al generar la explicación gramatical. Inténtalo de nuevo.',
    cachedLabel: 'Cargado desde caché',
    structureLabel: 'Estructura',
    examplesLabel: 'Ejemplos',
    mistakesLabel: 'Errores comunes',
    relatedLabel: 'Patrones relacionados',
    formalityLabel: 'Formalidad',
  },

  // Drill Feature
  drill: {
    title: 'Ejercicio de Conjugación',
    description: 'Practica las conjugaciones de verbos y adjetivos japoneses',
    loading: 'Cargando ejercicio...',
    settings: 'Configuración del Ejercicio',

    // Practice mode section
    practiceMode: 'Modo de Práctica',
    randomWords: 'Palabras Aleatorias',
    randomDescription: 'Practicar con palabras comunes',
    fromLists: 'De Mis Listas',
    listsDescription: 'Usar tus listas de estudio',
    myLists: 'Mis Listas',

    // Word types section
    wordTypes: 'Tipos de Palabras',
    wordTypeFilter: 'Filtro de Tipo de Palabra',
    allTypes: 'Todos los Tipos',
    verbs: 'Verbos',
    adjectives: 'Adjetivos',
    verbsOnly: 'Solo Verbos',
    adjectivesOnly: 'Solo Adjetivos',

    // Buttons and actions
    startDrill: 'Comenzar Ejercicio',
    tryAgain: 'Intentar de Nuevo',
    newDrill: 'Nuevo Ejercicio',
    backToSetup: 'Volver a Configuración',
    backToDashboard: 'Volver al Panel',
    seeResults: 'Ver Resultados',
    showResults: 'Mostrar Resultados',
    nextQuestion: 'Siguiente Pregunta',
    finish: 'Terminar',

    // Questions and game play
    question: 'Pregunta',
    questionNumber: 'Pregunta {{current}} de {{total}}',
    conjugateTo: 'Conjugar en',
    correctAnswer: 'Respuesta Correcta',
    yourAnswer: 'Tu Respuesta',
    showAnswer: 'Mostrar Respuesta',
    rule: 'Regla',

    // Results
    complete: '¡Ejercicio Completado!',
    correct: '¡Correcto!',
    incorrect: 'Incorrecto',
    score: 'Puntuación',
    yourScore: 'Tu Puntuación',
    accuracy: 'Precisión',
    results: 'Resultados',
    excellentPerformance: '¡Excelente trabajo! ¡Has dominado estas conjugaciones!',
    goodPerformance: '¡Buen trabajo! ¡Estás progresando bien!',
    keepPracticing: '¡Sigue practicando! ¡Mejorarás con más ejercicios!',

    // Progress stats
    yourProgress: 'Tu Progreso',
    totalDrills: 'Ejercicios Totales',
    perfectDrills: 'Perfecto',
    wordsStudied: 'Palabras',

    // Settings
    questionsPerSession: 'Preguntas por sesión',
    autoAdvance: 'Avanzar automáticamente a la siguiente pregunta',
    showRules: 'Mostrar reglas de conjugación',
    hideRules: 'Ocultar reglas',
    remainingToday: '{{count}} ejercicios restantes hoy',
    upgradeForMore: 'Actualiza a Premium para más preguntas por sesión',

    // Messages
    limitReached: 'Límite diario de ejercicios alcanzado',
    startError: 'No se pudo iniciar el ejercicio. Por favor, inténtelo de nuevo.',

    // Conjugation forms
    forms: {
      present: 'Presente',
      past: 'Pasado',
      negative: 'Negativo',
      pastNegative: 'Pasado Negativo',
      polite: 'Cortés',
      politePast: 'Pasado Cortés',
      politeNegative: 'Negativo Cortés',
      politePastNegative: 'Pasado Negativo Cortés',
      teForm: 'Forma Te',
      potential: 'Potencial',
      passive: 'Pasivo',
      causative: 'Causativo',
      conditional: 'Condicional',
      volitional: 'Volitivo',
      imperative: 'Imperativo',
      taiForm: 'Forma Tai (querer)',
      adverbial: 'Adverbial',
    },

    // Messages
    noQuestions: 'No se encontraron palabras conjugables. Prueba configuraciones diferentes.',
    selectLists: 'Por favor selecciona al menos una lista para practicar.',
    noConjugableWords: 'No se encontraron palabras conjugables en las listas seleccionadas.',
    dailyLimitReached: 'Has alcanzado tu límite diario de ejercicios.',
    loadingQuestions: 'Cargando preguntas...',
    of: 'de',
  },

  // PWA (Progressive Web App)
  pwa: {
    install: {
      title: 'Instalar Moshimoshi',
      description: 'Instala la aplicación para una mejor experiencia',
      button: 'Instalar App',
      later: 'Más tarde',
      benefits: {
        offline: 'Accede a tus lecciones sin conexión',
        faster: 'Tiempos de carga más rápidos',
        notifications: 'Recibe recordatorios de revisión',
      },
      ios: {
        instructions: 'Cómo instalar en iOS:',
        step1: 'Toca el botón Compartir',
        step2: 'Desplázate y toca "Añadir a pantalla de inicio"',
        step3: 'Toca "Añadir" para instalar',
      },
    },
    notifications: {
      permission: {
        title: 'Habilitar notificaciones',
        description: 'Recibe recordatorios cuando las revisiones estén pendientes',
        allow: 'Permitir notificaciones',
        deny: 'Ahora no',
        blocked:
          'Las notificaciones están bloqueadas. Por favor, actívalas en la configuración de tu navegador.',
        unsupported: 'Las notificaciones no son compatibles con tu navegador',
      },
      quietHours: {
        title: 'Horas silenciosas',
        description: 'No enviar notificaciones durante estas horas',
        start: 'Hora de inicio',
        end: 'Hora de fin',
        enabled: 'Horas silenciosas activadas',
        disabled: 'Horas silenciosas desactivadas',
      },
      test: {
        title: 'Notificación de prueba',
        body: 'Esta es una prueba de tu configuración de notificaciones',
        button: 'Enviar prueba',
      },
    },
    badge: {
      reviewsDue: '{{count}} revisiones pendientes',
      clearBadge: 'Borrar insignia',
    },
    share: {
      title: 'Añadir a Moshimoshi',
      description: 'Elige dónde guardar este contenido',
      addToList: 'Añadir a lista',
      createNew: 'Crear nueva lista',
      selectList: 'Seleccionar una lista',
      success: 'Contenido añadido con éxito',
      error: 'Error al añadir el contenido',
    },
    mediaSession: {
      playing: 'Reproduciendo',
      paused: 'Pausado',
      playbackRate: 'Velocidad de reproducción',
    },
    offline: {
      title: 'Estás sin conexión',
      description: 'Algunas funciones pueden estar limitadas sin conexión a internet',
      cached: 'Viendo contenido en caché',
      retry: 'Reintentar conexión',
    },
    updateAvailable: 'Actualización disponible',
    updateDescription:
      'Una nueva versión de la aplicación está disponible. Actualiza ahora para obtener las últimas funciones.',
    updateNow: 'Actualizar ahora',
  },

  // Stories
  stories: {
    title: 'Historias',
    description: 'Aprende con historias interactivas en japonés',
    createNew: 'Crear Nueva',
    generateAI: 'Generar con IA',
    published: 'Publicado',
    draft: 'Borrador',
    viewStory: 'Ver Historia',
    editStory: 'Editar',
    deleteStory: 'Eliminar',
    confirmDelete: '¿Estás seguro de que quieres eliminar esta historia?',
    emptyState: 'Aún no hay historias',
    createFirst: 'Crea tu primera historia para comenzar',
    jlptLevel: 'Nivel JLPT',
    theme: 'Tema',
    pageCount: '{{count}} páginas',
    quizQuestions: '{{count}} preguntas',
    takeQuiz: 'Hacer Quiz',
    finish: 'Finalizar',
    quiz: {
      title: 'Quiz de Historia',
      yourScore: 'Tu Puntuación',
      excellent: '¡Excelente!',
      good: '¡Buen Trabajo!',
      keepPracticing: '¡Sigue Practicando!',
    },
  },

  // Privacy Policy Page
  privacy: {
    title: 'Política de Privacidad',
    lastUpdated: 'Última actualización: Enero 2025',
    footer: 'Gracias por confiar en Moshimoshi para tu viaje de aprendizaje del japonés.',
    sections: {
      introduction: {
        title: '1. Introducción',
        content:
          'Bienvenido a Moshimoshi ("nosotros", "nuestro" o "nos"). Estamos comprometidos a proteger tu información personal y tu derecho a la privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos tu información cuando usas nuestra aplicación de aprendizaje de japonés.',
        agreement:
          'Al usar Moshimoshi, aceptas la recopilación y uso de información de acuerdo con esta política. Si no estás de acuerdo con nuestras políticas y prácticas, por favor no uses nuestros servicios.',
      },
      collection: {
        title: '2. Información que recopilamos',
        provided: {
          title: '2.1 Información que proporcionas',
          account: 'Información de cuenta',
          accountDesc:
            'Dirección de correo electrónico, nombre de usuario y foto de perfil al crear una cuenta',
          learning: 'Datos de aprendizaje',
          learningDesc:
            'Tu progreso, vocabulario guardado, resultados de práctica y preferencias de estudio',
          content: 'Contenido de usuario',
          contentDesc:
            'Notas, listas de palabras personalizadas y cualquier contenido que crees dentro de la aplicación',
          communications: 'Comunicaciones',
          communicationsDesc: 'Comentarios, solicitudes de soporte y correspondencia con nosotros',
        },
        automatic: {
          title: '2.2 Información recopilada automáticamente',
          device: 'Información del dispositivo',
          deviceDesc:
            'Tipo de navegador, sistema operativo, tipo de dispositivo e identificadores únicos',
          usage: 'Datos de uso',
          usageDesc:
            'Funciones utilizadas, tiempo dedicado, páginas visitadas y patrones de interacción',
          performance: 'Datos de rendimiento',
          performanceDesc: 'Informes de fallos, registros de errores y métricas de rendimiento',
          analytics: 'Analíticas',
          analyticsDesc: 'Estadísticas agregadas para mejorar nuestros servicios',
        },
        thirdParty: {
          title: '2.3 Servicios de terceros',
          intro:
            'Utilizamos los siguientes servicios de terceros que pueden recopilar información:',
          firebase: 'Autenticación, base de datos y analíticas',
          stripe: 'Procesamiento de pagos (no almacenamos datos de tarjetas de crédito)',
          openai: 'Funciones impulsadas por IA (contenido anonimizado)',
        },
      },
      usage: {
        title: '3. Cómo usamos tu información',
        intro: 'Usamos la información que recopilamos para:',
        provide: 'Proporcionar y mantener nuestros servicios de aprendizaje de idiomas',
        personalize: 'Personalizar tu experiencia de aprendizaje y seguir tu progreso',
        process: 'Procesar transacciones y gestionar suscripciones',
        notify: 'Enviar notificaciones y actualizaciones relacionadas con el servicio',
        support: 'Responder a solicitudes de soporte y comentarios',
        improve: 'Mejorar nuestros servicios a través de analíticas e investigación',
        comply: 'Cumplir con obligaciones legales y proteger nuestros derechos',
      },
      security: {
        title: '4. Almacenamiento y seguridad de datos',
        content:
          'Implementamos medidas técnicas y organizativas apropiadas para proteger tus datos.',
        measures: {
          title: 'Nuestras medidas de seguridad',
          encryption: 'Cifrado de extremo a extremo para datos sensibles',
          https: 'Conexiones HTTPS seguras para todas las transferencias de datos',
          audits: 'Auditorías de seguridad regulares y evaluaciones de vulnerabilidades',
          access: 'Controles de acceso y mecanismos de autenticación',
        },
        location: {
          title: 'Ubicación de los datos',
          content:
            'Tus datos se almacenan en servidores seguros proporcionados por Google Firebase, ubicados en Estados Unidos. Para usuarios de la Unión Europea, los datos pueden transferirse internacionalmente de acuerdo con las leyes de protección de datos aplicables.',
        },
        local: {
          title: 'Almacenamiento local',
          content:
            'Algunos datos se almacenan localmente en tu dispositivo para acceso sin conexión y optimización del rendimiento. Esto incluye contenido en caché, preferencias y actividad reciente.',
        },
      },
      rights: {
        title: '5. Tus derechos y opciones',
        exercise: 'Para ejercer cualquiera de estos derechos, contáctanos en',
        exerciseSuffix: 'o a través de la configuración de tu cuenta.',
        yourRights: {
          title: 'Tienes derecho a:',
          access: 'Acceso',
          accessDesc: 'Solicitar una copia de tus datos personales',
          correct: 'Corrección',
          correctDesc: 'Actualizar o corregir información inexacta',
          delete: 'Eliminación',
          deleteDesc: 'Solicitar la eliminación de tu cuenta y datos',
          export: 'Exportación',
          exportDesc: 'Descargar tus datos en un formato portátil',
          optOut: 'Exclusión',
          optOutDesc: 'Cancelar la suscripción a comunicaciones de marketing',
          restrict: 'Restricción',
          restrictDesc: 'Limitar el procesamiento de tus datos en ciertas circunstancias',
        },
      },
      contact: {
        title: '6. Información de contacto',
        intro:
          'Si tienes preguntas o inquietudes sobre esta política de privacidad o nuestras prácticas de datos, contáctanos:',
        email: 'Correo electrónico',
        support: 'Soporte',
      },
      recaptcha: {
        title: '7. Protección reCAPTCHA',
        content: 'Este sitio está protegido por reCAPTCHA y se aplican la',
        privacyPolicy: 'Política de Privacidad',
        and: 'y los',
        termsOfService: 'Términos de Servicio',
        apply: 'de Google.',
      },
    },
    acceptButton: 'Entiendo y acepto',
  },

  // Contact Page
  contact: {
    title: 'Contáctanos',
    subtitle: '¡Nos encantaría saber de ti!',
    error: 'Lo sentimos, hubo un error al enviar tu mensaje. Por favor, inténtalo de nuevo.',
    validation: {
      invalidEmail: 'Por favor, introduce una dirección de correo electrónico válida',
      messageTooShort: 'El mensaje debe tener al menos 10 caracteres',
      messageTooLong: 'El mensaje excede el límite de caracteres',
    },
    form: {
      name: 'Nombre',
      namePlaceholder: 'Tu nombre',
      email: 'Correo electrónico',
      emailPlaceholder: 'tu@email.com',
      category: 'Categoría',
      categories: {
        general: 'Consulta general',
        support: 'Soporte técnico',
        bug: 'Reportar error',
        feature: 'Solicitud de función',
        feedback: 'Comentarios',
        privacy: 'Preocupación de privacidad',
      },
      subject: 'Asunto',
      subjectPlaceholder: 'Breve descripción de tu consulta',
      message: 'Mensaje',
      messagePlaceholder: 'Cuéntanos más sobre tu consulta...',
      info: {
        title: 'Tu mensaje será enviado a',
        support: 'Soporte',
        feedback: 'Comentarios',
        privacy: 'Privacidad',
      },
      sending: 'Enviando...',
      submit: 'Enviar mensaje',
    },
    success: {
      title: '¡Mensaje enviado!',
      message: 'Gracias por contactarnos. ¡Te responderemos lo antes posible!',
      sendAnother: 'Enviar otro mensaje',
      goBack: 'Volver',
    },
    alternative: {
      title: 'Otras formas de contactarnos',
      email: {
        title: 'Envíanos un correo',
        description: 'Envíanos un correo en cualquier momento',
      },
      privacy: {
        title: 'Preocupaciones de privacidad',
      },
      social: {
        title: 'Síguenos',
        description: 'Mantente al día con nuestras últimas noticias',
      },
    },
  },

  // Leaderboard Page
  leaderboard: {
    title: 'Clasificación',
    yourRank: 'Tu posición',
    totalXP: 'XP Total',
    streak: 'Racha',
    global: 'Global',
    friends: 'Amigos',
    friendsComingSoon: 'Clasificación de amigos próximamente',
    friendsDescription: 'Conéctate con amigos y compite juntos en tu viaje de aprendizaje.',
    rank: 'Posición',
    learner: 'Estudiante',
    level: 'Nivel',
    xp: 'XP',
    noData: 'No hay datos de clasificación disponibles',
    loading: 'Cargando clasificación...',
  },

  // Resources Page
  resources: {
    notFound: 'Recurso no encontrado',
    backToResources: 'Volver a recursos',
    views: 'vistas',
    lastUpdated: 'Última actualización',
    relatedResources: 'Recursos relacionados',
    title: 'Recursos de aprendizaje',
    description: 'Recursos seleccionados para ayudarte en tu viaje de aprendizaje del japonés',
    categories: {
      all: 'Todo',
      grammar: 'Gramática',
      vocabulary: 'Vocabulario',
      reading: 'Lectura',
      listening: 'Escucha',
      speaking: 'Expresión oral',
      kanji: 'Kanji',
    },
  },

  // Kanji Browser Page
  kanjiBrowser: {
    searchPlaceholder: 'Buscar kanji por carácter, significado o lectura...',
    title: 'Explorador de Kanji',
    subtitle: 'Explora y aprende kanji japoneses',
    filters: {
      jlptLevel: 'Nivel JLPT',
      gradeLevel: 'Grado escolar',
      strokeCount: 'Número de trazos',
      radical: 'Radical',
    },
    sort: {
      frequency: 'Frecuencia',
      strokes: 'Trazos',
      grade: 'Grado',
    },
    details: {
      meanings: 'Significados',
      readings: 'Lecturas',
      onyomi: "On'yomi",
      kunyomi: "Kun'yomi",
      strokes: 'Trazos',
      examples: 'Ejemplos',
      radicals: 'Radicales',
    },
    noResults: 'No se encontraron kanji que coincidan con tus criterios',
    loading: 'Cargando kanji...',
  },
}
