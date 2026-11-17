'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BrandText } from './BrandIcon';

export type QA = [string, string];

export default function Faq({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="hx-faq">
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div className="hx-q" data-open={isOpen} key={q}>
            <h3 style={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
              <button type="button" aria-expanded={isOpen} aria-controls={`hx-a-${i}`} id={`hx-q-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span>{q}</span>
                <span className="pm" aria-hidden="true"><Plus size={17} /></span>
              </button>
            </h3>
            <div className="hx-q-body" id={`hx-a-${i}`} role="region" aria-labelledby={`hx-q-${i}`}>
              <div><p><BrandText text={a} /></p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
