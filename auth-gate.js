(function(){
  'use strict';
  let client=null, started=false, readyCallback=null;
  const cfg=window.JURISKPRO_SUPABASE_CONFIG||{};
  const configured=()=>/^https:\/\/.+\.supabase\.co$/.test(cfg.url||'') && (cfg.anonKey||'').length>20 && !String(cfg.anonKey).includes('COLLER_ICI');
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function mount(){
    document.body.classList.add('auth-locked');
    const el=document.createElement('div');el.id='jp-auth-gate';el.innerHTML=`<section class="jp-auth-card" aria-live="polite"><div class="jp-auth-brand">JURISK<span>PRO</span></div><p class="jp-auth-kicker">ESPACE JURIDIQUE SÉCURISÉ</p><h1 id="jp-auth-title">Connexion à JuriskPro</h1><p id="jp-auth-intro" class="jp-auth-intro">Créez votre compte ou connectez-vous pour accéder à l’application.</p><div id="jp-auth-config" hidden><p class="jp-auth-error">La connexion Supabase n’est pas encore configurée.</p><p>Le projet Supabase doit d’abord être créé. Ensuite, renseignez son URL et sa clé publique dans <code>supabase-config.js</code>, puis republiez le site.</p></div><div id="jp-auth-form-wrap"><div class="jp-auth-tabs"><button type="button" data-mode="signup" class="active">Créer un compte</button><button type="button" data-mode="login">Se connecter</button></div><form id="jp-auth-form"><label id="jp-name-wrap">Nom complet<input id="jp-name" autocomplete="name" minlength="2" required></label><label>Adresse e-mail<input id="jp-email" type="email" autocomplete="email" required></label><label>Mot de passe<input id="jp-password" type="password" autocomplete="new-password" minlength="8" required></label><button class="jp-auth-submit" type="submit" id="jp-auth-submit">Créer mon compte</button><button class="jp-auth-link" type="button" id="jp-reset">Mot de passe oublié ?</button></form></div><p id="jp-auth-message" class="jp-auth-message" role="status"></p><p class="jp-auth-foot">L’accès à JuriskPro est réservé aux utilisateurs disposant d’un compte. Vos documents restent associés à votre compte.</p></section>`;
    document.body.appendChild(el);
    let mode='signup';const $=s=>el.querySelector(s);
    function setMode(m){mode=m;$('#jp-auth-title').textContent=m==='signup'?'Créer votre compte':'Connexion à JuriskPro';$('#jp-auth-intro').textContent=m==='signup'?'Inscrivez-vous pour accéder à vos modèles et à votre espace personnel.':'Connectez-vous pour retrouver votre espace personnel.';$('#jp-name-wrap').hidden=m!=='signup';$('#jp-name').required=m==='signup';$('#jp-password').autocomplete=m==='signup'?'new-password':'current-password';$('#jp-auth-submit').textContent=m==='signup'?'Créer mon compte':'Se connecter';el.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));$('#jp-auth-message').textContent='';}
    el.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
    if(!configured()){$('#jp-auth-config').hidden=false;$('#jp-auth-form-wrap').hidden=true;return;}
    if(!window.supabase||!window.supabase.createClient){$('#jp-auth-message').textContent='Le service de connexion n’a pas pu être chargé. Vérifiez votre connexion Internet puis rechargez.';return;}
    client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('#jp-auth-form').addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('#jp-auth-submit'),msg=$('#jp-auth-message');btn.disabled=true;msg.textContent='Veuillez patienter…';
      const email=$('#jp-email').value.trim().toLowerCase(),password=$('#jp-password').value;
      try{
        let result;
        if(mode==='signup') result=await client.auth.signUp({email,password,options:{data:{full_name:$('#jp-name').value.trim()},emailRedirectTo:location.origin}});
        else result=await client.auth.signInWithPassword({email,password});
        if(result.error) throw result.error;
        if(mode==='signup'&&!result.data.session){msg.textContent='Compte créé. Vérifiez votre boîte e-mail et confirmez votre adresse avant de vous connecter.';setMode('login');}
        else if(result.data.session) unlock(result.data.session);
      }catch(err){msg.textContent=err.message||'Impossible de traiter la demande. Vérifiez les informations et réessayez.';}
      finally{btn.disabled=false;}
    });
    $('#jp-reset').addEventListener('click',async()=>{const email=$('#jp-email').value.trim().toLowerCase(),msg=$('#jp-auth-message');if(!email){msg.textContent='Saisissez votre adresse e-mail avant de demander la réinitialisation.';return;}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});msg.textContent=error?error.message:'Si cette adresse correspond à un compte, un e-mail de réinitialisation a été envoyé.';});
    client.auth.onAuthStateChange((event,session)=>{if(session)unlock(session);else if(event==='SIGNED_OUT')lock();});
    client.auth.getSession().then(({data,error})=>{if(error)$('#jp-auth-message').textContent=error.message;else if(data.session)unlock(data.session);});
  }
  function unlock(session){if(!session||!session.user)return;document.body.classList.remove('auth-locked');const el=document.getElementById('jp-auth-gate');if(el)el.remove();if(!started&&readyCallback){started=true;readyCallback(session,client);}}
  function lock(){document.body.classList.add('auth-locked');started=false;mount();}
  window.JuriskProAuth={require:function(cb){readyCallback=cb;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();},getClient:()=>client,getUser:()=>client&&client.auth.getUser(),signOut:async()=>client&&client.auth.signOut()};
})();
