'use client';
import {MessageCircle} from 'lucide-react';
import {useI18n} from './i18n/I18nProvider';
export default function ChatLaunch(){const {t}=useI18n();return <button className="button cinematic-secondary" onClick={()=>window.dispatchEvent(new Event('delsa:open-chat'))}>{t('دریافت مشاوره')} <MessageCircle size={17}/></button>}
