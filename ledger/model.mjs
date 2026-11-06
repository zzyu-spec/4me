export const dateValid = value => {if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;};
export function validate(entry) {
  if (!entry || !/^[A-Za-z0-9][\w-]{0,79}$/.test(entry.id||'') || ['constructor','prototype'].includes(entry.id) || !dateValid(entry.date) || !['expense','income','transfer'].includes(entry.kind) || !Number.isSafeInteger(entry.amount) || entry.amount<1 || entry.amount>1000000000000 || !Number.isSafeInteger(entry.revision) || entry.revision<0 || typeof entry.deleted!=='boolean') throw Error('날짜·금액·기록 형식을 확인해 주세요.');
  for(const key of ['title','category','payment','toPayment','note','updatedAt']) if(typeof entry[key]!=='string' || entry[key].length>(key==='note'?2000:120)) throw Error('기록 내용이 너무 길거나 형식이 맞지 않아요.');
  if(!entry.title.trim() || !entry.payment.trim() || (entry.kind==='transfer' && (!entry.toPayment.trim()||entry.payment===entry.toPayment))) throw Error('사용처와 결제수단을 확인해 주세요. 이체는 서로 다른 수단을 선택해 주세요.');
  return entry;
}
export function totals(items) {return items.filter(x=>!x.deleted).reduce((s,x)=>{if(x.kind==='income')s.income+=x.amount;if(x.kind==='expense')s.expense+=x.amount;return s},{income:0,expense:0});}
export const won = value => new Intl.NumberFormat('ko-KR').format(value)+'원';
export const visible = (items,month,kind='all',search='') => items.filter(x=>!x.deleted&&x.date.startsWith(month)&&(kind==='all'||x.kind===kind)&&[x.title,x.note,x.category,x.payment,x.toPayment].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
export const localDate = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
