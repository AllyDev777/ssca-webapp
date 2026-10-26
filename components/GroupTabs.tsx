"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "./GroupTabs.module.css";

export type GroupTab = { key: string; label: string; badge?: string; complete?: boolean };

type Props = {
  tabs: GroupTab[];
  active: string;
  onChange: (key: string) => void;
  /** Prefix for tab/panel ids; panels must use `${idPrefix}-panel-${key}`. */
  idPrefix: string;
  label: string;
};

export const tabId = (prefix: string, key: string) => `${prefix}-tab-${key}`;
export const panelId = (prefix: string, key: string) => `${prefix}-panel-${key}`;

/** Wrapping tab strip (WAI-ARIA tabs: arrow keys, Home/End, roving tabindex). */
export function GroupTabs({ tabs, active, onChange, idPrefix, label }: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    const key = tabs[next]!.key;
    onChange(key);
    refs.current.get(key)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((tab, i) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) refs.current.set(tab.key, el);
              else refs.current.delete(tab.key);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.key)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.key)}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            data-complete={tab.complete || undefined}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span>{tab.label}</span>
            {tab.badge && <span className={`${styles.badge} num`}>{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
