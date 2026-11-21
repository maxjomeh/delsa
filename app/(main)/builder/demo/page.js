import '../../../home.css';
import '../../../pages.css';
import {getI18n,loadMessages} from '../../../../lib/i18n/server';
import {I18nProvider} from '../../../../components/i18n/I18nProvider';
import BuilderDemo from '../../../../components/BuilderDemo';

export default async function DesignerDemo(){
 const {locale,messages}=await getI18n();
 // The editor UI runs on the "builder" dictionary (editor + site strings); the sample site's copy comes from "site".
 const builder=await loadMessages(locale,'builder'),siteMessages=await loadMessages(locale,'site');
 return <I18nProvider locale={locale} messages={{...messages,...builder}}><BuilderDemo siteMessages={locale==='fa'?null:siteMessages}/></I18nProvider>;
}
