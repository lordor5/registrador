const puppeteer = require("puppeteer");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

// Wait for the scheduled time
async function register() {
  const browser = await puppeteer.launch({ headless: true }); // Change to true for headless mode
  const page = await browser.newPage();

  // Navigate to the login page
  await page.goto(
    "https://intranet.upv.es/pls/soalu/est_intranet.NI_Dual?P_IDIOMA=c"
  );

  // Fill in the username and password
  await page.type('input[name="dni"]', process.env.DNI);
  await page.type('input[name="clau"]', process.env.PASSWORD);

  // Submit the login form
  await page.click('input[type="submit"]');

  // Navigate to the registration page
  await page.goto(
    "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
  );

  // Load the time from the time.json file
  const timeConfig = JSON.parse(fs.readFileSync("time.json"));
  console.log(timeConfig);

  // Listen for console messages from the browser context
  page.on("console", (msg) => {
    // Output browser's console messages to Node.js console
    console.log(`BROWSER LOG: ${msg.text()}`);
  });

  // Click on the available slot (adjust the selector for the specific time you want)
  await page.evaluate(async (timeConfig) => {
    // Helper function to create a delay
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const registro of timeConfig.registros) {
      // Find the anchor tag that contains 'MUS068' in its text
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.innerText.includes(registro)
      );

      // If the link is found, click on it
      if (link) {
        link.click();
        console.log("registrado en: ", registro);
        await delay(500);
      }
    }
  }, timeConfig);

  // Close the browser after actions
  await browser.close();
}
register();
