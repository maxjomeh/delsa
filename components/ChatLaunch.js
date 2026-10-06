'use client';
import {MessageCircle} from 'lucide-react';
export default function ChatLaunch(){return <button className="button cinematic-secondary" onClick={()=>window.dispatchEvent(new Event('delsa:open-chat'))}>دریافت مشاوره <MessageCircle size={17}/></button>}
