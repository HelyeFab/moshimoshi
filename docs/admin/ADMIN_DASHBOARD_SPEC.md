# Admin Dashboard Specification

## Overview
The Moshimoshi Admin Dashboard is a secure, single-admin control panel for managing the Japanese learning platform. It uses Firebase Custom Claims for authentication and provides comprehensive management capabilities for users, content, subscriptions, and system monitoring.

## Architecture

### Authentication System
- **Firebase Document Field**: Admin status stored as `isAdmin: true` in user document (NOT `admin: true`)
- **Server-side Verification**: All admin checks performed via Firebase Admin SDK
- **Middleware Protection**: Route-level protection for all `/admin/*` paths
- **Session-based**: Admin sessions managed via httpOnly cookies
- **Field Check**: Always check `userData?.isAdmin === true` (not `admin`)

### Important Note on Admin Field
⚠️ **CRITICAL**: The admin field in Firebase is `isAdmin`, not `admin`. This is used consistently:
- In user documents: `{ isAdmin: true }`
- In API checks: `userData?.isAdmin === true`
- In client checks: `user?.isAdmin === true`

### Security Layers
1. **Route Middleware** (`/src/middleware.ts`)
   - Intercepts all `/admin/*` requests
   - Verifies session exists
   - Checks Firebase user document for `isAdmin: true`
   - Redirects unauthorized users to home

2. **API Protection** (`/api/admin/*`)
   - Double verification of admin status
   - Rate limiting on sensitive operations
   - Audit logging for all admin actions

3. **Component-level Guards**
   - Admin hook for client-side protection
   - Loading states during verification
   - Fallback UI for unauthorized access

## Dashboard Structure

### Main Navigation
```
/admin
├── /dashboard       # Overview & analytics
├── /users          # User management
├── /content        # Lesson & content management
├── /subscriptions  # Payment & subscription monitoring
├── /analytics      # Platform statistics
├── /settings       # System configuration
└── /logs          # Audit logs & system events
```

### 1. Dashboard Overview (`/admin/dashboard`)
**Purpose**: Central hub with key metrics and quick actions

**Features**:
- **Real-time Statistics**
  - Active users (today/week/month)
  - New registrations
  - Revenue metrics
  - Lesson completions
  - Active subscriptions

- **Quick Actions**
  - View recent signups
  - Check failed payments
  - Review reported content
  - System health status

- **Charts & Visualizations**
  - User growth trend
  - Revenue chart
  - Lesson engagement heatmap
  - Geographic distribution

**Components**:
- `StatCard` - Metric display cards
- `RecentActivity` - Live activity feed
- `QuickActions` - Action buttons grid
- `HealthStatus` - System status indicators

### 2. User Management (`/admin/users`)
**Purpose**: Complete user administration

**Features**:
- **User List**
  - Searchable/filterable table
  - Sort by: registration date, last active, subscription
  - Bulk actions support

- **User Actions**
  - View detailed profile
  - Reset password
  - Suspend/unsuspend account
  - Modify subscription
  - Delete user (with confirmation)
  - Export user data

- **User Details Modal**
  - Profile information
  - Learning progress
  - Subscription history
  - Payment history
  - Activity logs
  - Support tickets

**Components**:
- `UserTable` - Paginated user list
- `UserFilters` - Search and filter controls
- `UserDetailsModal` - Comprehensive user view
- `BulkActions` - Multiple user operations

### 3. Content Management (`/admin/content`)
**Purpose**: Manage lessons, exercises, and learning materials

**Features**:
- **Lesson Management**
  - Create/edit/delete lessons
  - Organize by level (Hiragana/Katakana/Kanji)
  - Rich text editor for content
  - Media upload (audio/images)
  - Preview mode

- **Exercise Builder**
  - Multiple question types
  - Answer validation rules
  - Hint system
  - Difficulty settings
  - SRS configuration

