// BâtiLink — données d'exemple (démonstration). Contenu fictif.
// Exposé en global window.BATILINK_DATA pour les pages de recherche.
(function () {
  const VILLES = ['Lyon', 'Villeurbanne', 'Vénissieux', 'Caluire', 'Bron', 'Écully', 'Saint-Priest', 'Oullins'];

  const chantiers = [
    { titre: 'Rénovation complète appartement 75 m²', metier: 'Tous corps d\'état', ville: 'Lyon 3e', budget: '35 000 €', delai: 'Sous 2 mois', tag: 'Urgent', desc: 'Rénovation d\'un T3 : électricité, plomberie, peinture, sols. Recherche entreprise générale ou artisans coordonnés.', e: '🏠' },
    { titre: 'Réfection toiture 120 m² (tuiles)', metier: 'Couvreur', ville: 'Caluire', budget: '18 000 €', delai: 'Flexible', tag: 'Nouveau', desc: 'Dépose et repose de couverture tuiles, remplacement liteaux, zinguerie. Échafaudage à prévoir.', e: '🧱' },
    { titre: 'Installation pompe à chaleur air/eau', metier: 'Chauffagiste', ville: 'Bron', budget: '12 000 €', delai: 'Sous 1 mois', tag: 'Aides', desc: 'Remplacement chaudière fioul par PAC. Client éligible MaPrimeRénov\' — accompagnement apprécié.', e: '🔥' },
    { titre: 'Création salle de bain PMR', metier: 'Plombier', ville: 'Villeurbanne', budget: '9 500 €', delai: 'Sous 6 semaines', tag: '', desc: 'Douche à l\'italienne accessible, faïence, meuble vasque, robinetterie. Petit espace 5 m².', e: '🚿' },
    { titre: 'Ravalement de façade maison', metier: 'Façadier', ville: 'Écully', budget: '14 000 €', delai: 'Été 2026', tag: '', desc: 'Ravalement enduit + isolation thermique par l\'extérieur (ITE) sur maison individuelle 2 niveaux.', e: '🏗️' },
    { titre: 'Pose parquet et menuiseries', metier: 'Menuisier', ville: 'Saint-Priest', budget: '7 200 €', delai: 'Flexible', tag: 'Nouveau', desc: 'Parquet contrecollé 60 m², pose de 4 portes intérieures et plinthes. Fournitures comprises.', e: '🪵' },
    { titre: 'Mise aux normes tableau électrique', metier: 'Électricien', ville: 'Oullins', budget: '3 400 €', delai: 'Sous 2 semaines', tag: 'Urgent', desc: 'Remplacement tableau, mise à la terre, diagnostic complet. Logement locatif.', e: '⚡' },
    { titre: 'Aménagement combles + isolation', metier: 'Tous corps d\'état', ville: 'Vénissieux', budget: '22 000 €', delai: 'Sous 3 mois', tag: 'Aides', desc: 'Transformation combles en chambre + bureau : isolation, cloisons, électricité, Velux.', e: '🏠' },
  ];

  const artisans = [
    { titre: 'Dupont Plomberie', metier: 'Plombier', ville: 'Lyon', note: 5, avis: 128, badge: 'Vérifié', desc: 'Plombier-chauffagiste, 20 ans d\'expérience. Dépannage, installation, rénovation salle de bain.', e: '🔧' },
    { titre: 'Élec Pro Rhône', metier: 'Électricien', ville: 'Villeurbanne', note: 5, avis: 86, badge: 'Vérifié', desc: 'Installations, mise aux normes, domotique. Certifié Qualifelec. Interventions rapides.', e: '⚡' },
    { titre: 'Toiture & Zinc 69', metier: 'Couvreur', ville: 'Caluire', note: 4, avis: 54, badge: '', desc: 'Couverture, zinguerie, étanchéité. Devis gratuit, garantie décennale.', e: '🧱' },
    { titre: 'Bois & Style', metier: 'Menuisier', ville: 'Écully', note: 5, avis: 73, badge: 'Vérifié', desc: 'Menuiserie sur-mesure, parquets, agencement intérieur. Atelier local.', e: '🪵' },
    { titre: 'Chaleur Confort', metier: 'Chauffagiste', ville: 'Bron', note: 4, avis: 41, badge: 'RGE', desc: 'Pompes à chaleur, chaudières, entretien. Reconnu Garant de l\'Environnement (RGE).', e: '🔥' },
    { titre: 'Façade Lumière', metier: 'Façadier', ville: 'Saint-Priest', note: 5, avis: 37, badge: 'RGE', desc: 'Ravalement, ITE, enduits décoratifs. Échafaudage et nettoyage inclus.', e: '🏗️' },
  ];

  const aides = [
    { titre: 'MaPrimeRénov\'', metier: 'Rénovation énergétique', ville: 'National', budget: 'Jusqu\'à 90 % HT', delai: 'Sous conditions', tag: 'Phare', desc: 'Aide de l\'État à la rénovation énergétique (isolation, chauffage). Montant selon revenus et gains énergétiques.', e: '🏛️' },
    { titre: 'Certificats d\'Économies d\'Énergie (CEE)', metier: 'Travaux d\'économie', ville: 'National', budget: 'Prime variable', delai: 'Avant travaux', tag: '', desc: 'Prime versée par les fournisseurs d\'énergie pour des travaux économes. Cumulable avec MaPrimeRénov\'.', e: '💶' },
    { titre: 'Éco-prêt à taux zéro (éco-PTZ)', metier: 'Financement', ville: 'National', budget: 'Jusqu\'à 50 000 €', delai: '—', tag: '', desc: 'Prêt sans intérêt pour financer des travaux de rénovation énergétique. Sans condition de ressources.', e: '🏦' },
    { titre: 'TVA à taux réduit 5,5 %', metier: 'Fiscalité', ville: 'National', budget: 'TVA 5,5 %', delai: 'À la facturation', tag: '', desc: 'Taux de TVA réduit sur les travaux d\'amélioration énergétique dans les logements de plus de 2 ans.', e: '🧾' },
    { titre: 'Aides locales (Région / Métropole)', metier: 'Aides territoriales', ville: 'Rhône', budget: 'Variable', delai: 'Selon dispositif', tag: 'Local', desc: 'Subventions complémentaires proposées par la Région et la Métropole de Lyon selon les projets.', e: '📍' },
  ];

  const soustraitance = [
    { titre: 'Lot plomberie — immeuble neuf', metier: 'Plombier', ville: 'Lyon 7e', budget: '45 000 €', delai: '3 mois', tag: 'Lot', desc: 'Entreprise générale cherche sous-traitant plomberie pour un immeuble de 12 logements. Références exigées.', e: '🔧' },
    { titre: 'Disponibilité électricien 2 semaines', metier: 'Électricien', ville: 'Villeurbanne', budget: 'Journalier', delai: 'Immédiat', tag: 'Dispo', desc: 'Électricien qualifié disponible pour renfort d\'équipe ou lot ponctuel. Mobilité agglo lyonnaise.', e: '⚡' },
    { titre: 'Lot carrelage — rénovation hôtel', metier: 'Carreleur', ville: 'Lyon 2e', budget: '28 000 €', delai: '6 semaines', tag: 'Lot', desc: 'Pose carrelage et faïence sur 18 chambres + parties communes. Matériaux fournis par le MOA.', e: '🧱' },
    { titre: 'Peintre en bâtiment — renfort chantier', metier: 'Peintre', ville: 'Bron', budget: 'Journalier', delai: 'Sous 10 jours', tag: 'Dispo', desc: 'Recherche peintre pour finitions sur chantier de rénovation. Mission de 3 semaines renouvelable.', e: '🎨' },
    { titre: 'Lot menuiserie extérieure', metier: 'Menuisier', ville: 'Caluire', budget: '32 000 €', delai: '2 mois', tag: 'Lot', desc: 'Fourniture et pose de fenêtres alu sur 20 logements. Sous-traitant RGE souhaité.', e: '🪵' },
  ];

  window.BATILINK_DATA = {
    chantiers: { label: 'Chantiers', kind: 'offre', items: chantiers },
    aides: { label: 'Aides & subventions', kind: 'aide', items: aides },
    artisans: { label: 'Artisans', kind: 'artisan', items: artisans },
    'sous-traitance': { label: 'Sous-traitance', kind: 'offre', items: soustraitance },
  };
  window.BATILINK_VILLES = VILLES;
})();
