# Discord Community Setup Guide - Moshimoshi

## Overview

This guide covers setting up and managing the official Moshimoshi Discord server for our Japanese learning community.

---

## Server Creation

1. Go to [discord.com](https://discord.com) and log in
2. Click the **+** button in the server list
3. Select **"Create My Own"**
4. Choose **"For a club or community"**
5. Name: `Moshimoshi - Japanese Learning`
6. Upload the Moshimoshi logo as server icon

---

## Enable Community Features

**Server Settings → Enable Community**

This unlocks:
- Announcement channels
- Forum channels
- Welcome screen
- Server insights
- Discovery (optional, for public listing)

Required settings:
- Set a rules channel
- Set a community updates channel
- Enable verification level: **Medium** (5 min account age)

---

## Channel Structure

### Category: 📢 INFORMATION
| Channel | Type | Purpose |
|---------|------|---------|
| `#announcements` | Announcement | App updates, new features, events (read-only) |
| `#rules` | Text | Community guidelines (read-only) |
| `#faq` | Text | Common questions about the app (read-only) |
| `#resources` | Text | Useful Japanese learning links (read-only) |

### Category: 🎓 LEARNING
| Channel | Type | Purpose |
|---------|------|---------|
| `#general-japanese` | Text | General language discussion |
| `#beginners-n5-n4` | Text | JLPT N5/N4 level questions |
| `#intermediate-n3` | Text | JLPT N3 level questions |
| `#advanced-n2-n1` | Text | JLPT N2/N1 level questions |
| `#grammar-help` | Forum | Threaded grammar questions |
| `#word-of-the-day` | Text | Daily vocabulary (bot or manual posts) |

### Category: 🗣️ PRACTICE
| Channel | Type | Purpose |
|---------|------|---------|
| `#reading-practice` | Text | Share reading attempts, get corrections |
| `#writing-practice` | Text | Practice writing Japanese |
| `#listening-resources` | Text | Share podcasts, videos, etc. |
| `🔊 Voice Practice` | Voice | Live speaking practice |
| `🔊 Quiet Study Room` | Voice | Co-working/study with others |

### Category: 💬 COMMUNITY
| Channel | Type | Purpose |
|---------|------|---------|
| `#introductions` | Text | New member introductions |
| `#off-topic` | Text | Non-Japanese chat |
| `#wins-and-progress` | Text | Celebrate achievements |
| `#moshimoshi-feedback` | Forum | App feedback and suggestions |

### Category: 🔧 SUPPORT
| Channel | Type | Purpose |
|---------|------|---------|
| `#app-help` | Forum | Technical support for the app |
| `#bug-reports` | Forum | Report app issues |

---

## Roles

### Role Hierarchy (top to bottom)

| Role | Color | Purpose | Permissions |
|------|-------|---------|-------------|
| `@Admin` | Red | Server owners | Full admin |
| `@Moderator` | Orange | Community mods | Manage messages, timeout users |
| `@Native Speaker` | Green | Japanese natives helping | Highlighted in member list |
| `@Subscriber` | Purple | Paid Moshimoshi users | Access to exclusive channels (optional) |
| `@Learner` | Blue | Verified members | Default role after rules acceptance |
| `@everyone` | Gray | Unverified | Limited access |

### Optional: Subscriber-Only Channels

If you want exclusive channels for paying users:

```
Category: ⭐ SUBSCRIBER LOUNGE
├── #subscriber-chat
├── #exclusive-resources
└── 🔊 Subscriber Voice
```

---

## Recommended Bots

### 1. Kotoba (Japanese Learning)
- **Invite**: https://kotobaweb.com/
- **Features**: Japanese quizzes, JLPT practice, dictionary lookups
- **Commands**: `k!quiz n5`, `k!jisho [word]`, `k!strokeorder [kanji]`

### 2. Carl-bot (Moderation & Roles)
- **Invite**: https://carl.gg/
- **Features**: Reaction roles, auto-moderation, welcome messages
- **Use for**: Self-assignable level roles, auto-mod

### 3. MEE6 (Alternative to Carl-bot)
- **Invite**: https://mee6.xyz/
- **Features**: Leveling, moderation, welcome messages

### 4. Disboard (Server Promotion)
- **Invite**: https://disboard.org/
- **Features**: List server on Disboard for discovery
- **Use**: `!d bump` every 2 hours to boost visibility

---

## Welcome Screen Setup

**Server Settings → Welcome Screen**

Configure:
- **Description**: "Welcome to Moshimoshi! Your Japanese learning community."
- **Recommended channels**:
  - `#rules` - "Read our community guidelines"
  - `#introductions` - "Introduce yourself"
  - `#general-japanese` - "Start chatting"
  - `#app-help` - "Get help with the app"

---

## Rules Template

```markdown
# Moshimoshi Community Rules

Welcome to the Moshimoshi Japanese learning community! Please follow these guidelines:

## 1. Be Respectful
Treat everyone with kindness. No harassment, hate speech, or personal attacks.

## 2. Stay On Topic
Use channels for their intended purpose. Keep off-topic chat in #off-topic.

## 3. No Spam
Avoid excessive messages, self-promotion, or unsolicited DMs.

## 4. Help Each Other
We're all learning! Encourage others and share knowledge generously.

## 5. Use English and Japanese
Both languages are welcome. This is a learning space!

## 6. No NSFW Content
Keep everything family-friendly.

## 7. Respect Privacy
Don't share personal information about yourself or others.

## Enforcement
- First offense: Warning
- Second offense: Timeout (1-24 hours)
- Third offense: Ban

Questions? Contact a @Moderator.

頑張りましょう！(Let's do our best!)
```

---

## Integration Ideas with Moshimoshi App

### Subscriber Role Sync (Future)
Automatically grant `@Subscriber` role to paying users:
- Use Discord OAuth2 to link accounts
- Webhook from Stripe → Discord bot → Assign role
- Implementation in `/functions/src/integrations/discord/`

### Announcement Automation
Post to `#announcements` when:
- New features are deployed
- Weekly challenges start
- Maintenance scheduled

```typescript
// Example webhook post
await fetch(DISCORD_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '🎉 New feature: Mnemonics are now available!'
  })
});
```

### Leaderboard Bot (Future)
Weekly post of top learners from the app's review statistics.

---

## Launch Checklist

- [ ] Create server with community features enabled
- [ ] Set up all channels and categories
- [ ] Configure roles and permissions
- [ ] Write and post rules
- [ ] Set up welcome screen
- [ ] Invite and configure Kotoba bot
- [ ] Invite and configure Carl-bot
- [ ] Create invite link (Settings → Invites → Create)
- [ ] Add Discord link to Moshimoshi app/website
- [ ] Announce to existing users via email

---

## Invite Link Settings

Create a permanent invite:
- **Server Settings → Invites → Create Invite**
- Set to **Never Expire**
- Set to **Unlimited Uses**
- Link format: `https://discord.gg/[code]`

Add to:
- App footer/menu
- Website
- Email signatures
- Social media bios

---

## Maintenance Tasks

### Weekly
- Review `#moshimoshi-feedback` for actionable items
- Post in `#word-of-the-day` (or automate)
- Check moderation logs

### Monthly
- Review server insights
- Update FAQ if needed
- Consider community events (quiz nights, study sessions)

---

## Server Insights to Track

Once Community is enabled, monitor:
- **Member growth**: New joins vs. leaves
- **Engagement**: Messages per day, active users
- **Retention**: How many stay after 1 week
- **Popular channels**: Where is activity highest

---

## Support Contacts

- **Discord Support**: https://support.discord.com
- **Bot Issues**: Check respective bot documentation
- **Server Issues**: Contact @Admin in the server

---

*Last Updated: January 2025*
