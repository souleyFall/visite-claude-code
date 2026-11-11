// Client : le formulaire « Commander » envoie la commande à l'API.
const API = "http://localhost:3000";

export async function envoyerCommande(pizza, adresse) {
  const reponse = await fetch(`${API}/commandes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pizza, adresse }),
  });
  const commande = await reponse.json();
  afficherSuivi(commande);
}

export function afficherSuivi(commande) {
  const zone = document.getElementById("suivi");
  zone.textContent = `Commande ${commande.id} : ${commande.statut}`;
}

export async function actualiserSuivi(id) {
  const reponse = await fetch(`${API}/commandes/${id}`);
  afficherSuivi(await reponse.json());
}