- **Content Analytics**
  - Lesson completion rates
  - Common mistakes
  - Time spent per lesson
  - User feedback

**Components**:
- `LessonEditor` - WYSIWYG lesson creator
- `ExerciseBuilder` - Interactive exercise creator
- `ContentTree` - Hierarchical content view
- `MediaLibrary` - Asset management

### 4. Subscription Management (`/admin/subscriptions`)
**Purpose**: Monitor and manage Stripe subscriptions

**Features**:
- **Subscription Overview**
  - Active subscriptions count
  - MRR (Monthly Recurring Revenue)
  - Churn rate
  - Trial conversions

- **Subscription Actions**
  - View Stripe dashboard (external link)
  - Cancel subscription
  - Extend trial
  - Apply discounts
  - Process refunds

- **Payment Issues**
  - Failed payments list
  - Retry payment
  - Contact user
  - Payment method updates

**Components**:
- `SubscriptionMetrics` - Key financial metrics
- `SubscriptionTable` - Active subscriptions list
- `PaymentIssues` - Failed payment handler
- `RefundManager` - Refund processing

### 5. Analytics (`/admin/analytics`)
**Purpose**: Deep platform insights

**Features**:
- **User Analytics**
  - Acquisition channels
  - Retention cohorts
  - User journey mapping
  - Engagement metrics

- **Learning Analytics**
  - Progress tracking
  - Completion rates
  - Time to proficiency
  - Popular content

- **Business Metrics**
  - Revenue trends
  - Customer lifetime value
  - Conversion funnels
  - Churn analysis

**Components**:
- `AnalyticsDashboard` - Customizable charts
- `DateRangePicker` - Time period selector
- `ExportTools` - Data export utilities
- `ReportBuilder` - Custom report generator

### 6. Settings (`/admin/settings`)
**Purpose**: System configuration

**Features**:
- **Platform Settings**
  - Site configuration
  - Feature flags
  - Maintenance mode
  - Email templates

- **Integration Settings**
  - Stripe configuration
  - Firebase settings
  - Redis cache management
  - Third-party APIs

- **Admin Profile**
  - Change admin email
  - Security settings
  - Two-factor authentication
  - Session management

**Components**:
- `SettingsForm` - Configuration forms
- `FeatureFlags` - Feature toggle switches
- `IntegrationStatus` - Service health checks
- `SecuritySettings` - Auth configuration

### 7. Audit Logs (`/admin/logs`)
**Purpose**: Track all admin actions

**Features**:
- **Log Viewer**
  - Chronological event list
  - Filter by action type
  - Search by user/admin
  - Export logs

- **Log Types**
  - User modifications
  - Content changes
  - Subscription updates
  - System configuration
  - Security events

**Components**:
- `LogViewer` - Paginated log display
- `LogFilters` - Advanced filtering
- `LogExport` - Export functionality
- `LogDetails` - Detailed event view

## Technical Implementation

### API Routes Structure
```
/api/admin/
├── /auth
│   ├── verify    # Verify admin status
│   └── init      # Initialize admin claim
├── /users
│   ├── list      # GET paginated users
│   ├── [uid]     # GET/PUT/DELETE user
│   └── bulk      # POST bulk operations
├── /content
│   ├── lessons   # CRUD lessons
│   ├── exercises # CRUD exercises
│   └── media     # Upload media
├── /subscriptions
│   ├── list      # GET subscriptions
│   ├── metrics   # GET financial metrics
│   └── actions   # POST subscription actions
├── /analytics
│   ├── users     # GET user analytics
│   ├── content   # GET content analytics
│   └── revenue   # GET revenue analytics
├── /settings
│   ├── config    # GET/PUT platform config
│   └── flags     # GET/PUT feature flags
└── /logs
    ├── list      # GET audit logs
    └── export    # GET log export
```

### State Management
- **React Query**: For data fetching and caching
- **Zustand**: For global admin state
- **Optimistic Updates**: For better UX
- **Real-time Updates**: Via Firestore listeners for critical data

