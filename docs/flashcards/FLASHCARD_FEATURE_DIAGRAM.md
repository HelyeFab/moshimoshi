# Flashcard System - Interactive Feature Diagram

## System Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        FP[Flashcards Page]
        DG[Deck Grid]
        DC[Deck Creator]
        SS[Study Session]
        SD[Stats Dashboard]
        FV[Flashcard Viewer]
    end

    subgraph "Business Logic Layer"
        FM[FlashcardManager]
        FA[FlashcardAdapter]
        RE[Review Engine]
        VM[Validation Manager]
    end

    subgraph "Data Storage Layer"
        IDB[(IndexedDB)]
        SQ[Sync Queue]
        MC[Memory Cache]
    end

    subgraph "API Layer"
        API[API Routes]
        AUTH[Auth Middleware]
        STORE[Storage Helper]
    end

    subgraph "Cloud Layer"
        FB[(Firebase)]
        FS[(Firestore)]
        FST[(Firebase Storage)]
    end

    %% UI Interactions
    FP --> DG
    FP --> DC
    FP --> SS
    FP --> SD
    SS --> FV

    %% Business Logic Flow
    DG --> FM
    DC --> FM
    SS --> RE
    RE --> FA
    FA --> FM
    RE --> VM

    %% Storage Flow
    FM --> IDB
    FM --> SQ
    FM --> MC
    FM --> API

    %% API Flow
    API --> AUTH
    API --> STORE
    API --> FB
    FB --> FS
    FB --> FST

    %% Sync Flow
    SQ --> API
    IDB --> SQ

    style FP fill:#ff6b6b
    style FM fill:#4ecdc4
    style IDB fill:#95e77e
    style FB fill:#ffd93d
```

## User Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI Components
    participant FM as FlashcardManager
    participant IDB as IndexedDB
    participant API as API Route
    participant FB as Firebase

    U->>UI: Create Deck
    UI->>FM: createDeck(request)

    alt Premium User
        FM->>API: POST /api/flashcards/decks
        API->>FB: Save to Firestore
        FB-->>API: Success
        API-->>FM: Deck Created
        FM->>IDB: Cache Locally
    else Free User
        FM->>IDB: Save Locally
    end

    FM-->>UI: Update UI
    UI-->>U: Show Success
```

## Study Session Flow

```mermaid
stateDiagram-v2
    [*] --> DeckSelection
    DeckSelection --> LoadingCards
    LoadingCards --> StudyMode

    StudyMode --> ShowCard
    ShowCard --> WaitingResponse
    WaitingResponse --> CheckAnswer

    CheckAnswer --> Correct: User Correct
    CheckAnswer --> Incorrect: User Wrong

    Correct --> UpdateSRS
    Incorrect --> UpdateSRS

    UpdateSRS --> NextCard: More Cards
    UpdateSRS --> SessionComplete: No More Cards

    NextCard --> ShowCard
    SessionComplete --> ShowSummary
    ShowSummary --> SaveProgress
    SaveProgress --> [*]
```

## Component Interaction Map

```mermaid
graph LR
    subgraph "Page Components"
        A[flashcards/page.tsx]
        A --> B[DeckGrid]
        A --> C[DeckCreator]
        A --> D[StudySession]
        A --> E[StatsDashboard]
    end

    subgraph "Deck Operations"
        B --> F[View Deck]
        B --> G[Edit Deck]
        B --> H[Delete Deck]
        B --> I[Export Deck]
        B --> J[Sync Deck]
    end

    subgraph "Study Components"
        D --> K[FlashcardViewer]
        D --> L[ProgressBar]
        D --> M[SessionSummary]
        K --> N[Card Flip]
        K --> O[Answer Input]
    end

    subgraph "Creation Flow"
        C --> P[Manual Create]
        C --> Q[Import CSV]
        C --> R[Import Anki]
        C --> S[From List]
    end
```

## Data Model Relationships

