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
      <div class="jp-auth-brandrow"><img class="jp-auth-logo" src="./icons/juriskpro-source.png" alt="Logo JuriskPro"><div><div class="jp-auth-brand">Jurisk<span>Pro</span></div><div class="jp-auth-tagline">Votre espace juridique professionnel</div></div></div>
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
      <p class="jp-auth-foot">Vos accès sont protégés. Vos documents restent associés à votre compte personnel.<br><a href="./politique-confidentialite.html" target="_blank" rel="noopener">Lire la politique de confidentialité</a> · <a href="mailto:messtonsconseils2@gmail.com">Contacter Messton's Conseils</a></p></section>`;
    document.body.appendChild(el);
    const $=s=>el.querySelector(s);let mode='signup';
    function setMessage(text,success){const m=$('#jp-auth-message');m.textContent=text||'';m.classList.toggle('success',!!success);}
    function messageFr(error,fallback){
      const raw=String(error&&error.message||error||'').toLowerCase();
      if(/invalid login credentials|invalid password|wrong password|password is incorrect/.test(raw))return 'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants puis réessayez.';
      if(/email not confirmed|email_not_confirmed/.test(raw))return 'Votre adresse e-mail n’est pas encore confirmée. Consultez votre boîte de réception.';
      if(/user already registered|already registered|user_already_exists/.test(raw))return 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous plutôt que de créer un nouveau compte.';
      if(/invalid email|email address is invalid/.test(raw))return 'L’adresse e-mail saisie n’est pas valide.';
      if(/password.*(at least|characters)|weak password|password should/.test(raw))return 'Le mot de passe ne respecte pas les critères de sécurité. Choisissez un mot de passe plus robuste.';
      if(/rate limit|too many requests|email rate limit/.test(raw))return 'Trop de tentatives ont été effectuées. Patientez quelques minutes avant de réessayer.';
      if(/expired|invalid.*token|token.*invalid/.test(raw))return 'Ce lien n’est plus valide ou a expiré. Demandez un nouveau lien.';
      if(/network|fetch failed|failed to fetch|load failed/.test(raw))return 'La connexion au service est impossible. Vérifiez votre connexion Internet puis réessayez.';
      return fallback||'Une erreur est survenue. Vérifiez les informations saisies puis réessayez.';
    }
    function setMode(m){mode=m;$('#jp-auth-title').textContent=m==='signup'?'Créer votre compte':'Bon retour parmi nous';$('#jp-auth-intro').textContent=m==='signup'?'Inscrivez-vous pour accéder à vos modèles et à votre espace personnel.':'Connectez-vous pour accéder à votre espace.';$('#jp-name-wrap').hidden=m!=='signup';$('#jp-name').required=m==='signup';$('#jp-confirm-wrap').hidden=m!=='signup';$('#jp-confirm').required=m==='signup';$('#jp-password').autocomplete=m==='signup'?'new-password':'current-password';$('#jp-auth-submit').textContent=m==='signup'?'Créer mon compte':'Se connecter';el.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));setMessage('');}
    el.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
    setMode('login');
    if(!configured()){$('#jp-auth-config').hidden=false;$('#jp-auth-form-wrap').hidden=true;signalReady();return;}
    /* Le formulaire s'affiche tout de suite ; Supabase se charge en arrière-plan. */
    const submitBtn=$('#jp-auth-submit');submitBtn.disabled=true;
    $('#jp-auth-form').addEventListener('submit',e=>e.preventDefault());
    const boot=()=>{
    if(!window.supabase||!window.supabase.createClient){setMessage('Le service de connexion ne peut pas être chargé. Vérifiez votre connexion Internet puis rechargez.');signalReady();return;}
    submitBtn.disabled=false;setMessage('');
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
      }catch(err){setMessage(messageFr(err,'Impossible de traiter la demande. Vérifiez les informations et réessayez.'));}
      finally{btn.disabled=false;}
    });
    $('#jp-reset').addEventListener('click',async()=>{const email=$('#jp-email').value.trim().toLowerCase();if(!email){setMessage('Saisissez votre adresse e-mail avant de demander la réinitialisation.');return;}try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:confirmationRedirect});if(error)throw error;setMessage('Si cette adresse correspond à un compte, un e-mail de réinitialisation a été envoyé.',true);}catch(err){setMessage(messageFr(err,'Impossible d’envoyer le lien de réinitialisation. Réessayez dans quelques instants.'));}});
    const isConfirmation=()=>new URLSearchParams(location.search).get('auth')==='confirmed';
    function showConfirmation(session){confirmationSession=session;$('#jp-auth-main').innerHTML=`<div class="jp-auth-confirm"><div class="jp-auth-confirm-icon">✓</div><p class="jp-auth-kicker">CONFIRMATION RÉUSSIE</p><h1>Adresse e-mail confirmée !</h1><p class="jp-auth-intro">Votre compte JuriskPro est maintenant activé. Vous pouvez vous connecter pour accéder à votre espace.</p><button type="button" class="jp-auth-submit" id="jp-confirm-enter">Accéder à JuriskPro</button></div>`;$('#jp-auth-message').textContent='';$('#jp-confirm-enter').addEventListener('click',()=>unlock(confirmationSession));}
    client.auth.onAuthStateChange((event,session)=>{if(session){if(isConfirmation())showConfirmation(session);else unlock(session);}else if(event==='SIGNED_OUT')lock();});
    client.auth.getSession().then(({data,error})=>{if(error)setMessage(messageFr(error,'Impossible de vérifier votre session. Rechargez la page puis réessayez.'));else if(data.session){if(isConfirmation())showConfirmation(data.session);else unlock(data.session);}else if(isConfirmation()){setMessage('Le lien de confirmation a expiré ou a déjà été utilisé. Connectez-vous ou demandez un nouvel e-mail de confirmation.');}signalReady();},()=>signalReady());
    };
    setMessage('Chargement du service de connexion…');
    if(window.supabase&&window.supabase.createClient)boot();
    else if(window.JPLibs)window.JPLibs.load('supabase').then(boot,boot);else boot();
  }
  function signalReady(){requestAnimationFrame(()=>window.dispatchEvent(new Event('jp:ready')));}
  function unlock(session){if(!session||!session.user)return;document.body.classList.remove('auth-locked');const el=document.getElementById('jp-auth-gate');if(el)el.remove();if(!started&&readyCallback){started=true;readyCallback(session,client);}signalReady();}
  function lock(){document.body.classList.add('auth-locked');started=false;mount();}
  window.JuriskProAuth={require:function(cb){readyCallback=cb;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();},getClient:()=>client,getUser:()=>client&&client.auth.getUser(),signOut:async()=>client&&client.auth.signOut()};
})();
