const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (n: number | string) => String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);
export const toman = (n: number) => n.toLocaleString('fa-IR');
