'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { VariableInsertButton } from './VariableInsertButton'
import type { TemplateVariable } from '@/lib/email/templates/types'
import {
  ListBulletIcon,
  CodeBracketIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'

/**
 * Simple HTML formatter for better readability in source view
 * Adds line breaks after block-level closing tags
 */
function formatHtml(htmlStr: string): string {
  if (!htmlStr) return htmlStr

  // Block-level tags that should have newlines after their closing tags
  const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'blockquote', 'table', 'tr', 'thead', 'tbody', 'section', 'article', 'header', 'footer', 'nav', 'aside']

  let formatted = htmlStr

  // Add newline after closing block tags (if not already followed by newline)
  for (const tag of blockTags) {
    const regex = new RegExp(`(</${tag}>)(?!\\n|$)`, 'gi')
    formatted = formatted.replace(regex, '$1\n')
  }

  // Add newline after self-closing tags and <br>
  formatted = formatted.replace(/(<br\s*\/?>)(?!\n|$)/gi, '$1\n')
  formatted = formatted.replace(/(<hr\s*\/?>)(?!\n|$)/gi, '$1\n')

  // Clean up multiple consecutive newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n')

  return formatted.trim()
}

interface TemplateEditorProps {
  htmlContent: string
  textContent: string
  onHtmlChange: (html: string) => void
  onTextChange: (text: string) => void
  customVariables: TemplateVariable[]
  minHeight?: string
}

type TabMode = 'visual' | 'html' | 'text'

