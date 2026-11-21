// Only bounded, typed design values reach CSS. Old documents keep their layout.
const numeric={paddingTop:[0,240],paddingBottom:[0,240],paddingX:[0,160],gap:[0,80],radius:[0,80],titleSize:[16,100],bodySize:[10,32],minHeight:[0,800],maxWidth:[280,1800],span:[1,4],featureColumns:[1,4]};
export function normalizeDesign(value){const v=value&&typeof value==='object'?value:{},out={};for(const [key,[min,max]]of Object.entries(numeric)){if(v[key]!==undefined&&Number.isFinite(Number(v[key])))out[key]=Math.round(Math.min(max,Math.max(min,Number(v[key]))))}for(const key of ['background','textColor'])if(/^#[a-f\d]{6}$/i.test(v[key]||''))out[key]=v[key];if(['right','center','left'].includes(v.align))out.align=v.align;if(typeof v.hiddenDesktop==='boolean')out.hiddenDesktop=v.hiddenDesktop;if(typeof v.hiddenMobile==='boolean')out.hiddenMobile=v.hiddenMobile;return out}
export function blockDesignVars(style={},mobile={}){const output={};const names={paddingTop:'top',paddingBottom:'bottom',paddingX:'x',gap:'gap',radius:'radius',titleSize:'title',bodySize:'body',minHeight:'height',maxWidth:'width',span:'span',featureColumns:'features',background:'background',textColor:'color',align:'align'};for(const [prefix,v]of [['',normalizeDesign(style)],['mobile-',normalizeDesign(mobile)]])for(const [key,value]of Object.entries(v)){if(!names[key])continue;output['--block-'+prefix+names[key]]=typeof value==='number'&&!['span','featureColumns'].includes(key)?value+'px':value}return output}
export function reorderBlock(blocks,source,target){const from=blocks.findIndex(b=>b.id===source),to=blocks.findIndex(b=>b.id===target);if(from<0||to<0||from===to)return blocks;const next=[...blocks],item=next.splice(from,1)[0];next.splice(to,0,item);return next}

export function blockDesignAttributes(style={},mobile={}){const output={};const names={paddingTop:'top',paddingBottom:'bottom',paddingX:'x',gap:'gap',radius:'radius',titleSize:'title',bodySize:'body',minHeight:'height',maxWidth:'width',featureColumns:'features',background:'background',textColor:'color',align:'align'};for(const [prefix,v]of [['design',normalizeDesign(style)],['mobile',normalizeDesign(mobile)]])for(const key of Object.keys(v))if(names[key])output['data-'+prefix+'-'+names[key]]='true';return output}

// Customer accent -> {fill, text}: text is white or near-black, whichever reads better. When even the better one is
// under 4.5:1 (WCAG AA), the fill is nudged just far enough toward black/white; otherwise the colour is untouched.
const lin=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const lum=c=>.2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2]);
const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
const DARK=[23,18,15],WHITE=[255,255,255],toHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export function accentPair(hex){
 const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||''));
 if(!m)return {fill:'#7c3aed',text:'#ffffff'};
 const n=parseInt(m[1],16);let c=[n>>16&255,n>>8&255,n&255];
 const useWhite=ratio(lum(c),lum(WHITE))>=ratio(lum(c),lum(DARK)),text=useWhite?WHITE:DARK,target=useWhite?[0,0,0]:[255,255,255];
 let t=0;
 while(ratio(lum(c),lum(text))<4.5&&t<1){t+=.02;c=[0,1,2].map(i=>(n>>[16,8,0][i]&255)*(1-t)+target[i]*t)}
 return {fill:toHex(c),text:toHex(text)};
}
export const onAccent=hex=>accentPair(hex).text;
