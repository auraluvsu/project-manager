import { useState, ReactNode, CSSProperties } from "react";
import {
  Plus,
  Trash2,
  CheckSquare,
  List,
  Hash,
  Pencil,
  Check,
} from "lucide-react";

interface ListItem {
  id: string;
  text: string;
  done: boolean;
}

interface TaskList {
  id: string;
  name: string;
  type: "checkbox" | "bullet" | "numeric";
  items: ListItem[];
}

interface TypeMetaItem {
  icon: ReactNode;
  label: string;
}

const TYPE_META: Record<string, TypeMetaItem> = {
  checkbox: { icon: <CheckSquare size={13} />, label: "Checklist" },
  bullet: { icon: <List size={13} />, label: "Bullet" },
  numeric: { icon: <Hash size={13} />, label: "Numbered" },
};

const SEED_LISTS: TaskList[] = [
  {
    id: "1",
    name: "Reading list",
    type: "bullet",
    items: [
      { id: "a", text: "The Art of Problem Solving", done: false },
      { id: "b", text: "Options, Futures and Other Derivatives", done: false },
    ],
  },
  {
    id: "2",
    name: "Dev setup checklist",
    type: "checkbox",
    items: [
      { id: "c", text: "Neovim LSP configured", done: true },
      { id: "d", text: "clangd + compile_commands.json", done: true },
      { id: "e", text: "Hyprland keybinds documented", done: false },
    ],
  },
];

