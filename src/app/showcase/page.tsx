'use client';

import { useState } from 'react';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { useErrorToast } from '@/hooks/useErrorToast';
import Modal from '@/components/ui/Modal';
import Dialog from '@/components/ui/Dialog';
import Drawer from '@/components/ui/Drawer';
import Alert, { BannerAlert, AlertStack } from '@/components/ui/Alert';
import Tooltip from '@/components/ui/Tooltip';
import DoshiMascot from '@/components/ui/DoshiMascot';
import MoshimoshiLogo, { MoshimoshiLogoHero } from '@/components/ui/MoshimoshiLogo';
import { 
  LoadingSpinner, 
  LoadingDots, 
  LoadingSkeleton,
  LoadingPage,
  LoadingOverlay,
  LoadingButton 
} from '@/components/ui/Loading';
import ThemeToggle from '@/components/ui/ThemeToggle';
import PageContainer from '@/components/ui/PageContainer';
import Section, { SectionGrid } from '@/components/ui/Section';
import StatCard, { StatCardGrid } from '@/components/ui/StatCard';
import PageHeader, { Breadcrumb } from '@/components/ui/PageHeader';
import SettingToggle, { SettingToggleGroup } from '@/components/ui/SettingToggle';
import { Tabs } from '@/components/ui/Tabs';
import { Accordion, Collapse } from '@/components/ui/Accordion';
import { ProgressBar, CircularProgress } from '@/components/ui/ProgressBar';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { PremiumBadge } from '@/components/common/PremiumBadge';
import { Pagination, PaginationInfo } from '@/components/ui/Pagination';
import { Input, Textarea, Checkbox, Radio } from '@/components/ui/Input';
import { Select, MultiSelect } from '@/components/ui/Select';
import { Card, HorizontalCard, CardSkeleton } from '@/components/ui/FeatureCard';

