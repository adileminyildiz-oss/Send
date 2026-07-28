// ---------------------------------------------------------------------------
// BâtiLink — window.BATILINK_PRIX : catalogue statique de prix (bordereau /
// bibliothèque de prix du BTP).
//
// ⚠️ PRIX INDICATIFS. Les montants ci-dessous sont des MOYENNES INDICATIVES HT
// (fourniture + pose sauf mention contraire), estimées pour 2026 en France
// métropolitaine. Ils varient fortement selon la région, l'accès au chantier,
// les quantités, la qualité des matériaux et le professionnel. Ils ne
// constituent NI un devis, NI un engagement de prix : à ajuster au cas par cas.
//
// Chaque entrée : { metier, designation, unite, pu }
//   • unite : 'u' (unité) · 'm²' · 'ml' (mètre linéaire) · 'ens' (ensemble) ·
//             'h' (heure) · 'forfait'
//   • pu    : prix unitaire indicatif HT en euros (nombre)
//
// Fichier 100 % statique : aucune dépendance, fonctionne hors-ligne.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  window.BATILINK_PRIX = [
    // ===================== PLOMBERIE =====================
    { metier: 'Plomberie', designation: 'Dépose ancienne installation sanitaire', unite: 'forfait', pu: 320 },
    { metier: 'Plomberie', designation: 'Recherche de fuite (mise en évidence)', unite: 'forfait', pu: 180 },
    { metier: 'Plomberie', designation: 'Fourniture et pose WC suspendu (bâti-support)', unite: 'u', pu: 620 },
    { metier: 'Plomberie', designation: 'Fourniture et pose lavabo + robinetterie', unite: 'u', pu: 340 },
    { metier: 'Plomberie', designation: 'Fourniture et pose receveur de douche + bonde', unite: 'u', pu: 480 },
    { metier: 'Plomberie', designation: 'Fourniture et pose mitigeur thermostatique douche', unite: 'u', pu: 250 },
    { metier: 'Plomberie', designation: 'Fourniture et pose chauffe-eau électrique 200 L', unite: 'u', pu: 780 },
    { metier: 'Plomberie', designation: 'Fourniture et pose chauffe-eau thermodynamique', unite: 'u', pu: 2600 },
    { metier: 'Plomberie', designation: 'Alimentation eau (PER) par point d\'eau', unite: 'u', pu: 130 },
    { metier: 'Plomberie', designation: 'Réseau évacuation PVC', unite: 'ml', pu: 42 },
    { metier: 'Plomberie', designation: 'Raccordement machine à laver / lave-vaisselle', unite: 'u', pu: 110 },
    { metier: 'Plomberie', designation: 'Main d\'œuvre plombier', unite: 'h', pu: 55 },

    // ===================== ÉLECTRICITÉ =====================
    { metier: 'Électricité', designation: 'Fourniture et pose tableau électrique nu 3 rangées', unite: 'u', pu: 520 },
    { metier: 'Électricité', designation: 'Mise aux normes tableau électrique (avec équipements)', unite: 'forfait', pu: 1450 },
    { metier: 'Électricité', designation: 'Point d\'éclairage complet (câblage + appareillage)', unite: 'u', pu: 95 },
    { metier: 'Électricité', designation: 'Prise de courant 16 A complète', unite: 'u', pu: 85 },
    { metier: 'Électricité', designation: 'Prise RJ45 (réseau) complète', unite: 'u', pu: 105 },
    { metier: 'Électricité', designation: 'Fourniture et pose interrupteur / va-et-vient', unite: 'u', pu: 75 },
    { metier: 'Électricité', designation: 'Fourniture et pose spot LED encastré', unite: 'u', pu: 55 },
    { metier: 'Électricité', designation: 'Alimentation spécialisée (plaque, four, VMC)', unite: 'u', pu: 140 },
    { metier: 'Électricité', designation: 'Fourniture et pose borne de recharge 7 kW (IRVE)', unite: 'u', pu: 1350 },
    { metier: 'Électricité', designation: 'Installation électrique complète (par m² habitable)', unite: 'm²', pu: 110 },
    { metier: 'Électricité', designation: 'Main d\'œuvre électricien', unite: 'h', pu: 52 },

    // ===================== MAÇONNERIE =====================
    { metier: 'Maçonnerie', designation: 'Mur en parpaing (bloc 20) monté', unite: 'm²', pu: 78 },
    { metier: 'Maçonnerie', designation: 'Mur en brique monomur monté', unite: 'm²', pu: 135 },
    { metier: 'Maçonnerie', designation: 'Dalle béton armé (ep. 12 cm)', unite: 'm²', pu: 95 },
    { metier: 'Maçonnerie', designation: 'Chape de ravoirage / lissage', unite: 'm²', pu: 32 },
    { metier: 'Maçonnerie', designation: 'Ouverture de mur porteur + IPN (pose comprise)', unite: 'forfait', pu: 3200 },
    { metier: 'Maçonnerie', designation: 'Fondations semelle filante', unite: 'ml', pu: 145 },
    { metier: 'Maçonnerie', designation: 'Enduit de façade traditionnel', unite: 'm²', pu: 48 },
    { metier: 'Maçonnerie', designation: 'Démolition cloison (dépose + évacuation)', unite: 'm²', pu: 45 },
    { metier: 'Maçonnerie', designation: 'Terrasse dalle béton désactivé', unite: 'm²', pu: 90 },
    { metier: 'Maçonnerie', designation: 'Main d\'œuvre maçon', unite: 'h', pu: 48 },

    // ===================== COUVERTURE =====================
    { metier: 'Couverture', designation: 'Réfection couverture tuiles (dépose + pose)', unite: 'm²', pu: 115 },
    { metier: 'Couverture', designation: 'Couverture ardoises naturelles', unite: 'm²', pu: 180 },
    { metier: 'Couverture', designation: 'Écran sous-toiture HPV', unite: 'm²', pu: 18 },
    { metier: 'Couverture', designation: 'Gouttière zinc (fourniture + pose)', unite: 'ml', pu: 55 },
    { metier: 'Couverture', designation: 'Solin / raccord d\'étanchéité en zinc', unite: 'ml', pu: 48 },
    { metier: 'Couverture', designation: 'Démoussage et traitement hydrofuge toiture', unite: 'm²', pu: 22 },
    { metier: 'Couverture', designation: 'Fourniture et pose fenêtre de toit (Velux)', unite: 'u', pu: 850 },
    { metier: 'Couverture', designation: 'Réparation ponctuelle de fuite', unite: 'forfait', pu: 380 },
    { metier: 'Couverture', designation: 'Main d\'œuvre couvreur', unite: 'h', pu: 50 },

    // ===================== MENUISERIE =====================
    { metier: 'Menuiserie', designation: 'Fourniture et pose fenêtre PVC double vitrage', unite: 'u', pu: 620 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose fenêtre aluminium', unite: 'u', pu: 880 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose porte-fenêtre / baie coulissante', unite: 'u', pu: 1650 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose porte d\'entrée', unite: 'u', pu: 1550 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose porte intérieure', unite: 'u', pu: 320 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose volet roulant électrique', unite: 'u', pu: 620 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose parquet contrecollé', unite: 'm²', pu: 65 },
    { metier: 'Menuiserie', designation: 'Placard / dressing sur mesure', unite: 'ml', pu: 480 },
    { metier: 'Menuiserie', designation: 'Fourniture et pose plinthes bois', unite: 'ml', pu: 14 },
    { metier: 'Menuiserie', designation: 'Main d\'œuvre menuisier', unite: 'h', pu: 52 },

    // ===================== CHAUFFAGE =====================
    { metier: 'Chauffage', designation: 'Fourniture et pose pompe à chaleur air/eau', unite: 'ens', pu: 12500 },
    { metier: 'Chauffage', designation: 'Fourniture et pose PAC air/air (split)', unite: 'u', pu: 2400 },
    { metier: 'Chauffage', designation: 'Fourniture et pose chaudière gaz condensation', unite: 'u', pu: 4200 },
    { metier: 'Chauffage', designation: 'Fourniture et pose radiateur eau chaude', unite: 'u', pu: 480 },
    { metier: 'Chauffage', designation: 'Fourniture et pose radiateur électrique à inertie', unite: 'u', pu: 380 },
    { metier: 'Chauffage', designation: 'Plancher chauffant hydraulique', unite: 'm²', pu: 85 },
    { metier: 'Chauffage', designation: 'Fourniture et pose poêle à granulés', unite: 'u', pu: 4800 },
    { metier: 'Chauffage', designation: 'Entretien annuel chaudière', unite: 'forfait', pu: 130 },
    { metier: 'Chauffage', designation: 'Main d\'œuvre chauffagiste', unite: 'h', pu: 58 },

    // ===================== PEINTURE =====================
    { metier: 'Peinture', designation: 'Peinture murs et plafonds 2 couches (avec prépa)', unite: 'm²', pu: 32 },
    { metier: 'Peinture', designation: 'Peinture murs seuls 2 couches', unite: 'm²', pu: 25 },
    { metier: 'Peinture', designation: 'Ratissage / enduit de lissage complet', unite: 'm²', pu: 22 },
    { metier: 'Peinture', designation: 'Peinture boiseries (portes, plinthes)', unite: 'ml', pu: 18 },
    { metier: 'Peinture', designation: 'Pose toile de verre + peinture', unite: 'm²', pu: 34 },
    { metier: 'Peinture', designation: 'Pose papier peint', unite: 'm²', pu: 26 },
    { metier: 'Peinture', designation: 'Ravalement de façade (peinture)', unite: 'm²', pu: 42 },
    { metier: 'Peinture', designation: 'Main d\'œuvre peintre', unite: 'h', pu: 42 },

    // ===================== CARRELAGE =====================
    { metier: 'Carrelage', designation: 'Fourniture et pose carrelage sol grès cérame', unite: 'm²', pu: 58 },
    { metier: 'Carrelage', designation: 'Fourniture et pose carrelage mural (faïence)', unite: 'm²', pu: 62 },
    { metier: 'Carrelage', designation: 'Pose seule carrelage grand format', unite: 'm²', pu: 48 },
    { metier: 'Carrelage', designation: 'Fourniture et pose plinthes carrelées', unite: 'ml', pu: 16 },
    { metier: 'Carrelage', designation: 'Réalisation chape avant carrelage', unite: 'm²', pu: 30 },
    { metier: 'Carrelage', designation: 'Étanchéité sous carrelage (SEL/douche)', unite: 'm²', pu: 38 },
    { metier: 'Carrelage', designation: 'Joints et finitions', unite: 'm²', pu: 12 },
    { metier: 'Carrelage', designation: 'Main d\'œuvre carreleur', unite: 'h', pu: 46 },

    // ===================== ISOLATION =====================
    { metier: 'Isolation', designation: 'Isolation combles perdus soufflée (laine)', unite: 'm²', pu: 28 },
    { metier: 'Isolation', designation: 'Isolation rampants sous toiture', unite: 'm²', pu: 55 },
    { metier: 'Isolation', designation: 'Isolation thermique par l\'extérieur (ITE)', unite: 'm²', pu: 165 },
    { metier: 'Isolation', designation: 'Isolation des murs par l\'intérieur (doublage)', unite: 'm²', pu: 62 },
    { metier: 'Isolation', designation: 'Isolation plancher bas / vide sanitaire', unite: 'm²', pu: 42 },
    { metier: 'Isolation', designation: 'Fourniture et pose VMC simple flux', unite: 'ens', pu: 950 },
    { metier: 'Isolation', designation: 'Fourniture et pose VMC double flux', unite: 'ens', pu: 3800 },
    { metier: 'Isolation', designation: 'Main d\'œuvre isolation', unite: 'h', pu: 44 },

    // ===================== PLÂTRERIE / PLACO =====================
    { metier: 'Placo', designation: 'Cloison placo + ossature + isolation', unite: 'm²', pu: 52 },
    { metier: 'Placo', designation: 'Doublage placo collé sur mur', unite: 'm²', pu: 42 },
    { metier: 'Placo', designation: 'Faux plafond placo sur ossature', unite: 'm²', pu: 48 },
    { metier: 'Placo', designation: 'Plaque hydrofuge (pièce humide)', unite: 'm²', pu: 56 },
    { metier: 'Placo', designation: 'Bandes à joints + finition (prête à peindre)', unite: 'm²', pu: 14 },
    { metier: 'Placo', designation: 'Coffrage / habillage placo', unite: 'ml', pu: 38 },
    { metier: 'Placo', designation: 'Trappe de visite', unite: 'u', pu: 65 },
    { metier: 'Placo', designation: 'Main d\'œuvre plaquiste', unite: 'h', pu: 44 }
  ];
})();
