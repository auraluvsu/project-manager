import { useState, CSSProperties, ReactNode } from "react";
import {
  X,
  Plus,
  Trash2,
  Link,
  ExternalLink,
  Loader,
  Archive,
} from "lucide-react";
import { getDueState, formatDue } from "../utils/dueDate";
import { PomodoroInline } from "./PomodoroTimer";

interface Subcard {
  id: string;
  title: string;
  text?: string;
  done: boolean;
}

interface LinkItem {
  id: string;
  url: string;
  title: string;
}

interface Card {
  id?: string;
  title: string;
  desc: string;
  status: "urgent" | "pressing" | "lenient";
  stage: "todo" | "inprogress" | "done";
  subcards: Subcard[];
  links: LinkItem[];
  dueDate: string;
}

interface StatusOption {
  value: "urgent" | "pressing" | "lenient";
  label: string;
  color: string;
}

interface StageOption {
  value: "todo" | "inprogress" | "done";
  label: string;
}

const STATUSES: StatusOption[] = [
  { value: "urgent", label: "Urgent", color: "var(--urgent)" },
  { value: "pressing", label: "Pressing", color: "var(--pressing)" },
  { value: "lenient", label: "Lenient", color: "var(--lenient)" },
];

const STAGES: StageOption[] = [
  { value: "todo", label: "Yet to Start" },
  { value: "inprogress", label: "Working On" },
  { value: "done", label: "Done" },
];

interface CardModalProps {
  card?: Partial<Card>;
  onSave: (card: Card) => void;
  onClose: () => void;
  onArchive?: (id: string) => void;
}

