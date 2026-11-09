import {useEffect,useState} from 'react';
const current=()=>({pathname:window.location.pathname.replace(/\/$/,'')||'/',search:window.location.search});
export function useRoute(){
 const [route,setRoute]=useState(current);
 useEffect(()=>{const back=()=>setRoute(current());window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
 const navigate=path=>{if(path!==location.pathname+location.search)history.pushState(null,'',path);setRoute(current());window.scrollTo(0,0);};
 const link=path=>e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(path);};
 return {route,navigate,link};
}
