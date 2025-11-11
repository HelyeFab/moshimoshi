# ⚡ Quick Reference Guide

> Instant access to key information from your markdown-brain

## 🎯 Most Important Files

### For Development Work
1. **[DEVELOPMENT_LOG.md](root/DEVELOPMENT_LOG.md)** - What's been done, current state
2. **[MEMO.md](root/MEMO.md)** - Quick notes and TODOs
3. **[ERROR_HANDLING.md](root/ERROR_HANDLING.md)** - How errors are managed

### For Authentication
1. **[Architecture Overview](authentication/01-architecture-overview.md)** - How auth works
2. **[API Reference](authentication/04-api-reference.md)** - Auth endpoints
3. **[Security Guidelines](authentication/05-security-guidelines.md)** - Security best practices

### For UI/Theme Work
1. **[UI_COMPONENTS.md](root/UI_COMPONENTS.md)** - Component library
2. **[THEME_SYSTEM.md](root/THEME_SYSTEM.md)** - Theming guide

## 🔥 Key Information Snippets

### Authentication Endpoints
```
POST /api/auth/signup     - User registration
POST /api/auth/signin     - User login  
POST /api/auth/signout    - User logout
GET  /api/auth/session    - Check session
POST /api/auth/google     - Google OAuth
POST /api/auth/magic-link - Passwordless auth
```

### Theme Palettes Available
- **Sakura** - Cherry blossom pink (default)
- **Ocean** - Calm blues
- **Matcha** - Fresh greens  
- **Sunset** - Warm oranges
- **Lavender** - Elegant purples
- **Monochrome** - Professional grays

### Security Measures Implemented
- ✅ Server-side auth via API routes
- ✅ httpOnly session cookies
- ✅ Rate limiting (signup: 10/15min, signin: 5/15min)
- ✅ Audit logging system
- ✅ Input validation with Zod
- ✅ XSS prevention with DOMPurify
- ✅ Firebase Admin SDK (server-only)

### Project Structure
```
src/
├── app/           # Next.js App Router
├── components/    # UI components
├── lib/          # Firebase, Auth utilities
├── hooks/        # Custom React hooks
├── types/        # TypeScript definitions
├── i18n/         # Internationalization
└── styles/       # Global styles
```

### Development Commands
```bash
npm run dev        # Start development
npm run build      # Build production
npm run lint       # Run ESLint
npm run type-check # TypeScript check
```

### Key Technologies
- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Payments**: Stripe (server-side only)
- **Caching**: Upstash Redis
- **PWA**: Configured for mobile

### Component Categories
- **Core UI**: Toast, Modal, Dialog, Loading, Alert
- **Forms**: Input validation, Error display
- **Theme**: ThemeToggle, LanguageSelector
- **Custom**: DoshiMascot, MoshimoshiLogo

### Error Categories
- **Auth Errors**: Login/signup issues
- **Network Errors**: Connection problems
- **Validation Errors**: Form input issues
- **Permission Errors**: Access denied
- **Payment Errors**: Stripe issues

## 📋 Common Tasks

### Adding a New Document
1. Create markdown file in appropriate folder
2. Use consistent naming (UPPERCASE_WITH_UNDERSCORES.md)
3. Include metadata at top
4. Update this reference if it's frequently accessed

### Finding Information
```
// Search by topic
search: "authentication flows"

// Find recent changes
search_by_date: after "2025-09-08"

// Find related docs
find_similar: "root/THEME_SYSTEM.md"
```

### Document Naming Convention
- **Specs**: `*_SPEC.md`
- **Logs**: `*_LOG.md`
- **Guides**: Numbered format `01-topic-name.md`
- **System docs**: `UPPERCASE_NAME.md`

## 🚨 Important Notes

### Current Status
- ✅ Full authentication system complete
- ✅ UI component library ready
- ✅ Theme system with 6 palettes
- ✅ i18n (English & Japanese)
- 🏗️ Email verification (bypassed)
- 🏗️ Payment integration pending
- 🏗️ Lesson content not yet added

### Known Issues
- Email verification currently bypassed
- Magic links structure only (not functional)
- Stripe not integrated
- No actual lesson content yet

### Security Reminders
- Never commit `.env.local`
- Service accounts in `.keys/` directory
- All auth operations server-side
- Firebase Admin only in API routes

## 🔗 Quick Links

### External Resources
- [Firebase Console](https://console.firebase.google.com/project/moshimoshi-de237)
- Development URL: http://localhost:3000
- Component Showcase: http://localhost:3000/showcase

### Most Recent Updates
Check [DEVELOPMENT_LOG.md](root/DEVELOPMENT_LOG.md) for latest changes

---
*Quick reference for efficient access to markdown-brain knowledge*