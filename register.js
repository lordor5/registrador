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

  const browser = await puppeteer.launch({
    headless: false, //false for debugging
    userDataDir: "/tmp/myChromeSession",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  console.log("Registros a registrar: ", registros);

  let arr = registros;
  let page;
  while (arr.length > 0) {
    page = await logIn(browser, page);

    let iterationsBeforeLogIn = 120 + Math.floor(Math.random() * 40 - 20);
    console.log(
      `Realizando ${iterationsBeforeLogIn} iteraciones antes de iniciar sesión...`
    );
    for (let i = 0; i < iterationsBeforeLogIn; i++) {
      arr = await register(registros, page);

      if (arr.length === 0) {
        break;
      }

      let waitingTime = (20 + Math.floor(Math.random() * 20 - 10)) * 1000;
      console.log(`Esperando ${waitingTime / 1000} segundos...`);
      await new Promise((resolve) => setTimeout(resolve, waitingTime)); //300000 = 5 minutos
    }
  }
  await browser.close();
}
main();

async function register(arr, page) {
  //const page = await browser.newPage();

  console.log("Horas solicitadas: ", arr);

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
        return text;
      }
      return null;
    }, text);

    if (reg === arr[i]) {
      console.log("Registrado: ", reg);
      await page.waitForNavigation();

      arr.splice(i, 1);
      i--;
    }
  }
  // if (arr.length === 0) {
  //   break;
  // }

  return arr;
}

async function logIn(browser, pageBefore) {
  let page;
  if (!pageBefore) {
    page = await browser.newPage();
  } else {
    page = pageBefore;
  }

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
  return page;
}

// Extract numeric part from each string
const extractNumber = (str) => {
  const match = str.match(/\d+/); // Find numeric part using regex
  return match ? match[0] : null; // Return the number if found, otherwise null
};

// Helper function to calculate delay until 10 AM in Spain (CET)
function calculateDelayUntil10AM() {
  const now = new Date();

  // Check if it's Saturday (day 6)
  if (now.getDay() !== 6) {
    console.log("It's not Saturday, no need to wait.");
    return 0;
  }

  // Convert current local time to Spain time using the Intl API.
  // This conversion automatically accounts for daylight saving time changes.
  const spainNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );

  // Set the target time to 10:00:00.000 in Spain time.
  const targetTime = new Date(spainNow);
  targetTime.setHours(10, 0, 20, 0);

  // Calculate the delay until 10 AM. If it's already past 10 AM Spain time, set delay to 0.
  let delay = targetTime - spainNow;
  if (spainNow > targetTime) {
    delay = 0;
  }

  console.log(`Waiting ${delay / 1000 / 60} minutes until 10 AM Spain time...`);
  return delay;
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
