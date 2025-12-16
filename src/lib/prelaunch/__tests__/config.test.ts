import { isPreLaunch, isAllowedDuringPreLaunch, LAUNCH_DATE } from '@/lib/prelaunch/config'

const ORIGINAL_ENV = { ...process.env }

describe('prelaunch config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('disables lock when PRELAUNCH_LOCK_ENABLED is false even before launch date', () => {
    process.env.PRELAUNCH_LOCK_ENABLED = 'false'
    const beforeLaunch = new Date(LAUNCH_DATE.getTime() - 1000 * 60 * 60)
    jest.useFakeTimers().setSystemTime(beforeLaunch)

    expect(isPreLaunch()).toBe(false)

    jest.useRealTimers()
  })

  it('enables lock when toggle is true and date is before launch', () => {
    process.env.PRELAUNCH_LOCK_ENABLED = 'true'
    const beforeLaunch = new Date(LAUNCH_DATE.getTime() - 1000 * 60 * 60)
    jest.useFakeTimers().setSystemTime(beforeLaunch)

    expect(isPreLaunch()).toBe(true)

    jest.useRealTimers()
  })

  it('allows only whitelisted routes during lock', () => {
    expect(isAllowedDuringPreLaunch('/waitlist')).toBe(true)
    expect(isAllowedDuringPreLaunch('/en/waitlist')).toBe(true)
    expect(isAllowedDuringPreLaunch('/dashboard')).toBe(false)
    expect(isAllowedDuringPreLaunch('/ja/dashboard')).toBe(false)
  })
})
