const puppeteer = require("puppeteer");
const iPhone = puppeteer.KnownDevices["iPhone 13"];
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

//"registros": ["MUS010", "MUS021", "MUS040", "MUS057", "MUS058"]

async function main() {
  const delay = calculateDelayUntil10AM();

  // Delay the execution until 10 AM Spain time
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Load the time from the time.json file
  const { registros } = JSON.parse(fs.readFileSync("time.json"));

  const browser = await puppeteer.launch({
    headless: true,
  });

  console.log("Registros a registrar: ", registros);

  let arr = registros;
  let page;
  const isMobile = true; // Change to `false` for PC mode

  while (arr.length > 0) {
    page = await logIn(browser, page, isMobile);

    let iterationsBeforeLogIn = 120 + Math.floor(Math.random() * 40 - 20);
    console.log(
      `Realizando ${iterationsBeforeLogIn} iteraciones antes de iniciar sesión...`
    );
    for (let i = 0; i < iterationsBeforeLogIn; i++) {
      arr = await register(registros, page, isMobile);

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

async function register(arr, page, isMobile) {
  console.log("Horas solicitadas: ", arr);

  if (isMobile) {
    await page.emulate(iPhone);
  }

  // Navigate to the registration page
  await page.goto(
    "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
  );

  page.on("console", (msg) => {
    console.log(`BROWSER LOG: ${msg.text()}`);
  });

  // Extract text elements from the table
  const tableData = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll("td")).filter((cell) =>
      cell.innerText.startsWith("MUSCULACIÓN")
    );
    return cells.map((cell) => cell.innerText.trim());
  });

  console.log("Horas ya inscritas: ", tableData);

  const musculacionNumbers = tableData.map(extractNumber);
  const musNumbers = arr.map(extractNumber);
  const differentNumbers = musNumbers.filter(
    (num) => !musculacionNumbers.includes(num)
  );

  arr = Array.from(differentNumbers.map((num) => `MUS${num}`));
  console.log("Horas no inscritas: ", arr);

  for (let i = 0; i < arr.length; i++) {
    let text = arr[i];
    let reg = await page.evaluate(async (text) => {
      const liElements = Array.from(
        document.querySelectorAll('li[data-theme="c"]')
      );
      for (const li of liElements) {
        const aTag = li.querySelector("a"); // Targeting the <a> inside <li>
        if (aTag && aTag.innerText.includes("Inscribirse")) {
          aTag.click();
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

async function logIn(browser, pageBefore, isMobile) {
  let page;
  if (!pageBefore) {
    page = await browser.newPage();
  } else {
    page = pageBefore;
  }

  if (isMobile) {
    await page.emulate(iPhone);
  } else {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
    );
    await page.setViewport({ width: 1200, height: 800 });
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

const extractNumber = (str) => {
  const match = str.match(/\d+/);
  return match ? match[0] : null;
};

function calculateDelayUntil10AM() {
  const now = new Date();
  const currentOffset = now.getTimezoneOffset();
  const spainOffset = -120;

  now.setMinutes(now.getMinutes() + currentOffset - spainOffset);
  const targetTime = new Date(now);
  targetTime.setHours(10, 0, 10, 0);

  let delay = targetTime - now;
  if (now > targetTime) {
    delay = 0;
  }

  console.log(`Waiting ${delay / 1000 / 60} minutes until 10 AM Spain time...`);
  return delay;
}
