export const strings = {
  reviewDashboard: {
    title: "復習ダッシュボード",
    description: "学習進捗と復習スケジュールを追跡",
    tabs: {
      overview: "概要",
      studied: "学習済み",
      learned: "習得済み",
      queue: "キュー",
      schedule: "スケジュール"
    },
    sections: {
      reviewQueue: "復習キュー",
      upcomingReviews: "今後の復習",
      learningProgress: "学習進捗",
      allStudiedItems: "すべての学習項目",
      learnedItems: "習得項目",
      masteredItems: "マスター済み",
      inReview: "復習中",
      reviewQueueFull: "復習キュー - 今すぐ復習",
      reviewSchedule: "復習スケジュール"
    },
    stats: {
      studied: "学習済み",
      learned: "習得済み",
      dueNow: "今すぐ",
      upcoming: "今後"
    },
    filter: {
      all: "すべて",
      kana: "かな",
      kanji: "漢字",
      vocabulary: "単語",
      sentences: "文章"
    },
    actions: {
      startReview: "復習を開始",
      viewAll: "すべて表示",
      refresh: "更新"
    },
    messages: {
      noReviewsDue: "今復習するものはありません。よくできました！",
      noUpcoming: "今後の復習はありません",
      noItemsFiltered: "このフィルターに該当する項目はありません",
      noStudiedItems: "まだ学習した項目はありません",
      queueEmpty: "復習キューは空です！",
      loading: "復習データを読み込み中...",
      loadError: "復習データの読み込みに失敗しました"
    },
    time: {
      today: "今日",
      tomorrow: "明日",
      thisWeek: "今週"
    },
    contentTypes: {
      kana: "かな",
      kanji: "漢字",
      vocabulary: "単語",
      sentence: "文章"
    }
  },
  // Common/Shared
  common: {
    brand: "もしもし",
    loading: "読み込み中...",
    processing: "処理中...",
    close: "閉じる",
    cancel: "キャンセル",
    confirm: "確認",
    save: "保存",
    delete: "削除",
    edit: "編集",
    back: "戻る",
    next: "次へ",
    previous: "前へ",
    submit: "送信",
    continue: "続ける",
    clear: "クリア",
    signIn: "サインイン",
    signUp: "サインアップ",
    signOut: "サインアウト",
    logOut: "ログアウト",
    email: "メールアドレス",
    filter: "フィルター",
    actions: "アクション",
    display: "表示",
    password: "パスワード",
    name: "名前",
    or: "または",
    and: "と",
    with: "で",
    retry: "再試行",
    free: "無料",
    premium: "プレミアム",
    guest: "ゲスト",
    creating: "作成中...",
    saving: "保存中...",
    upgrade: "アップグレード",
    today: "今日",
    yesterday: "昨日",
    theme: "テーマ",
  },

  // Landing Page
  landing: {
    header: {
      navigation: {
        about: "について",
        pricing: "料金",
        signIn: "サインイン",
      },
    },
    hero: {
      badge: "無料！",
      title: "日本語を学ぼう",
      subtitle: "楽しく学習！",
      description: "ひらがな、カタカナ、漢字を効率的に学習。スペースドリピティションで確実に身につく！",
      primaryCta: "今すぐ学習を始める",
      secondaryCta: "すでにアカウントをお持ちの方",
    },
    mascots: {
      sakura: "さくら",
      matcha: "抹茶",
      fuji: "富士",
      torii: "鳥居",
    },
    features: {
      personalizedLearning: {
        title: "パーソナライズド学習",
        description: "AIがあなたのペースと学習スタイルに合わせてレッスンを調整",
      },
      stayMotivated: {
        title: "モチベーション維持",
        description: "XPを獲得し、連続記録を維持し、実績を解除",
      },
      smartReview: {
        title: "スマート復習システム",
        description: "SRSアルゴリズムで最適なタイミングで復習",
      },
    },
    stats: {
      title: "数千人が日本語を学習中！",
      activeLearners: {
        number: "500万+",
        label: "アクティブ学習者",
      },
      lessons: {
        number: "1万+",
        label: "レッスン",
      },
      successRate: {
        number: "95%",
        label: "成功率",
      },
    },
    progressPreview: {
      title: "あなたの学習の旅",
      stage1: {
        title: "ひらがな・カタカナ",
        description: "2週間で基礎をマスター",
      },
      stage2: {
        title: "基本漢字",
        description: "記憶術で100以上の基本漢字を学習",
      },
      stage3: {
        title: "上級漢字",
        description: "流暢さのために1000以上の漢字をマスター",
      },
    },
    finalCta: {
      title: "旅を始める準備はできましたか？",
      description: "無料で楽しく、1日たった5分！",
      buttonText: "無料で旅を始める",
    },
  },

  // Dashboard
  dashboard: {
    loading: "ダッシュボードを読み込み中...",
    stats: {
      streak: {
        label: "連続記録",
        unit: "日",
      },
      xpEarned: {
        label: "獲得XP",
        unit: "ポイント",
      },
      progress: {
        label: "進捗",
        unit: "%",
      },
      achievements: {
        label: "実績",
        unit: "最近",
      },
      wordsLearned: {
        label: "学習単語数",
        unit: "単語",
      },
      timeStudied: {
        label: "学習時間",
        unit: "時間",
      },
    },
    greetings: {
      morning: {
        japanese: "おはよう",
        english: "おはよう",
      },
      afternoon: {
        japanese: "こんにちは",
        english: "こんにちは",
      },
      evening: {
        japanese: "こんばんは",
        english: "こんばんは",
      },
    },
    navigation: {
      userMenuAria: "ユーザーメニュー",
      account: "アカウント",
      settings: "設定",
      adminDashboard: "管理ダッシュボード",
      backToDashboard: "← ダッシュボードに戻る",
    },
    welcome: {
      firstVisit: "もしもしへようこそ！ドーシが一緒に学習するのを楽しみにしています！ 🎉",
      firstVisitMessage: "日本語学習の冒険へようこそ！ドーシがあなたをガイドします。",
      returningMessage: "旅を続ける準備はできましたか？あなたの献身は素晴らしいです！",
      signoutToast: "さよなら！またね！ 👋",
      doshiClick: "ドーシ：がんばって！",
    },
    progress: {
      dailyGoal: {
        title: "デイリーゴール",
        tooltip: "毎日30分の学習を完了",
        progressLabel: "進捗",
        encouragement: "頑張って！{{percentage}}%完了！",
      },
      achievement: {
        title: "最新の実績",
        earnedTime: "{{time}}前に獲得",
      },
    },
    account: {
      title: "アカウント詳細",
      upgradeTooltip: "プレミアムにアップグレードして無制限レッスン！",
      upgradeLink: "アップグレード →",
      fields: {
        email: "メールアドレス",
        memberSince: "メンバー登録日",
        emailStatus: "メール認証状態",
      },
      emailStatusValues: {
        verified: "✓ 認証済み",
        pending: "⚠ 認証待ち",
      },
      defaultMemberSince: "最近参加",
    },
    developer: {
      modeTitle: "開発者モード",
      authTestLink: "→ 認証テストページ",
    },
    greeting: {
      morning: "おはようございます",
      afternoon: "こんにちは",
      evening: "こんばんは"
    },
    learningVillage: {
      title: "学習の村へようこそ",
      subtitle: "日本語マスターへの道を選びましょう",
      clickToStart: "どの学習エリアでもクリックして旅を始めましょう！"
    },
    cards: {
      hiragana: {
        title: "Hiragana",
        subtitle: "ひらがな",
        description: "流れるような文字をマスター"
      },
      katakana: {
        title: "Katakana",
        subtitle: "カタカナ",
        description: "角張った文字を学習"
      },
      kanji: {
        title: "Kanji",
        subtitle: "漢字",
        description: "古代中国の文字"
      },
      vocabulary: {
        title: "Vocabulary",
        subtitle: "単語",
        description: "語彙力を強化"
      },
      grammar: {
        title: "Grammar",
        subtitle: "文法",
        description: "文の構造を理解"
      },
      particles: {
        title: "Particles",
        subtitle: "助詞",
        description: "言葉をつなげる"
      },
      listening: {
        title: "Listening",
        subtitle: "聴解",
        description: "耳を鍛える"
      },
      speaking: {
        title: "Speaking",
        subtitle: "会話",
        description: "声に出して話す"
      },
      reading: {
        title: "Reading",
        subtitle: "読解",
        description: "文字を読み解く"
      },
      writing: {
        title: "Writing",
        subtitle: "作文",
        description: "文章で表現する"
      },
      culture: {
        title: "Culture",
        subtitle: "文化",
        description: "日本を深く理解"
      },
      business: {
        title: "Business",
        subtitle: "ビジネス",
        description: "ビジネス日本語"
      },
      travel: {
        title: "Travel",
        subtitle: "旅行",
        description: "日本を楽々旅行"
      },
      food: {
        title: "Food & Dining",
        subtitle: "料理",
        description: "地元のように注文"
      },
      anime: {
        title: "Anime & Manga",
        subtitle: "アニメ",
        description: "好きな作品から学習"
      },
      games: {
        title: "Games",
        subtitle: "ゲーム",
        description: "遊びながら学習"
      },
      music: {
        title: "Music",
        subtitle: "音楽",
        description: "歌から学習"
      },
      news: {
        title: "News",
        subtitle: "ニュース",
        description: "日本語のニュース"
      },
      jlpt: {
        title: "JLPT",
        subtitle: "JLPT対策",
        description: "検定試験に合格"
      },
      flashcards: {
        title: "Flashcards",
        subtitle: "カード",
        description: "復習セッション"
      },
      favourites: {
        title: "お気に入り",
        subtitle: "保存項目",
        description: "お気に入りを復習"
      },
      myLists: {
        title: "マイリスト",
        subtitle: "カスタムリスト",
        description: "カスタムリストを管理"
      }
    },
    achievements: {
      title: "実績",
      unlocked: "解除済み",
      points: "ポイント",
      complete: "完了",
      totalPoints: "合計ポイント",
      legendary: "レジェンダリー",
      epic: "エピック",
      rare: "レア",
      uncommon: "アンコモン",
      common: "コモン",
      categories: {
        all: "すべて",
        progress: "進捗",
        streak: "連続記録",
        accuracy: "正確性",
        speed: "スピード",
        special: "特別"
      },
      latest: "最新の実績",
      tabs: {
        overview: "概要",
        progress: "進捗",
        insights: "分析"
      },
      stats: "{{unlocked}}/{{total}} 解除済み • {{points}} ポイント • {{percent}}% 完了",
      latestAchievement: "最新の実績",
      readyToStart: "準備完了！",
      firstLesson: "最初のレッスンを完了して実績を獲得",
      yourJourney: "旅が始まります"
    },
    dailyGoal: {
      title: "デイリーゴール",
      progress: "進捗",
      minutes: "{{min}}/30 分",
      startPractice: "デイリーゴール達成のため練習を始めましょう！"
    },
    accountDetails: {
      title: "アカウント詳細",
      email: "メールアドレス",
      emailStatus: "メール認証状態",
      verified: "認証済み",
      memberSince: "メンバー登録日",
      recentlyJoined: "最近参加",
      upgrade: "アップグレード"
    },
    developerMode: "開発者モード",
    authTestPage: "認証テストページ"
  },

  // Auth Pages
  auth: {
    signin: {
      branding: {
        logoText: "も",
      },
      page: {
        title: "おかえりなさい！",
        subtitle: "日本語学習を続けるためにサインイン",
      },
      form: {
        labels: {
          email: "メールアドレス",
          password: "パスワード",
        },
        placeholders: {
          email: "you@example.com",
          password: "••••••••",
        },
        checkbox: "ログイン状態を保持",
        submitButton: {
          default: "サインイン",
          loading: "サインイン中...",
        },
      },
      links: {
        forgotPassword: "パスワードを忘れた？",
        signupLink: "アカウントをお持ちでない？無料で登録",
      },
      alternativeAuth: {
        divider: "または以下で続ける",
        magicLinkButton: "マジックリンクを送信",
        googleButton: "Googleで続ける",
      },
      messages: {
        signupSuccess: "アカウント作成完了！サインインしてください。",
        signinSuccess: "おかえりなさい！",
        magicLinkError: "続けるにはメールアドレスを入力してください。",
        magicLinkSuccess: "メールでマジックリンクを確認してください！",
      },
      errors: {
        signinFailed: "サインインに失敗しました",
        sessionCreationFailed: "セッションの作成に失敗しました",
        magicLinkFailed: "マジックリンクの送信に失敗しました",
        firebaseNotInitialized: "Firebaseが初期化されていません",
      },
    },
    signup: {
      page: {
        title: "旅を始めよう",
        subtitle: "無料アカウントを作成して日本語を学ぶ",
      },
      form: {
        labels: {
          name: "名前（オプション）",
          email: "メールアドレス",
          password: "パスワード",
        },
        placeholders: {
          name: "あなたの名前",
          email: "you@example.com",
          password: "••••••••",
        },
        passwordRequirements: "8文字以上、大文字1つ、数字1つ、特殊文字1つを含む",
        termsAgreement: "{{terms}}と{{privacy}}に同意します",
        termsLink: "利用規約",
        privacyLink: "プライバシーポリシー",
        submitButton: {
          default: "無料アカウントを作成",
          loading: "アカウント作成中...",
        },
      },
      links: {
        signinLink: "すでにアカウントをお持ち？サインイン",
      },
      alternativeAuth: {
        divider: "または以下で登録",
        googleButton: "Googleで続ける",
        magicLinkButton: "マジックリンクでサインアップ",
      },
      magicLink: {
        title: "マジックリンクサインアップ",
        subtitle: "メールにログインリンクを送信します",
        sendButton: "マジックリンクを送信",
        sending: "送信中...",
        backButton: "通常のサインアップに戻る",
        successTitle: "メールをご確認ください！",
        successMessage: "マジックリンクを送信しました：",
        successDescription: "メール内のリンクをクリックしてログインしてください。",
        tryDifferentMethod: "別の方法を試す",
      },
      messages: {
        signupSuccess: "アカウント作成成功！サインインできます。",
        googleNewUser: "もしもしへようこそ！日本語学習の旅を始めましょう！",
        googleExistingUser: "おかえりなさい！",
        magicLinkSent: "マジックリンクを送信しました！メールを確認してログインしてください。",
      },
      errors: {
        signupFailed: "サインアップに失敗しました",
        sessionCreationFailed: "セッションの作成に失敗しました",
        firebaseNotInitialized: "Firebaseが初期化されていません",
        magicLinkFailed: "マジックリンクの送信に失敗しました",
      },
    },
  },

  // Admin Dashboard
  admin: {
    pageTitle: "ダッシュボード概要",
    pageDescription: "おかえりなさい！今日のもしもしの状況です。",
    loading: "管理ダッシュボードを読み込み中...",
    errorMessages: {
      loadingError: "ダッシュボードの読み込みエラー：",
      fetchError: "統計の取得に失敗しました",
      generalError: "エラーが発生しました",
    },
    statCards: {
      totalUsers: "総ユーザー数",
      activeToday: "今日のアクティブ",
      newUsersToday: "今日の新規ユーザー",
      activeSubscriptions: "アクティブな購読",
      monthlyRevenue: "月間収益",
      trialUsers: "トライアルユーザー",
      totalLessons: "総レッスン数",
      completedToday: "今日の完了",
    },
    sections: {
      quickActions: "クイックアクション",
      recentUsers: "最近のユーザー",
      systemStatus: "システムステータス",
      newsScraping: "ニューススクレイピング",
    },
    quickActionButtons: {
      moodBoards: "ムードボード",
      users: "ユーザー",
      content: "コンテンツ",
      analytics: "分析",
    },
    systemMetrics: {
      database: "データベース",
      operational: "動作中",
      apiResponseTime: "APIレスポンス時間",
      cacheHitRate: "キャッシュヒット率",
      errorRate: "エラー率",
      uptime: "稼働時間",
    },
    userLabels: {
      user: "ユーザー",
      noRecentUsers: "最近のユーザーなし",
      daysAgo: "{{days}}日前",
      hoursAgo: "{{hours}}時間前",
      minutesAgo: "{{minutes}}分前",
      justNow: "たった今",
    },
    newsScraping: {
      nhkEasy: "NHKやさしいニュース",
      nhkSchedule: "4時間ごと",
      watanoc: "Watanoc",
      watanocSchedule: "6時間ごと",
      mainichiShogakusei: "毎日小学生新聞",
      mainichiSchedule: "毎日10:00",
      scrapingArticles: "記事をスクレイピング中...",
    },
  },

  // Account Page
  account: {
    pageTitle: "アカウント",
    pageDescription: "アカウント設定を管理",
    loadingMessage: "アカウントを読み込み中...",
    sections: {
      profileInformation: "プロフィール情報",
      accountStatistics: "アカウント統計",
      subscription: "サブスクリプション",
      dangerZone: "危険ゾーン",
    },
    profileFields: {
      profilePhoto: "プロフィール写真",
      photoDescription: "JPG、PNGまたはGIF。最大2MB。",
      displayName: "表示名",
      namePlaceholder: "名前を入力",
      emailAddress: "メールアドレス",
      verified: "認証済み",
      verify: "認証",
    },
    buttons: {
      saveChanges: "変更を保存",
      updating: "更新中...",
      deleteAccount: "アカウントを削除",
      upgradeText: "プレミアムにアップグレード",
      manageSubscription: "サブスクリプション管理 →",
    },
    statistics: {
      daysActive: "アクティブ日数",
      wordsLearned: "学習単語数",
      achievements: "実績",
      dayStreak: "連続日数",
    },
    subscription: {
      premium: "プレミアム",
      free: "無料",
      plan: "プラン",
      nextBilling: "次回請求",
      premiumMonthly: "プレミアム月額",
      premiumYearly: "プレミアム年額",
      freePlan: "無料プラン",
      manageSubscription: "サブスクリプション管理",
      upgradeToPremium: "プレミアムへアップグレード",
      currentPlan: "現在のプラン",
      upgradeText: "無制限の練習セッションとプレミアム機能をアンロックするためにアップグレード",
    },
    dangerZone: {
      description: "アカウントと関連するすべてのデータを削除します。この操作は元に戻せません。",
    },
    deleteAccountDialog: {
      title: "アカウントを削除しますか？",
      message: "本当にアカウントを削除しますか？進捗、実績、サブスクリプションを含むすべてのデータが完全に削除されます。この操作は元に戻せません。",
      confirmText: "はい、アカウントを削除",
      cancelText: "キャンセル",
    },
    toastMessages: {
      profileUpdated: "プロフィールが正常に更新されました！",
      accountDeletionRequested: "アカウント削除がリクエストされました。サポートにお問い合わせください。",
    },
  },

  // UI Components
  components: {
    alert: {
      dismissAriaLabel: "アラートを閉じる",
    },
    dialog: {
      defaultConfirm: "確認",
      defaultCancel: "キャンセル",
      processing: "処理中...",
    },
    doshi: {
      loading: "ドーシを読み込み中...",
      altText: "ドーシ - あなたの学習コンパニオン",
      failedToLoad: "レッサーパンダアニメーションの読み込みに失敗しました",
      ariaLabel: "{{alt}} - クリックして対話",
      moodAria: "ドーシは{{mood}}です",
    },
    drawer: {
      closeAriaLabel: "ドロワーを閉じる",
    },
    loading: {
      default: "読み込み中...",
      closeAriaLabel: "閉じる",
    },
    modal: {
      closeAriaLabel: "モーダルを閉じる",
    },
    theme: {
      lightAriaLabel: "ライトテーマ",
      systemAriaLabel: "システムテーマ",
      darkAriaLabel: "ダークテーマ",
    },
    toast: {
      closeAriaLabel: "閉じる",
      errorMessage: "useToastはToastProvider内で使用する必要があります",
    },
  },

  // Error Messages (User-Friendly)
  errors: {
    auth: {
      popupClosed: "サインインがキャンセルされました。準備ができたら再試行してください。",
      networkFailed: "接続の問題です。インターネットを確認して再試行してください。",
      tooManyRequests: "試行回数が多すぎます。しばらく待ってから再試行してください。",
      userDisabled: "このアカウントは無効になっています。サポートにお問い合わせください。",
      userNotFound: "このメールでアカウントが見つかりません。確認するか登録してください。",
      wrongPassword: "パスワードが正しくありません。再試行してください。",
      invalidEmail: "有効なメールアドレスを入力してください。",
      emailInUse: "このメールは既に登録されています。代わりにサインインしてください。",
      weakPassword: "より強力なパスワードを選択してください（最低6文字）。",
      invalidCredential: "無効な認証情報です。確認して再試行してください。",
      requiresRecentLogin: "このアクションを完了するには再度サインインしてください。",
      unauthorized: "このドメインは承認されていません。サポートにお問い合わせください。",
      invalidActionCode: "このリンクは期限切れまたは無効です。新しいものをリクエストしてください。",
    },
    validation: {
      invalidInput: "情報を確認して再試行してください。",
    },
    network: {
      connectionIssue: "接続の問題です。インターネットを確認してください。",
      timeout: "リクエストがタイムアウトしました。再試行してください。",
      offline: "オフラインのようです。接続を確認してください。",
    },
    payment: {
      authenticationFailure: "支払い認証に失敗しました。再試行してください。",
      cardDeclined: "カードが拒否されました。別の支払い方法を試してください。",
      expiredCard: "カードの有効期限が切れています。支払い情報を更新してください。",
      insufficientFunds: "残高不足です。別の支払い方法を試してください。",
      subscriptionRequired: "この機能にはプレミアムサブスクリプションが必要です。",
      subscriptionExpired: "サブスクリプションの有効期限が切れています。続けるには更新してください。",
    },
    permission: {
      denied: "このアクションを実行する権限がありません。",
      unauthorized: "続けるにはサインインしてください。",
      forbidden: "アクセスが拒否されました。エラーと思われる場合はサポートにお問い合わせください。",
    },
    resource: {
      notFound: "リクエストされたコンテンツが見つかりませんでした。",
      exhausted: "今日の制限に達しました。明日再試行してください。",
      alreadyExists: "これは既に存在します。別の名前を選択してください。",
    },
    server: {
      internal: "私たちの側で問題が発生しました。再試行してください。",
      serverError: "サーバーエラー。チームに通知されました。",
      unavailable: "サービスは一時的に利用できません。後で再試行してください。",
    },
    generic: {
      unknown: "予期しないエラーが発生しました。再試行してください。",
      somethingWrong: "問題が発生しました。再試行してください。",
    },
  },

  // News Feature
  news: {
    title: "日本語ニュース",
    subtitle: "実際の日本語ニュースを読む",
    description: "レベルに応じた日本語ニュース記事",
    loading: "記事を読み込み中...",
    loadMore: "もっと見る",
    refresh: "更新",
    filter: "フィルター",
    filtering: "フィルタリング",
    noArticles: "記事が見つかりませんでした",
    noArticlesDescription: "フィルターを変更するか、後でもう一度お試しください",
    failedToLoad: "記事の読み込みに失敗しました",
    retry: "再試行",
    back: "戻る",
    backToNews: "ニュース一覧に戻る",
    readingTime: "分",
    source: "出典",
    publishedOn: "公開日",
    viewOriginal: "元の記事を見る",
    levels: {
      all: "全レベル",
      n5: "N5 (初級)",
      n4: "N4 (初中級)",
      n3: "N3 (中級)",
      n2: "N2 (上級)",
      n1: "N1 (最上級)"
    },
    sources: {
      all: "全ソース",
      nhkEasy: "NHKやさしい",
      todaii: "Todaii",
      watanoc: "Watanoc",
      mainichiNews: "毎日新聞",
      mainichiShogakusei: "毎日小学生"
    },
    reader: {
      settings: "読み設定",
      fontSize: "文字サイズ",
      fontSizes: {
        small: "小",
        medium: "中",
        large: "大",
        xlarge: "特大"
      },
      showFurigana: "ふりがなを表示",
      withFurigana: "ふりがな付き",
      highlightGrammar: "文法ハイライト",
      lookupWord: "単語をクリックして定義を見る",
      wordNotFound: "単語が見つかりません",
      loading: "定義を読み込み中...",
      reading: "読み",
      meaning: "意味",
      type: "品詞",
      saveToList: "リストに保存",
      savedToList: "学習リストに保存されました",
      withFurigana: "ふりがな付き"
    },
    error: {
      loadFailed: "記事の読み込みに失敗しました",
      notFound: "記事が見つかりません",
      goBack: "ニュース一覧に戻る"
    }
  },

  // Subscription Management
  subscription: {
    status: {
      active: "アクティブ",
      inactive: "非アクティブ",
      canceled: "キャンセル済み",
      pastDue: "支払い期限超過",
      trialing: "トライアル中",
      incomplete: "未完了",
    },
    invoice: {
      title: "請求履歴",
      noInvoices: "請求書はまだありません",
      date: "日付",
      description: "説明",
      amount: "金額",
      status: "ステータス",
      actions: "アクション",
      download: "ダウンロード",
      subscription: "サブスクリプション",
      statuses: {
        paid: "支払済",
        open: "未払い",
        void: "無効",
        uncollectible: "回収不能",
      },
    },
    plans: {
      free: "無料プラン",
      guest: "ゲスト",
      premiumMonthly: "プレミアム月額",
      premiumYearly: "プレミアム年額",
    },
    badges: {
      premium: "プレミアム",
      premiumPlus: "プレミアム+",
      free: "無料",
    },
    renewal: {
      renews: "更新日",
      ends: "終了日",
      daysRemaining: "残り{{days}}日",
      willEndOn: "{{date}}に終了予定",
    },
    billing: {
      monthly: "月額",
      yearly: "年額",
      month: "月",
      year: "年",
      perMonth: "月あたり",
      perYear: "年あたり",
      save: "{{percent}}%お得",
    },
    actions: {
      upgrade: "アップグレード",
      upgradeNow: "今すぐアップグレード",
      manageBilling: "請求管理",
      viewPlans: "プランを見る",
      cancel: "キャンセル",
    },
    features: {
      unlimited: "無制限の練習セッション",
      cancelAnytime: "いつでもキャンセル可能",
      bestValue: "最もお得 - 25%節約",
      advancedSRS: "高度なSRSアルゴリズム",
      detailedAnalytics: "詳細な進捗分析",
      prioritySupport: "優先サポート",
      offlineMode: "オフラインモード",
      savePercentage: "月額プランと比較して25%節約",
      monthsFree: "2ヶ月無料",
      earlyAccess: "新機能への早期アクセス",
      personalizedInsights: "パーソナライズされた学習インサイト",
    },
    upgrade: {
      selectMonthly: "月額プランを選択",
      selectYearly: "年額プランを選択",
      title: "プランを選択",
      description: "あなたに最適なプランを選択してください",
    },
    savings: "年額プランで25%節約",
    bestValue: "最もお得",
    checkout: {
      success: "🎉 プレミアムへようこそ！サブスクリプションが有効になりました。",
      canceled: "チェックアウトがキャンセルされました。いつでも再試行できます。",
    },
    errors: {
      checkoutFailed: "チェックアウトの開始に失敗しました。もう一度お試しください。",
      billingPortalFailed: "請求ポータルを開けませんでした。もう一度お試しください。",
      cancelFailed: "サブスクリプションのキャンセルに失敗しました。もう一度お試しください。",
    },
    upgradePrompt: {
      title: "無限の学習をアンロック！",
      description: "プレミアムにアップグレードして、無制限の練習セッション、高度な分析機能などを利用しましょう。",
    },
  },

  // Entitlements & Limits
  entitlements: {
    limits: {
      sessionsToday: "{{feature}}の今日のセッション",
      sessionsLeft: "残り{{count}}セッション",
      resets: "{{time}}にリセット",
      unlimited: "無制限",
    },
    messages: {
      featureLimitReached: "機能制限に達しました",
      limitReached: "今日の制限に達しました。",
      limitReachedWithTime: "{{feature}}の1日の制限に達しました。{{time}}にリセットされます。",
      upgradeRequired: "この機能にアクセスするにはプランのアップグレードが必要です。",
      featureUnavailable: "この機能は現在利用できません。",
      runningLow: "今日は{{feature}}が残り{{count}}セッションです。",
      checkFailed: "機能アクセスの確認に失敗しました。もう一度お試しください。",
    },
    upgrade: {
      title: "プレミアムにアップグレード",
      message: "プレミアムプランにアップグレードして、全機能をアンロックしましょう。",
      benefits: {
        unlimited: "無制限の練習セッション",
        advancedAnalytics: "高度な分析とインサイト",
        prioritySupport: "優先サポート",
        offlineMode: "オフラインモード",
      },
      cta: {
        viewPricing: "料金を見る",
        learnMore: "詳細を見る",
      },
    },
  },

  // Pricing Page
  pricing: {
    title: "学習の旅を選ぼう",
    subtitle: "無制限の練習で日本語マスターを加速",
    loading: "料金を読み込み中...",
    billing: {
      monthly: "月額",
      yearly: "年額",
      savePercent: "{{percent}}%お得",
    },
    buttons: {
      processing: "処理中...",
      signUpFree: "無料でサインアップ",
      startFreeTrial: "無料トライアルを開始",
      currentPlan: "現在のプラン",
      downgrade: "ダウングレード",
      upgradeNow: "今すぐアップグレード",
    },
    badges: {
      mostPopular: "最も人気",
      currentPlan: "現在のプラン",
    },
    messages: {
      alreadyFree: "すでに無料プランをご利用中です！",
      alreadySubscribed: "すでにこのプランに登録されています！",
    },
    manageBilling: "請求とサブスクリプションの管理",
    trust: {
      activeLearners: "アクティブな学習者",
      successRate: "成功率",
      support: "サポート",
      moneyBack: "返金保証",
    },

    // Leaderboard
    leaderboard: {
      title: "リーダーボード",
      daily: "今日",
      weekly: "今週",
      monthly: "今月",
      allTime: "全期間",
      rank: "ランク",
      player: "プレイヤー",
      achievements: "実績",
      points: "ポイント",
      streak: "連続",
      yourPosition: "あなたの順位"
    },

    // Profile
    profile: {
      title: "プロフィール",
      achievements: {
        title: "実績バッジ",
        totalPoints: "合計ポイント",
        legendary: "レジェンダリー",
        epic: "エピック",
        rare: "レア",
        uncommon: "アンコモン",
        common: "コモン",
        complete: "完了"
      },
      level: {
        title: "レベル進捗",
        level: "レベル",
        xp: "XP",
        totalXP: "合計XP",
        nextLevel: "次のレベル",
        perks: "レベル特典",
        progression: "レベル進行",
        xpMultiplier: "XP倍率"
      }
    },

    faq: {
      title: "よくある質問",
      cancel: {
        question: "いつでもキャンセルできますか？",
        answer: "はい！アカウント設定からいつでもサブスクリプションをキャンセルできます。請求期間の終了までアクセスを継続できます。",
      },
      trial: {
        question: "無料トライアルはありますか？",
        answer: "1日5回の練習セッションが可能な寛大な無料枠を提供しています。これにより、サブスクリプションを開始する前にプラットフォームを体験できます。",
      },
      switch: {
        question: "プランを切り替えることはできますか？",
        answer: "もちろんです！いつでもプランをアップグレードまたはダウングレードできます。変更は次の請求サイクルから有効になります。",
      },
    },
  },

  // Kana Learning System
  kana: {
    kanji: {
      study: {
        skip: "スキップ",
        examples: "例文",
        markAsLearned: "学習済みにする",
        noExamples: "例文がありません"
      }
    }
  },

  // Review System
  review: {
    skip: "スキップ",
    showAnswer: "答えを見る",
    modes: {
      recognition: "認識",
      recall: "想起",
      listening: "リスニング",
      writing: "ライティング",
      speaking: "スピーキング"
    },

    // Kanji-specific
    kanji: {
      writeKanjiFor: "次の意味の漢字を書いてください：",
      strokeCount: "{{count}}画",
      grade: "{{grade}}年生",
      frequency: "頻度 #{{rank}}"
    },

    // Confidence slider (used across all content types)
    confidence: "確信度",
    confidenceHelp: "確信度とは？",
    confidenceLevel: "確信レベル",
    confidenceLow: "推測",
    confidenceMedium: "不確か",
    confidenceHigh: "自信あり",
    confidenceTooltip: {
      title: "どれくらい自信がありますか？",
      description: "答えに対する確信度をスライダーで調整してください：",
      high: "高 (70-100%): よく知っている",
      medium: "中 (30-70%): ある程度確か",
      low: "低 (0-30%): 推測している",
      tip: "これにより、システムがあなたの実際の知識に基づいて復習をより適切にスケジュールできます。"
    }
  },

  // Learn Section
  learn: {
    hiragana: "ひらがな",
    katakana: "カタカナ",
    kanji: "漢字",
    vocabulary: "語彙",
    grid: "グリッド",
    browse: "閲覧",
    study: "学習",
    review: "復習",
    progress: "進捗",
    learned: "習得済み",
    selectCharacters: "学習する文字を選択してください",
    noStrugglingCharacters: "苦手な文字が見つかりません",
    selectionCleared: "選択をクリアしました",
    studySessionComplete: "学習セッション完了！",
  },

  // Review Prompts
  reviewPrompts: {
    vocabulary: {
      // Review engine strings
      writeJapaneseFor: "次の日本語を書いてください：",
      whatWordDoYouHear: "何の単語が聞こえますか？",
      example: "例：",
      common: "一般的",
      pitchAccent: "アクセント：{{accent}}",

      // Vocabulary search page strings
      searchTitle: "単語検索",
      searchDescription: "日本語の単語を意味と例文で検索",
      searchPlaceholder: "漢字、かな、ローマ字、英語の意味で検索...",
      searchButton: "検索",
      searchSource: "検索ソース：",
      searchSourceJMDict: "JMDict（オフライン）",
      searchSourceWaniKani: "WaniKani",
      searchResults: "検索結果",
      searchResultsCount: "検索結果（{{count}}件）",
      searchQuickSearch: "クイック検索：",
      searchHistory: "検索履歴",
      searchHistoryClear: "クリア",
      searchHistoryEmpty: "検索履歴がここに表示されます",
      searchHistoryResults: "{{count}}件の結果",
      searchJustNow: "たった今",
      searchMinutesAgo: "{{minutes}}分前",
      searchHoursAgo: "{{hours}}時間前",
      searchDaysAgo: "{{days}}日前",
      loadingMessage: "単語検索を読み込み中...",
      searching: "検索中...",

      // Tabs
      tabs: {
        details: "詳細",
        conjugations: "活用"
      },

      // Toast messages
      wanikaniUnavailable: "WaniKaniが利用できません。JMdict辞書を使用します。",
      wanikaniSearchFailed: "WaniKani検索が失敗しました。JMdict辞書に切り替えます。",
      wanikaniMockData: "WaniKani APIが正しく設定されていません。JMdictに切り替えるか、有効なWaniKani APIトークンを設定してください。",
      wanikaniInvalidKey: "WaniKani APIキーが無効です。API設定を確認するか、JMdictを使用してください。",
      wanikaniServiceDown: "WaniKaniサービスが一時的に利用できません。後でもう一度試すか、JMdictを使用してください。",
      noResultsFound: "結果が見つかりません。別の検索語をお試しください。",
      searchFailed: "検索に失敗しました。もう一度お試しください。",
      searchHistoryCleared: "検索履歴がクリアされました",
        loadingCache: "WaniKaniの語彙データベースを初めて読み込んでいます... しばらくお待ちください。",

      // Word details modal
      wordMeaning: "意味",
      wordRomaji: "ローマ字",
      wordTags: "タグ",
      wordExampleSentences: "例文",
      wordExampleSentencesComingSoon: "例文は近日公開予定です！",
        noExamplesFound: "この単語の例文が見つかりませんでした",

      // Practice page
      practiceTitle: "活用練習",
      practiceDescription: "日本語の動詞と形容詞の活用をマスター",
      filters: {
        all: "すべて",
        verbs: "動詞のみ",
        adjectives: "形容詞のみ"
      },
      actions: {
        shuffle: "シャッフル",
        loadNew: "新しい単語を読み込む",
        selectForReview: "復習用に選択",
        showConjugations: "活用を表示",
        hideConjugations: "活用を非表示"
      },
      stats: {
        verbs: "動詞",
        adjectives: "形容詞"
      },
      studyMode: {
        title: "活用を学習",
        description: "インタラクティブな例で日本語の動詞と形容詞の活用を学ぶ",
        startStudying: "学習を開始"
      },
      reviewMode: {
        practiceConjugation: "この活用を練習",
        complete: "復習を完了",
        noWords: "復習用の単語が選択されていません"
      }
    },
  },

  // カスタムリスト機能
  favourites: {
    title: "お気に入り",
    description: "保存した単語、漢字、文章",
    filters: {
      all: "すべて",
      words: "単語",
      kanji: "漢字",
      sentences: "文章",
    },
    filterByList: "リストで絞り込み",
    allLists: "すべてのリスト",
    sortBy: "並び替え",
    sort: {
      recent: "最近追加した順",
      alphabetical: "アルファベット順",
      mastery: "習得度順",
    },
    noResultsFound: "アイテムが見つかりません",
    noItemsSaved: "保存されたアイテムはまだありません",
    tryDifferentSearch: "別の検索語を試してください",
    startSaving: "単語、漢字、文章を保存すると、ここに表示されます",
    confirmRemove: "このアイテムをすべてのリストから削除しますか？",
    reviewedTimes: "{count}回復習済み",
    manageLists: "リストを管理",
  },

  lists: {
    title: "マイリスト",
    pageDescription: "カスタム学習リストを作成・管理",
    modal: {
      title: "新しいリストを作成",
      createTitle: "リストを設定",
      saveTitle: "リストに保存",
      selectType: "作成したいリストの種類を選択してください：",
    },
    types: {
      flashcard: {
        name: "フラッシュカードリスト",
        short: "フラッシュカード",
        description: "間隔反復でコンテンツを復習",
        accepts: "対応: 単語、漢字、文章",
      },
      drillable: {
        name: "練習リスト",
        short: "練習",
        description: "動詞と形容詞の活用を練習",
        accepts: "対応: 動詞と形容詞のみ",
      },
      sentence: {
        name: "文章リスト",
        short: "文章",
        description: "文脈で完全な文章を学習",
        accepts: "対応: 文章のみ",
      },
    },
    fields: {
      name: "リスト名",
      description: "説明",
      color: "色",
      icon: "アイコン",
      notes: "個人メモ",
      tags: "タグ",
    },
    placeholders: {
      name: "例: JLPT N5 語彙",
      description: "リストの説明（任意）",
      search: "リストを検索...",
      notes: "メモや記憶法を追加...",
      tags: "コンマ区切りのタグ",
    },
    actions: {
      create: "リストを作成",
      createNew: "新しいリストを作成",
      createFirst: "最初のリストを作成",
      save: "保存",
      saveToList: "リストに保存",
      delete: "削除",
      edit: "リストを編集",
      remove: "リストから削除",
      addItems: "アイテムを追加",
      review: "復習",
      manage: "リストを管理",
    },
    deleteDialog: {
      title: "リストを削除",
      message: "「{{name}}」を削除してもよろしいですか？この操作は元に戻せません。",
      confirm: "削除",
      cancel: "キャンセル",
    },
    labels: {
      itemCount: "{count}件のアイテム",
      alreadySaved: "既に保存済み",
      incompatibleLists: "互換性のないリストタイプ",
      drillable: "活用可能",
      updated: "更新済み",
    },
    quota: {
      remaining: "残り{count}個のリスト",
      guestLimit: "リストを作成するにはサインインしてください",
      freeLimit: "無料ユーザーは最大3個のリストを作成できます",
    },
    success: {
      created: "リストが正常に作成されました",
      updated: "リストが正常に更新されました",
      deleted: "リストが正常に削除されました",
      itemAdded: "{count}個のリストに追加されました",
      itemRemoved: "{count}個のリストから削除されました",
      itemUpdated: "アイテムが正常に更新されました",
    },
    errors: {
      limitReached: "リスト数の上限に達しています。アップグレードしてさらに作成してください。",
      nameRequired: "リスト名を入力してください",
      typeRequired: "リストタイプを選択してください",
      createFailed: "リストの作成に失敗しました",
      loadFailed: "リストの読み込みに失敗しました",
      saveFailed: "アイテムの保存に失敗しました",
      noListSelected: "少なくとも一つのリストを選択してください",
      incompatibleType: "このリストタイプはこのアイテムを受け入れることができません",
    },
    empty: {
      noLists: "まだリストを作成していません",
      noItems: "このリストは空です",
      noResults: "結果が見つかりませんでした",
      getStarted: "学習教材をカスタムリストに整理してみましょう",
      tryDifferentSearch: "別のキーワードで検索してみてください",
    },
    stats: {
      items: "アイテム",
      mastered: "習得済み",
      learning: "学習中",
      total: "合計",
    },
  },

  // YouTube シャドーイング
  youtubeShadowing: {
    title: "YouTube シャドーイング",
    description: "YouTube動画やメディアファイルで日本語を練習",

    hero: {
      title: "あらゆるメディアで日本語をマスター",
      subtitle: "YouTube動画や自分のメディアファイルを、AI搭載の文字起こし付きインタラクティブなシャドーイング練習セッションに変換"
    },

    modes: {
      input: "メディア追加",
      player: "練習"
    },

    input: {
      youtube: "YouTube URL",
      upload: "ファイルアップロード",
      youtubeTitle: "YouTube URLを貼り付け",
      uploadTitle: "メディアファイルをアップロード",
      placeholder: "https://www.youtube.com/watch?v=...",
      supportedFormats: "対応フォーマット：",
      extract: "抽出して開始",
      uploadButton: "ファイルを選択",
      maxSize: "最大ファイルサイズ：",
      acceptedFormats: "対応形式: MP4, MP3, WAV, M4A"
    },

    errors: {
      invalidUrl: "有効なYouTube URLを入力してください",
      emptyUrl: "YouTube URLを入力してください",
      extractFailed: "URLから動画IDを抽出できませんでした",
      uploadFailed: "ファイルのアップロードに失敗しました",
      transcriptFailed: "文字起こしの生成に失敗しました",
      playerFailed: "プレーヤーの読み込みに失敗しました"
    },

    features: {
      transcripts: {
        title: "即座に文字起こし",
        description: "AI搭載の文字起こしを数秒で"
      },
      shadowing: {
        title: "シャドー練習",
        description: "発音とリズムを完璧に"
      },
      furigana: {
        title: "ふりがな対応",
        description: "全レベル向けの読み方サポート"
      }
    },

    player: {
      loading: "プレーヤーを読み込み中...",
      extractingAudio: "音声を抽出中...",
      generatingTranscript: "文字起こしを生成中...",
      ready: "練習準備完了！",

      controls: {
        play: "再生",
        pause: "一時停止",
        previous: "前の行",
        next: "次の行",
        repeat: "リピート",
        speed: "速度",
        volume: "音量",
        settings: "設定",
        furigana: "ふりがな表示",
        grammar: "文法表示"
      },

      settings: {
        playbackSpeed: "再生速度",
        repeatCount: "リピート回数",
        pauseBetween: "間隔",
        continuous: "連続再生",
        autoScroll: "自動スクロール"
      },

      transcript: {
        edit: "編集",
        regenerate: "再生成",
        save: "変更を保存",
        cancel: "編集をキャンセル"
      }
    },

    freeAccess: "無料アクセス",
    loadingTitle: "動画タイトルを読み込み中...",
    by: "作成者",

    usage: {
      today: "今日の使用状況",
      unlimited: "無制限",
      remaining: "残り",
      limitReached: "1日の制限に達しました",
      newVideos: "今日の新しい動画",
      uploads: "アップロード"
    }
  },

  conjugation: {
      title: "活用",
      showConjugations: "活用を表示",
      hideConjugations: "活用を非表示",
      expandAll: "すべて展開",
      collapseAll: "すべて折りたたみ",
      groups: {
        stems: "語幹",
        basicForms: "基本形",
        politeForms: "丁寧形",
        conditionalForms: "条件形",
        volitionalForms: "意志形",
        imperativeForms: "命令形",
        potentialForms: "可能形",
        passiveForms: "受身形",
        causativeForms: "使役形",
        causativePassiveForms: "使役受身形",
        desiderativeForms: "希望形（たい）",
        progressiveForms: "進行形",
        requestForms: "依頼形",
        colloquialForms: "口語形",
        formalForms: "改まった形・古典形",
        presumptiveForms: "推量形",
        plainform: "普通形",
        politeform: "丁寧形",
        taiformwantto: "たい形（願望）",
        "taiform(wantto)": "たい形（願望）",
        imperativeforms: "命令形",
        provisionalform: "仮定形（ば）",
        conditionalform: "条件形（たら）",
        alternativeform: "たり形",
        potentialplainform: "可能形（普通）",
        potentialpoliteform: "可能形（丁寧）",
        passiveplainform: "受身形（普通）",
        passivepoliteform: "受身形（丁寧）",
        causativeplainform: "使役形（普通）",
        causativepoliteform: "使役形（丁寧）",
        causativepassiveplainform: "使役受身形（普通）",
        causativepassivepoliteform: "使役受身形（丁寧）",
        colloquialform: "口語形",
        formalform: "文語形",
        classicalformnu: "古典形（ぬ）",
        "classicalform(nu)": "古典形（ぬ）",
        classicalformzaru: "古典形（ざる）",
        "classicalform(zaru)": "古典形（ざる）",
        // 形容詞専用グループ
        basicforms: "基本形",
        politeforms: "丁寧形",
        conditionalforms: "条件形",
        presumptiveforms: "推量形"
      },
      forms: {
        // 語幹
        masuStem: "ます語幹",
        negativeStem: "否定語幹",
        teForm: "て形",
        negativeTeForm: "否定て形",
        adverbialNegative: "副詞的否定",
        // 基本形
        present: "現在形・辞書形",
        past: "過去形",
        negative: "否定形",
        pastNegative: "過去否定形",
        // 丁寧形
        polite: "丁寧形",
        politePast: "丁寧過去形",
        politeNegative: "丁寧否定形",
        politePastNegative: "丁寧過去否定形",
        politeVolitional: "丁寧意志形",
        // 条件形
        provisional: "仮定形（ば）",
        provisionalNegative: "否定仮定形（ば）",
        conditional: "条件形（たら）",
        conditionalNegative: "否定条件形（たら）",
        // 意志形
        volitional: "意志形",
        volitionalNegative: "否定意志形",
        // 命令形
        imperativePlain: "命令形",
        imperativePolite: "丁寧な依頼",
        imperativeNegative: "禁止形",
        // 可能形
        potential: "可能形",
        potentialNegative: "不可能形",
        potentialPast: "可能過去形",
        potentialPastNegative: "不可能過去形",
        // 受身形
        passive: "受身形",
        passiveNegative: "受身否定形",
        passivePast: "受身過去形",
        passivePastNegative: "受身過去否定形",
        // 使役形
        causative: "使役形",
        causativeNegative: "使役否定形",
        causativePast: "使役過去形",
        causativePastNegative: "使役過去否定形",
        // 使役受身形
        causativePassive: "使役受身形",
        causativePassiveNegative: "使役受身否定形",
        // 希望形
        taiForm: "たい形",
        taiFormNegative: "たくない形",
        taiFormPast: "たかった形",
        taiFormPastNegative: "たくなかった形",
        // 進行形
        progressive: "進行形",
        progressiveNegative: "進行否定形",
        progressivePast: "進行過去形",
        progressivePastNegative: "進行過去否定形",
        // 依頼形
        request: "依頼形",
        requestNegative: "否定依頼形",
        // 口語形
        colloquialNegative: "口語否定形",
        // 改まった形
        formalNegative: "改まった否定形",
        classicalNegative: "古典否定形",
        // 推量形
        presumptive: "推量形",
        presumptiveNegative: "否定推量形"
      },
      wordTypes: {
        ichidan: "一段動詞",
        godan: "五段動詞",
        irregular: "不規則動詞",
        iadjective: "い形容詞",
        naadjective: "な形容詞"
      },
      messages: {
        notConjugatable: "この単語は活用できません",
        lowConfidence: "活用タイプの判定確度が低いです",
        specialCase: "この単語は特別な活用規則があります"
      },
      // 練習ページ
      practiceTitle: "活用練習",
      practiceDescription: "日本語の動詞と形容詞の活用をマスター",
      searchPlaceholder: "動詞や形容詞を検索...",
      searchButton: "検索",
      clearSearch: "クリア",
      searchResults: "検索結果",
      noSearchResults: "活用できる単語が見つかりませんでした",
      filters: {
        all: "すべて",
        verbs: "動詞のみ",
        adjectives: "形容詞のみ"
      },
      actions: {
        shuffle: "シャッフル",
        loadNew: "新しい単語を読み込む",
        selectForReview: "復習用に選択",
        showConjugations: "活用を表示",
        hideConjugations: "活用を非表示"
      },
      settings: "設定",
      stats: {
        verbs: "動詞",
        adjectives: "形容詞"
      },
      studyMode: {
        title: "活用を学習",
        description: "インタラクティブな例で日本語の動詞と形容詞の活用を学ぶ",
        startStudying: "学習を開始"
      },
      reviewMode: {
        practiceConjugation: "この活用を練習",
        complete: "復習を完了",
        noWords: "復習用の単語が選択されていません"
      }
  },
}