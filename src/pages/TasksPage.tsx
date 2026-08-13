import {
  useState,
  useMemo,
  useRef,
  useEffect,
  CSSProperties,
  ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  SortableContextProps,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, Link, Layers, Palette, Archive } from "lucide-react";
import CardModal from "../components/CardModal";
import BackdropPicker, { BACKDROPS } from "../components/BackdropPicker";
import ArchiveDrawer from "../components/ArchiveDrawer";
import { getDueState, formatDue } from "../utils/dueDate";

interface Card {
  id: string;
  title: string;
  desc: string;
  status: "urgent" | "pressing" | "lenient";
  stage: "todo" | "inprogress" | "done";
  subcards: Array<{ id: string; text: string; done: boolean }>;
  links: Array<{ id: string; url: string; title: string }>;
  dueDate: string;
  archivedAt?: string;
}

interface ModalState {
  card?: Partial<Card>;
}

interface PrevStageRef {
  [cardId: string]: string;
}

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

interface StageMeta {
  label: string;
  accent: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  urgent: { label: "Urgent", color: "var(--urgent)", bg: "var(--urgent-bg)" },
  pressing: {
    label: "Pressing",
    color: "var(--pressing)",
    bg: "var(--pressing-bg)",
  },
  lenient: {
    label: "Lenient",
    color: "var(--lenient)",
    bg: "var(--lenient-bg)",
  },
};

const STAGE_META: Record<string, StageMeta> = {
  todo: { label: "Yet to Start", accent: "var(--faint)" },
  inprogress: { label: "Working On", accent: "var(--jade)" },
  done: { label: "Done", accent: "var(--jade-dark)" },
};

const STAGES = ["todo", "inprogress", "done"] as const;

const SEED: Card[] = [];

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}

