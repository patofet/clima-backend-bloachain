const express = require("express");

const router = express.Router();
router.get("/producte-drissa", async (req, res) => {
  try {
    const productData = {
      nomProducte: "Tomàquet Ecològic de l'Horta",
      varietatTipus: "Cor de Bou, Cultiu 100% Ecològic",
      dataCollita: "2025-05-24",
      ubicacioHorta: "Horta Biodrissa – Campllong (Girona)",
      kmDistancia: 7,
      personesIntervingut: 12,
      imatgesHorta: [
        {
          src: "https://www.verdeesvida.es/inc/timthumb.php?src=/files/reportage/18052011215741_Huerto%201%20Anjuli%20Ayer%20CC.jpg&w=800",
          alt: "Horta Biodrissa amb sol",
        },
        {
          src: "https://verdeceres.com/wp-content/uploads/huerta-.jpg",
          alt: "Tomàquets madurant a la planta",
        },
        {
          src: "https://blog.oxfamintermon.org/wp-content/uploads/2016/03/huertos-ecologicos.jpg",
          alt: "Tomàquets madurant a la planta",
        },
      ],
      video: {
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        titol: "Descobreix la nostra Horta Ecològica",
        isEmbed: true,
      },
      logos: [
        {
          src: "https://supportgirona.cat/sites/default/files/assets/image/2022-09/drissa-logo.png",
          alt: "Logotip Bdrissa",
        },
        {
          src: "https://fundaciodrissa.com/wp-content/uploads/2024/01/cropped-DRISSA_25_ANYS_MARCA_COLOR-petita-1-768x425.png",
          alt: "Logotip Fundació Drissa",
        },
      ],
    };

    res.render("productDrissa", { product: productData });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error en carregar la informació del producte");
  }
});

module.exports = router;