```mermaid
erDiagram
    USER ||--o{ DECK : owns
    DECK ||--o{ CARD : contains
    DECK ||--|| SETTINGS : has
    DECK ||--|| STATS : tracks
    CARD ||--o| METADATA : has
    CARD ||--o| MEDIA : includes

    USER {
        string uid
        string email
        string tier
        object subscription
    }

    DECK {
        string id
        string userId
        string name
        string emoji
        string color
        timestamp createdAt
        timestamp updatedAt
    }

    CARD {
        string id
        object front
        object back
        object metadata
    }

    SETTINGS {
        string studyDirection
        boolean autoPlay
        string reviewMode
        number sessionLength
    }

    STATS {
        number totalCards
        number masteredCards
        number averageAccuracy
        number currentStreak
    }
```

## Sync Architecture

```mermaid
graph TB
    subgraph "Client Side"
        LC[Local Change]
        SQ2[Sync Queue]
        IDB2[IndexedDB]
        BS[Background Sync]
    end

    subgraph "Network Layer"
        RT[Retry Logic]
        EB[Exponential Backoff]
        CB[Circuit Breaker]
    end

    subgraph "Server Side"
        API2[API Endpoint]
        AUTH2[Auth Check]
        VAL[Validation]
        FB2[Firebase Write]
    end

    LC --> SQ2
    SQ2 --> IDB2
    IDB2 --> BS
    BS --> RT
    RT --> EB
    EB --> CB
    CB --> API2
    API2 --> AUTH2
    AUTH2 --> VAL
    VAL --> FB2

    FB2 -.->|Success| SQ2
    FB2 -.->|Failure| RT
```

## Performance Monitoring Points

```mermaid
graph TD
    subgraph "Frontend Metrics"
        M1[Component Mount Time]
        M2[Deck Load Time]
        M3[Card Flip Animation]
        M4[Session Complete Time]
    end

    subgraph "Storage Metrics"
        M5[IndexedDB Query Time]
        M6[Cache Hit Rate]
        M7[Sync Queue Length]
        M8[Storage Size]
    end

    subgraph "Network Metrics"
        M9[API Response Time]
        M10[Firebase Latency]
        M11[Sync Success Rate]
        M12[Retry Count]
    end

    subgraph "User Metrics"
        M13[Cards Studied/Day]
        M14[Accuracy Rate]
        M15[Session Duration]
        M16[Deck Creation Rate]
    end
```

## Error Flow Handling

```mermaid
flowchart TD
    A[User Action] --> B{Success?}
    B -->|Yes| C[Update UI]
    B -->|No| D[Capture Error]

    D --> E{Error Type}
    E -->|Network| F[Add to Sync Queue]
    E -->|Auth| G[Redirect to Login]
    E -->|Validation| H[Show Error Message]
    E -->|Storage| I[Clear Cache & Retry]

    F --> J[Retry with Backoff]
    J --> K{Retry Success?}
    K -->|Yes| C
    K -->|No| L[Show Offline Mode]

    G --> M[Re-authenticate]
    M --> A

    H --> N[User Corrects Input]
    N --> A

    I --> O{Retry Success?}
    O -->|Yes| C
    O -->|No| P[Fallback to Memory]
```

## State Management Flow

```mermaid
graph TD
    subgraph "Component State"
        CS1[Decks Array]
        CS2[Loading State]
        CS3[Selected Deck]
        CS4[Study Session]
    end

    subgraph "Manager State"
        MS1[IndexedDB Cache]
        MS2[Sync Queue]
        MS3[Listeners Map]
        MS4[Retry Timers]
    end

    subgraph "Global State"
        GS1[User Auth]
        GS2[Subscription]
        GS3[Theme]
        GS4[Locale]
    end

    CS1 --> MS1
    CS3 --> CS4
    MS1 --> MS2
    MS3 --> CS1
    GS1 --> MS2
    GS2 --> CS1
```

---

## Legend

- 🔴 **Red**: User Interface Components
- 🟢 **Green**: Storage Systems
- 🔵 **Blue**: Business Logic
- 🟡 **Yellow**: External Services
- ➡️ **Solid Arrow**: Direct Dependency
- ⚡ **Dashed Arrow**: Async Operation
- 🔄 **Circular**: Retry/Loop Process

---

Last Updated: 2025-01-26
Interactive Version: Can be viewed with any Mermaid renderer