export default function CardModal({
  card,
  onSave,
  onClose,
  onArchive,
}: CardModalProps) {
  const [title, setTitle] = useState(card?.title || "");
  const [desc, setDesc] = useState(card?.desc || "");
  const [status, setStatus] = useState<"urgent" | "pressing" | "lenient">(
    card?.status || "lenient",
  );
  const [stage, setStage] = useState<"todo" | "inprogress" | "done">(
    card?.stage || "todo",
  );
  const [dueDate, setDueDate] = useState(card?.dueDate || "");
  const [subcards, setSubcards] = useState<Subcard[]>(card?.subcards || []);
  const [links, setLinks] = useState<LinkItem[]>(card?.links || []);
  const [newSub, setNewSub] = useState("");
  const [newLink, setNewLink] = useState("");
  const [fetching, setFetching] = useState(false);

  const isEdit = !!card?.id;
  const due = getDueState(dueDate);

  const save = (): void => {
    if (!title.trim()) {
      alert("You must add a title!");
      return;
    }
    onSave({
      title: title.trim(),
      desc: desc.trim(),
      status,
      stage,
      dueDate,
      subcards,
      links,
      id: card?.id || crypto.randomUUID(),
    });
    onClose();
  };

  const addSubcard = (): void => {
    if (!newSub.trim()) return;
    setSubcards((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: newSub.trim(), done: false },
    ]);
    setNewSub("");
  };

  const toggleSubcard = (id: string): void =>
    setSubcards((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );

  const deleteSubcard = (id: string): void =>
    setSubcards((prev) => prev.filter((s) => s.id !== id));

  const addLink = async (): Promise<void> => {
    let url = newLink.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setFetching(true);
    setNewLink("");
    let pageTitle = url;
    try {
      const res = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      );
      const data = await res.json();
      const match = data.contents?.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match) pageTitle = match[1].trim();
    } catch {
      /* fall back to URL */
    }
    setFetching(false);
    setLinks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), url, title: pageTitle },
    ]);
  };

  const deleteLink = (id: string): void =>
    setLinks((prev) => prev.filter((l) => l.id !== id));

  return (
    <div
      style={s.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={s.modal} className="modal-enter">
        <div style={s.header}>
          <span style={s.heading}>{isEdit ? "Edit card" : "New card"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isEdit && onArchive && (
              <button
                style={s.archiveBtn}
                onClick={() => {
                  onArchive(card!.id!);
                  onClose();
                }}
                title="Archive card"
              >
                <Archive size={13} /> Archive
              </button>
            )}
            <button style={s.closeBtn} onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={s.body}>
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              style={s.input}
              placeholder="Card title"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={
                {
                  ...s.input,
                  minHeight: 68,
                  resize: "vertical",
                } as CSSProperties
              }
              placeholder="Optional notes…"
            />
          </Field>

          <div style={{ display: "flex", gap: 20 }}>
            <Field label="Priority" style={{ flex: 1 }}>
              <div style={s.pills}>
                {STATUSES.map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setStatus(st.value)}
                    style={{
                      ...s.pill,
                      borderColor:
                        status === st.value ? st.color : "var(--border)",
                      color: status === st.value ? st.color : "var(--muted)",
                      background:
                        status === st.value
                          ? `color-mix(in srgb, ${st.color} 12%, transparent)`
                          : "transparent",
                    }}
                  >
                    <span style={{ ...s.dot, background: st.color }} />
                    {st.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Stage" style={{ flex: 1 }}>
              <div style={s.pills}>
                {STAGES.map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setStage(st.value)}
                    style={{
                      ...s.pill,
                      borderColor:
                        stage === st.value ? "var(--jade)" : "var(--border)",
                      color:
                        stage === st.value ? "var(--jade)" : "var(--muted)",
                      background:
                        stage === st.value ? "var(--jade-glow)" : "transparent",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Due date">
            <div style={s.dueDateRow}>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={
                  { ...s.input, flex: 1, colorScheme: "dark" } as CSSProperties
                }
              />
              {dueDate && (
                <>
                  <span style={{ ...s.dueLabel, color: due.color }}>
                    {due.label}
                  </span>
                  <button style={s.clearDue} onClick={() => setDueDate("")}>
                    <X size={11} />
                  </button>
                </>
              )}
            </div>
          </Field>

          {isEdit && (
            <Field label="Pomodoro timer">
              <PomodoroInline
                cardId={card!.id!}
                cardTitle={card!.title || title}
              />
            </Field>
          )}

          <Field
            label={`Subcards (${subcards.filter((s) => s.done).length}/${subcards.length})`}
          >
            <div style={s.subList}>
              {subcards.map((sub) => (
                <div key={sub.id} style={s.subRow}>
                  <button
                    onClick={() => toggleSubcard(sub.id)}
                    style={{
                      ...s.checkbox,
                      background: sub.done ? "var(--jade)" : "transparent",
                      borderColor: sub.done ? "var(--jade)" : "var(--faint)",
                    }}
                  >
                    {sub.done && (
                      <span
                        style={{
                          color: "#0D1A13",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                  <span
                    style={{
                      ...s.subTitle,
                      textDecoration: sub.done ? "line-through" : "none",
                      color: sub.done ? "var(--muted)" : "var(--text)",
                    }}
                  >
                    {sub.title}
                  </span>
                  <button
                    style={s.iconBtn}
                    onClick={() => deleteSubcard(sub.id)}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <div style={s.addRow}>
                <input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubcard()}
                  style={
                    {
                      ...s.input,
                      flex: 1,
                      padding: "7px 10px",
                    } as CSSProperties
                  }
                  placeholder="Add subcard…"
                />
                <button style={s.addBtn} onClick={addSubcard}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </Field>

          <Field label="Links">
            <div style={s.linkList}>
              {links.map((lnk) => (
                <div key={lnk.id} style={s.linkRow}>
                  <Link
                    size={12}
                    color="var(--jade)"
                    style={{ flexShrink: 0 }}
                  />
                  <a
                    href={lnk.url}
                    target="_blank"
                    rel="noreferrer"
                    style={s.linkText}
                    title={lnk.url}
                  >
                    {lnk.title}
                  </a>
                  <a
                    href={lnk.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--muted)", display: "flex" }}
                  >
                    <ExternalLink size={11} />
                  </a>
                  <button style={s.iconBtn} onClick={() => deleteLink(lnk.id)}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <div style={s.addRow}>
                <input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  style={
                    {
                      ...s.input,
                      flex: 1,
                      padding: "7px 10px",
                    } as CSSProperties
                  }
                  placeholder="Paste URL and press Enter…"
                  disabled={fetching}
                />
                <button style={s.addBtn} onClick={addLink} disabled={fetching}>
                  {fetching ? (
                    <Loader
                      size={13}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    <Plus size={13} />
                  )}
                </button>
              </div>
            </div>
          </Field>
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button style={s.saveBtn} onClick={save} disabled={false}>
            {isEdit ? "Save changes" : "Add card"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .modal-enter { animation: modalIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}

function Field({ label, children, style }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <label
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    backdropFilter: "blur(3px)",
  },
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    width: 560,
    maxWidth: "95vw",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  heading: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    color: "var(--text)",
    letterSpacing: "0.04em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    padding: 4,
    display: "flex",
    alignItems: "center",
    borderRadius: 4,
    cursor: "pointer",
  },
  archiveBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    borderRadius: "var(--radius)",
    padding: "4px 10px",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    cursor: "pointer",
  },
  body: {
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
    flex: 1,
  },
  input: {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "9px 12px",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    width: "100%",
  },
  pills: { display: "flex", gap: 6, flexWrap: "wrap" },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    borderRadius: 20,
    border: "1px solid",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    cursor: "pointer",
    transition: "all 0.12s",
  },
  dot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  dueDateRow: { display: "flex", alignItems: "center", gap: 10 },
  dueLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  clearDue: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    padding: 2,
  },
  subList: { display: "flex", flexDirection: "column", gap: 5 },
  subRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "5px 8px",
    borderRadius: "var(--radius)",
    background: "var(--elevated)",
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    border: "1.5px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    transition: "all 0.12s",
  },
  subTitle: { flex: 1, fontSize: 13, transition: "all 0.15s" },
  addRow: { display: "flex", gap: 6, marginTop: 2 },
  addBtn: {
    background: "var(--jade-glow)",
    border: "1px solid var(--jade)",
    borderRadius: "var(--radius)",
    color: "var(--jade)",
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
    cursor: "pointer",
  },
  linkList: { display: "flex", flexDirection: "column", gap: 5 },
  linkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: "var(--radius)",
    background: "var(--elevated)",
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: "var(--text)",
    textDecoration: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "'DM Mono', monospace",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    padding: 3,
    borderRadius: 3,
    cursor: "pointer",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "13px 20px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  cancelBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    borderRadius: "var(--radius)",
    padding: "7px 15px",
    fontSize: 13,
    cursor: "pointer",
  },
  saveBtn: {
    background: "var(--jade)",
    color: "#0D1A13",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "7px 17px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Mono', monospace",
    cursor: "pointer",
  },
};
