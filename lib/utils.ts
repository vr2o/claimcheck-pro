import type { NextRequest } from 'next/server';
export function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }
export function getClientIp(req: NextRequest) { return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || '0.0.0.0'; }
export function monthKey(date = new Date()){ return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`; }
export function secondsUntilMonthEnd(d=new Date()){ const y=d.getUTCFullYear(); const m=d.getUTCMonth(); const end=new Date(Date.UTC(y, m+1, 1)); return Math.max(60, Math.floor((end.getTime()-d.getTime())/1000)); }