export default function ListsPage() {
  const [lists, setLists] = useState<TaskList[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lists") || "") || [];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState(SEED_LISTS[0].id);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<
    "checkbox" | "bullet" | "numeric"
  >("checkbox");
  const [creating, setCreating] = useState(false);
  const [newItem, setNewItem] = useState("");

  const persist = (updated: TaskList[]): void => {
    setLists(updated);
    localStorage.setItem("lists", JSON.stringify(updated));
  };

  const active = lists.find((l) => l.id === activeId);

  const addList = (): void => {
    if (!newListName.trim()) return;
    const l: TaskList = {
      id: crypto.randomUUID(),
      name: newListName.trim(),
      type: newListType,
      items: [],
    };
    persist([...lists, l]);
    setActiveId(l.id);
    setNewListName("");
    setCreating(false);
  };

  const deleteList = (id: string): void => {
    const updated = lists.filter((l) => l.id !== id);
    persist(updated);
    if (activeId === id) setActiveId(updated[0]?.id || "");
  };

  const updateActive = (fn: (list: TaskList) => TaskList): void => {
    persist(lists.map((l) => (l.id === activeId ? fn(l) : l)));
  };

  const addItem = (): void => {
    if (!newItem.trim()) return;
    updateActive((l) => ({
      ...l,
      items: [
        ...l.items,
        { id: crypto.randomUUID(), text: newItem.trim(), done: false },
      ],
    }));
    setNewItem("");
  };

  const toggleItem = (itemId: string): void => {
    updateActive((l) => ({
      ...l,
      items: l.items.map((i) =>
        i.id === itemId ? { ...i, done: !i.done } : i,
      ),
    }));
  };

  const deleteItem = (itemId: string): void => {
    updateActive((l) => ({
      ...l,
      items: l.items.filter((i) => i.id !== itemId),
    }));
  };

  const renameItem = (itemId: string, text: string): void => {
    updateActive((l) => ({
      ...l,
      items: l.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
    }));
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.sideHeader}>
          <span style={styles.sideTitle}>Lists</span>
          <button
            style={styles.iconBtn}
            onClick={() => setCreating(!creating)}
            title="New list"
          >
            <Plus size={14} />
          </button>
        </div>

        {creating && (
          <div style={styles.newListForm}>
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addList();
                if (e.key === "Escape") setCreating(false);
              }}
              style={styles.input}
              placeholder="List name…"
            />
            <div style={styles.typeRow}>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() =>
                    setNewListType(k as "checkbox" | "bullet" | "numeric")
                  }
                  style={{
                    ...styles.typePill,
                    borderColor:
                      newListType === k ? "var(--jade)" : "var(--border)",
                    color: newListType === k ? "var(--jade)" : "var(--muted)",
                  }}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={styles.saveBtn} onClick={addList}>
                Create
              </button>
              <button
                style={styles.cancelBtn}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={styles.listItems}>
          {lists.map((l) => (
            <div
              key={l.id}
              onClick={() => setActiveId(l.id)}
              style={{
                ...styles.sideItem,
                background:
                  activeId === l.id ? "var(--jade-glow)" : "transparent",
                color: activeId === l.id ? "var(--jade)" : "var(--text)",
                borderLeft:
                  activeId === l.id
                    ? "2px solid var(--jade)"
                    : "2px solid transparent",
              }}
            >
              <span style={styles.sideItemIcon}>{TYPE_META[l.type]?.icon}</span>
              <span style={styles.sideItemName}>{l.name}</span>
              <span style={styles.sideItemCount}>{l.items.length}</span>
              <button
                style={{
                  ...styles.iconBtn,
                  opacity: 0,
                  ...(activeId === l.id ? { opacity: 1 } : {}),
                }}
                className="del-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteList(l.id);
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main style={styles.main}>
        {active ? (
          <>
            <div style={styles.mainHeader}>
              <div style={styles.mainTitleRow}>
                <span style={styles.mainTypeIcon}>
                  {TYPE_META[active.type]?.icon}
                </span>
                <h2 style={styles.mainTitle}>{active.name}</h2>
                <span style={styles.mainMeta}>
                  {TYPE_META[active.type]?.label}
                </span>
              </div>
              <span style={styles.mainCount}>
                {active.type === "checkbox"
                  ? `${active.items.filter((i) => i.done).length} / ${active.items.length} done`
                  : `${active.items.length} item${active.items.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            <div style={styles.itemList}>
              {active.items.map((item, idx) => (
                <ListItemComponent
                  key={item.id}
                  item={item}
                  index={idx}
                  type={active.type}
                  onToggle={() => toggleItem(item.id)}
                  onDelete={() => deleteItem(item.id)}
                  onRename={(text) => renameItem(item.id, text)}
                />
              ))}

              <div style={styles.addItemRow}>
                <span style={styles.addItemPrefix}>
                  {active.type === "checkbox"
                    ? "☐"
                    : active.type === "numeric"
                      ? `${active.items.length + 1}.`
                      : "•"}
                </span>
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  style={styles.addItemInput}
                  placeholder="Add item…"
                />
                {newItem && (
                  <button style={styles.addItemBtn} onClick={addItem}>
                    <Plus size={13} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={styles.empty}>
            <List size={32} color="var(--faint)" />
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              No lists yet. Create one.
            </p>
          </div>
        )}
      </main>

      <style>{`
        .side-item:hover .del-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

interface ListItemComponentProps {
  item: ListItem;
  index: number;
  type: "checkbox" | "bullet" | "numeric";
  onToggle: () => void;
  onDelete: () => void;
  onRename: (text: string) => void;
}

function ListItemComponent({
  item,
  index,
  type,
  onToggle,
  onDelete,
  onRename,
}: ListItemComponentProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.text);
  const [hover, setHover] = useState(false);

  const commit = (): void => {
    if (val.trim()) onRename(val.trim());
    else setVal(item.text);
    setEditing(false);
  };

  const prefix =
    type === "checkbox" ? (
      <CheckBoxComponent done={item.done} onToggle={onToggle} />
    ) : type === "numeric" ? (
      <span style={styles.numPrefix}>{index + 1}.</span>
    ) : (
      <span style={styles.bulletPrefix}>•</span>
    );

  return (
    <div
      style={{
        ...styles.itemRow,
        opacity: item.done && type !== "checkbox" ? 0.5 : 1,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {prefix}
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setVal(item.text);
              setEditing(false);
            }
          }}
          style={styles.editInput}
        />
      ) : (
        <span
          style={{
            ...styles.itemText,
            textDecoration: item.done ? "line-through" : "none",
            color: item.done ? "var(--muted)" : "var(--text)",
          }}
          onDoubleClick={() => setEditing(true)}
        >
          {item.text}
        </span>
      )}
      {hover && !editing && (
        <div style={styles.itemActions}>
          <button style={styles.iconBtn} onClick={() => setEditing(true)}>
            <Pencil size={11} />
          </button>
          <button
            style={{ ...styles.iconBtn, color: "var(--urgent)" }}
            onClick={onDelete}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

interface CheckBoxComponentProps {
  done: boolean;
  onToggle: () => void;
}

function CheckBoxComponent({ done, onToggle }: CheckBoxComponentProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        ...styles.checkbox,
        background: done ? "var(--jade)" : "transparent",
        borderColor: done ? "var(--jade)" : "var(--faint)",
      }}
    >
      {done && <Check size={10} color="#0D1A13" strokeWidth={3} />}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid var(--border)",
  },
  sideTitle: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    padding: 4,
    borderRadius: 4,
    cursor: "pointer",
  },
  newListForm: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "8px 10px",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    width: "100%",
  },
  typeRow: { display: "flex", gap: 5, flexWrap: "wrap" },
  typePill: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    cursor: "pointer",
    background: "none",
  },
  saveBtn: {
    flex: 1,
    background: "var(--jade)",
    color: "#0D1A13",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "7px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Mono', monospace",
  },
  cancelBtn: {
    flex: 1,
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--muted)",
    padding: "7px",
    fontSize: 12,
    fontFamily: "'DM Mono', monospace",
  },
  listItems: { overflowY: "auto", flex: 1 },
  sideItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    cursor: "pointer",
    transition: "all 0.12s",
  },
  sideItemIcon: {
    color: "var(--muted)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  sideItemName: {
    flex: 1,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sideItemCount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: "var(--muted)",
  },
  main: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  mainHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottom: "1px solid var(--border)",
  },
  mainTitleRow: { display: "flex", alignItems: "center", gap: 10 },
  mainTypeIcon: { color: "var(--jade)", display: "flex", alignItems: "center" },
  mainTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  mainMeta: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "var(--muted)",
    background: "var(--elevated)",
    padding: "2px 8px",
    borderRadius: 10,
    border: "1px solid var(--border)",
  },
  mainCount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    color: "var(--muted)",
  },
  itemList: { display: "flex", flexDirection: "column", gap: 4, maxWidth: 600 },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    borderRadius: "var(--radius)",
    transition: "background 0.12s",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: "1.5px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  numPrefix: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    color: "var(--muted)",
    minWidth: 24,
    textAlign: "right",
  },
  bulletPrefix: {
    fontSize: 18,
    color: "var(--jade)",
    lineHeight: 1,
    flexShrink: 0,
  },
  itemText: { flex: 1, fontSize: 14, lineHeight: 1.4, transition: "all 0.15s" },
  editInput: {
    flex: 1,
    background: "var(--elevated)",
    border: "1px solid var(--jade)",
    borderRadius: 4,
    padding: "4px 8px",
    color: "var(--text)",
    fontSize: 14,
    outline: "none",
  },
  itemActions: { display: "flex", gap: 2 },
  addItemRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    marginTop: 4,
  },
  addItemPrefix: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    color: "var(--faint)",
    minWidth: 18,
  },
  addItemInput: {
    flex: 1,
    background: "none",
    border: "none",
    borderBottom: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 14,
    outline: "none",
    padding: "2px 0",
  },
  addItemBtn: {
    background: "var(--jade-glow)",
    border: "1px solid var(--jade)",
    borderRadius: 4,
    color: "var(--jade)",
    display: "flex",
    alignItems: "center",
    padding: "3px 8px",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
};
