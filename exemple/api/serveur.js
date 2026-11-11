// API : reçoit les commandes, les enregistre et prévient la cuisine.
import express from "express";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json());

const commandes = {}; // id -> commande (en mémoire, pour l'exemple)

app.post("/commandes", async (req, res) => {
  const { pizza, adresse } = req.body;
  if (!pizza || !adresse) {
    return res.status(400).send({ erreur: "pizza et adresse obligatoires" });
  }
  const commande = { id: randomUUID().slice(0, 8), pizza, adresse, statut: "recue" };
  commandes[commande.id] = commande;

  await fetch("http://cuisine:4000/a-preparer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commande),
  });
  res.status(201).send(commande);
});

app.post("/evenements", (req, res) => {
  const { type, id } = req.body;
  if (type === "PizzaPrete") {
    commandes[id].statut = "prete";
  }
  res.send({});
});

app.get("/commandes/:id", (req, res) => {
  const commande = commandes[req.params.id];
  if (!commande) return res.status(404).send({ erreur: "commande inconnue" });
  res.send(commande);
});

app.listen(3000, () => console.log("API sur le port 3000"));
