// ---------------------------------------------------------------------------
// BâtiLink — window.BLMsg : MESSAGERIE INTERNE (Supabase).
//
// Même philosophie que window.BLDB (assets/js/db.js) : cette couche
// « dégrade gracieusement ». Si supabase-js n'est pas chargé, si les clés
// manquent, si l'utilisateur n'est pas connecté, ou si les tables n'existent
// pas encore → BLMsg.ready vaut false et/ou chaque méthode renvoie [] / null / 0.
// Aucune méthode ne « throw » vers l'appelant : la page messages/index.html
// affiche alors un état vide plutôt qu'une page cassée.
//
// CONCEPT : deux utilisateurs échangent des messages à propos d'un chantier,
// SANS s'exposer leur téléphone ni leur email. Une conversation relie une paire
// canonique de participants (a = min(uuid), b = max(uuid)) + un chantier.
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase),
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js), et de
// préférence window.BLDB (réutilise son client Supabase).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var client = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      // Réutilise le client BLDB si présent (évite deux instances), sinon crée.
      if (window.BLDB && window.BLDB.client) {
        client = window.BLDB.client;
      } else {
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      }
    }
  } catch (e) { client = null; }

  var BLMsg = { ready: !!client, client: client };

  // --- Utilitaires internes -------------------------------------------------
  function emptyArr() { return Promise.resolve([]); }
  function nullVal() { return Promise.resolve(null); }
  function falseVal() { return Promise.resolve(false); }
  function zeroVal() { return Promise.resolve(0); }

  // Utilisateur courant (objet user) ou null. Ne « throw » jamais.
  function currentUser() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      var s = res && res.data ? res.data.session : null;
      return (s && s.user) ? s.user : null;
    }).catch(function () { return null; });
  }

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLMsg.session = function () { return currentUser(); };

  // Ordonne deux identifiants dans un ordre canonique stable : [a, b] avec
  // a <= b (comparaison lexicographique). Garantit qu'une paire (u1,u2) et
  // (u2,u1) donnent la même conversation. Renvoie null si entrée invalide.
  BLMsg.canonPair = function (u1, u2) {
    if (!u1 || !u2) return null;
    u1 = String(u1); u2 = String(u2);
    return (u1 <= u2) ? [u1, u2] : [u2, u1];
  };

  // Trouve (ou crée) une conversation pour (paire canonique + chantierId).
  // - Requiert d'être connecté et withUser différent de soi-même.
  // - opts : { withUser, chantierId, sujet }
  // Renvoie la ligne conversation, ou null en cas d'erreur / conditions non
  // remplies.
  BLMsg.startConversation = function (opts) {
    if (!client) return nullVal();
    opts = opts || {};
    var withUser = opts.withUser;
    var chantierId = opts.chantierId || null;
    var sujet = opts.sujet || null;
    if (!withUser) return nullVal();
    return currentUser().then(function (user) {
      if (!user) return null;
      if (String(withUser) === String(user.id)) return null; // pas de fil avec soi-même
      var pair = BLMsg.canonPair(user.id, withUser);
      if (!pair) return null;

      // 1) Cherche un fil existant pour cette paire + ce chantier.
      var q = client.from('conversations').select('*')
        .eq('participant_a', pair[0])
        .eq('participant_b', pair[1]);
      q = chantierId ? q.eq('chantier_id', chantierId) : q.is('chantier_id', null);

      return q.limit(1).then(function (res) {
        if (res && !res.error && res.data && res.data.length) {
          return res.data[0]; // fil déjà existant
        }
        // 2) Sinon, création.
        var row = {
          chantier_id: chantierId,
          participant_a: pair[0],
          participant_b: pair[1],
          sujet: sujet
        };
        return client.from('conversations').insert(row).select().single().then(function (r2) {
          if (!r2 || r2.error || !r2.data) return null;
          return r2.data;
        }).catch(function () { return null; });
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Liste les conversations de l'utilisateur (plus récentes d'abord, par
  // last_message_at). Chaque fil est enrichi (best effort) de :
  //   _other   : l'identifiant de l'AUTRE participant
  //   _preview : aperçu du dernier message (texte)
  //   _unread  : nombre de messages non lus pour l'utilisateur courant
  // Renvoie [] sur toute erreur.
  BLMsg.listConversations = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      var uid = user.id;
      // RLS filtre déjà aux fils de l'utilisateur ; l'ordre est explicite.
      return client.from('conversations').select('*')
        .order('last_message_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          var convs = res.data.map(function (c) {
            c = c || {};
            c._other = (String(c.participant_a) === String(uid)) ? c.participant_b : c.participant_a;
            c._preview = '';
            c._unread = 0;
            return c;
          });
          if (!convs.length) return convs;

          // Enrichissement best effort (aperçu + non lus). Non bloquant : en cas
          // d'échec on renvoie les fils sans aperçu plutôt que de tout perdre.
          var ids = convs.map(function (c) { return c.id; });
          var byId = {};
          convs.forEach(function (c) { byId[c.id] = c; });

          var pPreview = client.from('messages')
            .select('conversation_id,contenu,created_at')
            .in('conversation_id', ids)
            .order('created_at', { ascending: false })
            .then(function (mr) {
              if (mr && !mr.error && mr.data) {
                mr.data.forEach(function (m) {
                  var c = byId[m.conversation_id];
                  if (c && !c._preview) c._preview = m.contenu || ''; // 1er vu = plus récent
                });
              }
            }).catch(function () {});

          var pUnread = client.from('messages')
            .select('conversation_id')
            .in('conversation_id', ids)
            .eq('lu', false)
            .neq('sender', uid)
            .then(function (ur) {
              if (ur && !ur.error && ur.data) {
                ur.data.forEach(function (m) {
                  var c = byId[m.conversation_id];
                  if (c) c._unread = (c._unread || 0) + 1;
                });
              }
            }).catch(function () {});

          return Promise.all([pPreview, pUnread]).then(function () { return convs; })
            .catch(function () { return convs; });
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Messages d'une conversation, du plus ancien au plus récent. Renvoie [] sur
  // erreur.
  BLMsg.getMessages = function (convId) {
    if (!client || !convId) return emptyArr();
    return client.from('messages').select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (!res || res.error || !res.data) return [];
        return res.data;
      }).catch(function () { return []; });
  };

  // Envoie un message dans une conversation (sender = utilisateur courant) et
  // met à jour conversation.last_message_at. Renvoie la ligne créée ou null.
  BLMsg.sendMessage = function (convId, contenu) {
    if (!client || !convId) return nullVal();
    contenu = (contenu == null) ? '' : String(contenu);
    if (!contenu.trim()) return nullVal();
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = { conversation_id: convId, sender: user.id, contenu: contenu };
      return client.from('messages').insert(row).select().single().then(function (res) {
        if (!res || res.error || !res.data) return null;
        // Met à jour l'horodatage du fil (best effort, non bloquant).
        client.from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', convId)
          .then(function () {}).catch(function () {});
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Marque comme lus les messages reçus (sender <> soi) et non lus d'un fil.
  // Best effort : renvoie true si l'opération a pu s'exécuter, false sinon.
  BLMsg.markRead = function (convId) {
    if (!client || !convId) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('messages')
        .update({ lu: true })
        .eq('conversation_id', convId)
        .eq('lu', false)
        .neq('sender', user.id)
        .then(function (res) { return !(res && res.error); })
        .catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // Nombre total de messages non lus pour l'utilisateur (reçus, lu = false),
  // tous fils confondus. Renvoie 0 sur erreur.
  BLMsg.unreadCount = function () {
    if (!client) return zeroVal();
    return currentUser().then(function (user) {
      if (!user) return 0;
      return client.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('lu', false)
        .neq('sender', user.id)
        .then(function (res) {
          if (!res || res.error) return 0;
          return (typeof res.count === 'number') ? res.count : 0;
        }).catch(function () { return 0; });
    }).catch(function () { return 0; });
  };

  // S'abonne aux nouveaux messages (INSERT) d'une conversation via Realtime.
  // Appelle cb(newRow) à chaque nouveau message. Renvoie une fonction de
  // désabonnement (ou un no-op si Realtime indisponible). Tout est protégé
  // pour que l'absence de Realtime ne casse rien.
  BLMsg.subscribe = function (convId, cb) {
    var noop = function () {};
    if (!client || !convId || typeof cb !== 'function') return noop;
    var channel = null;
    try {
      if (typeof client.channel !== 'function') return noop;
      channel = client.channel('bl-msg-' + convId)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId },
          function (payload) {
            try { if (payload && payload.new) cb(payload.new); } catch (e) {}
          })
        .subscribe();
    } catch (e) { channel = null; }
    return function () {
      try {
        if (channel) {
          if (typeof client.removeChannel === 'function') client.removeChannel(channel);
          else if (typeof channel.unsubscribe === 'function') channel.unsubscribe();
        }
      } catch (e) {}
    };
  };

  window.BLMsg = BLMsg;
})();