function ShowcaseContent() {
  const { showToast } = useToast();
  const { showError } = useErrorToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPosition, setDrawerPosition] = useState<'left' | 'right' | 'top' | 'bottom'>('bottom');
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(true);
  const [bannerVisible, setBannerVisible] = useState(true);
  
  // States for new components demo
  const [settingEnabled1, setSettingEnabled1] = useState(true);
  const [settingEnabled2, setSettingEnabled2] = useState(false);
  const [settingEnabled3, setSettingEnabled3] = useState(true);
  const [gradientType, setGradientType] = useState<'default' | 'sakura' | 'mizu' | 'matcha'>('default');
  
  // States for new UI components demo
  const [activeTab, setActiveTab] = useState('overview');
  const [accordionOpen, setAccordionOpen] = useState<string[]>(['item1']);
  const [collapseOpen, setCollapseOpen] = useState(true);
  const [progressValue, setProgressValue] = useState(65);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [selectValue, setSelectValue] = useState('');
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([]);

  const handleButtonClick = () => {
    setButtonLoading(true);
    setTimeout(() => {
      setButtonLoading(false);
      showToast('Action completed!', 'success');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Banner Alert */}
      {bannerVisible && (
        <BannerAlert
          type="info"
          message="Welcome to the component showcase! Try switching themes with the toggle in the header."
          dismissible={true}
          onDismiss={() => setBannerVisible(false)}
          fixed={true}
          position="top"
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DoshiMascot size="small" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Component Showcase</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Moshimoshi Logo Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Moshimoshi Logo with Doshi</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-8">
            <div className="text-center space-y-6">
              <MoshimoshiLogoHero animated={true} />
              <p className="text-sm text-gray-600 dark:text-gray-400">Hero version with animated Doshi</p>
            </div>
            <div className="flex flex-wrap gap-6 items-end justify-center">
              <div className="text-center">
                <MoshimoshiLogo size="small" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Small</p>
              </div>
              <div className="text-center">
                <MoshimoshiLogo size="medium" animated={true} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Medium Animated</p>
              </div>
              <div className="text-center">
                <MoshimoshiLogo size="large" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Large</p>
              </div>
            </div>
            <div className="text-center">
              <MoshimoshiLogo size="medium" variant="stacked" animated={true} />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Stacked Variant</p>
            </div>
          </div>
        </section>

        {/* Doshi Mascot Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Doshi Mascot</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="text-center">
                <DoshiMascot size="xsmall" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">xsmall</p>
              </div>
              <div className="text-center">
                <DoshiMascot size="small" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">small</p>
              </div>
              <div className="text-center">
                <DoshiMascot size="medium" variant="animated" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">medium - animated</p>
              </div>
              <div className="text-center">
                <DoshiMascot size="large" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">large</p>
              </div>
              <div className="text-center">
                <DoshiMascot size="medium" onClick={() => showToast('Doshi says hi! 👋', 'success')} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">clickable</p>
              </div>
            </div>
          </div>
        </section>

        {/* Toast Notifications */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Toast Notifications</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => showToast('Success message!', 'success')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Success Toast
              </button>
              <button 
                onClick={() => showToast('Error occurred!', 'error')}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Error Toast
              </button>
              <button 
                onClick={() => {
                  // Simulate Firebase popup closed error
                  showError(new Error('Firebase: Error (auth/popup-closed-by-user).'))
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Firebase Error (User-Friendly)
              </button>
              <button 
                onClick={() => {
                  // Simulate validation error
                  showError('Invalid input data')
                }}
                className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                Validation Error (User-Friendly)
              </button>
              <button 
                onClick={() => showToast('Warning message', 'warning')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                Warning Toast
              </button>
              <button 
                onClick={() => showToast('Info message', 'info', 5000, {
                  label: 'Undo',
                  onClick: () => console.log('Undo clicked')
                })}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Info Toast with Action
              </button>
            </div>
          </div>
        </section>

        {/* Modals and Dialogs */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Modals & Dialogs</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Open Modal
              </button>
              <button 
                onClick={() => setDialogOpen(true)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Open Dialog
              </button>
            </div>
          </div>
        </section>

        {/* Drawer */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Drawer (Mobile-Optimized)</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['bottom', 'top', 'left', 'right'] as const).map((position) => (
                  <button
                    key={position}
                    onClick={() => {
                      setDrawerPosition(position);
                      setDrawerOpen(true);
                    }}
                    className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors capitalize"
                  >
                    {position} Drawer
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                On mobile: Try swiping to close the drawer!
              </p>
            </div>
          </div>
        </section>

        {/* Loading States */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Loading Components</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <LoadingSpinner size="small" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Small Spinner</p>
              </div>
              <div className="text-center">
                <LoadingSpinner size="medium" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Medium Spinner</p>
              </div>
              <div className="text-center">
                <LoadingSpinner size="large" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Large Spinner</p>
              </div>
              <div className="text-center">
                <LoadingDots size="medium" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Loading Dots</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Skeleton Loader:</p>
              <LoadingSkeleton lines={3} showAvatar={true} />
            </div>

            <div className="flex gap-2">
              <LoadingButton
                isLoading={buttonLoading}
                onClick={handleButtonClick}
                loadingText="Processing..."
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Click Me
              </LoadingButton>
              <button
                onClick={() => {
                  setLoadingOverlay(true);
                  setTimeout(() => setLoadingOverlay(false), 2000);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Show Loading Overlay
              </button>
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Alerts</h2>
          
          {/* Demonstrate improved contrast with overlapping backgrounds */}
          <div className="mb-6 p-6 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Alerts now have improved contrast with backdrop blur and shadows for better readability on complex backgrounds:
            </p>
            <AlertStack spacing="normal">
              <Alert
                type="info"
                title="Information"
                message="This is an informational alert with Doshi!"
                showDoshi={true}
                dismissible={true}
              />
              <Alert
                type="success"
                title="Success!"
                message="Your operation completed successfully."
                showIcon={true}
                dismissible={true}
              />
              <Alert
                type="warning"
                title="Warning"
                message="Please review this important information."
                showIcon={true}
                action={{
                  label: 'Learn More',
                  onClick: () => showToast('Learn more clicked!', 'info')
                }}
              />
              <Alert
                type="error"
                title="Error"
                message="Something went wrong. Please try again."
                showDoshi={true}
                dismissible={true}
              />
            </AlertStack>
          </div>
          
          {/* Demonstrate different spacing options */}
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Tight Spacing:</h3>
            <AlertStack spacing="tight">
              <Alert type="info" message="First alert with tight spacing" />
              <Alert type="success" message="Second alert with tight spacing" />
            </AlertStack>
          </div>
        </section>

        {/* Tooltips */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tooltips</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="flex flex-wrap gap-4">
              <Tooltip content="Top tooltip" position="top">
                <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  Hover (Top)
                </button>
              </Tooltip>
              <Tooltip content="Bottom tooltip" position="bottom">
                <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  Hover (Bottom)
                </button>
              </Tooltip>
              <Tooltip content="Left tooltip" position="left">
                <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  Hover (Left)
                </button>
              </Tooltip>
              <Tooltip content="Right tooltip" position="right">
                <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  Hover (Right)
                </button>
              </Tooltip>
              <Tooltip 
                content={
                  <div>
                    <strong>Rich Content</strong>
                    <p>Tooltips can contain any React content!</p>
                  </div>
                }
                position="top"
              >
                <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                  Rich Tooltip
                </button>
              </Tooltip>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              On mobile: Tap buttons to show tooltips
            </p>
          </div>
        </section>

        {/* Page Header Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Page Header</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <PageHeader
              title="Dashboard Overview"
              description="Monitor your learning progress and achievements"
              showDoshi={true}
              doshiMood="happy"
              breadcrumb={
                <Breadcrumb items={[
                  { label: 'Home', href: '#' },
                  { label: 'Dashboard', href: '#' },
                  { label: 'Overview' }
                ]} />
              }
              actions={
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                    Export
                  </button>
                  <button className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                    New Report
                  </button>
                </div>
              }
            />
            
            <PageHeader
              title="Simple Header"
              description="Without breadcrumb or actions"
              showDoshi={false}
            />
          </div>
        </section>

        {/* Section Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Section Variants</h2>
          <div className="space-y-4">
            <SectionGrid columns={2} gap="medium">
              <Section 
                title="Glass Variant" 
                description="With backdrop blur effect"
                variant="glass"
                icon={<span>✨</span>}
              >
                <p className="text-gray-600 dark:text-gray-400">
                  This is a glass-styled section with a semi-transparent background and backdrop blur.
                </p>
              </Section>
              
              <Section 
                title="Solid Variant" 
                variant="solid"
              >
                <p className="text-gray-600 dark:text-gray-400">
                  This is a solid section with opaque background.
                </p>
              </Section>
              
              <Section 
                title="Bordered Variant" 
                variant="bordered"
              >
                <p className="text-gray-600 dark:text-gray-400">
                  This section has a visible border.
                </p>
              </Section>
              
              <Section 
                title="Default Variant" 
                variant="default"
              >
                <p className="text-gray-600 dark:text-gray-400">
                  This is the default section style.
                </p>
              </Section>
            </SectionGrid>
          </div>
        </section>

        {/* Stat Cards */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Stat Cards</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <StatCardGrid columns={4}>
              <StatCard
                label="Total Users"
                value={12543}
                icon="👥"
                change={{ value: 12.5, label: "vs last week" }}
                tooltip="Active users in the last 30 days"
              />
              <StatCard
                label="Revenue"
                value="$45.2k"
                icon="💰"
                gradient="from-green-400 to-blue-500"
                change={{ value: 8.3 }}
              />
              <StatCard
                label="Success Rate"
                value="98.5%"
                icon="✅"
                color="green"
              />
              <StatCard
                label="Errors"
                value={23}
                icon="🚫"
                color="red"
                change={{ value: -15.2, label: "improving" }}
              />
            </StatCardGrid>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="Small Card"
                value="123"
                size="small"
                icon="📊"
              />
              <StatCard
                label="Medium Card"
                value="456"
                size="medium"
                icon="📈"
                color="primary"
              />
              <StatCard
                label="Large Card"
                value="789"
                size="large"
                icon="📉"
                gradient="from-purple-400 to-pink-500"
              />
            </div>
            
            <StatCard
              label="Clickable Card"
              value="Click me!"
              icon="👆"
              onClick={() => showToast('Card clicked!', 'info')}
              className="hover:scale-105 transition-transform"
            />
          </div>
        </section>

        {/* Setting Toggles */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Setting Toggles</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <SettingToggleGroup title="Notification Settings">
              <SettingToggle
                label="Email Notifications"
                description="Receive important updates via email"
                enabled={settingEnabled1}
                onChange={setSettingEnabled1}
                icon="📧"
              />
              <SettingToggle
                label="Push Notifications"
                description="Get instant alerts on your device"
                enabled={settingEnabled2}
                onChange={setSettingEnabled2}
                icon="🔔"
                tooltip="Requires browser permission"
              />
              <SettingToggle
                label="Marketing Emails"
                description="Receive promotional content and offers"
                enabled={settingEnabled3}
                onChange={setSettingEnabled3}
                icon="📢"
                disabled={!settingEnabled1}
                tooltip={!settingEnabled1 ? "Enable email notifications first" : undefined}
              />
            </SettingToggleGroup>
          </div>
        </section>

        {/* Tabs Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tabs</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <Tabs
              tabs={[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'details', label: 'Details', icon: '📝' },
                { id: 'settings', label: 'Settings', icon: '⚙️', disabled: false },
                { id: 'disabled', label: 'Disabled', disabled: true }
              ]}
              defaultTab={activeTab}
              onChange={setActiveTab}
              variant="default"
            >
              <div className="p-4">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="font-semibold mb-2">Overview Content</h3>
                    <p className="text-gray-600 dark:text-gray-400">This is the overview tab content. Tabs help organize content into separate sections.</p>
                  </div>
                )}
                {activeTab === 'details' && (
                  <div>
                    <h3 className="font-semibold mb-2">Details Content</h3>
                    <p className="text-gray-600 dark:text-gray-400">Here are the detailed information. You can switch between tabs to see different content.</p>
                  </div>
                )}
                {activeTab === 'settings' && (
                  <div>
                    <h3 className="font-semibold mb-2">Settings Content</h3>
                    <p className="text-gray-600 dark:text-gray-400">Configure your preferences here. This tab can contain forms and other interactive elements.</p>
                  </div>
                )}
              </div>
            </Tabs>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pills Variant:</p>
              <Tabs
                tabs={[
                  { id: 'tab1', label: 'Tab 1' },
                  { id: 'tab2', label: 'Tab 2' },
                  { id: 'tab3', label: 'Tab 3' }
                ]}
                variant="pills"
              >
                <div className="p-4">Pills content</div>
              </Tabs>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Underline Variant:</p>
              <Tabs
                tabs={[
                  { id: 'home', label: 'Home' },
                  { id: 'profile', label: 'Profile' },
                  { id: 'messages', label: 'Messages' }
                ]}
                variant="underline"
              >
                <div className="p-4">Underline content</div>
              </Tabs>
            </div>
          </div>
        </section>

        {/* Accordion Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Accordion & Collapse</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Accordion (Multiple):</p>
              <Accordion
                items={[
                  {
                    id: 'item1',
                    title: 'What is React?',
                    content: 'React is a JavaScript library for building user interfaces. It allows you to create reusable UI components.',
                    icon: '⚛️'
                  },
                  {
                    id: 'item2',
                    title: 'How does Next.js work?',
                    content: 'Next.js is a React framework that provides features like server-side rendering, routing, and API routes out of the box.'
                  },
                  {
                    id: 'item3',
                    title: 'What is Tailwind CSS?',
                    content: 'Tailwind CSS is a utility-first CSS framework that provides low-level utility classes to build custom designs.',
                    icon: '🎨'
                  }
                ]}
                allowMultiple={true}
                defaultOpen={['item1']}
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Single Collapse:</p>
              <div>
                <button
                  onClick={() => setCollapseOpen(!collapseOpen)}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span>📦</span>
                  <span>Click to toggle</span>
                </button>
                <Collapse isOpen={collapseOpen}>
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded mt-2">
                    <p className="text-gray-600 dark:text-gray-400">
                      This is a single collapsible section. It can be controlled programmatically or used as a standalone component.
                    </p>
                  </div>
                </Collapse>
              </div>
            </div>
          </div>
        </section>

        {/* Progress Bar Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Progress Indicators</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Default Progress</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{progressValue}%</span>
                </div>
                <ProgressBar value={progressValue} />
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Striped & Animated:</p>
                <ProgressBar value={75} color="green" striped={true} animated={true} showValue={true} />
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Different Colors:</p>
                <div className="space-y-2">
                  <ProgressBar value={30} color="red" size="sm" />
                  <ProgressBar value={50} color="yellow" size="md" />
                  <ProgressBar value={80} color="blue" size="lg" />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setProgressValue(Math.max(0, progressValue - 10))}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  -10%
                </button>
                <button
                  onClick={() => setProgressValue(Math.min(100, progressValue + 10))}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  +10%
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-6 items-center">
              <div className="text-center">
                <CircularProgress value={65} size={80} strokeWidth={6} showValue={true} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Small</p>
              </div>
              <div className="text-center">
                <CircularProgress value={42} size={120} color="green" showValue={true} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Medium</p>
              </div>
              <div className="text-center">
                <CircularProgress value={89} size={160} strokeWidth={12} color="blue" showValue={true} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Large Animated</p>
              </div>
            </div>
          </div>
        </section>

        {/* Avatar Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Avatars</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="flex flex-wrap gap-4 items-end">
              <Avatar size="xs" name="John Doe" />
              <Avatar size="sm" name="Jane Smith" status="online" />
              <Avatar size="md" src="https://i.pravatar.cc/150?img=1" alt="User Avatar" status="away" />
              <Avatar size="lg" name="Bob Johnson" status="busy" showPremiumBadge />
              <Avatar size="xl" shape="square" name="Alice Brown" status="offline" showPremiumBadge />
              <Avatar size="md" src="https://i.pravatar.cc/150?img=2" alt="Premium User" showPremiumBadge />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Premium Badge Sizes:</p>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex flex-col items-center gap-2">
                  <PremiumBadge size="xs" />
                  <span className="text-xs text-gray-500">XS</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumBadge size="sm" />
                  <span className="text-xs text-gray-500">SM</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumBadge size="md" />
                  <span className="text-xs text-gray-500">MD</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumBadge size="lg" />
                  <span className="text-xs text-gray-500">LG</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Avatar Group:</p>
              <AvatarGroup
                avatars={[
                  { name: 'John Doe' },
                  { src: 'https://i.pravatar.cc/150?img=2', name: 'Jane' },
                  { name: 'Bob Smith' },
                  { name: 'Alice' },
                  { name: 'Charlie' }
                ]}
                max={3}
                size="md"
              />
            </div>
            
            <div className="flex gap-4">
              <Avatar
                size="lg"
                name="Clickable"
                onClick={() => showToast('Avatar clicked!', 'info')}
                badge={<span className="block w-3 h-3 bg-red-500 rounded-full"></span>}
              />
              <Avatar
                size="lg"
                shape="square"
                name="With Badge"
                badge={<span className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded">Pro</span>}
              />
            </div>
          </div>
        </section>

        {/* Pagination Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Pagination</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="space-y-4">
              <Pagination
                currentPage={currentPage}
                totalPages={10}
                onPageChange={setCurrentPage}
                showFirstLast={true}
              />
              <PaginationInfo
                currentPage={currentPage}
                totalPages={10}
                itemsPerPage={20}
                totalItems={195}
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Small Size:</p>
              <Pagination
                currentPage={3}
                totalPages={5}
                onPageChange={() => {}}
                size="sm"
                showFirstLast={false}
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Large Size with Many Pages:</p>
              <Pagination
                currentPage={15}
                totalPages={50}
                onPageChange={() => {}}
                size="lg"
                maxVisible={7}
              />
            </div>
          </div>
        </section>

        {/* Input Components */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Form Inputs</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Text Input"
                placeholder="Enter text..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                hint="This is a helpful hint"
              />
              
              <Input
                label="With Icons"
                placeholder="Search..."
                icon={<span>🔍</span>}
                rightIcon={<span>✨</span>}
              />
              
              <Input
                label="Filled Variant"
                placeholder="Filled input"
                variant="filled"
              />
              
              <Input
                label="Ghost Variant"
                placeholder="Ghost input"
                variant="ghost"
              />
              
              <Input
                label="With Error"
                placeholder="Invalid input"
                error="This field is required"
              />
              
              <Input
                label="Disabled"
                placeholder="Cannot edit"
                disabled={true}
              />
            </div>
            
            <Textarea
              label="Textarea"
              placeholder="Enter multiple lines of text..."
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              rows={4}
              hint="Supports markdown"
            />
            
            <div className="space-y-3">
              <Checkbox
                label="Accept terms and conditions"
                checked={checkboxValue}
                onChange={(e) => setCheckboxValue(e.target.checked)}
                hint="You must accept to continue"
              />
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Radio Options:</p>
                <Radio
                  name="options"
                  value="option1"
                  label="Option 1"
                  checked={radioValue === 'option1'}
                  onChange={(e) => setRadioValue(e.target.value)}
                />
                <Radio
                  name="options"
                  value="option2"
                  label="Option 2"
                  checked={radioValue === 'option2'}
                  onChange={(e) => setRadioValue(e.target.value)}
                />
                <Radio
                  name="options"
                  value="option3"
                  label="Option 3 (Disabled)"
                  checked={radioValue === 'option3'}
                  onChange={(e) => setRadioValue(e.target.value)}
                  disabled={true}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Select Components */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Select Dropdowns</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Basic Select"
                placeholder="Choose an option"
                options={[
                  { value: 'react', label: 'React' },
                  { value: 'vue', label: 'Vue' },
                  { value: 'angular', label: 'Angular' },
                  { value: 'svelte', label: 'Svelte' }
                ]}
                value={selectValue}
                onChange={setSelectValue}
              />
              
              <Select
                label="With Icons & Search"
                placeholder="Select framework"
                options={[
                  { value: 'react', label: 'React', icon: '⚛️' },
                  { value: 'vue', label: 'Vue.js', icon: '💚' },
                  { value: 'angular', label: 'Angular', icon: '🅰️' },
                  { value: 'svelte', label: 'Svelte', icon: '🔥' },
                  { value: 'solid', label: 'SolidJS', icon: '⚡' }
                ]}
                searchable={true}
                clearable={true}
                value={selectValue}
                onChange={setSelectValue}
              />
              
              <Select
                label="Filled Variant"
                placeholder="Choose color"
                options={[
                  { value: 'red', label: 'Red' },
                  { value: 'green', label: 'Green' },
                  { value: 'blue', label: 'Blue' }
                ]}
                variant="filled"
              />
              
              <Select
                label="Ghost Variant"
                placeholder="Choose size"
                options={[
                  { value: 'sm', label: 'Small' },
                  { value: 'md', label: 'Medium' },
                  { value: 'lg', label: 'Large' },
                  { value: 'xl', label: 'Extra Large', disabled: true }
                ]}
                variant="ghost"
              />
            </div>
            
            <MultiSelect
              label="Multi-Select"
              placeholder="Select multiple options"
              options={[
                { value: 'js', label: 'JavaScript' },
                { value: 'ts', label: 'TypeScript' },
                { value: 'py', label: 'Python' },
                { value: 'go', label: 'Go' },
                { value: 'rust', label: 'Rust' },
                { value: 'java', label: 'Java' }
              ]}
              value={multiSelectValue}
              onChange={setMultiSelectValue}
              searchable={true}
              max={3}
              hint="Select up to 3 languages"
            />
          </div>
        </section>

        {/* Card Component */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cards</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                title="Default Card"
                subtitle="With subtitle"
                variant="default"
              >
                <p className="text-gray-600 dark:text-gray-400">
                  This is the default card variant with standard styling.
                </p>
              </Card>
              
              <Card
                title="Elevated Card"
                subtitle="With shadow"
                variant="elevated"
                hoverable={true}
                onClick={() => showToast('Card clicked!', 'info')}
              >
                <p className="text-gray-600 dark:text-gray-400">
                  Click me! This card has elevation and hover effects.
                </p>
              </Card>
              
              <Card
                title="Glass Card"
                variant="glass"
                image="https://picsum.photos/400/200"
                imageAlt="Random image"
              >
                <p className="text-gray-600 dark:text-gray-400">
                  Glass variant with backdrop blur and image.
                </p>
              </Card>
            </div>
            
            <HorizontalCard
              title="Horizontal Card"
              subtitle="Side-by-side layout"
              image="https://picsum.photos/200/150"
              imagePosition="left"
              hoverable={true}
            >
              <p className="text-gray-600 dark:text-gray-400">
                This is a horizontal card layout perfect for lists and compact displays. The image can be positioned on either side.
              </p>
            </HorizontalCard>
            
            <Card
              title="Card with Footer"
              subtitle="Interactive elements"
              footer={
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">2 hours ago</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600">
                      Action
                    </button>
                  </div>
                </div>
              }
            >
              <p className="text-gray-600 dark:text-gray-400">
                Cards can have footers with additional actions or information.
              </p>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Loading Skeleton:</p>
                <CardSkeleton showImage={true} showFooter={true} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Horizontal Skeleton:</p>
                <CardSkeleton variant="horizontal" showImage={true} />
              </div>
            </div>
          </div>
        </section>

        {/* Page Container Gradients */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Page Container Gradients</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="flex gap-2 mb-4">
              {(['default', 'sakura', 'mizu', 'matcha'] as const).map((gradient) => (
                <button
                  key={gradient}
                  onClick={() => setGradientType(gradient)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    gradientType === gradient 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {gradient.charAt(0).toUpperCase() + gradient.slice(1)}
                </button>
              ))}
            </div>
            
            <div className="relative h-48 rounded-lg overflow-hidden">
              <PageContainer gradient={gradientType} showPattern={true} className="absolute inset-0">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-6 bg-white/80 dark:bg-gray-800/80 rounded-lg backdrop-blur">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {gradientType.charAt(0).toUpperCase() + gradientType.slice(1)} Gradient
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Page container with decorative pattern
                    </p>
                  </div>
                </div>
              </PageContainer>
            </div>
          </div>
        </section>

        {/* Theme Testing */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Theme Testing</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Card Example</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  This card adapts to the current theme. Switch themes using the toggle in the header to see the changes.
                </p>
              </div>
              <div className="relative p-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-800 dark:to-dark-700 rounded-lg border-2 border-primary-300 dark:border-primary-500 overflow-hidden">
                {/* Primary color accent stripe */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600"></div>
                
                {/* Content */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 shadow-lg"></div>
                    <h3 className="font-semibold text-primary-900 dark:text-white">Primary Palette Card</h3>
                  </div>
                  <p className="text-primary-700 dark:text-gray-100 text-sm mb-3">
                    This card showcases how the primary color palette adapts to different themes while maintaining proper contrast.
                  </p>
                  
                  {/* Primary color chips to show the palette */}
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded bg-primary-200 dark:bg-primary-800" title="primary-200/800"></div>
                    <div className="w-6 h-6 rounded bg-primary-300 dark:bg-primary-700" title="primary-300/700"></div>
                    <div className="w-6 h-6 rounded bg-primary-400 dark:bg-primary-600" title="primary-400/600"></div>
                    <div className="w-6 h-6 rounded bg-primary-500 dark:bg-primary-500" title="primary-500"></div>
                    <div className="w-6 h-6 rounded bg-primary-600 dark:bg-primary-400" title="primary-600/400"></div>
                  </div>
                </div>
                
                {/* Decorative primary gradient overlay */}
                <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-gradient-to-br from-primary-400/20 to-primary-600/20 dark:from-primary-500/10 dark:to-primary-700/10 rounded-full blur-xl"></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Example Modal"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This is a modal component. It supports different sizes and can be closed by clicking outside, pressing ESC, or using the close button.
          </p>
          <div className="flex items-center gap-3">
            <DoshiMascot size="small" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Doshi can appear in modals too!
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setModalOpen(false);
                showToast('Modal action confirmed!', 'success');
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => {
          showToast('Dialog confirmed!', 'success');
        }}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action? This is an example dialog component."
        type="warning"
        confirmText="Yes, Proceed"
        cancelText="Cancel"
      />

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Example Drawer"
        position={drawerPosition}
        showDoshi={true}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This is a drawer component. On mobile devices, you can swipe to close it!
          </p>
          <div className="space-y-2">
            <button className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Menu Item 1
            </button>
            <button className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Menu Item 2
            </button>
            <button className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Menu Item 3
            </button>
          </div>
        </div>
      </Drawer>

      {/* Loading Overlay */}
      <LoadingOverlay
        isLoading={loadingOverlay}
        message="Loading content..."
        showDoshi={true}
        fullScreen={true}
      />
    </div>
  );
}

export default function ShowcasePage() {
  return (
    <ToastProvider defaultPosition="bottom" maxToasts={5}>
      <ShowcaseContent />
    </ToastProvider>
  );
}