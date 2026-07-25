"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { createAnnouncement, getTargetingOptions } from "./actions";
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory } from "@/lib/announcement-categories";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Link2, Undo2, Redo2, ImageIcon, Loader2, Megaphone, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL = "__all__";

type Options = Awaited<ReturnType<typeof getTargetingOptions>>;

function ToolbarButton({
  onClick, active, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded-md border text-sm transition-colors",
        active ? "bg-primary text-white border-primary" : "bg-white hover:bg-muted border-input"
      )}
    >
      {children}
    </button>
  );
}

export function AnnouncementComposer({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("ALERTS");
  const [options, setOptions] = useState<Options | null>(null);
  const [program, setProgram] = useState(ALL);
  const [semester, setSemester] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [subjectId, setSubjectId] = useState(ALL);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[160px] p-3 focus:outline-none",
      },
    },
  });

  const loadOptions = async () => {
    if (options) return;
    try {
      setOptions(await getTargetingOptions());
    } catch {
      toast.error("Failed to load targeting options");
    }
  };

  const pickBanner = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Banner must be an image");
    if (f.size > 10 * 1024 * 1024) return toast.error("Banner exceeds 10MB");
    setBanner(f);
    setBannerPreview(URL.createObjectURL(f));
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") return editor.chain().focus().unsetLink().run();
    editor.chain().focus().setLink({ href: url }).run();
  };

  const submit = async () => {
    if (!editor) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("category", category);
      fd.append("contentHtml", editor.getHTML());
      if (program !== ALL) fd.append("program", program);
      if (semester !== ALL) fd.append("semester", semester);
      if (section !== ALL) fd.append("section", section);
      if (subjectId !== ALL) fd.append("subjectId", subjectId);
      if (banner) fd.append("banner", banner);

      const res = await createAnnouncement(fd);
      if (res.success) {
        toast.success("Announcement published");
        setTitle("");
        editor.commands.clearContent();
        setBanner(null);
        setBannerPreview(null);
        setProgram(ALL); setSemester(ALL); setSection(ALL); setSubjectId(ALL); setCategory("ALERTS");
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) loadOptions(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> New Announcement
          </DialogTitle>
          <DialogDescription>
            Target it campus-wide or narrow by programme, semester, section and course.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-term exam schedule released" />
            </div>
            <div className="space-y-1.5">
              <Label title="Which tab this announcement shows under for readers">Category</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v as AnnouncementCategory)}>
                <SelectTrigger title="Readers filter announcements by this category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rich text editor */}
          <div className="space-y-1.5">
            <Label>Content</Label>
            <div className="rounded-md border">
              <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
                <ToolbarButton title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton title="Strikethrough" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
                <span className="w-px h-6 bg-border mx-1" />
                <ToolbarButton title="Heading" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton title="Subheading" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolbarButton>
                <span className="w-px h-6 bg-border mx-1" />
                <ToolbarButton title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton title="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton title="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarButton>
                <span className="w-px h-6 bg-border mx-1" />
                <ToolbarButton title="Link" active={editor?.isActive("link")} onClick={setLink}><Link2 className="h-4 w-4" /></ToolbarButton>
                <span className="w-px h-6 bg-border mx-1" />
                <ToolbarButton title="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton title="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Banner */}
          <div className="space-y-1.5">
            <Label>Banner / creative (optional)</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickBanner} aria-label="Choose banner image" />
            {bannerPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bannerPreview} alt="Banner preview" className="rounded-md border max-h-40 object-cover w-full" />
                <button
                  type="button"
                  title="Remove banner"
                  onClick={() => { setBanner(null); setBannerPreview(null); }}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-1.5" /> Attach banner image
              </Button>
            )}
          </div>

          {/* Targeting */}
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={program} onValueChange={(v) => setProgram(v || ALL)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Programme" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All programmes</SelectItem>
                  {options?.programs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={semester} onValueChange={(v) => setSemester(v || ALL)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Semester" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All semesters</SelectItem>
                  {options?.semesters.map((s) => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={section} onValueChange={(v) => setSection(v || ALL)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sections</SelectItem>
                  {options?.sections.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={subjectId} onValueChange={(v) => setSubjectId(v || ALL)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All courses</SelectItem>
                  {options?.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Leave everything on “All” for a campus-wide announcement (notifies every active user).
            </p>
          </div>

          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Publish Announcement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
