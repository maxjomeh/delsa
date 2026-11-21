'use client';
import { I18nProvider } from './I18nProvider';

// Areas that are not translated yet (CRM, site-builder editor, internal dev tools) stay Persian and
// right-to-left even when the surrounding panel is in another language.
export default function PersianIsland({ children, className }) {
  return (
    <div dir="rtl" lang="fa" className={className}>
      <I18nProvider locale="fa" messages={{}}>{children}</I18nProvider>
    </div>
  );
}
