// Cuisine : prépare les pizzas puis prévient l'API qu'elles sont prêtes.
import express from "express";

const app = express();
app.use(express.json());

const TEMPS_DE_CUISSON = { margherita: 8, reine: 10, quatreFromages: 12 }; // minutes

app.post("/a-preparer", (req, res) => {
  const commande = req.body;
  const minutes = TEMPS_DE_CUISSON[commande.pizza] ?? 10;
  console.log(`Pizza ${commande.pizza} au four pour ${minutes} min`);

  setTimeout(() => prevenirApi(commande.id), minutes * 60 * 1000);
  res.send({ acceptee: true });
});

async function prevenirApi(id) {
  await fetch("http://api:3000/evenements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "PizzaPrete", id }),
  });
}

app.listen(4000, () => console.log("Cuisine sur le port 4000"));
