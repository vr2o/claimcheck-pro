'use client';
const langs = ['en','es','pt','fr'];
export default function LanguageSelector({ value, onChange }:{ value:string; onChange:(v:string)=>void}) {
  return (
    <select className="border rounded px-2 py-1" value={value} onChange={(e)=>onChange(e.target.value)}>
      {langs.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
    </select>
  );
}
