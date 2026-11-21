import '../../../home.css';
import '../../../pages.css';
import {getI18n,loadMessages} from '../../../../lib/i18n/server';
import {I18nProvider} from '../../../../components/i18n/I18nProvider';
import BuilderDemo from '../../../../components/BuilderDemo';

export default async function DesignerDemo(){
 const {locale,messages}=await getI18n();
 // The editor's own strings live in the "editor" dictionary; the sample site's copy in the "site" one.
 const editor=await loadMessages(locale,'editor'),siteMessages=await loadMessages(locale,'site');
 return <I18nProvider locale={locale} messages={{...messages,...editor}}><BuilderDemo siteMessages={locale==='fa'?null:siteMessages}/></I18nProvider>;
}
