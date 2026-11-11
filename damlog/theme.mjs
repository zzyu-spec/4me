export const THEME_KEY='damlog-appearance';
export const themePreference=value=>['system','light','dark'].includes(value)?value:'system';
export const effectiveTheme=(preference,systemDark)=>preference==='dark'||preference==='system'&&systemDark?'dark':'light';
export function initTheme(){
 const media=matchMedia('(prefers-color-scheme: dark)');let preference='system';try{preference=themePreference(localStorage.getItem(THEME_KEY))}catch{}
 function apply(){const resolved=effectiveTheme(preference,media.matches),dark=resolved==='dark';document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#171b16':'#f6f5f0');document.querySelectorAll('[data-theme-choice]').forEach(select=>select.value=preference);document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.setAttribute('aria-label',dark?'라이트 모드로 전환':'다크 모드로 전환');button.title=dark?'라이트 모드로 전환':'다크 모드로 전환';const label=button.querySelector('span');if(label)label.textContent=dark?'라이트':'다크';button.querySelector('use')?.setAttribute('href',dark?'#i-sun':'#i-moon')})}
 function choose(value){preference=themePreference(value);try{localStorage.setItem(THEME_KEY,preference)}catch{}apply()}
 document.querySelectorAll('[data-theme-choice]').forEach(select=>select.addEventListener('change',()=>choose(select.value)));
 document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',()=>choose(document.documentElement.dataset.theme==='dark'?'light':'dark')));
 media.addEventListener('change',()=>{if(preference==='system')apply()});window.addEventListener('storage',event=>{if(event.key===THEME_KEY||event.key===null){preference=themePreference(event.newValue);apply()}});apply();
}