### UI Components Library
- **Shadcn/ui**: For consistent design system
- **Recharts**: For data visualization
- **React Table**: For data tables
- **React Hook Form**: For form management
- **Zod**: For validation

### Performance Optimizations
- **Code Splitting**: Lazy load admin routes
- **Data Pagination**: Server-side pagination
- **Caching Strategy**: Redis for frequently accessed data
- **Debounced Search**: Reduce API calls
- **Virtual Scrolling**: For large lists

## Admin Workflow

### Initial Setup
1. Set `ADMIN_UID` in `.env.local`
2. Deploy and sign in with admin account
3. System automatically detects and applies admin claim
4. Access dashboard at `/admin`

### Daily Operations
1. **Morning Check**
   - Review overnight signups
   - Check payment failures
   - Review system health

2. **Content Management**
   - Update lessons based on feedback
   - Add new content
   - Review user-reported issues

3. **User Support**
   - Handle account issues
   - Process refund requests
   - Review suspended accounts

4. **Evening Review**
   - Check daily metrics
   - Export reports
   - Plan next day's content

## Monitoring & Alerts

### Key Metrics to Monitor
- Failed payment rate > 5%
- Churn rate > 10%
- Server errors > 1%
- Response time > 2s
- Daily active users drop > 20%

### Alert Channels
- Email notifications for critical events
- Dashboard notifications for warnings
- Audit log for all actions

## Security Best Practices

1. **Never expose admin UID** in client code
2. **All admin checks** must be server-side
3. **Log every admin action** with timestamp and details
4. **Rate limit** admin API endpoints
5. **Implement 2FA** for admin account (future)
6. **Regular security audits** of admin actions
7. **Principle of least privilege** - admin can't modify their own permissions

## Future Enhancements

### Phase 2
- [ ] Multiple admin roles (super admin, content admin, support admin)
- [ ] Two-factor authentication
- [ ] IP whitelisting
- [ ] Advanced analytics with AI insights
- [ ] Automated reports via email

### Phase 3
- [ ] Mobile admin app
- [ ] Slack/Discord integration
- [ ] Automated content moderation
- [ ] A/B testing framework
- [ ] Advanced user segmentation

## Error Handling

### User-Facing Errors
- Clear error messages
- Suggested actions
- Support contact option

### System Errors
- Automatic error reporting
- Fallback UI states
- Retry mechanisms
- Graceful degradation

## Testing Strategy

### Unit Tests
- Admin authentication logic
- Permission checks
- Data transformations

### Integration Tests
- API route protection
- Database operations
- Third-party integrations

### E2E Tests
- Complete admin workflows
- Critical path testing
- Error scenarios

## Deployment Considerations

### Environment Variables
```bash
ADMIN_UID=xxx              # Your Firebase UID
ADMIN_EMAIL=xxx            # Admin email for notifications
ADMIN_WEBHOOK_URL=xxx      # Optional: Slack/Discord webhook
ENABLE_ADMIN_LOGS=true     # Enable detailed logging
ADMIN_SESSION_DURATION=8h  # Admin session timeout
```

### Performance Requirements
- Dashboard load < 2s
- API response < 500ms
- Real-time updates < 100ms
- Search results < 300ms

### Backup & Recovery
- Daily database backups
- Audit log retention (90 days)
- User data export capability
- Disaster recovery plan

---

## Implementation Priority

1. **Phase 1 (Current)**: Core admin functionality
   - Authentication & middleware
   - User management
   - Basic analytics
   - Audit logging

2. **Phase 2**: Enhanced features
   - Content management
   - Subscription management
   - Advanced analytics

3. **Phase 3**: Optimization
   - Performance improvements
   - Additional integrations
   - Mobile support

---

*This specification serves as the blueprint for the Moshimoshi admin dashboard implementation. It prioritizes security, usability, and scalability while maintaining a single-admin architecture.*