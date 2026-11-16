// Small illustrations for the template picker and the hero of the three book-store templates.
// Decorative only (aria-hidden by the caller). Colours follow the template, not the site accent.
export default function BookTemplateArt({template}){
 if(template==='editorial')return <svg viewBox="0 0 480 380" fill="none" role="img" aria-label="">
  <rect width="480" height="380" fill="#f6f1e7"/><rect x="28" y="26" width="424" height="3" fill="#1d1a16"/><rect x="28" y="34" width="424" height="1" fill="#1d1a16"/>
  <rect x="28" y="70" width="250" height="26" fill="#1d1a16"/><rect x="28" y="108" width="190" height="26" fill="#1d1a16"/><rect x="28" y="156" width="230" height="7" fill="#8a8173"/><rect x="28" y="172" width="210" height="7" fill="#8a8173"/><rect x="28" y="188" width="170" height="7" fill="#8a8173"/>
  <rect x="300" y="60" width="150" height="214" fill="#9a3b2e"/><rect x="316" y="84" width="118" height="8" fill="#f6f1e7"/><rect x="316" y="102" width="86" height="8" fill="#f6f1e7"/><circle cx="375" cy="198" r="34" stroke="#f6f1e7" strokeWidth="3"/>
  <rect x="28" y="232" width="250" height="1" fill="#1d1a16"/><rect x="28" y="248" width="60" height="86" fill="#d9cdb8"/><rect x="98" y="248" width="60" height="86" fill="#c9b99e"/><rect x="168" y="248" width="60" height="86" fill="#9a3b2e"/><rect x="238" y="248" width="40" height="86" fill="#1d1a16"/>
 </svg>;
 if(template==='commerce')return <svg viewBox="0 0 480 380" fill="none" role="img" aria-label="">
  <rect width="480" height="380" fill="#f2f7f6"/><rect x="24" y="22" width="432" height="34" rx="8" fill="#ffffff" stroke="#c9dedb"/><rect x="40" y="34" width="130" height="10" rx="5" fill="#0f766e"/><rect x="352" y="32" width="86" height="14" rx="7" fill="#c9dedb"/>
  <rect x="24" y="72" width="432" height="96" rx="14" fill="#0f766e"/><rect x="48" y="96" width="180" height="16" rx="4" fill="#ffffff"/><rect x="48" y="122" width="120" height="10" rx="5" fill="#9bd5cd"/><rect x="340" y="92" width="96" height="56" rx="10" fill="#ffffff" opacity=".18"/>
  <g><rect x="24" y="186" width="100" height="170" rx="10" fill="#fff" stroke="#c9dedb"/><rect x="34" y="196" width="80" height="86" rx="6" fill="#bfe3de"/><rect x="34" y="292" width="64" height="8" rx="4" fill="#0f766e"/><rect x="34" y="310" width="40" height="8" rx="4" fill="#9db7b3"/><rect x="34" y="330" width="80" height="16" rx="8" fill="#0f766e"/></g>
  <g><rect x="136" y="186" width="100" height="170" rx="10" fill="#fff" stroke="#c9dedb"/><rect x="146" y="196" width="80" height="86" rx="6" fill="#f3d9b8"/><rect x="146" y="292" width="64" height="8" rx="4" fill="#0f766e"/><rect x="146" y="310" width="40" height="8" rx="4" fill="#9db7b3"/><rect x="146" y="330" width="80" height="16" rx="8" fill="#0f766e"/></g>
  <g><rect x="248" y="186" width="100" height="170" rx="10" fill="#fff" stroke="#c9dedb"/><rect x="258" y="196" width="80" height="86" rx="6" fill="#d8d3f2"/><rect x="258" y="292" width="64" height="8" rx="4" fill="#0f766e"/><rect x="258" y="310" width="40" height="8" rx="4" fill="#9db7b3"/><rect x="258" y="330" width="80" height="16" rx="8" fill="#0f766e"/></g>
  <g><rect x="360" y="186" width="96" height="170" rx="10" fill="#fff" stroke="#c9dedb"/><rect x="370" y="196" width="76" height="86" rx="6" fill="#f0c9c9"/><rect x="370" y="292" width="60" height="8" rx="4" fill="#0f766e"/><rect x="370" y="330" width="76" height="16" rx="8" fill="#0f766e"/></g>
 </svg>;
 return <svg viewBox="0 0 480 380" fill="none" role="img" aria-label="">
  <defs><radialGradient id="cin-glow" cx="50%" cy="46%" r="55%"><stop offset="0" stopColor="#f5b942" stopOpacity=".45"/><stop offset="1" stopColor="#0b0c10" stopOpacity="0"/></radialGradient></defs>
  <rect width="480" height="380" fill="#0b0c10"/><rect width="480" height="380" fill="url(#cin-glow)"/>
  <rect x="0" y="0" width="480" height="26" fill="#000"/><rect x="0" y="354" width="480" height="26" fill="#000"/>
  <g transform="translate(240 190) rotate(-8) skewY(-3)"><rect x="-70" y="-108" width="140" height="206" rx="4" fill="#f5b942"/><rect x="-70" y="-108" width="14" height="206" fill="#c98f1f"/><rect x="-40" y="-76" width="96" height="10" fill="#0b0c10"/><rect x="-40" y="-56" width="64" height="10" fill="#0b0c10"/><circle cx="6" cy="34" r="30" stroke="#0b0c10" strokeWidth="4"/></g>
  <ellipse cx="240" cy="326" rx="86" ry="10" fill="#000" opacity=".6"/>
 </svg>;
}
