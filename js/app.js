import {auth,db,onAuthStateChanged,signOut,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendEmailVerification,ref,push,set,get,child,update,onValue} from './firebase-config.js';
const $=s=>document.querySelector(s),page=document.body.dataset.page;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,ok=true)=>{const t=$('#toast');t.textContent=m;t.className='show'+(ok?'':' err');setTimeout(()=>t.className='',3800)};
const when=t=>new Date(t).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
const cls=s=>s==='completed'?'done':s==='in-progress'?'progress':'';
let user=null;

$('#menuBtn')?.addEventListener('click',()=>$('#nav').classList.toggle('open'));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

onAuthStateChanged(auth,u=>{
  user=u;const b=$('#authBtn');
  if(b){b.textContent=u?'Dashboard':'Login';b.href=u?'dashboard.html':'login.html'}
  if(page==='dashboard')u?initDash(u):location.replace('login.html');
  if(page==='admin')u?initAdmin(u):location.replace('login.html');
  if(page==='login'&&u&&!$('#authForm').dataset.busy)location.replace('dashboard.html');
});

// Contact form
const cf=$('#contactForm');
if(cf){
  const s=new URLSearchParams(location.search).get('service');if(s&&cf.service)cf.service.value=s;
  cf.addEventListener('submit',async e=>{
    e.preventDefault();if(cf.website.value)return;
    const d=Object.fromEntries(new FormData(cf));delete d.website;
    const lead={name:d.name.trim().slice(0,100),email:d.email.trim().slice(0,150),phone:(d.phone||'').trim().slice(0,30),service:d.service,message:d.message.trim().slice(0,2000),status:'new',createdAt:Date.now(),uid:user?.uid||null};
    const id=push(child(ref(db),'leads')).key,up={['leads/'+id]:lead};
    if(user)up[`userLeads/${user.uid}/${id}`]=lead;
    const btn=cf.querySelector('button');btn.disabled=true;
    try{await update(ref(db),up);cf.reset();toast('Thanks! We will reply within 24 hours.')}
    catch(err){toast('Could not send. Please email support@modulos.in',false)}
    btn.disabled=false;
  });
}

// Login / Register
const af=$('#authForm');
if(af){
  let mode='login';
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
    mode=b.dataset.m;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
    $('#nameRow').style.display=mode==='register'?'block':'none';$('#authSubmit').textContent=mode==='register'?'Create account':'Sign in';
  }));
  af.addEventListener('submit',async e=>{
    e.preventDefault();af.dataset.busy=1;const btn=$('#authSubmit');btn.disabled=true;
    try{
      if(mode==='register'){
        const c=await createUserWithEmailAndPassword(auth,af.email.value.trim(),af.password.value);
        await set(ref(db,'users/'+c.user.uid),{name:af.name.value.trim().slice(0,100),email:c.user.email,createdAt:Date.now()});
        await sendEmailVerification(c.user);toast('Account created. Check your inbox to verify your email.');
      }else await signInWithEmailAndPassword(auth,af.email.value.trim(),af.password.value);
      setTimeout(()=>location.href='dashboard.html',900);
    }catch(err){
      const m={'auth/invalid-credential':'Wrong email or password.','auth/email-already-in-use':'Email already registered.','auth/weak-password':'Password must be 6+ characters.','auth/too-many-requests':'Too many attempts. Try later.'}[err.code]||'Something went wrong. Try again.';
      toast(m,false);delete af.dataset.busy;btn.disabled=false;
    }
  });
}

document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{await signOut(auth);location.href='index.html'}));

// Dashboard
function initDash(u){
  $('#who').textContent=u.email;
  if(!u.emailVerified)$('#verify').hidden=false;
  $('#resend')?.addEventListener('click',async()=>{await sendEmailVerification(u);toast('Verification email sent.')});
  onValue(ref(db,'userLeads/'+u.uid),snap=>{
    const rows=Object.entries(snap.val()||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt);
    $('#rows').innerHTML=rows.length?rows.map(([id,r])=>`<tr><td>${esc(when(r.createdAt))}</td><td>${esc(r.service)}</td><td>${esc(r.message)}</td><td><span class="pill ${cls(r.status)}">${esc(r.status)}</span></td></tr>`).join(''):'<tr><td colspan="4">No requests yet. <a href="contact.html" style="color:var(--p);font-weight:700">Start a project</a></td></tr>';
  });
}

// Admin
async function initAdmin(u){
  const ok=(await get(child(ref(db),'admins/'+u.uid))).exists();
  if(!ok){$('#denied').hidden=false;return}
  $('#panel').hidden=false;
  onValue(ref(db,'leads'),snap=>{
    const rows=Object.entries(snap.val()||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt);
    $('#count').textContent=rows.length;$('#newc').textContent=rows.filter(r=>r[1].status==='new').length;
    $('#rows').innerHTML=rows.map(([id,r])=>`<tr><td>${esc(when(r.createdAt))}</td><td><b>${esc(r.name)}</b><br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a><br>${esc(r.phone)}</td><td>${esc(r.service)}</td><td>${esc(r.message)}</td><td><select data-id="${esc(id)}" data-uid="${esc(r.uid||'')}">${['new','in-progress','completed'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')||'<tr><td colspan="5">No leads yet.</td></tr>';
  });
  $('#rows').addEventListener('change',async e=>{
    const s=e.target;if(!s.dataset.id)return;const up={['leads/'+s.dataset.id+'/status']:s.value};
    if(s.dataset.uid)up[`userLeads/${s.dataset.uid}/${s.dataset.id}/status`]=s.value;
    try{await update(ref(db),up);toast('Status updated.')}catch{toast('Update failed.',false)}
  });
}
