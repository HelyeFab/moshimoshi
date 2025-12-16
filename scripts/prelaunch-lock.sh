#!/bin/bash

# Prelaunch Lock Manager for Moshimoshi
# Manages PRELAUNCH_LOCK_ENABLED and NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED
# across Vercel environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Set lock status for an environment
set_lock() {
    local env=$1
    local value=$2
    local skip_deploy=${3:-false}
    local display_status="LOCKED"
    [[ "$value" == "false" ]] && display_status="UNLOCKED"

    print_status "Setting $env to $display_status ($value)..."

    # Remove existing values (suppress errors if they don't exist)
    vercel env rm PRELAUNCH_LOCK_ENABLED "$env" -y 2>/dev/null || true
    vercel env rm NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED "$env" -y 2>/dev/null || true

    # Add new values (use printf to avoid trailing newline issues)
    printf '%s' "$value" | vercel env add PRELAUNCH_LOCK_ENABLED "$env"
    printf '%s' "$value" | vercel env add NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED "$env"

    print_success "$env is now $display_status"

    # Auto-prompt for production deployment
    if [[ "$env" == "production" && "$skip_deploy" != "true" ]]; then
        echo ""
        print_warning "Production env vars updated. A new deployment is required for changes to take effect."
        read -p "Deploy to production now? (Y/n): " confirm
        if [[ ! "$confirm" =~ ^[Nn]$ ]]; then
            trigger_deploy
        else
            print_status "Skipped deployment. Run 'vercel --prod' when ready."
        fi
    fi
}

# Get current lock status for an environment
get_status() {
    local env=$1
    local status=$(vercel env ls 2>&1 | grep "PRELAUNCH_LOCK_ENABLED" | grep -i "$env" | head -1)
    if [[ -n "$status" ]]; then
        echo "  $env: Configured (encrypted)"
    else
        echo "  $env: Not set"
    fi
}

# Show current status
show_status() {
    print_status "Fetching current prelaunch lock status..."
    echo ""
    echo "PRELAUNCH_LOCK_ENABLED status:"
    get_status "Production"
    get_status "Preview"
    get_status "Development"
    echo ""
    print_warning "Values are encrypted. Check Vercel dashboard for actual values."
    echo ""
}

# Show menu
show_menu() {
    echo ""
    echo "========================================"
    echo "   Moshimoshi Prelaunch Lock Manager"
    echo "========================================"
    echo ""
    echo "Quick Actions:"
    echo "  1) Unlock Production (set to false)"
    echo "  2) Lock Production (set to true)"
    echo "  3) Unlock Development (set to false)"
    echo "  4) Lock Development (set to true)"
    echo "  5) Unlock Preview (set to false)"
    echo "  6) Lock Preview (set to true)"
    echo ""
    echo "Combo Actions:"
    echo "  7) Production: LOCKED, Dev & Preview: UNLOCKED (recommended for pre-launch)"
    echo "  8) All Environments: UNLOCKED (post-launch)"
    echo "  9) All Environments: LOCKED (emergency lockdown)"
    echo ""
    echo "Other:"
    echo "  s) Show current status"
    echo "  d) Deploy after changes"
    echo "  q) Quit"
    echo ""
}

# Trigger deployment
trigger_deploy() {
    print_status "Triggering new production deployment..."
    vercel --prod --archive=tgz
    print_success "Deployment triggered!"
}

# Prompt for production deployment (used by combo actions)
prompt_production_deploy() {
    echo ""
    print_warning "Production env vars updated. A new deployment is required for changes to take effect."
    read -p "Deploy to production now? (Y/n): " confirm
    if [[ ! "$confirm" =~ ^[Nn]$ ]]; then
        trigger_deploy
    else
        print_status "Skipped deployment. Run 'vercel --prod' when ready."
    fi
}

