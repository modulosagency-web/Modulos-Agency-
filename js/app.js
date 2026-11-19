import {auth,db,onAuthStateChanged,signOut,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendEmailVerification,ref,runTransaction,push,set,get,child,update,onValue} from './firebase-config.js';
const ADMIN='admin@modulos.in',$=s=>document.querySelector(s),page=document.body.dataset.page;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,ok=true)=>{const t=$('#toast');t.textContent=m;t.className='show'+(ok?'':' err');setTimeout(()=>t.className='',3800)};
const when=t=>new Date(t).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
const cls=s=>s==='resolved'?'done':s==='in-progress'?'progress':'';
const emsg=c=>({'auth/invalid-credential':'Wrong email or password.','auth/email-already-in-use':'Email already registered. Please login.','auth/weak-password':'Password must be 6+ characters.','auth/too-many-requests':'Too many attempts. Try again later.'}[c]||'Something went wrong. Try again.');
let user=null;

$('#menuBtn')?.addEventListener('click',()=>$('#nav').classList.toggle('open'));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Visitor counter (once per browser session)
if(page!=='admin'&&!sessionStorage.getItem('mv')){sessionStorage.setItem('mv','1');runTransaction(ref(db,'stats/visitors'),v=>(v||0)+1).catch(()=>{})}

const nextUrl=()=>{const n=new URLSearchParams(location.search).get('next')||'';return /^[\w-]+\.html(\?[\w=&-]*)?(#[\w-]+)?$/.test(n)?n:'dashboard.html'};

onAuthStateChanged(auth,u=>{
  user=u;const b=$('#authBtn'),adm=u&&u.email===ADMIN;
  if(b){b.textContent=u?(adm?'Admin':'Dashboard'):'Sign Up / Login';b.href=u?(adm?'admin.html':'dashboard.html'):'login.html'}
  if(page==='login')loginState(u);
  if(page==='dashboard')u?initDash(u):location.replace('login.html?next='+encodeURIComponent('dashboard.html'+location.search));
  if(page==='admin')initAdmin(u);
});
document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{await signOut(auth);location.href='index.html'}));

// ---------- Contact form (login + verified email required) ----------
const cf=$('#contactForm');
cf?.addEventListener('submit',async e=>{
  e.preventDefault();if(cf.website.value)return;
  if(!user){toast('Please sign in to send a message.',false);return setTimeout(()=>location.href='login.html?next='+encodeURIComponent('index.html#contact'),1200)}
  await user.reload();
  if(!user.emailVerified){toast('Please verify your email first.',false);return setTimeout(()=>location.href='dashboard.html',1200)}
  await user.getIdToken(true);
  const btn=cf.querySelector('button');btn.disabled=true;
  try{
    await set(push(ref(db,'contacts')),{uid:user.uid,email:user.email,name:cf.name.value.trim().slice(0,100),phone:cf.phone.value.trim().slice(0,30),message:cf.message.value.trim().slice(0,2000),createdAt:Date.now()});
    cf.reset();toast('Message sent! We will reply by email within 24 hours.');
  }catch(err){console.error(err);toast('Could not send: '+(err.code||err.message),false)}
  btn.disabled=false;
});

// ---------- Login / Register / Email verification ----------
function loginState(u){
  const v=$('#vbox'),f=$('#fbox');
  if(!u){v.hidden=true;f.hidden=false;return}
  if(u.emailVerified){location.replace(u.email===ADMIN?'admin.html':nextUrl());return}
  f.hidden=true;v.hidden=false;$('#vmail').textContent=u.email;
}
const af=$('#authForm');
if(af){
  let mode='login';
  document.querySelectorAll('.tabs button[data-m]').forEach(b=>b.addEventListener('click',()=>{
    mode=b.dataset.m;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
    $('#nameRow').hidden=mode!=='register';$('#authSubmit').textContent=mode==='register'?'Create account':'Sign in';
  }));
  af.addEventListener('submit',async e=>{
    e.preventDefault();const btn=$('#authSubmit');btn.disabled=true;
    try{
      if(mode==='register'){
        const c=await createUserWithEmailAndPassword(auth,af.email.value.trim(),af.password.value);
        await set(ref(db,'users/'+c.user.uid),{name:af.name.value.trim().slice(0,100),email:c.user.email,createdAt:Date.now()});
        await sendEmailVerification(c.user);toast('Verification link sent to your email.');
      }else await signInWithEmailAndPassword(auth,af.email.value.trim(),af.password.value);
    }catch(err){toast(emsg(err.code),false)}
    btn.disabled=false;
  });
  $('#vcheck').onclick=async()=>{await auth.currentUser.reload();if(auth.currentUser.emailVerified){await auth.currentUser.getIdToken(true);loginState(auth.currentUser)}else toast('Not verified yet. Click the link in your email.',false)};
  $('#vresend').onclick=()=>sendEmailVerification(auth.currentUser).then(()=>toast('Verification email sent.')).catch(e=>toast(emsg(e.code),false));
}

