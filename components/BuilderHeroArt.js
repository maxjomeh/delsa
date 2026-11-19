// Decorative artwork of the current templates. The markup is the same for every template (seven shapes and a glyph);
// each template draws its own picture with CSS (components/templates-v2/<id>.css, selector [data-art="<id>"]).
export default function BuilderHeroArt({template,initial='د'}){
 return <div data-part="art" data-art={template} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><b>{initial}</b></div>;
}
// Page-wide ambient layer (blobs, rings, lines ...) drawn by each template.
export function BuilderDecor(){
 return <div data-part="decor" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>;
}