# Main loop
main() {
    # Check if vercel CLI is available
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI not found. Install with: npm i -g vercel"
        exit 1
    fi

    # Check for --no-deploy flag anywhere in args
    NO_DEPLOY=false
    for arg in "$@"; do
        if [[ "$arg" == "--no-deploy" ]]; then
            NO_DEPLOY=true
        fi
    done

    # Helper to maybe prompt for deploy
    maybe_deploy() {
        if [[ "$NO_DEPLOY" == "false" ]]; then
            prompt_production_deploy
        else
            print_status "Skipped deployment (--no-deploy). Run 'vercel --prod' when ready."
        fi
    }

    # Handle command line arguments for non-interactive use
    case "${1:-}" in
        --unlock-prod)
            set_lock "production" "false" "true"
            maybe_deploy
            exit 0
            ;;
        --lock-prod)
            set_lock "production" "true" "true"
            maybe_deploy
            exit 0
            ;;
        --unlock-dev)
            set_lock "development" "false"
            exit 0
            ;;
        --lock-dev)
            set_lock "development" "true"
            exit 0
            ;;
        --unlock-all)
            set_lock "production" "false" "true"
            set_lock "preview" "false"
            set_lock "development" "false"
            print_success "All environments unlocked!"
            maybe_deploy
            exit 0
            ;;
        --lock-all)
            set_lock "production" "true" "true"
            set_lock "preview" "true"
            set_lock "development" "true"
            print_success "All environments locked!"
            maybe_deploy
            exit 0
            ;;
        --status)
            show_status
            exit 0
            ;;
        --deploy)
            trigger_deploy
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [option] [--no-deploy]"
            echo ""
            echo "Options:"
            echo "  --unlock-prod   Unlock production (prompts to deploy)"
            echo "  --lock-prod     Lock production (prompts to deploy)"
            echo "  --unlock-dev    Unlock development"
            echo "  --lock-dev      Lock development"
            echo "  --unlock-all    Unlock all environments (prompts to deploy)"
            echo "  --lock-all      Lock all environments (prompts to deploy)"
            echo "  --status        Show current status"
            echo "  --deploy        Deploy to production"
            echo "  --no-deploy     Skip deployment prompt (use with other options)"
            echo "  --help, -h      Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --unlock-prod              # Unlock prod, prompt to deploy"
            echo "  $0 --unlock-prod --no-deploy  # Unlock prod, skip deploy prompt"
            echo "  $0                            # Interactive mode"
            exit 0
            ;;
    esac

    # Interactive mode
    while true; do
        show_menu
        read -p "Select option: " choice
        echo ""

        case $choice in
            1)
                set_lock "production" "false"
                ;;
            2)
                set_lock "production" "true"
                ;;
            3)
                set_lock "development" "false"
                ;;
            4)
                set_lock "development" "true"
                ;;
            5)
                set_lock "preview" "false"
                ;;
            6)
                set_lock "preview" "true"
                ;;
            7)
                print_status "Setting up pre-launch configuration..."
                set_lock "production" "true" "true"  # skip auto-deploy prompt
                set_lock "preview" "false"
                set_lock "development" "false"
                print_success "Pre-launch config applied!"
                prompt_production_deploy
                ;;
            8)
                print_status "Unlocking all environments..."
                set_lock "production" "false" "true"  # skip auto-deploy prompt
                set_lock "preview" "false"
                set_lock "development" "false"
                print_success "All environments unlocked!"
                prompt_production_deploy
                ;;
            9)
                print_warning "This will lock ALL environments!"
                read -p "Are you sure? (y/N): " confirm
                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    set_lock "production" "true" "true"  # skip auto-deploy prompt
                    set_lock "preview" "true"
                    set_lock "development" "true"
                    print_success "All environments locked!"
                    prompt_production_deploy
                else
                    print_status "Cancelled."
                fi
                ;;
            s|S)
                show_status
                ;;
            d|D)
                read -p "Deploy to production? (y/N): " confirm
                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    trigger_deploy
                fi
                ;;
            q|Q)
                print_status "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

main "$@"
