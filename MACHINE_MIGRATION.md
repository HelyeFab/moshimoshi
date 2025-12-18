# Moshimoshi Machine Migration Guide

This guide supplements the Claude Code setup instructions at `~/.claude/NEW_MACHINE_SETUP.md`.

## Quick Start

```bash
# Clone the repository
git clone <your-moshimoshi-repo-url> ~/DevProjects/NextJs/moshimoshi
cd ~/DevProjects/NextJs/moshimoshi

# Install dependencies
npm install

# Copy your .env.local file (see below)
# Then start the dev server
npm run dev
```

## Critical Files NOT in Git (Must Transfer Separately)

These files are gitignored for security but are REQUIRED for the app to work:

### 1. Environment Variables - `.env.local`

**Location:** `/home/beano/DevProjects/NextJs/moshimoshi/.env.local`

**Contains:**
- Firebase configuration (API keys, project ID, auth domain, etc.)
- Stripe API keys (publishable and secret)
- Other service API keys and secrets

**How to Transfer:**
1. **Option A (Secure):** Use a password manager or encrypted cloud storage
2. **Option B (Quick):** Copy via USB drive or secure file transfer
3. **Option C (Last Resort):** Email to yourself (NOT recommended for production keys)

**On New Machine:**
```bash
cd ~/DevProjects/NextJs/moshimoshi
# Create the file
touch .env.local
# Paste your env variables
nano .env.local
```

### 2. Firebase Service Account Keys (if you have them locally)

**Pattern:** `*firebase-adminsdk*.json`, `*serviceAccount*.json`, `*service-account*.json`

**Location (if exists):** `.keys/` directory or root of project

**Important:** These are gitignored for security. If you use them locally:
- Transfer securely (encrypted)
- Never commit to git
- On new machine, place in the same relative location

### 3. Database Files with Secrets

**Pattern:** `data/memories.db` (if you have memory-man running locally)

**Transfer if needed:** Copy the entire `data/` directory if it exists and contains important local data.

## Files INCLUDED in Git (Automatically Available)

These are already tracked and will be available after cloning:

✅ **Project Configuration:**
- `CLAUDE.md` - Full project context for Claude Code
- `package.json` - Dependencies and scripts
- `.gitignore` - Security and file exclusion rules
- Project-specific `.claude/` directory with slash commands

✅ **Documentation:**
- All `docs/` directories
- `01_PRODUCTION_DOCS/` (architecture, features, infrastructure)
- `README.md` files throughout the project

✅ **Source Code:**
- All TypeScript/JavaScript files
- React components
- Firebase configuration files (non-sensitive)
- Styles and assets

✅ **Tests:**
- All test files and test configurations

## Claude Code Integration

The Moshimoshi repo has its own `.claude/` directory with project-specific configurations:

```bash
moshimoshi/.claude/
├── commands/
│   ├── moshi-init.md      # Initialize with moshimoshi context
│   ├── moshi-recap.md     # Get project summary
│   └── moshi-recall.md    # Search project memories
├── memoryMan.md           # Memory-man MCP configuration
└── README.md              # Project-specific Claude setup
```

**Important:** This is SEPARATE from your global `~/.claude/` directory:
- **Global** (`~/.claude/`): Cross-project settings, global slash commands
- **Project** (`moshimoshi/.claude/`): Moshimoshi-specific commands and context

## Verification Checklist

After setting up on a new machine:

- [ ] Repository cloned
- [ ] `npm install` completed successfully
- [ ] `.env.local` file created with all variables
- [ ] Service account keys transferred (if applicable)
- [ ] `npm run dev` starts without errors
- [ ] Can access app at `http://localhost:3000`
- [ ] Firebase connection works (check console for errors)
- [ ] Claude Code can read `CLAUDE.md` context
- [ ] Project-specific `/moshi-*` commands work in Claude Code

## Common Issues

### Error: "Firebase not initialized"

**Cause:** Missing or incorrect `.env.local`

**Solution:**
1. Verify `.env.local` exists: `ls -la .env.local`
2. Check all required Firebase variables are set
3. Verify variable names match exactly (check casing)

### Error: "Module not found"

**Cause:** Dependencies not installed

**Solution:**
```bash
# Remove node_modules and lock file
rm -rf node_modules package-lock.json
# Reinstall
npm install
```

### Error: "Permission denied" on scripts

**Cause:** Executable permissions lost during transfer

**Solution:**
```bash
# Make scripts executable
chmod +x scripts/*.sh
chmod +x .claude/commands/*.sh
```

## Environment Variables Template

Here's a template for `.env.local` (fill in your actual values):

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Stripe (if using payment features)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Other Services
# Add any other API keys or secrets your app uses
```

## Security Reminder

**NEVER commit these to git:**
- ❌ `.env.local`
- ❌ `.env`
- ❌ Service account JSON files
- ❌ API keys or secrets
- ❌ Database files with user data

The `.gitignore` is configured to protect these files, but always double-check before pushing!

## Need Help?

- Check the main setup guide: `~/.claude/NEW_MACHINE_SETUP.md`
- Review project context: `CLAUDE.md` in this directory
- Check production docs: `01_PRODUCTION_DOCS/README.md`

---

**Ready to Code!** Once verification passes, you're ready to continue Moshimoshi development on your new machine.
