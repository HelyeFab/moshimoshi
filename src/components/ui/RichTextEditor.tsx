'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import {
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  CodeBracketIcon,
  LinkIcon,
  H1Icon,
  H2Icon,
  H3Icon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing your blog post...',
  minHeight = '400px'
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // We'll use custom heading extension
        codeBlock: false, // We'll use custom code block
        blockquote: false, // We'll use custom blockquote
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary-600 dark:text-primary-400 underline hover:text-primary-700',
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 dark:bg-gray-800 rounded p-4 font-mono text-sm',
        },
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-4 border-primary-500 pl-4 italic text-gray-700 dark:text-gray-300',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow.configure({}),
      TableHeader.configure({}),
      TableCell.configure({}),
    ],
    content,
    editorProps: {
      attributes: {
        class: `blog-editor max-w-none focus:outline-none ${minHeight ? `min-h-[${minHeight}]` : ''}`,
        style: minHeight ? `min-height: ${minHeight}` : '',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when prop changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
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
  );

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const deleteTable = () => {
    editor.chain().focus().deleteTable().run();
  };

  const addColumnBefore = () => {
    editor.chain().focus().addColumnBefore().run();
  };

  const addColumnAfter = () => {
    editor.chain().focus().addColumnAfter().run();
  };

  const deleteColumn = () => {
    editor.chain().focus().deleteColumn().run();
  };

  const addRowBefore = () => {
    editor.chain().focus().addRowBefore().run();
  };

  const addRowAfter = () => {
    editor.chain().focus().addRowAfter().run();
  };

  const deleteRow = () => {
    editor.chain().focus().deleteRow().run();
  };

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 dark:bg-dark-800 border-b border-gray-300 dark:border-gray-600 p-2 flex flex-wrap gap-1">
        {/* Headings */}
        <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <span className="text-xl font-bold">H1</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <span className="text-lg font-bold">H2</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <span className="text-base font-bold">H3</span>
          </ToolbarButton>
        </div>

        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
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
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <s>S</s>
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
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

        {/* Code & Quote */}
        <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code"
          >
            <CodeBracketIcon className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <span className="text-xs font-mono">{'{}'}</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Quote"
          >
            <span className="text-lg">"</span>
          </ToolbarButton>
        </div>

        {/* Link */}
        <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
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
              <span className="text-xs">✕</span>
            </ToolbarButton>
          )}
        </div>

        {/* Table */}
        <div className="flex gap-1">
          <ToolbarButton
            onClick={addTable}
            disabled={editor.isActive('table')}
            title="Insert Table"
          >
            <TableCellsIcon className="w-5 h-5" />
          </ToolbarButton>
          {editor.isActive('table') && (
            <>
              <ToolbarButton
                onClick={addColumnBefore}
                title="Add Column Before"
              >
                <span className="text-xs">+C</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={addColumnAfter}
                title="Add Column After"
              >
                <span className="text-xs">C+</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={deleteColumn}
                title="Delete Column"
              >
                <span className="text-xs">-C</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={addRowBefore}
                title="Add Row Before"
              >
                <span className="text-xs">+R</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={addRowAfter}
                title="Add Row After"
              >
                <span className="text-xs">R+</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={deleteRow}
                title="Delete Row"
              >
                <span className="text-xs">-R</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={deleteTable}
                title="Delete Table"
              >
                <span className="text-xs">-T</span>
              </ToolbarButton>
            </>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="bg-white dark:bg-dark-900 p-4">
        <EditorContent editor={editor} />
        {!editor.getText() && (
          <p className="text-gray-400 dark:text-gray-500 pointer-events-none">
            {placeholder}
          </p>
        )}
      </div>
    </div>
  );
}
