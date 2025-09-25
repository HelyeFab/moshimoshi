// Import the actual strings directly
import { strings as enStrings } from '@/i18n/locales/en/strings'
import { strings as jaStrings } from '@/i18n/locales/ja/strings'
import { strings as frStrings } from '@/i18n/locales/fr/strings'
import { strings as itStrings } from '@/i18n/locales/it/strings'
import { strings as deStrings } from '@/i18n/locales/de/strings'
import { strings as esStrings } from '@/i18n/locales/es/strings'

// Language codes to test
const LANGUAGES = ['en', 'ja', 'fr', 'it', 'de', 'es'] as const
type Language = typeof LANGUAGES[number]

describe('Resources i18n Translations', () => {
  const languageStrings: Record<Language, any> = {
    en: enStrings,
    ja: jaStrings,
    fr: frStrings,
    it: itStrings,
    de: deStrings,
    es: esStrings
  }

  describe('Translation Completeness', () => {
    it('should have resources section in all languages', () => {
      LANGUAGES.forEach(lang => {
        expect(languageStrings[lang]).toBeDefined()
        expect(languageStrings[lang].admin).toBeDefined()
        expect(languageStrings[lang].admin.resources).toBeDefined()
      })
    })

    it('should have all required resource keys in every language', () => {
      const requiredKeys = [
        'title',
        'description',
        'newResource',
        'searchResources',
        'allStatus',
        'published',
        'draft',
        'scheduled',
        'selected',
        'deleteSelected',
        'clearSelection',
        'loadingResources',
        'noResourcesFound',
        'noResourcesMatching',
        'selectAll',
        'featured',
        'uncategorized',
        'views',
        'edit',
        'view',
        'delete',
        'actions',
        'status',
        'category',
        'updated',
        'totalPosts',
        'totalViews',
        'deleteResource',
        'deleteResourceConfirm',
        'error',
        'failedToDelete'
      ]

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        requiredKeys.forEach(key => {
          expect(resources[key]).toBeDefined()
        })
      })
    })

    it('should have all action translations', () => {
      const actionKeys = ['edit', 'view', 'delete', 'actions']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        actionKeys.forEach(action => {
          expect(resources[action]).toBeDefined()
          expect(typeof resources[action]).toBe('string')
          expect(resources[action].length).toBeGreaterThan(0)
        })
      })
    })

    it('should have all status translations', () => {
      const statusKeys = ['allStatus', 'draft', 'published', 'scheduled', 'status']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        statusKeys.forEach(s => {
          expect(resources[s]).toBeDefined()
          expect(typeof resources[s]).toBe('string')
        })
      })
    })

    it('should have category related translations', () => {
      const categoryKeys = ['category', 'uncategorized']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        categoryKeys.forEach(cat => {
          expect(resources[cat]).toBeDefined()
          expect(typeof resources[cat]).toBe('string')
        })
      })
    })

    it('should have error message translations', () => {
      const errorKeys = ['error', 'failedToDelete', 'failedToDeleteSome']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        errorKeys.forEach(error => {
          expect(resources[error]).toBeDefined()
          expect(typeof resources[error]).toBe('string')
        })
      })
    })

    it('should have empty state translations', () => {
      const emptyKeys = ['noResourcesFound', 'noResourcesMatching']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        emptyKeys.forEach(key => {
          expect(resources[key]).toBeDefined()
          expect(typeof resources[key]).toBe('string')
        })
      })
    })

    it('should have stats translations', () => {
      const statsKeys = ['totalPosts', 'totalViews', 'views']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        statsKeys.forEach(key => {
          expect(resources[key]).toBeDefined()
        })
      })
    })
  })

  describe('Translation Quality', () => {
    it('should not have placeholder text in translations', () => {
      const placeholderPatterns = [
        /TODO/i,
        /FIXME/i,
        /XXX/,
        /\[.*\]/,
        /TRANSLATE/i,
        /PENDING/i
      ]

      LANGUAGES.forEach(lang => {
        const checkObject = (obj: any, path: string = '') => {
          Object.entries(obj).forEach(([key, value]) => {
            const currentPath = path ? `${path}.${key}` : key
            if (typeof value === 'string') {
              placeholderPatterns.forEach(pattern => {
                expect(value).not.toMatch(pattern)
              })
            } else if (typeof value === 'object' && value !== null) {
              checkObject(value, currentPath)
            }
          })
        }

        checkObject(languageStrings[lang].admin.resources)
      })
    })

    it('should have appropriate length for UI elements', () => {
      // Button text should be concise
      const maxButtonLength = 30
      const buttonKeys = ['edit', 'view', 'delete', 'save', 'cancel', 'create', 'update']

      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        buttonKeys.forEach(key => {
          if (resources[key] && typeof resources[key] === 'string') {
            expect(resources[key].length).toBeLessThanOrEqual(maxButtonLength)
          }
        })
      })
    })

    it('should have consistent placeholders with parameters', () => {
      // Check strings that should have parameters
      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources

        // Check deleteResourcesConfirm parameter
        if (resources.deleteResourcesConfirm) {
          expect(resources.deleteResourcesConfirm).toContain('{count}')
        }
      })
    })

    it('should use appropriate character sets for each language', () => {
      // Japanese should contain hiragana, katakana, or kanji
      const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/
      const checkJapanese = (str: string) => {
        if (typeof str === 'string' && str.length > 0) {
          expect(str).toMatch(japanesePattern)
        }
      }

      // Check Japanese translations
      const checkObject = (obj: any) => {
        Object.values(obj).forEach(value => {
          if (typeof value === 'string') {
            checkJapanese(value)
          } else if (typeof value === 'object' && value !== null) {
            checkObject(value)
          }
        })
      }

      if (languageStrings.ja) {
        checkObject(languageStrings.ja.admin.resources)
      }
    })
  })

  describe('Cultural Appropriateness', () => {
    it('should use formal language where appropriate', () => {
      // Check Japanese uses polite forms
      if (languageStrings.ja) {
        const resources = languageStrings.ja.admin.resources

        // Check for polite endings in action buttons
        const politeEndings = ['ます', 'ください', 'です']
        const informalEndings = ['だ', 'よ', 'ね']

        const checkPoliteness = (str: string) => {
          if (typeof str === 'string') {
            // Should not use informal endings in admin context
            informalEndings.forEach(ending => {
              expect(str).not.toEndWith(ending)
            })
          }
        }

        // Check action-related strings
        const actionStrings = [resources.edit, resources.view, resources.delete, resources.save]
        actionStrings.forEach(str => {
          if (str && typeof str === 'string') {
            checkPoliteness(str)
          }
        })
      }
    })

    it('should use appropriate date/time formats for each locale', () => {
      // This would check date format strings if they were part of resources
      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources

        if (resources.lastModified && resources.lastModified.includes('date')) {
          // Verify appropriate date format for locale
          switch (lang) {
            case 'en':
              expect(resources.dateFormat).toMatch(/MM\/DD\/YYYY|DD\/MM\/YYYY/)
              break
            case 'ja':
              expect(resources.dateFormat).toMatch(/YYYY年MM月DD日/)
              break
            case 'de':
              expect(resources.dateFormat).toMatch(/DD\.MM\.YYYY/)
              break
            // Add other locales as needed
          }
        }
      })
    })
  })

  describe('Consistency Checks', () => {
    it('should have consistent capitalization style', () => {
      LANGUAGES.forEach(lang => {
        if (lang === 'en') {
          // Check title case for English headings
          const resources = languageStrings[lang].admin.resources
          expect(resources.title).toMatch(/^[A-Z]/)
          if (resources.newResource) {
            expect(resources.newResource).toMatch(/^[A-Z]/)
          }
        }
      })
    })

    it('should have matching structure across all languages', () => {
      const getKeys = (obj: any, prefix = ''): string[] => {
        let keys: string[] = []
        Object.keys(obj).forEach(key => {
          const fullKey = prefix ? `${prefix}.${key}` : key
          keys.push(fullKey)
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getKeys(obj[key], fullKey))
          }
        })
        return keys
      }

      const englishKeys = getKeys(languageStrings.en.admin.resources)

      LANGUAGES.slice(1).forEach(lang => {
        const langKeys = getKeys(languageStrings[lang].admin.resources)
        expect(langKeys.sort()).toEqual(englishKeys.sort())
      })
    })

    it('should not have duplicate translations', () => {
      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources
        const values: string[] = []

        const collectValues = (obj: any) => {
          Object.values(obj).forEach(value => {
            if (typeof value === 'string') {
              values.push(value)
            } else if (typeof value === 'object' && value !== null) {
              collectValues(value)
            }
          })
        }

        collectValues(resources)

        // Check for exact duplicates (some repetition is ok, but not too much)
        const duplicates = values.filter((v, i) => values.indexOf(v) !== i)
        const uniqueDuplicates = [...new Set(duplicates)]

        // Allow some common words to be duplicated
        const allowedDuplicates = ['All', 'すべて', 'Tous', 'Tutti', 'Alle', 'Todos']
        const unexpectedDuplicates = uniqueDuplicates.filter(
          d => !allowedDuplicates.includes(d)
        )

        expect(unexpectedDuplicates.length).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('Special Characters and Encoding', () => {
    it('should properly escape special characters', () => {
      LANGUAGES.forEach(lang => {
        const checkEscaping = (obj: any) => {
          Object.values(obj).forEach(value => {
            if (typeof value === 'string') {
              // Should not have unescaped HTML
              expect(value).not.toMatch(/<[^>]*>/)
              // Should not have unescaped quotes at inappropriate places
              expect(value).not.toMatch(/^".*"$/)
            } else if (typeof value === 'object' && value !== null) {
              checkEscaping(value)
            }
          })
        }

        checkEscaping(languageStrings[lang].admin.resources)
      })
    })

    it('should use appropriate quotation marks for each language', () => {
      // Different languages use different quotation marks
      const quotationMarks: Record<Language, { open: string; close: string }> = {
        en: { open: '"', close: '"' },
        ja: { open: '「', close: '」' },
        fr: { open: '«', close: '»' },
        de: { open: '„', close: '"' },
        it: { open: '«', close: '»' },
        es: { open: '«', close: '»' }
      }

      LANGUAGES.forEach(lang => {
        const marks = quotationMarks[lang]
        const checkQuotes = (str: string) => {
          if (str.includes('"') && lang !== 'en') {
            // Non-English languages should use their specific quotes
            console.warn(`${lang}: Consider using ${marks.open}...${marks.close} instead of "..."`)
          }
        }

        const checkObject = (obj: any) => {
          Object.values(obj).forEach(value => {
            if (typeof value === 'string') {
              checkQuotes(value)
            } else if (typeof value === 'object' && value !== null) {
              checkObject(value)
            }
          })
        }

        checkObject(languageStrings[lang].admin.resources)
      })
    })
  })

  describe('Contextual Accuracy', () => {
    it('should use appropriate terminology for resources/blog context', () => {
      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources

        // Check that we're using appropriate terms for a blog/resource context
        if (lang === 'en') {
          expect(resources.title.toLowerCase()).toContain('resource')
          if (resources.newResource) {
            expect(resources.newResource.toLowerCase()).toMatch(/new|add|create/)
          }
          if (resources.published) {
            expect(resources.published.toLowerCase()).toContain('publish')
          }
        }
      })
    })

    it('should have consistent terminology within the same language', () => {
      LANGUAGES.forEach(lang => {
        const resources = languageStrings[lang].admin.resources

        // If we use "Resource" in title, we should be consistent
        if (lang === 'en') {
          const titleTerm = resources.title.includes('Resource') ? 'resource' : 'post'
          if (resources.noResourcesFound) {
            expect(resources.noResourcesFound.toLowerCase()).toContain(titleTerm)
          }
        }
      })
    })
  })
})