export default function TasksPage() {
  const [cards, setCards] = useState<Card[]>(() => load("cards", SEED));
  const [archived, setArchived] = useState<Card[]>(() => load("archived", []));
  const [modal, setModal] = useState<ModalState | null>(null);
  const [backdropId, setBackdropId] = useState(() =>
    load("backdropId", "default"),
  );
  const [showBdrop, setShowBdrop] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [doneFlash, setDoneFlash] = useState<string | null>(null);
  const prevStageRef = useRef<PrevStageRef>({});

  const persist = (updated: Card[]): void => {
    setCards(updated);
    localStorage.setItem("cards", JSON.stringify(updated));
  };
  const persistAr = (updated: Card[]): void => {
    setArchived(updated);
    localStorage.setItem("archived", JSON.stringify(updated));
  };
  const persistBd = (id: string): void => {
    setBackdropId(id);
    localStorage.setItem("backdropId", JSON.stringify(id));
  };

  const saveCard = (card: Card): void => {
    const exists = cards.find((c) => c.id === card.id);
    persist(
      exists
        ? cards.map((c) => (c.id === card.id ? card : c))
        : [...cards, card],
    );
  };

  const deleteCard = (id: string): void => {
    persist(cards.filter((c) => c.id !== id));
  };

  const archiveCard = (id: string): void => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    persistAr([{ ...card, archivedAt: new Date().toISOString() }, ...archived]);
    persist(cards.filter((c) => c.id !== id));
  };

  const restoreCard = (id: string): void => {
    const card = archived.find((c) => c.id === id);
    if (!card) return;
    const { archivedAt, ...rest } = card;
    persist([...cards, rest]);
    persistAr(archived.filter((c) => c.id !== id));
  };

  const deleteArchived = (id: string): void =>
    persistAr(archived.filter((c) => c.id !== id));

  const backdrop = BACKDROPS.find((b) => b.id === backdropId) || BACKDROPS[0];

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (modal !== null) return;
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName))
        return;
      if (e.key === "/") {
        e.preventDefault();
        setModal({});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const cardsByStage = useMemo(() => {
    const m: Record<string, Card[]> = {};
    STAGES.forEach((s) => {
      m[s] = cards.filter((c) => c.stage === s);
    });
    return m;
  }, [cards]);

  const handleDragStart = ({ active }: DragStartEvent): void => {
    const card = cards.find((c) => c.id === active.id);
    setActiveCard(card || null);
    if (card) prevStageRef.current[card.id] = card.stage;
  };

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    setActiveCard(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const card = cards.find((c) => c.id === activeId);
    if (!card) return;

    const targetStage = STAGES.includes(overId as any)
      ? overId
      : (cards.find((c) => c.id === overId)?.stage ?? card.stage);

    let updated = cards.map((c) =>
      c.id === activeId ? { ...c, stage: targetStage as any } : c,
    );

    if (!STAGES.includes(overId as any)) {
      const stageCards = updated.filter((c) => c.stage === targetStage);
      const otherCards = updated.filter((c) => c.stage !== targetStage);
      const fromIdx = stageCards.findIndex((c) => c.id === activeId);
      const toIdx = stageCards.findIndex((c) => c.id === overId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const reordered = arrayMove(stageCards, fromIdx, toIdx);
        updated = [...otherCards, ...reordered];
      }
    }

    persist(updated);

    if (targetStage === "done" && prevStageRef.current[activeId] !== "done") {
      setDoneFlash(activeId);
      setTimeout(() => setDoneFlash(null), 800);
    }
  };

  return (
    <div style={{ ...s.page, ...backdrop.style }}>
      <style>{`
        @keyframes doneFlash {
          0%   { box-shadow: 0 0 0 0   rgba(61,170,122,0);    background: var(--elevated); }
          25%  { box-shadow: 0 0 0 6px rgba(61,170,122,0.35); background: rgba(61,170,122,0.18); }
          70%  { box-shadow: 0 0 0 10px rgba(61,170,122,0); }
          100% { box-shadow: 0 0 0 0   rgba(61,170,122,0);    background: var(--elevated); }
        }
        @keyframes drawerIn {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
        .done-flash  { animation: doneFlash 0.75s ease forwards; }
        .drawer-enter { animation: drawerIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      <div style={s.topRow}>
        <div style={s.titleArea}>
          <h1 style={s.pageTitle}>Cards</h1>
          <span style={s.count}>
            {cards.filter((c) => c.stage !== "done").length} active
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.iconBarBtn} onClick={() => setShowArchive(true)}>
            <Archive size={14} />
            Archive
            {archived.length > 0 && (
              <span style={s.archiveBadge}>{archived.length}</span>
            )}
          </button>
          <button style={s.iconBarBtn} onClick={() => setShowBdrop(true)}>
            <Palette size={14} /> Backdrop
          </button>
          <button style={s.addBtn} onClick={() => setModal({})}>
            <Plus size={14} /> New card
          </button>
        </div>
      </div>

      <div style={s.legend}>
        {Object.entries(STATUS_META).map(([k, v]) => (
          <div key={k} style={s.legendItem}>
            <span style={{ ...s.legendDot, background: v.color }} />
            <span style={s.legendLabel}>{v.label}</span>
          </div>
        ))}

        <div style={s.legendDivider} />

        {Object.entries(STAGE_META).map(([k, v]) => (
          <div key={k} style={s.legendItem}>
            <span style={{ ...s.legendBar, background: v.accent }} />
            <span style={s.legendLabel}>{v.label}</span>
          </div>
        ))}

        <div style={s.legendDivider} />

        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: "var(--urgent)" }} />
          <span style={s.legendLabel}>Due today / overdue</span>
        </div>
        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: "var(--pressing)" }} />
          <span style={s.legendLabel}>Due within 5 days</span>
        </div>
        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: "var(--lenient)" }} />
          <span style={s.legendLabel}>Due later</span>
        </div>

        <div
          style={{
            marginLeft: "auto",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "var(--faint)",
          }}
        >
          press / to quick-add
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={s.board}>
          {STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              cards={cardsByStage[stage] || []}
              doneFlash={doneFlash}
              onAdd={() => setModal({ card: { stage } })}
              onEdit={(card) => setModal({ card })}
              onDelete={deleteCard}
              onArchive={archiveCard}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard && <CardChip card={activeCard} overlay />}
        </DragOverlay>
      </DndContext>

      {modal !== null && (
        <CardModal
          card={modal.card}
          onSave={saveCard}
          onClose={() => setModal(null)}
          onArchive={archiveCard}
        />
      )}
      {showBdrop && (
        <BackdropPicker
          current={backdropId}
          onChange={persistBd}
          onClose={() => setShowBdrop(false)}
        />
      )}
      {showArchive && (
        <ArchiveDrawer
          archived={archived}
          onRestore={restoreCard}
          onDelete={deleteArchived}
          onClose={() => setShowArchive(false)}
        />
      )}
    </div>
  );
}

interface ColumnProps {
  stage: string;
  cards: Card[];
  doneFlash: string | null;
  onAdd: () => void;
  onEdit: (card: Card) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

function Column({
  stage,
  cards,
  doneFlash,
  onAdd,
  onEdit,
  onDelete,
  onArchive,
}: ColumnProps) {
  const meta = STAGE_META[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      style={{
        ...s.column,
        outline: isOver ? "1px solid var(--jade)" : "1px solid transparent",
        transition: "outline 0.1s",
      }}
    >
      <div style={{ ...s.colHeader, borderTopColor: meta.accent }}>
        <span style={s.colTitle}>{meta.label}</span>
        <span style={s.colCount}>{cards.length}</span>
      </div>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} style={s.cardList}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              flashing={doneFlash === card.id}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
            />
          ))}
          <button style={s.inlineAdd} onClick={onAdd}>
            <Plus size={12} /> Add card
          </button>
        </div>
      </SortableContext>
    </div>
  );
}

interface SortableCardProps {
  card: Card;
  flashing: boolean;
  onEdit: (card: Card) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

function SortableCard({
  card,
  flashing,
  onEdit,
  onDelete,
  onArchive,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <CardChip
        card={card}
        flashing={flashing}
        onEdit={onEdit}
        onDelete={onDelete}
        onArchive={onArchive}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
}

interface CardChipProps {
  card: Card;
  flashing?: boolean;
  onEdit?: (card: Card) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  dragListeners?: any;
  dragAttributes?: any;
  overlay?: boolean;
}

function CardChip({
  card,
  flashing,
  onEdit,
  onDelete,
  onArchive,
  dragListeners,
  dragAttributes,
  overlay,
}: CardChipProps) {
  const [hovered, setHovered] = useState(false);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  const sm = STATUS_META[card.status] || STATUS_META.lenient;
  const doneSubcards = (card.subcards || []).filter((s) => s.done).length;
  const totalSubcards = (card.subcards || []).length;
  const due = getDueState(card.dueDate);

  const handlePointerDown = (e: React.PointerEvent): void => {
    pointerDown.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: React.PointerEvent): void => {
    if (!onEdit || overlay) return;
    const dx = Math.abs(e.clientX - (pointerDown.current?.x ?? e.clientX));
    const dy = Math.abs(e.clientY - (pointerDown.current?.y ?? e.clientY));
    if (dx < 5 && dy < 5) onEdit(card);
  };

  return (
    <div
      className={flashing ? "done-flash" : ""}
      style={{
        ...s.card,
        borderLeftColor: sm.color,
        boxShadow: overlay
          ? "0 10px 28px rgba(0,0,0,0.55)"
          : hovered
            ? "0 2px 10px rgba(0,0,0,0.28)"
            : "none",
        cursor: overlay ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...dragListeners}
      {...dragAttributes}
    >
      <div style={s.cardTop}>
        <span style={{ ...s.badge, background: sm.bg, color: sm.color }}>
          {sm.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {due.state !== "none" && (
            <span
              title={`${formatDue(card.dueDate)} · ${due.label}`}
              style={{ ...s.dueDot, background: due.color }}
            />
          )}
          {hovered && !overlay && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <button
                title="Delete"
                style={{ ...s.iconBtn, color: "var(--urgent)", padding: 5 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(card.id);
                }}
              >
                <Trash2 size={14} />
              </button>
              <button
                title="Archive"
                style={{ ...s.iconBtn, color: "var(--jade)", padding: 5 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive?.(card.id);
                }}
              >
                <Archive size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <p style={s.cardTitle}>{card.title}</p>
      {card.desc && <p style={s.cardDesc}>{card.desc}</p>}

      {due.state !== "none" && (
        <div style={s.metaRow}>
          <span style={{ ...s.metaText, color: due.color }}>
            {formatDue(card.dueDate)}
          </span>
          <span style={{ ...s.metaText, color: "var(--faint)" }}>·</span>
          <span style={{ ...s.metaText, color: due.color }}>{due.label}</span>
        </div>
      )}

      {totalSubcards > 0 && (
        <div style={s.metaRow}>
          <Layers size={10} color="var(--muted)" />
          <span style={s.metaText}>
            {doneSubcards}/{totalSubcards}
          </span>
          <div style={s.progressTrack}>
            <div
              style={{
                ...s.progressFill,
                width: `${(doneSubcards / totalSubcards) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {(card.links || []).length > 0 && (
        <div style={s.metaRow}>
          <Link size={10} color="var(--muted)" />
          <span style={s.metaText}>
            {card.links.length} link{card.links.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    height: "calc(100vh - 52px)",
    overflow: "auto",
    backgroundAttachment: "fixed",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleArea: { display: "flex", alignItems: "baseline", gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: 600, color: "var(--text)" },
  count: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    color: "var(--muted)",
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "var(--jade)",
    color: "#0D1A13",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Mono', monospace",
    cursor: "pointer",
  },
  iconBarBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "var(--surface)",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "7px 12px",
    fontSize: 12,
    fontFamily: "'DM Mono', monospace",
    cursor: "pointer",
    position: "relative",
  },
  archiveBadge: {
    background: "var(--jade)",
    color: "#0D1A13",
    borderRadius: 10,
    padding: "1px 6px",
    fontSize: 10,
    fontWeight: 700,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "9px 16px",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  legendBar: { width: 12, height: 3, borderRadius: 2, flexShrink: 0 },
  legendLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "var(--muted)",
  },
  legendDivider: {
    width: 1,
    height: 14,
    background: "var(--border)",
    margin: "0 2px",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    flex: 1,
    minHeight: 0,
  },
  column: {
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  colHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "13px 16px",
    borderTop: "2px solid",
    borderBottom: "1px solid var(--border)",
  },
  colTitle: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "var(--text)",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },
  colCount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "var(--muted)",
  },
  cardList: {
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    flex: 1,
    minHeight: 60,
  },
  card: {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    transition: "box-shadow 0.15s",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 20,
  },
  badge: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "2px 7px",
    borderRadius: 10,
  },
  dueDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    flexShrink: 0,
    boxShadow: "0 0 4px currentColor",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text)",
    lineHeight: 1.4,
  },
  cardDesc: { fontSize: 12, color: "var(--muted)", lineHeight: 1.4 },
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
  metaRow: { display: "flex", alignItems: "center", gap: 5 },
  metaText: { fontFamily: "'DM Mono', monospace", fontSize: 10 },
  progressTrack: {
    flex: 1,
    height: 3,
    background: "var(--border)",
    borderRadius: 2,
    overflow: "hidden",
    maxWidth: 56,
  },
  progressFill: {
    height: "100%",
    background: "var(--jade)",
    borderRadius: 2,
    transition: "width 0.2s",
  },
  inlineAdd: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    background: "none",
    border: "1px dashed var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--faint)",
    padding: "7px",
    fontSize: 12,
    fontFamily: "'DM Mono', monospace",
    width: "100%",
    cursor: "pointer",
  },
};
