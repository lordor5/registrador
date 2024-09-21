const puppeteer = require("puppeteer");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

//"registros": ["MUS010", "MUS021", "MUS040", "MUS057", "MUS058"]

//const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const delay = calculateDelayUntil10AM();

  // Delay the execution until 10 AM Spain time
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Load the time from the time.json file
  const { registros } = JSON.parse(fs.readFileSync("time.json"));

  await register(registros);
}
main();

async function register(arr) {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  while (arr.length !== 0) {
    console.log("Horas solicitadas: ", arr);

    // Navigate to the login page
    await page.goto(
      "https://intranet.upv.es/pls/soalu/est_intranet.NI_Dual?P_IDIOMA=c"
    );

    // Check if input field with name="dni" exists
    const dniExists = await page.$('input[name="dni"]');
    if (dniExists) {
      console.log("Sesión caducada, iniciando sesión ...");
      // Fill in the username and password
      await page.type('input[name="dni"]', process.env.DNI);
      await page.type('input[name="clau"]', process.env.PASSWORD);

      // Submit the login form
      await page.click('input[type="submit"]');
    }

    // Navigate to the registration page
    await page.goto(
      "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
    );

    // Listen for console messages from the browser context
    page.on("console", (msg) => {
      // Output browser's console messages to Node.js console
      console.log(`BROWSER LOG: ${msg.text()}`);
    });

    // Extract text elements from the table to know which ones are already registered
    const tableData = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll("td")).filter((cell) =>
        cell.innerText.startsWith("MUSCULACIÓN")
      );

      // Return the text content of all matching cells that strictly contain "MUSCULACIÓN"
      return cells.map((cell) => cell.innerText.trim()); // Get the text content
    });

    console.log("Horas ya inscritas: ", tableData); // Log the array of text elements from the table

    // Extract numbers from both arrays
    const musculacionNumbers = tableData.map(extractNumber); // ['010', '021', '040', '057', '058']
    const musNumbers = arr.map(extractNumber); // ['010', '021', '040']

    // Find numbers in MUS that are not in MUSCULACIÓN
    const differentNumbers = musNumbers.filter(
      (num) => !musculacionNumbers.includes(num)
    );

    arr = Array.from(differentNumbers.map((num) => `MUS${num}`));
    console.log("Horas no inscritas: ", arr);

    for (let i = 0; i < arr.length; i++) {
      let text = arr[i];
      let reg = await page.evaluate(async (text) => {
        const link = Array.from(document.querySelectorAll("a")).find((a) =>
          a.innerText.includes(text)
        );
        if (link) {
          link.click();
          await page.waitForNavigation();
          return text;
        }
        return null;
      }, text);

      console.log("Registrado: ", reg);

      if (reg === arr[i]) {
        arr.splice(i, 1);
        i--;
      }
    }

    if (arr.length === 0) {
      break;
    }
    console.log("Esperando 5 minutos...");
    await new Promise((resolve) => setTimeout(resolve, 300000)); //300000 = 5 minutos
  }

  await browser.close();
}

// Extract numeric part from each string
const extractNumber = (str) => {
  const match = str.match(/\d+/); // Find numeric part using regex
  return match ? match[0] : null; // Return the number if found, otherwise null
};

// Helper function to calculate delay until 10 AM in Spain (CET)
function calculateDelayUntil10AM() {
  const now = new Date();

  // Spain is usually in the Central European Time (CET) zone, UTC+1 or UTC+2 (during daylight saving time)
  const currentOffset = now.getTimezoneOffset(); // in minutes
  const spainOffset = -120; // Assuming it's UTC+2 for Daylight Saving Time (adjust accordingly)

  // Convert current time to Spain's time by adjusting the timezone offset
  now.setMinutes(now.getMinutes() + currentOffset - spainOffset);

  // Set the target time to 10:00 AM in Spain
  const targetTime = new Date(now);
  targetTime.setHours(10, 0, 10, 0); // 10:00 AM

  let delay = targetTime - now;

  // If it's already past 10:00 AM today, set the target to 10:00 AM tomorrow
  if (now > targetTime) {
    delay = 0; // Set to the next day
  }

  console.log(`Waiting ${delay / 1000 / 60} minutes until 10 AM Spain time...`);
  return delay;
}
