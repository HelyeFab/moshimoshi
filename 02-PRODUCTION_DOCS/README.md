# Production Documentation

This folder contains production-level documentation for the Moshimoshi Japanese Learning Platform. These documents cover live systems, integrations, and solutions to production issues.

---

## Directory Structure

```
02-PRODUCTION_DOCS/
├── README.md                      # This file
├── authentication/                # Auth flows, OAuth, session management
├── email/                         # Email notifications and delivery systems
├── content-generation/            # AI-generated content, stories, comics
└── community/                     # Discord, social integrations
```

---

## Quick Reference

### Authentication (`authentication/`)

| Document | Description |
|----------|-------------|
| [AUTH_FLOW_DEBUG_GUIDE.md](./authentication/AUTH_FLOW_DEBUG_GUIDE.md) | Complete guide to authentication flows including the Apple Sign-In Safari fix using Apple's native JS SDK |

**Key Topics:**
- Apple Sign-In (Safari ITP workaround)
- Google Sign-In
- Firebase Auth integration
- Session management with JWT/Redis

---

### Email Systems (`email/`)

| Document | Description |
|----------|-------------|
| [EMAIL_NOTIFICATIONS.md](./email/EMAIL_NOTIFICATIONS.md) | Email notification system architecture and templates |
| [EMAIL_SUPPRESSION_SYSTEM.md](./email/EMAIL_SUPPRESSION_SYSTEM.md) | Comprehensive email suppression and bounce handling system |

**Key Topics:**
- Resend email integration
- Notification templates
- Bounce handling
- Suppression lists
- Email preferences

---

### Content Generation (`content-generation/`)

| Document | Description |
|----------|-------------|
| [SCHEDULED_STORY_GENERATION.md](./content-generation/SCHEDULED_STORY_GENERATION.md) | Automated story generation system with scheduling |
| [story-comics.md](./content-generation/story-comics.md) | Comic/manga story feature documentation |

**Key Topics:**
- AI story generation (OpenAI/Anthropic)
- Scheduled content creation
- Story templates and JLPT levels
- Comic panel generation

---

### Community (`community/`)

| Document | Description |
|----------|-------------|
| [DISCORD_COMMUNITY_SETUP.md](./community/DISCORD_COMMUNITY_SETUP.md) | Discord server setup and bot integration guide |

**Key Topics:**
- Discord server structure
- Bot configuration
- Community channels
- Moderation setup

---

## Document Standards

### Status Indicators

Each document should include a status at the top:

- **ACTIVE** - Currently in use, maintained
- **RESOLVED** - Issue documented and fixed
- **DEPRECATED** - No longer in use
- **DRAFT** - Work in progress

### Required Sections

Production documents should include:

1. **Overview/Summary** - What this document covers
2. **Architecture** - System design and flow diagrams
3. **Configuration** - Required settings and environment variables
4. **Troubleshooting** - Common issues and solutions
5. **Related Resources** - Links to external docs and references

---

## Contributing

When adding new production documentation:

1. Place in the appropriate subfolder (or create a new one if needed)
2. Follow the naming convention: `FEATURE_NAME.md` (uppercase with underscores)
3. Include status and date at the top
4. Update this README with the new document

---

*Last Updated: 2026-01-26*
