import React from 'react';
import ReasonerAssertionRow from './ReasonerAssertionRow';
import { relLocal } from './reasonerFormat';

const REL_ORDER = ['includedIn', 'contradicts', 'implies', 'allows', 'compatible', 'missing'];

export default function ReasonerAssertionPreview({ assertions, onChange }) {
  const groupsMap = new Map();
  assertions.forEach((a, i) => {
    const rel = relLocal(a.relation);
    if (!groupsMap.has(rel)) groupsMap.set(rel, []);
    groupsMap.get(rel).push({ a, i });
  });
  const groups = [...groupsMap.entries()].sort((x, y) => {
    const ix = REL_ORDER.indexOf(x[0]);
    const iy = REL_ORDER.indexOf(y[0]);
    return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy) || x[0].localeCompare(y[0]);
  });

  const reverseAt = (i) =>
    onChange((prev) => prev.map((x, idx) => idx === i
      ? { ...x, subject: x.object, object: x.subject, subjectRole: x.objectRole, objectRole: x.subjectRole }
      : x));
  const deleteAt = (i) => onChange((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-lg border border-border bg-background/40 max-h-[560px] overflow-y-auto divide-y divide-border">
      {groups.map(([rel, items]) => (
        <section key={rel}>
          <div className="px-3 py-1.5 bg-muted/30 sticky top-0 backdrop-blur-sm">
            <span className="text-xs font-semibold text-foreground font-mono">
              openrel:{rel}
            </span>
            <span className="text-[11px] text-muted-foreground ml-2">({items.length})</span>
          </div>
          <div className="divide-y divide-border/60">
            {items.map(({ a, i }) => (
              <ReasonerAssertionRow
                key={`${a.subject}-${a.relation}-${a.object}-${i}`}
                assertion={a}
                onReverse={() => reverseAt(i)}
                onDelete={() => deleteAt(i)}
              />
            ))}
          </div>
        </section>
      ))}
      {!assertions.length && (
        <div className="px-3 py-4 text-xs text-muted-foreground italic">No assertions.</div>
      )}
    </div>
  );
}