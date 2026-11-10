#!/usr/bin/env python3
"""Marque, dans les modèles source, les champs qui peuvent être repris du profil « Mon cabinet ».
Règles volontairement strictes (libellé exact) : un champ ambigu (Ville, Lieu, BP, Adresse…) n'est jamais rempli seul ;
l'utilisateur l'insère d'un toucher depuis les boutons du formulaire.
Usage : python3 -I tag_profil.py <dossier_projet>"""
import sys, json, glob, re, unicodedata

def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()).strip()

RULES = {
    'nom du notaire': ('nom', 'notaire'),
    'prenom du notaire': ('prenom', 'notaire'),
    'pardevant maitre': ('maitre', 'notaire'),
    'a ete etablie par maitre': ('maitre', 'notaire'),
    'ont ete etablis par maitre': ('maitre', 'notaire'),
    'modele de l etude de maitre': ('maitre', 'notaire'),
    'fait a': ('ville', ''),
}
P = sys.argv[1]
tot = {}
for f in sorted(glob.glob(P + '/models/source-*.json')):
    d = json.load(open(f, encoding='utf-8'))
    ch = 0
    for e in d['etapes']:
        for c in e.get('champs', []):
            for k in ('profil', 'pq'):
                c.pop(k, None)
            r = RULES.get(norm(c.get('label', '')))
            if r and c.get('type', 'text') in ('text', 'area'):
                c['profil'] = r[0]
                if r[1]:
                    c['pq'] = r[1]
                ch += 1
                tot[r[0]] = tot.get(r[0], 0) + 1
    open(f, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False))
print('champs marqués :', tot, '| total', sum(tot.values()))
