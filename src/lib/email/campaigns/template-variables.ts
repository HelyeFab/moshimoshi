export interface ReminderSummaryFeature {
  name: string
  url: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeFeature(input: any): ReminderSummaryFeature | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const url = typeof input.url === 'string' ? input.url.trim() : ''
  if (!name || !url) {
    return null
  }

  return { name, url }
}

export function parseReminderSummaryFeatures(
  rawTopFeatures: string | undefined
): ReminderSummaryFeature[] {
  if (!rawTopFeatures) return []

  try {
    const parsed = JSON.parse(rawTopFeatures)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeFeature(item))
      .filter((item): item is ReminderSummaryFeature => Boolean(item))
      .slice(0, 5)
  } catch {
    return []
  }
}

export function buildReminderSummaryFeaturesHtml(features: ReminderSummaryFeature[]): string {
  if (features.length === 0) {
    return '<p>No feature activity to show.</p>'
  }

  const items = features
    .map((feature) => {
      const safeName = escapeHtml(feature.name)
      const safeUrl = escapeHtml(feature.url)
      return `<li style="margin:0 0 10px 0;"><a href="${safeUrl}" style="color:#2563eb;text-decoration:none;">${safeName}</a></li>`
    })
    .join('')

  return `<ul style="padding-left:20px;margin:0;">${items}</ul>`
}

export function buildReminderSummaryFeaturesText(features: ReminderSummaryFeature[]): string {
  if (features.length === 0) {
    return '- No feature activity to show.'
  }

  return features.map((feature) => `- ${feature.name}: ${feature.url}`).join('\n')
}

export function normalizeCampaignTemplateVariables(
  variables: Record<string, string> | undefined
): Record<string, string> {
  const normalized: Record<string, string> = {
    ...(variables || {}),
  }

  const features = parseReminderSummaryFeatures(normalized.topFeatures)
  if (features.length > 0) {
    if (!normalized.topFeaturesHtml) {
      normalized.topFeaturesHtml = buildReminderSummaryFeaturesHtml(features)
    }
    if (!normalized.topFeaturesText) {
      normalized.topFeaturesText = buildReminderSummaryFeaturesText(features)
    }
  }

  return normalized
}