export function TemplateEditor({
  htmlContent,
  textContent,
  onHtmlChange,
  onTextChange,
  customVariables,
  minHeight = '300px',
}: TemplateEditorProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('visual')
  const [htmlSource, setHtmlSource] = useState(() => formatHtml(htmlContent))
  const [isDarkMode, setIsDarkMode] = useState(false)
  // Track if we're editing in HTML mode to prevent circular updates
  const isEditingHtmlRef = useRef(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()
    // Watch for changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary-600 dark:text-primary-400 underline',
        },
      }),
    ],
    content: htmlContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none p-4',
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      const newHtml = editor.getHTML()
      onHtmlChange(newHtml)
      // Only update htmlSource if not currently editing in HTML mode
      if (!isEditingHtmlRef.current) {
        setHtmlSource(newHtml)
      }
    },
  })

  // Format HTML when switching to HTML source view
  useEffect(() => {
    if (activeTab === 'html' && editor) {
      const currentHtml = editor.getHTML()
      const formatted = formatHtml(currentHtml)
      setHtmlSource(formatted)
    }
  }, [activeTab, editor])

  // Handle tab changes
  const handleTabChange = useCallback((tab: TabMode) => {
    // When leaving HTML mode, sync to editor
    if (activeTab === 'html' && tab !== 'html' && editor) {
      editor.commands.setContent(htmlSource)
    }
    setActiveTab(tab)
  }, [activeTab, editor, htmlSource])

  // Insert variable at cursor position in editor
  const handleInsertVariable = useCallback(
    (variableText: string) => {
      if (activeTab === 'visual' && editor) {
        editor.chain().focus().insertContent(variableText).run()
      } else if (activeTab === 'html') {
        // For HTML mode, we'll append to cursor (simplified)
        const newHtml = htmlSource + variableText
        setHtmlSource(newHtml)
        onHtmlChange(newHtml)
      } else if (activeTab === 'text') {
        const newText = textContent + variableText
        onTextChange(newText)
      }
    },
    [activeTab, editor, htmlSource, textContent, onHtmlChange, onTextChange]
  )

  // Handle HTML source changes from CodeMirror
  const handleHtmlSourceChange = useCallback((value: string) => {
    isEditingHtmlRef.current = true
    setHtmlSource(value)
    onHtmlChange(value)
    // Delay resetting the flag to prevent race conditions
    setTimeout(() => {
      isEditingHtmlRef.current = false
    }, 100)
  }, [onHtmlChange])

  // Handle plain text changes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onTextChange(e.target.value)
  }

  const addLink = () => {
    if (editor) {
      const url = window.prompt('Enter URL:')
      if (url) {
        editor.chain().focus().setLink({ href: url }).run()
      }
    }
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        active
          ? 'bg-primary-500 text-white'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="bg-gray-50 dark:bg-dark-800 border-b border-gray-300 dark:border-gray-600 px-2 pt-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('visual')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === 'visual'
                ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 border-t border-l border-r border-gray-300 dark:border-gray-600 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('html')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === 'html'
                ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 border-t border-l border-r border-gray-300 dark:border-gray-600 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            HTML Source
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('text')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === 'text'
                ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 border-t border-l border-r border-gray-300 dark:border-gray-600 -mb-px'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Plain Text
          </button>
        </div>
      </div>

      {/* Toolbar (for visual mode) */}
      {activeTab === 'visual' && editor && (
        <div className="bg-gray-50 dark:bg-dark-800 border-b border-gray-300 dark:border-gray-600 p-2 flex flex-wrap gap-1 items-center">
          {/* Variable Insert */}
          <VariableInsertButton
            customVariables={customVariables}
            onInsert={handleInsertVariable}
          />

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Headings */}
          <div className="flex gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive('heading', { level: 1 })}
              title="Heading 1"
            >
              <span className="text-base font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
              title="Heading 2"
            >
              <span className="text-sm font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive('heading', { level: 3 })}
              title="Heading 3"
            >
              <span className="text-xs font-bold">H3</span>
            </ToolbarButton>
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Text Formatting */}
          <div className="flex gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </ToolbarButton>
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Lists */}
          <div className="flex gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="Bullet List"
            >
              <ListBulletIcon className="w-5 h-5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              title="Numbered List"
            >
              <span className="text-sm">1.</span>
            </ToolbarButton>
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Link */}
          <div className="flex gap-1">
            <ToolbarButton
              onClick={addLink}
              active={editor.isActive('link')}
              title="Add Link"
            >
              <LinkIcon className="w-5 h-5" />
            </ToolbarButton>
            {editor.isActive('link') && (
              <ToolbarButton
                onClick={() => editor.chain().focus().unsetLink().run()}
                title="Remove Link"
              >
                <span className="text-xs">X</span>
              </ToolbarButton>
            )}
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Code */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code"
          >
            <CodeBracketIcon className="w-5 h-5" />
          </ToolbarButton>
        </div>
      )}

      {/* Toolbar for HTML/Text mode */}
      {(activeTab === 'html' || activeTab === 'text') && (
        <div className="bg-gray-50 dark:bg-dark-800 border-b border-gray-300 dark:border-gray-600 p-2 flex items-center">
          <VariableInsertButton
            customVariables={customVariables}
            onInsert={handleInsertVariable}
          />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            Click to insert variable at cursor
          </span>
        </div>
      )}

      {/* Editor Content */}
      <div className="bg-white dark:bg-dark-900">
        {activeTab === 'visual' && (
          <EditorContent editor={editor} />
        )}

        {activeTab === 'html' && (
          <CodeMirror
            value={htmlSource}
            onChange={handleHtmlSourceChange}
            extensions={[html()]}
            theme={isDarkMode ? githubDark : githubLight}
            minHeight={minHeight}
            className="text-sm [&_.cm-editor]:!bg-white dark:[&_.cm-editor]:!bg-dark-900"
            placeholder="Enter HTML content here..."
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              autocompletion: true,
              bracketMatching: true,
              closeBrackets: true,
              indentOnInput: true,
            }}
          />
        )}

        {activeTab === 'text' && (
          <textarea
            value={textContent}
            onChange={handleTextChange}
            className="w-full p-4 font-mono text-sm bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none resize-none"
            style={{ minHeight }}
            placeholder="Enter plain text content here..."
          />
        )}
      </div>
    </div>
  )
}
