const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const devtools = require("puppeteer-extra-plugin-devtools")();

//const iPhone = puppeteer.KnownDevices["iPhone 13"];
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

//"registros": ["MUS010", "MUS021", "MUS040", "MUS057", "MUS058"]
puppeteer.use(StealthPlugin());

let headless = false;
if (!process.env.HEADLESS) headless = true;

console.log(headless);

async function main() {
  const delay = calculateDelayUntil10AM();

  // Delay the execution until 10 AM Spain time
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Load the time from the time.json file
  const { registros } = JSON.parse(fs.readFileSync("time.json"));

  const browser = await puppeteer.launch({
    headless: headless, //false for debugging
    userDataDir: "/tmp/myChromeSession",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  console.log("Horas para registrar: ", registros);

  let page;
  let arr = registros; //await horasRegistradas(page);

  while (arr.length > 0) {
    page = await logIn(browser, page);

    tableData = await horasRegistradas(page);
    console.log("Horas ya inscritas: ", tableData);

    const musculacionNumbers = tableData.map(extractNumber);
    const musNumbers = arr.map(extractNumber);
    const differentNumbers = musNumbers.filter(
      (num) => !musculacionNumbers.includes(num)
    );

    arr = Array.from(differentNumbers.map((num) => `MUS${num}`));

    console.log("Horas no inscritas: ", arr);

    let iterationsBeforeLogIn = 120 + Math.floor(Math.random() * 40 - 20);
    console.log(
      `Realizando ${iterationsBeforeLogIn} iteraciones antes de iniciar sesión...`
    );
    for (let i = 0; i < iterationsBeforeLogIn; i++) {
      console.log("Horas solicitadas: ", arr);
      arr = await register(arr, page);

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

const horasRegistradasUrl =
  "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=movil&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad";
async function horasRegistradas(page) {
  await page.goto(horasRegistradasUrl, { waitUntil: "load" });
  //await page.waitForNavigation();
  await page.waitForSelector("h2.cabcontainer");

  // Extract titles of each li element under the target h2
  // Extract the text from the <font> element inside each li under the specified h2
  const tableData = await page.evaluate(() => {
    // Find all the <h2> elements with the class "cabcontainer"
    const h2Elements = document.querySelectorAll("h2.cabcontainer");

    // Check if the correct h2 is found
    const h2 = Array.from(h2Elements).find((h2) =>
      h2.textContent.includes("Grupos Inscritos:")
    );
    if (!h2) {
      console.log("Couldn't find the h2 element with 'Grupos Inscritos'");
      return []; // Return empty array if not found
    }

    // Find the next <ul> sibling after the <h2> (or the closest <ul> in the same section)
    const ul = h2.nextElementSibling;
    if (!ul || !ul.classList.contains("ui-listview")) {
      console.log("Couldn't find the corresponding <ul> element");
      return [];
    }

    // Extract the text from the <font> tag in each <li> element
    const liElements = ul.querySelectorAll("li");
    return Array.from(liElements).map((li) => {
      const fontElement = li.querySelector("font"); // Target the <font> tag
      return fontElement ? fontElement.textContent.trim() : "No Title";
    });
  });

  return tableData;
}

const PaginaInscripcion =
  "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad";
async function register(arr, page) {
  //for unit testing
  if (!page) {
    page = await logIn();
  }
  if (!arr) arr = ["MUS010", "MUS021", "MUS040", "MUS057", "MUS075"];

  // Navigate to the registration page
  await page.goto(PaginaInscripcion, { waitUntil: "load" });

  for (let i = 0; i < arr.length; i++) {
    let text = arr[i];

    let reg = await page.evaluate(async (text) => {
      // Find the li element that contains the text
      const tableItem = Array.from(document.querySelectorAll("td")).find((td) =>
        td.innerText.includes(text)
      );
      // If the li is found
      if (tableItem) {
        // Find the <a> tag within the li and click it if it exists
        const link = tableItem.querySelector("a");
        console.log(link);
        if (link) {
          link.click();
          return text;
        }
      }

      return null;
    }, text);

    if (reg === arr[i]) {
      console.log("Registrado: ", reg);
      await page.waitForNavigation();

      await delay(2000);
      arr.splice(i, 1);
      i--;
    }
  }

  return arr;
}

async function registerMobile(arr, page, isMobile) {
  //TODO
  console.log("Horas solicitadas: ", arr);

  if (isMobile) {
    await page.emulate(devtools.devices["iPhone X"]);
  }
  // Navigate to the registration page
  await page.goto(
    "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
  );

  // Wait for the specific h2 element with the "Grupos Inscritos" text
  await page.waitForSelector("h2.cabcontainer");

  // Extract titles of each li element under the target h2
  // Extract the text from the <font> element inside each li under the specified h2
  const tableData = await page.evaluate(() => {
    // Find all the <h2> elements with the class "cabcontainer"
    const h2Elements = document.querySelectorAll("h2.cabcontainer");

    // Check if the correct h2 is found
    const h2 = Array.from(h2Elements).find((h2) =>
      h2.textContent.includes("Grupos Inscritos:")
    );
    if (!h2) {
      console.log("Couldn't find the h2 element with 'Grupos Inscritos'");
      return []; // Return empty array if not found
    }

    // Find the next <ul> sibling after the <h2> (or the closest <ul> in the same section)
    const ul = h2.nextElementSibling;
    if (!ul || !ul.classList.contains("ui-listview")) {
      console.log("Couldn't find the corresponding <ul> element");
      return [];
    }

    // Extract the text from the <font> tag in each <li> element
    const liElements = ul.querySelectorAll("li");
    return Array.from(liElements).map((li) => {
      const fontElement = li.querySelector("font"); // Target the <font> tag
      return fontElement ? fontElement.textContent.trim() : "No Title";
    });
  });

  console.log("Horas ya inscritas: ", tableData);

  const musculacionNumbers = tableData.map(extractNumber);
  const musNumbers = arr.map(extractNumber);
  const differentNumbers = musNumbers.filter(
    (num) => !musculacionNumbers.includes(num)
  );

  arr = Array.from(differentNumbers.map((num) => `MUS${num}`));
  console.log("Horas no inscritas: ", arr);

  if (isMobile) {
    await page.emulate(iPhone);
  }
  await page.goto(
    "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
  );

  for (let i = 0; i < arr.length; i++) {
    let text = arr[i];

    let reg = await page.evaluate(async (text) => {
      // Find the li element that contains the text
      const listItem = Array.from(document.querySelectorAll("li")).find((li) =>
        li.innerText.includes(text)
      );
      // If the li is found
      if (listItem) {
        // Find the <a> tag within the li and click it if it exists
        const link = listItem.querySelector("a");
        console.log(link);
        if (link) {
          link.click();
          return text;
        }
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

  return arr;
}

const LogInPage =
  "https://cas.upv.es/cas/login?service=https%3A%2F%2Fwww.upv.es%2Fpls%2Fsoalu%2Fsic_intracas.app_intranet%3FP_CUA%3Dmiupv";

async function logIn(browser, pageBefore) {
  //for unit testing
  if (!browser) {
    browser = await puppeteer.launch({
      headless: headless, //false for debugging
      userDataDir: "/tmp/myChromeSession",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  let page = pageBefore;
  if (!pageBefore) {
    page = await browser.newPage();
  }

  await page.setViewport({ width: 1200, height: 800 });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36"
  );

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["es-ES", "es"],
    });
  });

  await page.goto(LogInPage, { waitUntil: "load" });

  // Verificar que hace falta volver a iniciar sesión, sino redirige a la intranet y no hay formulario
  const inputExists = await page.$('input[name="username"]');
  if (inputExists) {
    console.log("Sesión caducada, iniciando sesión ...");
    // Fill in the username and password
    await page.type('input[name="username"]', process.env.DNI);
    await page.type('input[type="password"]', process.env.PASSWORD);

    // Submit the login form
    await page.click('button[name="submitBtn"]');
    await page.waitForNavigation();
  }

  // Verificar que no haya error de sesión
  if (LogInPage != (await page.url())) console.log("Inicio de sesión correcto");
  else
    console.log(
      "Inicio de sesión fallido, revisa las credenciales o cambios en la pagina"
    );

  return page;
}

const extractNumber = (str) => {
  const match = str.match(/\d+/);
  return match ? match[0] : null;
};

function calculateDelayUntil10AM() {
  const now = new Date();

  // Check if it's Saturday (day 6)
  if (now.getDay() !== 6) {
    console.log("It's not Saturday, no need to wait.");
    return 0;
  }

  // Convert current local time to Spain time using the Intl API.
  // This conversion automatically accounts for daylight saving time changes.
  const spainNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));

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
