(function(){
  'use strict';
  let client=null, started=false, readyCallback=null, confirmationSession=null;
  const cfg=window.JURISKPRO_SUPABASE_CONFIG||{};
  const configured=()=>/^https:\/\/.+\.supabase\.co$/.test(cfg.url||'') && (cfg.anonKey||'').length>20 && !String(cfg.anonKey).includes('COLLER_ICI');
  function mount(){
    if(document.getElementById('jp-auth-gate')) return;
    const EYE='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.6 19 2 12 2 12a18.5 18.5 0 0 1 5.1-5.9"/><path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2"/><path d="M14.1 14.1A3 3 0 1 1 9.9 9.9"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
    const JP_BUILD='10';
    document.body.classList.add('auth-locked');
    const el=document.createElement('div');el.id='jp-auth-gate';
    el.innerHTML=`<section class="jp-auth-card" aria-live="polite">
      <div class="jp-auth-brandrow"><img class="jp-auth-logo" src="./icons/juriskpro-source.png" alt="Logo JuriskPro"><div><div class="jp-auth-brand">Jurisk<span>Pro</span></div><div class="jp-auth-tagline">Votre espace juridique professionnel</div></div></div>
      <div id="jp-auth-main"><p class="jp-auth-kicker">ESPACE JURIDIQUE SÉCURISÉ</p><h1 id="jp-auth-title">Créer votre compte</h1><p id="jp-auth-intro" class="jp-auth-intro">Inscrivez-vous pour accéder à vos modèles et à votre espace personnel.</p>
      <div id="jp-auth-config" hidden><p class="jp-auth-error">La connexion Supabase n’est pas encore configurée.</p><p>Vérifiez l’URL du projet et la clé publique dans <code>supabase-config.js</code>.</p></div>
      <div id="jp-auth-form-wrap"><div class="jp-auth-tabs"><button type="button" data-mode="signup" class="active">Créer un compte</button><button type="button" data-mode="login">Se connecter</button></div>
      <form id="jp-auth-form"><label id="jp-name-wrap">Nom complet<input id="jp-name" type="text" autocomplete="name" minlength="2" placeholder="Votre nom complet" required></label>
      <label>Adresse e-mail<input id="jp-email" type="email" autocomplete="email" placeholder="nom@exemple.com" required></label>
      <label>Mot de passe<span class="jp-pw"><input id="jp-password" type="password" autocomplete="new-password" minlength="8" placeholder="Votre mot de passe" required><button type="button" class="jp-pw-toggle" data-for="jp-password" aria-label="Afficher le mot de passe" aria-pressed="false">${EYE}</button></span></label>
      <ul id="jp-pw-rules" class="jp-pw-rules" aria-live="polite"><li data-r="len">8 caractères minimum</li><li data-r="low">une lettre minuscule</li><li data-r="up">une lettre majuscule</li><li data-r="num">un chiffre</li><li data-r="sym">un symbole (! ? @ # $ % …)</li></ul>
      <label id="jp-confirm-wrap">Confirmer le mot de passe<span class="jp-pw"><input id="jp-confirm" type="password" autocomplete="new-password" placeholder="Répétez le mot de passe" required><button type="button" class="jp-pw-toggle" data-for="jp-confirm" aria-label="Afficher le mot de passe" aria-pressed="false">${EYE}</button></span></label>
      <button class="jp-auth-submit" type="submit" id="jp-auth-submit">Créer mon compte</button></form>
      <button class="jp-auth-link" type="button" id="jp-reset">Mot de passe oublié ?</button></div></div>
      <p id="jp-auth-message" class="jp-auth-message" role="status" aria-live="polite"></p>
      <p class="jp-auth-foot">Vos accès sont protégés. Vos documents restent associés à votre compte personnel.<br><a href="./politique-confidentialite.html" target="_blank" rel="noopener">Lire la politique de confidentialité</a> · <a href="mailto:messtonsconseils2@gmail.com">Contacter Messton's Conseils</a><br><span class="jp-ver">Version ${JP_BUILD}</span></p></section>`;
    document.body.appendChild(el);
    const $=s=>el.querySelector(s);let mode='signup';
    function setMessage(text,success){const m=$('#jp-auth-message');m.textContent=text||'';m.classList.toggle('success',!!success);}
    function messageFr(error,fallback){
      const raw=String(error&&error.message||error||'').toLowerCase();
      if(/invalid login credentials|invalid password|wrong password|password is incorrect/.test(raw))return 'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants puis réessayez.';
      if(/email not confirmed|email_not_confirmed/.test(raw))return 'Votre adresse e-mail n’est pas encore confirmée. Consultez votre boîte de réception.';
      if(/user already registered|already registered|user_already_exists/.test(raw))return 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous plutôt que de créer un nouveau compte.';
      if(/invalid email|email address is invalid/.test(raw))return 'L’adresse e-mail saisie n’est pas valide.';
      if(/different from the old|same as the old|same password/.test(raw))return 'Choisissez un mot de passe différent de l’ancien.';
      if(/password.*(at least|characters)|weak password|password should/.test(raw))return 'Le mot de passe ne respecte pas les critères de sécurité. Choisissez un mot de passe plus robuste.';
      if(/rate limit|too many requests|email rate limit/.test(raw))return 'Trop de tentatives ont été effectuées. Patientez quelques minutes avant de réessayer.';
      if(/expired|invalid.*token|token.*invalid/.test(raw))return 'Ce lien n’est plus valide ou a expiré. Demandez un nouveau lien.';
      if(/network|fetch failed|failed to fetch|load failed/.test(raw))return 'La connexion au service est impossible. Vérifiez votre connexion Internet puis réessayez.';
      return fallback||'Une erreur est survenue. Vérifiez les informations saisies puis réessayez.';
    }
    /* Règle de sécurité (création de compte) : 8 caractères minimum avec minuscule, majuscule, chiffre et symbole. */
    const PW_RULES={len:p=>p.length>=8,low:p=>/\p{Ll}/u.test(p),up:p=>/\p{Lu}/u.test(p),num:p=>/\d/.test(p),sym:p=>/[^\p{L}\p{N}\s]/u.test(p)};
    const PW_LABEL={len:'8 caractères minimum',low:'une minuscule',up:'une majuscule',num:'un chiffre',sym:'un symbole'};
    const pwMissing=p=>Object.keys(PW_RULES).filter(k=>!PW_RULES[k](p));
    function paintRules(){const p=$('#jp-password').value;el.querySelectorAll('#jp-pw-rules li').forEach(li=>{const ok=PW_RULES[li.dataset.r](p);li.classList.toggle('ok',ok);li.classList.toggle('bad',p.length>0&&!ok);});}
    $('#jp-password').addEventListener('input',paintRules);
    function bindToggles(root){root.querySelectorAll('.jp-pw-toggle').forEach(b=>b.addEventListener('click',()=>{const i=$('#'+b.dataset.for),show=i.type==='password';i.type=show?'text':'password';b.innerHTML=show?EYE_OFF:EYE;b.setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');b.setAttribute('aria-pressed',String(show));}));}
    bindToggles(el);
    function setMode(m){mode=m;$('#jp-pw-rules').hidden=m!=='signup';$('#jp-password').placeholder=m==='signup'?'Créez un mot de passe sécurisé':'Votre mot de passe';if(m==='signup')$('#jp-password').setAttribute('minlength','8');else $('#jp-password').removeAttribute('minlength');paintRules();$('#jp-auth-title').textContent=m==='signup'?'Créer votre compte':'Bon retour parmi nous';$('#jp-auth-intro').textContent=m==='signup'?'Inscrivez-vous pour accéder à vos modèles et à votre espace personnel.':'Connectez-vous pour accéder à votre espace.';$('#jp-name-wrap').hidden=m!=='signup';$('#jp-name').required=m==='signup';$('#jp-confirm-wrap').hidden=m!=='signup';$('#jp-confirm').required=m==='signup';$('#jp-password').autocomplete=m==='signup'?'new-password':'current-password';$('#jp-auth-submit').textContent=m==='signup'?'Créer mon compte':'Se connecter';el.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));setMessage('');}
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
    const publicSite=String(cfg.siteUrl||'https://juriskpro.netlify.app').replace(/\/+$/,'');
    const confirmationRedirect=publicSite+'/?auth=confirmed',recoveryRedirect=publicSite+'/?auth=recovery';
    $('#jp-auth-form').addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('#jp-auth-submit');btn.disabled=true;setMessage('Veuillez patienter…');
      const email=$('#jp-email').value.trim().toLowerCase(),password=$('#jp-password').value;
      try{
        let result;
        if(mode==='signup'){
          const name=$('#jp-name').value.trim();
          const miss=pwMissing(password);if(miss.length)throw {local:true,message:'Mot de passe trop faible. Il manque : '+miss.map(k=>PW_LABEL[k]).join(', ')+'.'};
          if(password!==$('#jp-confirm').value)throw {local:true,message:'Les deux mots de passe ne correspondent pas.'};
          result=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:confirmationRedirect}});
        }else result=await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        if(mode==='signup'&&!result.data.session){setMessage('Votre demande d’inscription a été enregistrée. Un e-mail de confirmation vient de vous être envoyé à '+email+'. Ouvrez-le et cliquez sur le lien pour activer votre compte.',true);$('#jp-auth-form').hidden=true;$('#jp-reset').hidden=true;}
        else if(result.data.session){unlock(result.data.session);}
      }catch(err){setMessage(err&&err.local?err.message:messageFr(err,'Impossible de traiter la demande. Vérifiez les informations et réessayez.'));}
      finally{btn.disabled=false;}
    });
    $('#jp-reset').addEventListener('click',async()=>{const email=$('#jp-email').value.trim().toLowerCase();if(!email){setMessage('Saisissez votre adresse e-mail avant de demander la réinitialisation.');return;}try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:recoveryRedirect});if(error)throw error;setMessage('Si cette adresse correspond à un compte, un e-mail de réinitialisation a été envoyé.',true);}catch(err){setMessage(messageFr(err,'Impossible d’envoyer le lien de réinitialisation. Réessayez dans quelques instants.'));}});
    const isConfirmation=()=>new URLSearchParams(location.search).get('auth')==='confirmed';
    function showConfirmation(session){confirmationSession=session;$('#jp-auth-main').innerHTML=`<div class="jp-auth-confirm"><div class="jp-auth-confirm-icon">✓</div><p class="jp-auth-kicker">CONFIRMATION RÉUSSIE</p><h1>Votre compte a été créé !</h1><p class="jp-auth-intro">Votre adresse e-mail est confirmée et votre compte JuriskPro est activé. Vous pouvez maintenant vous connecter.</p><button type="button" class="jp-auth-submit" id="jp-confirm-enter">Se connecter</button><p class="jp-auth-intro" style="margin-top:14px">Vous utilisez l’application JuriskPro sur votre téléphone ? Ouvrez-la et connectez-vous avec votre e-mail et votre mot de passe.</p></div>`;$('#jp-auth-message').textContent='';$('#jp-confirm-enter').addEventListener('click',()=>{try{history.replaceState(null,'',location.pathname);}catch(e){}unlock(confirmationSession);});}
    const isRecovery=()=>new URLSearchParams(location.search).get('auth')==='recovery';
    const linkExpired=()=>/error_code=otp_expired|error=access_denied/.test(location.hash+location.search);
    let recoveryMode=false;
    const cleanUrl=()=>{try{history.replaceState(null,'',location.pathname);}catch(e){}};
    function showRecovery(session){
      if(recoveryMode&&$('#jp-new-form'))return;
      recoveryMode=true;confirmationSession=session;
      $('#jp-auth-main').innerHTML=`<p class="jp-auth-kicker">NOUVEAU MOT DE PASSE</p><h1>Choisissez un nouveau mot de passe</h1><p class="jp-auth-intro">Saisissez le mot de passe que vous utiliserez désormais pour vous connecter.</p>
      <form id="jp-new-form"><label>Nouveau mot de passe<span class="jp-pw"><input id="jp-newpw" type="password" autocomplete="new-password" required><button type="button" class="jp-pw-toggle" data-for="jp-newpw" aria-label="Afficher le mot de passe" aria-pressed="false">${EYE}</button></span></label>
      <ul id="jp-newpw-rules" class="jp-pw-rules" aria-live="polite"><li data-r="len">8 caractères minimum</li><li data-r="low">une lettre minuscule</li><li data-r="up">une lettre majuscule</li><li data-r="num">un chiffre</li><li data-r="sym">un symbole (! ? @ # $ % …)</li></ul>
      <label>Confirmer le mot de passe<span class="jp-pw"><input id="jp-newpw2" type="password" autocomplete="new-password" required><button type="button" class="jp-pw-toggle" data-for="jp-newpw2" aria-label="Afficher le mot de passe" aria-pressed="false">${EYE}</button></span></label>
      <button class="jp-auth-submit" type="submit" id="jp-new-submit">Enregistrer le mot de passe</button></form>`;
      $('#jp-auth-message').textContent='';
      bindToggles($('#jp-auth-main'));
      $('#jp-newpw').addEventListener('input',()=>{const p=$('#jp-newpw').value;$('#jp-auth-main').querySelectorAll('#jp-newpw-rules li').forEach(li=>{const ok=PW_RULES[li.dataset.r](p);li.classList.toggle('ok',ok);li.classList.toggle('bad',p.length>0&&!ok);});});
      $('#jp-new-form').addEventListener('submit',async e=>{
        e.preventDefault();const btn=$('#jp-new-submit'),p=$('#jp-newpw').value;
        const miss=pwMissing(p);
        if(miss.length){setMessage('Mot de passe trop faible. Il manque : '+miss.map(k=>PW_LABEL[k]).join(', ')+'.');return;}
        if(p!==$('#jp-newpw2').value){setMessage('Les deux mots de passe ne correspondent pas.');return;}
        btn.disabled=true;setMessage('Veuillez patienter…');
        try{
          const {error}=await client.auth.updateUser({password:p});
          if(error)throw error;
          $('#jp-auth-main').innerHTML=`<div class="jp-auth-confirm"><div class="jp-auth-confirm-icon">✓</div><p class="jp-auth-kicker">MOT DE PASSE MODIFIÉ</p><h1>C’est fait !</h1><p class="jp-auth-intro">Votre nouveau mot de passe est enregistré. Utilisez-le pour vous connecter la prochaine fois.</p><button type="button" class="jp-auth-submit" id="jp-recovery-enter">Se connecter</button></div>`;
          setMessage('');cleanUrl();
          $('#jp-recovery-enter').addEventListener('click',()=>{recoveryMode=false;unlock(confirmationSession);});
        }catch(err){setMessage(messageFr(err,'Impossible d’enregistrer le mot de passe. Demandez un nouveau lien puis réessayez.'));btn.disabled=false;}
      });
    }
    client.auth.onAuthStateChange((event,session)=>{
      if(recoveryMode)return;
      if(event==='PASSWORD_RECOVERY'&&session){showRecovery(session);return;}
      if(session){if(isRecovery())showRecovery(session);else if(isConfirmation())showConfirmation(session);else unlock(session);}
      else if(event==='SIGNED_OUT')lock();
    });
    client.auth.getSession().then(({data,error})=>{if(error)setMessage(messageFr(error,'Impossible de vérifier votre session. Rechargez la page puis réessayez.'));else if(data.session){if(recoveryMode){}else if(isRecovery())showRecovery(data.session);else if(isConfirmation())showConfirmation(data.session);else unlock(data.session);}else if(isRecovery()||linkExpired()){setMessage('Ce lien n’est plus valide ou a expiré. Cliquez sur « Mot de passe oublié ? » pour recevoir un nouveau lien.');}else if(isConfirmation()){setMessage('Le lien de confirmation a expiré ou a déjà été utilisé. Connectez-vous ou demandez un nouvel e-mail de confirmation.');}signalReady();},()=>signalReady());
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