// ---------- Chat helpers ----------
function listen(tid,box,viewer){
  return onValue(ref(db,'ticketMessages/'+tid),s=>{
    box.innerHTML=Object.values(s.val()||{}).sort((a,b)=>a.createdAt-b.createdAt).map(m=>`<div class="b ${m.from===viewer?'me':''}"><small>${m.from==='admin'?'Modulos Support':'Customer'} &middot; ${esc(when(m.createdAt))}</small>${esc(m.text)}</div>`).join('');
    box.scrollTop=box.scrollHeight;
  });
}
const sendMsg=(tid,from,uid,text)=>set(push(ref(db,'ticketMessages/'+tid)),{from,uid,text,createdAt:Date.now()});

// ---------- User dashboard ----------
let dInit=false;
function initDash(u){
  if(dInit)return;dInit=true;$('#who').textContent=u.email;
  if(!u.emailVerified){
    $('#vcard').hidden=false;
    $('#vcheck').onclick=async()=>{await u.reload();if(u.emailVerified){await u.getIdToken(true);location.reload()}else toast('Not verified yet. Click the link in your email.',false)};
    $('#vresend').onclick=()=>sendEmailVerification(u).then(()=>toast('Verification email sent.')).catch(e=>toast(emsg(e.code),false));
    return;
  }
  $('#app').hidden=false;
  const tf=$('#ticketForm'),sv=new URLSearchParams(location.search).get('service');if(sv)tf.service.value=sv;
  let tickets={},cur=null,unsub=null;
  const list=()=>{const rows=Object.entries(tickets).sort((a,b)=>b[1].createdAt-a[1].createdAt);
    $('#tlist').innerHTML=rows.map(([id,t])=>`<div class="titem ${id===cur?'on':''}" data-id="${esc(id)}"><b>${esc(t.subject)}</b><small>${esc(t.service)} &middot; ${esc(when(t.createdAt))}</small><span class="pill ${cls(t.status)}">${esc(t.status)}</span></div>`).join('')||'<p class="lead">No tickets yet.</p>'};
  const head=()=>{const t=tickets[cur];if(!t)return;$('#ctitle').textContent=t.subject;$('#cmeta').textContent=t.service;
    const s=$('#cstat');s.textContent=t.status;s.className='pill '+cls(t.status);const off=t.status==='resolved';
    $('#msgText').disabled=off;$('#msgText').placeholder=off?'This ticket is resolved':'Type a message…'};
  const open=id=>{cur=id;tf.hidden=true;$('#chat').hidden=false;unsub&&unsub();unsub=listen(id,$('#msgs'),'user');head();list()};
  $('#newT').onclick=()=>{cur=null;unsub&&unsub();$('#chat').hidden=true;tf.hidden=false;list()};
  $('#tlist').onclick=e=>{const el=e.target.closest('.titem');el&&open(el.dataset.id)};
  onValue(ref(db,'userTickets/'+u.uid),s=>{tickets=s.val()||{};list();head()});
  tf.onsubmit=async e=>{
    e.preventDefault();const btn=tf.querySelector('button');btn.disabled=true;
    const id=push(ref(db,'tickets')).key,now=Date.now(),service=tf.service.value,subject=tf.subject.value.trim().slice(0,120),description=tf.description.value.trim().slice(0,3000);
    try{
      await u.getIdToken(true);
      await update(ref(db),{['tickets/'+id]:{uid:u.uid,email:u.email,service,subject,description,status:'open',createdAt:now},[`userTickets/${u.uid}/${id}`]:{service,subject,status:'open',createdAt:now}});
      await sendMsg(id,'user',u.uid,description);
      tf.reset();toast('Ticket raised! You can chat with us here.');open(id);
    }catch(err){console.error('Ticket error:',err);toast('Could not raise ticket: '+(err.code||err.message),false)}
    btn.disabled=false;
  };
  $('#msgForm').onsubmit=async e=>{
    e.preventDefault();const i=$('#msgText'),text=i.value.trim();if(!text||!cur)return;i.value='';
    try{await sendMsg(cur,'user',u.uid,text)}catch(err){console.error(err);toast('Message not sent: '+(err.code||err.message),false);i.value=text}
  };
}

