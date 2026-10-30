(function(){
  'use strict';
  let client=null, started=false, readyCallback=null, confirmationSession=null;
  const cfg=window.JURISKPRO_SUPABASE_CONFIG||{};
  const configured=()=>/^https:\/\/.+\.supabase\.co$/.test(cfg.url||'') && (cfg.anonKey||'').length>20 && !String(cfg.anonKey).includes('COLLER_ICI');
  function mount(){
    if(document.getElementById('jp-auth-gate')) return;
    document.body.classList.add('auth-locked');
    const el=document.createElement('div');el.id='jp-auth-gate';
    el.innerHTML=`<section class="jp-auth-card" aria-live="polite">
      <div class="jp-auth-brandrow"><div class="jp-auth-mark" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 7h14M7 7l-3 7h6L7 7Zm10 0-3 7h6l-3-7ZM8 21h8"/></svg></div><div><div class="jp-auth-brand">Jurisk<span>Pro</span></div><div class="jp-auth-tagline">Votre espace juridique professionnel</div></div></div>
      <div id="jp-auth-main"><p class="jp-auth-kicker">ESPACE JURIDIQUE SÉCURISÉ</p><h1 id="jp-auth-title">Créer votre compte</h1><p id="jp-auth-intro" class="jp-auth-intro">Inscrivez-vous pour accéder à vos modèles et à votre espace personnel.</p>
      <div id="jp-auth-config" hidden><p class="jp-auth-error">La connexion Supabase n’est pas encore configurée.</p><p>Vérifiez l’URL du projet et la clé publique dans <code>supabase-config.js</code>.</p></div>
      <div id="jp-auth-form-wrap"><div class="jp-auth-tabs"><button type="button" data-mode="signup" class="active">Créer un compte</button><button type="button" data-mode="login">Se connecter</button></div>
      <form id="jp-auth-form"><label id="jp-name-wrap">Nom complet<input id="jp-name" type="text" autocomplete="name" minlength="2" placeholder="Votre nom complet" required></label>
      <label>Adresse e-mail<input id="jp-email" type="email" autocomplete="email" placeholder="nom@exemple.com" required></label>
      <label>Mot de passe<input id="jp-password" type="password" autocomplete="new-password" minlength="8" placeholder="8 caractères minimum" required></label>
      <label id="jp-confirm-wrap">Confirmer le mot de passe<input id="jp-confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Répétez votre mot de passe" required></label>
      <button class="jp-auth-submit" type="submit" id="jp-auth-submit">Créer mon compte</button></form>
      <button class="jp-auth-link" type="button" id="jp-reset">Mot de passe oublié ?</button></div></div>
      <p id="jp-auth-message" class="jp-auth-message" role="status" aria-live="polite"></p>
      <p class="jp-auth-foot">Vos accès sont protégés. Vos documents restent associés à votre compte personnel.</p></section>`;
    document.body.appendChild(el);
    const $=s=>el.querySelector(s);let mode='signup';
    function setMessage(text,success){const m=$('#jp-auth-message');m.textContent=text||'';m.classList.toggle('success',!!success);}
    function setMode(m){mode=m;$('#jp-auth-title').textContent=m==='signup'?'Créer votre compte':'Bon retour parmi nous';$('#jp-auth-intro').textContent=m==='signup'?'Inscrivez-vous pour accéder à vos modèles et à votre espace personnel.':'Connectez-vous pour accéder à votre espace.';$('#jp-name-wrap').hidden=m!=='signup';$('#jp-name').required=m==='signup';$('#jp-confirm-wrap').hidden=m!=='signup';$('#jp-confirm').required=m==='signup';$('#jp-password').autocomplete=m==='signup'?'new-password':'current-password';$('#jp-auth-submit').textContent=m==='signup'?'Créer mon compte':'Se connecter';el.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));setMessage('');}
    el.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
    if(!configured()){$('#jp-auth-config').hidden=false;$('#jp-auth-form-wrap').hidden=true;return;}
    if(!window.supabase||!window.supabase.createClient){setMessage('Le service de connexion ne peut pas être chargé. Vérifiez votre connexion Internet puis rechargez.');return;}
    client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const confirmationRedirect=location.origin+location.pathname+'?auth=confirmed';
    $('#jp-auth-form').addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('#jp-auth-submit');btn.disabled=true;setMessage('Veuillez patienter…');
      const email=$('#jp-email').value.trim().toLowerCase(),password=$('#jp-password').value;
      try{
        let result;
        if(mode==='signup'){
          const name=$('#jp-name').value.trim();
          if(password!==$('#jp-confirm').value)throw new Error('Les deux mots de passe ne correspondent pas.');
          result=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:confirmationRedirect}});
        }else result=await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        if(mode==='signup'&&!result.data.session){setMessage('Votre demande d’inscription a été enregistrée. Un e-mail de confirmation vient de vous être envoyé à '+email+'. Ouvrez-le et cliquez sur le lien pour activer votre compte.',true);$('#jp-auth-form').hidden=true;$('#jp-reset').hidden=true;}
        else if(result.data.session){unlock(result.data.session);}
      }catch(err){setMessage(err.message||'Impossible de traiter la demande. Vérifiez les informations et réessayez.');}
      finally{btn.disabled=false;}
    });
    $('#jp-reset').addEventListener('click',async()=>{const email=$('#jp-email').value.trim().toLowerCase();if(!email){setMessage('Saisissez votre adresse e-mail avant de demander la réinitialisation.');return;}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:confirmationRedirect});setMessage(error?error.message:'Si cette adresse correspond à un compte, un e-mail de réinitialisation a été envoyé.',!error);});
    const isConfirmation=()=>new URLSearchParams(location.search).get('auth')==='confirmed';
    function showConfirmation(session){confirmationSession=session;$('#jp-auth-main').innerHTML=`<div class="jp-auth-confirm"><div class="jp-auth-confirm-icon">✓</div><p class="jp-auth-kicker">CONFIRMATION RÉUSSIE</p><h1>Adresse e-mail confirmée !</h1><p class="jp-auth-intro">Votre compte JuriskPro est maintenant activé. Vous pouvez vous connecter pour accéder à votre espace.</p><button type="button" class="jp-auth-submit" id="jp-confirm-enter">Accéder à JuriskPro</button></div>`;$('#jp-auth-message').textContent='';$('#jp-confirm-enter').addEventListener('click',()=>unlock(confirmationSession));}
    client.auth.onAuthStateChange((event,session)=>{if(session){if(isConfirmation())showConfirmation(session);else unlock(session);}else if(event==='SIGNED_OUT')lock();});
    client.auth.getSession().then(({data,error})=>{if(error)setMessage(error.message);else if(data.session){if(isConfirmation())showConfirmation(data.session);else unlock(data.session);}else if(isConfirmation()){setMessage('Le lien de confirmation a expiré ou a déjà été utilisé. Connectez-vous ou demandez un nouvel e-mail de confirmation.');}});
  }
  function unlock(session){if(!session||!session.user)return;document.body.classList.remove('auth-locked');const el=document.getElementById('jp-auth-gate');if(el)el.remove();if(!started&&readyCallback){started=true;readyCallback(session,client);}}
  function lock(){document.body.classList.add('auth-locked');started=false;mount();}
  window.JuriskProAuth={require:function(cb){readyCallback=cb;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();},getClient:()=>client,getUser:()=>client&&client.auth.getUser(),signOut:async()=>client&&client.auth.signOut()};
})();
