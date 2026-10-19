"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";

// Mirrors what the backend keeps (backend/src/email/broadcast-html.ts) —
// code/code-block are disabled since the sanitizer would strip them anyway.
function createExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: null, target: null },
      },
    }),
    Placeholder.configure({ placeholder }),
  ];
}

function ToolbarButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
  className = "",
}: {
  label: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection when clicking a toolbar button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 h-8 px-2 rounded-lg text-sm transition-colors disabled:opacity-40 ${
        active ? "bg-emerald text-white" : "text-ink hover:bg-emerald/10"
      } ${className}`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-emerald/20 mx-1" aria-hidden />;
}

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      linkHref: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  function openLinkBar() {
    setLinkValue(state.linkHref);
    setLinkOpen(true);
  }

  function applyLink() {
    const href = normalizeUrl(linkValue);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) {
      chain.unsetLink().run();
    } else if (editor.state.selection.empty && !state.link) {
      // Nothing selected: insert the URL itself as the link text.
      chain
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  return (
    <div className="border-b border-emerald/20 bg-cloud rounded-t-xl">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        <ToolbarButton
          title="Bold"
          label={<strong>B</strong>}
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          title="Italic"
          label={<em className="font-serif">I</em>}
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          title="Underline"
          label={<span className="underline">U</span>}
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          title="Strikethrough"
          label={<span className="line-through">S</span>}
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Divider />
        <ToolbarButton
          title="Heading"
          label="H1"
          active={state.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          title="Subheading"
          label="H2"
          active={state.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <Divider />
        <ToolbarButton
          title="Bulleted list"
          label="• List"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          title="Numbered list"
          label="1. List"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          title="Quote"
          label="❝"
          active={state.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          title="Divider line"
          label="―"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <Divider />
        <ToolbarButton title="Add or edit link" label="🔗 Link" active={state.link} onClick={openLinkBar} />
        {state.link && (
          <ToolbarButton
            title="Remove link"
            label="Unlink"
            onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
          />
        )}
        <Divider />
        <ToolbarButton
          title="Insert recipient's first name"
          label="+ First name"
          onClick={() => editor.chain().focus().insertContent("{{name}}").run()}
        />
        <span className="ml-auto flex">
          <ToolbarButton
            title="Undo"
            label="↶"
            disabled={!state.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            title="Redo"
            label="↷"
            disabled={!state.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </span>
      </div>

      {linkOpen && (
        <form
          className="flex items-center gap-2 px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://chat.whatsapp.com/…"
            className="flex-1 border border-emerald/20 rounded-lg px-3 py-1 text-sm bg-white focus:outline-none focus:border-gold"
          />
          <button type="submit" className="bg-emerald text-white px-3 py-1 rounded-full text-sm hover:bg-forest">
            Apply
          </button>
          <button type="button" onClick={() => setLinkOpen(false)} className="text-sage text-sm underline">
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your message…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: createExtensions(placeholder),
    content: value,
    // Next renders client components on the server first — ProseMirror
    // needs the DOM, so defer the first render to the client.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "broadcast-editor-content min-h-64 px-4 py-3 focus:outline-none text-ink text-[15px]",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  return (
    <div className="border border-emerald/20 rounded-xl bg-white focus-within:border-gold">
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-emerald/20 bg-cloud rounded-t-xl" />}
      <EditorContent editor={editor} />
    </div>
  );
}
