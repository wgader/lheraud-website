/**
 * btn-border.js
 * Gère les classes .btn--entering / .btn--leaving sur les boutons .btn--framed
 * pour déclencher les animations CSS de tracé (entrée) et d'effacement (sortie).
 */
(function () {
    function init() {
        document.querySelectorAll('.btn--framed').forEach(btn => {

            btn.addEventListener('mouseenter', () => {
                // Annuler une sortie en cours et démarrer l'entrée
                btn.classList.remove('btn--leaving');
                btn.classList.add('btn--entering');
            });

            btn.addEventListener('mouseleave', () => {
                // Annuler une entrée en cours et démarrer la sortie
                btn.classList.remove('btn--entering');
                btn.classList.add('btn--leaving');
            });

            btn.addEventListener('animationend', (e) => {
                // Quand l'animation de sortie est terminée, retirer la classe
                // pour que les barres crème de base redeviennent visibles
                if (e.animationName === 'btn-frame-erase') {
                    btn.classList.remove('btn--leaving');
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
