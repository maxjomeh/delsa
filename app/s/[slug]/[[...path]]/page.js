import {notFound} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/server';
import {normalizeDocument} from '../../../../lib/site-builder';
import BuilderSiteView from '../../../../components/BuilderSiteView';
export const dynamic='force-dynamic';
async function read(params){const {slug,path=[]}=await params;if(!/^[a-z0-9][a-z0-9-]{2,47}$/.test(slug)||path.length>1)return null;const db=await createClient();const {data}=await db.from('builder_publications').select('name,slug,document').eq('slug',slug).eq('is_live',true).maybeSingle();if(!data)return null;const doc=normalizeDocument(data.document);if(!doc.pages.some(p=>p.slug===(path[0]||'')))return null;return {...data,document:doc,pageSlug:path[0]||''}}
export async function generateMetadata({params}){const s=await read(params);return {title:s?.name||'سایت یافت نشد',description:s?.document.description||undefined,robots:{index:Boolean(s),follow:Boolean(s)}}}
export default async function PublicSite({params}){const s=await read(params);if(!s)notFound();return <BuilderSiteView name={s.name} document={s.document} pageSlug={s.pageSlug} base={`/s/${s.slug}`}/>}