// ---------- Admin ----------
let aInit=false;
function initAdmin(u){
  const al=$('#alogin'),dn=$('#denied'),pn=$('#panel');
  al.hidden=!!u;dn.hidden=true;pn.hidden=true;
  if(!u)return;
  if(u.email!==ADMIN||!u.emailVerified){dn.hidden=false;return}
  pn.hidden=false;if(aInit)return;aInit=true;
  let tickets={},cur=null,unsub=null;
  onValue(ref(db,'stats/visitors'),s=>$('#sv').textContent=s.val()||0);
  document.querySelectorAll('.tabs button[data-v]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
    ['tv','mv'].forEach(id=>$('#'+id).hidden=id!==b.dataset.v)});
  const list=()=>{const rows=Object.entries(tickets).sort((a,b)=>b[1].createdAt-a[1].createdAt);
    $('#st').textContent=rows.length;$('#so').textContent=rows.filter(r=>r[1].status!=='resolved').length;
    $('#tlist').innerHTML=rows.map(([id,t])=>`<div class="titem ${id===cur?'on':''}" data-id="${esc(id)}"><b>${esc(t.subject)}</b><small>${esc(t.email)} &middot; ${esc(t.service)}</small><span class="pill ${cls(t.status)}">${esc(t.status)}</span></div>`).join('')||'<p class="lead">No tickets yet.</p>'};
  const head=()=>{const t=tickets[cur];if(!t)return;$('#ctitle').textContent=t.subject;$('#cmeta').textContent=t.email+' · '+t.service;
    const s=$('#cstat');s.textContent=t.status;s.className='pill '+cls(t.status);$('#resolveBtn').textContent=t.status==='resolved'?'Reopen':'Mark resolved'};
  const setStatus=(id,st)=>update(ref(db),{[`tickets/${id}/status`]:st,[`userTickets/${tickets[id].uid}/${id}/status`]:st});
  onValue(ref(db,'tickets'),s=>{tickets=s.val()||{};list();head()});
  $('#tlist').onclick=e=>{const el=e.target.closest('.titem');if(!el)return;cur=el.dataset.id;$('#chat').hidden=false;unsub&&unsub();unsub=listen(cur,$('#msgs'),'admin');head();list()};
  $('#resolveBtn').onclick=()=>setStatus(cur,tickets[cur].status==='resolved'?'open':'resolved').then(()=>toast('Status updated.')).catch(()=>toast('Update failed.',false));
  $('#msgForm').onsubmit=async e=>{
    e.preventDefault();const i=$('#msgText'),text=i.value.trim();if(!text||!cur)return;i.value='';
    try{await sendMsg(cur,'admin',u.uid,text);if(tickets[cur].status==='open')await setStatus(cur,'in-progress')}
    catch(err){console.error(err);toast('Message not sent: '+(err.code||err.message),false);i.value=text}
  };
  onValue(ref(db,'contacts'),s=>{
    const rows=Object.values(s.val()||{}).sort((a,b)=>b.createdAt-a.createdAt);$('#sc').textContent=rows.length;
    $('#mrows').innerHTML=rows.map(r=>`<tr><td>${esc(when(r.createdAt))}</td><td><b>${esc(r.name)}</b><br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a><br>${esc(r.phone)}</td><td>${esc(r.message)}</td></tr>`).join('')||'<tr><td colspan="3">No messages yet.</td></tr>';
  });
}
const af2=$('#adminForm');
af2?.addEventListener('submit',async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,af2.email.value.trim(),af2.password.value)}catch(err){toast(emsg(err.code),false)}});
